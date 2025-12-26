
import { GameEngine } from '../src/logic/GameEngine';
import { Card, Phase, ActivationCondition } from '../src/logic/types';
import { DUMMY_CARDS, createDeck } from '../src/logic/CardDatabase';

function getCard(id: string): Card {
    const card = DUMMY_CARDS.find(c => c.id === id);
    if (!card) throw new Error(`Card ${id} not found`);
    return JSON.parse(JSON.stringify(card));
}

function setupGame() {
    const leader = getCard('ST02-001');
    const deck = createDeck();
    const game = new GameEngine('P1', 'P2', deck, deck, leader, leader);
    game.state.players[0].leaderLevel = 10;
    return game;
}

function testActiveEffectCostSelection() {
    console.log("Running: ActiveEffect - ST02-007 Cost & Buff");
    const game = setupGame();
    const p1 = game.currentPlayer;
    game.state.phase = Phase.MAIN;

    // 1. Setup Field: ST02-007 and another unit with 'Base' trait
    const acceleration = getCard('ST02-007'); // ACTIVE: Trash hand -> Base units Hit+1
    const baseUnit = getCard('ST02-004');    // Trait: '베이스' (Base)
    const otherCard = getCard('ST02-002');   // To trash as cost
    
    p1.hand = [acceleration, baseUnit, otherCard];

    // Play units
    game.playUnit(0, 0); // Acceleration in Zone 0
    game.playUnit(0, 1); // Base unit in Zone 1
    
    const zone0 = p1.unitZones[0];
    const zone1 = p1.unitZones[1];
    
    if (zone0.unit?.id.split('_')[0] !== 'ST02-007') throw new Error("Acceleration not in zone 0");
    if (zone1.unit?.id.split('_')[0] !== 'ST02-004') throw new Error("Base unit not in zone 1");

    const initialHit0 = game.getUnitHit(zone0, p1);
    const initialHit1 = game.getUnitHit(zone1, p1);

    // 2. Trigger Active Effect
    const effectIndex = zone0.unit.effects!.findIndex(e => e.activation === ActivationCondition.ACTIVE);
    game.activateEffect(0, effectIndex);

    // 3. Verify interaction mode is SELECT_COST
    if (game.state.interactionMode !== 'SELECT_COST') {
        throw new Error(`Expected interactionMode SELECT_COST, got ${game.state.interactionMode}`);
    }
    if (p1.hand.length !== 1) throw new Error("Hand should have 1 card (otherCard)");

    // 4. Select Cost (trash otherCard)
    game.selectCost(0);

    // 5. Verify Cost paid
    if (p1.hand.length !== 0) throw new Error("Hand should be empty after paying cost");
    if (p1.trash.length !== 0) { // Wait, playUnit trashes existing? No. 
        // Initial setup trashed nothing. playUnit removes from hand. 
        // Current trash should have the otherCard.
    }
    const trashedCard = p1.trash.find(c => c.id.startsWith('ST02-002'));
    if (!trashedCard) throw new Error("Cost card not found in trash");

    // 6. Verify Buff applied
    const newHit0 = game.getUnitHit(zone0, p1);
    const newHit1 = game.getUnitHit(zone1, p1);

    // ST02-007 is '이펙트' (Effect), so it should NOT be buffed by its own effect targeting '베이스' (Base)
    if (newHit0 !== initialHit0) throw new Error(`Expected Hit ${initialHit0}, got ${newHit0} for ST02-007 (Effect)`);
    // ST02-004 is '베이스' (Base), so it SHOULD be buffed
    if (newHit1 !== initialHit1 + 1) throw new Error(`Expected Hit ${initialHit1 + 1}, got ${newHit1} for ST02-004 (Base)`);

    // 7. Try to activate AGAIN in the same turn
    game.activateEffect(0, effectIndex);
    
    // interactionMode should NOT change to SELECT_COST because it should be blocked
    if (game.state.interactionMode === 'SELECT_COST') {
        throw new Error("FAIL: Active effect activated twice in the same turn!");
    }

    // 8. Next turn and check reset
    game.nextPhase(); // MAIN -> ATTACK
    game.nextPhase(); // ATTACK -> END
    game.nextPhase(); // END -> LEVEL_UP (Turn 2, P2 turn)
    game.nextPhase(); // P2 LEVEL_UP -> DRAW
    game.nextPhase(); // P2 DRAW -> MAIN
    game.nextPhase(); // P2 MAIN -> ATTACK
    game.nextPhase(); // P2 ATTACK -> END
    game.nextPhase(); // P2 END -> LEVEL_UP (Turn 3, P1 turn)
    
    // P1 Turn 3
    game.nextPhase(); // LEVEL_UP -> DRAW
    game.nextPhase(); // DRAW -> MAIN
    
    // Give p1 a card for cost
    p1.hand = [getCard('ST02-002')];
    
    game.activateEffect(0, effectIndex);
    if (game.state.interactionMode !== 'SELECT_COST') {
        throw new Error("FAIL: Active effect did not reset on the next turn!");
    }

    console.log("PASSED: ActiveEffect - ST02-007 Cost & Buff");
}

try {
    testActiveEffectCostSelection();
} catch (e: any) {
    console.error(e.message);
    process.exit(1);
}
