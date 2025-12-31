import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, ActivationCondition, Phase } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

describe('ST03-001 to ST03-005 Card Effects', () => {
    let engine: GameEngine;
    const moderniaLeader = DUMMY_CARDS.find(c => c.id === 'ST03-001')!;

    if (!moderniaLeader) {
        throw new Error("ST03-001 Modernia Leader not found in database");
    }

    beforeEach(() => {
        const deck1 = Array(10).fill(DUMMY_CARDS.find(c => c.id === 'ST03-002')!); // Delta
        const deck2 = Array(10).fill(DUMMY_CARDS.find(c => c.id === 'ST03-002')!);
        engine = new GameEngine('P1', 'P2', deck1, deck2, moderniaLeader, moderniaLeader);
    });

    describe('ST03-001 Modernia (Leader)', () => {
        it('should awaken at level 4', () => {
            const p1 = engine.state.players[0];
            expect(p1.levelZone?.isAwakened).toBeFalsy();

            // Increase level to 4
            engine.addLeaderLevel(0, 3); // starts at 1
            expect(p1.leaderLevel).toBe(4);
            expect(p1.levelZone?.isAwakened).toBe(true);
        });

        it('should grant +1000 power to own units with EXIT keyword when awakened', () => {
            const p1 = engine.state.players[0];
            
            // Modernia needs to be awakened
            engine.addLeaderLevel(0, 3);
            expect(p1.levelZone?.isAwakened).toBe(true);

            // Place a unit with EXIT keyword (ST03-003 Privaty)
            const privaty = DUMMY_CARDS.find(c => c.id === 'ST03-003')!;
            p1.unitZones[0].unit = { ...privaty };

            // Base power of Privaty is 500
            const power = engine.getUnitPower(p1.unitZones[0], p1);
            expect(power).toBe(500 + 1000); // 1500
        });

        it('should NOT grant power bonus if NOT awakened', () => {
            const p1 = engine.state.players[0];
            
            // Stay at level 1
            expect(p1.levelZone?.isAwakened).toBeFalsy();

            const privaty = DUMMY_CARDS.find(c => c.id === 'ST03-003')!;
            p1.unitZones[0].unit = { ...privaty };

            const power = engine.getUnitPower(p1.unitZones[0], p1);
            expect(power).toBe(500);
        });
    });

    describe('ST03-003 Privaty (Unit)', () => {
        it('should trigger EXIT effect to make opponent trash a card', () => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            
            p2.hand = Array(3).fill(DUMMY_CARDS.find(c => c.id === 'ST03-002')!);
            const privaty = DUMMY_CARDS.find(c => c.id === 'ST03-003')!;
            p1.unitZones[0].unit = { ...privaty };

            // Destroy Privaty
            engine.destroyUnit(p1, p1.unitZones[0]);

            expect(p2.hand.length).toBe(2);
            expect(p2.trash.length).toBe(1);
        });

        it('should trigger DAMAGE_TRIGGER effect to make opponent trash a card if hand >= 3', () => {
            const p1 = engine.state.players[0]; // Player taking damage
            const p2 = engine.state.players[1]; // Opponent

            p2.hand = Array(3).fill(DUMMY_CARDS.find(c => c.id === 'ST03-002')!);
            const privaty = DUMMY_CARDS.find(c => c.id === 'ST03-003')!;
            // Add to top of deck
            p1.deck.push({ ...privaty });

            // Deal 1 damage
            engine.dealDamage(p1, 1);

            // Trigger should activate because p2 hand is 3
            expect(p2.hand.length).toBe(2);
            expect(p2.trash.length).toBe(1);
            expect(p1.trash).toContainEqual(expect.objectContaining({ id: privaty.id }));
        });

        it('should NOT trigger DAMAGE_TRIGGER if opponent hand < 3', () => {
             const p1 = engine.state.players[0];
             const p2 = engine.state.players[1];

             p2.hand = Array(2).fill(DUMMY_CARDS.find(c => c.id === 'ST03-002')!);
             const privaty = DUMMY_CARDS.find(c => c.id === 'ST03-003')!;
             p1.deck.push({ ...privaty });

             engine.dealDamage(p1, 1);

             expect(p2.hand.length).toBe(2);
        });
    });

    describe('ST03-005 Novel (Unit)', () => {
        it('should trash encounter unit if its cost <= 1 on entry', () => {
             const p1 = engine.state.players[0];
             const p2 = engine.state.players[1];

             // Opponent has a 1-cost unit (ST03-002 Delta) in Zone 0
             const delta = DUMMY_CARDS.find(c => c.id === 'ST03-002')!;
             p2.unitZones[0].unit = { ...delta };

             // Player 1 plays Novel in Zone 0 (encounters Delta)
             const novel = DUMMY_CARDS.find(c => c.id === 'ST03-005')!;
             p1.hand.push({ ...novel });
             
             engine.addLeaderLevel(0, 1); // Size 2
             engine.state.phase = Phase.MAIN;
             engine.playUnit(p1.hand.length - 1, 0);

             // Delta should be trashed
             expect(p2.unitZones[0].unit).toBeNull();
             expect(p2.trash.length).toBe(1);
        });

        it('should NOT trash encounter unit if its cost > 1', () => {
             const p1 = engine.state.players[0];
             const p2 = engine.state.players[1];

             // Opponent has a 2-cost unit (ST03-004 Uni)
             const uni = DUMMY_CARDS.find(c => c.id === 'ST03-004')!;
             p2.unitZones[0].unit = { ...uni };

             const novel = DUMMY_CARDS.find(c => c.id === 'ST03-005')!;
             p1.hand.push({ ...novel });
             
             engine.addLeaderLevel(0, 1); // Size 2
             engine.state.phase = Phase.MAIN;
             engine.playUnit(p1.hand.length - 1, 0);

             expect(p2.unitZones[0].unit).not.toBeNull();
             expect(p2.trash.length).toBe(0);
        });
    });
});
