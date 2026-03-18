import { GameEngine } from '../GameEngine';
import { EngineAction, GameState } from '../types';
import { StrongBotV2 } from './StrongBotV2';
import {
    evaluateObservedState,
    ObservationEvaluatorOptions,
    scoreObservedAction,
} from './eval/ObservationEvaluator';
import { runCounterfactualRollout } from './eval/CounterfactualRollout';

export interface StrongBotV3Options {
    beamWidth: number;
    stateScoreWeight: number;
    actionScoreWeight: number;
    rolloutDisagreementPenaltyWeight: number;
    closeBoardStateScoreThreshold: number;
    closeBoardDisagreementBoost: number;
    closeBoardOvercommitPenaltyWeight: number;
    enableInteractionRollout: boolean;
    enableOpponentReplyPly: boolean;
    enableResourceEconomyModel: boolean;
    enableAntiOscillationPenalty: boolean;
    interactionRolloutDepth: number;
    interactionDiscount: number;
    rolloutInteractionScoreWeight: number;
    opponentReplyBlend: number;
    opponentReplyTopK: number;
    opponentReplyAggregation: 'max' | 'mean' | 'weighted';
    repeatMemoryDecay: number;
    repeatMemoryCapacity: number;
}

const DEFAULT_OPTIONS: StrongBotV3Options = {
    beamWidth: 6,
    stateScoreWeight: 1,
    actionScoreWeight: 0.36,
    rolloutDisagreementPenaltyWeight: 0.015,
    closeBoardStateScoreThreshold: 2200,
    closeBoardDisagreementBoost: 0.55,
    closeBoardOvercommitPenaltyWeight: 0.01,
    enableInteractionRollout: true,
    enableOpponentReplyPly: true,
    enableResourceEconomyModel: true,
    enableAntiOscillationPenalty: true,
    interactionRolloutDepth: 4,
    interactionDiscount: 0.88,
    rolloutInteractionScoreWeight: 0.34,
    opponentReplyBlend: 0.62,
    opponentReplyTopK: 1,
    opponentReplyAggregation: 'weighted',
    repeatMemoryDecay: 1,
    repeatMemoryCapacity: 96,
};

export function scoreStrongBotCandidate(
    immediateScore: number,
    rolloutScore: number,
    options: Pick<
        StrongBotV3Options,
        | 'actionScoreWeight'
        | 'stateScoreWeight'
        | 'rolloutDisagreementPenaltyWeight'
        | 'closeBoardStateScoreThreshold'
        | 'closeBoardDisagreementBoost'
        | 'closeBoardOvercommitPenaltyWeight'
    >,
    rootStateScore?: number,
): number {
    const weightedTotal = immediateScore * options.actionScoreWeight + rolloutScore * options.stateScoreWeight;
    const disagreementPenalty = Math.abs(immediateScore - rolloutScore) * options.rolloutDisagreementPenaltyWeight;
    const closeness = typeof rootStateScore === 'number'
        ? Math.max(0, 1 - Math.abs(rootStateScore) / Math.max(1, options.closeBoardStateScoreThreshold))
        : 0;
    const overcommitPenalty = Math.max(0, immediateScore - rolloutScore) * options.closeBoardOvercommitPenaltyWeight * closeness;
    const disagreementBoost = disagreementPenalty * options.closeBoardDisagreementBoost * closeness;
    return weightedTotal - disagreementPenalty - disagreementBoost - overcommitPenalty;
}

export class StrongBotV3 {
    readonly name: string;
    private readonly fallback: StrongBotV2;
    private readonly options: StrongBotV3Options;
    private readonly interactionRepeatMemory = new Map<string, number>();

