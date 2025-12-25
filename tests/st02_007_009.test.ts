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

async function testST02_007_Active() {
    console.log("Running: testST02_007_Active");
    const engine = setupGame();
    const player = engine.currentPlayer;
    
    // Setup field with Base and non-Base units
    const breed = getCard('ST02-007');
    const baseUnit = getCard('ST02-002'); // N102 is Base
    const nonBaseUnit = getCard('ST02-003'); // Mica is Effect
    
    player.unitZones[0].unit = breed;
    player.unitZones[1].unit = baseUnit;
    player.unitZones[2].unit = nonBaseUnit;
    
    // Add card to hand for cost
    player.hand = [getCard('ST02-002')];
    
    const initialHit0 = engine.getUnitHit(player.unitZones[0], player);
    const initialHit1 = engine.getUnitHit(player.unitZones[1], player);
    const initialHit2 = engine.getUnitHit(player.unitZones[2], player);
    
    // Process Active Effect
    engine.effectManager.processEffects(ActivationCondition.ACTIVE, {
        sourceCard: breed,
        player: player,
        opponent: engine.opponentPlayer,
        unitZone: player.unitZones[0],
        machine: engine
    });
    
    // N102 (Zone 1) should have Hit +1
    // Breed (Zone 0) also has "Base" trait
    // Mica (Zone 2) does not have "Base" trait
    
    const finalHit0 = engine.getUnitHit(player.unitZones[0], player);
    const finalHit1 = engine.getUnitHit(player.unitZones[1], player);
    const finalHit2 = engine.getUnitHit(player.unitZones[2], player);
    
    console.log(`Breed Hit: ${initialHit0} -> ${finalHit0}`);
    console.log(`N102 Hit: ${initialHit1} -> ${finalHit1}`);
    console.log(`Mica Hit: ${initialHit2} -> ${finalHit2}`);
    
    if (finalHit0 !== initialHit0) throw new Error("Breed (Effect) should NOT be buffed");
    if (finalHit1 !== initialHit1 + 1) throw new Error("N102 (Base) should be buffed");
    if (finalHit2 !== initialHit2) throw new Error("Mica (Effect) should NOT be buffed");
    if (player.hand.length !== 0) throw new Error("Cost (trash hand) should be paid");
    
    console.log("PASSED: testST02_007_Active");
}

async function testST02_009_Trigger() {
    console.log("Running: testST02_009_Trigger");
    const engine = setupGame();
    const opponent = engine.opponentPlayer; // P2 (the one taking damage)
    const attackerPlayer = engine.currentPlayer; // P1 (the damage dealer)
    
    // Setup ATTACKER field with 3-cost and 4-cost units
    const lowCostUnit = getCard('ST02-006'); // Dora is 3-cost
    const highCostUnit = getCard('ST02-008'); // Marchana is 4-cost
    attackerPlayer.unitZones[0].unit = lowCostUnit;
    attackerPlayer.unitZones[1].unit = highCostUnit;
    
    // Put Guilty on top of deck of P2
    const guilty = getCard('ST02-009');
    opponent.deck = [guilty];
    
    // Deal damage to P2 to trigger
    engine.dealDamage(opponent, 1);
    
    // Should be in SELECT_TARGET mode
    if (engine.state.interactionMode !== 'SELECT_TARGET') throw new Error("Should be selecting target");
    
    // Try to select high cost unit on P1 field
    // In UI, P1 is typically "bottom" (isOpponentZone = false) when it's P1's turn
    // But since dealDamage context might be tricky, let's check which player is which.
    // engine.selectTarget(zoneIndex, isOpponentZone)
    // isOpponentZone=true refers to engine.opponentPlayer
    // isOpponentZone=false refers to engine.currentPlayer
    
    engine.selectTarget(1, false); 
    if (attackerPlayer.unitZones[1].unit === null) throw new Error("Should not have destroyed high cost unit");
    if (engine.state.interactionMode !== 'SELECT_TARGET') throw new Error("Should still be selecting target");
    
    // Select low cost unit on P1 field
    engine.selectTarget(0, false);
    if (attackerPlayer.unitZones[0].unit !== null) throw new Error("Should have destroyed low cost unit");
    if (engine.state.interactionMode !== 'NORMAL') throw new Error("Should be back to NORMAL mode");
    
    // Guilty should be in trash
    if (!opponent.trash.some(c => c.id === 'ST02-009')) throw new Error("Guilty should be in trash");
    
    console.log("PASSED: testST02_009_Trigger");
}

async function runTests() {
    await testST02_007_Active();
    await testST02_009_Trigger();
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
