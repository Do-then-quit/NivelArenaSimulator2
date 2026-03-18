import { GameEngine } from '../../GameEngine';
import { EngineAction, GameState } from '../../types';
import { evaluateObservedState, ObservationEvaluatorOptions, scoreObservedAction } from './ObservationEvaluator';

export interface CounterfactualRolloutOptions extends ObservationEvaluatorOptions {
    enableInteractionRollout: boolean;
    enableOpponentReplyPly: boolean;
    maxInteractionDepth: number;
    interactionDiscount: number;
    interactionScoreWeight: number;
    opponentReplyBlend: number;
    opponentReplyTopK: number;
    opponentReplyAggregation: 'max' | 'mean' | 'weighted';
}

export interface CounterfactualRolloutResult {
    score: number;
    stateScore: number;
    interactionScore: number;
    opponentReplyApplied: boolean;
}

interface RankedAction {
    action: EngineAction;
    score: number;
}

function toActionKey(action: EngineAction): string {
    const payload = Object.entries(action)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${String(value)}`)
        .join('|');
    return `${action.type}|${payload}`;
}

function getDefaultActorId(state: GameState): string {
    return state.players[state.turnPlayerIndex].id;
}

function getInteractionSignature(state: GameState, action: EngineAction): string {
    const pending = state.pendingEffect;
    const actionType = pending?.actionType ?? 'NONE';
    const selectedCount = pending?.selectedTargets?.length ?? 0;
    return `${state.interactionMode}|${actionType}|${selectedCount}|${toActionKey(action)}`;
}

function getWinnerBonus(state: GameState, actorPlayerId: string): number {
    if (!state.winner) return 0;
    return state.winner === actorPlayerId ? 75000 : -75000;
}

function clamp01(value: number): number {
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
}

function pickBestActionWithLookahead(
    engine: GameEngine,
    actorPlayerId: string,
    state: GameState,
    legalActions: EngineAction[],
    options: CounterfactualRolloutOptions,
    repeatCounts: Map<string, number>,
): RankedAction | null {
    return rankActionsWithLookahead(engine, actorPlayerId, state, legalActions, options, repeatCounts)[0] ?? null;
}

function rankActionsWithLookahead(
    engine: GameEngine,
    actorPlayerId: string,
    state: GameState,
    legalActions: EngineAction[],
    options: CounterfactualRolloutOptions,
    repeatCounts: Map<string, number>,
): RankedAction[] {
    if (legalActions.length === 0) return [];

    const ranked: RankedAction[] = [];

    for (const action of legalActions) {
        const signature = getInteractionSignature(state, action);
        const repeatCount = repeatCounts.get(signature) ?? 0;
        const immediate = scoreObservedAction(state, actorPlayerId, action, options, repeatCount).score;

        const branch = engine.createSimulationFork();
        if (!branch.step(action)) continue;

        const branchState = branch.getObservation(actorPlayerId).state;
        const lookaheadState = evaluateObservedState(branchState, actorPlayerId, options).total + getWinnerBonus(branchState, actorPlayerId);
        const combined = immediate * 0.42 + lookaheadState * 0.58;
        ranked.push({ action, score: combined });
    }

    ranked.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return toActionKey(a.action).localeCompare(toActionKey(b.action));
    });

    return ranked;
}

export function aggregateOpponentReplyScores(
    scores: number[],
    mode: CounterfactualRolloutOptions['opponentReplyAggregation'],
): number {
    if (scores.length === 0) return Number.NaN;
    if (mode === 'max') return Math.max(...scores);
    if (mode === 'mean') return scores.reduce((sum, score) => sum + score, 0) / scores.length;

    let weightedSum = 0;
    let totalWeight = 0;
    for (let i = 0; i < scores.length; i++) {
        const weight = scores.length - i;
        weightedSum += scores[i] * weight;
        totalWeight += weight;
    }
    if (totalWeight <= 0) return scores[0];

    const weightedAverage = weightedSum / totalWeight;
    const spreadPenalty = Math.max(0, scores[0] - scores[scores.length - 1]) * 0.08;
    return weightedAverage - spreadPenalty;
}

export function runCounterfactualRollout(
    engine: GameEngine,
    actorPlayerId: string,
    rootAction: EngineAction,
    options: CounterfactualRolloutOptions,
): CounterfactualRolloutResult {
    try {
        const fork = engine.createSimulationFork();
        if (!fork.step(rootAction)) {
            return {
                score: Number.NEGATIVE_INFINITY,
                stateScore: Number.NEGATIVE_INFINITY,
                interactionScore: Number.NEGATIVE_INFINITY,
                opponentReplyApplied: false,
            };
        }

        let interactionScore = 0;
        const repeatCounts = new Map<string, number>();

        if (options.enableInteractionRollout) {
            const maxDepth = Math.max(0, Math.trunc(options.maxInteractionDepth));
            const interactionDiscount = Math.max(0, options.interactionDiscount);

            for (let depth = 0; depth < maxDepth; depth++) {
                const actorObservation = fork.getObservation(actorPlayerId);
                const currentActor = actorObservation.interactionOwnerPlayerId ?? getDefaultActorId(actorObservation.state);
                if (currentActor !== actorPlayerId) break;
                if (!actorObservation.canAct || actorObservation.legalActions.length === 0) break;
                if (actorObservation.state.interactionMode === 'NORMAL') break;

                const selected = pickBestActionWithLookahead(
                    fork,
                    actorPlayerId,
                    actorObservation.state,
                    actorObservation.legalActions,
                    options,
                    repeatCounts,
                );
                if (!selected) break;

                const signature = getInteractionSignature(actorObservation.state, selected.action);
                repeatCounts.set(signature, (repeatCounts.get(signature) ?? 0) + 1);
                if (!fork.step(selected.action)) break;

                interactionScore += selected.score * Math.pow(interactionDiscount, depth);
            }
        }

        const afterRootState = fork.getObservation(actorPlayerId).state;
        let stateScore = evaluateObservedState(afterRootState, actorPlayerId, options).total + getWinnerBonus(afterRootState, actorPlayerId);
        let opponentReplyApplied = false;

        if (options.enableOpponentReplyPly) {
            const nextActor = afterRootState.interactionOwnerPlayerId ?? getDefaultActorId(afterRootState);
            if (nextActor !== actorPlayerId) {
                const opponentObservation = fork.getObservation(nextActor);
                if (opponentObservation.canAct && opponentObservation.legalActions.length > 0) {
                    const rankedReplies = rankActionsWithLookahead(
                        fork,
                        nextActor,
                        opponentObservation.state,
                        opponentObservation.legalActions,
                        options,
                        new Map(),
                    );
                    const topK = Math.max(1, Math.trunc(options.opponentReplyTopK));
                    const replyCandidates = rankedReplies.slice(0, topK);
                    const replyScores: number[] = [];

                    for (const candidate of replyCandidates) {
                        const replyFork = fork.createSimulationFork();
                        if (!replyFork.step(candidate.action)) continue;
                        const afterReplyState = replyFork.getObservation(actorPlayerId).state;
                        const afterReplyScore =
                            evaluateObservedState(afterReplyState, actorPlayerId, options).total
                            + getWinnerBonus(afterReplyState, actorPlayerId);
                        replyScores.push(afterReplyScore);
                    }

                    if (replyScores.length > 0) {
                        const aggregatedReplyScore = aggregateOpponentReplyScores(replyScores, options.opponentReplyAggregation);
                        const blend = clamp01(options.opponentReplyBlend);
                        stateScore = stateScore * (1 - blend) + aggregatedReplyScore * blend;
                        opponentReplyApplied = true;
                    }
                }
            }
        }

        const totalScore = stateScore + interactionScore * options.interactionScoreWeight;
        return {
            score: totalScore,
            stateScore,
            interactionScore,
            opponentReplyApplied,
        };
    } catch {
        return {
            score: Number.NEGATIVE_INFINITY,
            stateScore: Number.NEGATIVE_INFINITY,
            interactionScore: Number.NEGATIVE_INFINITY,
            opponentReplyApplied: false,
        };
    }
}
