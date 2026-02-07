import { createDeck } from '../../../src/logic/CardDatabase';
import { CardType } from '../../../src/logic/types';

function runTest() {
    console.log("Running: CardDatabase - createDeck");

    const deck = createDeck();
    
    // Check deck size
    if (deck.length !== 40) {
        throw new Error(`Expected deck size 40, got ${deck.length}`);
    }

    // Check for leaders
    const leaders = deck.filter(card => card.type === CardType.LEADER);
    if (leaders.length > 0) {
        throw new Error(`Expected 0 LEADER cards, found ${leaders.length}`);
    }

    console.log("PASSED: CardDatabase - createDeck");
}

runTest();
