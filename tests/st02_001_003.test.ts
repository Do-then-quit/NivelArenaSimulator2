import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase, ActivationCondition } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

// Helper to get fresh card objects
function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function setupGame() {
    const leader = getCard('ST02-001');
    const deck1 = Array(10).fill(getCard('ST02-002'));
    const deck2 = Array(10).fill(getCard('ST02-002'));
    return new GameEngine('P1', 'P2', deck1, deck2, leader, leader);
}

async function testST02_001_Awakening() {
    console.log("Running: testST02_001_Awakening");
    const engine = setupGame();
    const player = engine.currentPlayer;
    
    // Initial: Level 1, not awakened
    if (player.levelZone?.isAwakened) throw new Error("Should not be awakened yet");
    
    // Set level to 5 manually
    player.leaderLevel = 5;
    engine.state.phase = Phase.LEVEL_UP;
    
    // Trigger Level Up
    engine.nextPhase(); // Level 5 -> 6, triggers awakening
    
    if (player.leaderLevel !== 6) throw new Error(`Expected level 6, got ${player.leaderLevel}`);
    if (!player.levelZone?.isAwakened) throw new Error("Leader should be awakened at level 6");
    
    // Check Size Bonus: Level 6 + 0 damage + 1 (Awakened Passive) = 7
    const size = engine.getPlayerSize(player);
    if (size !== 7) throw new Error(`Expected size 7, got ${size}`);
    
    console.log("PASSED: testST02_001_Awakening");
}

async function testST02_003_Exit() {
    console.log("Running: testST02_003_Exit");
    const engine = setupGame();
    const player = engine.currentPlayer;
    
    const mica = getCard('ST02-003');
    player.unitZones[0].unit = mica;
    
    const initialLevel = player.leaderLevel;
    
    // Destroy unit
    engine.destroyUnit(player, player.unitZones[0]);
    
    if (player.leaderLevel !== initialLevel + 1) {
        throw new Error(`Expected level ${initialLevel + 1}, got ${player.leaderLevel}`);
    }
    
    console.log("PASSED: testST02_003_Exit");
}

async function runTests() {
    await testST02_001_Awakening();
    await testST02_003_Exit();
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
