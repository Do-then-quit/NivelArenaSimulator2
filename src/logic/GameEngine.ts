import { GameState, PlayerState, Phase, Card, UnitZoneState, ActivationCondition, CardType, Attribute, GameContext, Effect, TargetSchema, PendingEffect, UiTraceEvent, UiTraceEventType } from './types';
import { EffectManager } from './effects';
import { RuleValidator } from './RuleValidator';
import { TargetSelector } from './TargetSelector';
import { createRandomProvider, RandomProvider } from './random';
import { buildLegalActions } from './engine/targeting/LegalActionBuilder';
import {
    confirmTargets as runConfirmTargets,
    handleEffectCompletion as runHandleEffectCompletion,
    selectDamageTargetByPlayerId as runSelectDamageTargetByPlayerId,
    selectHandTargetByPlayerId as runSelectHandTargetByPlayerId,
    selectItemTargetByPlayerId as runSelectItemTargetByPlayerId,
    selectRevealedTarget as runSelectRevealedTarget,
    selectTrashTarget as runSelectTrashTarget,
    selectZoneTargetByPlayerId as runSelectZoneTargetByPlayerId,
} from './engine/targeting/TargetSelectionFlow';
import {
    advanceCombatStep as runAdvanceCombatStep,
    clearBattleScopedEffects as runClearBattleScopedEffects,
    commitBlockDeclaration as runCommitBlockDeclaration,
    getAvailableBlockerZoneIndexes as runGetAvailableBlockerZoneIndexes,
    getGuardianBarrierCost as runGetGuardianBarrierCost,
    getPenetrationValue as runGetPenetrationValue,
    getPlunderValue as runGetPlunderValue,
    hasKeyword as runHasKeyword,
    hasKeywordInZone as runHasKeywordInZone,
    isBlockPreventedByBreakthrough as runIsBlockPreventedByBreakthrough,
    isEncounterBlockForced as runIsEncounterBlockForced,
    resolveBlock as runResolveBlock,
    stepBattleEnd as runStepBattleEnd,
    stepBattleResolution as runStepBattleResolution,
    stepDefenseDeclaration as runStepDefenseDeclaration,
} from './engine/combat/CombatFlow';
import {
    beginDestroyReplacementPrompt as runBeginDestroyReplacementPrompt,
    collectDestroyReplacements as runCollectDestroyReplacements,
    completeDestructionReplacementAfterHandCost as runCompleteDestructionReplacementAfterHandCost,
    executePendingDestroyPayload as runExecutePendingDestroyPayload,
    resolveDestructionReplacementChoice as runResolveDestructionReplacementChoice,
    tryInitiateDestroyReplacement as runTryInitiateDestroyReplacement,
} from './engine/destroy/DestroyReplacementFlow';
import {
    destroyUnit as runDestroyUnit,
    processPassiveGrantedExitEffects as runProcessPassiveGrantedExitEffects,
} from './engine/destroy/DestroyExecutor';

type EngineAction = import('./types').EngineAction;
type EngineObservation = import('./types').EngineObservation;

interface GameEngineOptions {
    seed?: number;
    randomProvider?: RandomProvider;
    enableMulligan?: boolean;
    enableUiTrace?: boolean;
}

interface PendingRuntimeState {
    context: GameContext;
    effect: Effect | null;
}

interface DrawCardMeta {
    reason?: 'RULE' | 'EFFECT';
    sourceActivation?: ActivationCondition | string;
    sourcePlayerId?: string;
    sourceCardId?: string;
}

type CardReferenceArea = 'LEVEL' | 'HAND' | 'DECK' | 'DAMAGE' | 'TRASH' | 'ZONE_UNIT' | 'ZONE_ITEM' | 'REVEALED';

interface CardReferenceLocator {
    playerIndex: number;
    area: CardReferenceArea;
    zoneIndex?: number;
    index?: number;
}

interface ZoneReferenceLocator {
    playerIndex: number;
    zoneIndex: number;
}

export class GameEngine {
    state: GameState;
    effectManager: EffectManager;
    private readonly random: RandomProvider;
    private readonly enableMulligan: boolean;
    private readonly enableUiTrace: boolean;
    private readonly endPhaseHandAdjustActionType = 'END_PHASE_HAND_LIMIT_DISCARD';
    private runtimeIdCounter = 0;
    private pendingRuntime: PendingRuntimeState | null = null;
    private awaitingEndPhaseHandAdjustment = false;
    private readonly destroyInProgressKeys = new Set<string>();
    private isRuleProcessing = false;
    private pendingRuleProcessing = false;
    private readonly uiTraceEvents: UiTraceEvent[] = [];

    constructor(
        player1Name: string,
        player2Name: string,
        deck1: Card[],
        deck2: Card[],
        leader1: Card,
        leader2: Card,
        options: GameEngineOptions = {}
    ) {
        this.random = createRandomProvider(options.seed, options.randomProvider);
        this.enableMulligan = options.enableMulligan ?? false;
        this.enableUiTrace = options.enableUiTrace ?? false;
        this.effectManager = new EffectManager(this);
        this.state = {
            players: [
                this.createPlayer(player1Name, deck1, leader1),
                this.createPlayer(player2Name, deck2, leader2),
            ],
            turnPlayerIndex: 0, // Randomize later
            phase: Phase.LEVEL_UP,
            turnCount: 1,
            winner: null,
            pendingAttackerIndex: null,
            pendingBlockerZoneIndex: null,
            interactionMode: 'NORMAL',
            interactionOwnerPlayerId: null,
            pendingEffect: null,
            mulliganState: null,
            mulliganResultByPlayerId: {},
            revealedCards: [],
            effectQueue: [],
            deferredEffectQueue: [],
            damageProcessingDepth: 0,
            globalStep: 0,
            combatStep: 'NONE',
            combatBlocked: false,
            turnStats: {
                effectTrashedFriendlyUnitCountByPlayerId: {},
                handTrashedByEffectCountByPlayerId: {},
                unitAttackCountByPlayerId: {},
            },
        };
        this.startGame();
        this.assignInteractionOwner(this.currentPlayer.id);
        this.keepDelegateMembersReferencedForTypeChecks();
    }

    private pushUiTraceEvent(type: UiTraceEventType, payload: Partial<UiTraceEvent> = {}) {
        if (!this.enableUiTrace) return;
        const event: UiTraceEvent = {
            id: this.createRuntimeId('UITRACE'),
            type,
            createdAtMs: Date.now(),
            turnCount: this.state.turnCount,
            phase: this.state.phase,
            ...payload,
        };
        this.uiTraceEvents.push(event);
        if (this.uiTraceEvents.length > 1024) {
            this.uiTraceEvents.splice(0, this.uiTraceEvents.length - 1024);
        }
    }

    public traceUiEvent(type: UiTraceEventType, payload: Partial<UiTraceEvent> = {}) {
        this.pushUiTraceEvent(type, payload);
    }

    public drainUiTraceEvents(): UiTraceEvent[] {
        if (!this.enableUiTrace || this.uiTraceEvents.length === 0) return [];
        const drained = [...this.uiTraceEvents];
        this.uiTraceEvents.length = 0;
        return drained;
    }

    // Delegate-heavy refactors keep some members invoked indirectly from extracted modules.
    // Touching them here avoids false positives from noUnusedLocals on private members.
    private keepDelegateMembersReferencedForTypeChecks() {
        void this.destroyInProgressKeys;
        void this.incrementEffectTrashedFriendlyUnitCount;
        void this.stepDefenseDeclaration;
        void this.stepBattleResolution;
        void this.stepBattleEnd;
        void this.clearBattleScopedEffects;
        void this.hasKeyword;
        void this.isEncounterBlockForced;
        void this.getAvailableBlockerZoneIndexes;
        void this.getGuardianBarrierCost;
        void this.isBlockPreventedByBreakthrough;
        void this.getPenetrationValue;
        void this.getPlunderValue;
        void this.hasKeywordInZone;
        void this.processPassiveGrantedExitEffects;
        void this.isReplacementDestroyReason;
        void this.collectDestroyReplacements;
        void this.beginDestroyReplacementPrompt;
        void this.tryInitiateDestroyReplacement;
        void this.executePendingDestroyPayload;
        void this.getDestroyGuardKey;
    }

    public incrementGlobalStep() {
        this.state.globalStep++;
        // console.log(`[GlobalStep] Incremented to ${this.state.globalStep}`);
    }

    public incrementAndGetGlobalStep(): number {
        this.incrementGlobalStep();
        return this.state.globalStep;
    }

    public sortEffectQueue() {
        this.state.effectQueue.sort((a, b) => {
            // 1. Creation Time (Ascending) - Oldest First
            if (a.creationTime !== b.creationTime) {
                return a.creationTime - b.creationTime;
            }

            // 2. Turn Player Priority (Same Timestamp)
            const turnPlayerId = this.state.players[this.state.turnPlayerIndex].id;
            const aIsTurnPlayer = a.sourcePlayerId === turnPlayerId;
            const bIsTurnPlayer = b.sourcePlayerId === turnPlayerId;

            if (aIsTurnPlayer && !bIsTurnPlayer) return -1; // a comes first
            if (!aIsTurnPlayer && bIsTurnPlayer) return 1;  // b comes first

            // 3. (Optional) Order preserved for same player (stable sort mostly)
            return 0;
        });
        // console.log(`[Queue] Sorted. Head: ${this.state.effectQueue[0]?.effect.description}`);
    }

    private nextRandom(): number {
        return this.random.next();
    }

    public advanceRandomState(steps: number): void {
        const count = Math.max(0, Math.trunc(steps));
        for (let i = 0; i < count; i++) {
            this.nextRandom();
        }
    }

    public randomInt(maxExclusive: number): number {
        if (maxExclusive <= 0) return 0;
        return Math.floor(this.nextRandom() * maxExclusive);
    }

    public createRuntimeId(prefix: string): string {
        this.runtimeIdCounter += 1;
        return `${prefix}_${this.runtimeIdCounter.toString(36)}_${this.randomInt(0x7fffffff).toString(36)}`;
    }

    public shuffleInPlace<T>(items: T[]): T[] {
        for (let i = items.length - 1; i > 0; i--) {
            const j = this.randomInt(i + 1);
            [items[i], items[j]] = [items[j], items[i]];
        }
        return items;
    }

    public shuffledCopy<T>(items: T[]): T[] {
        return this.shuffleInPlace([...items]);
    }

    private createPlayer(name: string, deck: Card[], leader: Card): PlayerState {
        // Strict Rule: Decks cannot contain Leaders.
        const validDeck = deck.filter(c => c.type !== CardType.LEADER);

        // Deep copy leader to ensure independence
        const leaderCopy = JSON.parse(JSON.stringify(leader));

        return {
            id: this.createRuntimeId('PLAYER'),
            name,
            deck: this.shuffle([...validDeck]),
            hand: [],
            trash: [],
            damage: [],
            levelZone: leaderCopy,
            leaderLevel: 1,
            unitZones: [
                { unit: null, items: [], buffs: [], temporaryEffects: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false, hasActivatedEffectThisTurn: false, activatedEffectKeys: {}, attackCountThisTurn: 0, extraAttackAllowance: 0 },
                { unit: null, items: [], buffs: [], temporaryEffects: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false, hasActivatedEffectThisTurn: false, activatedEffectKeys: {}, attackCountThisTurn: 0, extraAttackAllowance: 0 },
                { unit: null, items: [], buffs: [], temporaryEffects: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false, hasActivatedEffectThisTurn: false, activatedEffectKeys: {}, attackCountThisTurn: 0, extraAttackAllowance: 0 },
            ],
            skillZone: [],
            lockedActivationsUntilTurnEnd: {},
            lockedActivationsUntilTurnCount: {},
        };
    }

