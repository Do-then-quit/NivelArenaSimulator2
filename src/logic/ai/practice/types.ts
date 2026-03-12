import { GameEngine } from '../../GameEngine';
import { EngineAction, PlayerState } from '../../types';

export type PracticeMulliganAction = Extract<EngineAction, { type: 'RESOLVE_MULLIGAN' }>;
export type PracticeMainPhaseAction = Extract<EngineAction, { type: 'PLAY_UNIT' | 'PLAY_ITEM' | 'PLAY_SKILL' | 'ACTIVATE_EFFECT' | 'NEXT_PHASE' }>;
export type PracticeHandTargetAction = Extract<EngineAction, { type: 'SELECT_HAND_TARGET' }>;
export type PracticeTrashTargetAction = Extract<EngineAction, { type: 'SELECT_TRASH_TARGET' }>;

export interface PracticeContextBase {
    engine: GameEngine;
    actorPlayerId: string;
    actor: PlayerState;
    actions: EngineAction[];
}

export interface PracticeMulliganContext extends PracticeContextBase {
    keepAction: PracticeMulliganAction | null;
    redrawAction: PracticeMulliganAction | null;
}

export interface PracticeMainPhaseContext extends PracticeContextBase {
    actions: PracticeMainPhaseAction[];
}

export interface PracticeHandTargetContext extends PracticeContextBase {
    actions: PracticeHandTargetAction[];
}

export interface PracticeTrashTargetContext extends PracticeContextBase {
    actions: PracticeTrashTargetAction[];
}

export interface PracticeProfile {
    id: string;
    label: string;
    chooseMulliganAction?(context: PracticeMulliganContext): PracticeMulliganAction | null;
    chooseMainPhaseAction?(context: PracticeMainPhaseContext): PracticeMainPhaseAction | null;
    chooseHandTargetAction?(context: PracticeHandTargetContext): PracticeHandTargetAction | null;
    chooseTrashTargetAction?(context: PracticeTrashTargetContext): PracticeTrashTargetAction | null;
}
