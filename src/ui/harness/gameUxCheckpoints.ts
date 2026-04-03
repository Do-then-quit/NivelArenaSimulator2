import { GameEngine } from '../../logic/GameEngine';
import {
    ActivationCondition,
    Attribute,
    Card,
    CardType,
    Effect,
    Phase,
    PlayerState,
    TargetSchema,
} from '../../logic/types';

export type GameUxCheckpoint =
    | 'P1_MAIN_AFTER_MULLIGAN'
    | 'ATTACK_DECLARE_WINDOW'
    | 'BLOCK_DECISION_WINDOW'
    | 'MANDATORY_TARGET_SELECTION'
    | 'END_PHASE_HAND_ADJUST';

function makeLeader(id: string, name: string): Card {
    return {
        id,
        name,
        type: CardType.LEADER,
        attribute: Attribute.FIRE,
        cost: 0,
        text: '',
        effects: [],
    };
}

function makeUnit(id: string, name: string, cost: number, effects: Effect[] = []): Card {
    return {
        id,
        name,
        type: CardType.UNIT,
        attribute: Attribute.FIRE,
        cost,
        power: 3000 + (cost * 500),
        hit: 3000 + (cost * 500),
        text: effects.map(effect => effect.description).join('\n'),
        effects,
    };
}

function makeSkill(id: string, name: string, cost: number): Card {
    return {
        id,
        name,
        type: CardType.SKILL,
        attribute: Attribute.FIRE,
        cost,
        text: `${name} 스킬`,
        effects: [],
    };
}

function createHarnessEngine(seed: number = 20260327, enableUiTrace: boolean = true): GameEngine {
    const leader1 = makeLeader('UX-P1-LEADER', '플레이어 1 리더');
    const leader2 = makeLeader('UX-P2-LEADER', '플레이어 2 리더');
    const deck1 = Array.from({ length: 30 }, (_, index) => makeUnit(`UX-P1-DECK-${index + 1}`, `P1 덱 카드 ${index + 1}`, 1));
    const deck2 = Array.from({ length: 30 }, (_, index) => makeUnit(`UX-P2-DECK-${index + 1}`, `P2 덱 카드 ${index + 1}`, 1));

    return new GameEngine('플레이어 1', '플레이어 2', deck1, deck2, leader1, leader2, {
        enableMulligan: false,
        enableUiTrace,
        seed,
    });
}

function resetPlayer(player: PlayerState, leaderId: string): void {
    player.deck = Array.from({ length: 8 }, (_, index) => makeUnit(`${leaderId}-DECK-${index + 1}`, `${player.name} 덱 카드 ${index + 1}`, 1));
    player.hand = [];
    player.trash = [];
    player.damage = [];
    player.levelZone = makeLeader(leaderId, `${player.name} 리더`);
    player.leaderLevel = 1;
    player.skillZone = [];
    player.lockedSkillTraitsUntilTurnEnd = {};
    player.lockedActivationsUntilTurnEnd = {};
    player.lockedActivationsUntilTurnCount = {};
    player.unitZones.forEach((zone) => {
        zone.unit = null;
        zone.items = [];
        zone.buffs = [];
        zone.temporaryEffects = [];
        zone.isExhausted = false;
        zone.hasAttacked = false;
        zone.hasPlacedUnitThisTurn = false;
        zone.hasActivatedEffectThisTurn = false;
        zone.activatedEffectKeys = {};
        zone.attackCountThisTurn = 0;
        zone.extraAttackAllowance = 0;
    });
}

