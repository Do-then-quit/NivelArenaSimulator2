import { Card, CardType, ActivationCondition } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function testST01_016_017_Database() {
    console.log("Running: testST01_016_017_Database");
    
    // ST01-016 Rare Metal Boots
    const boots = getCard('ST01-016');
    if (boots.name !== '레어 메탈 부츠') throw new Error(`Expected Rare Metal Boots, got ${boots.name}`);
    if (boots.type !== CardType.ITEM) throw new Error("Should be an ITEM");
    const bootsEffect = boots.effects.find(e => e.activation === ActivationCondition.ATTACKER);
    if (!bootsEffect) throw new Error("Rare Metal Boots should have an ATTACKER effect");
    if (bootsEffect.action.params.value !== 2000) throw new Error("Effect should be +2000 power");

    // ST01-017 Kevlar Gloves
    const gloves = getCard('ST01-017');
    if (gloves.name !== '케블라 글러브') throw new Error(`Expected Kevlar Gloves, got ${gloves.name}`);
    if (gloves.type !== CardType.ITEM) throw new Error("Should be an ITEM");
    
    const glovesEffect = gloves.effects.find(e => e.activation === ActivationCondition.ATTACKER);
    if (!glovesEffect) throw new Error("Kevlar Gloves should have an ATTACKER effect");
    if (glovesEffect.action.type !== 'PLUNDER') throw new Error("Effect should be PLUNDER");

    console.log("PASSED: testST01_016_017_Database");
}

async function runTests() {
    await testST01_016_017_Database();
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
