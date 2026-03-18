import fs from 'node:fs';
import path from 'node:path';
import { createRandomProvider } from '../../src/logic/random';
import { GameEngine } from '../../src/logic/GameEngine';
import { encodeStableAction, StableEncodedAction, toStableActionKey } from '../../src/logic/ai/StableActionCodec';
import { Buff, Card, EngineAction, EngineObservation, GameState, PendingEffect, PlayerState, UnitZoneState } from '../../src/logic/types';
import { materializeDeckForMatch, validateDeckAgainstLeader } from './deck_pool';
import { resolveFixedMatchup } from './fixed_matchup/registry';
import { BotFactory, MatchTerminationReason, withMutedEngineLogs } from './match_harness';
import { resolveBotFactory } from './bot_registry';
import { parseSeedListCsv, resolveSeedSuiteSeeds, SeedSuiteName } from './seed_suites';

export interface Bt05NikkiSelfPlayExportConfig {
    matchupId: string;
    games: number;
    maxSteps: number;
    enableMulligan: boolean;
    startSeed: number;
    player1BotId: string;
    player2BotId: string;
    explorationRate: number;
    suppressLogs: boolean;
    seedList?: number[];
    seedSuiteName?: SeedSuiteName;
    seedSuitePath?: string;
    outputPath?: string;
}

export interface CompactCardSnapshot {
    id: string;
    type: Card['type'];
    attribute: Card['attribute'];
    cost: number;
    power?: number;
    hit?: number;
    traits?: string;
    keywords?: string[];
    isAwakened?: boolean;
    turnCostOverride?: {
        cost: number;
        turnCount: number;
    };
}

export interface CompactBuffSnapshot {
    type: Buff['type'];
    value: number;
    duration: Buff['duration'];
    mode?: Buff['mode'];
    untilTurnCount?: number;
}

export interface CompactUnitZoneSnapshot {
    unit: CompactCardSnapshot | null;
    items: CompactCardSnapshot[];
    buffs: CompactBuffSnapshot[];
    isExhausted: boolean;
    hasAttacked: boolean;
    hasPlacedUnitThisTurn: boolean;
    hasActivatedEffectThisTurn: boolean;
    attackCountThisTurn: number;
    extraAttackAllowance: number;
}

export interface CompactPendingEffectSnapshot {
    sourceCardId: string;
    sourcePlayerId: string;
    controllerPlayerId?: string;
    actionType: string;
    effectDescription?: string;
    sourceEffectDescription?: string;
    sourceActivation?: string;
    triggerReason?: string;
    selectionPurpose?: string;
    validTargets?: string;
    targetScope?: string;
    targetType?: string;
    targetCount?: number;
    targetSelectMode?: string;
    selectedTargets?: string[];
    revealedCardIds?: string[];
    costType?: string;
    costPaidCount?: number;
}

export interface CompactPlayerSnapshot {
    id: string;
    name: string;
    leaderLevel: number;
    levelZone: CompactCardSnapshot | null;
    deck: CompactCardSnapshot[];
    hand: CompactCardSnapshot[];
    trash: CompactCardSnapshot[];
    damage: CompactCardSnapshot[];
    unitZones: CompactUnitZoneSnapshot[];
    skillZone: CompactCardSnapshot[];
    lockedSkillTraitsUntilTurnEnd: string[];
    lockedSkillIdsUntilTurnEnd: string[];
    lockedActivationsUntilTurnEnd: string[];
    lockedActivationsUntilTurnCount: Array<{ activation: string; turnCount: number }>;
    pendingNextPlayUnitEffectSourceIds: string[];
    turnDamageCountReferenceBonus: number;
}

