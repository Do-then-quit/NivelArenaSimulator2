import { Phase } from './types';

export interface AutoPhaseAdvanceContext {
    phase: Phase;
    interactionMode: string;
    isLocalHumanInput: boolean;
    hasNextPhaseAction: boolean;
}

const AUTO_ADVANCE_PHASES = new Set<Phase>([Phase.LEVEL_UP, Phase.DRAW, Phase.END]);

export function canAutoAdvancePhase(context: AutoPhaseAdvanceContext): boolean {
    if (context.interactionMode !== 'NORMAL') return false;
    if (!context.isLocalHumanInput) return false;
    if (!AUTO_ADVANCE_PHASES.has(context.phase)) return false;
    return context.hasNextPhaseAction;
}