function resetEngineState(engine: GameEngine): { p1: PlayerState; p2: PlayerState } {
    const p1 = engine.state.players[0];
    const p2 = engine.state.players[1];

    p1.id = 'P1';
    p1.name = '플레이어 1';
    p2.id = 'P2';
    p2.name = '플레이어 2';

    resetPlayer(p1, 'UX-P1-LEADER');
    resetPlayer(p2, 'UX-P2-LEADER');

    engine.state.turnPlayerIndex = 0;
    engine.state.phase = Phase.MAIN;
    engine.state.turnCount = 1;
    engine.state.winner = null;
    engine.state.pendingAttackerIndex = null;
    engine.state.pendingBlockerZoneIndex = null;
    engine.state.interactionMode = 'NORMAL';
    engine.state.interactionOwnerPlayerId = p1.id;
    engine.state.pendingEffect = null;
    engine.state.mulliganState = null;
    engine.state.mulliganResultByPlayerId = {};
    engine.state.revealedCards = [];
    engine.state.effectQueue = [];
    engine.state.deferredEffectQueue = [];
    engine.state.damageProcessingDepth = 0;
    engine.state.globalStep = 0;
    engine.state.combatStep = 'NONE';
    engine.state.combatBlocked = false;
    engine.state.turnStats = {
        effectTrashedFriendlyUnitCountByPlayerId: {},
        handTrashedByEffectCountByPlayerId: {},
        unitAttackCountByPlayerId: {},
    };
    engine.setPendingRuntime(null);
    engine.setInteractionOwner(p1.id);

    return { p1, p2 };
}

function createMainAfterMulliganCheckpoint(engine: GameEngine, p1: PlayerState, p2: PlayerState): void {
    const spentActiveEffect: Effect = {
        id: 'used-active',
        activation: ActivationCondition.ACTIVE_MAIN,
        description: '카드 1장을 드로우한다.',
        action: { type: 'DRAW', params: { amount: 1 } },
    };

    p1.leaderLevel = 2;
    p1.hand = [
        makeUnit('UX-HAND-LEGAL', '신병 배치', 1),
        makeUnit('UX-HAND-OVERSIZE', '대형 증원', 3),
        makeSkill('UX-HAND-SKILL', '보급 지시', 2),
    ];
    p1.unitZones[0].unit = makeUnit('UX-FIELD-ACTIVE', '전열 병사', 1, [spentActiveEffect]);
    p1.unitZones[0].hasPlacedUnitThisTurn = true;
    p1.unitZones[0].activatedEffectKeys = {
        'UX-FIELD-ACTIVE_used-active': true,
    };
    p2.unitZones[1].unit = makeUnit('UX-OPP-GUARD', '상대 경비병', 1);

    engine.state.phase = Phase.MAIN;
    engine.traceUiEvent('PHASE_CHANGED', {
        sourcePlayerId: p1.id,
    });
    engine.traceUiEvent('EFFECT_EXECUTED', {
        sourcePlayerId: p1.id,
        sourceCardId: p1.unitZones[0].unit.id,
        sourceCardName: p1.unitZones[0].unit.name,
        effectDescription: '메인 페이즈 배치/업그레이드 판단 준비',
    });
}

function createAttackDeclareWindowCheckpoint(engine: GameEngine, p1: PlayerState, p2: PlayerState): void {
    p1.leaderLevel = 4;
    p1.unitZones[0].unit = makeUnit('UX-ATTACK-READY', '공격 준비 유닛', 1);
    p1.unitZones[1].unit = makeUnit('UX-ATTACK-EXHAUSTED', '지친 유닛', 1);
    p1.unitZones[1].isExhausted = true;
    p1.unitZones[2].unit = makeUnit('UX-ATTACK-SPENT', '이미 공격한 유닛', 1);
    p1.unitZones[2].hasAttacked = true;
    p2.unitZones[0].unit = makeUnit('UX-BLOCK-TARGET', '방어 대상', 1);

    engine.state.phase = Phase.ATTACK;
    engine.state.combatStep = 'ATTACK_DECLARATION';
    engine.setInteractionOwner(p1.id);
    engine.traceUiEvent('PHASE_CHANGED', {
        sourcePlayerId: p1.id,
    });
}