export interface CompactGameStateSnapshot {
    players: [CompactPlayerSnapshot, CompactPlayerSnapshot];
    turnPlayerIndex: number;
    phase: GameState['phase'];
    turnCount: number;
    winnerId: string | null;
    winnerPlayer: 1 | 2 | null;
    pendingAttackerIndex: number | null;
    pendingBlockerZoneIndex: number | null;
    interactionMode: GameState['interactionMode'];
    interactionOwnerPlayerId: string | null;
    pendingEffect: CompactPendingEffectSnapshot | null;
    mulliganState: GameState['mulliganState'];
    mulliganResultByPlayerId: Record<string, boolean>;
    revealedCards: CompactCardSnapshot[];
    effectQueueLength: number;
    deferredEffectQueueLength: number;
    damageProcessingDepth: number;
    globalStep: number;
    combatStep: GameState['combatStep'];
    combatBlocked: boolean;
}

export interface CompactObservationSnapshot {
    actorPlayerId: string;
    canAct: boolean;
    interactionOwnerPlayerId: string | null;
    legalActions: StableEncodedAction[];
    state: CompactGameStateSnapshot;
}

export interface Bt05NikkiSelfPlayTransition {
    stepIndex: number;
    actorPlayerId: string;
    actorSeat: 1 | 2;
    actorBotId: string;
    actorBotName: string;
    turnCount: number;
    phase: GameState['phase'];
    interactionMode: GameState['interactionMode'];
    decisionSource: 'bot' | 'explore-random';
    observation: CompactObservationSnapshot;
    legalActionKeys: string[];
    chosenActionIndex: number;
    chosenAction: StableEncodedAction;
    nextObservation: CompactObservationSnapshot | null;
    done: boolean;
    terminalReason: MatchTerminationReason | null;
    winnerPlayer: 1 | 2 | null;
    rewardFromActorPerspective: number;
    returnToGoFromActorPerspective: number;
}

export interface Bt05NikkiSelfPlayEpisode {
    id: string;
    seed: number;
    matchupId: string;
    player1BotId: string;
    player2BotId: string;
    explorationRate: number;
    steps: number;
    turnCount: number;
    reason: MatchTerminationReason;
    winnerId: string | null;
    winnerPlayer: 1 | 2 | null;
    lastActionKeys: string[];
    transitions: Bt05NikkiSelfPlayTransition[];
}

export interface Bt05NikkiSelfPlayExportReport {
    generatedAt: string;
    matchup: {
        id: string;
        label: string;
        description?: string;
        player1DeckId: string;
        player2DeckId: string;
    };
    decks: {
        player1: {
            id: string;
            label: string;
            leaderId: string;
            notes?: string[];
        };
        player2: {
            id: string;
            label: string;
            leaderId: string;
            notes?: string[];
        };
    };
    config: Bt05NikkiSelfPlayExportConfig & {
        seedList: number[];
    };
    episodes: Bt05NikkiSelfPlayEpisode[];
    summary: {
        totalGames: number;
        totalTransitions: number;
        avgSteps: number;
        avgTurns: number;
        wins: {
            player1: number;
            player2: number;
        };
        winRate: {
            player1: number;
            player2: number;
        };
        terminationCounts: Record<MatchTerminationReason, number>;
        decisionSourceCounts: {
            bot: number;
            exploreRandom: number;
        };
    };
}

export interface Bt05NikkiSelfPlayArtifactPaths {
    latestPath: string;
    archivePath: string;
}

function roundTo(value: number, digits: number): number {
    const p = 10 ** digits;
    return Math.round(value * p) / p;
}

function safeDivide(numerator: number, denominator: number): number {
    if (denominator <= 0) return 0;
    return numerator / denominator;
}

function parseIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (!raw) return fallback;
    const normalized = raw.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function parseFloatEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSeedSuiteName(raw: string | undefined): SeedSuiteName | undefined {
    if (!raw) return undefined;
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'tuning' || normalized === 'dev' || normalized === 'promotion-holdout') {
        return normalized;
    }
    return undefined;
}

