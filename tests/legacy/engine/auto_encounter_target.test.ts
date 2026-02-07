import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase, ActivationCondition } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function testAutoEncounterTarget() {
    console.log("Running: testAutoEncounterTarget");
    
    const p1Leader = getCard('ST01-001');
    const p1Deck = Array(40).fill(0).map((_, i) => ({...getCard('ST01-002'), id: `P1_C${i}`}));
    const p2Deck = Array(40).fill(0).map((_, i) => ({...getCard('ST01-002'), id: `P2_C${i}`}));
    
    const engine = new GameEngine('P1', 'P2', p1Deck, p2Deck, p1Leader, p1Leader);
    
    // Set up state: P2 has a unit in zone 0
    const neon = getCard('ST01-002');
    engine.state.players[1].unitZones[0].unit = { ...neon, id: 'TARGET_NEON' };
    
    // P1 plays Noir (ST01-006) in zone 0
    const noir = getCard('ST01-006');
    engine.state.phase = Phase.MAIN;
    engine.state.turnPlayerIndex = 0; // P1
    engine.state.players[0].unitZones[0].unit = { ...noir, id: 'NOIR' };
    
    console.log("Processing ENTRY effects for Noir...");
    engine.effectManager.processEffects(ActivationCondition.ENTRY, {
        sourceCard: noir,
        player: engine.state.players[0],
        opponent: engine.state.players[1],
        unitZone: engine.state.players[0].unitZones[0],
        machine: engine
    });
    
    console.log(`Interaction Mode: ${engine.state.interactionMode}`);
    
    if (engine.state.interactionMode === 'SELECT_TARGET') {
        console.log("FAIL: Interaction mode is SELECT_TARGET. Expected automatic selection.");
    } else {
        // Verify effect was actually applied
        const targetZone = engine.state.players[1].unitZones[0];
        const power = engine.getUnitPower(targetZone, engine.state.players[1]);
        if (power === 0) {
            console.log("SUCCESS: Effect applied automatically.");
        } else {
            console.log(`FAIL: Effect not applied. Power is ${power}`);
        }
    }
}

testAutoEncounterTarget().catch(err => {
    console.error(err);
    process.exit(1);
});
