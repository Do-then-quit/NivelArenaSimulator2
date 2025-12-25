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

async function testST02_016_Item() {
    console.log("Running: testST02_016_Item");
    const engine = setupGame();
    const player = engine.currentPlayer;
    
    const unit = getCard('ST02-002'); // N102 (3500)
    player.unitZones[0].unit = unit;
    
    const item = getCard('ST02-016'); // Kevlar (+2000 Power)
    player.unitZones[0].items.push(item);
    
    const power = engine.getUnitPower(player.unitZones[0], player);
    
    // 3500 + 2000 = 5500
    if (power !== 5500) throw new Error(`Expected 5500 Power, got ${power}`);
    
    console.log("PASSED: testST02_016_Item");
}

async function testST02_017_Item() {
    console.log("Running: testST02_017_Item");
    const engine = setupGame();
    const player = engine.currentPlayer;
    
    const item = getCard('ST02-017'); // Helmet (+1 Hit if Cost >= 4)
    
    // Case 1: Low cost unit (3 cost) -> No Buff
    const lowCostUnit = getCard('ST02-006'); // Dora (3 Cost)
    player.unitZones[0].unit = lowCostUnit;
    player.unitZones[0].items = [item];
    
    let hit = engine.getUnitHit(player.unitZones[0], player);
    if (hit !== 1) throw new Error(`Expected Hit 1 (No buff), got ${hit}`);
    
    // Case 2: High cost unit (4 cost) -> Buff
    const highCostUnit = getCard('ST02-008'); // Marchana (4 Cost)
    player.unitZones[1].unit = highCostUnit;
    player.unitZones[1].items = [item];
    
    // Marchana base hit is 2. +1 = 3.
    hit = engine.getUnitHit(player.unitZones[1], player);
    if (hit !== 3) throw new Error(`Expected Hit 3 (Buffed), got ${hit}`);
    
    console.log("PASSED: testST02_017_Item");
}

async function runTests() {
    await testST02_016_Item();
    await testST02_017_Item();
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
