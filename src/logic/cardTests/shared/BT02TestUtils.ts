import { GameEngine } from '../../GameEngine';
import { EngineAction } from '../../types';

export function setBt02TestSize(engine: GameEngine): void {
    engine.state.players.forEach(player => {
        player.leaderLevel = 10;
    });
}

function pickInteractionAction(actions: EngineAction[]): EngineAction {
    const optionalConfirm = actions.find(
        action => action.type === 'RESOLVE_OPTIONAL' && action.confirm === true
    );
    if (optionalConfirm) return optionalConfirm;

    const nonConfirm = actions.find(action => action.type !== 'CONFIRM_TARGETS');
    if (nonConfirm) return nonConfirm;

    return actions[0];
}

export function resolveInteractionLoop(engine: GameEngine, maxSteps = 30): void {
    for (let step = 0; step < maxSteps; step += 1) {
        if (engine.state.interactionMode === 'NORMAL' || !engine.state.pendingEffect) {
            return;
        }

        const actorId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const actions = engine.getLegalActions(actorId);
        if (actions.length === 0) {
            return;
        }

        const action = pickInteractionAction(actions);
        const ok = engine.step(action);
        if (!ok) {
            return;
        }
    }
}
