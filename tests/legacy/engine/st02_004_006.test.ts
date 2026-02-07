import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

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

async function testST02_005_Entry() {
    console.log("Running: testST02_005_Entry");
    const engine = setupGame();
    const player = engine.currentPlayer;
    
    // Setup for play
    engine.state.phase = Phase.MAIN;
    player.leaderLevel = 5;
    player.hand = [getCard('ST02-005')];
    
    const initialLevel = player.leaderLevel;
    
    // Play unit
    engine.playUnit(0, 0);
    
    if (player.unitZones[0].unit?.id !== 'ST02-005') throw new Error("Yan should be on field");
    
    if (player.leaderLevel !== initialLevel + 1) {
        throw new Error(`Expected level ${initialLevel + 1}, got ${player.leaderLevel}`);
    }
    
    console.log("PASSED: testST02_005_Entry");
}

async function runTests() {
    await testST02_005_Entry();
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