function resolveOutputPath(defaultOutputPath: string): string | undefined {
    const raw = process.env.AI_NIKKI_RL_OUTPUT;
    if (!raw || raw.trim().length === 0) return defaultOutputPath;
    const normalized = raw.trim().toLowerCase();
    if (normalized === '-' || normalized === 'none' || normalized === 'off') return undefined;
    return raw.trim();
}

function sanitizeArtifactSegment(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return normalized.replace(/^-+|-+$/g, '') || 'unknown';
}

function summarizeSeedList(seedList: number[]): string {
    if (seedList.length === 0) return 'no-seeds';
    const first = seedList[0];
    const last = seedList[seedList.length - 1];
    const sequential = seedList.every((seed, index) => seed === first + index);
    if (seedList.length === 1) return `seed-${first}`;
    if (sequential) return `seed-${first}-to-${last}`;
    if (seedList.length <= 4) return `seeds-${seedList.join('-')}`;
    return `seeds-${first}-to-${last}-n${seedList.length}`;
}

function cloneLeaderForMatch(leader: Card, seed: number, seat: 1 | 2): Card {
    return { ...leader, id: `${leader.id}_L_${seed}_${seat}` };
}

function resolveWinnerPlayer(state: GameState): 1 | 2 | null {
    if (!state.winner) return null;
    return state.players[0].id === state.winner ? 1 : 2;
}

function compactCard(card: Card | null): CompactCardSnapshot | null {
    if (!card) return null;
    return {
        id: card.id,
        type: card.type,
        attribute: card.attribute,
        cost: card.cost,
        power: card.power,
        hit: card.hit,
        traits: card.traits,
        keywords: card.keywords ? [...card.keywords] : undefined,
        isAwakened: card.isAwakened,
        turnCostOverride: card.turnCostOverride ? { ...card.turnCostOverride } : undefined,
    };
}

function compactBuff(buff: Buff): CompactBuffSnapshot {
    return {
        type: buff.type,
        value: buff.value,
        duration: buff.duration,
        mode: buff.mode,
        untilTurnCount: buff.untilTurnCount,
    };
}

function compactUnitZone(zone: UnitZoneState): CompactUnitZoneSnapshot {
    return {
        unit: compactCard(zone.unit),
        items: zone.items.map(item => compactCard(item)).filter((item): item is CompactCardSnapshot => item !== null),
        buffs: zone.buffs.map(compactBuff),
        isExhausted: zone.isExhausted,
        hasAttacked: zone.hasAttacked,
        hasPlacedUnitThisTurn: zone.hasPlacedUnitThisTurn,
        hasActivatedEffectThisTurn: zone.hasActivatedEffectThisTurn,
        attackCountThisTurn: zone.attackCountThisTurn,
        extraAttackAllowance: zone.extraAttackAllowance,
    };
}

function summarizeTargetReference(target: unknown): string {
    if (target === null || target === undefined) return 'null';
    if (typeof target === 'string' || typeof target === 'number' || typeof target === 'boolean') {
        return String(target);
    }
    if (typeof target === 'object' && 'id' in target && typeof (target as { id?: unknown }).id === 'string') {
        return `CARD:${String((target as { id: string }).id)}`;
    }
    if (typeof target === 'object' && 'unit' in target && 'items' in target) {
        return 'ZONE';
    }
    if (Array.isArray(target)) {
        return `ARRAY:${target.length}`;
    }
    return `OBJECT:${Object.keys(target as Record<string, unknown>).sort().join(',')}`;
}

