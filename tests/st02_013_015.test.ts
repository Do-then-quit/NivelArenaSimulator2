import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Attribute, Phase, ActivationCondition } from '../src/logic/types';
import { DUMMY_CARDS } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function setupGame() {
    const leader = getCard('ST02-001');
    const deck1 = Array(10).fill(getCard('ST02-002'));
    const deck2 = Array(10).fill(getCard('ST02-002'));
    return new GameEngine('P1', 'P2', deck1, deck2, leader, leader);
}

async function testST02_013_Skill() {
    console.log("Running: testST02_013_Skill");
    const engine = setupGame();
    const player = engine.currentPlayer;
    
    engine.state.phase = Phase.MAIN;
    player.leaderLevel = 5;
    player.hand = [getCard('ST02-013')];
    
    const initialLevel = player.leaderLevel;
    
    // Play Skill
    engine.playSkill(0);
    
    if (player.leaderLevel !== initialLevel + 1) throw new Error("Level should increase");
    
    console.log("PASSED: testST02_013_Skill");
}

async function testST02_014_Skill() {
    console.log("Running: testST02_014_Skill");
    const engine = setupGame();
    const player = engine.currentPlayer;
    
    engine.state.phase = Phase.MAIN;
    player.leaderLevel = 5;
    player.hand = [getCard('ST02-014')];
    
    // Set up deck with specific cards to verify peeking
    const c1 = getCard('ST02-002'); c1.name = "Top";
    const c2 = getCard('ST02-002'); c2.name = "Middle";
    const c3 = getCard('ST02-002'); c3.name = "Bottom";
    player.deck = [c3, c2, c1]; // Deck is stack, last is top.
    
    const initialHandSize = player.hand.length; // 1 (the skill itself)
    
    engine.playSkill(0);
    
    // Hand should have +1 card (Skill removed, picked card added)
    // Initial hand was [Skill]. After play: Hand=[], SkillZone=[Skill]. Picked card added -> Hand=[Picked].
    // So size remains 1.
    
    if (player.hand.length !== 1) throw new Error(`Expected hand size 1, got ${player.hand.length}`);
    if (player.hand[0].name !== "Top") throw new Error(`Expected 'Top' card, got ${player.hand[0].name}`);
    
    // Remaining cards should be on bottom
    if (player.deck.length !== 2) throw new Error("Deck should have 2 cards left");
    if (player.deck[0].name !== "Middle" && player.deck[0].name !== "Bottom") throw new Error("Rest should be in deck");
    
    console.log("PASSED: testST02_014_Skill");
}

async function testST02_015_Skill() {
    console.log("Running: testST02_015_Skill");
    const engine = setupGame();
    const player = engine.currentPlayer;
    const opponent = engine.opponentPlayer;
    
    engine.state.phase = Phase.MAIN;
    player.leaderLevel = 5;
    
    // Setup Shared Lane (Index 0)
    // My Unit: 3000 Power
    const myUnit = getCard('ST02-002'); // N102 (3500)
    myUnit.power = 3000;
    player.unitZones[0].unit = myUnit;
    
    // Opp Unit: 4000 Power
    const oppUnit = getCard('ST02-002');
    oppUnit.power = 4000;
    opponent.unitZones[0].unit = oppUnit;
    
    const skill = getCard('ST02-015');
    player.hand = [skill];
    
    // Play Skill
    engine.playSkill(0);
    
    if (engine.state.interactionMode !== 'SELECT_TARGET') throw new Error("Should be selecting lane");
    
    // Select Lane 0 (Shared Lane)
    engine.selectTarget(0, false); // owner doesn't matter for lane selection logic usually, but let's use mine
    
    // My unit (3000) < Opp unit (4000) -> My unit should be destroyed
    if (player.unitZones[0].unit !== null) throw new Error("My unit should be destroyed");
    if (opponent.unitZones[0].unit === null) throw new Error("Opponent unit should survive");
    
    console.log("PASSED: testST02_015_Skill");
}

async function runTests() {
    await testST02_013_Skill();
    await testST02_014_Skill();
    await testST02_015_Skill();
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
