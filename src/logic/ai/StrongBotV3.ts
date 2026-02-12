import { GameEngine } from '../GameEngine';
import { EngineAction } from '../types';
import { StrongBotV2 } from './StrongBotV2';
import {
    evaluateObservedState,
    ObservationEvaluatorOptions,
    scoreObservedAction,
} from './eval/ObservationEvaluator';

export interface StrongBotV3Options {
    beamWidth: number;
    stateScoreWeight: number;
    actionScoreWeight: number;
    enableInteractionRollout: boolean;
    enableOpponentReplyPly: boolean;
    enableResourceEconomyModel: boolean;
    enableAntiOscillationPenalty: boolean;
}

const DEFAULT_OPTIONS: StrongBotV3Options = {
    beamWidth: 6,
    stateScoreWeight: 1,
    actionScoreWeight: 0.36,
    enableInteractionRollout: true,
    enableOpponentReplyPly: true,
    enableResourceEconomyModel: true,
    enableAntiOscillationPenalty: true,
};

export class StrongBotV3 {
    readonly name: string;
    private readonly fallback: StrongBotV2;
    private readonly options: StrongBotV3Options;

    constructor(name: string = 'StrongBot-v3', options: Partial<StrongBotV3Options> = {}) {
        this.name = name;
        this.fallback = new StrongBotV2(`${name}-Fallback-v2`);
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
            beamWidth: Math.max(1, Math.trunc(options.beamWidth ?? DEFAULT_OPTIONS.beamWidth)),
        };
    }

    public chooseAction(engine: GameEngine, actorPlayerId?: string): EngineAction | null {
        const resolvedActorId = actorPlayerId ?? this.resolveActorPlayerId(engine);
        const observation = engine.getObservation(resolvedActorId);
        if (!observation.canAct || observation.legalActions.length === 0) return null;

        const evalOptions = this.getEvalOptions();
        const rankedActions = this.sortActions(observation.state, resolvedActorId, observation.legalActions, evalOptions)
            .slice(0, this.options.beamWidth);
        if (rankedActions.length === 0) return null;

        let bestAction = rankedActions[0];
        let bestScore = Number.NEGATIVE_INFINITY;
        let bestKey = this.toActionKey(bestAction);

        for (const action of rankedActions) {
            const immediate = scoreObservedAction(observation.state, resolvedActorId, action, evalOptions).score;
            const rollout = this.rolloutScore(engine, resolvedActorId, action, evalOptions);
            const total = immediate * this.options.actionScoreWeight + rollout * this.options.stateScoreWeight;
            const actionKey = this.toActionKey(action);
            if (total > bestScore || (total === bestScore && actionKey < bestKey)) {
                bestAction = action;
                bestScore = total;
                bestKey = actionKey;
            }
        }

        if (Number.isFinite(bestScore)) {
            return bestAction;
        }
        return this.fallback.chooseAction(engine, resolvedActorId);
    }

    public step(engine: GameEngine, actorPlayerId?: string): boolean {
        const action = this.chooseAction(engine, actorPlayerId);
        if (!action) return false;
        return engine.step(action);
    }

    private rolloutScore(
        engine: GameEngine,
        actorPlayerId: string,
        rootAction: EngineAction,
        evalOptions: ObservationEvaluatorOptions,
    ): number {
        try {
            const fork = engine.createSimulationFork();
            const rootOk = fork.step(rootAction);
            if (!rootOk) return Number.NEGATIVE_INFINITY;

            if (!this.options.enableInteractionRollout) {
                return evaluateObservedState(fork.getObservation(actorPlayerId).state, actorPlayerId, evalOptions).total;
            }

            let stateScore = evaluateObservedState(fork.getObservation(actorPlayerId).state, actorPlayerId, evalOptions).total;
            if (!this.options.enableOpponentReplyPly) return stateScore;

            const afterRootObservation = fork.getObservation(actorPlayerId);
            const nextActorId = afterRootObservation.interactionOwnerPlayerId
                ?? afterRootObservation.state.players[afterRootObservation.state.turnPlayerIndex].id;
            if (nextActorId === actorPlayerId) return stateScore;

            const opponentObservation = fork.getObservation(nextActorId);
            if (!opponentObservation.canAct || opponentObservation.legalActions.length === 0) return stateScore;
            const opponentBest = this.pickBestObservedAction(
                opponentObservation.state,
                nextActorId,
                opponentObservation.legalActions,
                evalOptions,
            );
            if (!opponentBest) return stateScore;

            const replyOk = fork.step(opponentBest);
            if (!replyOk) return stateScore;

            const afterReplyState = fork.getObservation(actorPlayerId).state;
            const afterReplyScore = evaluateObservedState(afterReplyState, actorPlayerId, evalOptions).total;
            stateScore = stateScore * 0.4 + afterReplyScore * 0.6;
            return stateScore;
        } catch {
            return Number.NEGATIVE_INFINITY;
        }
    }

    private pickBestObservedAction(
        state: ReturnType<GameEngine['getObservation']>['state'],
        actorPlayerId: string,
        actions: EngineAction[],
        evalOptions: ObservationEvaluatorOptions,
    ): EngineAction | null {
        if (actions.length === 0) return null;
        const sorted = this.sortActions(state, actorPlayerId, actions, evalOptions);
        return sorted[0] ?? null;
    }

    private sortActions(
        state: ReturnType<GameEngine['getObservation']>['state'],
        actorPlayerId: string,
        actions: EngineAction[],
        evalOptions: ObservationEvaluatorOptions,
    ): EngineAction[] {
        return [...actions].sort((a, b) => {
            const scoreA = scoreObservedAction(state, actorPlayerId, a, evalOptions).score;
            const scoreB = scoreObservedAction(state, actorPlayerId, b, evalOptions).score;
            if (scoreA !== scoreB) return scoreB - scoreA;
            return this.toActionKey(a).localeCompare(this.toActionKey(b));
        });
    }

    private getEvalOptions(): ObservationEvaluatorOptions {
        return {
            enableResourceEconomyModel: this.options.enableResourceEconomyModel,
            enableAntiOscillationPenalty: this.options.enableAntiOscillationPenalty,
        };
    }

    private resolveActorPlayerId(engine: GameEngine): string {
        return engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
    }

    private toActionKey(action: EngineAction): string {
        const payload = Object.entries(action)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${String(value)}`)
            .join('|');
        return `${action.type}|${payload}`;
    }
}