function compactPendingEffect(pendingEffect: PendingEffect | null): CompactPendingEffectSnapshot | null {
    if (!pendingEffect) return null;
    return {
        sourceCardId: pendingEffect.sourceCard.id,
        sourcePlayerId: pendingEffect.sourcePlayerId,
        controllerPlayerId: pendingEffect.controllerPlayerId,
        actionType: pendingEffect.actionType,
        effectDescription: pendingEffect.effectDescription,
        sourceEffectDescription: pendingEffect.sourceEffectDescription,
        sourceActivation: pendingEffect.sourceActivation ? String(pendingEffect.sourceActivation) : undefined,
        triggerReason: pendingEffect.triggerReason,
        selectionPurpose: pendingEffect.selectionPurpose,
        validTargets: pendingEffect.validTargets,
        targetScope: pendingEffect.targetSchema?.scope,
        targetType: pendingEffect.targetSchema?.type,
        targetCount: pendingEffect.targetSchema?.count,
        targetSelectMode: pendingEffect.targetSchema?.selectMode,
        selectedTargets: pendingEffect.selectedTargets?.map(summarizeTargetReference),
        revealedCardIds: pendingEffect.revealedCards?.map(card => card.id),
        costType: pendingEffect.costToPay?.type,
        costPaidCount: pendingEffect.costPaidCount,
    };
}

function compactPlayer(player: PlayerState): CompactPlayerSnapshot {
    return {
        id: player.id,
        name: player.name,
        leaderLevel: player.leaderLevel,
        levelZone: compactCard(player.levelZone),
        deck: player.deck.map(card => compactCard(card)).filter((card): card is CompactCardSnapshot => card !== null),
        hand: player.hand.map(card => compactCard(card)).filter((card): card is CompactCardSnapshot => card !== null),
        trash: player.trash.map(card => compactCard(card)).filter((card): card is CompactCardSnapshot => card !== null),
        damage: player.damage.map(card => compactCard(card)).filter((card): card is CompactCardSnapshot => card !== null),
        unitZones: player.unitZones.map(compactUnitZone),
        skillZone: player.skillZone.map(card => compactCard(card)).filter((card): card is CompactCardSnapshot => card !== null),
        lockedSkillTraitsUntilTurnEnd: Object.keys(player.lockedSkillTraitsUntilTurnEnd).sort(),
        lockedSkillIdsUntilTurnEnd: Object.keys(player.lockedSkillIdsUntilTurnEnd).sort(),
        lockedActivationsUntilTurnEnd: Object.keys(player.lockedActivationsUntilTurnEnd).sort(),
        lockedActivationsUntilTurnCount: Object.entries(player.lockedActivationsUntilTurnCount)
            .map(([activation, turnCount]) => ({ activation, turnCount: Number(turnCount ?? 0) }))
            .sort((left, right) => left.activation.localeCompare(right.activation)),
        pendingNextPlayUnitEffectSourceIds: player.pendingNextPlayUnitEffects
            .map(effect => effect.sourceCard?.id ?? 'UNKNOWN')
            .sort(),
        turnDamageCountReferenceBonus: player.turnDamageCountReferenceBonus,
    };
}

function compactState(state: GameState): CompactGameStateSnapshot {
    return {
        players: [
            compactPlayer(state.players[0]),
            compactPlayer(state.players[1]),
        ],
        turnPlayerIndex: state.turnPlayerIndex,
        phase: state.phase,
        turnCount: state.turnCount,
        winnerId: state.winner,
        winnerPlayer: resolveWinnerPlayer(state),
        pendingAttackerIndex: state.pendingAttackerIndex,
        pendingBlockerZoneIndex: state.pendingBlockerZoneIndex,
        interactionMode: state.interactionMode,
        interactionOwnerPlayerId: state.interactionOwnerPlayerId,
        pendingEffect: compactPendingEffect(state.pendingEffect),
        mulliganState: state.mulliganState
            ? {
                pendingPlayerIds: [...state.mulliganState.pendingPlayerIds],
                completedPlayerIds: [...state.mulliganState.completedPlayerIds],
            }
            : null,
        mulliganResultByPlayerId: { ...state.mulliganResultByPlayerId },
        revealedCards: state.revealedCards.map(card => compactCard(card)).filter((card): card is CompactCardSnapshot => card !== null),
        effectQueueLength: state.effectQueue.length,
        deferredEffectQueueLength: state.deferredEffectQueue.length,
        damageProcessingDepth: state.damageProcessingDepth,
        globalStep: state.globalStep,
        combatStep: state.combatStep,
        combatBlocked: state.combatBlocked,
    };
}

