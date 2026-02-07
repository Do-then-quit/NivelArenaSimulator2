import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase } from '../src/logic/types';

// Mock Cards
const leader: Card = { id: 'L01', name: 'Leader', type: CardType.LEADER, attribute: Attribute.NONE, cost: 0, text: '' };
const unitNormal: Card = { id: 'U01', name: 'Normal Unit', type: CardType.UNIT, attribute: Attribute.NONE, cost: 1, power: 1000, hit: 1, text: '' };
const unitPenetrator: Card = { 
    id: 'U02', 
    name: 'Penetrator', 
    type: CardType.UNIT, 
    attribute: Attribute.NONE, 
    cost: 1, 
    power: 2000, 
    hit: 2, 
    text: 'PENETRATION',
    keywords: 'PENETRATION'
};

function setupGame() {
    const deck1 = Array(10).fill(unitNormal);
    const deck2 = Array(10).fill(unitNormal);
    return new GameEngine('P1', 'P2', deck1, deck2, leader, leader);
}

async function testPenetration() {
    console.log("Running: testPenetration");
    const engine = setupGame();
    
    // Setup state
    engine.state.phase = Phase.ATTACK;
    engine.currentPlayer.unitZones[0].unit = unitPenetrator;
    engine.opponentPlayer.unitZones[0].unit = unitNormal;
    
    const initialOpponentDamage = engine.opponentPlayer.damage.length;
    
    // Attack
    engine.attack(0);
    // Should enter BLOCK phase
    if (engine.state.phase !== Phase.BLOCK) throw new Error("Should be in BLOCK phase");
    
    // Resolve block
    engine.resolveBlock(true);
    
    // Verify
    // Blocker should be destroyed
    if (engine.opponentPlayer.unitZones[0].unit !== null) throw new Error("Blocker should be destroyed");
    
    // Damage should have been dealt due to PENETRATION (2 damage)
    const finalOpponentDamage = engine.opponentPlayer.damage.length;
    console.log(`Initial Damage: ${initialOpponentDamage}, Final Damage: ${finalOpponentDamage}`);
    
    if (finalOpponentDamage !== initialOpponentDamage + 2) {
        throw new Error(`Expected 2 damage, got ${finalOpponentDamage - initialOpponentDamage}`);
    }
    
    console.log("PASSED: testPenetration");
}

testPenetration().catch(err => {
    console.error(err);
    process.exit(1);
});
