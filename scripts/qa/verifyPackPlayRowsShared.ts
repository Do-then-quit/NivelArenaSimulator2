import { mkdir } from 'node:fs/promises';
import { chromium, Page } from 'playwright';
import { UnifiedTestModule } from '../../src/logic/cardTests/shared/types';
import {
    RecordedScenarioStep,
    RecordedUnifiedScenario,
    recordUnifiedScenario,
} from '../../src/logic/cardTests/verificationPlayback';

const TARGET_URL = process.env.TARGET_URL || 'http://127.0.0.1:5173';
const START_INDEX = Number(process.env.START_INDEX || '1');
const STEP_DELAY_MS = 120;
const VERBOSE_VERIFY = process.env.VERBOSE_VERIFY === '1';
const SKILL_ZONE_PROMPT_ACTION_TYPES = new Set<string>([
    'BT06_SELECT_SKILL_ZONE_CARD',
    'BT03_SELECT_SKILL_ZONE_CARD_TO_TRASH',
    'BT03_011_SELECT_SKILL_ZONE_CARD_TO_TRASH',
    'BT03_052_SELECT_SKILL_ZONE_COST3_TO_TRASH',
    'BT03_062_SELECT_SKILL_ZONE_TO_CAST',
    'SB01_001_SELECT_SKILL_ZONE_TO_TRASH',
]);

export interface VerifyPackPlayRowsOptions {
    packId: string;
    module: UnifiedTestModule;
    screenshotDir: string;
}

function withSilentConsole<T>(fn: () => T): T {
    const original = {
        log: console.log,
        warn: console.warn,
        info: console.info,
        group: console.group,
        groupEnd: console.groupEnd,
    };
    console.log = () => {};
    console.warn = () => {};
    console.info = () => {};
    console.group = () => {};
    console.groupEnd = () => {};
    try {
        return fn();
    } finally {
        console.log = original.log;
        console.warn = original.warn;
        console.info = original.info;
        console.group = original.group;
        console.groupEnd = original.groupEnd;
    }
}

function buildRecordedScenarios(module: UnifiedTestModule): Array<RecordedUnifiedScenario & { scenarioId: string; displayName: string }> {
    const counts = new Map<string, number>();
    return withSilentConsole(() =>
        module.tests.map((test) => {
            const ordinal = (counts.get(test.testId) || 0) + 1;
            counts.set(test.testId, ordinal);
            return {
                scenarioId: `${test.testId}::${String(ordinal).padStart(2, '0')}`,
                displayName: `${test.testId} · ${test.name}`,
                ...recordUnifiedScenario(test),
            };
        }),
    );
}

function normalizeState(state: unknown): unknown {
    const cloned = JSON.parse(JSON.stringify(state));
    const players = Array.isArray((cloned as any)?.players) ? (cloned as any).players : [];
    const idMap = players.reduce((map: Record<string, string>, player: any, index: number) => {
        if (player?.id) {
            map[player.id] = `P${index}`;
        }
        return map;
    }, {});

    const replace = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(replace);
        if (value && typeof value === 'object') {
            const output: Record<string, unknown> = {};
            Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
                output[key] = replace(entry);
            });
            return output;
        }
        if (typeof value === 'string' && idMap[value]) {
            return idMap[value];
        }
        return value;
    };

    return replace(cloned);
}