function compactObservation(observation: EngineObservation): CompactObservationSnapshot {
    return {
        actorPlayerId: observation.actorPlayerId,
        canAct: observation.canAct,
        interactionOwnerPlayerId: observation.interactionOwnerPlayerId,
        legalActions: observation.legalActions.map(action => encodeStableAction(action)),
        state: compactState(observation.state),
    };
}

function resolveSeeds(config: Bt05NikkiSelfPlayExportConfig): number[] {
    if (config.seedList && config.seedList.length > 0) return [...config.seedList];
    if (config.seedSuiteName) {
        const suitePath = config.seedSuitePath ?? 'artifacts/ai/seeds/phase3_v1.json';
        const resolved = resolveSeedSuiteSeeds(suitePath, config.seedSuiteName);
        if (resolved.seeds.length < config.games) {
            throw new Error(`Seed suite "${config.seedSuiteName}" has only ${resolved.seeds.length} seeds; ${config.games} required.`);
        }
        return resolved.seeds.slice(0, config.games);
    }
    return Array.from({ length: config.games }, (_value, index) => config.startSeed + index);
}

export function buildBt05NikkiSelfPlayArtifactPaths(
    outputPath: string,
    config: Pick<Bt05NikkiSelfPlayExportConfig, 'matchupId' | 'player1BotId' | 'player2BotId' | 'seedList' | 'seedSuiteName'>,
): Bt05NikkiSelfPlayArtifactPaths {
    const latestPath = path.resolve(outputPath);
    const archiveDirectory = path.join(path.dirname(latestPath), 'runs');
    const seedLabel = config.seedSuiteName
        ? `suite-${sanitizeArtifactSegment(config.seedSuiteName)}`
        : summarizeSeedList(config.seedList ?? []);
    const archiveSlug = [
        sanitizeArtifactSegment(config.matchupId),
        `p1-${sanitizeArtifactSegment(config.player1BotId)}`,
        `p2-${sanitizeArtifactSegment(config.player2BotId)}`,
        seedLabel,
    ].join('__');

    return {
        latestPath,
        archivePath: path.join(archiveDirectory, `${archiveSlug}.json`),
    };
}

export function writeBt05NikkiSelfPlayArtifacts(outputPath: string | undefined, report: Bt05NikkiSelfPlayExportReport): void {
    if (!outputPath) return;
    const { latestPath, archivePath } = buildBt05NikkiSelfPlayArtifactPaths(outputPath, report.config);
    for (const targetPath of [latestPath, archivePath]) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, JSON.stringify(report, null, 2), 'utf8');
    }
}

function finalizeEpisodeReturns(episode: Bt05NikkiSelfPlayEpisode): Bt05NikkiSelfPlayEpisode {
    const winnerPlayer = episode.winnerPlayer;
    const terminalRewardForSeat = (seat: 1 | 2): number => {
        if (episode.reason !== 'winner' || winnerPlayer === null) return 0;
        return winnerPlayer === seat ? 1 : -1;
    };

    return {
        ...episode,
        transitions: episode.transitions.map((transition, index, transitions) => {
            const reward = index === transitions.length - 1 ? terminalRewardForSeat(transition.actorSeat) : 0;
            return {
                ...transition,
                done: index === transitions.length - 1,
                terminalReason: index === transitions.length - 1 ? episode.reason : null,
                winnerPlayer,
                rewardFromActorPerspective: reward,
                returnToGoFromActorPerspective: terminalRewardForSeat(transition.actorSeat),
            };
        }),
    };
}

