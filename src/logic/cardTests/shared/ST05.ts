import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    {
        cardId: 'ST05-001',
        name: 'Leader awaken and armed buff',
        description: 'Awaken at level 5 and buff your armed units.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('ST05-001');
            p1.levelZone.isAwakened = false;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST05-005');
            engine.checkAwakening(0);
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const basePower = p1.unitZones[0].unit?.power ?? 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: p1.levelZone?.isAwakened === true, message: 'leader awakened' },
                { pass: actualPower >= basePower + 1000, message: 'armed buff applied' }
            ];
        }
    },
    {
        cardId: 'ST05-001-Awaken',
        name: 'Leader awaken only',
        description: 'Checks only the awaken condition at leader level 5.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('ST05-001');
            p1.levelZone.isAwakened = false;
            p1.leaderLevel = 5;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.checkAwakening(0);
            return [{ pass: p1.levelZone?.isAwakened === true, message: 'leader awakened at level 5' }];
        }
    },
    {
        cardId: 'ST05-001-Passive',
        name: 'Leader armed passive only',
        description: 'Checks only the armed-unit +1000 passive while awakened.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('ST05-001');
            p1.levelZone.isAwakened = true;
            p1.unitZones[0].unit = getCard('ST05-005');
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const basePower = p1.unitZones[0].unit?.power ?? 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [{ pass: actualPower >= basePower + 1000, message: 'armed passive buff applied' }];
        }
    },
    {
        cardId: 'ST05-002',
        name: 'Vanilla unit placement',
        description: 'Smoke test for vanilla unit card.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('ST05-002')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            engine.playUnit(0, 0);
            return [{ pass: !!engine.currentPlayer.unitZones[0].unit, message: 'unit placed' }];
        }
    },
    {
        cardId: 'ST05-003',
        name: 'Entry draw 1 then discard 1 from hand',
        description: 'Entry effect draws and discards from hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST05-003'), getCard('ST01-002')];
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            const trashBefore = p1.trash.length;

            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTargetByPlayerId(0, p1.id);
            }

            return [
                { pass: p1.hand.length === handBefore - 1, message: 'net hand -1 after unit play' },
                { pass: p1.trash.length === trashBefore + 1, message: 'one card discarded from hand' }
            ];
        }
    },
    {
        cardId: 'ST05-004',
        name: 'Vanilla unit placement 2',
        description: 'Smoke test for vanilla unit card.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('ST05-004')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            engine.playUnit(0, 1);
            return [{ pass: !!engine.currentPlayer.unitZones[1].unit, message: 'unit placed' }];
        }
    },
    {
        cardId: 'ST05-005',
        name: 'Armed power +1000 while equipped',
        description: 'Passive gets +1000 with an equipped item.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST05-005');
            p1.unitZones[0].items = [getCard('ST05-016')];
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit?.power ?? 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [{ pass: actualPower >= basePower + 1000, message: 'armed bonus applied' }];
        }
    },
    {
        cardId: 'ST05-006',
        name: 'Entry deck search for cost 2 item',
        description: 'Entry searches deck and adds selected cost 2 item to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST05-006')];
            p1.deck = [getCard('ST01-002'), getCard('ST05-017'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectRevealedTarget(0);
            }

            return [
                { pass: p1.hand.some(card => card.id.startsWith('ST05-017')), message: 'searched item added to hand' },
                { pass: engine.state.revealedCards.length === 0, message: 'revealed cards cleared' }
            ];
        }
    },
    {
        cardId: 'ST05-006-Entry',
        name: 'Entry search cost 2 item only',
        description: 'Checks ENTRY deck search for one cost 2 item.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST05-006')];
            p1.deck = [getCard('ST01-002'), getCard('ST05-017'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectRevealedTarget(0);
            }
            return [
                { pass: p1.hand.some(card => card.id.startsWith('ST05-017')), message: 'cost 2 item searched to hand' },
                { pass: engine.state.revealedCards.length === 0, message: 'revealed pool cleared after pick' }
            ];
        }
    },
    {
        cardId: 'ST05-006-Trigger',
        name: 'Trigger trash self and search <=1 item only',
        description: 'Damage trigger trashes ST05-006 then searches deck for cost 1 or less item.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [];
            p1.deck = [getCard('ST05-017'), getCard('ST05-015'), getCard('ST05-006')];
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectRevealedTarget(0);
            }
            return [
                { pass: p1.trash.some(card => card.id.startsWith('ST05-006')), message: 'source moved to trash' },
                { pass: p1.hand.some(card => card.id.startsWith('ST05-015')), message: 'cost 1 item searched to hand' }
            ];
        }
    },
    {
        cardId: 'ST05-007',
        name: 'Armed scales with equipped item count',
        description: 'Passive gains +1000 per equipped item.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST05-007');
            p1.unitZones[0].items = [getCard('ST05-016'), getCard('ST05-016')];
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit?.power ?? 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [{ pass: actualPower >= basePower + 2000, message: 'item-count scaling applied' }];
        }
    },
    {
        cardId: 'ST05-008',
        name: 'Passive buffs all armed allies',
        description: 'Armed ally gets +1000 from passive aura.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST05-008');
            p1.unitZones[1].unit = getCard('ST05-005');
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[1].unit?.power ?? 0;
            const actualPower = engine.getUnitPower(p1.unitZones[1], p1);
            return [{ pass: actualPower >= basePower + 1000, message: 'armed ally buffed' }];
        }
    },
    {
        cardId: 'ST05-009',
        name: 'Vanilla unit placement 3',
        description: 'Smoke test for vanilla unit card.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('ST05-009')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            engine.playUnit(0, 2);
            return [{ pass: !!engine.currentPlayer.unitZones[2].unit, message: 'unit placed' }];
        }
    },
    {
        cardId: 'ST05-010',
        name: 'Armed power +2000 while equipped',
        description: 'Passive gets +2000 with an equipped item.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST05-010');
            p1.unitZones[0].items = [getCard('ST05-016')];
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit?.power ?? 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [{ pass: actualPower >= basePower + 2000, message: 'armed +2000 applied' }];
        }
    },
    {
        cardId: 'ST05-011',
        name: 'Armed attacker forces opponent discard',
        description: 'Attacker effect discards one opponent hand card when equipped.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST05-011');
            p1.unitZones[0].items = [getCard('ST05-015')];
            p2.hand = [getCard('ST01-002'), getCard('ST01-002')];
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const zone = p1.unitZones[0];
            const handBefore = p2.hand.length;

            engine.effectManager.processEffects('ATTACKER' as any, {
                sourceCard: zone.unit!,
                player: p1,
                opponent: p2,
                unitZone: zone,
                machine: engine
            } as any);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTargetByPlayerId(0, p2.id);
            }

            return [{ pass: p2.hand.length === handBefore - 1, message: 'opponent discarded one card' }];
        }
    },
    {
        cardId: 'ST05-011-Attacker',
        name: 'Attacker discard effect only',
        description: 'Checks ATTACKER discard effect when host is equipped.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST05-011');
            p1.unitZones[0].items = [getCard('ST05-015')];
            p2.hand = [getCard('ST01-002'), getCard('ST01-002')];
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const zone = p1.unitZones[0];
            const handBefore = p2.hand.length;
            engine.effectManager.processEffects('ATTACKER' as any, {
                sourceCard: zone.unit!,
                player: p1,
                opponent: p2,
                unitZone: zone,
                machine: engine
            } as any);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTargetByPlayerId(0, p2.id);
            }
            return [{ pass: p2.hand.length === handBefore - 1, message: 'attacker effect discarded one opponent card' }];
        }
    },
    {
        cardId: 'ST05-011-Trigger',
        name: 'Trigger return-to-hand only',
        description: 'Damage trigger returns ST05-011 from damage zone to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [];
            p1.deck = [getCard('ST01-002'), getCard('ST05-011')];
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.length === handBefore + 1, message: 'source returned to hand' },
                { pass: p1.hand.some(card => card.id.startsWith('ST05-011')), message: 'hand contains ST05-011' },
                { pass: !p1.damage.some(card => card.id.startsWith('ST05-011')), message: 'source removed from damage zone' }
            ];
        }
    },
    {
        cardId: 'ST05-012',
        name: 'Active recovers item from trash',
        description: 'Active selects item in own trash and returns it to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST05-012')];
            p1.trash = [getCard('ST05-015')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTrashTarget(0, p1.id);
            }
            return [
                { pass: p1.hand.some(card => card.id.startsWith('ST05-015')), message: 'item recovered to hand' },
                { pass: p1.trash.length === 0, message: 'item removed from trash' }
            ];
        }
    },
    {
        cardId: 'ST05-012-Active',
        name: 'Active trash item recovery only',
        description: 'Checks ACTIVE recovery of one item from own trash.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST05-012')];
            p1.trash = [getCard('ST05-015')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTrashTarget(0, p1.id);
            }
            return [
                { pass: p1.hand.some(card => card.id.startsWith('ST05-015')), message: 'item recovered from trash to hand' },
                { pass: p1.trash.length === 0, message: 'selected trash item removed' }
            ];
        }
    },
    {
        cardId: 'ST05-012-Trigger',
        name: 'Trigger trash self and search <=1 item only',
        description: 'Damage trigger trashes ST05-012 then searches deck for cost 1 or less item.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [];
            p1.deck = [getCard('ST05-017'), getCard('ST05-015'), getCard('ST05-012')];
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectRevealedTarget(0);
            }
            return [
                { pass: p1.trash.some(card => card.id.startsWith('ST05-012')), message: 'source moved to trash' },
                { pass: p1.hand.some(card => card.id.startsWith('ST05-015')), message: 'cost 1 item searched to hand' }
            ];
        }
    },
    {
        cardId: 'ST05-013',
        name: 'Draw by equipped item count',
        description: 'Draws cards equal to equipped item count (cost 1+).',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST05-013')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('ST05-005');
            p1.unitZones[0].items = [getCard('ST05-015'), getCard('ST05-017')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            const handBeforeTarget = p1.hand.length;
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p1.id);
            }
            return [{ pass: p1.hand.length === handBeforeTarget + 2, message: 'drew two cards from equipped count' }];
        }
    },
    {
        cardId: 'ST05-014',
        name: 'Destroy own equipped unit then opponent unit',
        description: 'Selects own unit with 2+ items, destroys it, then destroys opponent unit.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST05-014')];
            p1.unitZones[0].unit = getCard('ST05-005');
            p1.unitZones[0].items = [getCard('ST05-015'), getCard('ST05-017')];
            p2.unitZones[1].unit = getCard('ST05-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p1.id);
            }
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(1, p2.id);
            }
            return [
                { pass: p1.unitZones[0].unit === null, message: 'own selected unit destroyed' },
                { pass: p2.unitZones[1].unit === null, message: 'opponent selected unit destroyed' }
            ];
        }
    },
    {
        cardId: 'ST05-014-Active',
        name: 'Active destroy own then opponent only',
        description: 'Checks ACTIVE flow: destroy own 2+ equipped unit, then destroy opponent unit.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST05-014')];
            p1.unitZones[0].unit = getCard('ST05-005');
            p1.unitZones[0].items = [getCard('ST05-015'), getCard('ST05-017')];
            p2.unitZones[1].unit = getCard('ST05-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p1.id);
            }
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(1, p2.id);
            }
            return [
                { pass: p1.unitZones[0].unit === null, message: 'own selected unit destroyed' },
                { pass: p2.unitZones[1].unit === null, message: 'opponent selected unit destroyed' }
            ];
        }
    },
    {
        cardId: 'ST05-014-Trigger',
        name: 'Trigger trash self and draw2-discard2 hand only',
        description: 'Damage trigger trashes ST05-014, draws 2, then discards 2 from hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('ST01-002'), getCard('ST01-002')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST05-014')];
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectHandTargetByPlayerId(0, p1.id);
                engine.selectHandTargetByPlayerId(1, p1.id);
                if (engine.state.interactionMode === 'SELECT_TARGET') {
                    engine.confirmTargets();
                }
            }
            return [
                { pass: p1.trash.some(card => card.id.startsWith('ST05-014')), message: 'source moved to trash' },
                { pass: p1.hand.length === handBefore, message: 'draw2 discard2 from hand resolved (net 0)' },
                { pass: p1.trash.length >= 3, message: 'trash includes source plus two discarded cards' }
            ];
        }
    },
    {
        cardId: 'ST05-015',
        name: 'Item passive +1500 power',
        description: 'Equipped item grants +1500 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST05-002');
            p1.unitZones[0].items = [getCard('ST05-015')];
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit?.power ?? 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [{ pass: actualPower >= basePower + 1500, message: 'item +1500 applied' }];
        }
    },
    {
        cardId: 'ST05-016',
        name: 'Item grants +1 hit to armed host',
        description: 'Host with armed keyword gains +1 hit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST05-005');
            p1.unitZones[0].items = [getCard('ST05-016')];
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseHit = p1.unitZones[0].unit?.hit ?? 0;
            const actualHit = engine.getUnitHit(p1.unitZones[0], p1);
            return [{ pass: actualHit >= baseHit + 1, message: 'host hit increased by item' }];
        }
    },
    {
        cardId: 'ST05-017',
        name: 'Item passive +2500 power',
        description: 'Equipped item grants +2500 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST05-002');
            p1.unitZones[0].items = [getCard('ST05-017')];
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit?.power ?? 0;
            const actualPower = engine.getUnitPower(p1.unitZones[0], p1);
            return [{ pass: actualPower >= basePower + 2500, message: 'item +2500 applied' }];
        }
    }
];

export const ST05Module: UnifiedTestModule = {
    packId: 'ST05',
    displayName: 'ST05 Unified Tests',
    tests
};

export default tests;

