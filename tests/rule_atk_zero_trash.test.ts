import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase, ActivationCondition, Effect } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function testAtkZeroTrashing() {
    console.log("Running: testAtkZeroTrashing");
    
    const p1Leader = getCard('ST01-001');
    const p2Leader = getCard('ST01-001');
    const p1Deck = Array(40).fill(0).map((_, i) => ({...getCard('ST01-002'), id: `P1_C${i}`}));
    const p2Deck = Array(40).fill(0).map((_, i) => ({...getCard('ST01-002'), id: `P2_C${i}`}));
    
    const engine = new GameEngine('P1', 'P2', p1Deck, p2Deck, p1Leader, p2Leader);
    
    // Set up state: P2 has a 3000 ATK unit (Neon)
    const neon = getCard('ST01-002');
    engine.state.players[1].unitZones[0].unit = { ...neon, id: 'TARGET_NEON' };
    
    // P1 plays Noir (ST01-006) which has ENTRY: -3000 ATK to encounter unit
    const noir = getCard('ST01-006');
    engine.state.phase = Phase.MAIN;
    engine.state.turnPlayerIndex = 0; // P1
    
    // Manual setup to force encounter
    engine.state.players[0].unitZones[0].unit = { ...noir, id: 'NOIR' };
    
    console.log("Applying Power Reduction effect (-3000)...");
    const effect: Effect = {
        description: "Test -3000",
        activation: ActivationCondition.ENTRY,
        action: {
            type: 'BUFF_POWER',
            params: { value: -3000 }
        },
        duration: 'TURN_END',
        targets: { scope: 'ENCOUNTER_UNIT', selectMode: 'AUTO' }
    };
    
    const context = {
        sourceCard: noir,
        player: engine.state.players[0],
        opponent: engine.state.players[1],
        unitZone: engine.state.players[0].unitZones[0],
        machine: engine
    };

    const targetZone = engine.state.players[1].unitZones[0];
    engine.effectManager.executeEffect(effect, context, [targetZone]);
    
    const targetUnit = targetZone.unit;
    if (targetUnit) {
        const power = engine.getUnitPower(targetZone, engine.state.players[1]);
        console.log(`Target Unit Power: ${power}`);
        if (power <= 0) {
            console.log("Target unit power is 0 or less.");
        }
    } else {
        console.log("Target unit is already gone.");
    }

    // Check if unit is still there (it should be if rule is not implemented)
    if (engine.state.players[1].unitZones[0].unit !== null) {
        console.log("FAIL: Unit with 0 power is still on the field.");
        process.exit(1);
    } else {
        console.log("SUCCESS: Unit with 0 power was trashed.");
    }
}

testAtkZeroTrashing().catch(err => {
    console.error(err);
    process.exit(1);
});
