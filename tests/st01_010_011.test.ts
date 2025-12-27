import { Card, CardType, ActivationCondition } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function testST01_010_011_Database() {
    console.log("Running: testST01_010_011_Database");
    
    // ST01-010 Anis
    const anis = getCard('ST01-010');
    if (anis.name !== '아니스') throw new Error(`Expected Anis, got ${anis.name}`);
    
    const activeEffect = anis.effects.find(e => e.activation === ActivationCondition.ACTIVE);
    if (!activeEffect) throw new Error("Anis should have an ACTIVE effect");
    
    const triggerEffect = anis.effects.filter(e => e.activation === ActivationCondition.DAMAGE_TRIGGER);
    if (triggerEffect.length < 2) throw new Error("Anis should have at least 2 trigger effects (Action + Trash self)");

    // ST01-011 Rapi (Unit)
    const rapi = getCard('ST01-011');
    if (rapi.name !== '라피') throw new Error(`Expected Rapi, got ${rapi.name}`);
    
    const penetrationEffect = rapi.effects.find(e => e.activation === ActivationCondition.ATTACKER);
    if (!penetrationEffect) throw new Error("Rapi should have an ATTACKER effect (Penetration)");
    if (penetrationEffect.action.type !== 'PENETRATION') throw new Error("Rapi effect should be PENETRATION");

    const rapiTrigger = rapi.effects.find(e => e.activation === ActivationCondition.DAMAGE_TRIGGER);
    if (!rapiTrigger) throw new Error("Rapi should have a trigger effect");
    if (rapiTrigger.action.type !== 'RETURN_TO_HAND') throw new Error("Rapi trigger should be RETURN_TO_HAND");

    console.log("PASSED: testST01_010_011_Database");
}

async function runTests() {
    await testST01_010_011_Database();
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