    private shuffle(deck: Card[]): Card[] {
        return this.shuffleInPlace(deck);
    }

    private startGame() {
        // Draw 5 cards for each player
        this.drawCard(0, 5);
        this.drawCard(1, 5);

        if (this.enableMulligan && !this.state.winner) {
            this.startMulliganWindow();
        }
    }

    private startMulliganWindow() {
        const pendingPlayerIds = this.state.players.map(player => player.id);
        this.state.interactionMode = 'SELECT_MULLIGAN';
        this.state.pendingEffect = null;
        this.clearPendingRuntime();
        this.state.mulliganState = {
            pendingPlayerIds: [...pendingPlayerIds],
            completedPlayerIds: [],
        };
        this.state.mulliganResultByPlayerId = pendingPlayerIds.reduce<Record<string, boolean>>((acc, playerId) => {
            acc[playerId] = false;
            return acc;
        }, {});

        this.assignInteractionOwner(pendingPlayerIds[0] ?? null);
    }

    private resolveMulliganForPlayer(actorPlayerId: string, shouldMulligan: boolean): boolean {
        if (this.state.interactionMode !== 'SELECT_MULLIGAN') return false;
        const mulliganState = this.state.mulliganState;
        if (!mulliganState) return false;

        const currentActorId = mulliganState.pendingPlayerIds[0];
        if (!currentActorId || currentActorId !== actorPlayerId) return false;

        const playerIndex = this.state.players.findIndex(player => player.id === actorPlayerId);
        if (playerIndex < 0) return false;
        const player = this.state.players[playerIndex];

        if (shouldMulligan) {
            if (player.hand.length > 0) {
                player.deck.push(...player.hand);
                player.hand = [];
                this.shuffle(player.deck);
                this.drawCard(playerIndex, 5);
            }
            this.state.mulliganResultByPlayerId[actorPlayerId] = true;
        } else {
            this.state.mulliganResultByPlayerId[actorPlayerId] = false;
        }

        mulliganState.completedPlayerIds.push(actorPlayerId);
        mulliganState.pendingPlayerIds.shift();

        if (this.state.winner) {
            this.assignInteractionOwner(null);
            return true;
        }

        const nextPlayerId = mulliganState.pendingPlayerIds[0];
        if (nextPlayerId) {
            this.assignInteractionOwner(nextPlayerId);
            return true;
        }

        this.state.interactionMode = 'NORMAL';
        this.state.mulliganState = null;
        this.assignInteractionOwner(this.getDefaultInteractionOwnerId());
        return true;
    }

    get currentPlayer(): PlayerState {
        return this.state.players[this.state.turnPlayerIndex];
    }

    get opponentPlayer(): PlayerState {
        return this.state.players[this.state.turnPlayerIndex === 0 ? 1 : 0];
    }

    private getOpponentOf(player: PlayerState): PlayerState {
        return this.state.players.find(p => p.id !== player.id)!;
    }

    private getPlayersInTurnOrder(): [PlayerState, PlayerState] {
        const turnPlayer = this.state.players[this.state.turnPlayerIndex];
        const nonTurnPlayer = this.state.players[this.state.turnPlayerIndex === 0 ? 1 : 0];
        return [turnPlayer, nonTurnPlayer];
    }

    private getTurnStats() {
        if (!this.state.turnStats) {
            this.state.turnStats = {
                effectTrashedFriendlyUnitCountByPlayerId: {},
                handTrashedByEffectCountByPlayerId: {},
                unitAttackCountByPlayerId: {},
            };
        }
        return this.state.turnStats;
    }

    private incrementEffectTrashedFriendlyUnitCount(playerId: string) {
        const stats = this.getTurnStats();
        stats.effectTrashedFriendlyUnitCountByPlayerId[playerId] =
            (stats.effectTrashedFriendlyUnitCountByPlayerId[playerId] || 0) + 1;
    }

    private incrementHandTrashedByEffectCount(playerId: string, amount: number) {
        if (amount <= 0) return;
        const stats = this.getTurnStats();
        stats.handTrashedByEffectCountByPlayerId[playerId] =
            (stats.handTrashedByEffectCountByPlayerId[playerId] || 0) + amount;
    }

    public incrementTurnUnitAttackCount(playerId: string) {
        const stats = this.getTurnStats();
        stats.unitAttackCountByPlayerId[playerId] =
            (stats.unitAttackCountByPlayerId[playerId] || 0) + 1;
    }

    public getEffectTrashedFriendlyUnitCount(playerId: string): number {
        return this.getTurnStats().effectTrashedFriendlyUnitCountByPlayerId[playerId] || 0;
    }

    public getHandTrashedByEffectCount(playerId: string): number {
        return this.getTurnStats().handTrashedByEffectCountByPlayerId[playerId] || 0;
    }

    public getTurnUnitAttackCount(playerId: string): number {
        return this.getTurnStats().unitAttackCountByPlayerId[playerId] || 0;
    }

    private resetTurnStats() {
        this.state.turnStats = {
            effectTrashedFriendlyUnitCountByPlayerId: {},
            handTrashedByEffectCountByPlayerId: {},
            unitAttackCountByPlayerId: {},
        };
    }

    public notifyHandTrashed(player: PlayerState, cards: Card[], sourceContext?: Partial<GameContext>) {
        if (!cards.length) return;
        const handTrashByEffect = sourceContext?.flags?.handTrashByEffect !== false;
        if (!handTrashByEffect) return;

        this.incrementHandTrashedByEffectCount(player.id, cards.length);

        const batchStep = this.incrementAndGetGlobalStep();
        const [turnPlayer, nonTurnPlayer] = this.getPlayersInTurnOrder();
        [turnPlayer, nonTurnPlayer].forEach(controller => {
            const sourceOpponent = this.getOpponentOf(controller);

            if (controller.levelZone) {
                this.effectManager.processEffects(ActivationCondition.HAND_TRASHED, {
                    sourceCard: controller.levelZone,
                    player: controller,
                    opponent: sourceOpponent,
                    machine: this,
                    ...(sourceContext || {}),
                    flags: {
                        trashedHandCount: cards.length,
                        isOwnHandTrash: controller.id === player.id,
                        handTrashByEffect: true,
                        ...((sourceContext?.flags as Record<string, any>) || {}),
                    },
                }, { enqueueOnly: true, batchStep });
            }

            controller.unitZones.forEach(zone => {
                if (!zone.unit) return;
                this.effectManager.processEffects(ActivationCondition.HAND_TRASHED, {
                    sourceCard: zone.unit,
                    player: controller,
                    opponent: sourceOpponent,
                    unitZone: zone,
                    machine: this,
                    ...(sourceContext || {}),
                    flags: {
                        trashedHandCount: cards.length,
                        isOwnHandTrash: controller.id === player.id,
                        handTrashByEffect: true,
                        ...((sourceContext?.flags as Record<string, any>) || {}),
                    },
                }, { enqueueOnly: true, batchStep });
            });
        });

        this.effectManager.processQueue();
    }

    public notifyCardsDrawn(player: PlayerState, cards: Card[], sourceMeta: DrawCardMeta = {}) {
        if (!cards.length) return;

        const reason = sourceMeta.reason ?? 'RULE';
        const sourceActivation = sourceMeta.sourceActivation;
        const drawnByEffect = reason === 'EFFECT';
        const drawnByTriggerEffect = drawnByEffect && sourceActivation === ActivationCondition.DAMAGE_TRIGGER;
        const drawnByNonTriggerEffect = drawnByEffect && !drawnByTriggerEffect;

        // DRAWN windows currently care about effect-driven draws only.
        if (!drawnByEffect) return;

        const batchStep = this.incrementAndGetGlobalStep();
        const [turnPlayer, nonTurnPlayer] = this.getPlayersInTurnOrder();
        [turnPlayer, nonTurnPlayer].forEach(controller => {
            const sourceOpponent = this.getOpponentOf(controller);
            const commonFlags = {
                drawnCount: cards.length,
                drawnPlayerId: player.id,
                isOwnDraw: controller.id === player.id,
                isOpponentDraw: controller.id !== player.id,
                drawnByEffect,
                drawnByTriggerEffect,
                drawnByNonTriggerEffect,
                DRAWN_BY_NON_TRIGGER_EFFECT: drawnByNonTriggerEffect,
                OPPONENT_DREW_NON_TRIGGER_EFFECT: controller.id !== player.id && drawnByNonTriggerEffect,
            };

            if (controller.levelZone) {
                this.effectManager.processEffects(ActivationCondition.DRAWN, {
                    sourceCard: controller.levelZone,
                    player: controller,
                    opponent: sourceOpponent,
                    machine: this,
                    flags: commonFlags,
                }, { enqueueOnly: true, batchStep });
            }

            controller.unitZones.forEach(zone => {
                if (!zone.unit) return;
                this.effectManager.processEffects(ActivationCondition.DRAWN, {
                    sourceCard: zone.unit,
                    player: controller,
                    opponent: sourceOpponent,
                    unitZone: zone,
                    machine: this,
                    flags: commonFlags,
                }, { enqueueOnly: true, batchStep });

                zone.items.forEach(item => {
                    this.effectManager.processEffects(ActivationCondition.DRAWN, {
                        sourceCard: item,
                        player: controller,
                        opponent: sourceOpponent,
                        unitZone: zone,
                        machine: this,
                        flags: commonFlags,
                    }, { enqueueOnly: true, batchStep });
                });
            });
        });

        this.effectManager.processQueue();
    }

    private getPlayerById(playerId: string): PlayerState | null {
        return this.state.players.find(p => p.id === playerId) ?? null;
    }

    private getDefaultInteractionOwnerId(): string {
        if (this.state.phase === Phase.BLOCK && this.state.pendingAttackerIndex !== null) {
            return this.opponentPlayer.id;
        }
        return this.currentPlayer.id;
    }

    private assignInteractionOwner(playerId: string | null) {
        this.state.interactionOwnerPlayerId = playerId;
        if (this.state.pendingEffect) {
            this.state.pendingEffect.controllerPlayerId = playerId ?? undefined;
        }
    }

    public setInteractionOwner(playerId: string | null) {
        this.assignInteractionOwner(playerId);
    }

    private getInteractionOwnerId(): string | null {
        if (this.state.interactionMode === 'NORMAL') {
            return this.getDefaultInteractionOwnerId();
        }

        return (
            this.state.interactionOwnerPlayerId ??
            this.state.pendingEffect?.controllerPlayerId ??
            this.state.pendingEffect?.sourcePlayerId ??
            null
        );
    }

    private canActorInput(actorPlayerId: string): boolean {
        const ownerId = this.getInteractionOwnerId();
        return ownerId === null || ownerId === actorPlayerId;
    }

    private resolveTargetSelectionController(effect: any, context: any): string {
        const scope = effect?.targets?.scope;

        // In current card data, OPP_HAND + DISCARD means target owner chooses.
        if (scope === 'OPP_HAND' && effect?.action?.type === 'DISCARD') {
            return context.opponent.id;
        }

        return context.player.id;
    }

    private mapScopeToValidTargets(scope: TargetSchema['scope']): PendingEffect['validTargets'] {
        switch (scope) {
            case 'SHARED_LANE':
            case 'MY_TRASH':
            case 'MY_HAND':
            case 'OPP_HAND':
            case 'MY_DAMAGE':
            case 'MY_FIELD_ITEMS':
            case 'OPP_FIELD_ITEMS':
            case 'FIELD_ITEMS':
            case 'REVEALED':
            case 'LAST_DRAWN':
                return scope;
            default:
                return undefined;
        }
    }

