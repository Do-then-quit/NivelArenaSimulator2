import { Card, CardType, ActivationCondition } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function testST01_012_013_Database() {
    console.log("Running: testST01_012_013_Database");
    
    // ST01-012 Weakness Insight
    const insight = getCard('ST01-012');
    if (insight.name !== '약점 간파') throw new Error(`Expected Weakness Insight, got ${insight.name}`);
    if (insight.type !== CardType.SKILL) throw new Error("Should be a SKILL");
    const insightEffect = insight.effects.find(e => e.activation === ActivationCondition.ENTRY);
    if (!insightEffect) throw new Error("Weakness Insight should have an ENTRY effect");
    if (insightEffect.action.params.value !== -2000) throw new Error("Effect should be -2000 power");

    // ST01-013 Reinforcement
    const reinforcement = getCard('ST01-013');
    if (reinforcement.name !== '전력 보강') throw new Error(`Expected Reinforcement, got ${reinforcement.name}`);
    
    const entryEffect = reinforcement.effects.find(e => e.activation === ActivationCondition.ENTRY);
    if (!entryEffect) throw new Error("Reinforcement should have an ENTRY effect");
    if (entryEffect.action.type !== 'MOVE_FROM_TRASH_TO_HAND') throw new Error("Effect should be MOVE_FROM_TRASH_TO_HAND");

    const triggerEffects = reinforcement.effects.filter(e => e.activation === ActivationCondition.DAMAGE_TRIGGER);
    if (triggerEffects.length < 2) throw new Error("Reinforcement should have trigger effects");

    console.log("PASSED: testST01_012_013_Database");
}

async function runTests() {
    await testST01_012_013_Database();
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