function summarizeState(state: any) {
    const summarizeZone = (zone: any) => ({
        unitId: zone?.unit?.id || null,
        unitCostOverride: zone?.unit?.turnCostOverride?.cost ?? null,
        items: Array.isArray(zone?.items) ? zone.items.map((item: any) => item?.id || null) : [],
        buffs: Array.isArray(zone?.buffs)
            ? zone.buffs.map((buff: any) => ({
                type: buff?.type ?? null,
                value: buff?.value ?? null,
                duration: buff?.duration ?? null,
            }))
            : [],
        temporaryEffects: Array.isArray(zone?.temporaryEffects)
            ? zone.temporaryEffects.map((effect: any) => effect?.description ?? null)
            : [],
        hasAttacked: !!zone?.hasAttacked,
        attackCountThisTurn: zone?.attackCountThisTurn ?? 0,
        extraAttackAllowance: zone?.extraAttackAllowance ?? 0,
        isExhausted: !!zone?.isExhausted,
    });

    return {
        phase: state?.phase ?? null,
        interactionMode: state?.interactionMode ?? null,
        turnPlayerIndex: state?.turnPlayerIndex ?? null,
        combatStep: state?.combatStep ?? null,
        pendingAttackerIndex: state?.pendingAttackerIndex ?? null,
        winner: state?.winner ?? null,
        pendingEffect: state?.pendingEffect
            ? {
                actionType: state.pendingEffect.actionType ?? null,
                validTargets: state.pendingEffect.validTargets ?? null,
                selectedTargetsCount: Array.isArray(state.pendingEffect.selectedTargets) ? state.pendingEffect.selectedTargets.length : 0,
            }
            : null,
        players: (state?.players || []).map((player: any) => ({
            leaderLevel: player?.leaderLevel ?? 0,
            levelZoneId: player?.levelZone?.id || null,
            awakened: !!player?.levelZone?.isAwakened,
            hand: (player?.hand || []).map((card: any) => card?.id || null),
            deck: (player?.deck || []).map((card: any) => card?.id || null),
            damage: (player?.damage || []).map((card: any) => card?.id || null),
            trash: (player?.trash || []).map((card: any) => card?.id || null),
            skillZone: (player?.skillZone || []).map((card: any) => card?.id || null),
            lockedSkillIdsUntilTurnEnd: player?.lockedSkillIdsUntilTurnEnd || {},
            lockedActivationsUntilTurnCount: player?.lockedActivationsUntilTurnCount || {},
            lockedSkillTraitsUntilTurnEnd: player?.lockedSkillTraitsUntilTurnEnd || {},
            pendingNextPlayUnitEffects: Array.isArray(player?.pendingNextPlayUnitEffects) ? player.pendingNextPlayUnitEffects.length : 0,
            turnDamageCountReferenceBonus: player?.turnDamageCountReferenceBonus ?? 0,
            unitZones: (player?.unitZones || []).map(summarizeZone),
        })),
        revealedCards: (state?.revealedCards || []).map((card: any) => card?.id || null),
        delayedActions: (state?.delayedActions || []).map((action: any) => ({
            type: action?.type ?? null,
            cardId: action?.card?.id || null,
            turnCount: action?.turnCount ?? null,
        })),
    };
}

function firstDiff(a: any, b: any, path: string = 'root'): string | null {
    if (typeof a !== typeof b) return `${path}: type mismatch`;
    if (a === null || b === null) return a === b ? null : `${path}: null mismatch`;
    if (typeof a !== 'object') return Object.is(a, b) ? null : `${path}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`;

    if (Array.isArray(a)) {
        if (!Array.isArray(b)) return `${path}: array mismatch`;
        if (a.length !== b.length) return `${path}.length: ${a.length} !== ${b.length}`;
        for (let i = 0; i < a.length; i += 1) {
            const diff = firstDiff(a[i], b[i], `${path}[${i}]`);
            if (diff) return diff;
        }
        return null;
    }

    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.join('|') !== bKeys.join('|')) {
        return `${path}: keys mismatch`;
    }
    for (const key of aKeys) {
        const diff = firstDiff(a[key], b[key], `${path}.${key}`);
        if (diff) return diff;
    }
    return null;
}

function summarizeComparableState(state: unknown) {
    return summarizeState(normalizeState(state));
}

function getTurnPlayerIndexFromStep(step: RecordedScenarioStep): number | null {
    const turnPlayerIndex = (step.preState as any)?.turnPlayerIndex;
    return typeof turnPlayerIndex === 'number' ? turnPlayerIndex : null;
}