    public setPendingRuntime(context: GameContext | null, effect: Effect | null = null) {
        if (!this.state.pendingEffect || !context) {
            this.pendingRuntime = null;
            return;
        }

        const pending = this.state.pendingEffect;
        this.pendingRuntime = { context, effect };

        if (context.sourceActivation && !pending.sourceActivation) {
            pending.sourceActivation = context.sourceActivation;
        }
        if (context.sourceEffectDescription && !pending.sourceEffectDescription) {
            pending.sourceEffectDescription = context.sourceEffectDescription;
        }

        if (effect) {
            pending.effectDescription = effect.description;
            pending.targetSchema = effect.targets;
            pending.costCardTypeFilter = effect.cost?.cardTypeFilter;
            if (!pending.sourceActivation) {
                pending.sourceActivation = effect.activation;
            }
            if (!pending.sourceEffectDescription) {
                pending.sourceEffectDescription = effect.description;
            }
        }

        if (!pending.selectionPurpose) {
            if (this.state.interactionMode === 'SELECT_TARGET') {
                pending.selectionPurpose = '효과 대상 지정';
            } else if (this.state.interactionMode === 'SELECT_COST') {
                pending.selectionPurpose = '효과 비용 지불';
            } else if (this.state.interactionMode === 'SELECT_OPTIONAL') {
                pending.selectionPurpose = '선택형 효과 발동 여부 결정';
            }
        }
    }

    private getPendingRuntime(): PendingRuntimeState | null {
        if (!this.state.pendingEffect) return null;
        return this.pendingRuntime;
    }

    private clearPendingRuntime() {
        this.pendingRuntime = null;
    }

    public getSerializableState(): GameState {
        const clonedState = JSON.parse(
            JSON.stringify(this.state, (key, value) => {
                // Effect queue contexts contain machine back-references, which create cycles.
                if (key === 'machine') return undefined;
                return value;
            })
        );
        this.remapPendingSelectedTargetsForStateClone(clonedState);
        return clonedState;
    }

    private remapPendingSelectedTargetsForStateClone(clonedState: GameState): void {
        const originalSelectedTargets = this.state.pendingEffect?.selectedTargets;
        const clonedPendingEffect = clonedState.pendingEffect;
        if (!clonedPendingEffect || !Array.isArray(originalSelectedTargets) || originalSelectedTargets.length === 0) {
            return;
        }

        const clonedFallbackTargets = Array.isArray(clonedPendingEffect.selectedTargets)
            ? clonedPendingEffect.selectedTargets
            : [];

        clonedPendingEffect.selectedTargets = originalSelectedTargets.map((target, index) => {
            const mapped = this.mapTargetReferenceForStateClone(clonedState, target);
            if (mapped !== null && mapped !== undefined) return mapped;
            if (index < clonedFallbackTargets.length) return clonedFallbackTargets[index];
            if (target === null || target === undefined) return target;
            if (typeof target !== 'object') return target;
            return null;
        }).filter(target => target !== null);
    }

    private mapTargetReferenceForStateClone(clonedState: GameState, target: unknown): unknown {
        if (target === null || target === undefined) return target;
        if (typeof target !== 'object') return target;

        const zoneLocator = this.locateZoneReference(target as UnitZoneState);
        if (zoneLocator) {
            return clonedState.players[zoneLocator.playerIndex]?.unitZones[zoneLocator.zoneIndex] ?? null;
        }

        const cardLocator = this.locateCardReference(target as Card);
        if (cardLocator) {
            return this.resolveCardReferenceInState(clonedState, cardLocator);
        }

        return null;
    }

    public createSimulationFork(): GameEngine {
        const clonedRandomProvider = this.cloneRandomProvider();
        const player1 = this.state.players[0];
        const player2 = this.state.players[1];
        const leader1 = player1.levelZone ? this.cloneCard(player1.levelZone) : this.createFallbackLeaderCard('SIM_LEADER_P1');
        const leader2 = player2.levelZone ? this.cloneCard(player2.levelZone) : this.createFallbackLeaderCard('SIM_LEADER_P2');

        const fork = new GameEngine(
            player1.name,
            player2.name,
            [],
            [],
            leader1,
            leader2,
            {
                randomProvider: clonedRandomProvider,
                enableMulligan: false,
            },
        );

        fork.state = this.getSerializableState();
        fork.runtimeIdCounter = this.runtimeIdCounter;
        fork.awaitingEndPhaseHandAdjustment = this.awaitingEndPhaseHandAdjustment;
        fork.pendingRuntime = this.clonePendingRuntimeForFork(fork);
        fork.assignInteractionOwner(fork.state.interactionOwnerPlayerId);

        return fork;
    }

    private clonePendingRuntimeForFork(fork: GameEngine): PendingRuntimeState | null {
        if (!this.pendingRuntime) return null;

        return {
            context: this.clonePendingRuntimeContextForFork(fork, this.pendingRuntime.context),
            effect: this.pendingRuntime.effect ? JSON.parse(JSON.stringify(this.pendingRuntime.effect)) : null,
        };
    }

    private clonePendingRuntimeContextForFork(fork: GameEngine, context: GameContext): GameContext {
        const mappedPlayer = this.mapPlayerForFork(fork, context.player.id) ?? fork.state.players[0];
        const mappedOpponent = this.mapPlayerForFork(fork, context.opponent.id)
            ?? fork.state.players.find(player => player.id !== mappedPlayer.id)
            ?? mappedPlayer;

        const mappedContext: GameContext = {
            player: mappedPlayer,
            opponent: mappedOpponent,
            sourceCard: this.mapCardForFork(fork, context.sourceCard),
            machine: fork,
        };

        const mappedZone = this.mapZoneForFork(fork, context.unitZone);
        if (mappedZone) mappedContext.unitZone = mappedZone;
        if (context.selectedLaneIndex !== undefined) mappedContext.selectedLaneIndex = context.selectedLaneIndex;
        if (context.destroyedBy) mappedContext.destroyedBy = this.mapCardForFork(fork, context.destroyedBy);
        if (context.trashedUnit) mappedContext.trashedUnit = this.mapCardForFork(fork, context.trashedUnit);
        if (context.trashedUnitOwner) {
            mappedContext.trashedUnitOwner = this.mapPlayerForFork(fork, context.trashedUnitOwner.id) ?? mappedPlayer;
        }
        if (context.costPaymentCard) {
            mappedContext.costPaymentCard = this.mapCardForFork(fork, context.costPaymentCard);
        }
        if (context.costPaid !== undefined) mappedContext.costPaid = context.costPaid;
        if (context._optionalConfirmed !== undefined) mappedContext._optionalConfirmed = context._optionalConfirmed;
        if (context.lastDrawnCards) {
            mappedContext.lastDrawnCards = context.lastDrawnCards.map(card => this.mapCardForFork(fork, card));
        }
        if (context.discardedCount !== undefined) mappedContext.discardedCount = context.discardedCount;
        if (context.trashReason !== undefined) mappedContext.trashReason = context.trashReason;
        if (context.flags !== undefined) mappedContext.flags = JSON.parse(JSON.stringify(context.flags));

        return mappedContext;
    }

    private mapPlayerForFork(fork: GameEngine, playerId: string): PlayerState | undefined {
        return fork.state.players.find(player => player.id === playerId);
    }

    private mapCardForFork(fork: GameEngine, card: Card): Card {
        const locator = this.locateCardReference(card);
        if (locator) {
            const mapped = this.resolveCardReferenceInFork(fork, locator);
            if (mapped) return mapped;
        }
        return this.cloneCard(card);
    }

    private mapZoneForFork(fork: GameEngine, zone: UnitZoneState | undefined): UnitZoneState | undefined {
        if (!zone) return undefined;
        const locator = this.locateZoneReference(zone);
        if (!locator) return undefined;

        const player = fork.state.players[locator.playerIndex];
        if (!player) return undefined;
        return player.unitZones[locator.zoneIndex];
    }

    private locateCardReference(card: Card): CardReferenceLocator | null {
        for (let playerIndex = 0; playerIndex < this.state.players.length; playerIndex++) {
            const player = this.state.players[playerIndex];

            if (player.levelZone === card) {
                return { playerIndex, area: 'LEVEL' };
            }

            const handIndex = player.hand.indexOf(card);
            if (handIndex !== -1) {
                return { playerIndex, area: 'HAND', index: handIndex };
            }

            const deckIndex = player.deck.indexOf(card);
            if (deckIndex !== -1) {
                return { playerIndex, area: 'DECK', index: deckIndex };
            }

            const damageIndex = player.damage.indexOf(card);
            if (damageIndex !== -1) {
                return { playerIndex, area: 'DAMAGE', index: damageIndex };
            }

            const trashIndex = player.trash.indexOf(card);
            if (trashIndex !== -1) {
                return { playerIndex, area: 'TRASH', index: trashIndex };
            }

            for (let zoneIndex = 0; zoneIndex < player.unitZones.length; zoneIndex++) {
                const zone = player.unitZones[zoneIndex];
                if (zone.unit === card) {
                    return { playerIndex, area: 'ZONE_UNIT', zoneIndex };
                }

                const itemIndex = zone.items.indexOf(card);
                if (itemIndex !== -1) {
                    return { playerIndex, area: 'ZONE_ITEM', zoneIndex, index: itemIndex };
                }
            }
        }

        const revealedIndex = this.state.revealedCards.indexOf(card);
        if (revealedIndex !== -1) {
            return { playerIndex: -1, area: 'REVEALED', index: revealedIndex };
        }

        return null;
    }

    private resolveCardReferenceInFork(fork: GameEngine, locator: CardReferenceLocator): Card | null {
        return this.resolveCardReferenceInState(fork.state, locator);
    }

    private resolveCardReferenceInState(state: GameState, locator: CardReferenceLocator): Card | null {
        if (locator.area === 'REVEALED') {
            return locator.index === undefined ? null : (state.revealedCards[locator.index] ?? null);
        }

        const player = state.players[locator.playerIndex];
        if (!player) return null;

        switch (locator.area) {
            case 'LEVEL':
                return player.levelZone ?? null;
            case 'HAND':
                return locator.index === undefined ? null : (player.hand[locator.index] ?? null);
            case 'DECK':
                return locator.index === undefined ? null : (player.deck[locator.index] ?? null);
            case 'DAMAGE':
                return locator.index === undefined ? null : (player.damage[locator.index] ?? null);
            case 'TRASH':
                return locator.index === undefined ? null : (player.trash[locator.index] ?? null);
            case 'ZONE_UNIT':
                return locator.zoneIndex === undefined ? null : (player.unitZones[locator.zoneIndex]?.unit ?? null);
            case 'ZONE_ITEM':
                if (locator.zoneIndex === undefined || locator.index === undefined) return null;
                return player.unitZones[locator.zoneIndex]?.items[locator.index] ?? null;
            default:
                return null;
        }
    }

    private locateZoneReference(zone: UnitZoneState): ZoneReferenceLocator | null {
        for (let playerIndex = 0; playerIndex < this.state.players.length; playerIndex++) {
            const player = this.state.players[playerIndex];
            for (let zoneIndex = 0; zoneIndex < player.unitZones.length; zoneIndex++) {
                if (player.unitZones[zoneIndex] === zone) {
                    return { playerIndex, zoneIndex };
                }
            }
        }
        return null;
    }

    private cloneRandomProvider(): RandomProvider {
        if (typeof this.random.clone === 'function') {
            return this.random.clone();
        }
        throw new Error('RandomProvider must support clone() for simulation fork.');
    }

