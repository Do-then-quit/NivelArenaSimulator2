import { createDeck, DUMMY_CARDS } from '../CardDatabase';
import { GameEngine } from '../GameEngine';
import { Card, PlayerState, UnitZoneState } from '../types';
import { UnifiedTestCase } from './shared/types';

export type RecordedUiAction =
    | { type: 'RESOLVE_OPTIONAL'; confirm: boolean }
    | { type: 'SELECT_ZONE_TARGET'; targetPlayerIndex: number; zoneIndex: number }
    | { type: 'SELECT_HAND_TARGET'; targetPlayerIndex: number; handIndex: number }
    | { type: 'SELECT_TRASH_TARGET'; targetPlayerIndex: number; trashIndex: number }
    | { type: 'SELECT_DAMAGE_TARGET'; targetPlayerIndex: number; damageIndex: number }
    | { type: 'SELECT_REVEALED_TARGET'; revealedIndex: number }
    | { type: 'SELECT_ITEM_TARGET'; targetPlayerIndex: number; zoneIndex: number; itemIndex: number }
    | { type: 'SELECT_COST_HAND'; actorPlayerIndex: number; handIndex: number }
    | { type: 'CONFIRM_TARGETS' }
    | { type: 'RESOLVE_BLOCK'; shouldBlock: boolean; blockerZoneIndex?: number };

export type RecordedScenarioStep = (
    | { kind: 'play_unit'; handIndex: number; zoneIndex: number }
    | { kind: 'play_skill'; handIndex: number }
    | { kind: 'play_item'; handIndex: number; zoneIndex: number }
    | { kind: 'attack'; attackerZoneIndex: number }
    | { kind: 'activate_effect'; zoneIndex: number; effectIndex: number; sourceType: 'UNIT' | 'ITEM' | 'LEADER'; itemIndex?: number }
    | { kind: 'next_phase' }
    | { kind: 'deal_damage'; playerIndex: number; amount: number }
    | { kind: 'destroy_unit'; playerIndex: number; zoneIndex: number; reason: 'BATTLE' | 'EFFECT' | 'RULE' }
    | { kind: 'select_cost_direct'; playerIndex: number; handIndex: number }
    | { kind: 'resolve_block_direct'; shouldBlock: boolean; blockerZoneIndex?: number }
    | { kind: 'ui_action'; action: RecordedUiAction }
) & {
    preState?: unknown;
    postState?: unknown;
};

export interface RecordedUnifiedScenario {
    testId: string;
    name: string;
    description: string;
    steps: RecordedScenarioStep[];
    results: Array<{ pass: boolean; message: string }>;
    normalizedFinalState: unknown;
}

function dedupeRecordedSteps(steps: RecordedScenarioStep[]): RecordedScenarioStep[] {
    const deduped: RecordedScenarioStep[] = [];

    steps.forEach((step) => {
        const previous = deduped[deduped.length - 1];

        if (
            step.kind === 'select_cost_direct' &&
            previous?.kind === 'ui_action' &&
            previous.action.type === 'SELECT_COST_HAND' &&
            previous.action.actorPlayerIndex === step.playerIndex &&
            previous.action.handIndex === step.handIndex
        ) {
            return;
        }

        if (
            step.kind === 'resolve_block_direct' &&
            previous?.kind === 'ui_action' &&
            previous.action.type === 'RESOLVE_BLOCK' &&
            previous.action.shouldBlock === step.shouldBlock &&
            previous.action.blockerZoneIndex === step.blockerZoneIndex
        ) {
            return;
        }

        deduped.push(step);
    });

    return deduped;
}

function cloneCardFromDatabase(id: string): Card {
    const card = DUMMY_CARDS.find((entry) => entry.id === id);
    if (!card) {
        throw new Error(`Card ${id} not found`);
    }
    return JSON.parse(JSON.stringify(card));
}

export function createUnifiedScenarioTestEngine(leaderId: string = 'ST01-001'): GameEngine {
    const leader = cloneCardFromDatabase(leaderId);
    const deck1 = createDeck();
    const deck2 = createDeck();
    return new GameEngine('P1', 'P2', deck1, deck2, leader, leader, {
        seed: 20260307,
    });
}

function isScenarioOriginCall(): boolean {
    const stack = new Error().stack || '';
    return stack.includes('/src/logic/cardTests/shared/') || stack.includes('\\src\\logic\\cardTests\\shared\\');
}

function playerIndexOf(engine: GameEngine, player: PlayerState | string | null | undefined): number {
    if (!player) return -1;
    const id = typeof player === 'string' ? player : player.id;
    return engine.state.players.findIndex((entry) => entry.id === id);
}

