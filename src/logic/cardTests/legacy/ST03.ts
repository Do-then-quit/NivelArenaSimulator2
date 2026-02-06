import { CardTestModule } from '../types';
import { Phase } from '../../types';

export const ST03Tests: CardTestModule = {
    setupScenarios: {
        'ST03-001': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 3;
            p1.levelZone = ctx.getCard('ST03-001');
            if (p1.levelZone) p1.levelZone.isAwakened = false;
            p1.unitZones[0].unit = ctx.getCard('ST03-006'); // Has Exit
            ctx.engine.state.phase = Phase.LEVEL_UP;
            return "Scenario: Leader (Awakening Lv 4, Passive: Field 'Exit' Units +1000). Instructions: Level up to 4. Verify Leader Awakens and ST03-006 gets +1000 Power.";
        },
        'ST03-003': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.unitZones[0].unit = ctx.getCard('ST03-003');
            p2.unitZones[0].unit = ctx.getCard('ST01-002'); // Neon 3000
            p2.hand = [ctx.getCard('ST01-002'), ctx.getCard('ST01-002')];
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Unit (Exit: Opponent Discards 1). Instructions: Destroy ST03-003 (Attack with it). Verify Opponent hand size decreases by 1.";
        },
        'ST03-005': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.leaderLevel = 3;
            p1.hand = [ctx.getCard('ST03-005')];
            p2.unitZones[0].unit = ctx.getCard('ST01-002'); // Cost 1
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Unit (Entry: Destroy Encounter with Cost <= 1). Instructions: Play ST03-005 to Zone 0. Verify Opponent's Cost 1 unit is destroyed.";
        },
        'ST03-006': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.unitZones[0].unit = ctx.getCard('ST03-006');
            p2.unitZones[0].unit = ctx.getCard('ST01-009'); // Emma (7000 Power)
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Unit (Exit: Draw 1). Instructions: Destroy ST03-006. Verify Player draws 1 card.";
        },
        'ST03-007': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p2.unitZones[0].unit = ctx.getCard('ST03-007'); // Cost 3, Power 4000
            const strongerUnit = ctx.getCard('ST01-002');
            strongerUnit.power = 4000;
            strongerUnit.cost = 1; // Must be <= ST03-007 Cost (3)
            p1.unitZones[0].unit = strongerUnit;
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Unit (Exit: Mutual Destruction). Instructions: Attack with ST03-007 (Lower Power) into Opponent. Verify Opponent is also destroyed (if Cost condition met).";
        },
        'ST03-008': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.unitZones[0].unit = ctx.getCard('ST03-008'); // Passive source
            p1.unitZones[1].unit = ctx.getCard('ST03-006'); // Has Exit
            p1.unitZones[2].unit = ctx.getCard('ST01-002'); // No Exit
            return "Scenario: Unit (Passive: Field 'Exit' Units +1000). Verify ST03-006 gets +1000 Power.";
        },
        'ST03-010': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.unitZones[0].unit = ctx.getCard('ST03-010');
            p1.trash = [ctx.getCard('ST03-003')]; // Exit, Cost 2
            p2.unitZones[0].unit = ctx.getCard('ST01-009'); // Emma (Strong)
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Unit (Exit: Retrieve 'Exit' Unit Cost <= 2). Instructions: Destroy ST03-010. Select ST03-003 in Trash. Verify it returns to hand.";
        },
        'ST03-011': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.leaderLevel = 7;
            p1.hand = [ctx.getCard('ST03-011'), ctx.getCard('ST01-002'), ctx.getCard('ST01-002')]; // Hand size 3
            p2.unitZones[0].unit = ctx.getCard('ST01-009'); // Target
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Unit (Entry: Optional Discard All -> Destroy Encounter). Instructions: Play ST03-011. Accept Optional Discard. Verify Encounter unit destroyed.";
        },
        'ST03-012': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.hand = [ctx.getCard('ST03-012'), ctx.getCard('ST01-002')];
            p2.hand = [ctx.getCard('ST01-002')];
            p1.leaderLevel = 5; // Ensure can play
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Skill (Active: Discard 1 -> Opp Discard 1). Instructions: Use Active. Verify both players discard 1.";
        },
        'ST03-013': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.hand = [ctx.getCard('ST03-013'), ctx.getCard('ST01-002')]; // Unit in hand (Cost 1)
            p1.hand[1].cost = 2; // Hack cost
            p2.unitZones[0].unit = ctx.getCard('ST01-002'); // Cost 1
            p2.unitZones[0].unit!.cost = 1;
            p1.leaderLevel = 5;
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Skill (Active: Trash Hand Unit -> Destroy Field Unit with Lower Cost). Instructions: Use Active. Pay Cost. Select Opponent Unit. Verify Destroyed.";
        },
        'ST03-014': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.hand = [ctx.getCard('ST03-014')];
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            p1.leaderLevel = 5;
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Skill (Active: Destroy My Unit -> Draw 2). Instructions: Use Active. Select My Unit. Verify Draw 2.";
        },
        'ST03-015': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.hand = [ctx.getCard('ST03-015')];
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            p2.unitZones[0].unit = ctx.getCard('ST01-002');
            p1.leaderLevel = 5;
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Skill (Active: Destroy My Unit & Encounter). Instructions: Use Active. Select My Unit. Verify both units destroyed.";
        },
        'ST03-016': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.hand = [ctx.getCard('ST03-016')];
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            p2.unitZones[0].unit = ctx.getCard('ST01-011');
            p1.leaderLevel = 5;
            ctx.engine.state.phase = Phase.MAIN;
            ctx.engine.playItem(0, 0);
            ctx.engine.state.phase = Phase.ATTACK;
            (ctx.engine as any).endTurn(); // Pass turn to Opponent to Attack
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Item (Passive +3000, Defender: Terminate). Instructions: Equip. Attack with Opponent. Block with Equipped Unit. Verify Battle Termination.";
        },
        'ST03-017': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.hand = [ctx.getCard('ST03-017')];
            p1.unitZones[0].unit = ctx.getCard('ST01-002'); // Cost 1
            p2.unitZones[0].unit = ctx.getCard('ST01-002'); // Cost 1
            p1.leaderLevel = 5;
            ctx.engine.state.phase = Phase.MAIN;
            ctx.engine.playItem(0, 0);
            (ctx.engine as any).endTurn(); // Pass turn to Opponent to Attack
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Item (Exit: Mutual Destruction). Instructions: Equip. Destroy Equipped Unit. Verify Opponent destroyed.";
        },
        'ST03-003_Trigger': (ctx) => {
            const p1 = ctx.engine.currentPlayer; // My Turn
            const p2 = ctx.engine.opponentPlayer;
            p2.deck.push(ctx.getCard('ST03-003')); // On top
            p1.hand = [ctx.getCard('ST01-002'), ctx.getCard('ST01-002'), ctx.getCard('ST01-002')]; // 3 cards
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Trigger (Trash Self & Opp Discard). Instructions: Damage. Verify Trigger.";
        },
        'ST03-010_Trigger': (ctx) => {
            const p1 = ctx.engine.currentPlayer; // My Turn
            const p2 = ctx.engine.opponentPlayer;
            p2.deck.push(ctx.getCard('ST03-010')); // On top
            p1.hand = [ctx.getCard('ST01-002'), ctx.getCard('ST01-002'), ctx.getCard('ST01-002')]; // 3 cards
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Trigger (Trash Self & Opp Discard). Instructions: Damage. Verify Trigger.";
        },
        'ST03-011_Trigger': (ctx) => {
            const p1 = ctx.engine.currentPlayer; // My Turn
            const p2 = ctx.engine.opponentPlayer;
            p2.deck.push(ctx.getCard('ST03-011')); // On top
            p1.hand = [ctx.getCard('ST01-002'), ctx.getCard('ST01-002'), ctx.getCard('ST01-002')]; // 3 cards
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Trigger (Return to Hand). Instructions: Damage. Verify Return to Hand.";
        },
        'ST03-015_Trigger': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.deck.push(ctx.getCard('ST03-015'));
            p1.trash = [ctx.getCard('ST03-006')]; // Exit unit
            return "Scenario: Trigger (Trash Self & Retrieve 'Exit' Unit). Instructions: Damage. Verify Retrieval.";
        },
    },
    runTests: {
        'ST03-001': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.nextPhase();
            ctx.engine.checkAwakening(0);
            if (p1.levelZone) ctx.assert(!!p1.levelZone.isAwakened, "Leader should awaken at Level 4");
            const power = ctx.engine.getUnitPower(p1.unitZones[0], p1);
            ctx.assert(power === 3500, "Passive +1000 to Exit unit (2500 -> 3500)");
        },
        'ST03-003': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            const initialHandSize = p2.hand.length;
            ctx.assert(initialHandSize === 2, "Opponent should have 2 cards in hand");
            ctx.engine.destroyUnit(p1, p1.unitZones[0], p2.unitZones[0].unit || undefined);
            ctx.assert(ctx.engine.state.interactionMode === 'SELECT_TARGET', "Should Select Target Mode");
            ctx.engine.selectHandTarget(0, true);
            ctx.assert(p2.hand.length === initialHandSize - 1, "Opponent Should Discard 1 card");
        },
        'ST03-005': async (ctx) => {
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.playUnit(0, 0);
            ctx.assert(p2.unitZones[0].unit === null, "Opponent unit destroyed");
        },
        'ST03-006': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const initialHand = p1.hand.length;
            ctx.engine.destroyUnit(p1, p1.unitZones[0], undefined);
            ctx.assert(p1.hand.length === initialHand + 1, "Drew 1 card on Exit");
        },
        'ST03-007': async (ctx) => {
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.attack(0);
            ctx.engine.resolveBlock(true);
            ctx.assert(p2.unitZones[0].unit === null, "Opponent unit mutually destroyed");
        },
        'ST03-008': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const uExit = ctx.engine.getUnitPower(p1.unitZones[1], p1);
            const uNoExit = ctx.engine.getUnitPower(p1.unitZones[2], p1);
            ctx.assert(uExit === 3500, "Exit unit +1000 (2500 -> 3500)");
            ctx.assert(uNoExit === 3000, "No Exit unit +0");
        },
        'ST03-010': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.attack(0);
            ctx.engine.resolveBlock(true);
            ctx.assert(ctx.engine.state.interactionMode === 'SELECT_TARGET' || !!ctx.engine.state.pendingEffect, "Triggered Trash Selection");
            ctx.engine.selectTrashTarget(0);
            ctx.assert(p1.hand.some(c => c.id.startsWith('ST03-003')), "Retrieved card");
        },
        'ST03-011': async (ctx) => {
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.playUnit(0, 0);
            try { ctx.engine.resolveOptionalEffect(true); } catch { }
            ctx.assert(p2.unitZones[0].unit === null, "Opponent unit destroyed after discard");
        },
        'ST03-012': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.playSkill(0);
            ctx.assert(ctx.engine.state.interactionMode === 'SELECT_TARGET', "Should Select Target Mode p1");
            ctx.engine.selectHandTarget(0, false);
            ctx.assert(ctx.engine.state.interactionMode === 'SELECT_TARGET', "Should Select Target Mode p2");
            ctx.engine.selectHandTarget(0, true);
            ctx.assert(p1.hand.length === 0, "P1 Discarded");
            ctx.assert(p2.hand.length === 0, "P2 Discarded");
        },
        'ST03-013': async (ctx) => {
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.playSkill(0);
            ctx.engine.selectCost(0);
            ctx.engine.selectTarget(0, true);
            ctx.assert(p2.unitZones[0].unit === null, "Destroyed");
        },
        'ST03-014': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.playSkill(0);
            ctx.engine.selectTarget(0, false);
            ctx.assert(p1.unitZones[0].unit === null, "Unit Destroyed");
            ctx.assert(p1.hand.length === 2, "Drew 2");
        },
        'ST03-015': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.playSkill(0);
            ctx.engine.selectTarget(0, false);
            ctx.assert(p1.unitZones[0].unit === null && p2.unitZones[0].unit === null, "Both Destroyed");
        },
        'ST03-016': async (ctx) => {
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.attack(0);
            ctx.engine.resolveBlock(true);
            ctx.assert(p2.unitZones[0].unit === null, "Destroyed");
            ctx.assert(p2.damage.length === 0, "No Damage");
        },
        'ST03-017': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.attack(0);
            ctx.engine.resolveBlock(true);
            ctx.assert(p1.unitZones[0].unit === null, "Destroyed");
            ctx.assert(p2.unitZones[0].unit === null, "Destroyed");
        },
        'ST03-003_Trigger': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.attack(0);
            ctx.assert(ctx.engine.state.interactionMode === "SELECT_TARGET", "Select Target");
            ctx.engine.selectHandTarget(0, false);
            ctx.assert(p1.hand.length === 2, "Discarded 1");
        },
        'ST03-010_Trigger': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.attack(0);
            ctx.assert(ctx.engine.state.interactionMode === "SELECT_TARGET", "Select Target");
            ctx.engine.selectHandTarget(0, false);
            ctx.assert(p1.hand.length === 2, "Discarded 1");
        },
        'ST03-011_Trigger': async (ctx) => {
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.dealDamage(p2, 1);
            ctx.assert(p2.hand.some(c => c.id.startsWith('ST03-011')), "Returned to hand");
        },
        'ST03-015_Trigger': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.dealDamage(p1, 1);
            ctx.engine.selectTrashTarget(0);
            ctx.assert(p1.hand.some(c => c.id.startsWith('ST03-006')), "Retrieved Exit unit");
            ctx.assert(p1.trash.some(c => c.id.startsWith('ST03-015')), "Trashed self");
        },
    }
};
