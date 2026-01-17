// Simple verification script that creates GameEngine directly
// and runs some commands manually, without mocking readline

import { GameEngine } from '../logic/GameEngine';
import { CardDatabase } from '../logic/CardDatabase';
import { Card } from '../logic/types';

function createTestDeck(db: CardDatabase): Card[] {
    const ids = ['ST04-002', 'ST04-003', 'ST04-004', 'ST04-005', 'ST04-006',
        'ST04-007', 'ST04-008', 'ST04-009', 'ST04-010', 'ST04-011'];
    const deck: Card[] = [];
    for (let i = 0; i < 3; i++) {
        ids.forEach(id => {
            const card = db.getCard(id);
            if (card) deck.push(JSON.parse(JSON.stringify(card)));
        });
    }
    return deck.slice(0, 30);
}

async function runTest() {
    console.log("=== CLI Integration Test (Direct Engine) ===");

    try {
        const db = CardDatabase.getInstance();
        console.log(`✓ CardDatabase loaded: ${db.getAllCards().length} cards`);

        const leader1 = db.getCard('ST04-001');
        const leader2 = db.getCard('ST04-001');

        if (!leader1 || !leader2) {
            console.error("✗ Leader not found.");
            process.exit(1);
        }
        console.log(`✓ Leaders loaded: ${leader1.name}, ${leader2.name}`);

        const deck1 = createTestDeck(db);
        const deck2 = createTestDeck(db);
        console.log(`✓ Decks created: ${deck1.length} cards each`);

        const engine = new GameEngine('Player 1', 'Player 2', deck1, deck2, leader1, leader2);
        console.log(`✓ GameEngine initialized.`);
        console.log(`  - Turn: ${engine.state.turnCount}, Phase: ${engine.state.phase}`);
        console.log(`  - P1 Hand: ${engine.currentPlayer.hand.length} cards`);

        // Simulate a turn
        console.log("\n--- Simulating Turn ---");

        // Level Up Phase
        engine.nextPhase(); // LEVEL_UP -> DRAW
        console.log(`✓ Phase: ${engine.state.phase}`);

        // Draw Phase
        engine.nextPhase(); // DRAW -> MAIN
        console.log(`✓ Phase: ${engine.state.phase}`);

        // Main Phase: Play a unit
        if (engine.currentPlayer.hand.length > 0) {
            const card = engine.currentPlayer.hand[0];
            console.log(`  Playing unit: ${card.name}`);
            engine.playUnit(0, 0);
            console.log(`✓ Unit placed in zone 0.`);
        }

        // Attack Phase
        engine.nextPhase(); // MAIN -> ATTACK
        console.log(`✓ Phase: ${engine.state.phase}`);

        // End Phase
        engine.nextPhase(); // ATTACK -> END
        console.log(`✓ Phase: ${engine.state.phase}`);

        // End Turn
        engine.nextPhase(); // END -> LEVEL_UP (next turn)
        console.log(`✓ Turn ${engine.state.turnCount}, Phase: ${engine.state.phase}`);

        console.log("\n=== Test Passed! ===");
        process.exit(0);
    } catch (e) {
        console.error("✗ Test Failed:", e);
        process.exit(1);
    }
}

runTest();