function getDefenderPlayerIndexFromStep(step: RecordedScenarioStep): number | null {
    const turnPlayerIndex = getTurnPlayerIndexFromStep(step);
    if (turnPlayerIndex === null) return null;
    if (turnPlayerIndex === 0) return 1;
    if (turnPlayerIndex === 1) return 0;
    return null;
}

async function getUiRefForPlayerIndex(page: Page, playerIndex: number): Promise<'current' | 'opponent'> {
    if (playerIndex === 0) return 'current';
    if (playerIndex === 1) return 'opponent';
    throw new Error(`Unsupported player index for verification UI: ${playerIndex}`);
}

async function getUiRefForPlayerId(page: Page, playerId: string): Promise<'current' | 'opponent'> {
    const playerIndex = await page.evaluate((targetPlayerId) => {
        const players = (window as any).debug?.game?.state?.players || [];
        return players.findIndex((player: any) => player?.id === targetPlayerId);
    }, playerId);
    return getUiRefForPlayerIndex(page, playerIndex);
}

async function getPlayerIdForIndex(page: Page, playerIndex: number): Promise<string> {
    const playerId = await page.evaluate((targetPlayerIndex) => {
        return (window as any).debug?.game?.state?.players?.[targetPlayerIndex]?.id ?? null;
    }, playerIndex);
    if (typeof playerId !== 'string' || playerId.length === 0) {
        throw new Error(`Could not resolve player id for index ${playerIndex}`);
    }
    return playerId;
}

async function clickMappedSkillZonePrompt(page: Page, revealedIndex: number): Promise<boolean> {
    const pendingPrompt = await page.evaluate((targetRevealedIndex) => {
        const pending = (window as any).debug?.game?.state?.pendingEffect;
        if (!pending) return null;
        const options = Array.isArray(pending.actionValue?.options) ? pending.actionValue.options : [];
        const option = options[targetRevealedIndex];
        return {
            actionType: pending.actionType ?? null,
            sourcePlayerId: pending.sourcePlayerId ?? null,
            skillZoneIndex: typeof option?.skillZoneIndex === 'number' ? option.skillZoneIndex : null,
        };
    }, revealedIndex);

    if (!pendingPrompt?.actionType || !SKILL_ZONE_PROMPT_ACTION_TYPES.has(pendingPrompt.actionType)) {
        return false;
    }
    if (typeof pendingPrompt.sourcePlayerId !== 'string' || typeof pendingPrompt.skillZoneIndex !== 'number') {
        return false;
    }

    const uiRef = await getUiRefForPlayerId(page, pendingPrompt.sourcePlayerId);
    const skillCard = page.locator(`.skill-card-item[data-player="${uiRef}"][data-index="${pendingPrompt.skillZoneIndex}"]`).first();
    if (!(await skillCard.count())) return false;
    await skillCard.click({ timeout: 5000 });
    return true;
}

async function applyRecordedPreState(page: Page, preState: unknown) {
    await page.evaluate((inputState) => {
        const dbg = (window as any).debug;
        if (!dbg?.game) throw new Error('debug game not available');
        dbg.game.state = JSON.parse(JSON.stringify(inputState));
        dbg.renderCallback();
    }, preState);
}

function shouldApplyRecordedPreState(step: RecordedScenarioStep, previousStep: RecordedScenarioStep | null): boolean {
    const preState = step.preState as any;
    if (!preState || typeof preState !== 'object') return false;
    if (preState.interactionMode !== 'NORMAL') return false;
    if (preState.pendingEffect) return false;
    if (Array.isArray(preState.effectQueue) && preState.effectQueue.length > 0) return false;
    if (Array.isArray(preState.deferredEffectQueue) && preState.deferredEffectQueue.length > 0) return false;
    if (!previousStep?.postState) return true;
    return firstDiff(
        summarizeComparableState(previousStep.postState),
        summarizeComparableState(preState),
    ) !== null;
}

