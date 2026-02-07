
import { GameEngine } from '../src/logic/GameEngine';
import { Card, CardType, Phase, Attribute } from '../src/logic/types';
import { DUMMY_CARDS, createDeck } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function setupGame() {
    const leader = getCard('ST02-001'); // Leader
    const deck = createDeck();
    return new GameEngine('P1', 'P2', deck, deck, leader, leader);
}

function testItemEquipment() {
    console.log("Running: ItemEquipment - Basic Equipment Logic");
    const game = setupGame();
    const p1 = game.currentPlayer;

    // Setup Phase
    game.state.phase = Phase.MAIN;
    p1.leaderLevel = 10; // Ensure enough size

    // 1. Give P1 a Unit and an Item
    const unitCard = getCard('ST02-004'); // Cost 2
    const itemCard = getCard('ST02-016'); // Cost 1, Power+2000
    
    // Ensure item type is correct
    if (itemCard.type !== CardType.ITEM) throw new Error("ST02-016 should be an ITEM");

    p1.hand = [unitCard, itemCard];

    // 2. Play Unit to Zone 0
    game.playUnit(0, 0); 
    const zone = p1.unitZones[0];
    if (!zone.unit) throw new Error("Unit failed to play");

    const initialPower = game.getUnitPower(zone, p1);

    // 3. Play Item on Zone 0 (Index 0 in hand now, since unit was removed)
    // We expect playItem(handIndex, zoneIndex)
    // @ts-ignore - playItem not implemented yet
    if (typeof game.playItem !== 'function') {
        throw new Error("playItem method missing in GameEngine");
    }
    
    // @ts-ignore
    game.playItem(0, 0);

    // 4. Verify Item is equipped
    if (zone.items.length !== 1) {
        throw new Error(`Expected 1 item in zone, found ${zone.items.length}`);
    }
    if (zone.items[0].id !== itemCard.id) {
        throw new Error("Equipped item ID mismatch");
    }

    // 5. Verify Stats Update (+2000 Power)
    const newPower = game.getUnitPower(zone, p1);
    if (newPower !== initialPower + 2000) {
        throw new Error(`Expected Power ${initialPower + 2000}, got ${newPower}`);
    }

    console.log("PASSED: ItemEquipment - Basic Equipment Logic");
}

function testItemConstraints() {
    console.log("Running: ItemEquipment - Constraints");
    const game = setupGame();
    const p1 = game.currentPlayer;
    game.state.phase = Phase.MAIN;
    p1.leaderLevel = 2; // Size = 2

    const unitCard = getCard('ST02-004'); // Cost 2
    const itemCard = getCard('ST02-016'); // Cost 1

    p1.hand = [unitCard, itemCard];
    
    // Play Unit (Cost 2). Remaining Size = 0.
    game.playUnit(0, 0);

    // Attempt to play Item (Cost 1). Should fail due to size limit.
    // @ts-ignore
    game.playItem(0, 0);

    if (p1.unitZones[0].items.length > 0) {
        throw new Error("FAIL: Item played despite exceeding size limit");
    }

    // Attempt to play Item on empty zone
    // @ts-ignore
    game.playItem(0, 1); // Zone 1 is empty
     if (p1.unitZones[1].items.length > 0) {
        throw new Error("FAIL: Item played on empty zone");
    }

    console.log("PASSED: ItemEquipment - Constraints");
}

function testItemRequirements() {
    console.log("Running: ItemEquipment - Equipment Requirements");
    const game = setupGame();
    const p1 = game.currentPlayer;
    game.state.phase = Phase.MAIN;
    p1.leaderLevel = 10;

    const helmet = getCard('ST02-017'); // Req: Cost 4+
    const lowCostUnit = getCard('ST02-002'); // Cost 1
    const highCostUnit = getCard('ST02-008'); // Cost 4

    p1.hand = [lowCostUnit, highCostUnit, helmet];

    // 1. Play Units
    game.playUnit(0, 0); // Cost 1 Unit
    game.playUnit(0, 1); // Cost 4 Unit
    
    // Hand has [Helmet] left at index 0

    // 2. Try to equip Helmet to 1-cost unit
    // @ts-ignore
    game.playItem(0, 0);
    if (p1.unitZones[0].items.length > 0) {
        throw new Error("FAIL: Helmet equipped to 1-cost unit! Should be blocked.");
    }

    // 3. Try to equip Helmet to 4-cost unit
    // @ts-ignore
    game.playItem(0, 1);
    if (p1.unitZones[1].items.length === 0) {
        throw new Error("FAIL: Helmet failed to equip to 4-cost unit!");
    }

    console.log("PASSED: ItemEquipment - Equipment Requirements");
}

try {
    testItemEquipment();
    testItemConstraints();
    testItemRequirements();
} catch (e: any) {
    console.error(e.message);
    process.exit(1);
}
