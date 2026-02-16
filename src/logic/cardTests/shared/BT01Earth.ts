/**
 * BT01 Earth Attribute Unified Tests (BT01-028 to BT01-054)
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { ActivationCondition } from '../../types';

function resolveBaseTrait(getCard: (id: string) => any): string {
    const leader = getCard('BT01-028');
    const passive = leader.effects?.find((effect: any) => effect.activation === ActivationCondition.PASSIVE);
    return passive?.targets?.filters?.find((filter: any) => filter.type === 'HAS_TRAIT')?.value || '__BASE_TRAIT_MISSING__';
}

const tests: UnifiedTestCase[] = [
    // === LEADER ===
    {
        testId: 'BT01-028 Awaken',
        name: 'Awaken at level 5',
        description: 'Leader should awaken when level reaches 5.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 4;
            p1.levelZone = getCard('BT01-028');
            p1.levelZone.isAwakened = false;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel === 5, message: 'Leader reached level 5' },
                { pass: p1.levelZone?.isAwakened === true, message: 'Leader awakened' }
            ];
        }
    },
    {
        testId: 'BT01-028 PassiveBaseBuff',
        name: 'Awakened passive buffs Base units',
        description: 'Awakened leader should give +1000 power to Base trait units only.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const baseTrait = resolveBaseTrait(getCard);
            p1.leaderLevel = 6;
            p1.levelZone = getCard('BT01-028');
            p1.levelZone.isAwakened = true;

            const baseUnit = getCard('ST01-002');
            baseUnit.traits = baseTrait;
            p1.unitZones[0].unit = baseUnit;

            const normalUnit = getCard('ST01-002');
            normalUnit.traits = 'NOT_BASE';
            p1.unitZones[1].unit = normalUnit;

            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseRaw = p1.unitZones[0].unit!.power || 0;
            const normalRaw = p1.unitZones[1].unit!.power || 0;
            const basePower = engine.getUnitPower(p1.unitZones[0], p1);
            const normalPower = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: basePower === baseRaw + 1000, message: `Base unit +1000 (${basePower})` },
                { pass: normalPower === normalRaw, message: `Non-base unit unchanged (${normalPower})` }
            ];
        }
    },

    // === UNITS ===
    {
        testId: 'BT01-029',
        name: 'Entry +1000',
        description: 'On entry, this unit gains +1000 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('BT01-029')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const raw = p1.hand[0].power || 0;
            engine.playUnit(0, 0);
            const power = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: power === raw + 1000, message: `Entry buff applied (${power})` }
            ];
        }
    },
    {
        testId: 'BT01-030',
        name: 'Frontline +3000',
        description: 'Gets +3000 power while all 3 lanes have units.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-030');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const raw = p1.unitZones[0].unit!.power || 0;
            const power = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: power === raw + 3000, message: `Frontline bonus applied (${power})` }
            ];
        }
    },
    {
        testId: 'BT01-032',
        name: 'Base count scaling',
        description: 'Gets +500 power per Base trait unit on your field.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const baseTrait = resolveBaseTrait(getCard);
            p1.unitZones[0].unit = getCard('BT01-032');

            const unit1 = getCard('ST01-002');
            unit1.traits = baseTrait;
            p1.unitZones[1].unit = unit1;

            const unit2 = getCard('ST01-002');
            unit2.traits = baseTrait;
            p1.unitZones[2].unit = unit2;

            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const raw = p1.unitZones[0].unit!.power || 0;
            const power = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: power === raw + 1000, message: `2 Base units => +1000 (${power})` }
            ];
        }
    },
    {
        testId: 'BT01-033',
        name: 'Entry hit +1',
        description: 'On entry, this unit gets +1 hit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 3;
            p1.hand = [getCard('BT01-033')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const rawHit = p1.hand[0].hit || 0;
            engine.playUnit(0, 0);
            const hit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: hit === rawHit + 1, message: `Entry hit buff applied (${hit})` }
            ];
        }
    },
    {
        testId: 'BT01-034 TriggerReturnHand',
        name: 'Damage trigger return to hand',
        description: 'When revealed by damage, it should move from damage zone to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT01-034')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(card => card.id === 'BT01-034'), message: 'Card returned to hand' },
                { pass: p1.damage.every(card => card.id !== 'BT01-034'), message: 'Card removed from damage zone' }
            ];
        }
    },
    {
        testId: 'BT01-035',
        name: 'Attacker breakthrough cost<=1',
        description: 'Can bypass block against cost 1 or less encounter unit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT01-035');

            const blocker = getCard('ST01-002');
            blocker.cost = 1;
            blocker.power = 10000;
            p2.unitZones[0].unit = blocker;

            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            engine.attack(0);
            return [
                { pass: engine.state.phase !== Phase.BLOCK, message: 'Block phase skipped by breakthrough' }
            ];
        }
    },
    {
        testId: 'BT01-036',
        name: 'Passive Base +2000',
        description: 'Gives +2000 power to Base trait units.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const baseTrait = resolveBaseTrait(getCard);
            p1.unitZones[0].unit = getCard('BT01-036');

            const baseUnit = getCard('ST01-002');
            baseUnit.traits = baseTrait;
            p1.unitZones[1].unit = baseUnit;

            const normalUnit = getCard('ST01-002');
            normalUnit.traits = 'NOT_BASE';
            p1.unitZones[2].unit = normalUnit;

            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseRaw = p1.unitZones[1].unit!.power || 0;
            const normalRaw = p1.unitZones[2].unit!.power || 0;
            const basePower = engine.getUnitPower(p1.unitZones[1], p1);
            const normalPower = engine.getUnitPower(p1.unitZones[2], p1);
            return [
                { pass: basePower === baseRaw + 2000, message: `Base unit +2000 (${basePower})` },
                { pass: normalPower === normalRaw, message: `Non-base unit unchanged (${normalPower})` }
            ];
        }
    },
    {
        testId: 'BT01-037',
        name: 'Frontline hit +1',
        description: 'Gets +1 hit while all 3 lanes have units.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-037');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const rawHit = p1.unitZones[0].unit!.hit || 0;
            const hit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: hit === rawHit + 1, message: `Frontline hit bonus applied (${hit})` }
            ];
        }
    },
    {
        testId: 'BT01-038 ActiveDiscardBuff',
        name: 'Active: discard 1, target +4000',
        description: 'Active effect discards 1 hand card and gives +4000 to one friendly unit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('BT01-038');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = engine.getUnitPower(p1.unitZones[1], p1);
            const handBefore = p1.hand.length;
            const trashBefore = p1.trash.length;

            engine.activateEffect(0, 0);
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCost(0);
            }
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(1, false);
            }

            const newPower = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: newPower === basePower + 4000, message: `Target unit +4000 (${newPower})` },
                { pass: p1.hand.length === handBefore - 1, message: `Discarded 1 card (hand ${p1.hand.length})` },
                { pass: p1.trash.length === trashBefore + 1, message: `Cost card moved to trash (${p1.trash.length})` }
            ];
        }
    },
    {
        testId: 'BT01-039',
        name: 'Entry +3000',
        description: 'On entry, this unit gains +3000 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-039')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const raw = p1.hand[0].power || 0;
            engine.playUnit(0, 0);
            const power = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: power === raw + 3000, message: `Entry buff applied (${power})` }
            ];
        }
    },
    {
        testId: 'BT01-040 PassivePowerScale',
        name: 'Passive: leader level x500 power',
        description: 'Gets +500 power per leader level.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 8;
            p1.unitZones[0].unit = getCard('BT01-040');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const raw = p1.unitZones[0].unit!.power || 0;
            const power = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: power === raw + 4000, message: `Level 8 => +4000 (${power})` }
            ];
        }
    },
    {
        testId: 'BT01-040 PassiveLevelLink',
        name: 'Passive: level link hit +1',
        description: 'At leader level 10, this unit gets +1 hit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('BT01-040');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const rawHit = p1.unitZones[0].unit!.hit || 0;
            const hit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: hit === rawHit + 1, message: `Level link hit bonus applied (${hit})` }
            ];
        }
    },
    {
        testId: 'BT01-041',
        name: 'Entry target +2000',
        description: 'On entry, choose one friendly unit and give it +2000 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-041')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = engine.getUnitPower(p1.unitZones[1], p1);
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(1, false);
            }
            const newPower = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: newPower === basePower + 2000, message: `Selected unit +2000 (${newPower})` }
            ];
        }
    },
    {
        testId: 'BT01-044 EntryRevealBase',
        name: 'Entry reveal 3 and pick Base',
        description: 'Reveals top 3 cards and adds one Base trait unit to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const baseTrait = resolveBaseTrait(getCard);
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-044')];

            const nonBase1 = getCard('ST01-002');
            nonBase1.traits = 'NOT_BASE';
            const baseCard = getCard('ST01-002');
            baseCard.traits = baseTrait;
            const nonBase2 = getCard('ST01-002');
            nonBase2.traits = 'NOT_BASE';

            p1.deck = [nonBase1, baseCard, nonBase2];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const baseTrait = resolveBaseTrait(getCard);
            const handBefore = p1.hand.length;

            engine.playUnit(0, 0);
            const baseIndex = engine.state.revealedCards.findIndex(card => (card.traits || '').includes(baseTrait));
            if (engine.state.interactionMode === 'SELECT_TARGET' && baseIndex >= 0) {
                engine.selectRevealedTarget(baseIndex);
            }

            return [
                { pass: p1.hand.length === handBefore, message: `Net hand size unchanged after pick (${p1.hand.length})` },
                { pass: p1.hand.some(card => (card.traits || '').includes(baseTrait)), message: 'Picked Base card to hand' },
                { pass: engine.state.revealedCards.length === 0, message: 'Revealed cards resolved' }
            ];
        }
    },
    {
        testId: 'BT01-044 TriggerGainLevel',
        name: 'Damage trigger gain level',
        description: 'When triggered from damage, gain +1 leader level.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 4;
            p1.deck = [getCard('ST01-002'), getCard('BT01-044')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const levelBefore = p1.leaderLevel;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.leaderLevel === levelBefore + 1, message: `Leader level +1 (${p1.leaderLevel})` }
            ];
        }
    },
    {
        testId: 'BT01-044 TriggerTrashSelf',
        name: 'Damage trigger trashes self',
        description: 'After trigger resolves, this card should leave damage zone and go to trash.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 4;
            p1.deck = [getCard('ST01-002'), getCard('BT01-044')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.trash.some(card => card.id === 'BT01-044'), message: 'Card moved to trash' },
                { pass: p1.damage.every(card => card.id !== 'BT01-044'), message: 'Card removed from damage zone' }
            ];
        }
    },
    {
        testId: 'BT01-045',
        name: 'Passive cost 1 units +2000',
        description: 'Gives +2000 power to all friendly cost-1 units.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT01-045');

            const cost1 = getCard('ST01-002');
            cost1.cost = 1;
            p1.unitZones[1].unit = cost1;

            const cost2 = getCard('ST01-002');
            cost2.cost = 2;
            p1.unitZones[2].unit = cost2;

            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const raw1 = p1.unitZones[1].unit!.power || 0;
            const raw2 = p1.unitZones[2].unit!.power || 0;
            const power1 = engine.getUnitPower(p1.unitZones[1], p1);
            const power2 = engine.getUnitPower(p1.unitZones[2], p1);
            return [
                { pass: power1 === raw1 + 2000, message: `Cost-1 unit +2000 (${power1})` },
                { pass: power2 === raw2, message: `Cost-2 unit unchanged (${power2})` }
            ];
        }
    },
    {
        testId: 'BT01-046 EntryGrantBreakthrough',
        name: 'Entry grants breakthrough cost<=3',
        description: 'On entry, choose a Base unit; it gains breakthrough[3] for this turn.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const baseTrait = resolveBaseTrait(getCard);

            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-046')];

            const target = getCard('ST01-002');
            target.traits = baseTrait;
            target.power = 5000;
            p1.unitZones[1].unit = target;

            const blocker = getCard('ST01-002');
            blocker.cost = 3;
            blocker.power = 10000;
            p2.unitZones[1].unit = blocker;
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];

            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const damageBefore = p2.damage.length;

            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(1, false);
            }

            engine.state.phase = Phase.ATTACK;
            engine.attack(1);
            engine.resolveBlock(true);

            return [
                { pass: (engine.state.phase as Phase) !== Phase.BLOCK, message: 'Breakthrough skipped block phase' },
                { pass: p2.damage.length > damageBefore, message: `Direct damage dealt (${p2.damage.length})` }
            ];
        }
    },
    {
        testId: 'BT01-046 TriggerReturnHand',
        name: 'Damage trigger return to hand',
        description: 'When revealed by damage, this card should return to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT01-046')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(card => card.id === 'BT01-046'), message: 'Card returned to hand' },
                { pass: p1.damage.every(card => card.id !== 'BT01-046'), message: 'Card removed from damage zone' }
            ];
        }
    },

    // === SKILLS ===
    {
        testId: 'BT01-047',
        name: 'Set hit to 2',
        description: 'Sets selected cost-1 Base unit hit to 2.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const baseTrait = resolveBaseTrait(getCard);
            p1.leaderLevel = 10;

            const baseUnit = getCard('ST01-002');
            baseUnit.cost = 1;
            baseUnit.traits = baseTrait;
            p1.unitZones[0].unit = baseUnit;

            p1.hand = [getCard('BT01-047')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, false);
            }
            const hit = engine.getUnitHit(p1.unitZones[0], p1);
            return [
                { pass: hit === 2, message: `Hit set to 2 (${hit})` }
            ];
        }
    },
    {
        testId: 'BT01-048',
        name: 'All friendly units +500',
        description: 'Current friendly field units gain +500 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.hand = [getCard('BT01-048')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base0 = engine.getUnitPower(p1.unitZones[0], p1);
            const base1 = engine.getUnitPower(p1.unitZones[1], p1);
            engine.playSkill(0);
            const power0 = engine.getUnitPower(p1.unitZones[0], p1);
            const power1 = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: power0 === base0 + 500, message: `Lane 0 +500 (${power0})` },
                { pass: power1 === base1 + 500, message: `Lane 1 +500 (${power1})` }
            ];
        }
    },
    {
        testId: 'BT01-049',
        name: 'Draw by Base count',
        description: 'Draw cards equal to your Base unit count.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const baseTrait = resolveBaseTrait(getCard);
            p1.leaderLevel = 10;

            const unit1 = getCard('ST01-002');
            unit1.traits = baseTrait;
            p1.unitZones[0].unit = unit1;

            const unit2 = getCard('ST01-002');
            unit2.traits = baseTrait;
            p1.unitZones[1].unit = unit2;

            p1.hand = [getCard('BT01-049')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            engine.playSkill(0);
            return [
                { pass: p1.hand.length === handBefore + 1, message: `Net hand +1 after draw 2 and play skill (${p1.hand.length})` }
            ];
        }
    },
    {
        testId: 'BT01-050',
        name: 'Frontline all +1500',
        description: 'If all 3 lanes are occupied, all current friendly units gain +1500.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('ST01-002');
            p1.hand = [getCard('BT01-050')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base0 = engine.getUnitPower(p1.unitZones[0], p1);
            const base1 = engine.getUnitPower(p1.unitZones[1], p1);
            const base2 = engine.getUnitPower(p1.unitZones[2], p1);
            engine.playSkill(0);
            const power0 = engine.getUnitPower(p1.unitZones[0], p1);
            const power1 = engine.getUnitPower(p1.unitZones[1], p1);
            const power2 = engine.getUnitPower(p1.unitZones[2], p1);
            return [
                { pass: power0 === base0 + 1500, message: `Lane 0 +1500 (${power0})` },
                { pass: power1 === base1 + 1500, message: `Lane 1 +1500 (${power1})` },
                { pass: power2 === base2 + 1500, message: `Lane 2 +1500 (${power2})` }
            ];
        }
    },
    {
        testId: 'BT01-051 ActiveRevealTakeAll',
        name: 'Reveal 3 and take all cost<=3',
        description: 'Reveal top 3 cards and add all cost 3 or lower cards to hand.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT01-051')];

            const lowCost1 = getCard('BT01-029');
            lowCost1.cost = 1;
            const lowCost2 = getCard('ST01-002');
            lowCost2.cost = 1;
            const highCost = getCard('BT01-046');
            highCost.cost = 8;

            p1.deck = [highCost, lowCost1, lowCost2];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.confirmTargets();
            }
            return [
                { pass: p1.hand.some(card => card.id === 'BT01-029'), message: 'Cost<=3 card #1 taken to hand' },
                { pass: p1.hand.some(card => card.id === 'ST01-002'), message: 'Cost<=3 card #2 taken to hand' },
                { pass: !p1.hand.some(card => card.id === 'BT01-046'), message: 'High-cost card not added to hand' },
                { pass: p1.deck.some(card => card.id === 'BT01-046'), message: 'High-cost card returned to deck' }
            ];
        }
    },
    {
        testId: 'BT01-051 TriggerDestroyCost3OrLess',
        name: 'Damage trigger destroy enemy cost<=3',
        description: 'When triggered from damage, destroys one opponent unit with cost 3 or lower.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT01-051')];

            const target = getCard('ST01-002');
            target.cost = 3;
            p2.unitZones[0].unit = target;

            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, true);
            }
            return [
                { pass: p2.unitZones[0].unit === null, message: 'Opponent cost<=3 unit destroyed' }
            ];
        }
    },
    {
        testId: 'BT01-051 TriggerTrashSelf',
        name: 'Damage trigger trashes self',
        description: 'After trigger resolves, this card should leave damage zone and go to trash.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT01-051')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.trash.some(card => card.id === 'BT01-051'), message: 'Card moved to trash' },
                { pass: p1.damage.every(card => card.id !== 'BT01-051'), message: 'Card removed from damage zone' }
            ];
        }
    },
    {
        testId: 'BT01-052',
        name: 'Base hit +1',
        description: 'All current Base trait friendly units gain +1 hit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const baseTrait = resolveBaseTrait(getCard);
            p1.leaderLevel = 10;

            const baseUnit = getCard('ST01-002');
            baseUnit.traits = baseTrait;
            p1.unitZones[0].unit = baseUnit;

            const normalUnit = getCard('ST01-002');
            normalUnit.traits = 'NOT_BASE';
            p1.unitZones[1].unit = normalUnit;

            p1.hand = [getCard('BT01-052')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const baseHit = engine.getUnitHit(p1.unitZones[0], p1);
            const normalHit = engine.getUnitHit(p1.unitZones[1], p1);
            engine.playSkill(0);
            const newBaseHit = engine.getUnitHit(p1.unitZones[0], p1);
            const newNormalHit = engine.getUnitHit(p1.unitZones[1], p1);
            return [
                { pass: newBaseHit === baseHit + 1, message: `Base unit hit +1 (${newBaseHit})` },
                { pass: newNormalHit === normalHit, message: `Non-base unit hit unchanged (${newNormalHit})` }
            ];
        }
    },

    // === ITEMS ===
    {
        testId: 'BT01-053',
        name: 'Breakthrough cost<=2',
        description: 'Equipped unit can bypass block against cost 2 or lower encounter unit.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT01-053')];

            const blocker = getCard('ST01-002');
            blocker.cost = 2;
            blocker.power = 10000;
            p2.unitZones[0].unit = blocker;

            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            engine.attack(0);
            return [
                { pass: engine.state.phase !== Phase.BLOCK, message: 'Block phase skipped by item breakthrough' }
            ];
        }
    },
    {
        testId: 'BT01-054',
        name: 'Passive +5000 power',
        description: 'Equipped unit gets +5000 power.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT01-054')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const raw = p1.unitZones[0].unit!.power || 0;
            const power = engine.getUnitPower(p1.unitZones[0], p1);
            return [
                { pass: power === raw + 5000, message: `Power +5000 applied (${power})` }
            ];
        }
    }
];

export const BT01EarthModule: UnifiedTestModule = {
    packId: 'BT01?€ì§€',
    displayName: 'BT01 ?€ì§€ (Earth)',
    tests
};

export default tests;


