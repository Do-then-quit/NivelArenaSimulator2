import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase, ActivationCondition } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function testST01_004_006_Database() {
    console.log("Running: testST01_004_006_Database");
    
    // ST01-004 Eunhwa
    const eunhwa = getCard('ST01-004');
    if (eunhwa.name !== '은화') throw new Error(`Expected Eunhwa, got ${eunhwa.name}`);
    if (eunhwa.power !== 4000) throw new Error(`Expected 4000 power, got ${eunhwa.power}`);

    // ST01-005 Noise
    const noise = getCard('ST01-005');
    if (noise.name !== '노이즈') throw new Error(`Expected Noise, got ${noise.name}`);
    const attackerEffect = noise.effects.find(e => e.activation === ActivationCondition.ATTACKER);
    if (!attackerEffect) throw new Error("Noise should have an ATTACKER effect");
    if (attackerEffect.action.params.value !== 2000) throw new Error("Noise should give +2000 power");

    // ST01-006 Noir
    const noir = getCard('ST01-006');
    if (noir.name !== '누아르') throw new Error(`Expected Noir, got ${noir.name}`);
    const entryEffect = noir.effects.find(e => e.activation === ActivationCondition.ENTRY);
    if (!entryEffect) throw new Error("Noir should have an ENTRY effect");
    if (entryEffect.action.params.value !== -3000) throw new Error("Noir should give -3000 power");

    console.log("PASSED: testST01_004_006_Database");
}

async function runTests() {
    await testST01_004_006_Database();
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
