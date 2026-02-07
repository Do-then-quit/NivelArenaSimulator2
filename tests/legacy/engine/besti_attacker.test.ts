import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function testBestiAttacker() {
    console.log("Running: testBestiAttacker");
    
    const p1Leader = getCard('ST01-001');
    const p1Deck = Array(40).fill(0).map((_, i) => ({...getCard('ST01-002'), id: `P1_C${i}`}));
    const p2Deck = Array(40).fill(0).map((_, i) => ({...getCard('ST01-002'), id: `P2_C${i}`}));
    
    const engine = new GameEngine('P1', 'P2', p1Deck, p2Deck, p1Leader, p1Leader);
    
    // Set up state: P1 has Besti (ST01-003) in zone 0
    const besti = getCard('ST01-003');
    engine.state.players[0].unitZones[0].unit = { ...besti, id: 'BESTI' };
    
    // P2 has Neon (ST01-002, 3000 ATK) in zone 0
    const neon = getCard('ST01-002');
    engine.state.players[1].unitZones[0].unit = { ...neon, id: 'NEON' };
    
    engine.state.phase = Phase.ATTACK;
    engine.state.turnPlayerIndex = 0; // P1
    
    console.log("Besti attacking Neon...");
    engine.attack(0);
    
    if (engine.state.phase !== Phase.BLOCK) {
        throw new Error(`Expected phase BLOCK, got ${engine.state.phase}`);
    }
    
    console.log("Resolving Block...");
    engine.resolveBlock(true); // Neon blocks
    
    // Check results
    if (engine.state.players[1].unitZones[0].unit === null) {
        console.log("SUCCESS: Neon was trashed by Besti.");
    } else {
        const bestiPower = engine.getUnitPower(engine.state.players[0].unitZones[0], engine.state.players[0]);
        const neonPower = engine.getUnitPower(engine.state.players[1].unitZones[0], engine.state.players[1]);
        console.log(`FAIL: Neon is still there. Besti Power: ${bestiPower}, Neon Power: ${neonPower}`);
        process.exit(1);
    }
}

testBestiAttacker().catch(err => {
    console.error(err);
    process.exit(1);
});
