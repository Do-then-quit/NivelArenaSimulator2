import { Phase } from '../types';

export function registerBT01DebugScenarios(manager: any) {
    (manager as any).setupBT01_001_Scenario = function() {
        console.log("Setting up BT01-001 (Red Hood Leader) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = []; p0.leaderLevel = 5;
        this.setLeader(0, "BT01-001");
        const unit = this.getCard("BT01-002"); // Attacker
        if (unit) p0.unitZones[0].unit = unit;
        this.game.state.turnPlayerIndex = 0;
        this.game.state.phase = Phase.MAIN;
        this.renderCallback();
        console.log("%c SCENARIO READY ", 'background: #4CAF50; color: white');
        console.log("1. Player 0 Leader Level 5, Red Hood assigned.");
        console.log("2. Neon (Attacker) on field.");
        console.log("3. Increase Level to 6 (window.debug.setLeaderLevel(0, 6)).");
        console.log("4. Confirm Leader AWAKENS and Neon power increases by 2000 (Passive).");
    };

    (manager as any).setupBT01_002_Scenario = function() {
        console.log("Setting up BT01-002 (Neon) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-002");
        if (card) p0.hand = [card];
        this.renderCallback();
        console.log("1. Neon (Attacker) in hand.");
        console.log("2. Play Neon and attack. Confirm power increases by 2000.");
    };

    (manager as any).setupBT01_003_Scenario = function() {
        console.log("Setting up BT01-003 (Crow) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-003");
        if (card) p0.hand = [card];
        this.renderCallback();
        console.log("1. Crow (Vanilla) in hand.");
    };

    (manager as any).setupBT01_004_Scenario = function() {
        console.log("Setting up BT01-004 (Noise) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const noise = this.getCard("BT01-004");
        const target = this.getCard("BT01-004");
        if (noise) p0.unitZones[0].unit = noise;
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("1. Noise (Penetration) vs Crow.");
        console.log("2. Attack Crow. Confirm Penetration damage [1] deals to opponent.");
    };

    (manager as any).setupBT01_005_Scenario = function() {
        console.log("Setting up BT01-005 (Rapi) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const rapi = this.getCard("BT01-005");
        if (rapi) p0.unitZones[0].unit = rapi;
        this.renderCallback();
        console.log("1. Rapi (Berserker) on field.");
        console.log("2. Verify if 'Skip Phase' is restricted or mandatory attack logic works.");
    };

    (manager as any).setupBT01_006_Scenario = function() {
        console.log("Setting up BT01-006 (Anis) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const anis = this.getCard("BT01-006");
        const target = this.getCard("BT01-003");
        if (anis) p0.unitZones[0].unit = anis;
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("1. Anis on field vs Crow.");
        console.log("2. Attack with Anis. Confirm power buff (+2000) and draw card on trash (Plunder).");
    };

    (manager as any).setupBT01_006_Trigger_Scenario = function() {
        console.log("Setting up BT01-006 (Anis) Trigger Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.deck = [];
        const anis = this.getCard("BT01-006");
        const target = this.getCard("BT01-010"); // High power unit to see reduction
        if (anis) p1.deck.push(anis);
        if (target) p0.unitZones[0].unit = target;
        this.renderCallback();
        console.log("1. Anis on top of P1 deck. Enemy unit on field.");
        console.log("2. Run window.debug.dealDamage(1, 1).");
        console.log("3. Confirm Anis trashed and enemy power reduced by 5000.");
    };

    (manager as any).setupBT01_007_Scenario = function() {
        console.log("Setting up BT01-007 (Clay) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-007");
        if (card) p0.hand = [card];
        this.renderCallback();
        console.log("1. Clay (Vanilla) in hand.");
    };

    (manager as any).setupBT01_008_Scenario = function() {
        console.log("Setting up BT01-008 (Volume) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const volume = this.getCard("BT01-008");
        const noise = this.getCard("BT01-004"); // Penetration
        if (volume) p0.unitZones[0].unit = volume;
        if (noise) p0.unitZones[1].unit = noise;
        this.renderCallback();
        console.log("1. Volume and Noise (Penetration) on field.");
        console.log("2. Confirm Noise power increases by 1500.");
    };

    (manager as any).setupBT01_009_Scenario = function() {
        console.log("Setting up BT01-009 (Bay) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-009");
        if (card) p0.unitZones[0].unit = card;
        this.renderCallback();
        console.log("1. Bay (Attacker) on field.");
        console.log("2. Attack and confirm power increases by 1000.");
    };

    (manager as any).setupBT01_010_Scenario = function() {
        console.log("Setting up BT01-010 (Aria) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-010");
        if (card) p0.hand = [card];
        this.renderCallback();
        console.log("1. Aria (Vanilla) in hand.");
    };

    (manager as any).setupBT01_011_Scenario = function() {
        console.log("Setting up BT01-011 (Neon Blue) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const neon = this.getCard("BT01-011");
        const target = this.getCard("BT01-010");
        if (neon) p0.unitZones[0].unit = neon;
        if (target) p1.unitZones[0].unit = target;
        this.renderCallback();
        console.log("1. Neon Blue Ocean on field. Enemy unit on field.");
        console.log("2. Click 'Active' on Neon, select enemy.");
        console.log("3. Confirm enemy power reduced by 1500.");
    };

    (manager as any).setupBT01_012_Scenario = function() {
        console.log("Setting up BT01-012 (Emma) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const emma = this.getCard("BT01-012");
        const crow = this.getCard("BT01-003");
        if (emma) p0.hand = [emma];
        if (crow) p0.unitZones[0].unit = crow;
        this.renderCallback();
        console.log("1. Emma in hand, Crow on field.");
        console.log("2. Play Emma.");
        console.log("3. Confirm Crow (and Emma) gain 'Attacker: +1000 power'.");
    };

    (manager as any).setupBT01_013_Scenario = function() {
        console.log("Setting up BT01-013 (Jackal) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-013");
        if (card) p0.unitZones[0].unit = card;
        this.renderCallback();
        console.log("1. Jackal on field.");
        console.log("2. Attack and confirm power increases by 1000.");
    };

    (manager as any).setupBT01_014_Scenario = function() {
        console.log("Setting up BT01-014 (Scarlet) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const scarlet = this.getCard("BT01-014");
        if (scarlet) p0.unitZones[0].unit = scarlet;
        this.renderCallback();
        console.log("1. Scarlet (Berserker) on field.");
    };

    (manager as any).setupBT01_014_Trigger_Scenario = function() {
        console.log("Setting up BT01-014 (Scarlet) Trigger Scenario...");
        const p1 = this.game.state.players[1];
        p1.deck = [];
        p1.trash = [];
        const scarlet = this.getCard("BT01-014");
        const fodder = this.getCard("BT01-003"); // Cost 1
        if (scarlet) p1.deck.push(scarlet);
        if (fodder) p1.trash.push(fodder);
        this.renderCallback();
        console.log("1. Scarlet on top of P1 deck. 1-cost unit in P1 trash.");
        console.log("2. Run window.debug.dealDamage(1, 1).");
        console.log("3. Confirm Scarlet trashed and fodder returns to hand.");
    };

    (manager as any).setupBT01_015_Scenario = function() {
        console.log("Setting up BT01-015 (Noir) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const noir = this.getCard("BT01-015");
        const enemy = this.getCard("BT01-010");
        if (noir) p0.hand = [noir];
        if (enemy) p1.unitZones[0].unit = enemy;
        this.renderCallback();
        console.log("1. Noir in hand. Enemy unit in Lane 0.");
        console.log("2. Play Noir in Lane 0 (Encounter).");
        console.log("3. Confirm enemy power reduced by 4000.");
    };

    (manager as any).setupBT01_016_Scenario = function() {
        console.log("Setting up BT01-016 (Snow White) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const card = this.getCard("BT01-016");
        if (card) p0.unitZones[0].unit = card;
        this.renderCallback();
        console.log("1. Snow White on field.");
        console.log("2. Attack and confirm power increases by 2000.");
    };

    (manager as any).setupBT01_017_Scenario = function() {
        console.log("Setting up BT01-017 (Viper) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const viper = this.getCard("BT01-017");
        const enemy = this.getCard("BT01-010");
        if (viper) p0.hand = [viper];
        if (enemy) p1.unitZones[0].unit = enemy;
        this.renderCallback();
        console.log("1. Viper in hand. Enemy unit in Lane 0.");
        console.log("2. Play Viper in Lane 0 (Encounter).");
        console.log("3. Confirm enemy power becomes 1000.");
    };

    (manager as any).setupBT01_018_Scenario = function() {
        console.log("Setting up BT01-018 (Blanc) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const blanc = this.getCard("BT01-018");
        const neon = this.getCard("BT01-002"); // Attacker
        if (blanc) p0.unitZones[0].unit = blanc;
        if (neon) p0.unitZones[1].unit = neon;
        this.renderCallback();
        console.log("1. Blanc and Neon (Attacker) on field.");
        console.log("2. Confirm Neon power increases by 2000, but Blanc does NOT (Blanc is Passive, not Attacker).");
    };

    (manager as any).setupBT01_019_Scenario = function() {
        console.log("Setting up BT01-019 (Red Hood Unit) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p0.hand = [];
        this.setLeader(0, "BT01-001");
        p0.levelZone!.isAwakened = true; // Force Awakened for passive check
        const redhood = this.getCard("BT01-019");
        const neon = this.getCard("BT01-003");
        if (redhood) p0.hand.push(redhood);
        if (neon) p0.unitZones[0].unit = neon;
        this.renderCallback();
        console.log("1. Awakened Red Hood Leader (BT01-001) on field.");
        console.log("2. Neon (Attacker) on field (Power 3000 + 2000 from Leader = 5000).");
        console.log("3. Play Red Hood Unit.");
        console.log("4. Confirm Neon and Red Hood gain Attacker/Penetration.");
        console.log("5. Confirm Red Hood (which just gained Attacker) also receives +2000 Power from Leader.");
    };

    (manager as any).setupBT01_019_Trigger_Scenario = function() {
        console.log("Setting up BT01-019 (Red Hood Unit) Trigger Scenario...");
        const p1 = this.game.state.players[1];
        p1.deck = [];
        p1.hand = [];
        const redhood = this.getCard("BT01-019");
        if (redhood) p1.deck.push(redhood);
        this.renderCallback();
        console.log("1. Red Hood unit on top of P1 deck.");
        console.log("2. Run window.debug.dealDamage(1, 1).");
        console.log("3. Confirm Red Hood added to hand.");
    };

    (manager as any).setupBT01_020_Scenario = function() {
        console.log("Setting up BT01-020 (Wild Tooth) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const skill = this.getCard("BT01-020");
        const neon = this.getCard("BT01-003"); // Attacker
        if (skill) p0.hand = [skill];
        if (neon) p0.unitZones[0].unit = neon;
        this.renderCallback();
        console.log("1. Wild Tooth in hand, Neon (Attacker) on field.");
        console.log("2. Play Wild Tooth on Neon.");
        console.log("3. Confirm Neon gains 'Attacker: Penetration[1]'.");
    };

    (manager as any).setupBT01_021_Scenario = function() {
        console.log("Setting up BT01-021 (Formation F.F) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const skill = this.getCard("BT01-021");
        const enemy = this.getCard("BT01-010");
        if (skill) p0.hand = [skill];
        if (enemy) p1.unitZones[0].unit = enemy;
        this.renderCallback();
        console.log("1. Formation F.F in hand, enemy unit on field.");
        console.log("2. Play Formation F.F.");
        console.log("3. Confirm all enemy unit power reduced by 1000.");
    };

    (manager as any).setupBT01_022_Scenario = function() {
        console.log("Setting up BT01-022 (Overwhelm) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const skill = this.getCard("BT01-022");
        const e1 = this.getCard("BT01-010");
        const e2 = this.getCard("BT01-010");
        if (skill) p0.hand = [skill];
        if (e1) p1.unitZones[0].unit = e1;
        if (e2) p1.unitZones[1].unit = e2;
        this.renderCallback();
        console.log("1. Overwhelm in hand, 2 enemy units on field.");
        console.log("2. Play Overwhelm, select 2 enemies.");
        console.log("3. Confirm enemies power reduced by 2000.");
    };

    (manager as any).setupBT01_023_Scenario = function() {
        console.log("Setting up BT01-023 (Cheer Up Together) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const skill = this.getCard("BT01-023");
        const n1 = this.getCard("BT01-002"); // Attacker
        const n2 = this.getCard("BT01-002"); // Attacker
        if (skill) p0.hand = [skill];
        if (n1) p0.unitZones[0].unit = n1;
        if (n2) p0.unitZones[1].unit = n2;
        this.renderCallback();
        console.log("1. Skill in hand, 2 Attackers on field.");
        console.log("2. Play skill.");
        console.log("3. Confirm all Attackers power increased by 2500.");
    };

    (manager as any).setupBT01_024_Scenario = function() {
        console.log("Setting up BT01-024 (Finale) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const skill = this.getCard("BT01-024");
        const enemy = this.getCard("BT01-003"); // 3000 power
        if (skill) p0.hand = [skill];
        if (enemy) p1.unitZones[0].unit = enemy;
        this.renderCallback();
        console.log("1. Finale in hand, enemy (3000 power) on field.");
        console.log("2. Play Finale on enemy.");
        console.log("3. Confirm enemy trashed (due to 0 power) and CARD DRAWN.");
    };

    (manager as any).setupBT01_025_Scenario = function() {
        console.log("Setting up BT01-025 (Reinforcement) Scenario...");
        const p0 = this.game.state.players[0];
        p0.trash = [];
        p0.hand = [];
        const skill = this.getCard("BT01-025");
        const attacker = this.getCard("BT01-002");
        if (skill) p0.hand.push(skill);
        if (attacker) p0.trash.push(attacker);
        this.renderCallback();
        console.log("1. Skill in hand, Attacker in trash.");
        console.log("2. Play skill, select Attacker.");
        console.log("3. Confirm Attacker returns to hand.");
    };

    (manager as any).setupBT01_026_Trigger_Scenario = function() {
        console.log("Setting up BT01-026 (Glove) Trigger Scenario...");
        const p1 = this.game.state.players[1];
        p1.deck = [];
        const item = this.getCard("BT01-026");
        if (item) p1.deck.push(item);
        this.renderCallback();
        console.log("1. Glove on top of P1 deck.");
        console.log("2. Run window.debug.dealDamage(1, 1).");
        console.log("3. Confirm Glove added to hand.");
    };

    (manager as any).setupBT01_026_Scenario = function() {
        console.log("Setting up BT01-026 (Goddessium Glove) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });

        const unit = this.getCard("ST02-002"); // N102
        const item = this.getCard("BT01-026");
        const enemy = this.getCard("BT01-002"); // 2000 Power

        if (unit) p0.unitZones[0].unit = unit;
        if (item) p0.hand = [item];
        if (enemy) p1.unitZones[0].unit = enemy;

        this.renderCallback();
        console.log("1. N102 on field, Goddessium Glove in hand, enemy on field.");
        console.log("2. Equip Glove to N102.");
        console.log("3. Attack enemy with N102.");
        console.log("4. Confirm opponent takes 1 Penetration damage when enemy is trashed.");
    };

    (manager as any).setupBT01_027_Scenario = function() {
        console.log("Setting up BT01-027 (Norn Goggle) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        const item = this.getCard("BT01-027");
        const unit = this.getCard("BT01-003");
        if (item) p0.hand = [item];
        if (unit) p0.unitZones[0].unit = unit;
        this.renderCallback();
        console.log("1. Goggle in hand, Crow on field.");
        console.log("2. Equip Goggle to Crow.");
        console.log("3. Attack and confirm 'Attacker: +2000 power & Plunder[1]'.");
    };

    (manager as any).setupBT01_Fire_Scenarios = function() {
        console.log("Setting up BT01 Fire Cards Verification Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        [p0, p1].forEach(p => {
            p.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; z.temporaryEffects = []; });
            p.trash = []; p.hand = []; p.damage = [];
        });

        // 1. Red Hood Leader (BT01-001)
        this.setLeader(0, "BT01-001");
        this.setLeaderLevel(0, 6); // Awakened

        // 2. Berserker Rapi (BT01-005)
        const rapi = this.getCard("BT01-005");
        if (rapi) p0.unitZones[0].unit = rapi;

        // 3. Neon (BT01-002) for Attacker test
        const neon = this.getCard("BT01-002");
        if (neon) p0.unitZones[1].unit = neon;

        // 4. Emma (BT01-012) and Viper (BT01-017) in hand
        const emma = this.getCard("BT01-012");
        const viper = this.getCard("BT01-017");
        if (emma) p0.hand.push(emma);
        if (viper) p0.hand.push(viper);

        // 5. Opponent Target for Viper
        const target = this.getCard("BT01-003"); // Crow (3000)
        if (target) p1.unitZones[2].unit = target;

        this.renderCallback();
        console.group("BT01 Fire Scenario Ready");
        console.log("1. P0 has Red Hood Awakened. Rapi (Berserker) in Lane 0, Neon in Lane 1.");
        console.log("2. Units power should be buffed by Red Hood (+2000).");
        console.log("3. Play Emma to grant 'Attacker: Power+1000' to all units.");
        console.log("4. Play Viper in Lane 2 to set opponent Crow power to 1000.");
        console.log("5. Go to ATTACK phase. Try to skip - confirm you MUST attack with Rapi.");
        console.groupEnd();
    };

    (manager as any).setupBT01_Recursion_Scenario = function() {
        console.log("Setting up BT01 Recursion (Scarlet BT01-014) Scenario...");
        const p0 = this.game.state.players[0];
        p0.trash = []; p0.deck = []; p0.damage = [];

        // 1. Put a 2-cost unit in trash
        const neon = this.getCard("BT01-002");
        if (neon) p0.trash.push(neon);

        // 2. Put Scarlet on top of deck
        const scarlet = this.getCard("BT01-014");
        if (scarlet) p0.deck.push(scarlet);

        this.renderCallback();
        console.log("Scenario Ready. Run window.debug.dealDamage(0, 1) to trigger Scarlet.");
        console.log("Confirm you can pick Neon from trash to hand.");
    };

    (manager as any).setupBT01_Earth_Passive_Scenario = function() {
        console.log("Setting up BT01 Earth Passive Scenario...");
        const p0 = this.game.state.players[0];
        this.setLeader(0, "BT01-028"); // Scarlet Leader
        this.setLeaderLevel(0, 5); // Awakened
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });

        const brid = this.getCard("BT01-045"); // Brid (Passive: 1-cost +2000)
        const quency = this.getCard("BT01-036"); // Quency (Passive: Base +2000)
        const neon = this.getCard("BT01-031"); // Anne (1-cost, Base)

        if (brid) p0.unitZones[0].unit = brid;
        if (quency) p0.unitZones[1].unit = quency;
        if (neon) p0.unitZones[2].unit = neon;

        this.renderCallback();
        console.group("Earth Passive Verification");
        console.log("1. Scarlet Leader (Awakened) gives all Base units +1000.");
        console.log("2. Quency gives all Base units +2000.");
        console.log("3. Brid gives all 1-cost units +2000.");
        console.log("4. Result for Neon (Base, 1-cost): 2000(base) + 1000(Leader) + 2000(Quency) + 2000(Brid) = 7000 Power.");
        console.log("   Check neon power.");
        console.groupEnd();
    };

    (manager as any).setupBT01_Earth_Frontline_Scenario = function() {
        console.log("Setting up BT01 Earth Frontline Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });

        const mica = this.getCard("BT01-030"); // Mica (Frontline: +3000)
        const diesel = this.getCard("BT01-037"); // Diesel (Frontline: Hit+1)
        if (mica) p0.unitZones[0].unit = mica;
        if (diesel) p0.unitZones[1].unit = diesel;

        this.renderCallback();
        console.log("1. Lane 2 is empty. Mica and Diesel should NOT have frontline buffs.");
        console.log("2. Running: window.debug.placeUnit(0, 2, 'BT01-031')");
        this.renderCallback(); // Wait for interaction instruction
        console.log("3. Now all 3 lanes are full. Confirm Mica power +3000 and Diesel Hit +1.");
    };

    (manager as any).setupBT01_Earth_Dynamic_Scenario = function() {
        console.log("Setting up BT01 Earth Dynamic power Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        this.setLeaderLevel(0, 6);

        const sin = this.getCard("BT01-032"); // Sin (+500 per Base unit)
        const ruppe = this.getCard("BT01-040"); // Rupee (+500 per Leader Level)
        const base1 = this.getCard("BT01-031"); // Anne (Base)

        if (sin) p0.unitZones[0].unit = sin;
        if (ruppe) p0.unitZones[1].unit = ruppe;
        if (base1) p0.unitZones[2].unit = base1;

        this.renderCallback();
        console.log("1. Leader Level 6. Rupee should have 4000(base) + 6*500 = 7000 Power.");
        console.log("2. 2 Base units on field (Anne and Rupee/Sin?). Sin has Base trait? Let me check.");
        console.log("   Sin (BT01-032) traits: '이펙트 / 미실리스'. NOT Base.");
        console.log("   Rupee (BT01-040) traits: '이펙트 / 테트라'. NOT Base.");
        console.log("   Anne (BT01-031) traits: '베이스 / 엘리시온'. YES Base.");
        console.log("3. Sin should have 4000(base) + 1*500(Anne) = 4500 Power.");
    };

    (manager as any).setupBT01_Earth_Search_Scenario = function() {
        console.log("Setting up BT01 Earth Search Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = []; p0.deck = [];

        const rapunzel = this.getCard("BT01-044");
        const baseUnit = this.getCard("BT01-031");
        const nonBase = this.getCard("BT01-035");

        if (rapunzel) p0.hand.push(rapunzel);
        if (baseUnit) p0.deck.push(baseUnit);
        if (nonBase) { p0.deck.push(nonBase); p0.deck.push(nonBase); }

        this.renderCallback();
        console.log("1. Rapunzel in hand. Deck has 1 Base unit and 2 non-base.");
        console.log("2. Play Rapunzel. Confirm it picks the Base unit and shuffles others back.");
    };

    (manager as any).setupBT01_Earth_Duration_Scenario = function() {
        console.log("Setting up BT01 Earth Duration Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });

        const belorta = this.getCard("BT01-029"); // +1000 till end of opp turn
        if (belorta) p0.hand = [belorta];

        this.renderCallback();
        console.log("1. Play Belorta. Note its power (3000 -> 4000).");
        console.log("2. Pass turn. (Now Opponent turn). Power should still be 4000.");
        console.log("3. Pass turn again. (Back to My turn). Power should return to 3000.");
    };

    (manager as any).setupBT01_Earth_Skill_Scenario = function() {
        console.log("Setting up BT01 Earth Skill Scenario (VIP Gift & Dessert Time)...");
        const p0 = this.game.state.players[0];
        p0.hand = []; p0.deck = []; p0.unitZones.forEach((z: any) => { z.unit = null; });

        const vipGift = this.getCard("BT01-051");
        const lowCost = this.getCard("BT01-031"); // 1-cost
        const highCost = this.getCard("BT01-040"); // 6-cost
        const baseUnit = this.getCard("BT01-031");

        if (vipGift) p0.hand.push(vipGift);
        if (lowCost) { p0.deck.push(lowCost); p0.deck.push(lowCost); }
        if (highCost) p0.deck.push(highCost);
        if (baseUnit) p0.unitZones[0].unit = baseUnit;

        const dessertTime = this.getCard("BT01-049");
        if (dessertTime) p0.hand.push(dessertTime);

        this.renderCallback();
        console.log("1. Play VIP Gift. Confirm it takes 2 low-cost cards, shuffles high-cost back.");
        console.log("2. Play Dessert Time. Confirm it draws 1 card (1 Base unit on field).");
    };

    (manager as any).setupBT01_035_Scenario = function() {
        console.log("Setting up BT01-035 (Soline) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });

        const soline = this.getCard("BT01-035");
        const targetLow = this.getCard("BT01-031"); // 1-cost
        const targetHigh = this.getCard("BT01-040"); // 6-cost

        if (soline) p0.unitZones[0].unit = soline;
        if (targetLow) p1.unitZones[0].unit = targetLow;
        if (targetHigh) p1.unitZones[1].unit = targetHigh;

        this.renderCallback();
        console.log("1. Soline in Lane 0. Opponent has 1-cost in Lane 0, 6-cost in Lane 1.");
        console.log("2. Attack Lane 0: Confirm Breakthrough prevents blocking (Damage to Leader).");
        console.log("3. Attack Lane 1: Confirm blocking IS allowed.");
    };

    (manager as any).setupBT01_038_Scenario = function() {
        console.log("Setting up BT01-038 (Rupee) Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = [];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });

        const rupee = this.getCard("BT01-038");
        const fodder = this.getCard("BT01-031");
        const target = this.getCard("BT01-031");

        if (rupee) p0.unitZones[0].unit = rupee;
        if (fodder) p0.hand.push(fodder);
        if (target) p0.unitZones[1].unit = target;

        this.renderCallback();
        console.log("1. Rupee (Unit) on field. 1 fodder in hand. Another unit on field.");
        console.log("2. Activate Rupee Active effect. Confirm fodder trashed and target buffed +4000.");
    };

    (manager as any).setupBT01_041_Scenario = function() {
        console.log("Setting up BT01-041 (Admi) Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = [];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });

        const admi = this.getCard("BT01-041");
        const target = this.getCard("BT01-031");

        if (admi) p0.hand.push(admi);
        if (target) p0.unitZones[0].unit = target;

        this.renderCallback();
        console.log("1. Admi in hand, Unit on field.");
        console.log("2. Play Admi, select Unit.");
        console.log("3. Confirm Unit buffed +2000.");
    };

    (manager as any).setupBT01_044_Scenario = function() {
        console.log("Setting up BT01-044 (Rapunzel) Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = []; p0.deck = [];
        const rapunzel = this.getCard("BT01-044");
        const base = this.getCard("BT01-031");
        if (rapunzel) p0.hand.push(rapunzel);
        if (rapunzel && base) { p0.deck.push(base); p0.deck.push(rapunzel); p0.deck.push(base); }
        this.renderCallback();
        console.log("1. Rapunzel in hand. Deck has Base units.");
        console.log("2. Play Rapunzel. Confirm search works.");
    };

    (manager as any).setupBT01_044_Trigger_Scenario = function() {
        console.log("Setting up BT01-044 (Rapunzel) Trigger Scenario...");
        const p0 = this.game.state.players[0];
        p0.leaderLevel = 1; p0.deck = [];
        const rapunzel = this.getCard("BT01-044");
        if (rapunzel) p0.deck.push(rapunzel);
        this.renderCallback();
        console.log("1. Rapunzel on top of P0 deck. Leader Level 1.");
        console.log("2. Run window.debug.dealDamage(0, 1).");
        console.log("3. Confirm Leader Level increases to 2 and Rapunzel is trashed.");
    };

    (manager as any).setupBT01_046_Scenario = function() {
        console.log("Setting up BT01-046 (Scarlet Unit) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.hand = []; p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });

        const scarlet = this.getCard("BT01-046");
        const base = this.getCard("BT01-031"); // Base
        const target3 = this.getCard("ST03-007"); // 3-cost enemy

        if (scarlet) p0.hand.push(scarlet);
        if (base) p0.unitZones[0].unit = base;
        if (target3) p1.unitZones[0].unit = target3;

        this.renderCallback();
        console.log("1. Scarlet in hand, Base unit in Lane 0, 3-cost enemy in Lane 0.");
        console.log("2. Play Scarlet, select Base unit.");
        console.log("3. Confirm Base unit gains Breakthrough [3-cost or less].");
        console.log("4. Attack Lane 0: Confirm damage goes to Leader.");
    };

    (manager as any).setupBT01_047_Scenario = function() {
        console.log("Setting up BT01-047 (Overfield) Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = []; p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });

        const skill = this.getCard("BT01-047");
        const anne = this.getCard("BT01-031"); // 1-cost, Base

        if (skill) p0.hand.push(skill);
        if (anne) p0.unitZones[0].unit = anne;

        this.renderCallback();
        console.log("1. Skill in hand, Anne (1-cost Base) on field.");
        console.log("2. Play skill, select Anne.");
        console.log("3. Confirm Anne Hit becomes 2.");
    };

    (manager as any).setupBT01_048_Scenario = function() {
        console.log("Setting up BT01-048 (Companions) Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = []; p0.unitZones.forEach((z: any) => { z.unit = (z.unit ? z.unit : this.getCard("BT01-031") || null) });

        const skill = this.getCard("BT01-048");
        if (skill) p0.hand.push(skill);

        this.renderCallback();
        console.log("1. Skill in hand, some units on field.");
        console.log("2. Play skill. Confirm all units power +500.");
        console.log("3. Verify buff lasts until end of opponent's turn.");
    };

    (manager as any).setupBT01_049_Scenario = function() {
        console.log("Setting up BT01-049 (Dessert Time) Scenario...");
        const p0 = this.game.state.players[0];
        p0.hand = []; p0.unitZones.forEach((z: any) => { z.unit = null; });
        const skill = this.getCard("BT01-049");
        const b1 = this.getCard("BT01-031");
        const b2 = this.getCard("BT01-031");
        if (skill) p0.hand.push(skill);
        if (b1) p0.unitZones[0].unit = b1;
        if (b2) p0.unitZones[1].unit = b2;
        this.renderCallback();
        console.log("1. Skill in hand, 2 Base units on field.");
        console.log("2. Play skill. Confirm you draw 2 cards.");
    };

    (manager as any).setupBT01_050_Scenario = function() {
        console.log("Setting up BT01-050 (Ice Festival) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = this.getCard("BT01-031") || null; });
        const skill = this.getCard("BT01-050");
        if (skill) p0.hand = [skill];
        this.renderCallback();
        console.log("1. Skill in hand, 3 units on field (Frontline active).");
        console.log("2. Play skill. Confirm all units power +1500.");
    };

    (manager as any).setupBT01_051_Scenario = function() {
        console.log("Setting up BT01-051 (VIP Gift) Scenario...");
        const p0 = this.game.state.players[0];
        p0.deck = []; p0.hand = [];
        const skill = this.getCard("BT01-051");
        const low = this.getCard("BT01-031"); // 1-cost
        const high = this.getCard("BT01-040"); // 6-cost
        if (skill) p0.hand.push(skill);
        if (low) { p0.deck.push(low); p0.deck.push(low); }
        if (high) p0.deck.push(high);
        this.renderCallback();
        console.log("1. Play VIP Gift. Takes low-cost cards, shuffles high back.");
    };

    (manager as any).setupBT01_051_Trigger_Scenario = function() {
        console.log("Setting up BT01-051 Trigger Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.deck = []; p1.unitZones[0].unit = this.getCard("BT01-031") || null; // 1-cost
        const skill = this.getCard("BT01-051");
        if (skill) p0.deck.push(skill);
        this.renderCallback();
        console.log("1. Skill on top of P0 deck. Opponent has 1-cost unit.");
        console.log("2. Run window.debug.dealDamage(0, 1).");
        console.log("3. Confirm opponent unit is trashed.");
    };

    (manager as any).setupBT01_052_Scenario = function() {
        console.log("Setting up BT01-052 (Prayer) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; });
        const skill = this.getCard("BT01-052");
        const base = this.getCard("BT01-031");
        if (skill) p0.hand = [skill];
        if (base) { p0.unitZones[0].unit = base; p0.unitZones[1].unit = base; }
        this.renderCallback();
        console.log("1. Skill in hand, 2 Base units on field.");
        console.log("2. Play skill. Confirm both Base units Hit+1.");
    };

    (manager as any).setupBT01_053_Scenario = function() {
        console.log("Setting up BT01-053 (Protector) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; });
        p1.unitZones.forEach((z: any) => { z.unit = null; });

        const unit = this.getCard("BT01-031");
        const item = this.getCard("BT01-053");
        const low = this.getCard("BT01-031"); // 1-cost
        const high = this.getCard("ST03-011"); // 7-cost

        if (unit) p0.unitZones[0].unit = unit;
        if (item) p0.hand = [item];
        if (low) p1.unitZones[0].unit = low;
        if (high) p1.unitZones[1].unit = high;

        this.renderCallback();
        console.log("1. Unit on field, Protector in hand. Enemy has 1-cost and 7-cost.");
        console.log("2. Equip Protector. Attack Lane 0: Breakthrough (Damage to Leader).");
        console.log("3. Attack Lane 1: Block allowed.");
    };

    (manager as any).setupBT01_054_Scenario = function() {
        console.log("Setting up BT01-054 (Sword) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => { z.unit = null; z.items = []; });
        const unit = this.getCard("BT01-031");
        const item = this.getCard("BT01-054");
        if (unit) p0.unitZones[0].unit = unit;
        if (item) p0.hand = [item];
        this.renderCallback();
        console.log("1. Equip Sword. Confirm power +5000.");
    };

    (manager as any).setupBT01_055_Scenario = function() {
        console.log("Setting up BT01-055 (Cinderella Leader) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        this.setLeader(0, "BT01-055");
        p0.leaderLevel = 5;
        this.game.checkAwakening(0);

        const unit5 = this.getCard("BT01-069"); // 5-cost
        if (unit5) p0.unitZones[0].unit = unit5;
        if (unit5) p0.unitZones[1].unit = unit5;
        if (unit5) p0.unitZones[2].unit = unit5;

        if (unit5) p1.unitZones[0].unit = unit5;
        if (unit5) p1.unitZones[1].unit = unit5;
        if (unit5) p1.unitZones[2].unit = unit5;

        p0.hand = [];
        this.renderCallback();
        console.log("1. P0 is Level 5 Cinderella (Awakened).");
        console.log("2. Units (5-cost) are on both fields.");
        console.log("3. Trash P1's unit: Confirm P0 does NOT draw.");
        console.log("4. Trash P0's unit: Confirm P0 DOES draw (once per turn).");
    };

    (manager as any).setupBT01_058_Scenario = function() {
        console.log("Setting up BT01-058 (Maiden-Secret Nurse) Scenario...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        p0.unitZones.forEach((z: any) => z.unit = null);
        p1.unitZones.forEach((z: any) => z.unit = null);

        const attacker = this.getCard("BT01-002");
        const maiden = this.getCard("BT01-058");

        if (attacker) p1.unitZones[0].unit = attacker;
        if (maiden) p0.unitZones[0].unit = maiden;

        this.renderCallback();
        console.log("1. P1 attacks with Neon. P0 has Maiden (Defender: Terminate) in Lane 0.");
        console.log("2. Declare block with Maiden.");
        console.log("3. Confirm attack ends immediately and Maiden is trashed.");
    };

    (manager as any).setupBT01_060_Scenario = function() {
        console.log("Setting up BT01-060 (Admi) Scenario...");
        const p0 = this.game.state.players[0];
        p0.unitZones.forEach((z: any) => z.unit = null);
        p0.hand = [];

        const admi = this.getCard("BT01-060");
        const fodder = this.getCard("BT01-002");

        if (admi) p0.unitZones[0].unit = admi;
        if (fodder) p0.hand = [fodder];

        this.renderCallback();
        console.log("1. Admi on field, 1 card in hand.");
        console.log("2. Go to Attack phase and attack with Admi.");
        console.log("3. Confirm cost prompt (trash 1 hand) appears.");
        console.log("4. After paying, confirm Admi proceeds with attack.");
    };

    (manager as any).setupBT01_Storm_Combat_Utilities_Scenario = function() {
        console.log("Setting up Storm Combat Utilities (BT01-056, 058, 070)...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];

        const ether = this.getCard("BT01-056");
        const mihara = this.getCard("BT01-058");
        const miharaSecret = this.getCard("BT01-070");
        const target = this.getCard("BT01-001");

        p0.hand = [];
        if (mihara) p0.hand.push(mihara);
        if (miharaSecret) p0.hand.push(miharaSecret);
        if (ether) p0.unitZones[0].unit = ether;

        if (target) p1.unitZones[0].unit = target;

        this.renderCallback();
        console.log("1. Ether on field. Miharas in hand. Opponent has unit in Lane 0.");
        console.log("2. Use window.debug.setField(0, [null]) to trigger Ether's Exit: Buff enemy P-2000.");
        console.log("3. Play Mihara (BT01-058/070): If they block, combat terminates and they are trashed.");
    };

    (manager as any).setupBT01_Storm_Passive_Costs_Scenario = function() {
        console.log("Setting up Storm Passive Attack Costs (BT01-060, 065)...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];

        const admi = this.getCard("BT01-060");
        const maiden = this.getCard("BT01-065");
        const fodder = this.getCard("BT01-002");
        const target = this.getCard("BT01-001");

        p0.hand = fodder ? [fodder, fodder] : [];
        if (admi) p0.unitZones[0].unit = admi;
        if (maiden) p0.unitZones[1].unit = maiden;

        if (target) p1.unitZones[0].unit = target;

        this.renderCallback();
        console.log("1. Admi and Maiden on field. Fodder in hand.");
        console.log("2. Attack with either: Confirm you must trash 1 hand card to proceed.");
    };

    (manager as any).setupBT01_Storm_Board_Control_Scenario = function() {
        console.log("Setting up Storm Board Control (BT01-061, 064, 069, 075, 077)...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];

        const sakura = this.getCard("BT01-061"); // ActiveMain
        const rapunzel = this.getCard("BT01-064"); // Entry
        const dorothy = this.getCard("BT01-069"); // Entry
        const glass = this.getCard("BT01-075"); // Skill
        const shot = this.getCard("BT01-077"); // Skill

        const selfFodder = this.getCard("BT01-010");
        const handFodder = this.getCard("BT01-001"); // 1 cost
        const targetLow = this.getCard("BT01-002"); // 1 cost
        const targetHigh = this.getCard("BT01-040"); // 6 cost

        p0.hand = [];
        [rapunzel, dorothy, glass, shot, handFodder, selfFodder].forEach(c => {
            if (c) p0.hand.push(c);
        });

        if (sakura) p0.unitZones[0].unit = sakura;
        if (selfFodder) p0.unitZones[1].unit = selfFodder;

        if (targetLow) p1.unitZones[0].unit = targetLow;
        if (targetHigh) p1.unitZones[1].unit = targetHigh;

        this.renderCallback();
        console.log("1. Board control cards in hand/field. Opponent has 1-cost and 6-cost units.");
        console.log("2. Sakura: Trash self fodder, buff other unit +2000.");
        console.log("3. Rapunzel: Play vs Encounter, trash 2 from hand to destroy.");
        console.log("4. Dorothy: Play vs 1-cost Encounter, destroy it.");
        console.log("5. Glass (Skill): Trash hand card, destroy enemy with same cost.");
        console.log("6. Shot (Skill): Choose target, trash hand cards equal to target's Hit, destroy it.");
    };

    (manager as any).setupBT01_Storm_Exit_Recursion_Scenario = function() {
        console.log("Setting up Storm Exit & Recursion (BT01-066, 068, 072, 080, 081, 079)...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];

        const soda = this.getCard("BT01-066");
        const bloom = this.getCard("BT01-068");
        const modernia = this.getCard("BT01-072");
        const boots = this.getCard("BT01-081");
        const glasses = this.getCard("BT01-080");
        const parasol = this.getCard("BT01-079");

        p0.hand = [];
        if (parasol) p0.hand.push(parasol);
        if (boots) p0.hand.push(boots);
        if (glasses) p0.hand.push(glasses);

        const exit1 = this.getCard("BT01-056");
        const exit2 = this.getCard("BT01-058");
        p0.trash = [];
        if (exit1) p0.trash.push(exit1);
        if (exit2) p0.trash.push(exit2);

        if (soda) p0.unitZones[0].unit = soda;
        if (bloom) p0.unitZones[1].unit = bloom;
        if (modernia) p0.unitZones[2].unit = modernia;

        const strongUnit = this.getCard("ST02-009");
        if (strongUnit) p1.unitZones[0].unit = strongUnit; p1.unitZones[1].unit = strongUnit; p1.unitZones[2].unit = strongUnit;


        p1.hand = [];
        ["BT01-001", "BT01-002", "BT01-003"].forEach(id => {
            const c = this.getCard(id);
            if (c) p1.hand.push(c);
        });

        this.renderCallback();
        console.log("1. Exit units and recursion in hand/field. Opponent has 3 cards.");
        console.log("2. Soda Exit: Opponent discards 1.");
        console.log("3. Bloom Exit: Draw 2, trash 1.");
        console.log("4. Modernia Passive: Grant 'Exit: Draw 1' to others (try trashing Soda).");
        console.log("5. Equip Glasses/Boots: Confirm Exit draw 2 (Glasses) or Turn end return (Boots).");
        console.log("6. Parasol (Skill): Return 2 Exit units from trash to hand.");
    };

    (manager as any).setupBT01_Storm_Synergy_Scenario = function() {
        console.log("Setting up Storm Synergy (BT01-063, 067, 076)...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];
        const exia = this.getCard("BT01-063");
        const mokdan = this.getCard("BT01-067");
        const training = this.getCard("BT01-076");

        const strongFourCost = this.getCard("ST02-008");
        if (strongFourCost) p1.unitZones[1].unit = strongFourCost;

        p0.hand = [];
        if (training) p0.hand.push(training);
        if (exia) p0.unitZones[0].unit = exia;
        if (mokdan) p0.unitZones[1].unit = mokdan;

        this.renderCallback();
        console.log("1. Exia and Mokdan (Has MD) on field.");
        console.log("2. Confirm Exia buffs MD units (Mokdan) +2000.");
        console.log("3. Training (Skill): Buff MD unit +4500.");
    };

    (manager as any).setupBT01_Storm_Damage_Triggers_Scenario = function() {
        console.log("Setting up Storm Damage Triggers (BT01-071, 073, 074, 078)...");
        const p0 = this.game.state.players[0];
        const p1 = this.game.state.players[1];

        const triggers = [
            this.getCard("BT01-071"), // Return to hand
            this.getCard("BT01-073"), // Opp discard
            this.getCard("BT01-074"), // Return to hand
            this.getCard("BT01-078")  // Return exit unit from trash
        ].filter(c => c !== null) as any[];

        p0.deck = [...triggers];
        const exit1 = this.getCard("BT01-056");
        if (exit1) p0.trash.push(exit1);

        p1.hand = [];
        ["BT01-001", "BT01-002", "BT01-003"].forEach(id => {
            const c = this.getCard(id);
            if (c) p1.hand.push(c);
        });

        this.renderCallback();
        console.log("1. Triggers at top of P0 deck. Opponent has 3 cards.");
        console.log("2. Dealt damage to P0: Confirm each trigger effect.");
    };

    (manager as any).setupBT01_064_Scenario = function() {
        this.forcePhase(Phase.MAIN);
        this.setLeaderLevel(0, 10); // Ensure enough cost
        this.setLeader(0, 'BT01-028');
        this.setHand(0, ['BT01-064', 'ST02-005', 'ST02-005', 'ST02-005']); // 3 dummy cards for cost
        this.setField(1, ['BT01-044', null, null]); // Encounter unit (using BT01-044 as valid unit)
        console.log("Setup BT01-064 Scenario: Play BT01-064 and check if it requires 2 cards to trash.");
        this.renderCallback();
    };

    (manager as any).setupBT01_069_Scenario = function() {
        console.log("Setting up BT01-069 (Dorothy) Cost Limit Scenario...");
        const p0 = this.getPlayer(0);
        const p1 = this.getPlayer(1);

        // Reset
        [p0, p1].forEach(p => {
            p.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
            p.hand = [];
        });

        this.setLeaderLevel(0, 10);
        this.forcePhase(Phase.MAIN);

        // Dorothy (BT01-069) in hand
        const dorothy = this.getCard("BT01-069");
        if (dorothy) p0.hand.push(dorothy);

        // Opponent Field
        // Lane 0: 3-cost unit (BT01-017 Viper) -> Should survival
        const viper = this.getCard("BT01-017");
        if (viper) p1.unitZones[0].unit = viper;

        // Lane 1: 2-cost unit (BT01-002 Neon) -> Should be trashed
        const neon = this.getCard("BT01-002");
        if (neon) p1.unitZones[1].unit = neon;

        this.renderCallback();
        console.group("BT01-069 Scenario Ready");
        console.log("1. Opponent has Viper (3-cost) in Lane 0.");
        console.log("2. Opponent has Neon (2-cost) in Lane 1.");
        console.log("3. Play Dorothy in Lane 0: Confirm Viper SURVIVES (Cost 3 > 2).");
        console.log("4. (Undo or retry) Play Dorothy in Lane 1: Confirm Neon is TRASHED (Cost 2 <= 2).");
        console.groupEnd();
    };

    (manager as any).setupBT01_071_Scenario = function() {
        console.log("Setting up BT01-071 (Drake) Scenario...");
        const p0 = this.getPlayer(0);
        const p1 = this.getPlayer(1);

        // Reset players
        [p0, p1].forEach(p => {
            p.unitZones.forEach((z: any) => { z.unit = null; z.items = []; z.buffs = []; });
            p.hand = [];
            p.damage = [];
            p.trash = [];
        });

        this.setLeaderLevel(0, 30);
        this.forcePhase(Phase.MAIN);

        // BT01-071 (Drake) in hand
        const drake = this.getCard("BT01-071");
        if (drake) p0.hand.push(drake);

        // Friendly fodder unit on field
        const fodder = this.getCard("BT01-068"); // Neon (Friendly fodder)
        if (fodder) p0.unitZones[0].unit = fodder;

        // Ensure deck has cards to draw
        p0.deck.push(this.getCard("BT01-003")!); // Crow


        this.renderCallback();
        console.group("BT01-071 Scenario Ready");
        console.log("1. Drake in hand.");
        console.log("2. Friendly unit (Neon) on field in Lane 0.");
        console.log("3. Play Drake to Lane 1.");
        console.log("4. Confirm: Modal appears to select a friendly unit to trash.");
        console.log("5. Select Neon. Confirm Neon is trashed AND you draw a card.");
        console.groupEnd();
    };

}
