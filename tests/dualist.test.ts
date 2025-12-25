import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase } from '../src/logic/types';

// Mock Cards
const leader: Card = { id: 'L01', name: 'Leader', type: CardType.LEADER, attribute: Attribute.NONE, cost: 0, text: '' };
const unitNormal: Card = { id: 'U01', name: 'Normal Unit', type: CardType.UNIT, attribute: Attribute.NONE, cost: 1, power: 1000, hit: 1, text: '' };
const unitDualist: Card = { 
    id: 'U04', 
    name: 'Dualist', 
    type: CardType.UNIT, 
    attribute: Attribute.NONE, 
    cost: 1, 
    power: 2000, 
    hit: 1, 
    text: 'DUALIST',
    keywords: 'DUALIST'
};

function setupGame() {
    const deck1 = Array(10).fill(unitNormal);
    const deck2 = Array(10).fill(unitNormal);
    return new GameEngine('P1', 'P2', deck1, deck2, leader, leader);
}

async function testDualist() {
    console.log("Running: testDualist");
    const engine = setupGame();
    
    // Setup state
    engine.state.phase = Phase.ATTACK;
    engine.currentPlayer.unitZones[0].unit = unitDualist;
    engine.opponentPlayer.unitZones[0].unit = unitNormal;
    
    // Attack
    engine.attack(0);
    // Should enter BLOCK phase
    if (engine.state.phase !== Phase.BLOCK) throw new Error("Should be in BLOCK phase");
    
    // Resolve block with 'false' (attempt to not block)
    // But DUALIST should force it to combat
    engine.resolveBlock(false);
    
    // Verify
    // Blocker should be destroyed due to combat (2000 vs 1000)
    if (engine.opponentPlayer.unitZones[0].unit !== null) throw new Error("Blocker should be destroyed (forced block failed)");
    
    // Opponent should NOT have taken direct damage
    if (engine.opponentPlayer.damage.length > 0) throw new Error("Opponent should not have taken damage");
    
    console.log("PASSED: testDualist");
}

testDualist().catch(err => {
    console.error(err);
    process.exit(1);
});