    private cloneCard(card: Card): Card {
        return JSON.parse(JSON.stringify(card));
    }

    private createFallbackLeaderCard(id: string): Card {
        return {
            id,
            name: id,
            type: CardType.LEADER,
            attribute: Attribute.NONE,
            cost: 0,
            text: '',
            effects: [],
        };
    }

    private getPayableHandIndexesForCost(player: PlayerState, cost: PendingEffect['costToPay']): number[] {
        if (!cost) return [];
        const filter = cost.cardTypeFilter;
        const indexes: number[] = [];
        player.hand.forEach((card, handIndex) => {
            if (!filter || card.type === filter) {
                indexes.push(handIndex);
            }
        });
        return indexes;
    }

    public getObservation(actorPlayerId: string): EngineObservation {
        const legalActions = this.getLegalActions(actorPlayerId);
        return {
            actorPlayerId,
            canAct: legalActions.length > 0,
            interactionOwnerPlayerId: this.getInteractionOwnerId(),
            legalActions,
            state: this.getSerializableState(),
        };
    }

    public isPendingCardTarget(card: Card): boolean {
        if (this.state.interactionMode !== 'SELECT_TARGET' || !this.state.pendingEffect) return false;
        const runtime = this.getPendingRuntime();
        const schema = this.state.pendingEffect.targetSchema;
        if (!runtime || !schema) return false;
        return TargetSelector.isValidTarget(this, schema, runtime.context, card);
    }

    public isPendingZoneTarget(zone: UnitZoneState): boolean {
        if (this.state.interactionMode !== 'SELECT_TARGET' || !this.state.pendingEffect) return false;
        const runtime = this.getPendingRuntime();
        const schema = this.state.pendingEffect.targetSchema;
        if (!runtime || !schema) return false;
        return TargetSelector.isValidTarget(this, schema, runtime.context, zone);
    }

    public getLegalActions(actorPlayerId?: string): EngineAction[] {
        return buildLegalActions(this, actorPlayerId);
    }

    public step(action: EngineAction): boolean {
        const actor = this.getPlayerById(action.actorPlayerId);
        if (!actor) return false;
        if (!this.canActorInput(action.actorPlayerId)) return false;

        switch (action.type) {
            case 'NEXT_PHASE':
                if (action.actorPlayerId !== this.currentPlayer.id) return false;
                this.nextPhase();
                return true;
            case 'RESOLVE_MULLIGAN':
                return this.resolveMulliganForPlayer(action.actorPlayerId, action.shouldMulligan);
            case 'PLAY_UNIT':
                if (action.actorPlayerId !== this.currentPlayer.id) return false;
                this.playUnit(action.handIndex, action.zoneIndex);
                return true;
            case 'PLAY_SKILL':
                if (action.actorPlayerId !== this.currentPlayer.id) return false;
                this.playSkill(action.handIndex);
                return true;
            case 'PLAY_ITEM':
                if (action.actorPlayerId !== this.currentPlayer.id) return false;
                this.playItem(action.handIndex, action.zoneIndex);
                return true;
            case 'ACTIVATE_EFFECT':
                if (action.actorPlayerId !== this.currentPlayer.id) return false;
                this.activateEffect(action.zoneIndex, action.effectIndex, action.sourceType || 'UNIT', action.itemIndex);
                return true;
            case 'ATTACK':
                if (action.actorPlayerId !== this.currentPlayer.id) return false;
                this.attack(action.attackerZoneIndex);
                return true;
            case 'RESOLVE_BLOCK':
                if (this.state.phase !== Phase.BLOCK) return false;
                if (action.actorPlayerId !== this.opponentPlayer.id) return false;
                this.resolveBlock(action.shouldBlock, action.blockerZoneIndex);
                return true;
            case 'SELECT_COST_HAND':
                this.selectCostForPlayerId(action.handIndex, action.actorPlayerId);
                return true;
            case 'RESOLVE_OPTIONAL':
                this.resolveOptionalEffect(action.confirm);
                return true;
            case 'SELECT_ZONE_TARGET':
                this.selectZoneTargetByPlayerId(action.zoneIndex, action.targetPlayerId);
                return true;
            case 'SELECT_HAND_TARGET':
                this.selectHandTargetByPlayerId(action.handIndex, action.targetPlayerId);
                return true;
            case 'SELECT_TRASH_TARGET':
                this.selectTrashTarget(action.trashIndex, action.targetPlayerId);
                return true;
            case 'SELECT_DAMAGE_TARGET':
                this.selectDamageTargetByPlayerId(action.damageIndex, action.targetPlayerId);
                return true;
            case 'SELECT_ITEM_TARGET':
                this.selectItemTargetByPlayerId(action.zoneIndex, action.itemIndex, action.targetPlayerId);
                return true;
            case 'SELECT_REVEALED_TARGET':
                this.selectRevealedTarget(action.revealedIndex);
                return true;
            case 'CONFIRM_TARGETS':
                this.confirmTargets();
                return true;
            default:
                return false;
        }
    }

    private requiresAwakenedLeader(effect: Effect): boolean {
        const description = effect.description || '';
        return (
            description.includes('각성면') ||
            description.includes('AWAKENED')
        );
    }

    drawCard(playerIndex: number, count: number = 1, meta: DrawCardMeta = { reason: 'RULE' }): Card[] {
        const player = this.state.players[playerIndex];
        const drawn: Card[] = [];
        for (let i = 0; i < count; i++) {
            if (player.deck.length === 0) {
                this.state.winner = this.state.players[playerIndex === 0 ? 1 : 0].id; // Loss by deck out
                return drawn;
            }
            const card = player.deck.pop()!;
            player.hand.push(card);
            drawn.push(card);
        }
        this.notifyCardsDrawn(player, drawn, meta);
        if (drawn.length > 0) {
            this.pushUiTraceEvent('CARDS_DRAWN', {
                sourcePlayerId: player.id,
                sourceCardId: meta.sourceCardId,
                cardIds: drawn.map(card => card.id),
                cardNames: drawn.map(card => card.name),
                count: drawn.length,
            });
        }
        return drawn;
    }

    nextPhase() {
        if (this.state.winner) {
            return;
        }

        const endValidation = RuleValidator.canEndPhase(this, this.currentPlayer);
        if (!endValidation.valid) {
            console.log(`Cannot end phase: ${endValidation.reason}`);
            return;
        }

        let nextPhase: Phase = this.state.phase;

        switch (this.state.phase) {
            case Phase.LEVEL_UP:
                this.addLeaderLevel(this.state.turnPlayerIndex, 1);
                nextPhase = Phase.DRAW;
                break;
            case Phase.DRAW:
                if (!(this.state.turnCount === 1 && this.state.turnPlayerIndex === 0)) {
                    this.drawCard(this.state.turnPlayerIndex);
                }
                nextPhase = Phase.MAIN;
                break;
            case Phase.MAIN:
                nextPhase = Phase.ATTACK;
                break;
            case Phase.ATTACK:
                nextPhase = Phase.END;
                break;
            case Phase.BLOCK:
                console.warn("Cannot skip BLOCK phase manually. Must resolve block.");
                return;
            case Phase.END:
                nextPhase = Phase.LEVEL_UP;
                break;
        }

        // Execute Exit Logic (Current Phase)
        // (Currently mostly handled in endPhase/endTurn calls, unifying now)
        if (this.state.phase === Phase.END) {
            this.resolveEndPhase(); // New dedicated method
        } else {
            this.state.phase = nextPhase;
            this.enterPhase(nextPhase);
        }
    }

    public enterPhase(phase: Phase) {
        this.state.phase = phase;
        if (this.state.interactionMode === 'NORMAL') {
            this.assignInteractionOwner(this.getDefaultInteractionOwnerId());
        }
        console.log(`Entering Phase: ${phase}`);

        if (phase === Phase.MAIN) {
            // ESCAPE triggers at the start of that unit owner's Main Phase.
            const owner = this.currentPlayer;
            const opponent = this.getOpponentOf(owner);
            owner.unitZones.forEach((zone) => {
                if (!zone.unit) return;
                const escapeEffects = zone.unit.effects?.filter(e => e.activation === ActivationCondition.ESCAPE);
                if (!escapeEffects || escapeEffects.length === 0) return;

                console.log(`[ESCAPE] Triggered for ${zone.unit.name}`);
                this.effectManager.processEffects(ActivationCondition.ESCAPE, {
                    sourceCard: zone.unit,
                    player: owner,
                    opponent: opponent,
                    unitZone: zone,
                    machine: this
                });
            });
        }
        this.pushUiTraceEvent('PHASE_CHANGED');
    }

    private resolveEndPhase() {
        console.log("Resolving End Phase Sequence...");
        // 1. "At the end of turn" Effects
        const turnEndBatchStep = this.incrementAndGetGlobalStep();
        const [turnPlayer, nonTurnPlayer] = this.getPlayersInTurnOrder();
        [turnPlayer, nonTurnPlayer].forEach((p) => {
            const opponent = this.getOpponentOf(p);

            if (p.levelZone) {
                this.effectManager.processEffects(ActivationCondition.TURN_END, {
                    sourceCard: p.levelZone,
                    player: p,
                    opponent: opponent,
                    machine: this
                }, { enqueueOnly: true, batchStep: turnEndBatchStep });
            }

            p.unitZones.forEach(z => {
                if (z.unit) {
                    this.effectManager.processEffects(ActivationCondition.TURN_END, {
                        sourceCard: z.unit,
                        player: p,
                        opponent: opponent,
                        unitZone: z,
                        machine: this
                    }, { enqueueOnly: true, batchStep: turnEndBatchStep });
                }

                z.items.forEach(i => {
                    this.effectManager.processEffects(ActivationCondition.TURN_END, {
                        sourceCard: i,
                        player: p,
                        opponent: opponent,
                        unitZone: z,
                        machine: this
                    }, { enqueueOnly: true, batchStep: turnEndBatchStep });
                });
            });
        });
        this.effectManager.processQueue();

        // 2. Clear Temporary Buffs/Effects ("Until End of Turn")
        this.state.players.forEach(p => {
            p.unitZones.forEach(z => {
                z.buffs = z.buffs.filter(b => b.duration !== 'TURN_END');
                z.temporaryEffects = z.temporaryEffects.filter(e => e.duration !== 'TURN_END');
            });
        });
        // Clear OPP_TURN_END for the Opponent (since it IS their opponent's turn ending now)
        const opponent = this.opponentPlayer; // The non-turn player
        opponent.unitZones.forEach(z => {
            z.buffs = z.buffs.filter(b => b.duration !== 'OPP_TURN_END');
            z.temporaryEffects = z.temporaryEffects.filter(e => e.duration !== 'OPP_TURN_END');
        });

        // 3. Trash Skills (Skill Zone -> Trash)
        this.currentPlayer.skillZone.forEach(c => this.currentPlayer.trash.push(c));
        this.currentPlayer.skillZone = [];

        // 4. Hand Adjustment (Rule 6.6.1.4): turn player chooses cards to trash until hand is 7.
        if (this.currentPlayer.hand.length > 7) {
            if (this.initiateEndPhaseHandAdjustment()) {
                return;
            }
        }

        // 5. Turn Switch
        this.endTurn();
    }

