import { GameEngine } from '../GameEngine';
import { EngineAction, Phase } from '../types';
import { toStableActionKey } from './StableActionCodec';
import { scoreAction } from './eval/ActionScorer';
import { evaluateState } from './eval/StateEvaluator';
import { StrongBot } from './StrongBot';

interface SearchNode {
    engine: GameEngine;
    firstAction: EngineAction;
    depth: number;
    score: number;
}

interface SearchResult {
    action: EngineAction;
    exhaustedBudget: boolean;
    evaluatedRootActions: number;
    totalRootActions: number;
}

export interface StrongBotV2Options {
    beamWidth: number;
    maxDepth: number;
    expansionBudget: number;
    interactionDepth: number;
    interactionExpansionBudget: number;
    rolloutVariants: number;
    variantRandomJitterSteps: number;
    discountFactor: number;
    stateScoreWeight: number;
    actionScoreWeight: number;
}

const DEFAULT_OPTIONS: StrongBotV2Options = {
    beamWidth: 5,
    maxDepth: 3,
    expansionBudget: 720,
    interactionDepth: 3,
    interactionExpansionBudget: 220,
    rolloutVariants: 1,
    variantRandomJitterSteps: 3,
    discountFactor: 0.92,
    stateScoreWeight: 1,
    actionScoreWeight: 0.28,
};

export class StrongBotV2 {
    readonly name: string;
    private readonly fallback: StrongBot;
    private readonly options: StrongBotV2Options;

