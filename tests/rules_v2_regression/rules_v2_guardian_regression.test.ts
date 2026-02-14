import { describe, expect, it } from 'vitest';
import { DUMMY_CARDS } from '../../src/logic/CardDatabase';
import { GameEngine } from '../../src/logic/GameEngine';
import { ActivationCondition, Attribute, Card, CardType, Phase } from '../../src/logic/types';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card not found: ${id}`);
    return JSON.parse(JSON.stringify(card));
}

function makeLeader(id: string): Card {
    return {
        id,
        name: id,
        type: CardType.LEADER,
        attribute: Attribute.NONE,
        cost: 0,
        text: ''
    };
}

function makeUnit(id: string, overrides: Partial<Card> = {}): Card {
    return {
        id,
        name: id,
        type: CardType.UNIT,
        attribute: Attribute.NONE,
        cost: 1,
        power: 3000,
        hit: 1,
        text: '',
        effects: [],
        keywords: [],
        ...overrides
    };
}

function makeItem(id: string, overrides: Partial<Card> = {}): Card {
    return {
        id,
        name: id,
        type: CardType.ITEM,
        attribute: Attribute.NONE,
        cost: 1,
        text: '',
        effects: [],
        keywords: [],
        ...overrides
    };
}

function createEngine(): GameEngine {
    const deck1 = Array(30).fill(null).map((_, i) => makeUnit(`P1_${i}`));
    const deck2 = Array(30).fill(null).map((_, i) => makeUnit(`P2_${i}`));
    return new GameEngine('P1', 'P2', deck1, deck2, makeLeader('L1'), makeLeader('L2'));
}

describe('Rules v2 Guardian Regression', () => {
    it('barrier guardian can defend adjacent lane by paying hand cost', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        const attacker = getCard('ST04-002');
        attacker.power = 4500;
        attacker.hit = 1;
        p1.unitZones[1].unit = attacker;

        p2.unitZones[0].unit = getCard('ST04-003');
        p2.hand = [getCard('ST01-002')];

        const damageBefore = p2.damage.length;
        engine.attack(1);

        const options = engine.getPendingDefenseOptions();
        expect(options.some(option => option.costType === 'BARRIER' && option.defenderZoneIndex === 0)).toBe(true);

        engine.resolveBlock(true);
        expect(engine.state.interactionMode).toBe('SELECT_COST');
        expect(engine.state.pendingEffect?.actionType).toBe('BLOCK_PAY_BARRIER');

        engine.selectCostForPlayerId(0, p2.id);

        expect(p2.hand.length).toBe(0);
        expect(p2.damage.length).toBe(damageBefore);
    });

    it('sacrifice guardian (BT03-041) pays by trashing another own unit', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[1].unit = makeUnit('ATK', { power: 4000, hit: 1 });
        p2.unitZones[0].unit = getCard('BT03-041');
        p2.unitZones[2].unit = getCard('ST05-002');

        const damageBefore = p2.damage.length;
        engine.attack(1);
        engine.resolveBlock(true);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.pendingEffect?.actionType).toBe('BLOCK_PAY_SACRIFICE');

        engine.selectZoneTargetByPlayerId(2, p2.id);
        engine.confirmTargets();

        expect(p2.unitZones[2].unit).toBeNull();
        expect(p2.damage.length).toBe(damageBefore);
    });

    it('sacrifice guardian (BT04-065) pays by trashing another own unit', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[1].unit = makeUnit('ATK2', { power: 4000, hit: 1 });
        p2.unitZones[0].unit = getCard('BT04-065');
        p2.unitZones[2].unit = getCard('ST05-002');

        const damageBefore = p2.damage.length;
        engine.attack(1);
        engine.resolveBlock(true);

        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.pendingEffect?.actionType).toBe('BLOCK_PAY_SACRIFICE');

        engine.selectZoneTargetByPlayerId(2, p2.id);
        engine.confirmTargets();

        expect(p2.unitZones[2].unit).toBeNull();
        expect(p2.damage.length).toBe(damageBefore);
    });

    it('does not treat non-guardian ability text as guardian block source', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[1].unit = makeUnit('ATK_NON_GUARDIAN', { power: 5000, hit: 1 });
        p2.unitZones[0].unit = makeUnit('EQUIP_CONDITION_TEXT', {
            text: '장착조건 가디언',
            power: 4000,
            hit: 1
        });

        engine.attack(1);
        const options = engine.getPendingDefenseOptions();

        expect(options.some(option => option.source === 'GUARDIAN')).toBe(false);
    });

    it('guardian sacrifice cost cannot be bypassed by destruction prevention', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[1].unit = makeUnit('ATK_PREVENT', { power: 4000, hit: 1 });
        p2.unitZones[0].unit = getCard('BT03-041');
        p2.unitZones[2].unit = makeUnit('SAC_TARGET_WITH_PREVENT', {
            effects: [{
                activation: ActivationCondition.PASSIVE,
                description: 'Prevent destruction by trashing an equipped item',
                action: {
                    type: 'NONE',
                    params: { preventDestroyBy: 'TRASH_ITEM' }
                }
            }]
        });
        p2.unitZones[2].items = [makeItem('PREVENT_ITEM')];

        const damageBefore = p2.damage.length;
        engine.attack(1);
        engine.resolveBlock(true);
        engine.selectZoneTargetByPlayerId(2, p2.id);
        engine.confirmTargets();

        expect(p2.unitZones[2].unit).toBeNull();
        expect(p2.damage.length).toBe(damageBefore);
    });

    it('negate guardian pays by trashing a matching equipped item', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[1].unit = makeUnit('ATK3', { power: 5000, hit: 1 });

        const negateGuardian = makeUnit('SYN_GUARDIAN_NEGATE', {
            text: '가디언 : 상쇄[1코스트 이상 아이템] (테스트)'
        });
        p2.unitZones[0].unit = negateGuardian;

        const invalidItem = makeItem('SYN_ITEM_0', { cost: 0 });
        const validItem = makeItem('SYN_ITEM_1', { cost: 1 });
        p2.unitZones[0].items = [invalidItem, validItem];

        const damageBefore = p2.damage.length;
        engine.attack(1);

        const options = engine.getPendingDefenseOptions();
        expect(options.some(option => option.costType === 'NEGATE' && option.defenderZoneIndex === 0)).toBe(true);

        engine.resolveBlock(true);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.pendingEffect?.actionType).toBe('BLOCK_PAY_NEGATE');
        expect(engine.state.revealedCards.length).toBe(1);
        expect(engine.state.revealedCards[0].id).toBe('SYN_ITEM_1');

        engine.selectRevealedTarget(0);

        expect(p2.unitZones[0].items.some(item => item.id === 'SYN_ITEM_1')).toBe(false);
        expect(p2.trash.some(card => card.id === 'SYN_ITEM_1')).toBe(true);
        expect(p2.damage.length).toBe(damageBefore);
    });

    it('resolveBlock(true) remains compatible for non-guardian encounter blocks', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[0].unit = makeUnit('ATK4', { power: 2000, hit: 1 });
        p2.unitZones[0].unit = makeUnit('BLK4', { power: 4000, hit: 1 });

        const damageBefore = p2.damage.length;
        engine.attack(0);
        engine.resolveBlock(true);

        expect(p2.damage.length).toBe(damageBefore);
        expect(engine.state.pendingAttackerIndex).toBeNull();
        expect(engine.state.pendingDefenderIndex).toBeNull();
        expect(engine.state.phase).toBe(Phase.ATTACK);
    });

    it('resolveBlock(false) remains compatible for non-guardian direct damage', () => {
        const engine = createEngine();
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[0].unit = makeUnit('ATK5', { power: 2000, hit: 2 });
        p2.unitZones[0].unit = makeUnit('BLK5', { power: 6000, hit: 1 });

        const damageBefore = p2.damage.length;
        engine.attack(0);
        engine.resolveBlock(false);

        expect(p2.damage.length).toBe(damageBefore + 2);
        expect(p2.unitZones[0].unit).not.toBeNull();
        expect(engine.state.pendingAttackerIndex).toBeNull();
        expect(engine.state.pendingDefenderIndex).toBeNull();
    });
});