    private initiateEndPhaseHandAdjustment(): boolean {
        const player = this.currentPlayer;
        const requiredDiscardCount = player.hand.length - 7;
        if (requiredDiscardCount <= 0) return false;

        const sourceCard = player.levelZone ?? player.hand[0];
        if (!sourceCard) return false;

        const opponent = this.getOpponentOf(player);
        const handAdjustEffect: Effect = {
            activation: ActivationCondition.TURN_END,
            description: 'Rule 6.6.1.4: End phase hand adjustment',
            targets: {
                scope: 'MY_HAND',
                type: 'CARD',
                count: requiredDiscardCount,
                selectMode: 'MANUAL',
            },
            action: {
                type: 'DISCARD',
                params: {
                    target: 'SELF',
                    count: requiredDiscardCount,
                    isRule: true,
                },
            },
        };

        const context: GameContext = {
            sourceCard,
            player,
            opponent,
            machine: this,
        };

        this.state.interactionMode = 'SELECT_TARGET';
        this.state.pendingEffect = {
            sourceCard,
            sourcePlayerId: player.id,
            controllerPlayerId: player.id,
            actionType: this.endPhaseHandAdjustActionType,
            actionValue: { requiredDiscardCount },
            effectDescription: handAdjustEffect.description,
            triggerReason: '턴 종료 규칙 처리',
            selectionPurpose: '핸드 제한(7장)까지 버릴 카드 지정',
            validTargets: 'MY_HAND',
            targetSchema: handAdjustEffect.targets,
            selectedTargets: [],
        };
        this.setPendingRuntime(context, handAdjustEffect);
        this.assignInteractionOwner(player.id);
        this.awaitingEndPhaseHandAdjustment = true;

        console.log(`[Rule 6.6.1.4] ${player.name} must discard ${requiredDiscardCount} card(s) to hand size 7.`);
        return true;
    }

    private endTurn() {
        this.resetTurnStats();

        // Reset per-turn flags
        this.state.players.forEach(player => {
            player.lockedActivationsUntilTurnEnd = {};
        });

        this.currentPlayer.unitZones.forEach(z => {
            z.hasAttacked = false;
            z.isExhausted = false;
            z.hasPlacedUnitThisTurn = false;
            z.hasActivatedEffectThisTurn = false;
            z.activatedEffectKeys = {};
            z.attackCountThisTurn = 0;
            z.extraAttackAllowance = 0;
        });
        (this.currentPlayer as any).leaderActivatedEffectKeys = {};
        (this.currentPlayer as any).lockedSkillIdsUntilTurnEnd = {};

        // Switch
        this.state.turnPlayerIndex = this.state.turnPlayerIndex === 0 ? 1 : 0;
        this.state.turnCount++;
        this.clearExpiredTurnCountAttackLocks();
        this.assignInteractionOwner(this.currentPlayer.id);
        this.enterPhase(Phase.LEVEL_UP); // Correctly enter next phase

        // Reset once-per-turn effects
        (this.state as any).firedEffects = {};

        // Process delayed actions (Legacy support, maybe merge into TURN_END effects?)
        this.processDelayedActions();
    }

    private clearExpiredTurnCountAttackLocks() {
        this.state.players.forEach(player => {
            player.unitZones.forEach(zone => {
                zone.temporaryEffects = zone.temporaryEffects.filter(effect => {
                    const attackLockUntil = effect?.action?.params?.cannotAttackUntilTurnCount;
                    const genericUntil = effect?.action?.params?.untilTurnCount;
                    const untilTurnCount =
                        typeof attackLockUntil === 'number'
                            ? attackLockUntil
                            : (typeof genericUntil === 'number' ? genericUntil : undefined);
                    if (typeof untilTurnCount !== 'number') return true;
                    return this.state.turnCount <= untilTurnCount;
                });
            });
        });
    }

    private processDelayedActions() {
        this.state.players.forEach(player => {
            const delayed = (player as any).delayedActions || [];
            if (delayed.length === 0) return;

            const remaining: any[] = [];
            delayed.forEach((action: any) => {
                if (action.type === 'RETURN_TO_HAND_FROM_TRASH') {
                    // Check if card is still in trash
                    const idx = player.trash.indexOf(action.card);
                    if (idx !== -1) {
                        player.trash.splice(idx, 1);
                        player.hand.push(action.card);
                        console.log(`Delayed Action: Returned ${action.card.name} to hand.`);
                    }
                } else {
                    remaining.push(action);
                }
            });
            (player as any).delayedActions = remaining;
        });
    }

    public addLeaderLevel(playerIndex: number, amount: number) {
        const player = this.state.players[playerIndex];
        if (player.leaderLevel < 10) {
            player.leaderLevel = Math.min(10, player.leaderLevel + amount);
            console.log(`${player.name} level increased to ${player.leaderLevel}`);
            this.checkAwakening(playerIndex);
        }
    }

    public checkAwakening(playerIndex: number) {
        const player = this.state.players[playerIndex];
        if (player.levelZone && !player.levelZone.isAwakened) {
            const leader = player.levelZone;
            if (leader.effects) {
                const awakenEffect = leader.effects.find(e => e.activation === ActivationCondition.AWAKEN);
                if (awakenEffect) {
                    const context = {
                        player: player,
                        opponent: this.state.players[playerIndex === 0 ? 1 : 0],
                        sourceCard: leader,
                        machine: this
                    };
                    if (this.effectManager.checkCondition(awakenEffect, context)) {
                        this.awakenLeader(playerIndex);
                    }
                }
            }
        }
    }

    private awakenLeader(playerIndex: number) {
        const player = this.state.players[playerIndex];
        if (player.levelZone) {
            player.levelZone.isAwakened = true;
            console.log(`Leader ${player.levelZone.name} AWAKENED!`);
        }
    }

    // Actions
    private trashUnitForUpgrade(player: PlayerState, zone: UnitZoneState) {
        if (!zone.unit) return;
        const unit = zone.unit;

        // Upgrade trash is rule-based trash and must not trigger EXIT / UNIT_TRASHED.
        zone.unit = null;
        player.trash.push(unit);
        zone.items.forEach(item => player.trash.push(item));

        zone.items = [];
        zone.buffs = [];
        zone.temporaryEffects = [];
        zone.attackCountThisTurn = 0;
        zone.extraAttackAllowance = 0;
    }

    playUnit(cardIndex: number, zoneIndex: number) {
        const validation = RuleValidator.canPlayUnit(this, this.currentPlayer, cardIndex, zoneIndex);
        if (!validation.valid) {
            console.log(`Cannot place unit: ${validation.reason}`);
            return;
        }

        const card = this.currentPlayer.hand[cardIndex];
        const zone = this.currentPlayer.unitZones[zoneIndex];
        let isUpgrade = false;

        if (zone.unit) {
            isUpgrade = true;
            this.trashUnitForUpgrade(this.currentPlayer, zone);
        }

        if (isUpgrade && zone.unit) {
            this.trashUnitForUpgrade(this.currentPlayer, zone);
        }


        this.currentPlayer.hand.splice(cardIndex, 1);
        zone.unit = card;
        zone.hasPlacedUnitThisTurn = true;
        zone.buffs = []; // Ensure clear state for new unit if not upgrade (though empty zone implies empty buffs)
        zone.temporaryEffects = [];
        zone.hasAttacked = false;
        zone.attackCountThisTurn = 0;
        zone.extraAttackAllowance = 0;

        // Trigger Entry Effects
        this.effectManager.processEffects(ActivationCondition.ENTRY, {
            sourceCard: card,
            player: this.currentPlayer,
            opponent: this.opponentPlayer,
            unitZone: zone,
            machine: this
        });

        // ENTRY effects can start combat (e.g., "엔트리: 조우 유닛이 있다면 공격").
        // If queue drained in the same call, advance combat flow once so it does not stall at ATTACK_DECLARATION.
        if (this.state.combatStep !== 'NONE' && this.state.effectQueue.length === 0 && this.state.interactionMode === 'NORMAL') {
            this.onQueueCompleted();
        }
    }

    playSkill(cardIndex: number) {
        const validation = RuleValidator.canPlaySkill(this, this.currentPlayer, cardIndex);
        if (!validation.valid) {
            console.log(`Cannot play skill: ${validation.reason}`);
            return;
        }

        const card = this.currentPlayer.hand[cardIndex];

        // Move to Skill Zone
        this.currentPlayer.hand.splice(cardIndex, 1);
        this.currentPlayer.skillZone.push(card);

        // Process Skill Effects (Skills are treated as ACTIVE effects when played)
        // Note: The card text parser classifies them as Activate type.
        this.effectManager.processEffects(ActivationCondition.ACTIVE, {
            sourceCard: card,
            player: this.currentPlayer,
            opponent: this.opponentPlayer,
            machine: this
        });
    }

    playItem(cardIndex: number, zoneIndex: number) {
        const validation = RuleValidator.canPlayItem(this, this.currentPlayer, cardIndex, zoneIndex);
        if (!validation.valid) {
            console.log(`Cannot play item: ${validation.reason}`);
            return;
        }

        const card = this.currentPlayer.hand[cardIndex];
        const zone = this.currentPlayer.unitZones[zoneIndex];

        // Move from Hand to Unit Zone Items
        this.currentPlayer.hand.splice(cardIndex, 1);
        zone.items.push(card);

        console.log(`Equipped ${card.name} to unit in zone ${zoneIndex}`);
    }

    activateEffect(
        zoneIndex: number,
        effectIndex: number,
        sourceType: 'UNIT' | 'ITEM' | 'LEADER' = 'UNIT',
        itemIndex?: number
    ) {
        const zone = sourceType === 'LEADER'
            ? null
            : this.currentPlayer.unitZones[zoneIndex];
        const card = sourceType === 'LEADER'
            ? this.currentPlayer.levelZone
            : sourceType === 'ITEM'
                ? (zone && itemIndex !== undefined ? zone.items[itemIndex] : null)
                : zone?.unit;
        if (!card || !card.effects) return;

        const effect = card.effects[effectIndex];
        if (!effect) return;
        if (effect.activation !== ActivationCondition.ACTIVE && effect.activation !== ActivationCondition.ACTIVE_MAIN) return;

        if (effect.activation === ActivationCondition.ACTIVE_MAIN && this.state.phase !== Phase.MAIN) {
            return;
        }
        if (effect.activation === ActivationCondition.ACTIVE && this.state.phase !== Phase.MAIN && this.state.phase !== Phase.ATTACK) {
            return;
        }

        const effectKey = sourceType === 'ITEM'
            ? `${card.id}_${itemIndex}_${effect.id || effectIndex}`
            : `${card.id}_${effect.id || effectIndex}`;
        if (sourceType === 'LEADER') {
            const fired = ((this.currentPlayer as any).leaderActivatedEffectKeys || {}) as Record<string, boolean>;
            if (fired[effectKey]) return;
        } else if (zone?.activatedEffectKeys[effectKey]) {
            return;
        }

        const context = {
            sourceCard: card,
            player: this.currentPlayer,
            opponent: this.opponentPlayer,
            ...(zone ? { unitZone: zone } : {}),
            machine: this
        };

        if (this.effectManager.processEffect(effect, context)) {
            if (sourceType === 'LEADER') {
                const fired = ((this.currentPlayer as any).leaderActivatedEffectKeys || {}) as Record<string, boolean>;
                fired[effectKey] = true;
                (this.currentPlayer as any).leaderActivatedEffectKeys = fired;
            } else if (zone) {
                zone.activatedEffectKeys[effectKey] = true;
                zone.hasActivatedEffectThisTurn = true;
            }
        }
    }

    // checkPotentialTargets moved to RuleValidator