function zoneIndexOf(player: PlayerState | null | undefined, zone: UnitZoneState | null | undefined): number {
    if (!player || !zone) return -1;
    return player.unitZones.indexOf(zone);
}

function sanitizeSteppedAction(engine: GameEngine, action: any): RecordedUiAction | null {
    if (!action || typeof action.type !== 'string') return null;

    switch (action.type) {
        case 'RESOLVE_OPTIONAL':
            return { type: 'RESOLVE_OPTIONAL', confirm: action.confirm === true };
        case 'SELECT_ZONE_TARGET':
            return {
                type: 'SELECT_ZONE_TARGET',
                targetPlayerIndex: playerIndexOf(engine, action.targetPlayerId),
                zoneIndex: Number(action.zoneIndex),
            };
        case 'SELECT_HAND_TARGET':
            return {
                type: 'SELECT_HAND_TARGET',
                targetPlayerIndex: playerIndexOf(engine, action.targetPlayerId),
                handIndex: Number(action.handIndex),
            };
        case 'SELECT_TRASH_TARGET':
            return {
                type: 'SELECT_TRASH_TARGET',
                targetPlayerIndex: playerIndexOf(engine, action.targetPlayerId),
                trashIndex: Number(action.trashIndex),
            };
        case 'SELECT_DAMAGE_TARGET':
            return {
                type: 'SELECT_DAMAGE_TARGET',
                targetPlayerIndex: playerIndexOf(engine, action.targetPlayerId),
                damageIndex: Number(action.damageIndex),
            };
        case 'SELECT_REVEALED_TARGET':
            return {
                type: 'SELECT_REVEALED_TARGET',
                revealedIndex: Number(action.revealedIndex),
            };
        case 'SELECT_ITEM_TARGET':
            return {
                type: 'SELECT_ITEM_TARGET',
                targetPlayerIndex: playerIndexOf(engine, action.targetPlayerId),
                zoneIndex: Number(action.zoneIndex),
                itemIndex: Number(action.itemIndex),
            };
        case 'SELECT_COST_HAND':
            return {
                type: 'SELECT_COST_HAND',
                actorPlayerIndex: playerIndexOf(engine, action.actorPlayerId),
                handIndex: Number(action.handIndex),
            };
        case 'CONFIRM_TARGETS':
            return { type: 'CONFIRM_TARGETS' };
        case 'RESOLVE_BLOCK':
            return {
                type: 'RESOLVE_BLOCK',
                shouldBlock: action.shouldBlock === true,
                ...(typeof action.blockerZoneIndex === 'number' ? { blockerZoneIndex: action.blockerZoneIndex } : {}),
            };
        default:
            return null;
    }
}

function replacePlayerIdsDeep(value: unknown, idMap: Record<string, string>): unknown {
    if (Array.isArray(value)) {
        return value.map((entry) => replacePlayerIdsDeep(entry, idMap));
    }
    if (value && typeof value === 'object') {
        const output: Record<string, unknown> = {};
        Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
            output[key] = replacePlayerIdsDeep(entry, idMap);
        });
        return output;
    }
    if (typeof value === 'string' && idMap[value]) {
        return idMap[value];
    }
    return value;
}

export function normalizeSerializableState(state: unknown): unknown {
    const cloned = JSON.parse(JSON.stringify(state));
    const players = Array.isArray((cloned as any)?.players) ? (cloned as any).players : [];
    const idMap = players.reduce((map: Record<string, string>, player: any, index: number) => {
        if (player?.id) {
            map[player.id] = `P${index}`;
        }
        return map;
    }, {});
    return replacePlayerIdsDeep(cloned, idMap);
}

function patchMethod<TObj extends object, TKey extends keyof TObj>(
    target: TObj,
    key: TKey,
    wrapper: (original: any, args: any[]) => any,
) {
    const original = (target[key] as any).bind(target);
    (target as any)[key] = (...args: any[]) => wrapper(original, args);
}

