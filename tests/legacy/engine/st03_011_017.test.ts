import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, ActivationCondition, Phase } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

describe('ST03-011 to ST03-017 Card Effects', () => {
    let engine: GameEngine;
    const moderniaLeader = DUMMY_CARDS.find(c => c.id === 'ST03-001')!;

    beforeEach(() => {
        const deck1 = Array(10).fill(DUMMY_CARDS.find(c => c.id === 'ST03-002')!);
        const deck2 = Array(10).fill(DUMMY_CARDS.find(c => c.id === 'ST03-002')!);
        engine = new GameEngine('P1', 'P2', deck1, deck2, moderniaLeader, moderniaLeader);
    });

    it('ST03-011 Modernia (Unit): should trash encounter unit if 2+ cards trashed from hand on entry', () => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        // Opponent has a unit
        p2.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-002')! };

        // P1 plays Modernia (cost 7, need level 7)
        engine.addLeaderLevel(0, 6);
        const modernia = DUMMY_CARDS.find(c => c.id === 'ST03-011')!;
        p1.hand = Array(3).fill({ ...DUMMY_CARDS.find(c => c.id === 'ST03-002')! });
        p1.hand.push({ ...modernia });

        engine.state.phase = Phase.MAIN;
        engine.playUnit(p1.hand.length - 1, 0);

        // Modernia entry effect: Option to trash all hand cards.
        // It's a cost: DISCARD_ALL. 
        // We need to implement this as an optional cost or regular action.
        // Json says: "엔트리 : 자신의 패를 모두 트래시할 수 있다. 2장 이상 트래시했다면 조우 유닛을 트래시한다."
        // I'll implement as DISCARD_ALL action.
        
        expect(p1.hand.length).toBe(0);
        expect(p1.trash.length).toBe(3); // 3 hand cards
        expect(p2.unitZones[0].unit).toBeNull(); // Encounter unit trashed
    });

    it('ST03-012 Surprise Attack: should trash 1 from both hands', () => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.addLeaderLevel(0, 1); // Level 2
        p1.hand = Array(2).fill({ ...DUMMY_CARDS.find(c => c.id === 'ST03-002')! });
        p2.hand = Array(2).fill({ ...DUMMY_CARDS.find(c => c.id === 'ST03-002')! });

        const skill = DUMMY_CARDS.find(c => c.id === 'ST03-012')!;
        p1.hand.push({ ...skill });

        engine.state.phase = Phase.MAIN;
        engine.playSkill(p1.hand.length - 1);

        // Selection mode for P1 to discard 1
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        engine.selectHandTarget(0, false);

        // Then selection mode for P2 to discard 1
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        engine.selectHandTarget(0, true);

        expect(p1.hand.length).toBe(1);
        expect(p2.hand.length).toBe(1);
    });

    it('ST03-013 Blackening: should trash unit from hand to trash lower cost unit on field', () => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.addLeaderLevel(0, 2); // Level 3
        // Opponent has 2-cost unit
        p2.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-004')! };

        // P1 hand has 3-cost unit (to trash as cost) and skill
        const unitToTrash = { ...DUMMY_CARDS.find(c => c.id === 'ST03-007')! }; // Cost 3
        const skill = DUMMY_CARDS.find(c => c.id === 'ST03-013')!;
        p1.hand = [unitToTrash, skill];

        engine.state.phase = Phase.MAIN;
        engine.playSkill(1);

        // Cost selection: Trash unit from hand
        expect(engine.state.interactionMode).toBe('SELECT_COST');
        engine.selectCost(0);

        // Target selection: Trash lower cost unit on field
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        engine.selectTarget(0, true);

        expect(p2.unitZones[0].unit).toBeNull();
    });

    it('ST03-014 Sense Sharing: should trash own unit to draw 2', () => {
        const p1 = engine.state.players[0];
        engine.addLeaderLevel(0, 2); // Level 3
        p1.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-002')! };

        const skill = DUMMY_CARDS.find(c => c.id === 'ST03-014')!;
        p1.hand = [skill];

        engine.state.phase = Phase.MAIN;
        engine.playSkill(0);

        // Select own unit to trash
        expect(engine.state.interactionMode).toBe('SELECT_TARGET');
        engine.selectTarget(0, false);

        expect(p1.unitZones[0].unit).toBeNull();
        expect(p1.hand.length).toBe(2);
    });

    it('ST03-015 Come On!: should trash own unit and encounter unit', () => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        engine.addLeaderLevel(0, 3); // Level 4
        p1.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-002')! };
        p2.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-002')! };

        const skill = DUMMY_CARDS.find(c => c.id === 'ST03-015')!;
        p1.hand = [skill];

        engine.state.phase = Phase.MAIN;
        engine.playSkill(0);

        // Select own unit
        engine.selectTarget(0, false);

        expect(p1.unitZones[0].unit).toBeNull();
        expect(p2.unitZones[0].unit).toBeNull();
    });

    it('ST03-016 Kevlar Vest: should end attack on defense', () => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        p1.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-002')!, power: 5000 };
        p2.unitZones[0].unit = { ...DUMMY_CARDS.find(c => c.id === 'ST03-002')! };
        const vest = DUMMY_CARDS.find(c => c.id === 'ST03-016')!;
        p2.unitZones[0].items.push({ ...vest });

        engine.state.phase = Phase.ATTACK;
        engine.attack(0);
        engine.resolveBlock(true);

        expect(p2.unitZones[0].unit).toBeNull(); // Vest trashed unit
        expect(p1.unitZones[0].unit).not.toBeNull(); // Attacker survived (Combat skipped)
    });
});