    initiateCostSelection(effect: Effect, context: GameContext): boolean {
        const requiredAmount = effect.cost?.amount || 1;
        const payableHandIndexes = this.getPayableHandIndexesForCost(context.player, effect.cost);
        if (payableHandIndexes.length < requiredAmount) {
            console.log(
                `[Cost] Skipping effect "${effect.description}" due to insufficient payable cards ` +
                `(${payableHandIndexes.length}/${requiredAmount}).`
            );
            return false;
        }

        const controllerPlayerId = context.player.id;
        this.state.interactionMode = 'SELECT_COST';
        this.state.pendingEffect = {
            sourceCard: context.sourceCard,
            sourcePlayerId: context.player.id,
            controllerPlayerId,
            actionType: effect.action.type,
            actionValue: effect.action.params,
            effectDescription: effect.description,
            selectionPurpose: '효과 비용 지불',
            costToPay: effect.cost,
            costCardTypeFilter: effect.cost?.cardTypeFilter,
            costPaidCount: 0
        };
        this.setPendingRuntime(context, effect);
        this.assignInteractionOwner(controllerPlayerId);
        this.pushUiTraceEvent('INTERACTION_OPENED', {
            sourcePlayerId: context.player.id,
            sourceCardId: context.sourceCard.id,
            sourceCardName: context.sourceCard.name,
            interactionMode: 'SELECT_COST',
            effectDescription: effect.description,
            actionType: effect.action.type,
        });

        console.log("Entered Cost Selection Mode for " + context.sourceCard.name);
        return true;
    }

    initiateOptionalSelection(effect: Effect, context: GameContext) {
        const controllerPlayerId = context.player.id;
        this.state.interactionMode = 'SELECT_OPTIONAL';
        this.state.pendingEffect = {
            sourceCard: context.sourceCard,
            sourcePlayerId: context.player.id,
            controllerPlayerId,
            actionType: effect.action.type,
            actionValue: effect.action.params,
            effectDescription: effect.description,
            selectionPurpose: '선택형 효과 발동 여부 결정'
        };
        this.setPendingRuntime(context, effect);
        this.assignInteractionOwner(controllerPlayerId);
        this.pushUiTraceEvent('INTERACTION_OPENED', {
            sourcePlayerId: context.player.id,
            sourceCardId: context.sourceCard.id,
            sourceCardName: context.sourceCard.name,
            interactionMode: 'SELECT_OPTIONAL',
            effectDescription: effect.description,
            actionType: effect.action.type,
        });
        console.log("Entered Optional Selection Mode for " + context.sourceCard.name);
    }

    resolveOptionalEffect(confirm: boolean) {
        if (this.state.interactionMode !== 'SELECT_OPTIONAL' || !this.state.pendingEffect) return;
        if (this.state.pendingEffect.actionType === 'DESTRUCTION_REPLACEMENT') {
            this.resolveDestructionReplacementChoice(confirm);
            return;
        }

        const runtime = this.getPendingRuntime();
        const effect = runtime?.effect;
        const context = runtime?.context;

        // Reset Mode
        this.state.interactionMode = 'NORMAL';
        this.state.pendingEffect = null;
        this.clearPendingRuntime();
        this.assignInteractionOwner(this.getDefaultInteractionOwnerId());

        if (confirm && effect && context) {
            console.log("Optional Effect confirmed.");
            // Proceed with effect processing (mark as confirmed to avoid re-looping)
            context._optionalConfirmed = true;
            this.effectManager.processEffect(effect, context);
        } else if (!confirm) {
            console.log("Optional Effect skipped.");
        }

        // Resume global queue
        this.effectManager.resumeQueue();
    }

    selectCost(handIndex: number) {
        if (this.state.interactionMode !== 'SELECT_COST' || !this.state.pendingEffect) return;
        const payerPlayerId = this.state.pendingEffect.sourcePlayerId;
        this.selectCostForPlayerId(handIndex, payerPlayerId);
    }

    public selectCostForPlayerId(handIndex: number, payerPlayerId: string) {
        if (this.state.interactionMode !== 'SELECT_COST' || !this.state.pendingEffect) return;
        if (!this.canActorInput(payerPlayerId)) return;

        const pending = this.state.pendingEffect;
        const runtime = this.getPendingRuntime();
        const context = runtime?.context;
        const effect = runtime?.effect;
        const payer = this.getPlayerById(payerPlayerId);
        if (!payer) return;
        if (pending.sourcePlayerId !== payer.id) return;

        const costType = pending.costToPay?.type;

        // Execute Cost
        if (costType === 'TRASH_HAND') {
            if (handIndex < 0 || handIndex >= payer.hand.length) return;
            const discarded = payer.hand.splice(handIndex, 1)[0];
            payer.trash.push(discarded);
            this.notifyHandTrashed(payer, [discarded], {
                flags: {
                    handTrashByEffect: pending.actionType !== this.endPhaseHandAdjustActionType,
                    byCost: true,
                },
            });
            console.log(`Paid cost: Trashed ${discarded.name}`);

            if (!pending.costPaidCount) pending.costPaidCount = 0;
            pending.costPaidCount++;

            // Store discarded card for effect context (e.g. for ST03-013 comparison)
            if (context) {
                context.costPaymentCard = discarded;
            }

        } else if (costType === 'SHUFFLE_HAND_TO_DECK') {
            if (handIndex < 0 || handIndex >= payer.hand.length) return;
            const card = payer.hand.splice(handIndex, 1)[0];
            payer.deck.push(card);
            this.shuffle(payer.deck);
            console.log(`Paid cost: Shuffled ${card.name} into deck`);

            if (!pending.costPaidCount) pending.costPaidCount = 0;
            pending.costPaidCount++;
        }

        const requiredAmount = pending.costToPay?.amount || 1;
        if ((pending.costPaidCount || 0) < requiredAmount) {
            console.log(`Partial cost paid: ${pending.costPaidCount}/${requiredAmount}`);
            return;
        }

        if (pending.actionType === 'DESTRUCTION_REPLACEMENT_PAY_HAND') {
            this.completeDestructionReplacementAfterHandCost(pending);
            return;
        }

        if (pending.actionType === 'DESTROY_UNIT_WITH_HIT_COST') {
            const targetZone = pending.selectedTargets?.[0];
            if (targetZone && targetZone.unit) {
                const owner = this.state.players.find(p => p.unitZones.includes(targetZone));
                if (owner) {
                    const targetName = targetZone.unit.name;
                    this.destroyUnit(owner, targetZone, undefined, 'EFFECT');
                    console.log(`Paid hit cost and destroyed ${targetName}.`);
                }
            }
            if (context) {
                this.handleEffectCompletion(context, pending);
            } else {
                this.resetInteractionMode();
            }
            return;
        }

        if (pending.actionType === 'DESTROY_ENCOUNTER_WITH_HIT_COST') {
            const sourcePlayer = this.getPlayerById(pending.sourcePlayerId);
            if (sourcePlayer) {
                const zoneIndex = pending.actionValue?.zoneIndex;
                if (typeof zoneIndex === 'number' && zoneIndex >= 0 && zoneIndex < sourcePlayer.unitZones.length) {
                    const encounterZone = this.getOpponentOf(sourcePlayer).unitZones[zoneIndex];
                    if (encounterZone?.unit) {
                        this.destroyUnit(this.getOpponentOf(sourcePlayer), encounterZone, undefined, 'EFFECT');
                    }
                }
            }
            if (context) {
                this.handleEffectCompletion(context, pending);
            } else {
                this.resetInteractionMode();
            }
            return;
        }

        if (pending.actionType === 'GUARDIAN_BLOCK_COST') {
            const selectedBlockerZoneIndex = pending.actionValue?.blockerZoneIndex;
            this.state.interactionMode = 'NORMAL';
            this.state.pendingEffect = null;
            this.clearPendingRuntime();
            this.assignInteractionOwner(this.currentPlayer.id);

            if (typeof selectedBlockerZoneIndex === 'number') {
                this.commitBlockDeclaration(selectedBlockerZoneIndex);
            } else {
                this.state.combatBlocked = false;
                this.state.pendingBlockerZoneIndex = null;
                if (this.state.effectQueue.length === 0) {
                    this.advanceCombatStep();
                }
            }
            return;
        }

        // Resume Effect Execution
        if (!effect || !context) {
            this.resetInteractionMode();
            return;
        }
        context.costPaid = true; // Mark as paid to avoid loop

        this.effectManager.processEffect(effect, context);

        if (
            pending.actionType === 'ATTACK_COST' &&
            this.state.interactionMode === 'SELECT_COST' &&
            this.state.pendingEffect === pending
        ) {
            const zoneIndex = pending.actionValue.attackerZoneIndex;
            const byCardEffect = pending.actionValue?.byCardEffect === true;
            const owner = this.getPlayerById(pending.sourcePlayerId) ?? this.currentPlayer;
            const zone = owner.unitZones[zoneIndex];
            (zone as any)._attackCostPaid = true;
            this.resetInteractionMode();
            if (owner.id === this.currentPlayer.id) {
                this.attack(zoneIndex, { byCardEffect }); // Resume attack
            }
            return;
        }

        this.handleEffectCompletion(context, pending);
    }

    initiateTargetSelection(effect: Effect, context: GameContext) {
        if (!effect.targets) return;
        const targetSchema = effect.targets;
        const controllerPlayerId = this.resolveTargetSelectionController(effect, context);
        this.state.interactionMode = 'SELECT_TARGET';
        // Create a PendingEffect state to store context until target is selected
        this.state.pendingEffect = {
            sourceCard: context.sourceCard,
            sourcePlayerId: context.player.id,
            controllerPlayerId,
            actionType: effect.action.type, // redundant but useful for UI
            actionValue: effect.action.params,
            effectDescription: effect.description,
            selectionPurpose: '효과 대상 지정',
            validTargets: this.mapScopeToValidTargets(targetSchema.scope),
            targetSchema,
            selectedTargets: []
        };
        this.setPendingRuntime(context, effect);
        this.assignInteractionOwner(controllerPlayerId);
        this.pushUiTraceEvent('INTERACTION_OPENED', {
            sourcePlayerId: context.player.id,
            sourceCardId: context.sourceCard.id,
            sourceCardName: context.sourceCard.name,
            interactionMode: 'SELECT_TARGET',
            effectDescription: effect.description,
            actionType: effect.action.type,
        });

        console.log("Entered Selection Mode for " + context.sourceCard.name);
    }

