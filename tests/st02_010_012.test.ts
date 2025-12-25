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

async function testST02_010_Breakthrough() {
    console.log("Running: testST02_010_Breakthrough");
    const engine = setupGame();
    
    // Setup attacker: Snow White (Breakthrough 2-cost)
    const snowWhite = getCard('ST02-010');
    engine.currentPlayer.unitZones[0].unit = snowWhite;
    
    // Setup blocker: Yulia (2-cost) - Should NOT be able to block
    const yulia = getCard('ST02-004'); 
    engine.opponentPlayer.unitZones[0].unit = yulia;
    
    // Attack
    engine.state.phase = Phase.ATTACK;
    engine.attack(0);
    
    if (engine.state.phase !== Phase.BLOCK) throw new Error("Should enter BLOCK phase");
    
    // Try to block
    engine.resolveBlock(true);
    
    // Verify block failed
    // If block failed, direct damage should occur
    // If block succeeded, combat would happen. Snow White (6500) vs Yulia (4500) -> Yulia destroyed.
    // But if breakthrough works, Yulia remains (as she couldn't block), and opponent takes damage.
    
    if (engine.opponentPlayer.unitZones[0].unit === null) throw new Error("Yulia should not be destroyed (Block prevented)");
    if (engine.opponentPlayer.damage.length !== 2) throw new Error(`Opponent should take 2 damage (Hit 2), got ${engine.opponentPlayer.damage.length}`);
    
    console.log("PASSED: testST02_010_Breakthrough");
}

async function testST02_011_Passive() {
    console.log("Running: testST02_011_Passive");
    const engine = setupGame();
    const player = engine.currentPlayer;
    
    const diesel = getCard('ST02-011');
    player.unitZones[0].unit = diesel;
    
    // Level 1: 3000 + (1 * 1000) = 4000
    let power = engine.getUnitPower(player.unitZones[0], player);
    if (power !== 4000) throw new Error(`Expected 4000, got ${power}`);
    
    // Level 5: 3000 + (5 * 1000) = 8000
    player.leaderLevel = 5;
    power = engine.getUnitPower(player.unitZones[0], player);
    if (power !== 8000) throw new Error(`Expected 8000, got ${power}`);
    
    console.log("PASSED: testST02_011_Passive");
}

async function testST02_012_Skill() {
    console.log("Running: testST02_012_Skill");
    const engine = setupGame();
    const player = engine.currentPlayer;
    
    player.leaderLevel = 5; // Increase size
    
    const unit = getCard('ST02-002');
    player.unitZones[0].unit = unit;
    const initialPower = engine.getUnitPower(player.unitZones[0], player);
    
    const skill = getCard('ST02-012');
    player.hand = [skill];
    
    // Play Skill
    engine.state.phase = Phase.MAIN;
    
    // Mock user selection for skill target
    // We need to intercept the selection mode?
    // Engine.playSkill triggers processEffects.
    // ST02-012 has targets: MY_FIELD, MANUAL.
    // So playSkill will put engine into SELECT_TARGET mode.
    
    engine.playSkill(0);
    
    if (engine.state.interactionMode !== 'SELECT_TARGET') throw new Error("Should be in SELECT_TARGET mode");
    
    // Select unit
    engine.selectTarget(0, false); // false = my field
    
    const finalPower = engine.getUnitPower(player.unitZones[0], player);
    if (finalPower !== initialPower + 3000) throw new Error(`Expected +3000 power, got ${finalPower - initialPower}`);
    
    console.log("PASSED: testST02_012_Skill");
}

async function runTests() {
    await testST02_010_Breakthrough();
    await testST02_011_Passive();
    await testST02_012_Skill();
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
