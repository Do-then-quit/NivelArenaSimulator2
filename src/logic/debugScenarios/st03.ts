import { Phase } from '../types';

export function registerST03DebugScenarios(manager: any) {
    (manager as any).setupST03_001_Scenario = function() {
        console.log("Setting up ST03-001 (Modernia Leader) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        this.setLeader(0, "ST03-001");

        // Setup a unit with Exit keyword to test passive
        const exitUnit = this.getCard("ST03-003"); // Privaty (Exit)
        if (exitUnit) p0.unitZones[0].unit = exitUnit;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Player 0 Leader Level 3.");
        console.log("2. Privaty (Exit unit) on field. Power should be base (500).");
        console.log("3. Increase Leader Level to 4 (window.debug.setLeaderLevel(0, 4)).");
        console.log("4. Confirm Leader Awaken and Privaty Power becomes 1500.");
    };

    (manager as any).setupST03_002_Scenario = function() {
        console.log("Setting up ST03-002 (Delta) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST03-001");
        const card = this.getCard("ST03-002");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Delta (Vanilla Unit) in hand.");
        console.log("2. Drag Delta to a Unit Zone.");
    };

    (manager as any).setupST03_003_Scenario = function() {
        console.log("Setting up ST03-003 (Privaty) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.hand = []; // Reset Opp hand
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST03-001");

        const privaty = this.getCard("ST03-003");
        if (privaty) p0.unitZones[0].unit = privaty;

        // Give opponent some cards to discard
        const oppCard = this.getCard("ST03-002");
        if (oppCard) p1.hand.push(oppCard);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Privaty on field. Opponent has 1 card in hand.");
        console.log("2. Trash Privaty (overwrite or battle).");
        console.log("3. Confirm Opponent is prompted to discard a card.");
    };

    (manager as any).setupST03_003_Trigger_Scenario = function() {
        console.log("Setting up ST03-003 (Privaty) Trigger Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.deck = [];
        p0.hand = [];

        // P0 (Opponent from Trigger perspective) needs 3 cards in hand
        const c1 = this.getCard("ST03-002");
        const c2 = this.getCard("ST03-002");
        const c3 = this.getCard("ST03-002");
        if (c1) p0.hand.push(c1);
        if (c2) p0.hand.push(c2);
        if (c3) p0.hand.push(c3);

        const triggerCard = this.getCard("ST03-003");
        if (triggerCard) p1.deck.push(triggerCard);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #0984e3; color: white');
        console.log("1. Player 0 (Opponent) has 3 cards in hand.");
        console.log("2. Player 1 has Privaty on top of deck.");
        console.log("3. Run %cwindow.debug.dealDamage(1, 1)%c.", 'color: #e17055; font-weight: bold', 'color: inherit');
        console.log("4. Confirm Trigger activates (Privaty trashed) AND Player 0 must discard 1.");
    };

    (manager as any).setupST03_004_Scenario = function() {
        console.log("Setting up ST03-004 (Uni) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST03-001");
        const card = this.getCard("ST03-004");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Uni (Vanilla Unit) in hand.");
        console.log("2. Drag Uni to a Unit Zone.");
    };

    (manager as any).setupST03_005_Scenario = function() {
        console.log("Setting up ST03-005 (Novel) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST03-001");

        const novel = this.getCard("ST03-005");
        if (novel) p0.hand.push(novel);

        const target = this.getCard("ST03-002"); // Delta (Cost 1)
        if (target) p1.unitZones[0].unit = target;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Novel in hand. Opponent has Delta (Cost 1) in Lane 0.");
        console.log("2. Play Novel to Lane 0.");
        console.log("3. Confirm Delta is Destroyed.");
    };

    (manager as any).setupST03_006_Scenario = function() {
        console.log("Setting up ST03-006 (Sakura) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST03-001");

        const sakura = this.getCard("ST03-006");
        if (sakura) p0.unitZones[0].unit = sakura;

        // Ensure deck has cards
        if (p0.deck.length === 0) p0.deck.push(this.getCard("ST03-002")!);

        const initialHandInfo = p0.hand.length;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log(`1. Sakura on field. Hand size ${initialHandInfo}.`);
        console.log("2. Trash Sakura (overwrite or battle).");
        console.log("3. Confirm you Draw 1 card.");
    };

    (manager as any).setupST03_007_Scenario = function() {
        console.log("Setting up ST03-007 (D) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        this.setLeader(0, "ST03-001");
        this.setLeader(1, "ST03-001"); // Opponent leader

        const d = this.getCard("ST03-007"); // Cost 3, Power 4000
        if (d) p0.unitZones[0].unit = d;

        // Opponent unit that can kill D but has <= Cost 3
        const killer = this.getCard("ST03-007"); // D itself is Cost 3, Power 4000. Mutual kill.
        if (killer) p1.unitZones[0].unit = killer;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. D (Cost 3, 4000) on field Lane 0.");
        console.log("2. Opponent has D (Cost 3, 4000) in Lane 0.");
        console.log("3. Advance to Attack phase and Attack Opponent with D.");
        console.log("4. Both die. Confirm Opponent's unit is ALSO trashed by D's Exit effect (Cost 3 <= 3).");
    };

    (manager as any).setupST03_008_Scenario = function() {
        console.log("Setting up ST03-008 (Exia) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        this.setLeader(0, "ST03-001");

        const exia = this.getCard("ST03-008");
        const exitUnit = this.getCard("ST03-003"); // Privaty (Exit)

        if (exia) p0.hand.push(exia);
        if (exitUnit) p0.unitZones[0].unit = exitUnit;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Exia in hand. Privaty (Exit unit) on field (Power 500).");
        console.log("2. Play Exia.");
        console.log("3. Confirm Privaty Power increases to 1500.");
    };

    (manager as any).setupST03_009_Scenario = function() {
        console.log("Setting up ST03-009 (Maiden) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 5;
        this.setLeader(0, "ST03-001");
        const card = this.getCard("ST03-009");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Maiden (Vanilla Unit) in hand.");
        console.log("2. Drag Maiden to a Unit Zone.");
    };

    (manager as any).setupST03_010_Scenario = function() {
        console.log("Setting up ST03-010 (Rosanna) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.trash = []; p0.leaderLevel = 6; p1.leaderLevel = 10;
        this.setLeader(0, "ST03-001");

        const rosanna = this.getCard("ST03-010");
        if (rosanna) p0.unitZones[0].unit = rosanna;

        // Trash setup
        const validTarget = this.getCard("ST03-003"); // Privaty (Exit, Cost 1) -> Valid
        const invalidNoExit = this.getCard("ST03-002"); // Delta (No Exit, Cost 1) -> Invalid
        const invalidCost = this.getCard("ST03-007"); // D (Exit, Cost 3) -> Invalid (Cost > 2)

        const enemyUnit = this.getCard("ST02-009"); // 길티 (Big Unit)
        if (enemyUnit) p1.unitZones[0].unit = enemyUnit;

        if (validTarget) p0.trash.push(validTarget);
        if (invalidNoExit) p0.trash.push(invalidNoExit);
        if (invalidCost) p0.trash.push(invalidCost);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Rosanna on field.");
        console.log("2. Trash contains: Privaty (Valid), Delta (No Exit), D (Cost 3).");
        console.log("3. Trash Rosanna.");
        console.log("4. Confirm you can ONLY select Privaty to return to hand.");
    };

    (manager as any).setupST03_010_Trigger_Scenario = function() {
        console.log("Setting up ST03-010 (Rosanna) Trigger Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.deck = [];
        p0.hand = [];

        // P0 (Opponent from Trigger perspective) needs 3 cards in hand
        const c1 = this.getCard("ST03-002");
        const c2 = this.getCard("ST03-002");
        const c3 = this.getCard("ST03-002");
        if (c1) p0.hand.push(c1);
        if (c2) p0.hand.push(c2);
        if (c3) p0.hand.push(c3);

        const triggerCard = this.getCard("ST03-010");
        if (triggerCard) p1.deck.push(triggerCard);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #0984e3; color: white');
        console.log("1. Player 0 (Opponent) has 3 cards in hand.");
        console.log("2. Player 1 has Rosanna on top of deck.");
        console.log("3. Run %cwindow.debug.dealDamage(1, 1)%c.", 'color: #e17055; font-weight: bold', 'color: inherit');
        console.log("4. Confirm Trigger activates (Rosanna trashed) AND Player 0 must discard 1.");
    };

    (manager as any).setupST03_011_Scenario = function() {
        console.log("Setting up ST03-011 (Modernia Unit) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 7;
        this.setLeader(0, "ST03-001");

        const modernia = this.getCard("ST03-011");
        if (modernia) p0.hand.push(modernia);

        // Add 2 dummy cards to hand for activation cost
        p0.hand.push(this.getCard("ST03-002")!);
        p0.hand.push(this.getCard("ST03-002")!);

        // Opponent unit
        const target = this.getCard("ST03-011"); // Modernia (Cost 7)
        if (target) p1.unitZones[0].unit = target;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Modernia in hand + 2 dummy cards.");
        console.log("2. Opponent has Modernia in Lane 0.");
        console.log("3. Play Modernia to Lane 0.");
        console.log("4. Confirm you discard remaining hand (2 cards) AND Opponent unit is Trashed.");
    };

    (manager as any).setupST03_011_Trigger_Scenario = function() {
        console.log("Setting up ST03-011 (Modernia Unit) Trigger Scenario...");
        const p1 = this.game.state.players[1]; // We setup for P1 to be triggered
        p1.deck = [];
        p1.hand = [];

        const triggerCard = this.getCard("ST03-011");
        if (triggerCard) p1.deck.push(triggerCard);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #0984e3; color: white');
        console.log("1. Player 1 has Modernia on top of deck.");
        console.log("2. Run %cwindow.debug.dealDamage(1, 1)%c.", 'color: #e17055; font-weight: bold', 'color: inherit');
        console.log("3. Confirm Trigger activates: Modernia is added to Hand (not Trashed).");
    };

    (manager as any).setupST03_012_Scenario = function() {
        console.log("Setting up ST03-012 (Surprise Attack) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.hand = []; p1.hand = [];
        p0.leaderLevel = 1;
        this.setLeader(0, "ST03-001");

        const skill = this.getCard("ST03-012");
        if (skill) p0.hand.push(skill);
        p0.hand.push(this.getCard("ST03-002")!); // Fodder to discard

        p1.hand.push(this.getCard("ST03-002")!); // Opponent fodder

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. 'Surprise Attack' in hand + 1 fodder.");
        console.log("2. Opponent has 1 card in hand.");
        console.log("3. Play 'Surprise Attack'.");
        console.log("4. Confirm YOU discard 1, then OPPONENT discards 1.");
    };

    (manager as any).setupST03_013_Scenario = function() {
        console.log("Setting up ST03-013 (Darkening) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST03-001");

        const skill = this.getCard("ST03-013");
        if (skill) p0.hand.push(skill);
        if (skill) p0.hand.push(skill);

        const handCostUnit = this.getCard("ST03-008"); // Exia (Cost 4) in hand

        if (handCostUnit) p0.hand.push(handCostUnit);

        const targetLow = this.getCard("ST03-007"); // D (Cost 3) < 4 -> Valid
        const targetHigh = this.getCard("ST03-009"); // Maiden (Cost 5) > 4 -> Invalid
        if (targetLow) p1.unitZones[0].unit = targetLow;
        if (targetHigh) p1.unitZones[1].unit = targetHigh;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. 'Darkening' in hand. Exia (Cost 4) in hand.");
        console.log("2. Opponent has D (Cost 3) and Maiden (Cost 5).");
        console.log("3. Play 'Darkening'. Verify you MUST discard Exia (only unit).");
        console.log("4. Confirm you can ONLY destroy D (Cost 3 < 4). Maiden should be unselectable.");
    };

    (manager as any).setupST03_014_Scenario = function() {
        console.log("Setting up ST03-014 (Sense Sharing) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 8;
        this.setLeader(0, "ST03-001");

        const skill = this.getCard("ST03-014");
        if (skill) p0.hand.push(skill);

        const fodder = this.getCard("ST03-006");
        if (fodder) p0.unitZones[0].unit = fodder;

        // Ensure deck has cards
        p0.deck.push(this.getCard("ST03-002")!);
        p0.deck.push(this.getCard("ST03-002")!);
        p0.deck.push(this.getCard("ST03-002")!);
        p0.deck.push(this.getCard("ST03-002")!);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. 'Sense Sharing' in hand. Unit on field.");
        console.log("2. Play 'Sense Sharing', select unit to trash.");
        console.log("3. Confirm unit is Trashed and you Draw 2 cards.");
    };

    (manager as any).setupST03_015_Scenario = function() {
        console.log("Setting up ST03-015 (Bring it on!) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        this.setLeader(0, "ST03-001");

        const skill = this.getCard("ST03-015");
        if (skill) p0.hand.push(skill);

        const myUnit = this.getCard("ST03-002");
        const oppUnit = this.getCard("ST03-011"); // Modernia (Big Unit)
        if (myUnit) p0.unitZones[0].unit = myUnit;
        if (oppUnit) p1.unitZones[0].unit = oppUnit;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. 'Bring it on!' in hand. My Unit vs Opponent Modernia.");
        console.log("2. Play Skill, select My Unit in Lane 0.");
        console.log("3. Confirm BOTH My Unit and Opponent Modernia are Trashed.");
    };

    (manager as any).setupST03_015_Trigger_Scenario = function() {
        console.log("Setting up ST03-015 (Bring it on!) Trigger Scenario...");
        const p1 = this.game.state.players[1];
        p1.deck = [];
        p1.trash = [];

        const triggerCard = this.getCard("ST03-015");
        if (triggerCard) p1.deck.push(triggerCard);

        const exitUnit = this.getCard("ST03-003"); // Privaty (Exit) - Valid
        const noExitUnit = this.getCard("ST03-002"); // Delta - Invalid
        if (exitUnit) p1.trash.push(exitUnit);
        if (noExitUnit) p1.trash.push(noExitUnit);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #0984e3; color: white');
        console.log("1. Player 1 has 'Bring it on!' on top of deck.");
        console.log("2. Player 1 Trash has Privaty (Exit) and Delta (No Exit).");
        console.log("3. Run %cwindow.debug.dealDamage(1, 1)%c.", 'color: #e17055; font-weight: bold', 'color: inherit');
        console.log("4. Confirm Trigger activates (Skill trashed) AND you can ONLY select Privaty to return to hand.");
    };

    (manager as any).setupST03_016_Scenario = function() {
        console.log("Setting up ST03-016 (Kevlar Vest) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST03-001");

        const vest = this.getCard("ST03-016");
        const unit = this.getCard("ST03-002"); // Delta 2500
        if (vest) p0.hand.push(vest);
        if (unit) p0.unitZones[0].unit = unit;

        // Opponent attacker
        const attacker = this.getCard("ST02-010"); // rafi 
        if (attacker) p1.unitZones[0].unit = attacker;


        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. My Delta (2500) vs Opponent Modernia (6500).");
        console.log("2. Kevlar Vest in My Hand. It is Opponent's Turn (P1 Main Phase).");
        console.log("3. Use Console to Equip Vest to Delta: Set P0 Hand empty and Vest in Item zone manually or just note this test is tricky.");
        console.log("   Actually, safer to setup: P0 Turn, Equip Vest, Pass Turn, Opp Attack.");
        console.log("   --> ACTION: Equip Vest to Delta. End Turn. Opponent Attack with Modernia.");
        console.log("4. Block with Delta. Confirm Attack Terminates immediately and Delta is Trashed.");
    };

    (manager as any).setupST03_017_Scenario = function() {
        console.log("Setting up ST03-017 (Rare Metal Armguard) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST03-001");

        const guard = this.getCard("ST03-017");
        const unit = this.getCard("ST03-002"); // Delta (Cost 1)
        if (guard) p0.hand.push(guard);
        if (unit) p0.unitZones[0].unit = unit;

        const killer = this.getCard("ST03-003"); // Privaty (Cost 1) -> Valid target for Mutual Destruction
        if (killer) p1.unitZones[0].unit = killer;

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Delta (Cost 1) on field. Armguard in hand.");
        console.log("2. Opponent has Privaty (Cost 1).");
        console.log("3. Equip Armguard to Delta. Go to Attack Phase. Attack Privaty.");
        console.log("4. Both Die (2500 vs 500?? Wait Privaty is 500, Delta is 2500. Delta wins).");
        console.log("   Ah, need Delta to lose to trigger Exit.");
        console.log("   Let's swap: My unit Cost 1 (Privaty 500) vs Opp Cost 1 (Delta 2500).");

        // Correct setup for mutual destruction (My unit must die)
        const weakUnit = this.getCard("ST03-003"); // Privaty (500)
        const strongUnit = this.getCard("ST03-002"); // Delta (2500)
        if (weakUnit) p0.unitZones[0].unit = weakUnit;
        if (strongUnit) p1.unitZones[0].unit = strongUnit;

        console.log("   CORRECTION: My Privaty (500) vs Opp Delta (2500).");
        console.log("   Equip Armguard to Privaty. Attack Delta.");
        console.log("   Privaty dies. Check if Delta is ALSO trashed (Cost 1 <= 1).");
    };

    (manager as any).setupST03_Battle_Scenario = function() {
        console.log("Setting up ST03-003 (Privaty) Battle Exit Scenario...");

        // 1. Reset Game
        const p1 = this.game.currentPlayer; // Player 1
        // const p2 = this.game.opponentPlayer; // Player 2 (Opponent)

        // 2. Setup Hands
        // P1 has nothing relevant
        p1.hand = [];
        // P2 has cards to discard (at least 2 to have a choice)
        this.setHand(1, ['ST01-013', 'ST01-014']);

        // 3. Setup Field
        // P1: Privaty (Power 3000) in Center (Index 1)
        this.setField(0, [null, 'ST03-003', null]);
        // P2: Something strong in Center (Index 1). ST02-001 is a Leader, so use ST02-003 (Unit)
        this.setField(1, [null, 'ST02-003', null]);

        // 4. Force Phase to Attack Phase
        // Player 1 turn, Attack Phase
        this.game.state.turnCount = 1;
        this.game.state.turnPlayerIndex = 0;
        this.forcePhase(Phase.ATTACK);

        console.log("Scenario Ready:");
        console.log("1. Privaty (P1 Center) has 3000 Power.");
        console.log("2. Eunhwa (P2 Center) has 5000 Power.");
        console.log("3. Instructions: Click Privaty -> Attack -> Click Eunhwa (Target Unit).");
        console.log("4. Result: Privaty destroyed by battle. Exit effect triggers.");
        console.log("5. Verify: Opponent MUST select a card from their hand to trash.");
        this.renderCallback();
    };

}
