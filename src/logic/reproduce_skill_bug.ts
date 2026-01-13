
import { GameEngine } from './GameEngine';
import { CardType, Phase } from './types';
import { DUMMY_CARDS, createDeck } from './CardDatabase';
import { RuleValidator } from './RuleValidator';

function runReproduction() {
    console.log("--- Reproduction: Playing Unit as Skill ---");

    const deck = createDeck();
    const leader = DUMMY_CARDS.find(c => c.type === CardType.LEADER)!;
    const engine = new GameEngine('P1', 'P2', deck, deck, leader, leader);

    engine.state.phase = Phase.MAIN;
    engine.state.turnPlayerIndex = 0;
    const p0 = engine.state.players[0];

    // Find a Unit card (e.g. ST01-002 "라피")
    const unitCardTemplate = DUMMY_CARDS.find(c => c.id === 'ST01-002');
    if (!unitCardTemplate) {
        console.error("Critical: ST01-002 not found in database");
        return;
    }

    // Add to hand
    p0.hand = [{ ...unitCardTemplate }];
    p0.leaderLevel = 10; // Sufficient level

    console.log(`Hand: ${p0.hand[0].name} (${p0.hand[0].type})`);

    // Try to play as skill
    console.log("Attempting to play Unit card into Skill Zone...");
    const validation = RuleValidator.canPlaySkill(engine, p0, 0);

    if (validation.valid) {
        console.error("BUG CONFIRMED: RuleValidator allowed Unit card to be played as Skill!");
        engine.playSkill(0);
        if (p0.skillZone.length === 1) {
            console.log(`Result: ${p0.skillZone[0].name} is in the Skill Zone.`);
        }
    } else {
        console.log(`PASS: RuleValidator correctly blocked playing Unit card into Skill Zone. Reason: ${validation.reason}`);
    }
}

runReproduction();