async function clickTrashTarget(page: Page, uiRef: 'current' | 'opponent', trashIndex: number) {
    const modalTarget = page.locator(`.selection-modal-overlay .trash-card-item[data-index="${trashIndex}"]`).first();
    if (await modalTarget.count()) {
        await modalTarget.click({ timeout: 5000 });
        return;
    }

    await page.locator(`.${uiRef} .trash-zone`).hover({ timeout: 5000 });
    await page.locator(`.trash-hover-overlay.active .trash-hover-card[data-index="${trashIndex}"]`).click({ timeout: 5000 });
}

async function clickDamageTarget(page: Page, uiRef: 'current' | 'opponent', damageIndex: number) {
    const inlineTarget = page.locator(`.${uiRef} .damage-zone .damage-card-item[data-index="${damageIndex}"]`).first();
    if (await inlineTarget.count()) {
        await page.evaluate(({ currentUiRef, currentDamageIndex }) => {
            const target = document.querySelector(`.${currentUiRef} .damage-zone .damage-card-item[data-index="${currentDamageIndex}"]`) as HTMLElement | null;
            if (!target) {
                throw new Error(`damage target not found: ${currentUiRef}:${currentDamageIndex}`);
            }
            target.click();
        }, { currentUiRef: uiRef, currentDamageIndex: damageIndex });
        return;
    }

    await page.locator(`.${uiRef} .damage-zone`).hover({ timeout: 5000 });
    await page.locator(`.trash-hover-overlay.active .trash-hover-card[data-index="${damageIndex}"]`).click({ timeout: 5000 });
}

async function clickConfirmTargets(page: Page) {
    const modalConfirm = page.locator('.selection-modal-overlay #confirm-targets-modal-btn').first();
    if (await modalConfirm.count()) {
        await modalConfirm.click({ timeout: 5000 });
        return;
    }

    await page.locator('#confirm-targets-btn').click({ timeout: 5000 });
}

async function maybeConfirmTargetsAfterSelection(page: Page, expectedInteractionMode: string | null | undefined) {
    if (expectedInteractionMode !== 'NORMAL') return;

    const currentInteractionMode = await page.evaluate(() => (window as any).debug?.game?.state?.interactionMode ?? null);
    if (currentInteractionMode !== 'SELECT_TARGET') return;

    const modalConfirm = page.locator('.selection-modal-overlay #confirm-targets-modal-btn').first();
    if (await modalConfirm.isVisible().catch(() => false)) {
        await modalConfirm.click({ timeout: 5000 });
        return;
    }

    const inlineConfirm = page.locator('#confirm-targets-btn').first();
    if (await inlineConfirm.isVisible().catch(() => false)) {
        await inlineConfirm.click({ timeout: 5000 });
    }
}

async function maybeFinalizeSelectionDirectly(page: Page, expectedInteractionMode: string | null | undefined) {
    if (expectedInteractionMode !== 'NORMAL') return;
    const currentInteractionMode = await page.evaluate(() => (window as any).debug?.game?.state?.interactionMode ?? null);
    if (currentInteractionMode !== 'SELECT_TARGET') return;
    await replayActionDirectly(page, { type: 'CONFIRM_TARGETS' });
}

async function replayActionDirectly(page: Page, action: unknown) {
    await page.evaluate((engineAction) => {
        const dbg = (window as any).debug;
        const actorPlayerId =
            (engineAction as any)?.actorPlayerId
            ?? dbg.game.state.interactionOwnerPlayerId
            ?? dbg.game.currentPlayer?.id
            ?? null;
        const resolvedAction =
            engineAction && typeof engineAction === 'object'
                ? { ...(engineAction as Record<string, unknown>), actorPlayerId }
                : engineAction;
        dbg.game.step(resolvedAction);
        dbg.renderCallback();
    }, action);
}

async function collapseSelectionModalIfOpen(page: Page) {
    const toggleButton = page.locator('#selection-modal-toggle-btn').first();
    if (!await toggleButton.count()) {
        return;
    }

    const overlay = page.locator('.selection-modal-overlay').first();
    if (!await overlay.count()) {
        return;
    }

    await toggleButton.click({ timeout: 5000 });
    await overlay.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
}

