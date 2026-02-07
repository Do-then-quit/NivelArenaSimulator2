import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function testRapiAwakening() {
    console.log("Running: testRapiAwakening");
    
    const rapiLeader = getCard('ST01-001');
    const deck = Array(40).fill(0).map((_, i) => ({...getCard('ST01-002'), id: `C${i}`}));
    
    const engine = new GameEngine('P1', 'P2', deck, deck, rapiLeader, rapiLeader);
    
    // Initial level is 1.
    engine.state.phase = Phase.LEVEL_UP;
    engine.currentPlayer.leaderLevel = 4;
    
    console.log("Advancing to Level 5...");
    engine.nextPhase(); // LEVEL_UP (advances level to 5)
    
    console.log(`Current Level: ${engine.currentPlayer.leaderLevel}`);
    console.log(`Is Awakened: ${engine.currentPlayer.levelZone?.isAwakened}`);
    
    if (engine.currentPlayer.leaderLevel === 5 && engine.currentPlayer.levelZone?.isAwakened) {
        console.log("SUCCESS: Rapi awakened at level 5.");
    } else {
        console.log("FAIL: Rapi did not awaken at level 5.");
        process.exit(1);
    }
}

testRapiAwakening().catch(err => {
    console.error(err);
    process.exit(1);
});
