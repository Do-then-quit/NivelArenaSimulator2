
import { GameEngine } from './GameEngine';
import { CardType, Phase, ActivationCondition } from './types';
import { DUMMY_CARDS, createDeck } from './CardDatabase';

// Mock EffectManager to inspect interactions
const mockProcessEffects = (engine: GameEngine) => {
    const originalProcess = engine.effectManager.processEffects.bind(engine.effectManager);
    engine.effectManager.processEffects = (condition, context) => {
        console.log(`[Mock] processEffects called with Condition: ${condition}`);
        return originalProcess(condition, context);
    };
};

function runTest() {
    console.log("--- Test: Skill Card Refactoring ---");

    // Create Deck and Leaders
    const deck = createDeck();
    const leader = DUMMY_CARDS.find(c => c.type === CardType.LEADER)!;

    // Initialize GameEngine with 6 arguments: p1Name, p2Name, deck1, deck2, leader1, leader2
    const engine = new GameEngine('P1', 'P2', deck, deck, leader, leader);

    // Set Phase to MAIN so we can play skills
    engine.state.phase = Phase.MAIN;
    engine.state.turnPlayerIndex = 0;

    // Setup Player 0 with a Skill Card in hand
    const p0 = engine.state.players[0];
    const p1 = engine.state.players[1];

    // Set Levels for Cost
    p0.leaderLevel = 3;

    // Find ST01-014 "오직 화력!" (Buff +2000 to all my units)
    // Using a known skill ID from ST01.json/ts
    const skillCardTemplate = DUMMY_CARDS.find(c => c.id === 'ST01-014');
    if (!skillCardTemplate) {
        console.error("Critical: ST01-014 not found in database");
        return;
    }

    // Add to hand
    const skillCard = { ...skillCardTemplate, id: 'TEST_SKILL' };
    p0.hand = [skillCard];

    // Add a unit to field to be buffed
    const unitCard = { ...DUMMY_CARDS.find(c => c.type === CardType.UNIT)!, id: 'TEST_UNIT', power: 3000 };
    p0.unitZones[0].unit = unitCard;

    const initialPower = unitCard.power || 0;
    console.log(`Initial Unit Power: ${initialPower}`);

    // Spy on processEffects
    mockProcessEffects(engine);

    // Play the Skill
    console.log(`Playing Skill: ${skillCard.name}`);
    // Simulate playing card at index 0 (hand has only 1 card)
    engine.playSkill(0);

    // Verification
    // 1. Hand should be empty
    if (p0.hand.length === 0) console.log("PASS: Hand is empty");
    else console.error("FAIL: Hand is not empty");

    // 2. Skill Zone should have the card
    if (p0.skillZone.length === 1 && p0.skillZone[0].id === 'TEST_SKILL') console.log("PASS: Card in Skill Zone");
    else console.error("FAIL: Card not in Skill Zone");

    // 3. Effect should have applied (Power +2000)
    // recalculate power
    const currentPower = engine.getUnitPower(p0.unitZones[0]);
    console.log(`Current Unit Power: ${currentPower}`);

    if (currentPower === initialPower + 2000) console.log("PASS: Buff applied correctly");
    else console.error(`FAIL: Buff not applied. Expected ${initialPower + 2000}, got ${currentPower}`);

}

runTest();
