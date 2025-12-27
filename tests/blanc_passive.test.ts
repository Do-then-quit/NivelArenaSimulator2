import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function testBlancPassive() {
    console.log("Running: testBlancPassive");
    
    const p1Leader = getCard('ST01-001');
    const p1Deck = Array(40).fill(0).map((_, i) => ({...getCard('ST01-002'), id: `P1_C${i}`}));
    
    const engine = new GameEngine('P1', 'P2', p1Deck, p1Deck, p1Leader, p1Leader);
    
    // Set up state: P1 has Blanc (ST01-008) in zone 0
    const blanc = getCard('ST01-008');
    engine.state.players[0].unitZones[0].unit = { ...blanc, id: 'BLANC' };
    
    engine.state.phase = Phase.MAIN;
    engine.state.turnPlayerIndex = 0; // P1
    
    // Current Turn: P1
    // Blanc's passive should apply.
    const power = engine.getUnitPower(engine.state.players[0].unitZones[0], engine.state.players[0]);
    console.log(`Blanc Base Power: ${blanc.power}`);
    console.log(`Blanc Current Power: ${power}`);
    
    if (power > blanc.power!) {
        console.log("FAIL: Blanc is buffing herself but she doesn't have ATTACKER keyword.");
        process.exit(1);
    } else {
        console.log("SUCCESS: Blanc is not buffing herself.");
    }
}

testBlancPassive().catch(err => {
    console.error(err);
    process.exit(1);
});