async function resolveBlockViaEngine(
    page: Page,
    defenderPlayerIndex: number,
    shouldBlock: boolean,
    blockerZoneIndex?: number,
) {
    await page.evaluate(({ currentDefenderPlayerIndex, currentShouldBlock, currentBlockerZoneIndex }) => {
        const dbg = (window as any).debug;
        const actorPlayerId = dbg.game.state.players[currentDefenderPlayerIndex]?.id;
        if (!actorPlayerId) {
            throw new Error(`defender player not found: ${currentDefenderPlayerIndex}`);
        }
        dbg.game.step({
            type: 'RESOLVE_BLOCK',
            actorPlayerId,
            shouldBlock: currentShouldBlock,
            ...(typeof currentBlockerZoneIndex === 'number' ? { blockerZoneIndex: currentBlockerZoneIndex } : {}),
        });
        dbg.renderCallback();
    }, {
        currentDefenderPlayerIndex: defenderPlayerIndex,
        currentShouldBlock: shouldBlock,
        currentBlockerZoneIndex: blockerZoneIndex,
    });
}

async function replayStep(page: Page, step: RecordedScenarioStep, previousStep: RecordedScenarioStep | null) {
    if (step.kind === 'check_awakening' && previousStep?.kind === 'next_phase') {
        return;
    }

    if (shouldApplyRecordedPreState(step, previousStep)) {
        await applyRecordedPreState(page, step.preState);
    }

    if (step.kind === 'play_unit') {
        await page.dragAndDrop(
            `.hand-zone .card-in-hand[data-index="${step.handIndex}"]`,
            `.current .unit-zone[data-index="${step.zoneIndex}"]`,
        );
        return;
    }
    if (step.kind === 'play_skill') {
        await page.dragAndDrop(
            `.hand-zone .card-in-hand[data-index="${step.handIndex}"]`,
            '.current .drop-zone-skill',
        );
        return;
    }
    if (step.kind === 'play_item') {
        await page.dragAndDrop(
            `.hand-zone .card-in-hand[data-index="${step.handIndex}"]`,
            `.current .unit-zone[data-index="${step.zoneIndex}"]`,
        );
        return;
    }
    if (step.kind === 'attack') {
        const attackerPlayerIndex = getTurnPlayerIndexFromStep(step) ?? 0;
        const uiRef = await getUiRefForPlayerIndex(page, attackerPlayerIndex);
        const attackButton = page.locator(`.unit-zone[data-player="${uiRef}"][data-index="${step.attackerZoneIndex}"] .attack-btn`).first();
        if (await attackButton.count()) {
            await attackButton.click({ timeout: 5000 });
            return;
        }
        await page.evaluate((attackerZoneIndex) => {
            const dbg = (window as any).debug;
            dbg.game.attack(attackerZoneIndex);
            dbg.renderCallback();
        }, step.attackerZoneIndex);
        return;
    }
    if (step.kind === 'activate_effect') {
        if (step.sourceType === 'LEADER') {
            await page.locator(`.current .leader-active-btn[data-effect-index="${step.effectIndex}"]`).click({ timeout: 5000 });
            return;
        }
        if (step.sourceType === 'ITEM') {
            await page.locator(
                `.current .mini-item-card[data-zone-index="${step.zoneIndex}"][data-item-index="${step.itemIndex}"] .item-active-btn[data-effect-index="${step.effectIndex}"]`,
            ).click({ timeout: 5000 });
            return;
        }
        await page.locator(
            `.current .unit-zone[data-index="${step.zoneIndex}"] .active-btn[data-effect-index="${step.effectIndex}"]`,
        ).click({ timeout: 5000 });
        return;
    }
    if (step.kind === 'check_awakening') {
        await page.evaluate((playerIndex) => {
            const dbg = (window as any).debug;
            dbg.game.checkAwakening(playerIndex);
            dbg.renderCallback();
        }, step.playerIndex);
        return;
    }
    if (step.kind === 'next_phase') {
        const previousPhase = await page.evaluate(() => (window as any).debug?.game?.state?.phase ?? null);
        const expectedPhase = (step.postState as any)?.phase ?? null;
        const expectedInteractionMode = (step.postState as any)?.interactionMode ?? null;
        await page.getByRole('button', { name: 'Next Phase' }).click({ timeout: 5000 });
        if (previousPhase !== null) {
            await page.waitForFunction(
                (expectedPreviousPhase) => (window as any).debug?.game?.state?.phase !== expectedPreviousPhase,
                previousPhase,
                { timeout: 3000 },
            ).catch(() => {});
        }
        if (expectedPhase !== null || expectedInteractionMode !== null) {
            const currentState = await page.evaluate(() => ({
                phase: (window as any).debug?.game?.state?.phase ?? null,
                interactionMode: (window as any).debug?.game?.state?.interactionMode ?? null,
            }));
            const phaseMatches = expectedPhase === null || currentState.phase === expectedPhase;
            const interactionMatches = expectedInteractionMode === null || currentState.interactionMode === expectedInteractionMode;
            if (!phaseMatches || !interactionMatches) {
                await page.evaluate(() => {
                    const dbg = (window as any).debug;
                    dbg.game.nextPhase();
                    dbg.renderCallback();
                });
                await page.waitForFunction(
                    (targets) => {
                        const state = (window as any).debug?.game?.state;
                        if (!state) return false;
                        const phaseMatches = targets.phase === null || state.phase === targets.phase;
                        const interactionMatches = targets.interactionMode === null || state.interactionMode === targets.interactionMode;
                        return phaseMatches && interactionMatches;
                    },
                    { phase: expectedPhase, interactionMode: expectedInteractionMode },
                    { timeout: 3000 },
                ).catch(() => {});
            }
        }
        return;
    }
    if (step.kind === 'deal_damage') {
        await page.evaluate((inputStep) => {
            const dbg = (window as any).debug;
            dbg.game.dealDamage(dbg.game.state.players[inputStep.playerIndex], inputStep.amount);
            dbg.renderCallback();
        }, step);
        return;
    }
    if (step.kind === 'destroy_unit') {
        await page.evaluate((inputStep) => {
            const dbg = (window as any).debug;
            const player = dbg.game.state.players[inputStep.playerIndex];
            dbg.game.destroyUnit(player, player.unitZones[inputStep.zoneIndex], undefined, inputStep.reason);
            dbg.renderCallback();
        }, step);
        return;
    }
    if (step.kind === 'sync_state') {
        await applyRecordedPreState(page, step.postState);
        return;
    }
    if (step.kind === 'select_cost_direct') {
        const uiRef = await getUiRefForPlayerIndex(page, step.playerIndex);
        const selector = uiRef === 'current'
            ? `.hand-zone .card-in-hand[data-index="${step.handIndex}"]`
            : `.opponent-hand-zone .card-in-hand[data-index="${step.handIndex}"]`;
        await page.locator(selector).click({ timeout: 5000 });
        return;
    }
    if (step.kind === 'resolve_block_direct') {
        const defenderPlayerIndex = getDefenderPlayerIndexFromStep(step) ?? 1;
        if (step.shouldBlock) {
            const blockerIndex = step.blockerZoneIndex ?? 0;
            const uiRef = await getUiRefForPlayerIndex(page, defenderPlayerIndex);
            const blockButton = page.locator(`.unit-zone[data-player="${uiRef}"][data-index="${blockerIndex}"] .block-btn`).first();
            if (await blockButton.count()) {
                await blockButton.click({ timeout: 5000 });
            } else {
                await resolveBlockViaEngine(page, defenderPlayerIndex, true, blockerIndex);
            }
        } else {
            const passButton = page.locator('.pass-btn').first();
            if (await passButton.count()) {
                await passButton.click({ timeout: 5000 });
            } else {
                await resolveBlockViaEngine(page, defenderPlayerIndex, false);
            }
        }
        return;
    }
    if (step.kind === 'ui_action') {
        const action = step.action;
        const expectedInteractionMode = (step.postState as any)?.interactionMode ?? null;
        if (action.type === 'RESOLVE_OPTIONAL') {
            await page.locator(action.confirm ? '#opt-confirm' : '#opt-skip').click({ timeout: 5000 });
            return;
        }
        if (action.type === 'SELECT_ZONE_TARGET') {
            const uiRef = await getUiRefForPlayerIndex(page, action.targetPlayerIndex);
            await collapseSelectionModalIfOpen(page);
            await page.locator(`.unit-zone[data-player="${uiRef}"][data-index="${action.zoneIndex}"]`).click({ timeout: 5000 });
            await maybeConfirmTargetsAfterSelection(page, expectedInteractionMode);
            return;
        }
        if (action.type === 'SELECT_HAND_TARGET') {
            const targetPlayerId = await getPlayerIdForIndex(page, action.targetPlayerIndex);
            await replayActionDirectly(page, {
                type: 'SELECT_HAND_TARGET',
                targetPlayerId,
                handIndex: action.handIndex,
            });
            await maybeFinalizeSelectionDirectly(page, expectedInteractionMode);
            return;
        }
        if (action.type === 'SELECT_TRASH_TARGET') {
            const uiRef = await getUiRefForPlayerIndex(page, action.targetPlayerIndex);
            await clickTrashTarget(page, uiRef, action.trashIndex);
            await maybeConfirmTargetsAfterSelection(page, expectedInteractionMode);
            return;
        }
        if (action.type === 'SELECT_DAMAGE_TARGET') {
            const uiRef = await getUiRefForPlayerIndex(page, action.targetPlayerIndex);
            await clickDamageTarget(page, uiRef, action.damageIndex);
            await maybeConfirmTargetsAfterSelection(page, expectedInteractionMode);
            return;
        }
        if (action.type === 'SELECT_REVEALED_TARGET') {
            if (await clickMappedSkillZonePrompt(page, action.revealedIndex)) {
                await maybeConfirmTargetsAfterSelection(page, expectedInteractionMode);
                return;
            }
            await page.locator(`.revealed-card-item[data-index="${action.revealedIndex}"]`).click({ timeout: 5000 });
            await maybeConfirmTargetsAfterSelection(page, expectedInteractionMode);
            return;
        }
        if (action.type === 'SELECT_ITEM_TARGET') {
            const uiRef = await getUiRefForPlayerIndex(page, action.targetPlayerIndex);
            await page.locator(
                `.mini-item-card[data-player="${uiRef}"][data-zone-index="${action.zoneIndex}"][data-item-index="${action.itemIndex}"]`,
            ).click({ timeout: 5000 });
            await maybeConfirmTargetsAfterSelection(page, expectedInteractionMode);
            return;
        }
        if (action.type === 'SELECT_COST_HAND') {
            const uiRef = await getUiRefForPlayerIndex(page, action.actorPlayerIndex);
            const selector = uiRef === 'current'
                ? `.hand-zone .card-in-hand[data-index="${action.handIndex}"]`
                : `.opponent-hand-zone .card-in-hand[data-index="${action.handIndex}"]`;
            await page.locator(selector).click({ timeout: 5000 });
            return;
        }
        if (action.type === 'CONFIRM_TARGETS') {
            await clickConfirmTargets(page);
            return;
        }
        if (action.type === 'RESOLVE_BLOCK') {
            const defenderPlayerIndex = getDefenderPlayerIndexFromStep(step) ?? 1;
            if (action.shouldBlock) {
                const blockerIndex = action.blockerZoneIndex ?? 0;
                const uiRef = await getUiRefForPlayerIndex(page, defenderPlayerIndex);
                const blockButton = page.locator(`.unit-zone[data-player="${uiRef}"][data-index="${blockerIndex}"] .block-btn`).first();
                if (await blockButton.count()) {
                    await blockButton.click({ timeout: 5000 });
                } else {
                    await resolveBlockViaEngine(page, defenderPlayerIndex, true, blockerIndex);
                }
            } else {
                const passButton = page.locator('.pass-btn').first();
                if (await passButton.count()) {
                    await passButton.click({ timeout: 5000 });
                } else {
                    await resolveBlockViaEngine(page, defenderPlayerIndex, false);
                }
            }
            return;
        }
    }
    throw new Error(`Unsupported step: ${JSON.stringify(step)}`);
}

