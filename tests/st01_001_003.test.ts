import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase, ActivationCondition } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function testST01_DatabasePresence() {
    console.log("Running: testST01_DatabasePresence");
    
    // ST01-001 Rapi
    const rapi = getCard('ST01-001');
    if (rapi.name !== '라피') throw new Error(`Expected Rapi, got ${rapi.name}`);
    if (rapi.type !== CardType.LEADER) throw new Error("Rapi should be a Leader");

    // ST01-002 Neon
    const neon = getCard('ST01-002');
    if (neon.name !== '네온') throw new Error(`Expected Neon, got ${neon.name}`);
    if (neon.power !== 3000) throw new Error(`Expected 3000 power, got ${neon.power}`);

    // ST01-003 Vesti
    const vesti = getCard('ST01-003');
    if (vesti.name !== '베스티') throw new Error(`Expected Vesti, got ${vesti.name}`);
    
    const attackerEffect = vesti.effects.find(e => e.activation === ActivationCondition.ATTACKER);
    if (!attackerEffect) throw new Error("Vesti should have an ATTACKER effect");
    
    console.log("PASSED: testST01_DatabasePresence");
}

async function runTests() {
    await testST01_DatabasePresence();
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});