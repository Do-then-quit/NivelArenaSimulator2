import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, ActivationCondition, Phase } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

describe('ST03-006 to ST03-010 Card Effects', () => {
    let engine: GameEngine;
    const moderniaLeader = DUMMY_CARDS.find(c => c.id === 'ST03-001')!;

    beforeEach(() => {
        const deck1 = Array(10).fill(DUMMY_CARDS.find(c => c.id === 'ST03-002')!);
        const deck2 = Array(10).fill(DUMMY_CARDS.find(c => c.id === 'ST03-002')!);
        engine = new GameEngine('P1', 'P2', deck1, deck2, moderniaLeader, moderniaLeader);
    });

    it('ST03-006 Sakura: should draw 1 card on EXIT', () => {
        const p1 = engine.state.players[0];
        const sakura = DUMMY_CARDS.find(c => c.id === 'ST03-006')!;
        p1.unitZones[0].unit = { ...sakura };

        const initialHandSize = p1.hand.length;
        engine.destroyUnit(p1, p1.unitZones[0]);

        expect(p1.hand.length).toBe(initialHandSize + 1);
    });

    it('ST03-007 D: should trigger Mutual Destruction on EXIT', () => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        // D (Defender, Cost 3)
        const dCard = DUMMY_CARDS.find(c => c.id === 'ST03-007')!;
        p2.unitZones[0].unit = { ...dCard };

        // Attacker (Cost 3)
        const attacker = { ...DUMMY_CARDS.find(c => c.id === 'ST03-002')!, power: 5000, cost: 3 };
        p1.unitZones[0].unit = attacker;

        engine.state.phase = Phase.ATTACK;
        engine.attack(0);
        engine.resolveBlock(true);

        expect(p2.unitZones[0].unit).toBeNull(); // D died
        expect(p1.unitZones[0].unit).toBeNull(); // Attacker also died by Mutual Destruction
    });

    it('ST03-008 Exia: should grant +1000 power to units with EXIT keyword', () => {
        const p1 = engine.state.players[0];
        const exia = DUMMY_CARDS.find(c => c.id === 'ST03-008')!;
        p1.unitZones[1].unit = { ...exia };

        const privaty = DUMMY_CARDS.find(c => c.id === 'ST03-003')!;
        p1.unitZones[0].unit = { ...privaty };

        // Privaty base 500 + Exia 1000 = 1500
        expect(engine.getUnitPower(p1.unitZones[0], p1)).toBe(1500);
    });

    it('ST03-010 Rosanna: should trigger EXIT effect to return low cost EXIT unit from trash', () => {
        const p1 = engine.state.players[0];
        
        // Setup trash with an EXIT unit (Privaty, cost 1)
        const privaty = DUMMY_CARDS.find(c => c.id === 'ST03-003')!;
        p1.trash.push({ ...privaty });

        const rosanna = DUMMY_CARDS.find(c => c.id === 'ST03-010')!;
        p1.unitZones[0].unit = { ...rosanna };

        engine.destroyUnit(p1, p1.unitZones[0]);

        // Should enter selection mode
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        expect(engine.state.pendingEffect?.validTargets).toBe('MY_TRASH');

        engine.selectTrashTarget(0);

        expect(p1.hand).toContainEqual(expect.objectContaining({ id: 'ST03-003' }));
        expect(engine.state.interactionMode).toBe('NORMAL');
    });
});
