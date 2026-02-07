import { Card, CardType, ActivationCondition } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function testST01_014_015_Database() {
    console.log("Running: testST01_014_015_Database");
    
    // ST01-014 Only Firepower!
    const firepower = getCard('ST01-014');
    if (firepower.name !== '오직 화력!') throw new Error(`Expected Only Firepower!, got ${firepower.name}`);
    const fpEffect = firepower.effects.find(e => e.activation === ActivationCondition.ENTRY);
    if (!fpEffect) throw new Error("Only Firepower! should have an ENTRY effect");
    if (fpEffect.action.params.value !== 2000) throw new Error("Effect should be +2000 power");
    if (fpEffect.targets?.selectMode !== 'ALL') throw new Error("Should target ALL");

    // ST01-015 Missile
    const missile = getCard('ST01-015');
    if (missile.name !== '미사일') throw new Error(`Expected Missile, got ${missile.name}`);
    
    const entryEffect = missile.effects.find(e => e.activation === ActivationCondition.ENTRY);
    if (!entryEffect) throw new Error("Missile should have an ENTRY effect");
    if (entryEffect.action.params.value !== -5000) throw new Error("Effect should be -5000 power");

    const triggerEffects = missile.effects.filter(e => e.activation === ActivationCondition.DAMAGE_TRIGGER);
    if (triggerEffects.length < 2) throw new Error("Missile should have trigger effects");

    console.log("PASSED: testST01_014_015_Database");
}

async function runTests() {
    await testST01_014_015_Database();
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
