import { GameEngine } from '../GameEngine';
import { EngineAction, Phase } from '../types';
import { BaselineBot } from './BaselineBot';
import { scoreAction } from './eval/ActionScorer';
import { evaluateState } from './eval/StateEvaluator';

export class StrongBot {
    readonly name: string;
    private readonly fallback: BaselineBot;

    constructor(name: string = 'StrongBot-v1') {
        this.name = name;
        this.fallback = new BaselineBot(`${name}-Fallback`);
    }

    public chooseAction(engine: GameEngine, actorPlayerId?: string): EngineAction | null {
        const resolvedActorId = actorPlayerId ?? engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const observation = engine.getObservation(resolvedActorId);
        if (!observation.canAct || observation.legalActions.length === 0) return null;

        if (engine.state.interactionMode !== 'NORMAL') {
            return this.fallback.chooseAction(engine, resolvedActorId);
        }

        if (engine.state.phase === Phase.BLOCK) {
            return this.pickByScore(engine, resolvedActorId, observation.legalActions);
        }

        if (engine.state.phase === Phase.MAIN || engine.state.phase === Phase.ATTACK) {
            return this.pickByScore(engine, resolvedActorId, observation.legalActions);
        }

        return this.fallback.chooseAction(engine, resolvedActorId);
    }

    public step(engine: GameEngine, actorPlayerId?: string): boolean {
        const action = this.chooseAction(engine, actorPlayerId);
        if (!action) return false;
        return engine.step(action);
    }

    private pickByScore(engine: GameEngine, actorPlayerId: string, actions: EngineAction[]): EngineAction {
        const stateScore = evaluateState(engine, actorPlayerId).total;
        let bestAction = actions[0];
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const action of actions) {
            const scored = scoreAction(engine, actorPlayerId, action);

            // Phase 1 surrogate lookahead:
            // state baseline + action tactical score. This remains deterministic and cheap.
            const totalScore = stateScore * 0.03 + scored.score;
            if (totalScore > bestScore) {
                bestAction = action;
                bestScore = totalScore;
            }
        }

        return bestAction;
    }
}