function collectEpisode(
    seed: number,
    config: Bt05NikkiSelfPlayExportConfig,
    player1BotFactory: BotFactory,
    player2BotFactory: BotFactory,
    player1Deck: Card[],
    player2Deck: Card[],
    player1Leader: Card,
    player2Leader: Card,
): Bt05NikkiSelfPlayEpisode {
    const episodeId = `bt05-nikki-selfplay-${seed}`;
    const engine = new GameEngine(
        'Bot-P1',
        'Bot-P2',
        player1Deck,
        player2Deck,
        player1Leader,
        player2Leader,
        { seed, enableMulligan: config.enableMulligan },
    );
    const bot1 = player1BotFactory('P1-Bot');
    const bot2 = player2BotFactory('P2-Bot');
    const explorationRandom = createRandomProvider(seed + 99173);
    const lastActionKeys: string[] = [];
    const transitions: Bt05NikkiSelfPlayTransition[] = [];
    let steps = 0;
    let reason: MatchTerminationReason = 'max_steps';

    while (!engine.state.winner && steps < config.maxSteps) {
        const actorPlayerId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const actorSeat: 1 | 2 = engine.state.players[0].id === actorPlayerId ? 1 : 2;
        const actorBotId = actorSeat === 1 ? config.player1BotId : config.player2BotId;
        const actorBot = actorSeat === 1 ? bot1 : bot2;
        const observation = engine.getObservation(actorPlayerId);
        const compactCurrentObservation = compactObservation(observation);
        if (!observation.canAct || observation.legalActions.length === 0) {
            reason = 'no_action';
            break;
        }

        const shouldExplore = config.explorationRate > 0 && explorationRandom.next() < config.explorationRate;
        const action = shouldExplore
            ? observation.legalActions[Math.floor(explorationRandom.next() * observation.legalActions.length)]
            : actorBot.chooseAction(engine, actorPlayerId);
        if (!action) {
            reason = 'no_action';
            break;
        }

        const chosenActionKey = toStableActionKey(action);
        const legalActionKeys = observation.legalActions.map(legalAction => toStableActionKey(legalAction));
        const chosenActionIndex = legalActionKeys.findIndex(key => key === chosenActionKey);
        if (chosenActionIndex < 0) {
            throw new Error(`Chosen action not found in legal actions for seed=${seed}, step=${steps}, action=${chosenActionKey}`);
        }

        lastActionKeys.push(chosenActionKey);
        if (lastActionKeys.length > 12) lastActionKeys.shift();

        const ok = engine.step(action);
        if (!ok) {
            reason = 'invalid_action';
            break;
        }

        const nextObservation = engine.state.winner
            ? null
            : engine.getObservation(engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id);
        const compactNextObservation = nextObservation ? compactObservation(nextObservation) : null;
        transitions.push({
            stepIndex: steps,
            actorPlayerId,
            actorSeat,
            actorBotId,
            actorBotName: actorBot.name,
            turnCount: observation.state.turnCount,
            phase: observation.state.phase,
            interactionMode: observation.state.interactionMode,
            decisionSource: shouldExplore ? 'explore-random' : 'bot',
            observation: compactCurrentObservation,
            legalActionKeys,
            chosenActionIndex,
            chosenAction: encodeStableAction(action),
            nextObservation: compactNextObservation,
            done: false,
            terminalReason: null,
            winnerPlayer: null,
            rewardFromActorPerspective: 0,
            returnToGoFromActorPerspective: 0,
        });
        steps += 1;
    }

    if (engine.state.winner) {
        reason = 'winner';
    } else if (steps >= config.maxSteps) {
        reason = 'max_steps';
    }

    return finalizeEpisodeReturns({
        id: episodeId,
        seed,
        matchupId: config.matchupId,
        player1BotId: config.player1BotId,
        player2BotId: config.player2BotId,
        explorationRate: config.explorationRate,
        steps,
        turnCount: engine.state.turnCount,
        reason,
        winnerId: engine.state.winner,
        winnerPlayer: resolveWinnerPlayer(engine.state),
        lastActionKeys,
        transitions,
    });
}

