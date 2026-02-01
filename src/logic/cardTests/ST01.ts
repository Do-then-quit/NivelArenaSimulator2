import { CardTestModule } from './types';
import { Phase } from '../types';

export const ST01Tests: CardTestModule = {
    setupScenarios: {
        'ST01-001': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 4;
            p1.levelZone = ctx.getCard('ST01-001');
            if (p1.levelZone) p1.levelZone.isAwakened = false;
            p1.unitZones[0].unit = ctx.getCard('ST01-002'); // Neon 3000
            return "Scenario: Leader Rapi (Level 4). Instructions: Click 'Next Phase' to Level Up. Verify Leader Awakens and Neon (Unit) gets +1000 Power.";
        },
        'ST01-003': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.unitZones[0].unit = ctx.getCard('ST01-003'); // Besti
            p2.unitZones[0].unit = ctx.getCard('ST01-002'); // Neon
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Besti (Attacker) vs Neon. Instructions: Click Besti -> Attack -> Select Neon. Verify Besti gets +1000 Power during attack.";
        },
        'ST01-005': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.unitZones[0].unit = ctx.getCard('ST01-005'); // Noise
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Noise (Attacker +2000). Instructions: Attack with Noise. Verify Power +2000.";
        },
        'ST01-006': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [ctx.getCard('ST01-006')]; // Noir
            p2.unitZones[0].unit = ctx.getCard('ST01-002'); // Neon
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Noir (Entry: Encounter -3000). Instructions: Drag Noir from Hand to Zone 0. Verify Opponent Neon (3000 Power) is destroyed.";
        },
        'ST01-007': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.unitZones[0].unit = ctx.getCard('ST01-007'); // Viper
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Viper (Attacker +1000). Instructions: Attack with Viper. Verify Power +1000.";
        },
        'ST01-008': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.unitZones[0].unit = ctx.getCard('ST01-008'); // Blanc
            p1.unitZones[1].unit = ctx.getCard('ST01-003'); // Besti (Attacker)
            p1.unitZones[2].unit = ctx.getCard('ST01-002'); // Neon (No Attacker)
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Blanc (Passive: Attacker +1000). Instructions: Besti (Attacker) and Neon (No Attacker) are on field. Verify Besti has +1000 Power.";
        },
        'ST01-010': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.unitZones[0].unit = ctx.getCard('ST01-010'); // Anis
            p1.hand = [ctx.getCard('ST01-002')]; // Cost
            p2.unitZones[0].unit = ctx.getCard('ST01-009'); // Emma
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Anis (Active: Shuffle Hand -> Encounter -3000). Instructions: Click Anis -> Active -> Select Card in Hand. Verify Opponent Emma loses 3000 Power.";
        },
        'ST01-011': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p2.deck.push(ctx.getCard('ST01-002'));
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = ctx.getCard('ST01-011'); // Rapi Unit
            p2.unitZones[0].unit = ctx.getCard('ST01-002'); // Neon
            ctx.engine.state.phase = Phase.ATTACK;
            return "Scenario: Rapi Unit (Attacker: Penetration). Instructions: Attack with Rapi. Verify Penetration effect triggers (check logs or visuals).";
        },
        'ST01-012': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.hand = [ctx.getCard('ST01-012')]; // Insight
            p2.unitZones[0].unit = ctx.getCard('ST01-002'); // Neon
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Weakness Insight (Skill). Instructions: Play Skill from Hand -> Select Opponent Neon. Verify Neon Power becomes 1000 (-2000).";
        },
        'ST01-013': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [ctx.getCard('ST01-013')]; // Reinforcement
            p1.trash = [ctx.getCard('ST01-002')]; // Neon (Cost 1)
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Reinforcement (Skill). Instructions: Play Skill -> Select Trash card (Cost 1). Verify card returns to hand.";
        },
        'ST01-014': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [ctx.getCard('ST01-014')]; // Firepower
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            p1.unitZones[1].unit = ctx.getCard('ST01-002');
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Firepower Only! (Skill). Instructions: Play Skill. Verify all your units get +2000 Power.";
        },
        'ST01-015': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 5;
            const p2 = ctx.engine.opponentPlayer;
            p1.hand = [ctx.getCard('ST01-015')]; // Missile
            p2.unitZones[0].unit = ctx.getCard('ST01-009'); // Emma
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Missile (Skill). Instructions: Play Skill -> Select Opponent Emma. Verify Emma Power -5000.";
        },
        'ST01-016': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [ctx.getCard('ST01-016')]; // Boots
            p1.unitZones[0].unit = ctx.getCard('ST01-002'); // Neon
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Boots (Item). Instructions: Drag Boots to Neon. Attack with Neon. Verify Power +2000.";
        },
        'ST01-017': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p2.unitZones[0].unit = ctx.getCard('ST01-002'); // Neon
            p1.leaderLevel = 5;
            p1.hand = [ctx.getCard('ST01-017')]; // Glove
            p1.unitZones[0].unit = ctx.getCard('ST01-002'); // Neon
            ctx.engine.state.phase = Phase.MAIN;
            return "Scenario: Glove (Item). Instructions: Drag Glove to Neon. Attack with Neon. Verify Plunder effect.";
        },
        // Trigger Scenarios
        'ST01-010_Trigger': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.deck.push(ctx.getCard('ST01-010')); // Anis on top
            p2.unitZones[0].unit = ctx.getCard('ST01-009'); // Emma (7000)
            return "Scenario: Anis Trigger (Trash Self -> Opp Unit -5000). Anis is on top of Deck. Opponent has Emma (7000). Instructions: Run console `window.debug.dealDamage(0, 1)`. Verify Emma power becomes 2000.";
        },
        'ST01-011_Trigger': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.deck.push(ctx.getCard('ST01-011')); // Rapi on top
            return "Scenario: Rapi Trigger (Return to Hand). Rapi is on top of Deck. Instructions: Run console `window.debug.dealDamage(0, 1)`. Verify Rapi added to Hand.";
        },
        'ST01-013_Trigger': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.deck.push(ctx.getCard('ST01-013')); // Reinforcement on top
            p1.trash = [ctx.getCard('ST01-002')]; // Neon in trash
            return "Scenario: Reinforcement Trigger (Trash Self -> Recover Cost 2 Unit). Reinforcement on Deck. Neon (Cost 1) in Trash. Instructions: Run console `window.debug.dealDamage(0, 1)`. Select Neon. Verify Neon in Hand.";
        },
        'ST01-015_Trigger': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.deck.push(ctx.getCard('ST01-015')); // Missile on top
            p2.unitZones[0].unit = ctx.getCard('ST01-009'); // Emma (7000)
            return "Scenario: Missile Trigger (Trash Self -> Opp Unit -5000). Missile on Deck. Opponent has Emma (7000). Instructions: Run console `window.debug.dealDamage(0, 1)`. Select Emma. Verify Emma power becomes 2000.";
        },
    },
    runTests: {
        'ST01-001': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[0], p1) === 3000, "Base power is 3000");
            p1.leaderLevel = 5;
            ctx.engine.checkAwakening(0);
            ctx.assert(!!p1.levelZone?.isAwakened, "Leader should awaken at Level 5");
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[0], p1) === 4000, "Passive should add +1000 Power");
        },
        'ST01-003': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.attack(0);
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[0], p1) === 3500, "Attacker +1000");
        },
        'ST01-005': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.attack(0);
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[0], p1) === 5000, "Attacker +2000");
        },
        'ST01-006': async (ctx) => {
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.playUnit(0, 0);
            ctx.assert(ctx.engine.getUnitPower(p2.unitZones[0], p2) === 0, "Opponent Unit Power 0");
            ctx.assert(p2.unitZones[0].unit === null, "Opponent unit trashed");
        },
        'ST01-007': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.attack(0);
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[0], p1) === 5500, "Attacker +1000");
        },
        'ST01-008': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.attack(1);
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[1], p1) === 4500, "Besti +1000, Buff +1000");
            ctx.engine.attack(2);
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[2], p1) === 3000, "Neon +0");
            ctx.engine.attack(0);
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[0], p1) === 5500, "Blanc + 0");
        },
        'ST01-010': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.activateEffect(0, 0);
            ctx.engine.selectCost(0);
            ctx.assert(ctx.engine.getUnitPower(p2.unitZones[0], p2) === 4000, "Opponent unit -3000");
            ctx.assert(p1.hand.length === 0, "Hand cost paid");
        },
        'ST01-011': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.attack(0);
            const buffs = p1.unitZones[0].buffs;
            const pen = buffs.find(b => b.type === 'PENETRATION');
            ctx.assert(!!pen && pen.value === 1, "Penetration buff applied with value 1");
            ctx.engine.resolveBlock(true);
            const rapiPower = ctx.engine.getUnitPower(p1.unitZones[0], p1);
            const neonPower = ctx.engine.getUnitPower(p2.unitZones[0], p2);
            ctx.log(`Combat: Rapi (${rapiPower}) vs Neon (${neonPower})`);
            if (rapiPower >= neonPower) {
                ctx.assert(p2.damage.length === 1, `Opponent should take 1 Penetration damage. Got ${p2.damage.length}`);
            }
        },
        'ST01-012': async (ctx) => {
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.playSkill(0);
            ctx.engine.selectTarget(0, true);
            ctx.assert(ctx.engine.getUnitPower(p2.unitZones[0], p2) === 1000, "Opponent unit -2000");
        },
        'ST01-013': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const trashId = p1.trash[0].id;
            ctx.engine.playSkill(0);
            ctx.engine.selectTrashTarget(0);
            ctx.assert(p1.hand.some(c => c.id === trashId), "Card retrieved from trash");
        },
        'ST01-014': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.playSkill(0);
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[0], p1) === 5000, "Unit +2000");
        },
        'ST01-015': async (ctx) => {
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.playSkill(0);
            ctx.engine.selectTarget(0, true);
            ctx.assert(ctx.engine.getUnitPower(p2.unitZones[0], p2) === 2000, "Opp unit -5000");
        },
        'ST01-016': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.playItem(0, 0);
            ctx.engine.state.phase = Phase.ATTACK;
            ctx.engine.attack(0);
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[0], p1) === 5000, "Boots +2000");
        },
        'ST01-017': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.playItem(0, 0);
            ctx.engine.state.phase = Phase.ATTACK;
            ctx.engine.attack(0);
            const buffs = p1.unitZones[0].buffs;
            ctx.assert(buffs.some(b => b.type === 'PLUNDER'), "Plunder applied");
        },
        'ST01-010_Trigger': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.dealDamage(p1, 1);
            ctx.assert(ctx.engine.state.interactionMode === 'SELECT_TARGET', "Should be in Target Selection");
            ctx.engine.selectTarget(0, true);
            ctx.assert(ctx.engine.getUnitPower(p2.unitZones[0], p2) === 2000, "Emma Power -5000 (7000->2000)");
            ctx.assert(p1.trash.some(c => c.id.startsWith('ST01-010')), "Anis should be in trash");
        },
        'ST01-011_Trigger': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.dealDamage(p1, 1);
            ctx.assert(p1.hand.some(c => c.id.startsWith('ST01-011')), "Rapi should be in Hand");
            ctx.assert(p1.damage.length === 0, "Damage zone empty");
        },
        'ST01-013_Trigger': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.dealDamage(p1, 1);
            ctx.assert(ctx.engine.state.interactionMode === 'SELECT_TARGET', "Should be in Target Selection");
            ctx.engine.selectTrashTarget(0);
            ctx.assert(p1.hand.some(c => c.id.startsWith('ST01-002')), "Neon retrieved from trash");
            ctx.assert(p1.trash.some(c => c.id.startsWith('ST01-013')), "Reinforcement should be in trash");
        },
        'ST01-015_Trigger': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.dealDamage(p1, 1);
            ctx.assert(ctx.engine.state.interactionMode === 'SELECT_TARGET', "Should be in Target Selection");
            ctx.engine.selectTarget(0, true);
            ctx.assert(ctx.engine.getUnitPower(p2.unitZones[0], p2) === 2000, "Emma Power -5000 (7000->2000)");
            ctx.assert(p1.trash.some(c => c.id.startsWith('ST01-015')), "Missile should be in trash");
        },
    }
};