    attack(attackerZoneIndex: number, options?: { byCardEffect?: boolean }) {
        const byCardEffect = options?.byCardEffect === true;
        const validation = RuleValidator.canAttack(this, this.currentPlayer, attackerZoneIndex);
        if (!validation.valid) {
            console.log(`Cannot attack: ${validation.reason}`);
            return;
        }

        const attackerZone = this.currentPlayer.unitZones[attackerZoneIndex];

        const attackCostEffect = this.getAttackCostEffect(attackerZone);
        if (attackCostEffect && !(attackerZone as any)._attackCostPaid) {
            const started = this.initiateAttackCostSelection(attackCostEffect, {
                sourceCard: attackerZone.unit!,
                player: this.currentPlayer,
                opponent: this.opponentPlayer,
                unitZone: attackerZone,
                machine: this
            }, attackerZoneIndex, { byCardEffect });
            if (started) return;
            return;
        }

        this.state.attackTerminated = false;
        // Combat block state is per-combat. Reset to avoid leaking prior combat results.
        this.state.combatBlocked = false;
        this.state.pendingBlockerZoneIndex = null;
        (attackerZone as any)._attackCostPaid = false; // Reset for next time
        // Rule 7.2.1.1: a unit that attacked only by card effects is still treated as not having attacked this turn.
        if (!byCardEffect) {
            attackerZone.attackCountThisTurn = (attackerZone.attackCountThisTurn || 0) + 1;
            attackerZone.hasAttacked = attackerZone.attackCountThisTurn > 0;
        }
        this.incrementTurnUnitAttackCount(this.currentPlayer.id);

        // COMBAT STEP 1: Attack Declaration
        this.state.combatStep = 'ATTACK_DECLARATION';
        this.state.phase = Phase.ATTACK; // Ensure phase is set
        this.state.pendingAttackerIndex = attackerZoneIndex;
        this.assignInteractionOwner(this.currentPlayer.id);

        // Trigger ATTACKER effects as one simultaneous event.
        const attackerBatchStep = this.incrementAndGetGlobalStep();
        this.effectManager.processEffects(ActivationCondition.ATTACKER, {
            sourceCard: attackerZone.unit,
            player: this.currentPlayer,
            opponent: this.opponentPlayer,
            unitZone: attackerZone,
            machine: this
        }, { enqueueOnly: true, batchStep: attackerBatchStep });

        attackerZone.items.forEach(item => {
            this.effectManager.processEffects(ActivationCondition.ATTACKER, {
                sourceCard: item,
                player: this.currentPlayer,
                opponent: this.opponentPlayer,
                unitZone: attackerZone,
                machine: this
            }, { enqueueOnly: true, batchStep: attackerBatchStep });
        });
        this.effectManager.processQueue();

        // The queue is automatically running.
        // If queue is empty immediately, strict flow requires us to manually advance?
        // OR rely on onQueueCompleted callback?
        // If queue was empty, processEffects returns false/true but queue is empty.
        // EffectManager.processEffects calls processQueue.
        // processQueue returns COMPLETED if empty.
        // BUT processEffects doesn't return that status.

        // Advance only when queue is empty and no interaction prompt is active.
        // Otherwise, resolving the pending interaction should resume queue/flow.
        if (this.state.effectQueue.length === 0 && this.state.interactionMode === 'NORMAL') {
            this.advanceCombatStep();
        }
    }

    private getAttackCostEffect(zone: UnitZoneState): Effect | undefined {
        const unit = zone.unit;
        if (!unit?.effects) return undefined;

        return unit.effects.find((effect) =>
            effect.activation === ActivationCondition.PASSIVE &&
            effect.action?.type === 'NONE' &&
            effect.action?.params?.requiresAttackCost === true &&
            !!effect.cost
        );
    }

    public onQueueCompleted() {
        // Called when EffectManager finishes draining the queue
        // Check if we need to advance the game state
        if (this.state.combatStep !== 'NONE') {
            this.advanceCombatStep();
        }
    }

    private advanceCombatStep() {
        runAdvanceCombatStep(this);
    }

    private stepDefenseDeclaration(attackerZone: UnitZoneState) {
        runStepDefenseDeclaration(this, attackerZone);
    }

    private stepBattleResolution(attackerZone: UnitZoneState) {
        runStepBattleResolution(this, attackerZone);
    }

    private stepBattleEnd() {
        runStepBattleEnd(this);
    }

    private clearBattleScopedEffects() {
        runClearBattleScopedEffects(this);
    }

    resolveBlock(shouldBlock: boolean, blockerZoneIndex?: number) {
        runResolveBlock(this, shouldBlock, blockerZoneIndex);
    }


    private hasKeyword(card: Card, keyword: string): boolean {
        return runHasKeyword(card, keyword);
    }

    private isEncounterBlockForced(attackerZoneIndex: number, candidateBlockers?: number[]): boolean {
        return runIsEncounterBlockForced(this, attackerZoneIndex, candidateBlockers);
    }

    private getAvailableBlockerZoneIndexes(attackerZoneIndex: number): number[] {
        return runGetAvailableBlockerZoneIndexes(this, attackerZoneIndex);
    }

    private getGuardianBarrierCost(zone: UnitZoneState): number {
        return runGetGuardianBarrierCost(this, zone);
    }

    private isBlockPreventedByBreakthrough(attackerZone: UnitZoneState, blockerZone: UnitZoneState): boolean {
        return runIsBlockPreventedByBreakthrough(this, attackerZone, blockerZone);
    }

    private commitBlockDeclaration(blockerZoneIndex: number) {
        runCommitBlockDeclaration(this, blockerZoneIndex);
    }

    private getPenetrationValue(zone: UnitZoneState): number {
        return runGetPenetrationValue(this, zone);
    }

    private getPlunderValue(zone: UnitZoneState): number {
        return runGetPlunderValue(this, zone);
    }

    private hasKeywordInZone(zone: UnitZoneState, keyword: string): boolean {
        return runHasKeywordInZone(this, zone, keyword);
    }

    private processPassiveGrantedExitEffects(
        destroyedOwner: PlayerState,
        destroyedZone: UnitZoneState,
        destroyedUnit: Card,
        killerCard?: Card
    ) {
        runProcessPassiveGrantedExitEffects(this, destroyedOwner, destroyedZone, destroyedUnit, killerCard);
    }

    private isReplacementDestroyReason(reason: 'BATTLE' | 'EFFECT' | 'RULE'): boolean {
        return reason === 'BATTLE' || reason === 'EFFECT';
    }

    private collectDestroyReplacements(
        player: PlayerState,
        zone: UnitZoneState,
        reason: 'BATTLE' | 'EFFECT' | 'RULE',
    ): Array<{ type: 'TRASH_EQUIPPED_ITEM' | 'DISCARD_HAND_BY_HIT'; sourceCard: Card; requiredHandCount?: number; description: string }> {
        return runCollectDestroyReplacements(this, player, zone, reason);
    }

    private beginDestroyReplacementPrompt(
        destroyPayload: { targetPlayerId: string; zoneIndex: number; reason: 'BATTLE' | 'EFFECT' | 'RULE'; killerCard?: Card },
        replacements: Array<{ type: 'TRASH_EQUIPPED_ITEM' | 'DISCARD_HAND_BY_HIT'; sourceCard: Card; requiredHandCount?: number; description: string }>,
        index: number,
    ) {
        runBeginDestroyReplacementPrompt(this, destroyPayload, replacements, index);
    }

    private tryInitiateDestroyReplacement(
        player: PlayerState,
        zone: UnitZoneState,
        killerCard: Card | undefined,
        reason: 'BATTLE' | 'EFFECT' | 'RULE',
    ): boolean {
        return runTryInitiateDestroyReplacement(this, player, zone, killerCard, reason);
    }

    private executePendingDestroyPayload(payload: { targetPlayerId: string; zoneIndex: number; reason: 'BATTLE' | 'EFFECT' | 'RULE'; killerCard?: Card }) {
        runExecutePendingDestroyPayload(this, payload);
    }

    private completeDestructionReplacementAfterHandCost(pending: PendingEffect) {
        runCompleteDestructionReplacementAfterHandCost(this, pending);
    }

    private resolveDestructionReplacementChoice(confirm: boolean) {
        runResolveDestructionReplacementChoice(this, confirm);
    }

    public destroyUnit(
        player: PlayerState,
        zone: UnitZoneState,
        killerCard?: Card,
        reason: 'BATTLE' | 'EFFECT' | 'RULE' = 'EFFECT',
        options: { skipReplacement?: boolean } = {},
    ) {
        runDestroyUnit(this, player, zone, killerCard, reason, options);
    }

    public checkRuleProcessing() {
        if (this.isRuleProcessing) {
            this.pendingRuleProcessing = true;
            return;
        }

        this.isRuleProcessing = true;
        try {
            let guardLoop = 0;
            do {
                this.pendingRuleProcessing = false;
                let destroyedAny = false;

                this.state.players.forEach(player => {
                    player.unitZones.forEach((zone) => {
                        if (!zone.unit) return;
                        const currentUnitId = zone.unit.id;
                        const power = this.getUnitPower(zone, player);
                        if (power > 0) return;

                        console.log(`Rule Processing: Trashing ${zone.unit.name} due to 0 or less ATK (${power})`);
                        this.destroyUnit(player, zone, undefined, 'RULE');
                        if (zone.unit?.id !== currentUnitId) {
                            destroyedAny = true;
                        }
                    });
                });

                if (destroyedAny) {
                    this.pendingRuleProcessing = true;
                }

                guardLoop += 1;
                if (guardLoop > 256) {
                    console.warn('[RuleProcessing] Safety guard triggered after 256 loops.');
                    break;
                }
            } while (this.pendingRuleProcessing);
        } finally {
            this.isRuleProcessing = false;
            this.pendingRuleProcessing = false;
        }
    }

    private getDestroyGuardKey(player: PlayerState, zone: UnitZoneState, unit: Card): string {
        const zoneIndex = player.unitZones.indexOf(zone);
        return `${player.id}|${zoneIndex}|${unit.id}`;
    }

    public initiateAttackCostSelection(
        effect: Effect,
        context: GameContext,
        attackerZoneIndex: number,
        options?: { byCardEffect?: boolean }
    ): boolean {
        const requiredAmount = effect.cost?.amount || 1;
        const payableHandIndexes = this.getPayableHandIndexesForCost(context.player, effect.cost);
        if (payableHandIndexes.length < requiredAmount) {
            console.log(
                `[AttackCost] Cannot start attack for ${context.sourceCard.name}. ` +
                `Insufficient payable cards (${payableHandIndexes.length}/${requiredAmount}).`
            );
            return false;
        }

        const controllerPlayerId = context.player.id;
        this.state.interactionMode = 'SELECT_COST';
        this.state.pendingEffect = {
            sourceCard: context.sourceCard,
            sourcePlayerId: context.player.id,
            controllerPlayerId,
            actionType: 'ATTACK_COST',
            actionValue: { attackerZoneIndex, byCardEffect: options?.byCardEffect === true },
            effectDescription: effect.description,
            triggerReason: '공격 선언 비용 처리',
            selectionPurpose: '공격을 위한 코스트 지불',
            costToPay: effect.cost || { type: 'TRASH_HAND', amount: 1 },
            costCardTypeFilter: effect.cost?.cardTypeFilter,
            selectedTargets: []
        };
        this.setPendingRuntime(context, effect);
        this.assignInteractionOwner(controllerPlayerId);
        this.pushUiTraceEvent('INTERACTION_OPENED', {
            sourcePlayerId: context.player.id,
            sourceCardId: context.sourceCard.id,
            sourceCardName: context.sourceCard.name,
            interactionMode: 'SELECT_COST',
            effectDescription: effect.description,
            actionType: 'ATTACK_COST',
        });
        console.log("Entered Attack Cost Selection Mode for " + context.sourceCard.name);
        return true;
    }

    public dealDamage(player: PlayerState, amount: number) {
        console.log(`Dealing ${amount} damage to ${player.name}`);
        const opponent = this.getOpponentOf(player);
        this.state.damageProcessingDepth++;

        try {
            let damageRemaining = amount;

            while (damageRemaining > 0) {
                // 4.5.4.1. decrement damage
                damageRemaining--;

                // 4.5.4.3. Check deck
                if (player.deck.length === 0) {
                    this.state.winner = opponent.id;
                    return;
                }

                // 4.5.4.2. Reveal card and move to damage zone
                const card = player.deck.pop()!;
                player.damage.push(card);
                this.pushUiTraceEvent('DAMAGE_CARD_REVEALED', {
                    targetPlayerId: player.id,
                    sourceCardId: card.id,
                    sourceCardName: card.name,
                    cardIds: [card.id],
                    cardNames: [card.name],
                    count: 1,
                });

                // 4.5.4.3. Check for Damage Triggers
                const wasTriggered = this.effectManager.processEffects(ActivationCondition.DAMAGE_TRIGGER, {
                    sourceCard: card,
                    player: player,
                    opponent: opponent,
                    machine: this
                });

                if (wasTriggered) {
                    this.pushUiTraceEvent('DAMAGE_TRIGGER_ACTIVATED', {
                        targetPlayerId: player.id,
                        sourceCardId: card.id,
                        sourceCardName: card.name,
                        effectDescription: card.text,
                    });
                    console.log("TRIGGER ACTIVATED! Remaining damage cancelled.");
                    damageRemaining = 0; // 4.5.4.3.1. Set remaining damage to 0
                }

                // 4.5.4.4. Defeat check
                if (player.damage.length >= 10) {
                    this.state.winner = opponent.id;
                    return;
                }
            }
        } finally {
            this.state.damageProcessingDepth = Math.max(0, this.state.damageProcessingDepth - 1);
            if (this.state.damageProcessingDepth === 0) {
                if (this.state.winner) {
                    this.state.deferredEffectQueue = [];
                } else {
                    this.effectManager.flushDeferredEffects();
                }
            }
        }
    }