export function runBt05NikkiSelfPlayExport(config: Bt05NikkiSelfPlayExportConfig): Bt05NikkiSelfPlayExportReport {
    const matchup = resolveFixedMatchup(config.matchupId);
    const seeds = resolveSeeds(config);
    const player1BotFactory = resolveBotFactory(config.player1BotId);
    const player2BotFactory = resolveBotFactory(config.player2BotId);
    const episodes: Bt05NikkiSelfPlayEpisode[] = [];

    for (const seed of seeds) {
        const player1Leader = cloneLeaderForMatch(matchup.player1.leader, seed, 1);
        const player2Leader = cloneLeaderForMatch(matchup.player2.leader, seed, 2);
        const player1Deck = materializeDeckForMatch(matchup.player1.deck, seed + 101, 'P1');
        const player2Deck = materializeDeckForMatch(matchup.player2.deck, seed + 202, 'P2');
        const player1DeckLegality = validateDeckAgainstLeader(player1Deck, player1Leader);
        const player2DeckLegality = validateDeckAgainstLeader(player2Deck, player2Leader);
        if (!player1DeckLegality.valid) {
            throw new Error(`Illegal deck for P1 leader ${player1Leader.id}. errors=${player1DeckLegality.errors.join(' | ')}`);
        }
        if (!player2DeckLegality.valid) {
            throw new Error(`Illegal deck for P2 leader ${player2Leader.id}. errors=${player2DeckLegality.errors.join(' | ')}`);
        }

        const collect = () => collectEpisode(
            seed,
            config,
            player1BotFactory,
            player2BotFactory,
            player1Deck,
            player2Deck,
            player1Leader,
            player2Leader,
        );
        episodes.push(config.suppressLogs ? withMutedEngineLogs(collect) : collect());
    }

    const winsPlayer1 = episodes.filter(episode => episode.reason === 'winner' && episode.winnerPlayer === 1).length;
    const winsPlayer2 = episodes.filter(episode => episode.reason === 'winner' && episode.winnerPlayer === 2).length;
    const totalSteps = episodes.reduce((sum, episode) => sum + episode.steps, 0);
    const totalTurns = episodes.reduce((sum, episode) => sum + episode.turnCount, 0);
    const totalTransitions = episodes.reduce((sum, episode) => sum + episode.transitions.length, 0);
    const decisionSourceCounts = episodes.reduce(
        (acc, episode) => {
            for (const transition of episode.transitions) {
                if (transition.decisionSource === 'explore-random') {
                    acc.exploreRandom += 1;
                } else {
                    acc.bot += 1;
                }
            }
            return acc;
        },
        {
            bot: 0,
            exploreRandom: 0,
        },
    );
    const terminationCounts = episodes.reduce<Record<MatchTerminationReason, number>>(
        (acc, episode) => {
            acc[episode.reason] += 1;
            return acc;
        },
        {
            winner: 0,
            max_steps: 0,
            no_action: 0,
            invalid_action: 0,
        },
    );

    return {
        generatedAt: new Date().toISOString(),
        matchup: {
            id: matchup.definition.id,
            label: matchup.definition.label,
            description: matchup.definition.description,
            player1DeckId: matchup.definition.player1DeckId,
            player2DeckId: matchup.definition.player2DeckId,
        },
        decks: {
            player1: {
                id: matchup.player1.definition.id,
                label: matchup.player1.definition.label,
                leaderId: matchup.player1.definition.leaderId,
                notes: matchup.player1.definition.notes ? [...matchup.player1.definition.notes] : undefined,
            },
            player2: {
                id: matchup.player2.definition.id,
                label: matchup.player2.definition.label,
                leaderId: matchup.player2.definition.leaderId,
                notes: matchup.player2.definition.notes ? [...matchup.player2.definition.notes] : undefined,
            },
        },
        config: {
            ...config,
            seedList: seeds,
        },
        episodes,
        summary: {
            totalGames: episodes.length,
            totalTransitions,
            avgSteps: roundTo(safeDivide(totalSteps, episodes.length), 2),
            avgTurns: roundTo(safeDivide(totalTurns, episodes.length), 2),
            wins: {
                player1: winsPlayer1,
                player2: winsPlayer2,
            },
            winRate: {
                player1: roundTo(safeDivide(winsPlayer1, episodes.length), 4),
                player2: roundTo(safeDivide(winsPlayer2, episodes.length), 4),
            },
            terminationCounts,
            decisionSourceCounts,
        },
    };
}

