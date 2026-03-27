import { GameEngine } from '../../../src/logic/GameEngine';
import {
    ActivationCondition,
    Attribute,
    Card,
    CardType,
    Effect,
    Phase,
    PlayerState,
    TargetSchema,
} from '../../../src/logic/types';
import { createEngine } from './ui_click_harness';
import { setupUiDom, setupUiHarness } from './ui_click_harness';

export type GameUxCheckpoint =
    | 'P1_MAIN_AFTER_MULLIGAN'
    | 'ATTACK_DECLARE_WINDOW'
    | 'MANDATORY_TARGET_SELECTION';

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
    p1.name = 'Player 1';
    p2.id = 'P2';
    p2.name = 'Player 2';

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

export function createGameUxCheckpoint(checkpoint: GameUxCheckpoint): GameEngine {
    const engine = createEngine(20260327, { enableUiTrace: true });
    const { p1, p2 } = resetEngineState(engine);

    switch (checkpoint) {
        case 'P1_MAIN_AFTER_MULLIGAN':
            createMainAfterMulliganCheckpoint(engine, p1, p2);
            break;
        case 'ATTACK_DECLARE_WINDOW':
            createAttackDeclareWindowCheckpoint(engine, p1, p2);
            break;
        case 'MANDATORY_TARGET_SELECTION':
            createMandatoryTargetSelectionCheckpoint(engine, p1, p2);
            break;
        default:
            {
                const unsupportedCheckpoint: never = checkpoint;
                throw new Error(`Unsupported UX checkpoint: ${String(unsupportedCheckpoint)}`);
            }
    }

    return engine;
}

export async function renderGameUxCheckpoint(checkpoint: GameUxCheckpoint) {
    const engine = createGameUxCheckpoint(checkpoint);
    setupUiDom();
    const harness = await setupUiHarness(engine);
    return {
        engine,
        ...harness,
    };
}