    public getPlayerSize(player: PlayerState): number {
        let size = player.leaderLevel + player.damage.length;
        const opponent = this.getOpponentOf(player);
        const applySizeModifier = (effect: Effect, sourceCard: Card, sourceZone?: UnitZoneState) => {
            if (!effect || effect.activation !== ActivationCondition.PASSIVE) return;
            if (effect.action?.type !== 'MODIFY_PLAYER_SIZE') return;

            const context: GameContext = {
                player,
                opponent,
                sourceCard,
                unitZone: sourceZone,
                machine: this,
            };
            if (!this.effectManager.checkCondition(effect, context)) return;
            if (sourceCard.type === CardType.LEADER && !sourceCard.isAwakened && this.requiresAwakenedLeader(effect)) {
                return;
            }

            size += effect.action.params?.value || 0;
        };

        if (player.levelZone?.effects) {
            player.levelZone.effects.forEach(effect => applySizeModifier(effect, player.levelZone!));
        }

        player.unitZones.forEach(zone => {
            if (zone.unit?.effects) {
                zone.unit.effects.forEach(effect => applySizeModifier(effect, zone.unit!, zone));
            }
            zone.items.forEach(item => {
                if (item.effects) {
                    item.effects.forEach(effect => applySizeModifier(effect, item, zone));
                }
            });
            if (zone.unit && Array.isArray(zone.temporaryEffects)) {
                zone.temporaryEffects.forEach(effect => applySizeModifier(effect, zone.unit!, zone));
            }
        });

        return size;
    }

    public getUnitPower(zone: UnitZoneState, _player: PlayerState): number {
        if (!zone.unit) return 0;
        let power = zone.unit.power || 0;

        // 1. Buffs (Temporary effects like Noir, Besti, etc.)
        zone.buffs.forEach(buff => {
            if (buff.type === 'POWER') {
                if (buff.mode === 'SET') {
                    power = buff.value;
                } else {
                    power += buff.value;
                }
            }
        });

        // 2. Global Passive Effects (Field-wide or Leader effects)
        const allPotentialSources: { card: Card, zone?: UnitZoneState, owner: PlayerState }[] = [];

        // Add all units on field
        this.state.players.forEach(p => {
            p.unitZones.forEach(z => {
                if (z.unit) allPotentialSources.push({ card: z.unit, zone: z, owner: p });
                z.items.forEach(item => allPotentialSources.push({ card: item, zone: z, owner: p }));
                z.temporaryEffects.forEach(effect => {
                    // For temporary effects, we wrap them in a pseudo-card if they don't have one
                    // Or we just add the sourceCard if it exists
                    allPotentialSources.push({ card: { ...z.unit!, effects: [effect] }, zone: z, owner: p });
                });
            });
            if (p.levelZone) allPotentialSources.push({ card: p.levelZone, owner: p });
        });

        allPotentialSources.forEach(source => {
            if (source.card.effects) {
                source.card.effects.forEach(effect => {
                    if (effect.activation === ActivationCondition.PASSIVE && effect.action.type === 'BUFF_POWER') {
                        const context: GameContext = {
                            player: source.owner,
                            opponent: this.state.players.find(p => p !== source.owner)!,
                            sourceCard: source.card,
                            unitZone: source.zone,
                            machine: this
                        };

                        // Check condition
                        if (!this.effectManager.checkCondition(effect, context)) return;

                        if (source.card.type === CardType.LEADER && !source.card.isAwakened && this.requiresAwakenedLeader(effect)) {
                            return;
                        }

                        // Check if this effect targets the zone we are calculating power for
                            if (TargetSelector.isValidTarget(this, effect.targets!, context, zone)) {
                                const params = effect.action.params || {};
                                let value = params.value || 0;
                                if (params.dynamic === 'LEADER_LEVEL_MULTIPLIER') {
                                    value = source.owner.leaderLevel * value;
                                } else if (params.dynamic === 'BASE_UNIT_COUNT_MULTIPLIER') {
                                    const baseUnitCount = source.owner.unitZones.filter(z => z.unit && z.unit.traits?.includes('베이스')).length;
                                    value = baseUnitCount * value;
                                } else if (params.dynamic === 'ITEM_COUNT_MULTIPLIER') {
                                    const sourceItemCount = source.zone?.items?.length || 0;
                                    value = sourceItemCount * value;
                                } else if (params.dynamic === 'EQUIPPED_UNIT_COUNT_MULTIPLIER') {
                                    const equippedUnitCount = source.owner.unitZones.filter(z => z.unit && z.items.length > 0).length;
                                    value = equippedUnitCount * value;
                                } else if (params.dynamic === 'OTHER_FRIENDLY_HIT_TOTAL_MULTIPLIER') {
                                    const excludeSelf = params.excludeSelf === true;
                                    const totalFriendlyHit = source.owner.unitZones.reduce((sum, unitZone) => {
                                        if (!unitZone.unit) return sum;
                                        if (excludeSelf && source.zone && unitZone === source.zone) return sum;
                                        return sum + Math.max(0, this.getUnitHit(unitZone, source.owner));
                                    }, 0);
                                    value = totalFriendlyHit * value;
                                }
                                power += value;
                            }
                    }
                });
            }
        });

        return power;
    }

    public getUnitHit(zone: UnitZoneState, _player: PlayerState): number {
        if (!zone.unit) return 0;
        let hit = zone.unit.hit || 0;

        // 1. Buffs
        zone.buffs.forEach(buff => {
            if (buff.type === 'HIT') {
                if (buff.mode === 'SET') {
                    hit = buff.value;
                } else {
                    hit += buff.value;
                }
            }
        });

        // 2. Global Passive Effects
        const allPotentialSources: { card: Card, zone?: UnitZoneState, owner: PlayerState }[] = [];
        this.state.players.forEach(p => {
            p.unitZones.forEach(z => {
                if (z.unit) allPotentialSources.push({ card: z.unit, zone: z, owner: p });
                z.items.forEach(item => allPotentialSources.push({ card: item, zone: z, owner: p }));
                z.temporaryEffects.forEach(effect => {
                    if (!z.unit) return;
                    allPotentialSources.push({ card: { ...z.unit, effects: [effect] }, zone: z, owner: p });
                });
            });
            if (p.levelZone) allPotentialSources.push({ card: p.levelZone, owner: p });
        });

        allPotentialSources.forEach(source => {
            if (source.card.effects) {
                source.card.effects.forEach(effect => {
                    if (effect.activation === ActivationCondition.PASSIVE && effect.action.type === 'BUFF_HIT') {
                        const context: GameContext = {
                            player: source.owner,
                            opponent: this.state.players.find(p => p !== source.owner)!,
                            sourceCard: source.card,
                            unitZone: source.zone,
                            machine: this
                        };

                        if (!this.effectManager.checkCondition(effect, context)) return;
                        if (source.card.type === CardType.LEADER && !source.card.isAwakened && this.requiresAwakenedLeader(effect)) return;

                        if (TargetSelector.isValidTarget(this, effect.targets!, context, zone)) {
                            const params = effect.action.params || {};
                            let value = params.value || 0;
                            const mode = params.mode || 'ADD';
                            if (params.dynamic === 'LEADER_LEVEL_MULTIPLIER') {
                                value = source.owner.leaderLevel * value;
                            } else if (params.dynamic === 'BASE_UNIT_COUNT_MULTIPLIER') {
                                const baseUnitCount = source.owner.unitZones.filter(z => z.unit && z.unit.traits?.includes('베이스')).length;
                                value = baseUnitCount * value;
                            } else if (params.dynamic === 'ITEM_COUNT_MULTIPLIER') {
                                const sourceItemCount = source.zone?.items?.length || 0;
                                value = sourceItemCount * value;
                            } else if (params.dynamic === 'EQUIPPED_UNIT_COUNT_MULTIPLIER') {
                                const equippedUnitCount = source.owner.unitZones.filter(z => z.unit && z.items.length > 0).length;
                                value = equippedUnitCount * value;
                            }
                            if (mode === 'SET') {
                                hit = value;
                            } else {
                                hit += value;
                            }
                        }
                    }
                });
            }
        });

        return hit;
    }


    public selectTarget(zoneIndex: number, isOpponentZone: boolean) {
        const targetPlayerId = isOpponentZone ? this.opponentPlayer.id : this.currentPlayer.id;
        this.selectZoneTargetByPlayerId(zoneIndex, targetPlayerId);
    }

    public selectZoneTargetByPlayerId(zoneIndex: number, targetPlayerId: string) {
        runSelectZoneTargetByPlayerId(this, zoneIndex, targetPlayerId);
    }

    public confirmTargets() {
        runConfirmTargets(this);
    }

    public selectTrashTarget(trashIndex: number, targetPlayerId?: string) {
        runSelectTrashTarget(this, trashIndex, targetPlayerId);
    }

    public selectHandTarget(handIndex: number, isOpponentHand: boolean) {
        const targetPlayerId = isOpponentHand ? this.opponentPlayer.id : this.currentPlayer.id;
        this.selectHandTargetByPlayerId(handIndex, targetPlayerId);
    }

    public selectDamageTargetByPlayerId(damageIndex: number, targetPlayerId: string) {
        runSelectDamageTargetByPlayerId(this, damageIndex, targetPlayerId);
    }

    public selectItemTargetByPlayerId(zoneIndex: number, itemIndex: number, targetPlayerId: string) {
        runSelectItemTargetByPlayerId(this, zoneIndex, itemIndex, targetPlayerId);
    }

    public selectHandTargetByPlayerId(handIndex: number, targetPlayerId: string) {
        runSelectHandTargetByPlayerId(this, handIndex, targetPlayerId);
    }

    public selectRevealedTarget(index: number) {
        runSelectRevealedTarget(this, index);
    }

    private handleEffectCompletion(context: GameContext, currentPending: GameState['pendingEffect']) {
        runHandleEffectCompletion(this, context, currentPending);
    }

    private resetInteractionMode() {
        this.state.interactionMode = 'NORMAL';
        this.state.pendingEffect = null;
        this.clearPendingRuntime();
        this.assignInteractionOwner(this.getDefaultInteractionOwnerId());

        // Resume global queue
        this.effectManager.resumeQueue();

        this.finalizeEndPhaseHandAdjustmentIfReady();
    }

    private finalizeEndPhaseHandAdjustmentIfReady() {
        if (!this.awaitingEndPhaseHandAdjustment) return;
        if (this.state.interactionMode !== 'NORMAL') return;
        if (this.state.pendingEffect) return;

        this.awaitingEndPhaseHandAdjustment = false;
        this.endTurn();
    }


}