function createBlockDecisionWindowCheckpoint(engine: GameEngine, p1: PlayerState, p2: PlayerState): void {
    p1.leaderLevel = 4;
    p1.unitZones[0].unit = makeUnit('UX-ATTACKER', '선공 병사', 1);
    p2.unitZones[0].unit = makeUnit('UX-BLOCKER-READY', '가드 가능 유닛', 1);
    p2.unitZones[1].unit = makeUnit('UX-BLOCKER-SPENT', '이미 사용한 유닛', 1);
    p2.unitZones[1].hasAttacked = true;
    p2.unitZones[2].unit = makeUnit('UX-BLOCKER-EXHAUSTED', '지친 수비 유닛', 1);
    p2.unitZones[2].isExhausted = true;

    engine.state.phase = Phase.BLOCK;
    engine.state.combatStep = 'DEFENSE_DECLARATION';
    engine.state.pendingAttackerIndex = 0;
    engine.state.combatBlocked = false;
    engine.setInteractionOwner(p2.id);
    engine.traceUiEvent('PHASE_CHANGED', {
        sourcePlayerId: p1.id,
    });
    engine.traceUiEvent('INTERACTION_OPENED', {
        sourcePlayerId: p2.id,
        sourceCardId: p2.unitZones[0].unit?.id,
        sourceCardName: p2.unitZones[0].unit?.name,
        interactionMode: 'NORMAL',
        effectDescription: '방어 유닛 선택',
        actionType: 'RESOLVE_BLOCK',
    });
}

function createMandatoryTargetSelectionCheckpoint(engine: GameEngine, p1: PlayerState, p2: PlayerState): void {
    const targetSchema: TargetSchema = {
        scope: 'OPP_FIELD',
        type: 'UNIT',
        count: 1,
        selectMode: 'MANUAL',
    };
    const effect: Effect = {
        id: 'entry-destroy',
        activation: ActivationCondition.ENTRY,
        description: '엔트리 : 상대 유닛 1장을 파괴한다.',
        targets: targetSchema,
        action: { type: 'DESTROY_UNIT', params: {} },
    };
    const sourceUnit = makeUnit('UX-ENTRY-SOURCE', '엔트리 병사', 1, [effect]);

    p1.unitZones[1].unit = sourceUnit;
    p2.unitZones[0].unit = makeUnit('UX-TARGET-A', '전방 목표', 1);
    p2.unitZones[2].unit = makeUnit('UX-TARGET-B', '후방 목표', 2);

    engine.state.phase = Phase.MAIN;
    engine.state.interactionMode = 'SELECT_TARGET';
    engine.state.pendingEffect = {
        sourceCard: sourceUnit,
        sourcePlayerId: p1.id,
        controllerPlayerId: p1.id,
        actionType: 'DESTROY_UNIT',
        actionValue: {},
        effectDescription: effect.description,
        sourceEffectDescription: effect.description,
        sourceActivation: ActivationCondition.ENTRY,
        triggerReason: '이 유닛이 유닛 존에 등장했기 때문에 발동',
        selectionPurpose: '효과 대상 지정',
        validTargets: 'OPP_FIELD',
        targetSchema,
        selectedTargets: [],
    };
    engine.setPendingRuntime({
        sourceCard: sourceUnit,
        player: p1,
        opponent: p2,
        unitZone: p1.unitZones[1],
        machine: engine,
        sourceActivation: ActivationCondition.ENTRY,
        sourceEffectDescription: effect.description,
    }, effect);
    engine.setInteractionOwner(p1.id);
    engine.traceUiEvent('INTERACTION_OPENED', {
        sourcePlayerId: p1.id,
        sourceCardId: sourceUnit.id,
        sourceCardName: sourceUnit.name,
        interactionMode: 'SELECT_TARGET',
        effectDescription: effect.description,
        actionType: 'DESTROY_UNIT',
    });
}

function makeHandCard(id: string): Card {
    return {
        id,
        name: `핸드 카드 ${id}`,
        type: CardType.UNIT,
        attribute: Attribute.FIRE,
        cost: 1,
        power: 1000,
        hit: 1000,
        text: '',
        effects: [],
    };
}

