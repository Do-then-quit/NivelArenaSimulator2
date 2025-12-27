import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase, ActivationCondition } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function testST01_007_009_Database() {
    console.log("Running: testST01_007_009_Database");
    
    // ST01-007 Viper
    const viper = getCard('ST01-007');
    if (viper.name !== '바이퍼') throw new Error(`Expected Viper, got ${viper.name}`);
    const attackerEffect = viper.effects.find(e => e.activation === ActivationCondition.ATTACKER);
    if (!attackerEffect) throw new Error("Viper should have an ATTACKER effect");

    // ST01-008 Blanc
    const blanc = getCard('ST01-008');
    if (blanc.name !== '블랑') throw new Error(`Expected Blanc, got ${blanc.name}`);
    const passiveEffect = blanc.effects.find(e => e.activation === ActivationCondition.PASSIVE);
    if (!passiveEffect) throw new Error("Blanc should have a PASSIVE effect");
    
    const traitFilter = passiveEffect.targets?.filters?.find(f => f.type === 'HAS_TRAIT');
    if (traitFilter?.value !== '어태커') throw new Error("Blanc should filter for '어태커' trait");

    // ST01-009 Emma
    const emma = getCard('ST01-009');
    if (emma.name !== '엠마') throw new Error(`Expected Emma, got ${emma.name}`);
    if (emma.power !== 7000) throw new Error(`Expected 7000 power, got ${emma.power}`);

    console.log("PASSED: testST01_007_009_Database");
}

async function runTests() {
    await testST01_007_009_Database();
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
