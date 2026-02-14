import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    {
        cardId: 'ST04-001',
        name: 'Leader awaken and opponent-turn buff',
        description: 'Awaken at level 4 and grant +1000 to your units during opponent turn.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('ST04-001');
            p1.levelZone.isAwakened = false;
            p1.leaderLevel = 4;
            p1.unitZones[0].unit = getCard('ST04-002');
            engine.checkAwakening(0);
            engine.state.turnPlayerIndex = 1;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const basePower = p1.unitZones[0].unit?.power ?? 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: p1.levelZone?.isAwakened === true, message: 'leader awakened' },
                { pass: actualPower >= basePower + 1000, message: 'opponent-turn buff applied' }
            ];
        }
    },
    {
        cardId: 'ST04-002',
        name: 'Vanilla unit placement',
        description: 'Smoke test for vanilla unit card.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('ST04-002')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            engine.playUnit(0, 0);
            return [{ pass: !!engine.currentPlayer.unitZones[0].unit, message: 'unit placed' }];
        }
    },
    {
        cardId: 'ST04-003',
        name: 'Guardian barrier[1] blocks adjacent attack',
        description: 'Barrier cost is paid from hand and attack is blocked.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;

            const attacker = getCard('ST04-002');
            attacker.power = 4000;
            attacker.hit = 2;
            p1.unitZones[1].unit = attacker;

            const guardian = getCard('ST04-003');
            guardian.power = 9000;
            p2.unitZones[0].unit = guardian;
            p2.hand = [getCard('ST01-002')];
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            const damageBefore = p2.damage.length;
            const handBefore = p2.hand.length;

            engine.attack(1);
            engine.resolveBlock(true);
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCostForPlayerId(0, p2.id);
            }

            return [
                { pass: p2.hand.length === handBefore - 1, message: 'barrier cost paid' },
                { pass: p2.damage.length === damageBefore, message: 'damage prevented' }
            ];
        }
    },
    {
        cardId: 'ST04-004',
        name: 'Vanilla unit placement 2',
        description: 'Smoke test for vanilla unit card.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('ST04-004')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            engine.playUnit(0, 1);
            return [{ pass: !!engine.currentPlayer.unitZones[1].unit, message: 'unit placed' }];
        }
    },
    {
        cardId: 'ST04-005',
        name: 'Entry draw 1',
        description: 'Entry effect draws one card.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST04-005')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            engine.playUnit(0, 0);
            return [{ pass: p1.hand.length === handBefore, message: 'net hand maintained after entry draw' }];
        }
    },
    {
        cardId: 'ST04-006',
        name: 'Defender +3000',
        description: 'Defender effect grants temporary power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST04-006');
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const zone = p1.unitZones[0];
            const card = zone.unit!;
            const basePower = engine.getUnitPower(zone, p1);
            engine.effectManager.processEffects('DEFENDER' as any, {
                sourceCard: card,
                player: p1,
                opponent: p2,
                unitZone: zone,
                machine: engine
            } as any);
            const boostedPower = engine.getUnitPower(zone, p1);
            return [{ pass: boostedPower >= basePower + 3000, message: 'defender buff applied' }];
        }
    },
    {
        cardId: 'ST04-007',
        name: 'Breakthrough cost >=4',
        description: 'Cost 4+ blocker cannot defend this attack.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;

            const attacker = getCard('ST04-007');
            attacker.hit = 2;
            attacker.power = 3000;
            p1.unitZones[0].unit = attacker;

            const blocker = getCard('ST01-009');
            blocker.cost = 4;
            blocker.power = 9999;
            p2.unitZones[0].unit = blocker;
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            const damageBefore = p2.damage.length;
            engine.attack(0);
            return [
                { pass: p2.damage.length === damageBefore + 2, message: 'direct damage dealt' },
                { pass: !!p2.unitZones[0].unit, message: 'blocker stayed on field (could not block)' }
            ];
        }
    },
    {
        cardId: 'ST04-008',
        name: 'Guardian barrier[2] blocks adjacent attack',
        description: 'Barrier[2] requires two hand cards.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;

            const attacker = getCard('ST04-002');
            attacker.power = 4000;
            attacker.hit = 1;
            p1.unitZones[1].unit = attacker;

            const guardian = getCard('ST04-008');
            guardian.power = 9000;
            p2.unitZones[0].unit = guardian;
            p2.hand = [getCard('ST01-002'), getCard('ST01-002')];
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            engine.attack(1);
            engine.resolveBlock(true);
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCostForPlayerId(0, p2.id);
                engine.selectCostForPlayerId(0, p2.id);
            }
            return [{ pass: p2.hand.length === 0, message: 'paid 2 cards for barrier' }];
        }
    },
    {
        cardId: 'ST04-009',
        name: 'Vanilla unit placement 3',
        description: 'Smoke test for vanilla unit card.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('ST04-009')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            engine.playUnit(0, 2);
            return [{ pass: !!engine.currentPlayer.unitZones[2].unit, message: 'unit placed' }];
        }
    },
    {
        cardId: 'ST04-010',
        name: 'Passive buffs Guardian units',
        description: 'Guardian ally gains +2000 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST04-010');
            p1.unitZones[1].unit = getCard('ST04-003');
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[1].unit?.power ?? 0;
            const actualPower = engine.getUnitPower(p1.unitZones[1], p1);
            return [{ pass: actualPower >= basePower + 2000, message: 'guardian buffed' }];
        }
    },
    {
        cardId: 'ST04-011',
        name: 'Defender +2000',
        description: 'Defender effect grants +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST04-011');
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const zone = p1.unitZones[0];
            const basePower = engine.getUnitPower(zone, p1);
            engine.effectManager.processEffects('DEFENDER' as any, {
                sourceCard: zone.unit!,
                player: p1,
                opponent: p2,
                unitZone: zone,
                machine: engine
            } as any);
            const boostedPower = engine.getUnitPower(zone, p1);
            return [{ pass: boostedPower >= basePower + 2000, message: 'defender buff applied' }];
        }
    },
    {
        cardId: 'ST04-012',
        name: 'Buff Guardian until opponent turn end',
        description: 'Skill targets Guardian and grants +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST04-012')];
            p1.unitZones[0].unit = getCard('ST04-003');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = engine.getUnitPower(p1.unitZones[0], p1);
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p1.id);
            }
            const boostedPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: boostedPower >= basePower + 2000, message: 'guardian received buff' },
                { pass: p1.unitZones[0].buffs.some(buff => buff.duration === 'OPP_TURN_END'), message: 'buff duration set to opponent turn end' }
            ];
        }
    },
    {
        cardId: 'ST04-013',
        name: 'Hit buff and trigger draw',
        description: 'Skill grants hit+1 and trigger draws after trashing itself.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST04-013')];
            p1.unitZones[0].unit = getCard('ST04-003');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const baseHit = engine.getUnitHit(p1.unitZones[0], p1);
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p1.id);
            }
            const boostedHit = engine.getUnitHit(p1.unitZones[0], p1);

            p1.hand = [];
            p1.deck = [getCard('ST01-002'), getCard('ST04-013')];
            const handBeforeTrigger = p1.hand.length;
            engine.dealDamage(p1, 1);

            return [
                { pass: boostedHit >= baseHit + 1, message: 'hit buff applied' },
                { pass: p1.hand.length === handBeforeTrigger + 1, message: 'trigger draw resolved' }
            ];
        }
    },
    {
        cardId: 'ST04-014',
        name: 'Draw 2 skill',
        description: 'Skill draws two cards.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST04-014')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            engine.playSkill(0);
            return [{ pass: p1.hand.length === handBefore + 1, message: 'net +1 hand after skill draw 2' }];
        }
    },
    {
        cardId: 'ST04-015',
        name: 'Trigger bounces lowest-cost unit and items',
        description: 'Trigger returns lowest-cost opponent unit and attached items to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.deck = [getCard('ST01-002'), getCard('ST04-015')];

            const low = getCard('ST04-002');
            low.cost = 1;
            const high = getCard('ST01-009');
            high.cost = 5;

            p2.unitZones[0].unit = low;
            p2.unitZones[0].items = [getCard('ST04-016')];
            p2.unitZones[1].unit = high;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const oppHandBefore = p2.hand.length;

            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p2.id);
            }

            return [
                { pass: p2.unitZones[0].unit === null, message: 'lowest-cost unit removed from field' },
                { pass: p2.hand.length >= oppHandBefore + 2, message: 'unit and attached item returned to hand' }
            ];
        }
    },
    {
        cardId: 'ST04-016',
        name: 'Defender item +2000',
        description: 'Item grants defender +2000 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST04-002');
            p1.unitZones[0].items = [getCard('ST04-016')];
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const zone = p1.unitZones[0];
            const basePower = engine.getUnitPower(zone, p1);
            engine.effectManager.processEffects('DEFENDER' as any, {
                sourceCard: zone.items[0],
                player: p1,
                opponent: p2,
                unitZone: zone,
                machine: engine
            } as any);
            const boostedPower = engine.getUnitPower(zone, p1);
            return [{ pass: boostedPower >= basePower + 2000, message: 'item defender buff applied' }];
        }
    },
    {
        cardId: 'ST04-017',
        name: 'Item active draw',
        description: 'Defender-host item active draws one card.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST04-017')];
            p1.deck = [getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('ST04-006');
            engine.state.phase = Phase.MAIN;
            engine.playItem(0, 0);
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            engine.activateEffect(0, 0, 0);
            return [{ pass: p1.hand.length === handBefore + 1, message: 'item active draw resolved' }];
        }
    }
];

export const ST04Module: UnifiedTestModule = {
    packId: 'ST04',
    displayName: 'ST04 Unified Tests',
    tests
};

