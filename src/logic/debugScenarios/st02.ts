import { Phase } from '../types';

export function registerST02DebugScenarios(manager: any) {
    (manager as any).setupGuiltyScenario = function() {
        console.log("Setting up Guilty (ST02-009) Trigger Scenario...");

        // 1. Reset both players
        this.game.state.players[0].unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        this.game.state.players[1].unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        this.game.state.players[0].damage = [];
        this.game.state.players[1].damage = [];
        this.game.state.players[0].trash = [];
        this.game.state.players[1].trash = [];

        // 2. ST02-004 (Yulia) on P0 Field (Target)
        // const yulia = this.getCard("ST02-004");
        const marchana = this.getCard("ST02-008");
        // if (yulia) this.game.state.players[0].unitZones[0].unit = yulia;
        if (marchana) this.game.state.players[0].unitZones[1].unit = marchana;

        // 3. ST02-009 (Guilty) on top of P1 Deck (Trigger)
        const guilty = this.getCard("ST02-009");
        if (guilty) this.game.state.players[1].deck.push(guilty);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #0984e3; color: white');
        console.log("1. Player 0 has a 2-cost unit (Yulia) on field.");
        console.log("2. Player 1 has Guilty (ST02-009) on top of deck.");
        console.log("3. Run %cwindow.debug.dealDamage(1, 1)%c to trigger.", 'color: #e17055; font-weight: bold', 'color: inherit');
    };

    (manager as any).setupST02_001_Scenario = function() {
        console.log("Setting up ST02-001 (Guilty Leader) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 5;
        this.setLeader(0, "ST02-001");
        this.game.state.turnPlayerIndex = 0;
        this.game.state.phase = Phase.MAIN;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Player 0 is Level 5.");
        console.log("2. Current Size: " + this.game.getPlayerSize(p0));
        console.log("3. Click 'Next Phase' to Level Up to 6.");
        console.log("4. Confirm Leader AWAKENS and Size increases by 1 (Level 6 + Awakened 1 = 7).");
    };

    (manager as any).setupST02_002_Scenario = function() {
        console.log("Setting up ST02-002 (N102) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST02-001");
        const card = this.getCard("ST02-002");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. N102 (Vanilla Unit) in hand.");
        console.log("2. Drag N102 to a Unit Zone.");
    };

    (manager as any).setupST02_003_Scenario = function() {
        console.log("Setting up ST02-003 (Mica) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST02-001");
        const mica = this.getCard("ST02-003");
        if (mica) p0.unitZones[0].unit = mica;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Mica on field.");
        console.log("2. Overwrite Mica with another unit or reach 0 power to trash her.");
        console.log("3. Confirm Leader Level increases by 1 due to Exit effect.");
    };

    (manager as any).setupST02_004_Scenario = function() {
        console.log("Setting up ST02-004 (Yulia) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        this.setLeader(0, "ST02-001");
        const card = this.getCard("ST02-004");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Yulia (Vanilla Unit) in hand.");
        console.log("2. Drag Yulia to a Unit Zone.");
    };

    (manager as any).setupST02_005_Scenario = function() {
        console.log("Setting up ST02-005 (Yan) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        this.setLeader(0, "ST02-001");
        const yan = this.getCard("ST02-005");
        if (yan) p0.hand.push(yan);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Yan in hand.");
        console.log("2. Play Yan.");
        console.log("3. Confirm Leader Level increases by 1 due to Entry effect.");
    };

    (manager as any).setupST02_006_Scenario = function() {
        console.log("Setting up ST02-006 (Dora) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        this.setLeader(0, "ST02-001");
        const card = this.getCard("ST02-006");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Dora (Vanilla Unit) in hand.");
        console.log("2. Drag Dora to a Unit Zone.");
    };

    (manager as any).setupST02_007_Scenario = function() {
        console.log("Setting up ST02-007 (Breed) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        this.setLeader(0, "ST02-001");
        const breed = this.getCard("ST02-007");
        const fodder = this.getCard("ST02-002");
        const baseUnit = this.getCard("ST02-002");
        if (breed) p0.unitZones[0].unit = breed;
        if (baseUnit) p0.unitZones[1].unit = baseUnit;
        if (fodder) p0.hand.push(fodder);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Breed and N102 (Base) on field, fodder in hand.");
        console.log("2. Click Breed 'Active', select fodder to trash.");
        console.log("3. Confirm N102 hit increases by 1.");
    };

    (manager as any).setupST02_008_Scenario = function() {
        console.log("Setting up ST02-008 (Marciana) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        this.setLeader(0, "ST02-001");
        const card = this.getCard("ST02-008");
        if (card) p0.hand.push(card);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Marciana (Vanilla Unit) in hand.");
        console.log("2. Drag Marciana to a Unit Zone.");
    };

    (manager as any).setupST02_009_Scenario = function() {
        console.log("Setting up ST02-009 (Guilty Unit) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.deck = []; p1.damage = [];
        this.setLeader(0, "ST02-001");
        // Ensure P1 also has appropriate leader if needed, or leave as default.
        // But the trigger is P1's.
        this.setLeader(1, "ST02-001"); // Set P1 leader too for consistency
        const guilty = this.getCard("ST02-009");
        const target = this.getCard("ST02-005"); // Yan, Cost 3
        if (guilty) p1.deck.push(guilty);
        if (target) p0.unitZones[0].unit = target;
        this.renderCallback();
        console.group("SCENARIO READY");
        console.log("1. Opponent (P0) has Yan (Cost 3) in Lane 0.");
        console.log("2. Guilty unit is on top of your (P1) deck.");
        console.log("3. Click Next Phase until it's P1's turn, then use console: window.debug.dealDamage(1, 1).");
        console.log("4. Confirm Trigger activates, select Yan to trash.");
        console.groupEnd();
    };

    (manager as any).setupST02_010_Scenario = function() {
        console.log("Setting up ST02-010 (Snow White) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 6;
        this.setLeader(0, "ST02-001");
        const snow = this.getCard("ST02-010");
        const blocker = this.getCard("ST02-004"); // Yulia, Cost 2
        if (snow) p0.unitZones[0].unit = snow;
        if (blocker) p1.unitZones[0].unit = blocker;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Snow White vs Yulia (Cost 2) in Lane 0.");
        console.log("2. Advance to ATTACK and attack with Snow White.");
        console.log("3. Confirm Breakthrough logic prevents Yulia from blocking.");
    };

    (manager as any).setupST02_011_Scenario = function() {
        console.log("Setting up ST02-011 (Diesel) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 5;
        this.setLeader(0, "ST02-001");
        const diesel = this.getCard("ST02-011");
        if (diesel) p0.unitZones[0].unit = diesel;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Diesel on field, Leader Level 5.");
        console.log("2. Confirm Diesel power is 3000 + (5*1000) = 8000.");
        console.log("3. Increase Leader Level via console: window.debug.setLeaderLevel(0, 6).");
        console.log("4. Confirm Diesel power increases to 9000.");
    };

    (manager as any).setupST02_012_Scenario = function() {
        console.log("Setting up ST02-012 (Crescendo) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST02-001");
        const crescendo = this.getCard("ST02-012");
        const unit = this.getCard("ST02-002");
        if (crescendo) p0.hand.push(crescendo);
        if (unit) p0.unitZones[0].unit = unit;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. N102 on field, Crescendo in hand.");
        console.log("2. Play Crescendo on N102.");
        console.log("3. Confirm N102 power increases by 3000.");
    };

    (manager as any).setupST02_013_Scenario = function() {
        console.log("Setting up ST02-013 (Master's Grace) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST02-001");
        const grace = this.getCard("ST02-013");
        if (grace) p0.hand.push(grace);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. 'Master's Grace' in hand, Leader Level 1.");
        console.log("2. Play 'Master's Grace'.");
        console.log("3. Confirm Leader Level increases to 2.");
    };

    (manager as any).setupST02_014_Scenario = function() {
        console.log("Setting up ST02-014 (Prize) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        this.setLeader(0, "ST02-001");
        const prize = this.getCard("ST02-014");
        if (prize) p0.hand.push(prize);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. 'Prize' in hand.");
        console.log("2. Play 'Prize'.");
        console.log("3. Confirm you pick 1 card from top 3 and hand size increases (or stays same after play/draw).");
    };

    (manager as any).setupST02_015_Scenario = function() {
        console.log("Setting up ST02-015 (Acceleration) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        this.setLeader(0, "ST02-001");
        const acceleration = this.getCard("ST02-015");
        const myUnit = this.getCard("ST02-006"); // Dora, 5500
        const oppUnit = this.getCard("ST02-004"); // Yulia, 4500
        if (acceleration) p0.hand.push(acceleration);
        if (myUnit) p0.unitZones[0].unit = myUnit;
        if (oppUnit) p1.unitZones[0].unit = oppUnit;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Dora vs Yulia in Lane 0.");
        console.log("2. Play 'Acceleration' and select Lane 0.");
        console.log("3. Confirm Yulia (lowest power) is trashed.");
    };

    (manager as any).setupST02_016_Scenario = function() {
        console.log("Setting up ST02-016 (Kevlar Protector) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        this.setLeader(0, "ST02-001");
        const card = this.getCard("ST02-016");
        const unit = this.getCard("ST02-002");
        if (card) p0.hand.push(card);
        if (unit) p0.unitZones[0].unit = unit;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. N102 on field, Kevlar Protector in hand.");
        console.log("2. Equip Kevlar Protector to N102.");
        console.log("3. Confirm N102 power increases by 2000.");
    };

    (manager as any).setupST02_017_Scenario = function() {
        console.log("Setting up ST02-017 (Rare Metal Helmet) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        this.setLeader(0, "ST02-001");
        const card = this.getCard("ST02-017");
        const unit = this.getCard("ST02-008"); // Marciana, Cost 4
        if (card) p0.hand.push(card);
        if (unit) p0.unitZones[0].unit = unit;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Marciana (Cost 4) on field, Helmet in hand.");
        console.log("2. Equip Helmet to Marciana.");
        console.log("3. Confirm Marciana hit increases by 1.");
    };

}
