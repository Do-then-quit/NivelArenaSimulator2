import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../src/logic/GameEngine';
import { ActivationCondition, Attribute, Card, CardType, Phase } from '../../src/logic/types';

function makeLeader(id: string, effects: any[] = []): Card {
    return {
        id,
        name: id,
        type: CardType.LEADER,
        attribute: Attribute.NONE,
        cost: 0,
        text: '',
        effects
    };
}

function makeUnit(id: string, overrides: Partial<Card> = {}): Card {
    return {
        id,
        name: id,
        type: CardType.UNIT,
        attribute: Attribute.NONE,
        cost: 1,
        power: 1000,
        hit: 1,
        text: '',
        ...overrides
    };
}

function createEngine(p1Leader: Card, p2Leader: Card): GameEngine {
    const deck1 = Array(30).fill(null).map((_, i) => makeUnit(`P1_${i}`));
    const deck2 = Array(30).fill(null).map((_, i) => makeUnit(`P2_${i}`));
    const engine = new GameEngine('P1', 'P2', deck1, deck2, p1Leader, p2Leader);
    engine.state.winner = null;
    return engine;
}

describe('Rules v2 Engine Regression', () => {
    it('assigns winner correctly when damaged player cannot perform damage processing', () => {
        const engine = createEngine(makeLeader('L1'), makeLeader('L2'));
        engine.state.turnPlayerIndex = 0;

        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p2.deck = [];

        engine.dealDamage(p2, 1);
        expect(engine.state.winner).toBe(p1.id);
    });

    it('does not trigger EXIT effects on upgrade trash', () => {
        const engine = createEngine(makeLeader('L1'), makeLeader('L2'));
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;

        const p1 = engine.state.players[0];
        p1.leaderLevel = 10;

        const oldUnit = makeUnit('OLD', {
            effects: [{
                activation: ActivationCondition.EXIT,
                description: 'Exit draw',
                action: { type: 'DRAW', params: { count: 1 } }
            }]
        });
        const newUnit = makeUnit('NEW', { cost: 2, power: 2000 });

        p1.unitZones[0].unit = oldUnit;
        p1.hand = [newUnit];
        const deckBefore = p1.deck.length;

        engine.playUnit(0, 0);

        expect(p1.unitZones[0].unit?.id).toBe('NEW');
        expect(p1.hand.length).toBe(0);
        expect(p1.deck.length).toBe(deckBefore);
        expect(p1.trash.some(c => c.id === 'OLD')).toBe(true);
    });

    it('prioritizes turn player first for simultaneous UNIT_TRASHED triggers', () => {
        const p1Leader = makeLeader('P1L', [{
            activation: ActivationCondition.UNIT_TRASHED,
            description: 'P1_UNIT_TRASHED',
            action: { type: 'NONE', params: {} }
        }]);
        const p2Leader = makeLeader('P2L', [{
            activation: ActivationCondition.UNIT_TRASHED,
            description: 'P2_UNIT_TRASHED',
            action: { type: 'NONE', params: {} }
        }]);
        const engine = createEngine(p1Leader, p2Leader);

        const p1 = engine.state.players[0];
        engine.state.turnPlayerIndex = 1; // P2 is turn player
        p1.unitZones[0].unit = makeUnit('TARGET');

        const originalProcessQueue = engine.effectManager.processQueue.bind(engine.effectManager);
        engine.effectManager.processQueue = () => 'PAUSED';
        try {
            engine.destroyUnit(p1, p1.unitZones[0]);
        } finally {
            engine.effectManager.processQueue = originalProcessQueue;
        }

        const tagged = engine.state.effectQueue
            .map(item => item.effect.description)
            .filter(desc => desc.endsWith('UNIT_TRASHED'));

        expect(tagged.length).toBe(2);
        expect(tagged[0]).toBe('P2_UNIT_TRASHED');
        expect(tagged[1]).toBe('P1_UNIT_TRASHED');
    });

    it('cleans ATTACKER/DEFENDER temporary effects at battle end (not turn end)', () => {
        const engine = createEngine(makeLeader('L1'), makeLeader('L2'));
        const attacker = makeUnit('ATK', {
            effects: [{
                activation: ActivationCondition.ATTACKER,
                description: 'ATK +1000',
                action: { type: 'BUFF_POWER', params: { value: 1000 } }
            }]
        });
        const blocker = makeUnit('BLK', { power: 500 });

        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
        p1.unitZones[0].unit = attacker;
        p2.unitZones[0].unit = blocker;

        engine.attack(0);
        engine.resolveBlock(true);

        expect(engine.state.combatStep).toBe('NONE');
        expect(engine.getUnitPower(p1.unitZones[0], p1)).toBe(1000);
        expect(p1.unitZones[0].buffs.some(b => b.duration === 'BATTLE_END')).toBe(false);
    });

    it('keeps BREAKTHROUGH attacks unblocked even after a previous blocked combat', () => {
        const engine = createEngine(makeLeader('L1'), makeLeader('L2'));
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;

        p1.unitZones[0].unit = makeUnit('ATK_NORMAL', { power: 3000, hit: 1 });
        p2.unitZones[0].unit = makeUnit('BLK_1', { power: 1000, cost: 1 });
        engine.attack(0);
        engine.resolveBlock(true);

        expect(p2.unitZones[0].unit).toBeNull();
        expect(engine.state.combatStep).toBe('NONE');

        p1.unitZones[1].unit = makeUnit('ATK_BREAK', {
            power: 4000,
            hit: 2,
            effects: [{
                activation: ActivationCondition.ATTACKER,
                description: 'Breakthrough up to 2 cost',
                action: { type: 'BREAKTHROUGH', params: { costMax: 2 } }
            }]
        });
        p2.unitZones[1].unit = makeUnit('BLK_2', { power: 1500, cost: 2 });
        const damageBefore = p2.damage.length;

        engine.attack(1);

        expect(p2.unitZones[1].unit?.id).toBe('BLK_2');
        expect(p2.damage.length).toBe(damageBefore + 2);
    });

    it('defers non-trigger effects during damage processing and does not resolve them after defeat', () => {
        const engine = createEngine(makeLeader('L1'), makeLeader('L2'));
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;

        const exitDrawer = makeUnit('EXIT_DRAWER', {
            effects: [{
                activation: ActivationCondition.EXIT,
                description: 'Draw on exit',
                action: { type: 'DRAW', params: { count: 1 } }
            }]
        });

        const triggerCard: Card = {
            id: 'TRG',
            name: 'TRG',
            type: CardType.SKILL,
            attribute: Attribute.NONE,
            cost: 0,
            text: '',
            effects: [{
                activation: ActivationCondition.DAMAGE_TRIGGER,
                description: 'Trigger destroy own unit',
                targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'ALL', count: 0 },
                action: { type: 'DESTROY_UNIT', params: {} }
            }]
        };

        p2.unitZones[0].unit = exitDrawer;
        p2.hand = [];
        p2.damage = Array(9).fill(null).map((_, i) => makeUnit(`D${i}`));
        p2.deck = [triggerCard];

        engine.dealDamage(p2, 1);

        expect(engine.state.winner).toBe(p1.id);
        expect(p2.unitZones[0].unit).toBeNull();
        expect(p2.hand.length).toBe(0);
    });

    it('allows each activated effect once per turn and enforces phase restriction for ACTIVE_MAIN', () => {
        const engine = createEngine(makeLeader('L1'), makeLeader('L2'));
        const p1 = engine.state.players[0];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.MAIN;

        p1.unitZones[0].unit = makeUnit('ACTIVE_UNIT', {
            effects: [
                {
                    id: 'draw_effect',
                    activation: ActivationCondition.ACTIVE,
                    description: 'Draw 1',
                    action: { type: 'DRAW', params: { count: 1 } }
                },
                {
                    id: 'level_effect',
                    activation: ActivationCondition.ACTIVE,
                    description: 'Gain level',
                    action: { type: 'GAIN_LEVEL', params: { value: 1 } }
                },
                {
                    id: 'main_only',
                    activation: ActivationCondition.ACTIVE_MAIN,
                    description: 'Main only level',
                    action: { type: 'GAIN_LEVEL', params: { value: 1 } }
                }
            ]
        });

        const handBefore = p1.hand.length;
        const levelBefore = p1.leaderLevel;

        engine.activateEffect(0, 0);
        engine.activateEffect(0, 1);
        engine.activateEffect(0, 0);
        engine.activateEffect(0, 1);

        expect(p1.hand.length).toBe(handBefore + 1);
        expect(p1.leaderLevel).toBe(levelBefore + 1);

        engine.state.phase = Phase.ATTACK;
        engine.activateEffect(0, 2);
        expect(p1.leaderLevel).toBe(levelBefore + 1);
    });

    it('requires turn player to choose discards to reach 7 cards during end phase (rule 6.6.1.4)', () => {
        const engine = createEngine(makeLeader('L1'), makeLeader('L2'));
        const p1 = engine.state.players[0];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.END;
        engine.state.turnCount = 3;
        p1.hand = Array(8).fill(null).map((_, i) => makeUnit(`H${i}`));

        engine.nextPhase();

        expect(engine.state.phase).toBe(Phase.END);
        expect(engine.state.turnPlayerIndex).toBe(0);
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.interactionOwnerPlayerId).toBe(p1.id);

        const firstActions = engine.getLegalActions(p1.id);
        const firstPick = firstActions.find(action => action.type === 'SELECT_HAND_TARGET');
        expect(firstPick).toBeDefined();
        if (firstPick?.type === 'SELECT_HAND_TARGET') {
            expect(firstPick.targetPlayerId).toBe(p1.id);
        }
        expect(firstActions.some(action => action.type === 'CONFIRM_TARGETS')).toBe(false);
        expect(engine.step(firstPick!)).toBe(true);

        expect(p1.hand.length).toBe(7);
        expect(engine.state.interactionMode).toBe('NORMAL');
        expect(engine.state.turnPlayerIndex).toBe(1);
        expect(engine.state.turnCount).toBe(4);
        expect(engine.state.phase).toBe(Phase.LEVEL_UP);
    });

    it('requires selecting all required cards before confirm when over hand limit by 2+ (rule 6.6.1.4)', () => {
        const engine = createEngine(makeLeader('L1'), makeLeader('L2'));
        const p1 = engine.state.players[0];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.END;
        p1.hand = Array(9).fill(null).map((_, i) => makeUnit(`N${i}`));

        engine.nextPhase();
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');

        const actions1 = engine.getLegalActions(p1.id);
        const firstPick = actions1.find(action => action.type === 'SELECT_HAND_TARGET');
        expect(firstPick).toBeDefined();
        expect(engine.step(firstPick!)).toBe(true);

        const actions2 = engine.getLegalActions(p1.id);
        expect(actions2.some(action => action.type === 'CONFIRM_TARGETS')).toBe(false);
        const firstPickIndex =
            firstPick?.type === 'SELECT_HAND_TARGET'
                ? firstPick.handIndex
                : -1;
        const secondPick = actions2.find(
            action => action.type === 'SELECT_HAND_TARGET' && action.handIndex !== firstPickIndex
        );
        expect(secondPick).toBeDefined();
        expect(engine.step(secondPick!)).toBe(true);

        const actions3 = engine.getLegalActions(p1.id);
        const confirm = actions3.find(action => action.type === 'CONFIRM_TARGETS');
        expect(confirm).toBeDefined();
        expect(engine.step(confirm!)).toBe(true);

        expect(p1.hand.length).toBe(7);
        expect(engine.state.interactionMode).toBe('NORMAL');
        expect(engine.state.turnPlayerIndex).toBe(1);
        expect(engine.state.phase).toBe(Phase.LEVEL_UP);
    });
});

