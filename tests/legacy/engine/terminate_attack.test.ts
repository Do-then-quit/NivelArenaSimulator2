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
    cost: 3,
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
    cost: 2,
    power: 1000, // Very weak, would die in combat
    hit: 1,
    text: 'Defender Unit',
    imageUrl: ''
};

const terminationItem: Card = {
    id: 'ITEM01',
    name: 'Kevlar Vest',
    type: CardType.ITEM,
    attribute: Attribute.STORM,
    cost: 2,
    text: 'Defender: Terminate',
    imageUrl: '',
    effects: [
        {
            activation: ActivationCondition.DEFENDER,
            description: "Defender : Terminate",
            action: { type: 'TERMINATE_ATTACK' as any, params: {} },
            condition: { type: 'ALWAYS' }
        }
    ]
};

describe('Terminate Attack Logic', () => {
    let engine: GameEngine;

    beforeEach(() => {
        const deck1 = Array(10).fill(attackerCard);
        const deck2 = Array(10).fill(defenderCard);
        engine = new GameEngine('P1', 'P2', deck1, deck2, mockLeader, mockLeader);
    });

    it('should terminate the attack and trash the defender unit immediately', () => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        // Setup Field
        // P1 Attacker in Zone 0
        p1.unitZones[0].unit = { ...attackerCard };

        // P2 Defender in Zone 0 equipped with Termination Item
        p2.unitZones[0].unit = { ...defenderCard };
        p2.unitZones[0].items.push({ ...terminationItem });

        // Phase Attack
        engine.state.phase = 'ATTACK' as any;
        engine.state.turnPlayerIndex = 0;

        // P1 Attacks
        engine.attack(0);

        // P2 Blocks
        engine.resolveBlock(true);

        // Expectation:
        // 1. Defender Unit Trashed (by Terminate effect)
        expect(p2.unitZones[0].unit).toBeNull();
        expect(p2.trash.length).toBeGreaterThan(0); // Unit + Item trashed

        // 2. Attacker Unit Survives (Combat skipped)
        expect(p1.unitZones[0].unit).not.toBeNull();
        // Attacker has high power (5000) vs Defender (1000), if combat happened Defender dies anyway,
        // but if combat happened, Attacker would survive anyway.
        // How to prove combat SKIPPED?
        // Check logs? Or side effects?
        // If combat happened, Attacker would NOT die (5000 vs 1000).
        // If Defender had High Power (10000) and Terminate, Attacker should survive.
        // Let's modify attacker/defender stats in a new test case to prove combat skip.
    });

    it('should skip combat damage calculation when terminated', () => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];

        // P1 Attacker (Weak)
        p1.unitZones[0].unit = { ...attackerCard, power: 1000 };

        // P2 Defender (Strong + Terminate)
        p2.unitZones[0].unit = { ...defenderCard, power: 9000 };
        p2.unitZones[0].items.push({ ...terminationItem });

        engine.state.phase = 'ATTACK' as any;
        engine.state.turnPlayerIndex = 0;

        engine.attack(0);
        engine.resolveBlock(true);

        // Defender Trashed by Effect
        expect(p2.unitZones[0].unit).toBeNull();

        // Attacker survives (Because combat skipped)
        // If combat happened, 1000 vs 9000 => Attacker dies.
        expect(p1.unitZones[0].unit).not.toBeNull();
    });
});
