import { EngineAction, GameState, Phase, PlayerState } from '../../types';

export interface Bt05NikkiMainPhaseHoldPolicyEntry {
    samples: number;
    holdCount: number;
    continueCount: number;
    holdRate: number;
    avgReturnToGo: number;
}

export interface Bt05NikkiMainPhaseHoldPolicy {
    id: string;
    label: string;
    minSamples: number;
    minHoldRate: number;
    minAverageReturnToGo: number;
    entries: Record<string, Bt05NikkiMainPhaseHoldPolicyEntry>;
}

function getPlayerById(state: GameState, playerId: string): PlayerState | null {
    return state.players.find(player => player.id === playerId) ?? null;
}

function countFieldUnits(player: PlayerState): number {
    return player.unitZones.filter(zone => !!zone.unit).length;
}

function countDirectLanes(attacker: PlayerState, defender: PlayerState): number {
    let count = 0;
    for (let lane = 0; lane < attacker.unitZones.length; lane++) {
        if (!attacker.unitZones[lane].unit) continue;
        if (defender.unitZones[lane].unit) continue;
        count += 1;
    }
    return count;
}

function countUpgradeActions(actor: PlayerState, actions: EngineAction[]): number {
    return actions.filter((action): action is Extract<EngineAction, { type: 'PLAY_UNIT' }> => action.type === 'PLAY_UNIT')
        .filter(action => !!actor.unitZones[action.zoneIndex]?.unit)
        .length;
}

function countEmptyLaneUnitActions(actor: PlayerState, actions: EngineAction[]): number {
    return actions.filter((action): action is Extract<EngineAction, { type: 'PLAY_UNIT' }> => action.type === 'PLAY_UNIT')
        .filter(action => !actor.unitZones[action.zoneIndex]?.unit)
        .length;
}

function bucketLeaderLevel(value: number): string {
    if (value <= 2) return '0-2';
    if (value <= 4) return '3-4';
    if (value <= 6) return '5-6';
    return '7+';
}

function bucketDamage(value: number): string {
    if (value <= 0) return '0';
    if (value <= 2) return '1-2';
    if (value <= 4) return '3-4';
    if (value <= 6) return '5-6';
    return '7+';
}

function bucketHandSize(value: number): string {
    if (value <= 2) return '0-2';
    if (value <= 4) return '3-4';
    if (value <= 6) return '5-6';
    return '7+';
}

function bucketCount(value: number, maxExact: number): string {
    if (value <= maxExact) return String(value);
    return `${maxExact}+`;
}

export function buildBt05NikkiMainPhaseHoldSignature(
    state: GameState,
    actorPlayerId: string,
    actions: EngineAction[],
): string | null {
    if (state.phase !== Phase.MAIN || state.interactionMode !== 'NORMAL') return null;

    const actor = getPlayerById(state, actorPlayerId);
    const opponent = state.players.find(player => player.id !== actorPlayerId) ?? null;
    if (!actor || !opponent) return null;

    const nextPhaseCount = actions.filter(action => action.type === 'NEXT_PHASE').length;
    const progressActions = actions.filter(action => action.type !== 'NEXT_PHASE');
    if (nextPhaseCount === 0 || progressActions.length === 0) return null;

    const playUnitCount = progressActions.filter(action => action.type === 'PLAY_UNIT').length;
    const playItemCount = progressActions.filter(action => action.type === 'PLAY_ITEM').length;
    const playSkillCount = progressActions.filter(action => action.type === 'PLAY_SKILL').length;
    const activateCount = progressActions.filter(action => action.type === 'ACTIVATE_EFFECT').length;

    return [
        `lvl=${bucketLeaderLevel(actor.leaderLevel)}`,
        `md=${bucketDamage(actor.damage.length)}`,
        `od=${bucketDamage(opponent.damage.length)}`,
        `mh=${bucketHandSize(actor.hand.length)}`,
        `oh=${bucketHandSize(opponent.hand.length)}`,
        `mf=${countFieldUnits(actor)}`,
        `of=${countFieldUnits(opponent)}`,
        `direct=${countDirectLanes(actor, opponent)}`,
        `oppDirect=${countDirectLanes(opponent, actor)}`,
        `playU=${bucketCount(playUnitCount, 2)}`,
        `upgradeU=${bucketCount(countUpgradeActions(actor, progressActions), 2)}`,
        `emptyLaneU=${bucketCount(countEmptyLaneUnitActions(actor, progressActions), 2)}`,
        `playI=${bucketCount(playItemCount, 1)}`,
        `playS=${bucketCount(playSkillCount, 1)}`,
        `act=${bucketCount(activateCount, 1)}`,
    ].join('|');
}

export function shouldApplyBt05NikkiMainPhaseHoldPolicy(
    policy: Bt05NikkiMainPhaseHoldPolicy | undefined,
    signature: string | null,
): boolean {
    if (!policy || !signature) return false;
    const entry = policy.entries[signature];
    if (!entry) return false;
    if (entry.samples < policy.minSamples) return false;
    if (entry.holdRate < policy.minHoldRate) return false;
    if (entry.avgReturnToGo < policy.minAverageReturnToGo) return false;
    return true;
}
