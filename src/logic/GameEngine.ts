import { GameState, PlayerState, Phase, Card, UnitZoneState, ActivationCondition, CardType, Attribute, GameContext, Effect, TargetSchema, PendingEffect } from './types';
import { EffectManager } from './effects';
import { RuleValidator } from './RuleValidator';
import { TargetSelector } from './TargetSelector';
import { createRandomProvider, RandomProvider } from './random';

type EngineAction = import('./types').EngineAction;
type EngineObservation = import('./types').EngineObservation;

interface GameEngineOptions {
    seed?: number;
    randomProvider?: RandomProvider;
    enableMulligan?: boolean;
}

interface PendingRuntimeState {
    context: GameContext;
    effect: Effect | null;
}

export class GameEngine {
    state: GameState;
    effectManager: EffectManager;
    private readonly random: RandomProvider;
    private readonly enableMulligan: boolean;
    private readonly endPhaseHandAdjustActionType = 'END_PHASE_HAND_LIMIT_DISCARD';
    private runtimeIdCounter = 0;
    private pendingRuntime: PendingRuntimeState | null = null;
    private awaitingEndPhaseHandAdjustment = false;

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
            combatBlocked: false
        };
        this.startGame();
        this.assignInteractionOwner(this.currentPlayer.id);
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
                { unit: null, items: [], buffs: [], temporaryEffects: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false, hasActivatedEffectThisTurn: false, activatedEffectKeys: {} },
                { unit: null, items: [], buffs: [], temporaryEffects: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false, hasActivatedEffectThisTurn: false, activatedEffectKeys: {} },
                { unit: null, items: [], buffs: [], temporaryEffects: [], isExhausted: false, hasAttacked: false, hasPlacedUnitThisTurn: false, hasActivatedEffectThisTurn: false, activatedEffectKeys: {} },
            ],
            skillZone: [],
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

        this.pendingRuntime = { context, effect };

        if (effect) {
            this.state.pendingEffect.effectDescription = effect.description;
            this.state.pendingEffect.targetSchema = effect.targets;
            this.state.pendingEffect.costCardTypeFilter = effect.cost?.cardTypeFilter;
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
        return JSON.parse(
            JSON.stringify(this.state, (key, value) => {
                // Effect queue contexts contain machine back-references, which create cycles.
                if (key === 'machine') return undefined;
                return value;
            })
        );
    }

    public createSimulationFork(): GameEngine {
        if (this.pendingRuntime) {
            throw new Error('Simulation fork is unavailable while pending runtime context exists.');
        }

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
        fork.pendingRuntime = null;
        fork.assignInteractionOwner(fork.state.interactionOwnerPlayerId);

        return fork;
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
        if (this.state.winner) return [];

        const actorIds = actorPlayerId ? [actorPlayerId] : this.state.players.map(p => p.id);
        const actions: EngineAction[] = [];

        actorIds.forEach(id => {
            const actor = this.getPlayerById(id);
            if (!actor) return;
            if (!this.canActorInput(id)) return;

            if (this.state.interactionMode === 'SELECT_MULLIGAN') {
                const currentActorId = this.state.mulliganState?.pendingPlayerIds[0];
                if (!currentActorId || currentActorId !== id) return;

                actions.push({ type: 'RESOLVE_MULLIGAN', actorPlayerId: id, shouldMulligan: false });
                actions.push({ type: 'RESOLVE_MULLIGAN', actorPlayerId: id, shouldMulligan: true });
                return;
            }

            if (this.state.interactionMode === 'NORMAL') {
                if (this.state.phase === Phase.BLOCK) {
                    if (id !== this.opponentPlayer.id) return;
                    actions.push({ type: 'RESOLVE_BLOCK', actorPlayerId: id, shouldBlock: true });
                    actions.push({ type: 'RESOLVE_BLOCK', actorPlayerId: id, shouldBlock: false });
                    return;
                }

                if (id !== this.currentPlayer.id) return;

                if (RuleValidator.canEndPhase(this, actor).valid) {
                    actions.push({ type: 'NEXT_PHASE', actorPlayerId: id });
                }

                if (this.state.phase === Phase.MAIN) {
                    actor.hand.forEach((_card, handIndex) => {
                        for (let zoneIndex = 0; zoneIndex < actor.unitZones.length; zoneIndex++) {
                            if (RuleValidator.canPlayUnit(this, actor, handIndex, zoneIndex).valid) {
                                actions.push({ type: 'PLAY_UNIT', actorPlayerId: id, handIndex, zoneIndex });
                            }
                            if (RuleValidator.canPlayItem(this, actor, handIndex, zoneIndex).valid) {
                                actions.push({ type: 'PLAY_ITEM', actorPlayerId: id, handIndex, zoneIndex });
                            }
                        }

                        if (RuleValidator.canPlaySkill(this, actor, handIndex).valid) {
                            actions.push({ type: 'PLAY_SKILL', actorPlayerId: id, handIndex });
                        }
                    });
                }

                actor.unitZones.forEach((zone, zoneIndex) => {
                    if (
                        this.state.phase === Phase.ATTACK &&
                        RuleValidator.canAttack(this, actor, zoneIndex).valid
                    ) {
                        actions.push({ type: 'ATTACK', actorPlayerId: id, attackerZoneIndex: zoneIndex });
                    }

                    const unit = zone.unit;
                    if (!unit?.effects) return;
                    unit.effects.forEach((effect, effectIndex) => {
                        const activatableInPhase =
                            (effect.activation === ActivationCondition.ACTIVE && (this.state.phase === Phase.MAIN || this.state.phase === Phase.ATTACK)) ||
                            (effect.activation === ActivationCondition.ACTIVE_MAIN && this.state.phase === Phase.MAIN);
                        if (!activatableInPhase) return;

                        const effectKey = `${unit.id}_${effect.id || effectIndex}`;
                        if (zone.activatedEffectKeys?.[effectKey]) return;

                        const context: GameContext = {
                            sourceCard: unit,
                            player: actor,
                            opponent: this.getOpponentOf(actor),
                            unitZone: zone,
                            machine: this,
                        };

                        if (!this.effectManager.checkCondition(effect, context)) return;

                        if (effect.cost && effect.cost.type !== 'NONE') {
                            if (effect.cost.type === 'TRASH_HAND' || effect.cost.type === 'SHUFFLE_HAND_TO_DECK') {
                                const requiredAmount = effect.cost.amount || 1;
                                const costFilter = effect.cost.cardTypeFilter;
                                const payableCount = actor.hand.filter(card => !costFilter || card.type === costFilter).length;
                                if (payableCount < requiredAmount) return;
                            }
                        }

                        if (effect.targets && effect.targets.selectMode === 'MANUAL') {
                            const candidates = TargetSelector.resolve(this, effect.targets, context);
                            if (candidates.length === 0) return;
                        }

                        actions.push({ type: 'ACTIVATE_EFFECT', actorPlayerId: id, zoneIndex, effectIndex });
                    });
                });

                return;
            }

            const pending = this.state.pendingEffect;
            if (!pending) return;

            if (this.state.interactionMode === 'SELECT_OPTIONAL') {
                actions.push({ type: 'RESOLVE_OPTIONAL', actorPlayerId: id, confirm: true });
                actions.push({ type: 'RESOLVE_OPTIONAL', actorPlayerId: id, confirm: false });
                return;
            }

            if (this.state.interactionMode === 'SELECT_COST') {
                const payer = this.getPlayerById(pending.sourcePlayerId) ?? actor;
                if (payer.id !== id) return;
                const payableHandIndexes = this.getPayableHandIndexesForCost(payer, pending.costToPay ?? {
                    type: 'TRASH_HAND',
                    amount: 1,
                    cardTypeFilter: pending.costCardTypeFilter
                } as any);
                payableHandIndexes.forEach(handIndex => {
                    actions.push({ type: 'SELECT_COST_HAND', actorPlayerId: id, handIndex });
                });
                return;
            }

            if (this.state.interactionMode !== 'SELECT_TARGET') return;

            const runtime = this.getPendingRuntime();
            const context = runtime?.context;
            const targetSchema = pending.targetSchema;
            if (!context || !targetSchema) return;

            const needsConfirm =
                (targetSchema.count ?? 1) !== 1 ||
                targetSchema.selectMode === 'ALL' ||
                pending.actionType === 'TAKE_ALL_REVEALED';
            const selectedTargets = pending.selectedTargets ?? [];
            const requiredCount = targetSchema.count ?? 1;

            const shouldAllowConfirm = (candidateTargets: any[]): boolean => {
                if (!needsConfirm) {
                    // Single-target manual selection can become impossible due state changes.
                    return candidateTargets.length === 0;
                }
                if (targetSchema.selectMode === 'ALL' || pending.actionType === 'TAKE_ALL_REVEALED') return true;
                if (requiredCount <= 0) return true;

                const selectedCount = selectedTargets.length;
                if (selectedCount >= requiredCount) return true;

                // Rule 1.3.2: if remaining valid targets cannot fill the requirement, allow partial confirm.
                const remainingSelectableCount = candidateTargets.filter(target => !selectedTargets.includes(target)).length;
                return selectedCount + remainingSelectableCount < requiredCount;
            };

            if (pending.validTargets === 'MY_TRASH') {
                const targetPlayerId = pending.sourcePlayerId;
                const targetPlayer = this.getPlayerById(targetPlayerId);
                if (!targetPlayer) return;
                const selectableTrashCards: any[] = [];
                targetPlayer.trash.forEach((card, trashIndex) => {
                    if (!TargetSelector.isValidTarget(this, targetSchema, context, card)) return;
                    selectableTrashCards.push(card);
                    actions.push({ type: 'SELECT_TRASH_TARGET', actorPlayerId: id, targetPlayerId, trashIndex });
                });
                if (shouldAllowConfirm(selectableTrashCards)) {
                    actions.push({ type: 'CONFIRM_TARGETS', actorPlayerId: id });
                }
                return;
            }

            if (pending.validTargets === 'REVEALED') {
                const selectableRevealedCards: any[] = [];
                this.state.revealedCards.forEach((card, revealedIndex) => {
                    if (!TargetSelector.isValidTarget(this, targetSchema, context, card)) return;
                    selectableRevealedCards.push(card);
                    actions.push({ type: 'SELECT_REVEALED_TARGET', actorPlayerId: id, revealedIndex });
                });
                if (shouldAllowConfirm(selectableRevealedCards)) {
                    actions.push({ type: 'CONFIRM_TARGETS', actorPlayerId: id });
                }
                return;
            }

            if (pending.validTargets === 'MY_HAND' || pending.validTargets === 'OPP_HAND' || pending.validTargets === 'LAST_DRAWN') {
                const targetPlayerId =
                    pending.validTargets === 'OPP_HAND'
                        ? (context?.opponent?.id ?? this.getOpponentOf(this.getPlayerById(pending.sourcePlayerId) ?? this.currentPlayer).id)
                        : (context?.player?.id ?? pending.sourcePlayerId);

                const targetPlayer = this.getPlayerById(targetPlayerId);
                if (!targetPlayer) return;

                const selectableHandCards: any[] = [];
                targetPlayer.hand.forEach((card, handIndex) => {
                    if (!TargetSelector.isValidTarget(this, targetSchema, context, card)) return;
                    selectableHandCards.push(card);
                    actions.push({ type: 'SELECT_HAND_TARGET', actorPlayerId: id, targetPlayerId, handIndex });
                });
                if (shouldAllowConfirm(selectableHandCards)) {
                    actions.push({ type: 'CONFIRM_TARGETS', actorPlayerId: id });
                }
                return;
            }

            const selectableZones: UnitZoneState[] = [];
            this.state.players.forEach(targetPlayer => {
                targetPlayer.unitZones.forEach((targetZone, zoneIndex) => {
                    if (TargetSelector.isValidTarget(this, targetSchema, context, targetZone)) {
                        selectableZones.push(targetZone);
                        actions.push({ type: 'SELECT_ZONE_TARGET', actorPlayerId: id, targetPlayerId: targetPlayer.id, zoneIndex });
                    }
                });
            });
            if (shouldAllowConfirm(selectableZones)) {
                actions.push({ type: 'CONFIRM_TARGETS', actorPlayerId: id });
            }
        });

        return actions;
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
                this.activateEffect(action.zoneIndex, action.effectIndex);
                return true;
            case 'ATTACK':
                if (action.actorPlayerId !== this.currentPlayer.id) return false;
                this.attack(action.attackerZoneIndex);
                return true;
            case 'RESOLVE_BLOCK':
                if (this.state.phase !== Phase.BLOCK) return false;
                if (action.actorPlayerId !== this.opponentPlayer.id) return false;
                this.resolveBlock(action.shouldBlock);
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

    drawCard(playerIndex: number, count: number = 1): Card[] {
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
        // Reset per-turn flags
        this.currentPlayer.unitZones.forEach(z => {
            z.hasAttacked = false;
            z.isExhausted = false;
            z.hasPlacedUnitThisTurn = false;
            z.hasActivatedEffectThisTurn = false;
            z.activatedEffectKeys = {};
        });

        // Switch
        this.state.turnPlayerIndex = this.state.turnPlayerIndex === 0 ? 1 : 0;
        this.state.turnCount++;
        this.assignInteractionOwner(this.currentPlayer.id);
        this.enterPhase(Phase.LEVEL_UP); // Correctly enter next phase

        // Reset once-per-turn effects
        (this.state as any).firedEffects = {};

        // Process delayed actions (Legacy support, maybe merge into TURN_END effects?)
        this.processDelayedActions();
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

        // Trigger Entry Effects
        this.effectManager.processEffects(ActivationCondition.ENTRY, {
            sourceCard: card,
            player: this.currentPlayer,
            opponent: this.opponentPlayer,
            unitZone: zone,
            machine: this
        });
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

    activateEffect(zoneIndex: number, effectIndex: number) {
        const zone = this.currentPlayer.unitZones[zoneIndex];
        const card = zone.unit;
        if (!card || !card.effects) return;

        const effect = card.effects[effectIndex];
        if (effect.activation !== ActivationCondition.ACTIVE && effect.activation !== ActivationCondition.ACTIVE_MAIN) return;

        if (effect.activation === ActivationCondition.ACTIVE_MAIN && this.state.phase !== Phase.MAIN) {
            return;
        }
        if (effect.activation === ActivationCondition.ACTIVE && this.state.phase !== Phase.MAIN && this.state.phase !== Phase.ATTACK) {
            return;
        }

        const effectKey = `${card.id}_${effect.id || effectIndex}`;
        if (zone.activatedEffectKeys[effectKey]) return;

        const context = {
            sourceCard: card,
            player: this.currentPlayer,
            opponent: this.opponentPlayer,
            unitZone: zone,
            machine: this
        };

        if (this.effectManager.processEffect(effect, context)) {
            zone.activatedEffectKeys[effectKey] = true;
            zone.hasActivatedEffectThisTurn = true;
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
            costToPay: effect.cost,
            costCardTypeFilter: effect.cost?.cardTypeFilter,
            costPaidCount: 0
        };
        this.setPendingRuntime(context, effect);
        this.assignInteractionOwner(controllerPlayerId);

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
            effectDescription: effect.description
        };
        this.setPendingRuntime(context, effect);
        this.assignInteractionOwner(controllerPlayerId);
        console.log("Entered Optional Selection Mode for " + context.sourceCard.name);
    }

    resolveOptionalEffect(confirm: boolean) {
        if (this.state.interactionMode !== 'SELECT_OPTIONAL' || !this.state.pendingEffect) return;

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

        if (pending.actionType === 'DESTROY_UNIT_WITH_HIT_COST') {
            const targetZone = pending.selectedTargets?.[0];
            if (targetZone && targetZone.unit) {
                const owner = this.state.players.find(p => p.unitZones.includes(targetZone));
                if (owner) {
                    const targetName = targetZone.unit.name;
                    this.destroyUnit(owner, targetZone);
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
            const owner = this.getPlayerById(pending.sourcePlayerId) ?? this.currentPlayer;
            const zone = owner.unitZones[zoneIndex];
            (zone as any)._attackCostPaid = true;
            this.resetInteractionMode();
            if (owner.id === this.currentPlayer.id) {
                this.attack(zoneIndex); // Resume attack
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
            validTargets: this.mapScopeToValidTargets(targetSchema.scope),
            targetSchema,
            selectedTargets: []
        };
        this.setPendingRuntime(context, effect);
        this.assignInteractionOwner(controllerPlayerId);

        console.log("Entered Selection Mode for " + context.sourceCard.name);
    }

    attack(attackerZoneIndex: number) {
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
            }, attackerZoneIndex);
            if (started) return;
            return;
        }

        this.state.attackTerminated = false;
        // Combat block state is per-combat. Reset to avoid leaking prior combat results.
        this.state.combatBlocked = false;
        (attackerZone as any)._attackCostPaid = false; // Reset for next time
        attackerZone.hasAttacked = true;

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

        // Better: Check queue size. If 0, advance interactively.
        if (this.state.effectQueue.length === 0) {
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
        const attackerZone = this.currentPlayer.unitZones[this.state.pendingAttackerIndex!];

        switch (this.state.combatStep) {
            case 'ATTACK_DECLARATION':
                // Proceed to Defense Declaration
                this.stepDefenseDeclaration(attackerZone);
                break;
            case 'DEFENSE_DECLARATION':
                // Proceed to Battle Resolution
                this.stepBattleResolution(attackerZone);
                break;
            case 'BATTLE':
                // Proceed to Battle End
                this.stepBattleEnd();
                break;
            case 'BATTLE_END':
                // End Combat
                this.state.combatStep = 'NONE';
                this.state.pendingAttackerIndex = null;
                this.state.phase = Phase.ATTACK; // Return to Attack Available
                this.assignInteractionOwner(this.currentPlayer.id);
                break;
        }
    }

    private stepDefenseDeclaration(attackerZone: UnitZoneState) {
        this.state.combatStep = 'DEFENSE_DECLARATION';
        const attackerZoneIndex = this.state.players[this.state.turnPlayerIndex].unitZones.indexOf(attackerZone);

        // 1. Check BREAKTHROUGH
        const blockerZoneIndex = attackerZoneIndex;
        const blockerZone = this.opponentPlayer.unitZones[blockerZoneIndex];

        let breakthroughActive = false;
        if (blockerZone.unit) {
            const limit = this.getBreakthroughLimit(attackerZone);
            if (limit !== null && blockerZone.unit.cost <= limit) {
                console.log(`BREAKTHROUGH active. Skipping Block phase.`);
                breakthroughActive = true;
            }
        }

        if (breakthroughActive || !blockerZone.unit) {
            // Direct Attack or Breakthrough -> Skip Blocking
            this.state.combatBlocked = false;
            this.assignInteractionOwner(this.currentPlayer.id);
            this.advanceCombatStep(); // Go directly to BATTLE
            return;
        }

        // 2. Encounter Unit exists -> Potential Block
        this.state.phase = Phase.BLOCK;
        this.assignInteractionOwner(this.opponentPlayer.id);
        // Wait for user input (resolveBlock)
        console.log("Waiting for Block Declaration...");

        // NOTE: guardian/auto-block logic would go here if implemented
        // For now, we wait for Manual Block (UI calls resolveBlock)
    }

    private stepBattleResolution(attackerZone: UnitZoneState) {
        this.state.combatStep = 'BATTLE';
        const blockerZoneIndex = this.state.players[this.state.turnPlayerIndex].unitZones.indexOf(attackerZone);
        const blockerZone = this.opponentPlayer.unitZones[blockerZoneIndex];

        // 1. Check Attack Terminated
        if (this.state.attackTerminated) {
            console.log("Attack Terminated during resolution.");
            this.advanceCombatStep();
            return;
        }

        // 2. Pre-Combat Effects? (e.g. Infiltration)
        // INFILTRATION (Rule 10.2.3.1): If Infiltration & No Blocker -> Draw 1
        // Wait, Proposal says "Pre-Combat Effect".
        if (!this.state.combatBlocked && (this.hasKeywordInZone(attackerZone, '침투') || this.hasKeywordInZone(attackerZone, 'INFILTRATION'))) {
            console.log("Infiltration Triggered.");
            this.drawCard(this.state.turnPlayerIndex, 1);
        }

        // 3. Resolution
        // 3. Resolution
        if (this.state.combatBlocked && blockerZone.unit) {
            // Combat Resolution
            const attPower = this.getUnitPower(attackerZone, this.currentPlayer);
            const blkPower = this.getUnitPower(blockerZone, this.opponentPlayer);
            console.log(`Combat! Attacker Power: ${attPower}, Blocker Power: ${blkPower}`);

            if (attPower >= blkPower) {
                // IMPORTANT: Destroy first, THEN queue result effects. 
                // Currently destroyUnit triggers EXIT effects (queued).
                // Proposal says Result Effects (Penetration, Plunder) should be queued AFTER kill.
                this.destroyUnit(this.opponentPlayer, blockerZone, attackerZone.unit || undefined);

                // PENETRATION (Rule 10.2.3.2)
                const penValue = this.getPenetrationValue(attackerZone);
                if (penValue > 0) {
                    console.log("[Combat] Queuing PENETRATION Effect");
                    // Create ephemeral effect
                    const penEffect: any = {
                        activation: 'AUTO_RESOLVED_COMBAT' as any, // Pseudo-condition or use ATTACKER
                        action: { type: 'DAMAGE', params: { value: penValue } },
                        description: `Penetration Damage: ${penValue}`,
                        id: this.createRuntimeId('PEN')
                    };
                    // Queue it directly? Or use processEffects with source?
                    // Use processEffects with a custom activation? 
                    // Let's manually queue it using internal logic or a helper to ensure it's a "New Stamp".
                    // Actually, if we use effectManager.processEffects with a custom activation, it creates a new timestamp.
                    // But these effects belong to the ATTACKING UNIT.

                    // Let's use a new activation 'COMBAT_RESULT' or generic 'AUTO'?
                    // For now, let's inject it into the queue directly to force it as a NEW timestamp,
                    // OR add a "One-shot" effect to the unit and trigger it?
                    // Simplest: Create a dummy effect object and use effectManager.processEffects with a special condition.
                    // BUT processEffects filters by card effects. The unit doesn't have this effect explicitly.

                    // ALTERNATIVE: Use `effectManager.executeEffects` directly? 
                    // NO, we need it in the QUEUE.

                    // We must expose a method to "Queue Single Effect Immediately"
                    this.effectManager.queueEphemeralEffect(penEffect, {
                        sourceCard: attackerZone.unit!,
                        player: this.currentPlayer,
                        opponent: this.opponentPlayer,
                        machine: this
                    });
                }

                // PLUNDER (Rule 10.2.3.3)
                const pluValue = this.getPlunderValue(attackerZone);
                if (pluValue > 0) {
                    console.log("[Combat] Queuing PLUNDER Effect");
                    const pluEffect: any = {
                        activation: 'AUTO_RESOLVED_COMBAT' as any,
                        action: { type: 'DRAW', params: { count: pluValue } },
                        description: `Plunder Draw: ${pluValue}`,
                        id: this.createRuntimeId('PLU')
                    };
                    this.effectManager.queueEphemeralEffect(pluEffect, {
                        sourceCard: attackerZone.unit!,
                        player: this.currentPlayer,
                        opponent: this.opponentPlayer,
                        machine: this
                    });
                }
            }

            if (blkPower > attPower) {
                this.destroyUnit(this.currentPlayer, attackerZone, blockerZone.unit || undefined);
            }
        } else {
            // Direct Damage
            this.dealDamage(this.opponentPlayer, this.getUnitHit(attackerZone, this.currentPlayer));
        }

        // Queue might have new effects (Destruction triggers).
        // If queue empty, advance to End.
        if (this.state.effectQueue.length === 0) {
            this.advanceCombatStep();
        }
    }

    private stepBattleEnd() {
        this.state.combatStep = 'BATTLE_END';
        this.clearBattleScopedEffects();

        if (this.state.effectQueue.length === 0) {
            this.advanceCombatStep();
        }
    }

    private clearBattleScopedEffects() {
        this.state.players.forEach(player => {
            player.unitZones.forEach(zone => {
                zone.buffs = zone.buffs.filter(buff => buff.duration !== 'BATTLE_END');
                zone.temporaryEffects = zone.temporaryEffects.filter(effect => effect.duration !== 'BATTLE_END');
            });
        });
    }

    resolveBlock(shouldBlock: boolean) {
        if (this.state.phase !== Phase.BLOCK || this.state.pendingAttackerIndex === null) return;

        const attackerZoneIndex = this.state.pendingAttackerIndex;
        const attackerZone = this.currentPlayer.unitZones[attackerZoneIndex];

        const blockerZoneIndex = attackerZoneIndex;
        const blockerZone = this.opponentPlayer.unitZones[blockerZoneIndex];

        // CHECK BREAKTHROUGH (Fallback check)
        if (shouldBlock && blockerZone.unit) {
            const limit = this.getBreakthroughLimit(attackerZone);
            if (limit !== null && blockerZone.unit.cost <= limit) {
                console.log(`Block prevented by BREAKTHROUGH (Cost ${blockerZone.unit.cost} <= ${limit})`);
                shouldBlock = false; // Force no block
            }
        }

        // DUALIST (Rule 10.2.3.5.3)
        const isDualist = attackerZone.unit && this.hasKeyword(attackerZone.unit, 'DUALIST');
        let finalShouldBlock = shouldBlock;
        if (isDualist && blockerZone.unit) {
            finalShouldBlock = true; // Forced block
        }

        if (finalShouldBlock && blockerZone.unit) {
            // Trigger DEFENDER effects as one simultaneous event.
            const defenderBatchStep = this.incrementAndGetGlobalStep();
            this.effectManager.processEffects(ActivationCondition.DEFENDER, {
                sourceCard: blockerZone.unit,
                player: this.opponentPlayer,
                opponent: this.currentPlayer,
                unitZone: blockerZone,
                machine: this
            }, { enqueueOnly: true, batchStep: defenderBatchStep });

            blockerZone.items.forEach(item => {
                this.effectManager.processEffects(ActivationCondition.DEFENDER, {
                    sourceCard: item,
                    player: this.opponentPlayer,
                    opponent: this.currentPlayer,
                    unitZone: blockerZone,
                    machine: this
                }, { enqueueOnly: true, batchStep: defenderBatchStep });
            });
            this.effectManager.processQueue();

            // Mark blocking happened? Actually, the presence of blockerZone.unit implies blocking capability,
            // but we need to know if the player CHOSE to block.
            // If they chose NOT to block, we should probably pretend the unit isn't there for combat??
            // Wait, Nivel Arena rules: Encounter unit blocks logic or direct attack logic?
            // "Manual Block: If there is no Guardian, the opponent decides whether to defend with the encounter unit."
            // If they decide NOT to defend, what happens? "Attack Unit's Hit -> Player Damage".
            // So if !finalShouldBlock, we treat it as unblocked even if unit is there because of Encounter logic.

            // CRITICAL FIX: If user chose NOT to block, we must clear the 'blockerZone.unit' from the combat equation momentarily?
            // No, we just need to pass a flag to stepBattleResolution. 
            // BUT stepBattleResolution looks at `blockerZone.unit`.
            // We need a robust way to say "This combat is unblocked".
            // Let's set a temporary state on the engine? `this.state.isCombatBlocked`.

            this.state.combatBlocked = true;

        } else {
            this.state.combatBlocked = false;
        }

        this.assignInteractionOwner(this.currentPlayer.id);

        // Advance to next step (Battle Resolution)
        // If effects were added, queue runs. If not, manual advance.
        if (this.state.effectQueue.length === 0) {
            this.advanceCombatStep();
        }
    }


    private hasKeyword(card: Card, keyword: string): boolean {
        return card.keywords?.includes(keyword) || false;
    }

    private getBreakthroughLimit(zone: UnitZoneState): number | null {
        if (!zone.unit) return null;
        let maxLimit: number | null = null;

        // 1. Check Unit Effects
        if (zone.unit.effects) {
            zone.unit.effects.forEach(e => {
                if (e.activation === ActivationCondition.ATTACKER && e.action.type === 'BREAKTHROUGH') {
                    const limit = e.action.params.costMax;
                    if (limit !== undefined) {
                        if (maxLimit === null || limit > maxLimit) maxLimit = limit;
                    }
                }
            });
        }

        // 2. Check Item Effects
        zone.items.forEach(item => {
            if (item.effects) {
                item.effects.forEach(e => {
                    if (e.activation === ActivationCondition.ATTACKER && e.action.type === 'BREAKTHROUGH') {
                        const limit = e.action.params.costMax;
                        if (limit !== undefined) {
                            if (maxLimit === null || limit > maxLimit) maxLimit = limit;
                        }
                    }
                });
            }
        });

        // 3. Check Temporary Effects
        zone.temporaryEffects.forEach(effect => {
            if (effect.action && effect.action.type === 'BREAKTHROUGH') {
                const limit = effect.action.params.costMax;
                if (limit !== undefined) {
                    if (maxLimit === null || limit > maxLimit) maxLimit = limit;
                }
            }
        });

        return maxLimit;
    }

    private getPenetrationValue(zone: UnitZoneState): number {
        if (!zone.unit) return 0;
        let value = 0;

        if (this.hasKeywordInZone(zone, '관통') || this.hasKeywordInZone(zone, 'PENETRATION')) {
            value = Math.max(value, zone.unit.hit || 0);
        }

        // 2. Buffs (from explicitly called PENETRATION actions)
        zone.buffs.forEach(b => {
            if (b.type === 'PENETRATION') value = Math.max(value, b.value);
        });

        return value;
    }

    private getPlunderValue(zone: UnitZoneState): number {
        if (!zone.unit) return 0;
        let value = 0;

        if (this.hasKeywordInZone(zone, '약탈') || this.hasKeywordInZone(zone, 'PLUNDER')) {
            value = Math.max(value, 1);
        }

        zone.buffs.forEach(b => {
            if (b.type === 'PLUNDER') value = Math.max(value, b.value);
        });

        return value;
    }

    private hasKeywordInZone(zone: UnitZoneState, keyword: string): boolean {
        if (!zone.unit) return false;

        // Check Unit
        if (this.hasKeyword(zone.unit, keyword)) return true;

        // Check Items
        if (zone.items.some(item => this.hasKeyword(item, keyword))) return true;

        // Check Temporary Effects (which might grant the keyword)
        if (zone.temporaryEffects.some(effect => effect.description.includes(keyword))) return true;

        return false;
    }

    private processPassiveGrantedExitEffects(
        destroyedOwner: PlayerState,
        destroyedZone: UnitZoneState,
        destroyedUnit: Card,
        killerCard?: Card
    ) {
        this.state.players.forEach(sourceOwner => {
            const sourceOpponent = sourceOwner === this.state.players[0] ? this.state.players[1] : this.state.players[0];
            const sources: { card: Card; zone?: UnitZoneState }[] = [];

            sourceOwner.unitZones.forEach(sourceZone => {
                if (sourceZone.unit) sources.push({ card: sourceZone.unit, zone: sourceZone });
                sourceZone.items.forEach(item => sources.push({ card: item, zone: sourceZone }));
            });
            if (sourceOwner.levelZone) sources.push({ card: sourceOwner.levelZone });

            sources.forEach(source => {
                if (!source.card.effects) return;
                source.card.effects.forEach(passive => {
                    if (passive.activation !== ActivationCondition.PASSIVE) return;
                    if (passive.action?.type !== 'GRANT_EFFECT') return;

                    const granted = passive.action?.params?.effect;
                    if (!granted || granted.activation !== ActivationCondition.EXIT) return;

                    const sourceContext: GameContext = {
                        player: sourceOwner,
                        opponent: sourceOpponent,
                        sourceCard: source.card,
                        unitZone: source.zone,
                        machine: this
                    };

                    if (!this.effectManager.checkCondition(passive, sourceContext)) return;
                    if (passive.targets && !TargetSelector.isValidTarget(this, passive.targets, sourceContext, destroyedZone)) return;

                    const grantedContext: GameContext = {
                        player: destroyedOwner,
                        opponent: destroyedOwner === this.state.players[0] ? this.state.players[1] : this.state.players[0],
                        sourceCard: destroyedUnit,
                        unitZone: destroyedZone,
                        machine: this,
                        destroyedBy: killerCard
                    };

                    this.effectManager.executeEffect(granted, grantedContext, [destroyedZone]);
                });
            });
        });
    }

    public destroyUnit(player: PlayerState, zone: UnitZoneState, killerCard?: Card) {
        if (!zone.unit) return;

        const unit = zone.unit;
        const opponent = this.getOpponentOf(player);

        // Apply passive "grant EXIT effect" auras before removing the unit from the zone.
        this.processPassiveGrantedExitEffects(player, zone, unit, killerCard);

        // Remove from zone first to avoid recursive state inconsistencies while effects resolve.
        zone.unit = null;

        // 1) Queue EXIT effects in a single batch.
        const exitBatchStep = this.incrementAndGetGlobalStep();
        this.effectManager.processEffects(ActivationCondition.EXIT, {
            sourceCard: unit,
            player: player,
            opponent: opponent,
            unitZone: zone,
            machine: this,
            destroyedBy: killerCard
        }, { enqueueOnly: true, batchStep: exitBatchStep });

        zone.items.forEach(item => {
            this.effectManager.processEffects(ActivationCondition.EXIT, {
                sourceCard: item,
                player: player,
                opponent: opponent,
                unitZone: zone,
                machine: this,
                destroyedBy: killerCard,
                trashedUnit: unit
            }, { enqueueOnly: true, batchStep: exitBatchStep });
        });

        // 2) Move cards to trash and clear lane state.
        player.trash.push(unit);
        const trashedUnit = unit;
        zone.items.forEach(i => player.trash.push(i));
        zone.items = [];
        zone.buffs = [];
        zone.temporaryEffects = [];

        // 3) Queue UNIT_TRASHED effects as one simultaneous event in turn-player priority order.
        const trashedBatchStep = this.incrementAndGetGlobalStep();
        const [turnPlayer, nonTurnPlayer] = this.getPlayersInTurnOrder();
        [turnPlayer, nonTurnPlayer].forEach(p => {
            const sourceOpponent = this.getOpponentOf(p);

            if (p.levelZone) {
                this.effectManager.processEffects(ActivationCondition.UNIT_TRASHED, {
                    sourceCard: p.levelZone,
                    player: p,
                    opponent: sourceOpponent,
                    machine: this,
                    trashedUnit: trashedUnit,
                    trashedUnitOwner: player
                }, { enqueueOnly: true, batchStep: trashedBatchStep });
            }

            p.unitZones.forEach(z => {
                if (!z.unit) return;
                this.effectManager.processEffects(ActivationCondition.UNIT_TRASHED, {
                    sourceCard: z.unit,
                    player: p,
                    opponent: sourceOpponent,
                    unitZone: z,
                    machine: this,
                    trashedUnit: trashedUnit,
                    trashedUnitOwner: player
                }, { enqueueOnly: true, batchStep: trashedBatchStep });
            });
        });

        this.effectManager.processQueue();
    }

    public checkRuleProcessing() {
        this.state.players.forEach(player => {
            player.unitZones.forEach((zone) => {
                if (zone.unit) {
                    const power = this.getUnitPower(zone, player);
                    if (power <= 0) {
                        console.log(`Rule Processing: Trashing ${zone.unit.name} due to 0 or less ATK (${power})`);
                        this.destroyUnit(player, zone);
                    }
                }
            });
        });
    }

    public initiateAttackCostSelection(effect: Effect, context: GameContext, attackerZoneIndex: number): boolean {
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
            actionValue: { attackerZoneIndex },
            effectDescription: effect.description,
            costToPay: effect.cost || { type: 'TRASH_HAND', amount: 1 },
            costCardTypeFilter: effect.cost?.cardTypeFilter,
            selectedTargets: []
        };
        this.setPendingRuntime(context, effect);
        this.assignInteractionOwner(controllerPlayerId);
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

                // 4.5.4.3. Check for Damage Triggers
                const wasTriggered = this.effectManager.processEffects(ActivationCondition.DAMAGE_TRIGGER, {
                    sourceCard: card,
                    player: player,
                    opponent: opponent,
                    machine: this
                });

                if (wasTriggered) {
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

        // Leader Passive Size Bonus (e.g. ST02-001)
        if (player.levelZone && player.levelZone.effects) {
            player.levelZone.effects.forEach(effect => {
                if (effect.activation === ActivationCondition.PASSIVE && effect.action.type === 'MODIFY_PLAYER_SIZE') {
                    // Check awakening condition if applicable
                    // let conditionMet = true;
                    if (player.levelZone?.isAwakened) {
                        // For ST02-001, the bonus is on the awakened side
                        size += (effect.action.params.value || 0);
                    }
                }
            });
        }

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
                            hit += (params.value || 0);
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
        if (this.state.interactionMode !== 'SELECT_TARGET' || !this.state.pendingEffect) return;

        // This logic handles the manual selection input from the UI
        const pending = this.state.pendingEffect;
        const runtime = this.getPendingRuntime();
        const effect = runtime?.effect;
        const context = runtime?.context;
        const targetSchema = pending.targetSchema;
        if (!effect || !context || !targetSchema) return;
        const targetPlayer = this.getPlayerById(targetPlayerId);
        if (!targetPlayer) return;
        if (zoneIndex < 0 || zoneIndex >= targetPlayer.unitZones.length) return;
        const targetZone = targetPlayer.unitZones[zoneIndex];
        const scope = targetSchema.scope;

        // NEW: Full validation using TargetSelector
        if (!TargetSelector.isValidTarget(this, targetSchema, context, targetZone)) {
            console.log("Invalid Target Selected. Mode maintained.");
            return;
        }

        // Shared Lane validation (extra layer for clarity, though isValidTarget covers it)
        if (scope === 'SHARED_LANE') {
            const myUnit = context.player.unitZones[zoneIndex]?.unit;
            const oppUnit = context.opponent.unitZones[zoneIndex]?.unit;
            if (!myUnit || !oppUnit) {
                console.log("Invalid Target: Lane is not shared.");
                return;
            }
        }


        // If everything good, execute
        if (effect.action.type === 'DESTROY_LANE_LOWEST') {
            context.selectedLaneIndex = zoneIndex;
        }

        // Multi-target logic
        const maxCount = targetSchema.count || 1;
        const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
        if (maxCount > 1) {
            if (!selectedTargets.includes(targetZone)) {
                if (selectedTargets.length >= maxCount) {
                    console.log(`Cannot select more than ${maxCount} targets.`);
                    return;
                }
                selectedTargets.push(targetZone);
                console.log(`Target added. ${selectedTargets.length}/${maxCount}`);
            } else {
                pending.selectedTargets = selectedTargets.filter((t: any) => t !== targetZone);
                console.log(`Target removed. ${(pending.selectedTargets ?? []).length}/${maxCount}`);
            }
            // Do not execute yet. Wait for Confirm.
            return;
        } else {
            // Single target behavior: Execute immediately
            this.effectManager.executeEffect(effect, context, [targetZone]);
            this.handleEffectCompletion(context, pending);
        }
    }

    public confirmTargets() {
        if (this.state.interactionMode !== 'SELECT_TARGET' || !this.state.pendingEffect) return;

        const pending = this.state.pendingEffect;
        const runtime = this.getPendingRuntime();
        const effect = runtime?.effect;
        const context = runtime?.context;
        const targetSchema = pending.targetSchema;
        if (!effect || !context || !targetSchema) return;

        // Validation - can be empty if no valid targets were found among revealed

        // Special logic for PICK_REVEALED
        if (pending.actionType === 'PICK_REVEALED') {
            const player = this.state.players.find(p => p.id === pending.sourcePlayerId);
            if (player) {
                (pending.selectedTargets ?? []).forEach((card: any) => {
                    const idx = this.state.revealedCards.indexOf(card);
                    if (idx !== -1) {
                        player.hand.push(card);
                        this.state.revealedCards.splice(idx, 1);
                    }
                });
                // Shuffle rest back
                if (this.state.revealedCards.length > 0) {
                    player.deck.push(...this.state.revealedCards);
                    this.shuffle(player.deck);
                }
            }
            this.state.revealedCards = [];
        }

        // SPECIAL LOGIC for TAKE_ALL_REVEALED (VIP Gift)
        if (pending.actionType === 'TAKE_ALL_REVEALED') {
            const player = this.state.players.find(p => p.id === pending.sourcePlayerId);
            if (player) {
                const candidates = TargetSelector.resolve(this, targetSchema, context);
                candidates.forEach(card => {
                    const idx = this.state.revealedCards.indexOf(card);
                    if (idx !== -1) {
                        player.hand.push(card);
                        this.state.revealedCards.splice(idx, 1);
                    }
                });
                // Shuffle rest back
                if (this.state.revealedCards.length > 0) {
                    player.deck.push(...this.state.revealedCards);
                    this.shuffle(player.deck);
                }
            }
            this.state.revealedCards = [];
        }

        // Execute Effect via Manager
        this.effectManager.executeEffect(effect, context, pending.selectedTargets ?? []);

        this.handleEffectCompletion(context, pending);
    }

    public selectTrashTarget(trashIndex: number, targetPlayerId?: string) {
        if (this.state.interactionMode !== 'SELECT_TARGET' || !this.state.pendingEffect) return;

        const pending = this.state.pendingEffect;
        const runtime = this.getPendingRuntime();
        const effect = runtime?.effect;
        const context = runtime?.context;
        const targetSchema = pending.targetSchema;
        if (!effect || !context || !targetSchema) return;
        // Verify scope is MY_TRASH
        if (pending.validTargets !== 'MY_TRASH') {
            console.log("Invalid Target: Expected Trash selection.");
            return;
        }

        // Use the effect source player's trash, not the current turn player's trash
        // This is important for trigger effects that activate on opponent's turn
        const expectedPlayerId = pending.sourcePlayerId;
        if (targetPlayerId && targetPlayerId !== expectedPlayerId) return;
        const player = this.state.players.find(p => p.id === expectedPlayerId);
        if (!player) {
            console.log("Source player not found for trash selection.");
            return;
        }
        if (trashIndex < 0 || trashIndex >= player.trash.length) return;
        const card = player.trash[trashIndex];

        // Validate with TargetSelector
        if (!TargetSelector.isValidTarget(this, targetSchema, context, card)) {
            console.log("Invalid Trash Target Selected.");
            return;
        }

        // Multi-target logic for trash
        const maxCount = targetSchema.count || 1;
        const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
        if (maxCount > 1) {
            if (!selectedTargets.includes(card)) {
                if (selectedTargets.length >= maxCount) {
                    console.log(`Cannot select more than ${maxCount} targets.`);
                    return;
                }
                selectedTargets.push(card);
            } else {
                pending.selectedTargets = selectedTargets.filter((t: any) => t !== card);
            }
        } else {
            // Execute
            this.effectManager.executeEffect(effect, context, [card]);
            this.handleEffectCompletion(context, pending);
        }
    }

    public selectHandTarget(handIndex: number, isOpponentHand: boolean) {
        const targetPlayerId = isOpponentHand ? this.opponentPlayer.id : this.currentPlayer.id;
        this.selectHandTargetByPlayerId(handIndex, targetPlayerId);
    }

    public selectHandTargetByPlayerId(handIndex: number, targetPlayerId: string) {
        if (this.state.interactionMode !== 'SELECT_TARGET' || !this.state.pendingEffect) return;

        const pending = this.state.pendingEffect;
        const runtime = this.getPendingRuntime();
        const effect = runtime?.effect;
        const context = runtime?.context;
        const targetSchema = pending.targetSchema;
        if (!effect || !context || !targetSchema) return;

        const targetPlayer = this.getPlayerById(targetPlayerId);
        if (!targetPlayer) return;
        if (handIndex < 0 || handIndex >= targetPlayer.hand.length) return;

        const targetCard = targetPlayer.hand[handIndex];

        // Validate
        if (!TargetSelector.isValidTarget(this, targetSchema, context, targetCard)) {
            console.log("Invalid Hand Target Selected.");
            return;
        }

        // Multi-target logic for hand
        const maxCount = targetSchema.count || 1;
        const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
        if (maxCount > 1) {
            if (!selectedTargets.includes(targetCard)) {
                if (selectedTargets.length >= maxCount) {
                    console.log(`Cannot select more than ${maxCount} targets.`);
                    return;
                }
                selectedTargets.push(targetCard);
            } else {
                pending.selectedTargets = selectedTargets.filter((t: any) => t !== targetCard);
            }
        } else {
            // Execute Effect via Manager
            this.effectManager.executeEffect(effect, context, [targetCard]);

            this.handleEffectCompletion(context, pending);
        }
    }

    public selectRevealedTarget(index: number) {
        if (this.state.interactionMode !== 'SELECT_TARGET' || !this.state.pendingEffect) return;
        if (index < 0 || index >= this.state.revealedCards.length) return;

        const pending = this.state.pendingEffect;
        const runtime = this.getPendingRuntime();
        const effect = runtime?.effect;
        const context = runtime?.context;
        const targetSchema = pending.targetSchema;
        if (!effect || !context || !targetSchema) return;
        if (pending.validTargets !== 'REVEALED') return;

        const card = this.state.revealedCards[index];

        // Validate
        if (!TargetSelector.isValidTarget(this, targetSchema, context, card)) {
            console.log("Invalid Revealed Target Selected.");
            return;
        }

        const maxCount = targetSchema.count || 1;
        const selectedTargets = pending.selectedTargets ?? (pending.selectedTargets = []);
        if (maxCount > 1) {
            if (!selectedTargets.includes(card)) {
                if (selectedTargets.length >= maxCount) {
                    console.log(`Cannot select more than ${maxCount} targets.`);
                    return;
                }
                selectedTargets.push(card);
            } else {
                pending.selectedTargets = selectedTargets.filter((t: any) => t !== card);
            }
        } else {
            // Execute
            this.effectManager.executeEffect(effect, context, [card]);
            // Move card to hand (if required by the specific action type)
            if (pending.actionType === 'PICK_REVEALED') {
                const player = this.state.players.find(p => p.id === pending.sourcePlayerId);
                if (player) {
                    player.hand.push(card);
                    this.state.revealedCards.splice(index, 1);
                }
            }
            // Shuffle rest back
            if (this.state.revealedCards.length > 0) {
                const player = this.state.players.find(p => p.id === pending.sourcePlayerId);
                if (player) {
                    player.deck.push(...this.state.revealedCards);
                    this.shuffle(player.deck);
                    this.state.revealedCards = [];
                }
            }
            // Reset
            this.handleEffectCompletion(context, pending);
        }
    }

    private handleEffectCompletion(context: GameContext, currentPending: GameState['pendingEffect']) {
        console.log(`[GameEngine] Handling completion for ${context.sourceCard.name}`);
        // Queue Architecture: If a new interaction mode started, it means the processed effect caused a trigger.
        // We do NOTHING here. The queue already has the remaining effects.
        // The new interaction will block the queue until it is resolved.
        if (this.state.interactionMode !== 'NORMAL' && this.state.pendingEffect !== currentPending) {
            console.log("[GameEngine] Action triggered a nested selection mode. Queue paused.");
        } else {
            this.resetInteractionMode();
        }

        if (
            currentPending?.actionType === this.endPhaseHandAdjustActionType
        ) {
            this.finalizeEndPhaseHandAdjustmentIfReady();
        }
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