function createEndPhaseHandAdjustCheckpoint(engine: GameEngine, p1: PlayerState, p2: PlayerState): void {
    const discardSchema: TargetSchema = {
        scope: 'MY_HAND',
        type: 'CARD',
        count: 1,
        selectMode: 'MANUAL',
    };
    const endPhaseEffect: Effect = {
        id: 'end-phase-hand-adjust',
        activation: ActivationCondition.TURN_END,
        description: '핸드 제한(7장)까지 버릴 카드 지정',
        targets: discardSchema,
        action: { type: 'TRASH_SELF', params: {} },
    };

    p1.hand = Array.from({ length: 8 }, (_, index) => makeHandCard(`E${index + 1}`));
    engine.state.phase = Phase.END;
    engine.state.interactionMode = 'SELECT_TARGET';
    engine.state.pendingEffect = {
        sourceCard: p1.levelZone!,
        sourcePlayerId: p1.id,
        controllerPlayerId: p1.id,
        actionType: 'END_PHASE_HAND_ADJUST',
        actionValue: { requiredDiscardCount: 1 },
        effectDescription: endPhaseEffect.description,
        triggerReason: '턴 종료 규칙 처리',
        selectionPurpose: '핸드 제한(7장)까지 버릴 카드 지정',
        validTargets: 'MY_HAND',
        targetSchema: discardSchema,
        selectedTargets: [],
    };
    engine.setPendingRuntime({
        sourceCard: p1.levelZone!,
        player: p1,
        opponent: p2,
        machine: engine,
        sourceActivation: ActivationCondition.TURN_END,
        sourceEffectDescription: endPhaseEffect.description,
    }, endPhaseEffect);
    engine.setInteractionOwner(p1.id);
    engine.traceUiEvent('INTERACTION_OPENED', {
        sourcePlayerId: p1.id,
        sourceCardId: p1.levelZone?.id,
        sourceCardName: p1.levelZone?.name,
        interactionMode: 'SELECT_TARGET',
        effectDescription: endPhaseEffect.description,
        actionType: 'END_PHASE_HAND_ADJUST',
    });
}

export function createGameUxCheckpoint(checkpoint: GameUxCheckpoint, options: { seed?: number; enableUiTrace?: boolean } = {}): GameEngine {
    const engine = createHarnessEngine(options.seed, options.enableUiTrace ?? true);
    const { p1, p2 } = resetEngineState(engine);

    switch (checkpoint) {
        case 'P1_MAIN_AFTER_MULLIGAN':
            createMainAfterMulliganCheckpoint(engine, p1, p2);
            break;
        case 'ATTACK_DECLARE_WINDOW':
            createAttackDeclareWindowCheckpoint(engine, p1, p2);
            break;
        case 'BLOCK_DECISION_WINDOW':
            createBlockDecisionWindowCheckpoint(engine, p1, p2);
            break;
        case 'MANDATORY_TARGET_SELECTION':
            createMandatoryTargetSelectionCheckpoint(engine, p1, p2);
            break;
        case 'END_PHASE_HAND_ADJUST':
            createEndPhaseHandAdjustCheckpoint(engine, p1, p2);
            break;
        default:
            {
                const unsupportedCheckpoint: never = checkpoint;
                throw new Error(`Unsupported UX checkpoint: ${String(unsupportedCheckpoint)}`);
            }
    }

    return engine;
}

export function resolveGameUxCheckpointFromSearch(search: string): GameUxCheckpoint | null {
    const params = new URLSearchParams(search);
    const checkpoint = params.get('uxCheckpoint');
    if (!checkpoint) return null;

    const supportedCheckpoints: GameUxCheckpoint[] = [
        'P1_MAIN_AFTER_MULLIGAN',
        'ATTACK_DECLARE_WINDOW',
        'BLOCK_DECISION_WINDOW',
        'MANDATORY_TARGET_SELECTION',
        'END_PHASE_HAND_ADJUST',
    ];
    return supportedCheckpoints.includes(checkpoint as GameUxCheckpoint)
        ? checkpoint as GameUxCheckpoint
        : null;
}
