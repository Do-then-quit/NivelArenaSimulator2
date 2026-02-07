import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, ActivationCondition, Phase } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';
import { DeckBuilderLogic } from '../src/logic/DeckBuilderLogic';

describe('ST03 Storm Starter Deck - Full Regression', () => {
    let engine: GameEngine;
    const leader = DUMMY_CARDS.find(c => c.id === 'ST03-001')!;

    beforeEach(() => {
        const deck1 = Array(40).fill(DUMMY_CARDS.find(c => c.id === 'ST03-002')!);
        const deck2 = Array(40).fill(DUMMY_CARDS.find(c => c.id === 'ST03-002')!);
        engine = new GameEngine('P1', 'P2', deck1, deck2, leader, leader);
    });

    describe('Leader: ST03-001 Modernia', () => {
        it('should validate deck attribute restriction', () => {
            const builder = new DeckBuilderLogic(DUMMY_CARDS);
            builder.setLeader('ST03-001');
            
            // Add 39 Storm cards
            for (let i = 0; i < 39; i++) builder.addCardToDeck('ST03-002');
            
            // Add 1 Fire card (ST01-002)
            builder.addCardToDeck('ST01-002');
            
            const result = builder.validateDeck();
            expect(result.valid).toBe(false);
            // ST03-001 name is '모더니아'
            expect(result.errors).toContain('모더니아 requires all cards in deck to be STORM attribute.');
        });

        it('should awaken and buff EXIT units', () => {
            const p1 = engine.state.players[0];
            engine.addLeaderLevel(0, 3); // Level 4
            expect(p1.levelZone?.isAwakened).toBe(true);

            p1.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-003')! }; // Privaty (EXIT)
            expect(engine.getUnitPower(p1.unitZones[0], p1)).toBe(1500); // 500 + 1000
        });
    });

    describe('Exit Effects & Keywords', () => {
        it('ST03-003 Privaty: Manual discard on EXIT', () => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p2.hand = [{ ...DUMMY_CARDS.find(c => c.id === 'ST03-002')!, name: 'TRASH_ME' }];
            p1.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-003')! };

            engine.destroyUnit(p1, p1.unitZones[0]);
            expect(engine.state.interactionMode).toBe('SELECT_TARGET');
            engine.selectHandTarget(0, true);
            expect(p2.hand).toHaveLength(0);
            expect(p2.trash[0].name).toBe('TRASH_ME');
        });

        it('ST03-007 D: Mutual Destruction', () => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-002')!, cost: 3, power: 5000 };
            p2.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-007')! }; // D, cost 3

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            engine.resolveBlock(true);

            expect(p1.unitZones[0].unit).toBeNull();
            expect(p2.unitZones[0].unit).toBeNull();
        });
    });

    describe('Skills & Support', () => {
        it('ST03-011 Modernia (Unit): Trash hand for encounter kill', () => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.addLeaderLevel(0, 6); // Level 7
            p2.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-002')! };
            p1.hand = Array(3).fill({ ...DUMMY_CARDS.find(c => c.id === 'ST03-002')! });
            p1.hand.push({ ...DUMMY_CARDS.find(c => c.id === 'ST03-011')! });

            engine.state.phase = Phase.MAIN;
            engine.playUnit(p1.hand.length - 1, 0);

            expect(p1.hand).toHaveLength(0);
            expect(p2.unitZones[0].unit).toBeNull();
        });

        it('ST03-012 Surprise Attack: Sequential manual discard', () => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.addLeaderLevel(0, 1);
            p1.hand = [{ ...DUMMY_CARDS.find(c => c.id === 'ST03-002')!, name: 'P1_CARD' }, { ...DUMMY_CARDS.find(c => c.id === 'ST03-012')! }];
            p2.hand = [{ ...DUMMY_CARDS.find(c => c.id === 'ST03-002')!, name: 'P2_CARD' }];

            engine.state.phase = Phase.MAIN;
            engine.playSkill(1);

            engine.selectHandTarget(0, false);
            expect(engine.state.interactionMode).toBe('SELECT_TARGET'); // Still in selection for opponent
            engine.selectHandTarget(0, true);

            expect(p1.hand).toHaveLength(0);
            expect(p2.hand).toHaveLength(0);
        });

        it('ST03-015 Come On!: Combined unit destruction', () => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.addLeaderLevel(0, 3);
            p1.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-002')! };
            p2.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-004')! };
            p1.hand = [{ ...DUMMY_CARDS.find(c => c.id === 'ST03-015')! }];

            engine.state.phase = Phase.MAIN;
            engine.playSkill(0);
            engine.selectTarget(0, false);

            expect(p1.unitZones[0].unit).toBeNull();
            expect(p2.unitZones[0].unit).toBeNull();
        });

        it('ST03-016 Kevlar Vest: Defender termination', () => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-002')!, power: 10000 };
            p2.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-002')! };
            p2.unitZones[0].items.push({ ...DUMMY_CARDS.find(c => c.id === 'ST03-016')! });

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            engine.resolveBlock(true);

            expect(p2.unitZones[0].unit).toBeNull();
            expect(p1.unitZones[0].unit).not.toBeNull(); // Survived
        });
    });
});
