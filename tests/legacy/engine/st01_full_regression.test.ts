import { Card, CardType, ActivationCondition } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

async function runST01Regression() {
    console.log("Starting ST01 Full Regression Test...");

    const st01Ids = Array.from({ length: 17 }, (_, i) => `ST01-${(i + 1).toString().padStart(3, '0')}`);
    
    st01Ids.forEach(id => {
        const card = getCard(id);
        console.log(`Checking ${id}: ${card.name} (${card.type})`);
        
        // Basic Type Verification
        const num = parseInt(id.split('-')[1]);
        if (num === 1) {
            if (card.type !== CardType.LEADER) throw new Error(`${id} should be LEADER`);
        } else if (num >= 2 && num <= 11) {
            if (card.type !== CardType.UNIT) throw new Error(`${id} should be UNIT`);
        } else if (num >= 12 && num <= 15) {
            if (card.type !== CardType.SKILL) throw new Error(`${id} should be SKILL`);
        } else if (num >= 16 && num <= 17) {
            if (card.type !== CardType.ITEM) throw new Error(`${id} should be ITEM`);
        }

        // Effect verification (minimal check)
        if (card.effects && card.effects.length > 0) {
            console.log(`  - Effects: ${card.effects.length} registered.`);
        } else if (['ST01-002', 'ST01-004', 'ST01-009'].includes(id)) {
            console.log(`  - Vanilla unit (correct)`);
        } else {
            throw new Error(`${id} has no effects but is expected to have them.`);
        }
    });

    console.log("\nST01 Full Regression PASSED!");
}

runST01Regression().catch(err => {
    console.error(err);
    process.exit(1);
});
