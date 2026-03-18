import { GameEngine } from '../../GameEngine';
import { EngineAction, Phase, PlayerState } from '../../types';
import { StrongBotV3, StrongBotV3Options } from '../StrongBotV3';
import {
    PracticeConfirmTargetsAction,
    PracticeHandTargetAction,
    PracticeMainPhaseAction,
    PracticeMulliganAction,
    PracticeOptionalAction,
    PracticeProfile,
    PracticeRevealedTargetAction,
    PracticeTrashTargetAction,
    PracticeZoneTargetAction,
} from './types';

export interface PracticeStrongBotOptions extends Partial<StrongBotV3Options> {
    preferPracticeMainPhaseHold?: boolean;
    preferPracticeMainPhaseHoldMaxLeaderLevel?: number;
}

export class PracticeStrongBot {
    readonly name: string;
    readonly profile: PracticeProfile;
    private readonly delegate: StrongBotV3;
    private readonly preferPracticeMainPhaseHold: boolean;
    private readonly preferPracticeMainPhaseHoldMaxLeaderLevel: number;

    constructor(name: string, profile: PracticeProfile, options: PracticeStrongBotOptions = {}) {
        this.name = name;
        this.profile = profile;
        this.delegate = new StrongBotV3(`${name}-StrongV3`, options);
        this.preferPracticeMainPhaseHold = options.preferPracticeMainPhaseHold ?? false;
        this.preferPracticeMainPhaseHoldMaxLeaderLevel = options.preferPracticeMainPhaseHoldMaxLeaderLevel ?? 6;
    }

    public chooseAction(engine: GameEngine, actorPlayerId?: string): EngineAction | null {
        const resolvedActorId = actorPlayerId ?? engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const observation = engine.getObservation(resolvedActorId);
        if (!observation.canAct || observation.legalActions.length === 0) return null;

        const practiceAction = this.choosePracticeAction(engine, resolvedActorId, observation.legalActions);
        if (practiceAction) return practiceAction;

        return this.delegate.chooseAction(engine, resolvedActorId);
    }

    public step(engine: GameEngine, actorPlayerId?: string): boolean {
        const action = this.chooseAction(engine, actorPlayerId);
        if (!action) return false;
        return engine.step(action);
    }

    private choosePracticeAction(engine: GameEngine, actorPlayerId: string, actions: EngineAction[]): EngineAction | null {
        const actor = this.getPlayerById(engine, actorPlayerId);
        if (!actor) return null;

        const mulliganActions = this.filterByType(actions, 'RESOLVE_MULLIGAN');
        if (mulliganActions.length > 0 && this.profile.chooseMulliganAction) {
            const keepAction = mulliganActions.find(action => !action.shouldMulligan) ?? null;
            const redrawAction = mulliganActions.find(action => action.shouldMulligan) ?? null;
            return this.profile.chooseMulliganAction({
                engine,
                actorPlayerId,
                actor,
                actions: mulliganActions,
                keepAction,
                redrawAction,
            });
        }

        if (engine.state.interactionMode !== 'NORMAL') {
            const optionalActions = this.filterByType(actions, 'RESOLVE_OPTIONAL');
            if (optionalActions.length > 0 && this.profile.chooseOptionalAction) {
                const practiceAction = this.profile.chooseOptionalAction({
                    engine,
                    actorPlayerId,
                    actor,
                    actions: optionalActions,
                });
                if (practiceAction) return practiceAction;
            }

            const confirmActions = this.filterByType(actions, 'CONFIRM_TARGETS');
            if (confirmActions.length > 0 && this.profile.chooseConfirmTargetsAction) {
                const practiceAction = this.profile.chooseConfirmTargetsAction({
                    engine,
                    actorPlayerId,
                    actor,
                    actions: confirmActions,
                });
                if (practiceAction) return practiceAction;
            }

            const handActions = this.filterByType(actions, 'SELECT_HAND_TARGET');
            if (handActions.length > 0 && this.profile.chooseHandTargetAction) {
                const practiceAction = this.profile.chooseHandTargetAction({
                    engine,
                    actorPlayerId,
                    actor,
                    actions: handActions,
                });
                if (practiceAction) return practiceAction;
            }

            const zoneActions = this.filterByType(actions, 'SELECT_ZONE_TARGET');
            if (zoneActions.length > 0 && this.profile.chooseZoneTargetAction) {
                const practiceAction = this.profile.chooseZoneTargetAction({
                    engine,
                    actorPlayerId,
                    actor,
                    actions: zoneActions,
                });
                if (practiceAction) return practiceAction;
            }

            const trashActions = this.filterByType(actions, 'SELECT_TRASH_TARGET');
            if (trashActions.length > 0 && this.profile.chooseTrashTargetAction) {
                const practiceAction = this.profile.chooseTrashTargetAction({
                    engine,
                    actorPlayerId,
                    actor,
                    actions: trashActions,
                });
                if (practiceAction) return practiceAction;
            }

            const revealedActions = this.filterByType(actions, 'SELECT_REVEALED_TARGET');
            if (revealedActions.length > 0 && this.profile.chooseRevealedTargetAction) {
                const practiceAction = this.profile.chooseRevealedTargetAction({
                    engine,
                    actorPlayerId,
                    actor,
                    actions: revealedActions,
                });
                if (practiceAction) return practiceAction;
            }

            return null;
        }

        if (engine.state.phase === Phase.MAIN && this.profile.chooseMainPhaseAction) {
            const practiceActions = actions.filter((action): action is PracticeMainPhaseAction => (
                action.type === 'PLAY_UNIT'
                || action.type === 'PLAY_ITEM'
                || action.type === 'PLAY_SKILL'
                || action.type === 'ACTIVATE_EFFECT'
                || action.type === 'NEXT_PHASE'
            ));
            const practiceAction = this.profile.chooseMainPhaseAction({
                engine,
                actorPlayerId,
                actor,
                actions: practiceActions,
            });
            if (practiceAction) return practiceAction;

            if (this.shouldHoldMainPhaseFallback(engine, actor, practiceActions)) {
                const nextPhaseAction = practiceActions.find((action): action is Extract<PracticeMainPhaseAction, { type: 'NEXT_PHASE' }> => action.type === 'NEXT_PHASE');
                if (nextPhaseAction) return nextPhaseAction;
            }

            return null;
        }

        return null;
    }

