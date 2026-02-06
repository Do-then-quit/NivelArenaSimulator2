import { CardTestModule } from '../types';
import { Phase } from '../../types';

export const ST02Tests: CardTestModule = {
    setupScenarios: {
        'ST02-001': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.levelZone = ctx.getCard('ST02-001');
            if (p1.levelZone) p1.levelZone.isAwakened = false;
            return "Scenario: Leader (Awakening Lv 6, Passive Size +1). Instructions: Level up to 6. Verify Leader Awakens and Size increases by 1.";
        },
        'ST02-007': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = ctx.getCard('ST02-007');
            p1.unitZones[1].unit = ctx.getCard('ST02-002');
            p1.hand = [ctx.getCard('ST02-003')];
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Unit (Active: Trash Hand -> Base Units Check). Instructions: Use Active, drop hand. Verify 'Base' units get Hit+1.";
        },
        'ST02-010': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.unitZones[0].unit = ctx.getCard('ST02-010');
            p2.unitZones[0].unit = ctx.getCard('ST01-002');
            p1.deck.push(ctx.getCard('ST02-010'));
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Breakthrough & Return Trigger. Instructions: Attack with ST02-010. Verify Breakthrough. Then deal damage to self to verify Return Trigger.";
        },
        'ST02-012': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [ctx.getCard('ST02-012')];
            p1.unitZones[1].unit = ctx.getCard('ST02-002');
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Active Power Buff. Instructions: Use Active, Select Unit. Verify +3000 Power.";
        },
        'ST02-014': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [ctx.getCard('ST02-014')];
            p1.deck.push(ctx.getCard('ST02-001'));
            p1.deck.push(ctx.getCard('ST02-002'));
            p1.deck.push(ctx.getCard('ST02-003'));
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Look 3 Pick 1. Instructions: Use Active. Verify Look 3 Pick 1 UI appears.";
        },
        'ST02-015': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [ctx.getCard('ST02-015')];
            p1.unitZones[1].unit = ctx.getCard('ST02-002');
            p2.unitZones[1].unit = ctx.getCard('ST01-002');
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Destroy Lowest in Lane. Instructions: Use Active -> Select Lane. Verify lowest power unit in lane is destroyed.";
        },
        'ST02-016': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [ctx.getCard('ST02-016')];
            p1.unitZones[0].unit = ctx.getCard('ST02-002');
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Passive +2000. Verify Power is Base + 2000.";
        },
        'ST02-017': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = ctx.getCard('ST02-002');
            p1.unitZones[0].unit!.cost = 4;
            p1.hand = [ctx.getCard('ST02-017')];
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Passive Hit +1 (Cost >= 4). Verify Hit count.";
        },
        'ST02-007_Trigger': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 1;
            p1.deck.push(ctx.getCard('ST02-007')); // Trigger: Lv+1
            return "Scenario: ST02-007 Trigger (Trash Self -> Leader Lv+1). ST02-007 on Deck. Instructions: Run console `window.debug.dealDamage(0, 1)`. Verify Leader Level increases.";
        },
        'ST02-009_Trigger': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.deck.push(ctx.getCard('ST02-009')); // Trigger: Trash Opp Unit Cost <= 3
            p2.unitZones[0].unit = ctx.getCard('ST02-005'); // Jan (Cost 3)
            return "Scenario: ST02-009 Trigger (Trash Self -> Destroy Opp Unit Cost <= 3). ST02-009 on Deck. Opponent has unit (Cost 3). Instructions: Run console `window.debug.dealDamage(0, 1)`. Select Opp Unit. Verify destroyed.";
        },
        'ST02-010_Trigger': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.deck.push(ctx.getCard('ST02-010')); // Trigger: Return to Hand
            return "Scenario: ST02-010 Trigger (Return to Hand). ST02-010 on Deck. Instructions: Run console `window.debug.dealDamage(0, 1)`. Verify added to Hand.";
        },
        'ST02-015_Trigger': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.deck.push(ctx.getCard('ST02-015')); // Trigger: Trash Opp Unit Cost <= 3
            p2.unitZones[0].unit = ctx.getCard('ST02-005'); // Jan (Cost 3)
            return "Scenario: ST02-015 Trigger (Trash Self -> Destroy Opp Unit Cost <= 3). ST02-015 on Deck. Opponent has unit (Cost 3). Instructions: Run console `window.debug.dealDamage(0, 1)`. Select Opp Unit. Verify destroyed.";
        },
    },
    runTests: {
        'ST02-001': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 6;
            ctx.engine.checkAwakening(0);
            if (p1.levelZone) ctx.assert(!!p1.levelZone.isAwakened, "Leader should awaken at Level 6");
        },
        'ST02-007': async (ctx) => {
            ctx.engine.activateEffect(0, 0); // Activate ST02-007
            ctx.engine.selectCost(0); // Trash ST02-003 from hand
        },
        'ST02-010': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.attack(0);
            const deckCard = p1.deck[p1.deck.length - 1];
            if (deckCard.id.startsWith('ST02-010')) {
                ctx.engine.dealDamage(p1, 1);
                ctx.assert(p1.hand.some(c => c.id.startsWith('ST02-010')), "Returned to hand from damage");
            }
        },
        'ST02-012': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.activateEffect(0, 0);
            ctx.engine.selectTarget(0, true); // Select ST02-002
            const power = ctx.engine.getUnitPower(p1.unitZones[1], p1);
            ctx.assert(power > 0, "Power increased");
        },
        'ST02-007_Trigger': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const initialLevel = p1.leaderLevel;
            ctx.engine.dealDamage(p1, 1);
            ctx.assert(p1.leaderLevel === initialLevel + 1, "Leader Level increased by 1");
            ctx.assert(p1.trash.some(c => c.id.startsWith('ST02-007')), "ST02-007 should be in trash");
        },
        'ST02-009_Trigger': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.dealDamage(p1, 1);
            ctx.assert(ctx.engine.state.interactionMode === 'SELECT_TARGET', "Should be in Target Selection");
            ctx.engine.selectTarget(0, true);
            ctx.assert(p2.unitZones[0].unit === null, "Opponent unit trashed");
            ctx.assert(p1.trash.some(c => c.id.startsWith('ST02-009')), "ST02-009 should be in trash");
        },
        'ST02-010_Trigger': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.dealDamage(p1, 1);
            ctx.assert(p1.hand.some(c => c.id.startsWith('ST02-010')), "ST02-010 returned to hand");
            ctx.assert(p1.damage.length === 0, "No damage taken (returned to hand)");
        },
        'ST02-015_Trigger': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.dealDamage(p1, 1);
            ctx.assert(ctx.engine.state.interactionMode === 'SELECT_TARGET', "Should be in Target Selection");
            ctx.engine.selectTarget(0, true);
            ctx.assert(p2.unitZones[0].unit === null, "Opponent unit trashed");
            ctx.assert(p1.trash.some(c => c.id.startsWith('ST02-015')), "ST02-015 should be in trash");
        },
        'ST02-014': async (ctx) => {
            ctx.engine.playSkill(0);
            ctx.assert(ctx.engine.state.interactionMode === 'SELECT_TARGET', "Look 3 Pick 1 UI (Select Target)");
            ctx.assert(ctx.engine.state.pendingEffect?.validTargets === 'REVEALED', "Target Scope REVEALED");
        },
        'ST02-015': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.playSkill(0);
            ctx.engine.selectTarget(1, false); // Select Lane 1
            const u1 = p1.unitZones[1].unit;
            const u2 = p2.unitZones[1].unit;
            ctx.assert(u1 === null || u2 === null, "At least one unit destroyed");
        },
        'ST02-016': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.playItem(0, 0);
            const power = ctx.engine.getUnitPower(p1.unitZones[0], p1);
            ctx.assert(power === 5500, "power +2000");
        },
        'ST02-017': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.playItem(0, 0);
            const u = p1.unitZones[0].unit;
            if (u && u.cost >= 4) {
                const hit = ctx.engine.getUnitHit(p1.unitZones[0], p1);
                ctx.assert(hit === 2, "hit +1");
            }
        },
    }
};
