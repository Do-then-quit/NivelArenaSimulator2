import { Phase } from '../types';

export function registerST01DebugScenarios(manager: any) {
    (manager as any).setupST01_013_Scenario = function() {
        console.log("Setting up ST01-013 (Reinforcement) Scenario...");

        // 1. Reset current player (P0)
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.trash = [];
        p0.hand = [];
        p0.leaderLevel = 10;
        this.game.state.turnPlayerIndex = 0;
        this.game.state.phase = Phase.MAIN;

        // 2. Add ST01-013 to hand
        const reinforcement = this.getCard("ST01-013");
        if (reinforcement) p0.hand.push(reinforcement);

        // 3. Add valid unit to trash (Neon ST01-002, Cost 1)
        const neon = this.getCard("ST01-002");
        if (neon) p0.trash.push(neon);

        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Player 0 has 'Reinforcement' (ST01-013) in hand.");
        console.log("2. Player 0 has 'Neon' (ST01-002) in trash.");
        console.log("3. Drag 'Reinforcement' to the SKILL zone to activate.");
    };

    (manager as any).setupST01_001_Scenario = function() {
        console.log("Setting up ST01-001 (Rapi Leader) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        [p0, p1].forEach(p => {
            p.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
            p.trash = []; p.hand = []; p.damage = [];
        });
        p0.leaderLevel = 4;
        this.game.state.turnPlayerIndex = 0;
        this.game.state.phase = Phase.MAIN;
        const neon = this.getCard("ST01-002");
        if (neon) p0.unitZones[0].unit = neon;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Player 0 is Level 4 with Neon on field.");
        console.log("2. Click 'Next Phase' until Level Up to reach Level 5.");
        console.log("3. Confirm Leader AWAKENS and Neon power increases by 1000.");
    };

    (manager as any).setupST01_002_Scenario = function() {
        console.log("Setting up ST01-002 (Neon) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        const neon = this.getCard("ST01-002");
        if (neon) p0.hand.push(neon);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Neon (Vanilla Unit) in hand.");
        console.log("2. Drag Neon to a Unit Zone.");
    };

    (manager as any).setupST01_003_Scenario = function() {
        console.log("Setting up ST01-003 (Besti) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        const besti = this.getCard("ST01-003");
        if (besti) p0.hand.push(besti);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Besti (Attacker) in hand.");
        console.log("2. Play Besti, go to ATTACK phase, and Attack.");
        console.log("3. Confirm power increases by 1000 during attack.");
    };

    (manager as any).setupST01_004_Scenario = function() {
        console.log("Setting up ST01-004 (Silver) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        const silver = this.getCard("ST01-004");
        if (silver) p0.hand.push(silver);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Silver (Vanilla Unit) in hand.");
        console.log("2. Drag Silver to a Unit Zone.");
    };

    (manager as any).setupST01_005_Scenario = function() {
        console.log("Setting up ST01-005 (Noise) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        const noise = this.getCard("ST01-005");
        if (noise) p0.hand.push(noise);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Noise (Attacker) in hand.");
        console.log("2. Play Noise, go to ATTACK phase, and Attack.");
        console.log("3. Confirm power increases by 2000 during attack.");
    };

    (manager as any).setupST01_006_Scenario = function() {
        console.log("Setting up ST01-006 (Noir) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        const noir = this.getCard("ST01-006");
        const target = this.getCard("ST01-002");
        if (noir) p0.hand.push(noir);
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Noir in hand, opponent has Neon in Lane 0.");
        console.log("2. Play Noir in Lane 0.");
        console.log("3. Confirm opponent's Neon is trashed by Entry effect.");
    };

    (manager as any).setupST01_007_Scenario = function() {
        console.log("Setting up ST01-007 (Viper) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        const viper = this.getCard("ST01-007");
        if (viper) p0.hand.push(viper);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Viper (Attacker) in hand.");
        console.log("2. Play Viper, go to ATTACK phase, and Attack.");
        console.log("3. Confirm power increases by 1000 during attack.");
    };

    (manager as any).setupST01_008_Scenario = function() {
        console.log("Setting up ST01-008 (Blanc) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        const blanc = this.getCard("ST01-008");
        const besti = this.getCard("ST01-003");
        if (blanc) p0.hand.push(blanc);
        if (besti) p0.unitZones[0].unit = besti;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Besti on field, Blanc in hand.");
        console.log("2. Play Blanc.");
        console.log("3. Confirm Besti power increases by 1000 due to Blanc's Passive.");
    };

    (manager as any).setupST01_009_Scenario = function() {
        console.log("Setting up ST01-009 (Emma) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 5;
        const emma = this.getCard("ST01-009");
        if (emma) p0.hand.push(emma);
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Emma (Vanilla Unit) in hand.");
        console.log("2. Drag Emma to a Unit Zone.");
    };

    (manager as any).setupST01_010_Scenario = function() {
        console.log("Setting up ST01-010 (Anis) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 6;
        const anis = this.getCard("ST01-010");
        const fodder = this.getCard("ST01-002");
        const target = this.getCard("ST01-002");
        if (anis) p0.unitZones[0].unit = anis;
        if (fodder) p0.hand.push(fodder);
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Anis on field, fodder in hand, opponent unit in Lane 0.");
        console.log("2. Click Anis 'Active', select fodder to shuffle.");
        console.log("3. Confirm opponent unit is trashed.");
    };

    (manager as any).setupST01_011_Scenario = function() {
        console.log("Setting up ST01-011 (Rapi Unit) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 7;
        const rapi = this.getCard("ST01-011");
        const target = this.getCard("ST01-002");
        if (rapi) p0.unitZones[0].unit = rapi;
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Rapi on field, opponent unit in Lane 0.");
        console.log("2. Go to ATTACK phase and attack opponent unit.");
        console.log("3. Confirm opponent unit trashed AND opponent takes 1 penetration damage.");
    };

    (manager as any).setupST01_012_Scenario = function() {
        console.log("Setting up ST01-012 (Weakness Insight) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 1;
        const insight = this.getCard("ST01-012");
        const target = this.getCard("ST01-002");
        if (insight) p0.hand.push(insight);
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Weakness Insight in hand, opponent has unit in Lane 0.");
        console.log("2. Play Weakness Insight, select opponent unit.");
        console.log("3. Confirm opponent unit power decreases by 2000.");
    };

    (manager as any).setupST01_014_Scenario = function() {
        console.log("Setting up ST01-014 (Firepower Only!) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        const firepower = this.getCard("ST01-014");
        const neon = this.getCard("ST01-002");
        if (firepower) p0.hand.push(firepower);
        if (neon) p0.unitZones[0].unit = neon;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Neon on field, 'Firepower Only!' in hand.");
        console.log("2. Play 'Firepower Only!'.");
        console.log("3. Confirm all friendly unit power increases by 2000.");
    };

    (manager as any).setupST01_015_Scenario = function() {
        console.log("Setting up ST01-015 (Missile) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 4;
        const missile = this.getCard("ST01-015");
        const target = this.getCard("ST01-009"); // Emma, 7000 Power
        if (missile) p0.hand.push(missile);
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Missile in hand, opponent has Emma in Lane 0.");
        console.log("2. Play Missile, select opponent Emma.");
        console.log("3. Confirm opponent Emma power decreases by 5000.");
    };

    (manager as any).setupST01_016_Scenario = function() {
        console.log("Setting up ST01-016 (Rare Metal Boots) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 2;
        const boots = this.getCard("ST01-016");
        const unit = this.getCard("ST01-002");
        if (boots) p0.hand.push(boots);
        if (unit) p0.unitZones[0].unit = unit;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Neon on field, Boots in hand.");
        console.log("2. Equip Boots to Neon.");
        console.log("3. Attack with Neon, confirm power increases by 2000.");
    };

    (manager as any).setupST01_017_Scenario = function() {
        console.log("Setting up ST01-017 (Kevlar Glove) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 3;
        const glove = this.getCard("ST01-017");
        const unit = this.getCard("ST01-002");
        const target = this.getCard("ST01-006"); // Noir, 2000 Power
        if (glove) p0.hand.push(glove);
        if (unit) p0.unitZones[0].unit = unit;
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Neon on field, Glove in hand, opponent has Noir in Lane 0.");
        console.log("2. Equip Glove to Neon, advance to ATTACK, and attack Noir.");
        console.log("3. Neon (3000) vs Noir (2000). Confirm Noir trashed and you DRAW a card (Plunder).");
    };

}
