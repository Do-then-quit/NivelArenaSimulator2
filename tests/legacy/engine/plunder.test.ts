import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase } from '../src/logic/types';

// Mock Cards
const leader: Card = { id: 'L01', name: 'Leader', type: CardType.LEADER, attribute: Attribute.NONE, cost: 0, text: '' };
const unitNormal: Card = { id: 'U01', name: 'Normal Unit', type: CardType.UNIT, attribute: Attribute.NONE, cost: 1, power: 1000, hit: 1, text: '' };
const unitPlunderer: Card = { 
    id: 'U03', 
    name: 'Plunderer', 
    type: CardType.UNIT, 
    attribute: Attribute.NONE, 
    cost: 1, 
    power: 2000, 
    hit: 1, 
    text: 'PLUNDER',
    keywords: 'PLUNDER'
};

function setupGame() {
    const deck1 = Array(10).fill(unitNormal);
    const deck2 = Array(10).fill(unitNormal);
    return new GameEngine('P1', 'P2', deck1, deck2, leader, leader);
}

async function testPlunder() {
    console.log("Running: testPlunder");
    const engine = setupGame();
    
    // Setup state
    engine.state.phase = Phase.ATTACK;
    engine.currentPlayer.unitZones[0].unit = unitPlunderer;
    engine.opponentPlayer.unitZones[0].unit = unitNormal;
    
    const initialHandSize = engine.currentPlayer.hand.length;
    
    // Attack
    engine.attack(0);
    // Should enter BLOCK phase
    if (engine.state.phase !== Phase.BLOCK) throw new Error("Should be in BLOCK phase");
    
    // Resolve block
    engine.resolveBlock(true);
    
    // Verify
    // Blocker should be destroyed
    if (engine.opponentPlayer.unitZones[0].unit !== null) throw new Error("Blocker should be destroyed");
    
    // Card should have been drawn due to PLUNDER
    const finalHandSize = engine.currentPlayer.hand.length;
    console.log(`Initial Hand: ${initialHandSize}, Final Hand: ${finalHandSize}`);
    
    if (finalHandSize !== initialHandSize + 1) {
        throw new Error(`Expected 1 draw, got ${finalHandSize - initialHandSize}`);
    }
    
    console.log("PASSED: testPlunder");
}

testPlunder().catch(err => {
    console.error(err);
    process.exit(1);
});