export async function verifyPackPlayRows({ packId, module, screenshotDir }: VerifyPackPlayRowsOptions) {
    const scenarios = buildRecordedScenarios(module);
    const packIdLower = packId.toLowerCase();
    await mkdir(screenshotDir, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await context.newPage();

    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Card Logic Verification' }).click();
    const packCheckbox = page.locator(`input.pack-filter-checkbox[value="${packId}"]`);
    if (!(await packCheckbox.isChecked())) {
        await packCheckbox.check();
    }
    await page.getByRole('button', { name: 'Run Selected Tests' }).click();
    await page.getByRole('button', { name: 'Run Selected Tests' }).waitFor({ state: 'visible', timeout: 45000 });

    const rowCount = await page.locator('.test-result').count();
    if (rowCount !== scenarios.length) {
        throw new Error(`Expected ${scenarios.length} ${packId} rows, found ${rowCount}`);
    }

    const failures: Array<{ displayName: string; diff: string; screenshotPath: string }> = [];

    for (let index = Math.max(0, START_INDEX - 1); index < scenarios.length; index += 1) {
        const recorded = scenarios[index];
        console.log(`[${index + 1}/${scenarios.length}] ${recorded.displayName}`);
        const row = page.locator('.test-result').filter({ hasText: recorded.displayName }).first();
        await row.getByRole('button', { name: 'Play' }).click({ timeout: 5000 });
        await page.locator('.verification-session-panel').waitFor({ state: 'visible', timeout: 10000 });
        await page.waitForTimeout(STEP_DELAY_MS);

        for (let stepIndex = 0; stepIndex < recorded.steps.length; stepIndex += 1) {
            const step = recorded.steps[stepIndex];
            const previousStep = stepIndex > 0 ? recorded.steps[stepIndex - 1] : null;
            await replayStep(page, step, previousStep);
            await page.waitForTimeout(STEP_DELAY_MS);
            if (VERBOSE_VERIFY) {
                const debugState = await page.evaluate(() => ({
                    phase: (window as any).debug.game.state.phase,
                    interactionMode: (window as any).debug.game.state.interactionMode,
                    pendingEffect: (window as any).debug.game.state.pendingEffect?.actionType ?? null,
                }));
                console.log(`  step ${stepIndex + 1}/${recorded.steps.length}: ${step.kind} -> ${JSON.stringify(debugState)}`);
            }
        }

        const actualSummary = summarizeState(
            normalizeState(
                await page.evaluate(() => (window as any).debug.game.getSerializableState()),
            ),
        );
        const expectedSummary = summarizeState(recorded.normalizedFinalState);
        const diff = firstDiff(actualSummary, expectedSummary);
        if (diff) {
            const screenshotPath = `${screenshotDir}/failure-${String(index + 1).padStart(2, '0')}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
            failures.push({ displayName: recorded.displayName, diff, screenshotPath });
            break;
        }

        await page.locator('#verification-back-btn').click({ timeout: 5000 });
        await page.locator('#test-results').waitFor({ state: 'visible', timeout: 10000 });
    }

    const listScreenshotPath = `${screenshotDir}/${packIdLower}-play-verify-list.png`;
    await page.screenshot({ path: listScreenshotPath, fullPage: false }).catch(() => {});
    if (failures.length === 0) {
        console.log(`${packId} Playwright scenario replay verification passed: ${scenarios.length}/${scenarios.length}`);
        console.log(`Screenshot: ${listScreenshotPath}`);
    } else {
        console.error(`${packId} Playwright scenario replay verification failed: ${failures[0].displayName} -> ${failures[0].diff}`);
        console.error(`Screenshot: ${failures[0].screenshotPath}`);
        process.exitCode = 1;
    }

    await browser.close();
}