    private getPlayerById(engine: GameEngine, actorPlayerId: string): PlayerState | null {
        return engine.state.players.find(player => player.id === actorPlayerId) ?? null;
    }

    private shouldHoldMainPhaseFallback(
        engine: GameEngine,
        actor: PlayerState,
        actions: PracticeMainPhaseAction[],
    ): boolean {
        if (!this.preferPracticeMainPhaseHold) return false;
        if (!this.isNikkiPracticeProfile()) return false;
        if (engine.state.phase !== Phase.MAIN || engine.state.interactionMode !== 'NORMAL') return false;
        if (actor.leaderLevel > this.preferPracticeMainPhaseHoldMaxLeaderLevel) return false;

        const hasNextPhase = actions.some(action => action.type === 'NEXT_PHASE');
        const hasProgressAction = actions.some(action => action.type !== 'NEXT_PHASE');
        return hasNextPhase && hasProgressAction;
    }

    private isNikkiPracticeProfile(): boolean {
        const profileId = this.profile.id.trim().toLowerCase();
        const profileLabel = this.profile.label.trim().toLowerCase();
        return profileId.startsWith('practice-bt05-nikki') || profileLabel.includes('nikki');
    }

    private filterByType(actions: EngineAction[], type: 'RESOLVE_MULLIGAN'): PracticeMulliganAction[];
    private filterByType(actions: EngineAction[], type: 'RESOLVE_OPTIONAL'): PracticeOptionalAction[];
    private filterByType(actions: EngineAction[], type: 'CONFIRM_TARGETS'): PracticeConfirmTargetsAction[];
    private filterByType(actions: EngineAction[], type: 'SELECT_HAND_TARGET'): PracticeHandTargetAction[];
    private filterByType(actions: EngineAction[], type: 'SELECT_ZONE_TARGET'): PracticeZoneTargetAction[];
    private filterByType(actions: EngineAction[], type: 'SELECT_TRASH_TARGET'): PracticeTrashTargetAction[];
    private filterByType(actions: EngineAction[], type: 'SELECT_REVEALED_TARGET'): PracticeRevealedTargetAction[];
    private filterByType(actions: EngineAction[], type: EngineAction['type']): EngineAction[] {
        return actions.filter(action => action.type === type);
    }
}