export function formatBt05NikkiSelfPlayExportSummary(report: Bt05NikkiSelfPlayExportReport): string {
    return [
        `BT05 Nikki RL self-play export`,
        `matchup=${report.matchup.id}`,
        `bots=${report.config.player1BotId} vs ${report.config.player2BotId}`,
        `games=${report.summary.totalGames}`,
        `transitions=${report.summary.totalTransitions}`,
        `wins=${report.summary.wins.player1}-${report.summary.wins.player2}`,
        `avgSteps=${report.summary.avgSteps}`,
        `avgTurns=${report.summary.avgTurns}`,
        `termination=${JSON.stringify(report.summary.terminationCounts)}`,
        `decisionSource=${JSON.stringify(report.summary.decisionSourceCounts)}`,
    ].join('\n');
}

function buildConfigFromEnv(): Bt05NikkiSelfPlayExportConfig {
    const defaultOutputPath = path.join('artifacts', 'ai', 'rl', 'bt05_nikki_selfplay', 'latest.json');
    return {
        matchupId: process.env.AI_NIKKI_RL_MATCHUP_ID ?? 'fm-c-bt05-unlucky-bunny-nikki-mirror',
        games: parseIntEnv('AI_NIKKI_RL_GAMES', 8),
        maxSteps: parseIntEnv('AI_NIKKI_RL_MAX_STEPS', 1200),
        enableMulligan: parseBoolEnv('AI_NIKKI_RL_ENABLE_MULLIGAN', true),
        startSeed: parseIntEnv('AI_NIKKI_RL_START_SEED', 2026031800),
        player1BotId: process.env.AI_NIKKI_RL_PLAYER1_BOT_ID ?? 'practice-bt05-nikki-strong-v1',
        player2BotId: process.env.AI_NIKKI_RL_PLAYER2_BOT_ID ?? 'practice-bt05-nikki-strong-v1',
        explorationRate: Math.max(0, Math.min(1, parseFloatEnv('AI_NIKKI_RL_EXPLORATION_RATE', 0))),
        suppressLogs: parseBoolEnv('AI_NIKKI_RL_SUPPRESS_LOGS', true),
        seedList: parseSeedListCsv(process.env.AI_NIKKI_RL_SEED_LIST),
        seedSuiteName: parseSeedSuiteName(process.env.AI_NIKKI_RL_SEED_SUITE),
        seedSuitePath: process.env.AI_NIKKI_RL_SEED_SUITE_PATH,
        outputPath: resolveOutputPath(defaultOutputPath),
    };
}

const maybeMain = process.argv[1] ?? '';
if (maybeMain.endsWith('run_bt05_nikki_selfplay_export.ts') || maybeMain.endsWith('run_bt05_nikki_selfplay_export.js')) {
    const config = buildConfigFromEnv();
    const report = runBt05NikkiSelfPlayExport(config);
    writeBt05NikkiSelfPlayArtifacts(config.outputPath, report);
    console.log(formatBt05NikkiSelfPlayExportSummary(report));
    if (config.outputPath) {
        const artifactPaths = buildBt05NikkiSelfPlayArtifactPaths(config.outputPath, report.config);
        console.log(`artifacts.latest=${artifactPaths.latestPath}`);
        console.log(`artifacts.archive=${artifactPaths.archivePath}`);
    }
}
