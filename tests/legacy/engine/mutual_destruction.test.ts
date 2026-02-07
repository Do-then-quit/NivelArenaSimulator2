import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, ActivationCondition } from '../src/logic/types';

// Mock Cards
const mockLeader: Card = {
    id: 'L001',
    name: 'Leader',
    type: CardType.LEADER,
    attribute: Attribute.FIRE,
    cost: 0,
    text: '',
    imageUrl: ''
};

const attackerCard: Card = {
    id: 'ATT01',
    name: 'Attacker',
    type: CardType.UNIT,
    attribute: Attribute.FIRE,
    cost: 2, // Low cost to trigger mutual destruction
    power: 5000,
    hit: 1,
    text: '',
    imageUrl: ''
};

const defenderCard: Card = {
    id: 'DEF01',
    name: 'Defender',
    type: CardType.UNIT,
    attribute: Attribute.STORM,
    cost: 3,
    power: 3000, // Lower power, will lose combat
    hit: 1,
    text: 'Mutual Destruction',
    imageUrl: '',
    effects: [
        {
            activation: ActivationCondition.EXIT,
            description: "Mutual Destruction",
            action: { type: 'MUTUAL_DESTRUCTION' as any, params: {} }, // New action type
            condition: { type: 'ALWAYS' }
        }
    ]
};

describe('Mutual Destruction Logic', () => {
    let engine: GameEngine;

    beforeEach(() => {
        // Setup minimal deck
        const deck1 = Array(10).fill(attackerCard);
        const deck2 = Array(10).fill(defenderCard);
        engine = new GameEngine('P1', 'P2', deck1, deck2, mockLeader, mockLeader);
    });

    it('should trash the attacker when defender with MUTUAL_DESTRUCTION is destroyed in combat', () => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        // Setup Field
        // P1 (Turn Player) has Attacker in Zone 0
        p1.unitZones[0].unit = { ...attackerCard };
        p1.unitZones[0].unit.cost = 2; // Ensure cost <= 3 (defender cost) or arbitrary check

        // P2 has Defender in Zone 0
        p2.unitZones[0].unit = { ...defenderCard };
        
        // P2 Defender effect logic: "If trashed by combat and attacker cost <= 3, trash attacker"
        // We need to implement MUTUAL_DESTRUCTION to check this logic.
        // But wait, the standard Mutual Destruction usually compares costs? 
        // ST03-007 text: "이 유닛을 전투로 트래시한 상대 유닛의 코스트가 이 유닛의 코스트 이하라면"
        // (If opponent unit cost <= this unit cost)
        // Defender Cost: 3. Attacker Cost: 2. 2 <= 3 is TRUE. Should trigger.

        // Force Phase to Attack
        engine.state.phase = 'ATTACK' as any;
        engine.state.turnPlayerIndex = 0;

        // P1 attacks P2 (Zone 0 vs Zone 0)
        // P2 has a unit, so it goes to BLOCK phase
        engine.attack(0);

        // P2 blocks (or forced)
        engine.resolveBlock(true);

        // Result:
        // Attacker Power 5000 > Defender Power 3000.
        // Defender should be destroyed.
        expect(p2.unitZones[0].unit).toBeNull(); // Defender died
        expect(p2.trash).toHaveLength(1);

        // Mutual Destruction should have triggered and killed Attacker
        expect(p1.unitZones[0].unit).toBeNull(); // Attacker should also be dead
        expect(p1.trash).toHaveLength(1);
    });

    it('should NOT trash the attacker if attacker cost is higher than defender cost', () => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        // Setup Field
        // P1 Attacker Cost 4 (High Cost)
        p1.unitZones[0].unit = { ...attackerCard };
        p1.unitZones[0].unit.cost = 4; 

        // P2 Defender Cost 3
        p2.unitZones[0].unit = { ...defenderCard };

        engine.state.phase = 'ATTACK' as any;
        engine.state.turnPlayerIndex = 0;

        engine.attack(0);
        engine.resolveBlock(true);

        // Defender dies
        expect(p2.unitZones[0].unit).toBeNull();

        // Attacker should survive (Cost 4 > 3)
        expect(p1.unitZones[0].unit).not.toBeNull();
        expect(p1.trash).toHaveLength(0);
    });
});