    constructor(name: string = 'StrongBot-v3', options: Partial<StrongBotV3Options> = {}) {
        this.name = name;
        this.fallback = new StrongBotV2(`${name}-Fallback-v2`);
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
            beamWidth: Math.max(1, Math.trunc(options.beamWidth ?? DEFAULT_OPTIONS.beamWidth)),
            interactionRolloutDepth: Math.max(0, Math.trunc(options.interactionRolloutDepth ?? DEFAULT_OPTIONS.interactionRolloutDepth)),
            opponentReplyTopK: Math.max(1, Math.trunc(options.opponentReplyTopK ?? DEFAULT_OPTIONS.opponentReplyTopK)),
            opponentReplyAggregation: options.opponentReplyAggregation ?? DEFAULT_OPTIONS.opponentReplyAggregation,
            repeatMemoryDecay: Math.max(0, Math.trunc(options.repeatMemoryDecay ?? DEFAULT_OPTIONS.repeatMemoryDecay)),
            repeatMemoryCapacity: Math.max(8, Math.trunc(options.repeatMemoryCapacity ?? DEFAULT_OPTIONS.repeatMemoryCapacity)),
        };
    }

    public chooseAction(engine: GameEngine, actorPlayerId?: string): EngineAction | null {
        const resolvedActorId = actorPlayerId ?? this.resolveActorPlayerId(engine);
        const observation = engine.getObservation(resolvedActorId);
        if (!observation.canAct || observation.legalActions.length === 0) return null;
        this.prepareRepeatMemory(observation.state);

        const evalOptions = this.getEvalOptions();
        const rankedActions = this.sortActions(observation.state, resolvedActorId, observation.legalActions, evalOptions)
            .slice(0, this.options.beamWidth);
        if (rankedActions.length === 0) return null;

        const rootStateScore = evaluateObservedState(observation.state, resolvedActorId, evalOptions).total;
        let bestAction = rankedActions[0];
        let bestScore = Number.NEGATIVE_INFINITY;
        let bestKey = this.toActionKey(bestAction);

        for (const action of rankedActions) {
            const repeatCount = this.getRepeatCount(observation.state, action);
            const immediate = scoreObservedAction(observation.state, resolvedActorId, action, evalOptions, repeatCount).score;
            const rollout = runCounterfactualRollout(engine, resolvedActorId, action, {
                ...evalOptions,
                enableInteractionRollout: this.options.enableInteractionRollout,
                enableOpponentReplyPly: this.options.enableOpponentReplyPly,
                maxInteractionDepth: this.options.interactionRolloutDepth,
                interactionDiscount: this.options.interactionDiscount,
                interactionScoreWeight: this.options.rolloutInteractionScoreWeight,
                opponentReplyBlend: this.options.opponentReplyBlend,
                opponentReplyTopK: this.options.opponentReplyTopK,
                opponentReplyAggregation: this.options.opponentReplyAggregation,
            }).score;
            const total = scoreStrongBotCandidate(immediate, rollout, this.options, rootStateScore);
            const actionKey = this.toActionKey(action);
            if (total > bestScore || (total === bestScore && actionKey < bestKey)) {
                bestAction = action;
                bestScore = total;
                bestKey = actionKey;
            }
        }

        if (!Number.isFinite(bestScore)) {
            return rankedActions[0] ?? this.fallback.chooseAction(engine, resolvedActorId);
        }

        this.rememberInteractionAction(observation.state, bestAction);
        return bestAction;
    }

    public step(engine: GameEngine, actorPlayerId?: string): boolean {
        const action = this.chooseAction(engine, actorPlayerId);
        if (!action) return false;
        return engine.step(action);
    }

    private sortActions(
        state: ReturnType<GameEngine['getObservation']>['state'],
        actorPlayerId: string,
        actions: EngineAction[],
        evalOptions: ObservationEvaluatorOptions,
    ): EngineAction[] {
        return [...actions].sort((a, b) => {
            const repeatA = this.getRepeatCount(state, a);
            const repeatB = this.getRepeatCount(state, b);
            const scoreA = scoreObservedAction(state, actorPlayerId, a, evalOptions, repeatA).score;
            const scoreB = scoreObservedAction(state, actorPlayerId, b, evalOptions, repeatB).score;
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

    private prepareRepeatMemory(state: GameState): void {
        if (state.interactionMode === 'NORMAL') {
            this.interactionRepeatMemory.clear();
            return;
        }

        if (this.options.repeatMemoryDecay <= 0 || this.interactionRepeatMemory.size === 0) return;
        for (const [key, value] of this.interactionRepeatMemory.entries()) {
            const next = value - this.options.repeatMemoryDecay;
            if (next <= 0) {
                this.interactionRepeatMemory.delete(key);
            } else {
                this.interactionRepeatMemory.set(key, next);
            }
        }
    }

    private getRepeatCount(state: GameState, action: EngineAction): number {
        if (!this.options.enableAntiOscillationPenalty) return 0;
        if (state.interactionMode === 'NORMAL') return 0;
        const key = this.toInteractionSignature(state, action);
        return this.interactionRepeatMemory.get(key) ?? 0;
    }

    private rememberInteractionAction(state: GameState, action: EngineAction): void {
        if (state.interactionMode === 'NORMAL') return;
        const key = this.toInteractionSignature(state, action);
        this.interactionRepeatMemory.set(key, (this.interactionRepeatMemory.get(key) ?? 0) + 1);
        while (this.interactionRepeatMemory.size > this.options.repeatMemoryCapacity) {
            const oldest = this.interactionRepeatMemory.keys().next().value;
            if (!oldest) break;
            this.interactionRepeatMemory.delete(oldest);
        }
    }

    private toInteractionSignature(state: GameState, action: EngineAction): string {
        const pending = state.pendingEffect;
        const actionType = pending?.actionType ?? 'NONE';
        const selectedCount = pending?.selectedTargets?.length ?? 0;
        return `${state.interactionMode}|${actionType}|${selectedCount}|${this.toActionKey(action)}`;
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
