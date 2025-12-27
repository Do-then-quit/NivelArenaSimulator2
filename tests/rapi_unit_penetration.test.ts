import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function testRapiPenetration() {
    console.log("Running: testRapiPenetration");
    
    const p1Leader = getCard('ST01-001');
    const p1Deck = Array(40).fill(0).map((_, i) => ({...getCard('ST01-002'), id: `P1_C${i}`}));
    
    const engine = new GameEngine('P1', 'P2', p1Deck, p1Deck, p1Leader, p1Leader);
    
    // P1 has Rapi Unit (ST01-011) in zone 0
    const rapi = getCard('ST01-011');
    engine.state.players[0].unitZones[0].unit = { ...rapi, id: 'RAPI_UNIT' };
    
    // P2 has Neon (ST01-002, 3000 ATK) in zone 0
    const neon = getCard('ST01-002');
    engine.state.players[1].unitZones[0].unit = { ...neon, id: 'NEON' };
    
    engine.state.phase = Phase.ATTACK;
    engine.state.turnPlayerIndex = 0; // P1
    
    const initialDamage = engine.state.players[1].damage.length;
    
    console.log("Rapi attacking Neon...");
    engine.attack(0);
    
    console.log("Resolving Block...");
    engine.resolveBlock(true); // Neon blocks
    
    // Neon should be trashed (Rapi 7500 > Neon 3000)
    if (engine.state.players[1].unitZones[0].unit === null) {
        console.log("Neon trashed.");
    } else {
        throw new Error("Neon should have been trashed.");
    }
    
    // Check Penetration Damage (expected 1)
    const finalDamage = engine.state.players[1].damage.length;
    console.log(`Initial Damage: ${initialDamage}, Final Damage: ${finalDamage}`);
    
    if (finalDamage === initialDamage + 1) {
        console.log("SUCCESS: Rapi dealt penetration damage.");
    } else {
        console.log("FAIL: Rapi did not deal penetration damage.");
        process.exit(1);
    }
}

testRapiPenetration().catch(err => {
    console.error(err);
    process.exit(1);
});