export function recordUnifiedScenario(test: UnifiedTestCase): RecordedUnifiedScenario {
    const engine = createUnifiedScenarioTestEngine();
    test.setup(engine, cloneCardFromDatabase);

    const steps: RecordedScenarioStep[] = [];
    const pushStep = (step: Omit<RecordedScenarioStep, 'preState' | 'postState'>) => {
        const entry: RecordedScenarioStep = {
            ...step,
            preState: engine.getSerializableState(),
        } as RecordedScenarioStep;
        steps.push(entry);
        return entry;
    };

    patchMethod(engine as any, 'step', (original, args) => {
        if (isScenarioOriginCall()) {
            const recorded = sanitizeSteppedAction(engine, args[0]);
            if (recorded) {
                const entry = pushStep({ kind: 'ui_action', action: recorded });
                const result = original(...args);
                entry.postState = engine.getSerializableState();
                return result;
            }
        }
        return original(...args);
    });

    patchMethod(engine as any, 'playUnit', (original, args) => {
        if (isScenarioOriginCall()) {
            const entry = pushStep({ kind: 'play_unit', handIndex: Number(args[0]), zoneIndex: Number(args[1]) });
            const result = original(...args);
            entry.postState = engine.getSerializableState();
            return result;
        }
        return original(...args);
    });

    patchMethod(engine as any, 'playSkill', (original, args) => {
        if (isScenarioOriginCall()) {
            const entry = pushStep({ kind: 'play_skill', handIndex: Number(args[0]) });
            const result = original(...args);
            entry.postState = engine.getSerializableState();
            return result;
        }
        return original(...args);
    });

    patchMethod(engine as any, 'playItem', (original, args) => {
        if (isScenarioOriginCall()) {
            const entry = pushStep({ kind: 'play_item', handIndex: Number(args[0]), zoneIndex: Number(args[1]) });
            const result = original(...args);
            entry.postState = engine.getSerializableState();
            return result;
        }
        return original(...args);
    });

    patchMethod(engine as any, 'attack', (original, args) => {
        if (isScenarioOriginCall() && args[1]?.byCardEffect !== true) {
            const entry = pushStep({ kind: 'attack', attackerZoneIndex: Number(args[0]) });
            const result = original(...args);
            entry.postState = engine.getSerializableState();
            return result;
        }
        return original(...args);
    });

    patchMethod(engine as any, 'activateEffect', (original, args) => {
        if (isScenarioOriginCall()) {
            const entry = pushStep({
                kind: 'activate_effect',
                zoneIndex: Number(args[0]),
                effectIndex: Number(args[1]),
                sourceType: (args[2] || 'UNIT') as 'UNIT' | 'ITEM' | 'LEADER',
                ...(typeof args[3] === 'number' ? { itemIndex: Number(args[3]) } : {}),
            });
            const result = original(...args);
            entry.postState = engine.getSerializableState();
            return result;
        }
        return original(...args);
    });

    patchMethod(engine as any, 'nextPhase', (original, args) => {
        if (isScenarioOriginCall()) {
            const entry = pushStep({ kind: 'next_phase' });
            const result = original(...args);
            entry.postState = engine.getSerializableState();
            return result;
        }
        return original(...args);
    });

    patchMethod(engine as any, 'dealDamage', (original, args) => {
        if (isScenarioOriginCall()) {
            const entry = pushStep({
                kind: 'deal_damage',
                playerIndex: playerIndexOf(engine, args[0]),
                amount: Number(args[1]),
            });
            const result = original(...args);
            entry.postState = engine.getSerializableState();
            return result;
        }
        return original(...args);
    });

    patchMethod(engine as any, 'destroyUnit', (original, args) => {
        if (isScenarioOriginCall()) {
            const player = args[0] as PlayerState | undefined;
            const zone = args[1] as UnitZoneState | undefined;
            const reason = (args[3] || 'EFFECT') as 'BATTLE' | 'EFFECT' | 'RULE';
            const entry = pushStep({
                kind: 'destroy_unit',
                playerIndex: playerIndexOf(engine, player),
                zoneIndex: zoneIndexOf(player, zone),
                reason,
            });
            const result = original(...args);
            entry.postState = engine.getSerializableState();
            return result;
        }
        return original(...args);
    });

    patchMethod(engine as any, 'resolveBlock', (original, args) => {
        if (isScenarioOriginCall()) {
            const entry = pushStep({
                kind: 'resolve_block_direct',
                shouldBlock: args[0] === true,
                ...(typeof args[1] === 'number' ? { blockerZoneIndex: Number(args[1]) } : {}),
            });
            const result = original(...args);
            entry.postState = engine.getSerializableState();
            return result;
        }
        return original(...args);
    });

    patchMethod(engine as any, 'selectCostForPlayerId', (original, args) => {
        if (isScenarioOriginCall()) {
            const entry = pushStep({
                kind: 'select_cost_direct',
                playerIndex: playerIndexOf(engine, args[1]),
                handIndex: Number(args[0]),
            });
            const result = original(...args);
            entry.postState = engine.getSerializableState();
            return result;
        }
        return original(...args);
    });

    const results = test.verify(engine, cloneCardFromDatabase);
    return {
        testId: test.testId,
        name: test.name,
        description: test.description,
        steps: dedupeRecordedSteps(steps),
        results,
        normalizedFinalState: normalizeSerializableState(engine.getSerializableState()),
    };
}