    constructor(name: string = 'StrongBot-v2', options: Partial<StrongBotV2Options> = {}) {
        this.name = name;
        this.fallback = new StrongBot(`${name}-Fallback-v1`);
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
            beamWidth: Math.max(1, Math.trunc(options.beamWidth ?? DEFAULT_OPTIONS.beamWidth)),
            maxDepth: Math.max(1, Math.trunc(options.maxDepth ?? DEFAULT_OPTIONS.maxDepth)),
            expansionBudget: Math.max(1, Math.trunc(options.expansionBudget ?? DEFAULT_OPTIONS.expansionBudget)),
            interactionDepth: Math.max(1, Math.trunc(options.interactionDepth ?? DEFAULT_OPTIONS.interactionDepth)),
            interactionExpansionBudget: Math.max(1, Math.trunc(options.interactionExpansionBudget ?? DEFAULT_OPTIONS.interactionExpansionBudget)),
            rolloutVariants: Math.max(1, Math.trunc(options.rolloutVariants ?? DEFAULT_OPTIONS.rolloutVariants)),
            variantRandomJitterSteps: Math.max(0, Math.trunc(options.variantRandomJitterSteps ?? DEFAULT_OPTIONS.variantRandomJitterSteps)),
        };
    }

    public chooseAction(engine: GameEngine, actorPlayerId?: string): EngineAction | null {
        const resolvedActorId = actorPlayerId ?? engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const observation = engine.getObservation(resolvedActorId);
        if (!observation.canAct || observation.legalActions.length === 0) return null;

        const fallbackAction = this.fallback.chooseAction(engine, resolvedActorId);

        if (!this.canSearchCurrentState(engine, resolvedActorId)) {
            return fallbackAction;
        }

        let searchResult: SearchResult;
        try {
            searchResult = this.pickByBeamSearch(engine, resolvedActorId, observation.legalActions);
        } catch {
            return fallbackAction;
        }

        if (fallbackAction && this.shouldFallbackByCoverage(searchResult)) {
            return fallbackAction;
        }

        if (!fallbackAction) {
            return searchResult.action;
        }

        return this.selectSaferAction(engine, resolvedActorId, searchResult.action, fallbackAction);
    }

    public step(engine: GameEngine, actorPlayerId?: string): boolean {
        const action = this.chooseAction(engine, actorPlayerId);
        if (!action) return false;
        return engine.step(action);
    }

    private canSearchCurrentState(engine: GameEngine, actorPlayerId: string): boolean {
        return this.isSearchableState(engine, actorPlayerId);
    }

    private isSearchableState(engine: GameEngine, actorPlayerId: string): boolean {
        if (engine.state.winner) return false;
        const ownerId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        if (ownerId !== actorPlayerId) return false;

        if (engine.state.interactionMode === 'NORMAL') {
            return engine.state.phase === Phase.MAIN || engine.state.phase === Phase.ATTACK || engine.state.phase === Phase.BLOCK;
        }

        return (
            engine.state.interactionMode === 'SELECT_TARGET' ||
            engine.state.interactionMode === 'SELECT_COST' ||
            engine.state.interactionMode === 'SELECT_OPTIONAL'
        );
    }

    private pickByBeamSearch(engine: GameEngine, actorPlayerId: string, legalActions: EngineAction[]): SearchResult {
        const rootActions = this.sortActions(engine, actorPlayerId, legalActions);
        if (rootActions.length === 1) {
            return { action: rootActions[0], exhaustedBudget: false, evaluatedRootActions: 1, totalRootActions: 1 };
        }

        const isInteractionRoot = engine.state.interactionMode !== 'NORMAL';
        const maxDepth = isInteractionRoot ? this.options.interactionDepth : this.options.maxDepth;
        const expansionBudget = isInteractionRoot ? this.options.interactionExpansionBudget : this.options.expansionBudget;

        let expansions = 0;
        let exhaustedBudget = false;
        let evaluatedRootActions = 0;
        const initialNodes: SearchNode[] = [];

        for (const rootAction of rootActions) {
            let evaluatedThisRoot = false;
            for (let variant = 0; variant < this.options.rolloutVariants; variant++) {
                if (expansions >= expansionBudget) {
                    exhaustedBudget = true;
                    break;
                }

                const fork = engine.createSimulationFork();
                if (variant > 0 && this.options.variantRandomJitterSteps > 0) {
                    fork.advanceRandomState(variant * this.options.variantRandomJitterSteps);
                }

                const ok = fork.step(rootAction);
                expansions += 1;
                evaluatedThisRoot = true;
                if (!ok) continue;

                const tactical = scoreAction(engine, actorPlayerId, rootAction).score;
                initialNodes.push({
                    engine: fork,
                    firstAction: rootAction,
                    depth: 1,
                    score: this.computeNodeValue(fork, actorPlayerId, tactical),
                });
            }
            if (evaluatedThisRoot) evaluatedRootActions += 1;
            if (exhaustedBudget) break;
        }

        if (initialNodes.length === 0) {
            return {
                action: rootActions[0],
                exhaustedBudget,
                evaluatedRootActions,
                totalRootActions: rootActions.length,
            };
        }

        let frontier = initialNodes;
        for (let depth = 1; depth < maxDepth; depth++) {
            if (frontier.length === 0) break;

            const beam = this.sortNodes(frontier).slice(0, this.options.beamWidth);
            const nextFrontier: SearchNode[] = [];

            for (const node of beam) {
                if (this.isTerminal(node.engine, actorPlayerId)) {
                    nextFrontier.push(node);
                    continue;
                }

                const legal = this.sortActions(node.engine, actorPlayerId, node.engine.getLegalActions(actorPlayerId));
                if (legal.length === 0) {
                    nextFrontier.push(node);
                    continue;
                }

                for (const action of legal) {
                    if (expansions >= expansionBudget) {
                        exhaustedBudget = true;
                        break;
                    }

                    const childEngine = node.engine.createSimulationFork();
                    const ok = childEngine.step(action);
                    expansions += 1;
                    if (!ok) continue;

                    const tactical = scoreAction(node.engine, actorPlayerId, action).score;
                    const incremental = this.computeNodeValue(childEngine, actorPlayerId, tactical);
                    nextFrontier.push({
                        engine: childEngine,
                        firstAction: node.firstAction,
                        depth: node.depth + 1,
                        score: node.score * this.options.discountFactor + incremental,
                    });
                }

                if (exhaustedBudget) break;
            }

            frontier = nextFrontier.length > 0 ? nextFrontier : beam;
            if (exhaustedBudget) break;
        }

        const bestAction = this.pickBestAggregatedAction(rootActions, frontier);
        return {
            action: bestAction,
            exhaustedBudget,
            evaluatedRootActions,
            totalRootActions: rootActions.length,
        };
    }

    private computeNodeValue(engine: GameEngine, actorPlayerId: string, tacticalScore: number): number {
        const opponent = engine.state.players.find(player => player.id !== actorPlayerId);
        const winnerBonus =
            engine.state.winner === null
                ? 0
                : engine.state.winner === actorPlayerId
                    ? 75000
                    : -75000;
        const score = evaluateState(engine, actorPlayerId).total;
        const ownershipPenalty =
            engine.state.interactionOwnerPlayerId !== null && engine.state.interactionOwnerPlayerId !== actorPlayerId
                ? -180
                : 0;
        const phasePenalty = engine.state.phase === Phase.END ? -70 : 0;
        const opponentThreatPenalty =
            opponent && engine.state.winner === null && opponent.damage.length >= 9
                ? -120
                : 0;

        return (
            score * this.options.stateScoreWeight +
            tacticalScore * this.options.actionScoreWeight +
            winnerBonus +
            ownershipPenalty +
            phasePenalty +
            opponentThreatPenalty
        );
    }

    private isTerminal(engine: GameEngine, actorPlayerId: string): boolean {
        return !this.isSearchableState(engine, actorPlayerId);
    }

    private pickBestAggregatedAction(rootActions: EngineAction[], nodes: SearchNode[]): EngineAction {
        const aggregate = new Map<string, { action: EngineAction; scoreSum: number; count: number; maxScore: number }>();

        for (const node of nodes) {
            const key = this.toActionKey(node.firstAction);
            const current = aggregate.get(key);
            if (!current) {
                aggregate.set(key, { action: node.firstAction, scoreSum: node.score, count: 1, maxScore: node.score });
            } else {
                current.scoreSum += node.score;
                current.count += 1;
                if (node.score > current.maxScore) current.maxScore = node.score;
            }
        }

        let bestAction = rootActions[0];
        let bestScore = Number.NEGATIVE_INFINITY;
        let bestKey = this.toActionKey(bestAction);

        for (const action of rootActions) {
            const key = this.toActionKey(action);
            const entry = aggregate.get(key);
            const score = entry ? entry.scoreSum / entry.count + entry.maxScore * 0.18 : Number.NEGATIVE_INFINITY;
            if (score > bestScore) {
                bestScore = score;
                bestAction = action;
                bestKey = key;
                continue;
            }

            if (score === bestScore && key < bestKey) {
                bestAction = action;
                bestKey = key;
            }
        }

        return bestAction;
    }

    private sortNodes(nodes: SearchNode[]): SearchNode[] {
        return [...nodes].sort((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            if (a.depth !== b.depth) return b.depth - a.depth;
            return this.toActionKey(a.firstAction).localeCompare(this.toActionKey(b.firstAction));
        });
    }

    private sortActions(engine: GameEngine, actorPlayerId: string, actions: EngineAction[]): EngineAction[] {
        return [...actions].sort((a, b) => {
            const scoreA = scoreAction(engine, actorPlayerId, a).score;
            const scoreB = scoreAction(engine, actorPlayerId, b).score;
            if (scoreA !== scoreB) return scoreB - scoreA;
            return this.toActionKey(a).localeCompare(this.toActionKey(b));
        });
    }

    private shouldFallbackByCoverage(searchResult: SearchResult): boolean {
        if (!searchResult.exhaustedBudget) return false;
        if (searchResult.totalRootActions <= 2) return false;
        const rootCoverage = searchResult.evaluatedRootActions / searchResult.totalRootActions;
        return rootCoverage < 0.45;
    }

    private selectSaferAction(
        engine: GameEngine,
        actorPlayerId: string,
        searchAction: EngineAction,
        fallbackAction: EngineAction,
    ): EngineAction {
        const searchImmediate = scoreAction(engine, actorPlayerId, searchAction).score;
        const fallbackImmediate = scoreAction(engine, actorPlayerId, fallbackAction).score;
        const tolerance = this.getFallbackTolerance(engine.state.phase);
        if (searchImmediate + tolerance < fallbackImmediate) {
            return fallbackAction;
        }
        return searchAction;
    }

    private getFallbackTolerance(phase: Phase): number {
        if (phase === Phase.BLOCK) return 80;
        if (phase === Phase.ATTACK) return 220;
        if (phase === Phase.MAIN) return 260;
        return 120;
    }

    private toActionKey(action: EngineAction): string {
        return toStableActionKey(action);
    }
}
