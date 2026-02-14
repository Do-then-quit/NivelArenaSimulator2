import { CardType } from '../../types';
import { RuleValidator } from '../../RuleValidator';
import { BT02_EFFECTS } from '../../cardEffects/bt02';
import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [];

const CARD_IDS = Object.keys(BT02_EFFECTS).sort();

for (const cardId of CARD_IDS) {
    tests.push({
        cardId,
        name: `${cardId} smoke`,
        description: `${cardId} basic play/equip/placement smoke test`,
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const card = getCard(cardId);
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;

            if (card.type === CardType.UNIT) {
                p1.hand = [card];
                return;
            }

            if (card.type === CardType.SKILL) {
                p1.hand = [card, getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
                return;
            }

            if (card.type === CardType.ITEM) {
                p1.unitZones[0].unit = getCard('BT02-070');
                p1.hand = [card];
                return;
            }

            p1.levelZone = card;
        },
        verify: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const card = getCard(cardId);

            if (card.type === CardType.UNIT) {
                engine.playUnit(0, 0);
                return [{ pass: !!p1.unitZones[0].unit, message: 'unit is placed' }];
            }

            if (card.type === CardType.SKILL) {
                engine.playSkill(0);
                return [{ pass: p1.skillZone.some(c => c.id === card.id), message: 'skill is played to skill zone' }];
            }

            if (card.type === CardType.ITEM) {
                engine.playItem(0, 0);
                return [{ pass: p1.unitZones[0].items.some(c => c.id === card.id), message: 'item is equipped' }];
            }

            return [{ pass: p1.levelZone?.id === card.id, message: 'leader set in level zone' }];
        }
    });
}

const suffixByActivation: Record<string, string> = {
    AWAKEN: 'Awaken',
    PASSIVE: 'Passive',
    ENTRY: 'Entry',
    ACTIVE: 'Active',
    ACTIVE_MAIN: 'ActiveMain',
    ATTACKER: 'Attacker',
    DAMAGE_TRIGGER: 'Trigger',
    DEFENDER: 'Defender',
    EXIT: 'Exit',
    TURN_END: 'TurnEnd',
    UNIT_TRASHED: 'Passive',
    HAND_DISCARDED: 'Passive',
};

for (const [cardId, effects] of Object.entries(BT02_EFFECTS)) {
    if (effects.length < 2) continue;
    const activations = Array.from(new Set(effects.map(effect => String(effect.activation))));

    for (const activation of activations) {
        const suffix = suffixByActivation[activation] || activation;
        tests.push({
            cardId: `${cardId}-${suffix}`,
            name: `${cardId} ${suffix} registration`,
            description: `${cardId} has independent ${activation} effect registered`,
            setup: () => { },
            verify: (_engine, getCard) => {
                const card = getCard(cardId);
                return [{
                    pass: (card.effects || []).some(effect => String(effect.activation) === activation),
                    message: `${activation} effect exists`
                }];
            }
        });
    }
}

tests.push({
    cardId: 'BT02-028-Awaken',
    name: 'Leader 028 awaken and guardian buff',
    description: 'BT02-028 awakens at level 5 and buffs guardian ally.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.levelZone = getCard('BT02-028');
        p1.levelZone.isAwakened = false;
        p1.leaderLevel = 5;
        p1.unitZones[0].unit = getCard('BT02-030');
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const basePower = p1.unitZones[0].unit?.power ?? 0;
        engine.checkAwakening(0);
        const buffedPower = engine.getUnitPower(p1.unitZones[0], p1);
        return [
            { pass: p1.levelZone?.isAwakened === true, message: 'leader awakened at level 5' },
            { pass: buffedPower >= basePower + 1000, message: 'guardian buff applied' }
        ];
    }
});

tests.push({
    cardId: 'BT02-009-Trigger',
    name: 'Trigger trash self then recover <=2 unit',
    description: 'BT02-009 trigger trashes itself and recovers one low-cost unit from trash.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-009')];
        p1.trash = [getCard('BT02-001')];
        p1.hand = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        if (engine.state.interactionMode === 'SELECT_TARGET') {
            engine.selectTrashTarget(0, p1.id);
        }
        return [
            { pass: p1.trash.some(card => card.id === 'BT02-009'), message: 'source moved to trash' },
            { pass: p1.damage.every(card => card.id !== 'BT02-009'), message: 'source removed from damage zone' },
            { pass: p1.hand.some(card => card.id === 'BT02-001'), message: 'recovery resolved' }
        ];
    }
});

tests.push({
    cardId: 'BT02-011-Trigger',
    name: 'Trigger trash self then gain level',
    description: 'BT02-011 trigger trashes itself and increases leader level.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-011')];
        p1.leaderLevel = 1;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        return [
            { pass: p1.trash.some(card => card.id === 'BT02-011'), message: 'source moved to trash' },
            { pass: p1.leaderLevel === 2, message: 'leader level increased' }
        ];
    }
});

tests.push({
    cardId: 'BT02-025-Trigger',
    name: 'Trigger trash self then recover Exit unit',
    description: 'BT02-025 trigger trashes itself and recovers Exit unit from trash.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-025')];
        p1.trash = [getCard('BT02-019')];
        p1.hand = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        if (engine.state.interactionMode === 'SELECT_TARGET') {
            engine.selectTrashTarget(0, p1.id);
        }
        return [
            { pass: p1.trash.some(card => card.id === 'BT02-025'), message: 'source moved to trash' },
            { pass: p1.hand.some(card => card.id === 'BT02-019'), message: 'exit unit recovered' }
        ];
    }
});

tests.push({
    cardId: 'BT02-036-Trigger',
    name: 'Trigger trash self then bounce lowest-cost enemy',
    description: 'BT02-036 trigger trashes itself and returns an opponent unit+items to hand.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.deck = [getCard('ST01-002'), getCard('BT02-036')];
        p2.unitZones[0].unit = getCard('ST01-002');
        p2.unitZones[0].items = [getCard('BT02-078')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.dealDamage(p1, 1);
        if (engine.state.interactionMode === 'SELECT_TARGET') {
            engine.selectZoneTargetByPlayerId(0, p2.id);
        }
        return [
            { pass: p1.trash.some(card => card.id === 'BT02-036'), message: 'source moved to trash' },
            { pass: p2.unitZones[0].unit === null, message: 'enemy unit removed from field' },
            { pass: p2.hand.some(card => card.id === 'ST01-002'), message: 'enemy unit returned to hand' }
        ];
    }
});

tests.push({
    cardId: 'BT02-041-Trigger',
    name: 'Trigger trash self then draw',
    description: 'BT02-041 trigger trashes itself and draws one card.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('BT02-041')];
        p1.hand = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        return [
            { pass: p1.trash.some(card => card.id === 'BT02-041'), message: 'source moved to trash' },
            { pass: p1.hand.length >= 1, message: 'draw resolved' }
        ];
    }
});

tests.push({
    cardId: 'BT02-043-Trigger',
    name: 'Trigger trash self then bounce lowest-cost enemy',
    description: 'BT02-043 trigger trashes itself and returns an opponent unit+items to hand.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.deck = [getCard('ST01-002'), getCard('BT02-043')];
        p2.unitZones[0].unit = getCard('ST01-002');
        p2.unitZones[0].items = [getCard('BT02-078')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.dealDamage(p1, 1);
        if (engine.state.interactionMode === 'SELECT_TARGET') {
            engine.selectZoneTargetByPlayerId(0, p2.id);
        }
        return [
            { pass: p1.trash.some(card => card.id === 'BT02-043'), message: 'source moved to trash' },
            { pass: p2.unitZones[0].unit === null, message: 'enemy unit removed from field' },
            { pass: p2.hand.some(card => card.id === 'ST01-002'), message: 'enemy unit returned to hand' }
        ];
    }
});

tests.push({
    cardId: 'BT02-057-Trigger',
    name: 'Trigger trash self then draw2-discard2',
    description: 'BT02-057 trigger trashes itself and resolves draw-then-discard.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('BT02-057')];
        p1.hand = [getCard('ST01-002'), getCard('ST01-002')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        if (engine.state.interactionMode === 'SELECT_TARGET') {
            engine.selectHandTargetByPlayerId(0, p1.id);
            engine.selectHandTargetByPlayerId(1, p1.id);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.confirmTargets();
            }
        }
        return [
            { pass: p1.trash.some(card => card.id === 'BT02-057'), message: 'source moved to trash' },
            { pass: p1.trash.length >= 3, message: 'discard aftermath resolved' }
        ];
    }
});

tests.push({
    cardId: 'BT02-063-Trigger',
    name: 'Trigger trash self then search <=1 item',
    description: 'BT02-063 trigger trashes itself and searches low-cost item from deck.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-078'), getCard('BT02-063')];
        p1.hand = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        if (engine.state.interactionMode === 'SELECT_TARGET') {
            engine.selectRevealedTarget(0);
        }
        return [
            { pass: p1.trash.some(card => card.id === 'BT02-063'), message: 'source moved to trash' },
            { pass: p1.hand.some(card => card.id === 'BT02-078'), message: 'searched item added to hand' }
        ];
    }
});

tests.push({
    cardId: 'BT02-074-Trigger',
    name: 'Trigger trash self then search <=1 item',
    description: 'BT02-074 trigger trashes itself and searches low-cost item from deck.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-078'), getCard('BT02-074')];
        p1.hand = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        if (engine.state.interactionMode === 'SELECT_TARGET') {
            engine.selectRevealedTarget(0);
        }
        return [
            { pass: p1.trash.some(card => card.id === 'BT02-074'), message: 'source moved to trash' },
            { pass: p1.hand.some(card => card.id === 'BT02-078'), message: 'searched item added to hand' }
        ];
    }
});

tests.push({
    cardId: 'BT02-048-Active',
    name: 'Active copies guardian power to ally',
    description: 'BT02-048 copies selected source power to selected ally.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.hand = [getCard('BT02-048')];
        p1.leaderLevel = 10;
        p1.unitZones[0].unit = getCard('BT02-030');
        p1.unitZones[1].unit = getCard('ST01-002');
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const sourcePower = engine.getUnitPower(p1.unitZones[0], p1);
        const before = engine.getUnitPower(p1.unitZones[1], p1);
        engine.playSkill(0);
        if (engine.state.interactionMode === 'SELECT_TARGET') {
            engine.selectZoneTargetByPlayerId(0, p1.id);
            engine.selectZoneTargetByPlayerId(1, p1.id);
            engine.confirmTargets();
        }
        const after = engine.getUnitPower(p1.unitZones[1], p1);
        return [{ pass: after >= before + sourcePower, message: 'power copied to second target' }];
    }
});

tests.push({
    cardId: 'BT02-049-Active',
    name: 'Active damages opponent and exhausts selected defenders',
    description: 'BT02-049 deals 1 damage and exhausts two selected defender units.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.hand = [getCard('BT02-049')];
        p1.leaderLevel = 10;
        p1.unitZones[0].unit = getCard('BT02-029');
        p1.unitZones[1].unit = getCard('BT02-031');
        p2.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        const damageBefore = p2.damage.length;
        engine.playSkill(0);
        if (engine.state.interactionMode === 'SELECT_TARGET') {
            engine.selectZoneTargetByPlayerId(0, p1.id);
            engine.selectZoneTargetByPlayerId(1, p1.id);
            engine.confirmTargets();
        }
        return [
            { pass: p2.damage.length === damageBefore + 1, message: 'opponent took 1 damage' },
            { pass: p1.unitZones[0].isExhausted && p1.unitZones[1].isExhausted, message: 'selected units exhausted' }
        ];
    }
});

tests.push({
    cardId: 'BT02-081-Passive',
    name: 'Passive destruction prevention by discard',
    description: 'BT02-081 prevents host destruction by discarding cards equal to host hit.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('ST01-002');
        p1.unitZones[0].items = [getCard('BT02-081')];
        p1.hand = [getCard('ST01-002')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'COMBAT');
        return [
            { pass: !!p1.unitZones[0].unit, message: 'host destruction prevented' },
            { pass: p1.hand.length === 0, message: 'discard cost paid' }
        ];
    }
});

tests.push({
    cardId: 'BT02-046-Passive',
    name: 'Passive berserk aura blocks phase end',
    description: 'BT02-046 grants berserk to opponent cost 3+ units, forcing attack before phase end.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
        p1.unitZones[0].unit = getCard('BT02-040');
        p2.unitZones[0].unit = getCard('BT02-046');
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const result = RuleValidator.canEndPhase(engine, p1);
        return [{ pass: result.valid === false, message: 'phase end blocked by berserk requirement' }];
    }
});

tests.push({
    cardId: 'BT02-055-Awaken',
    name: 'Leader 055 awaken and equipped buff',
    description: 'BT02-055 awakens at level 6 and buffs equipped allies.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.levelZone = getCard('BT02-055');
        p1.levelZone.isAwakened = false;
        p1.leaderLevel = 6;
        p1.unitZones[0].unit = getCard('BT02-070');
        p1.unitZones[0].items = [getCard('BT02-078')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const basePower = p1.unitZones[0].unit?.power ?? 0;
        engine.checkAwakening(0);
        const buffedPower = engine.getUnitPower(p1.unitZones[0], p1);
        return [
            { pass: p1.levelZone?.isAwakened === true, message: 'leader awakened at level 6' },
            { pass: buffedPower >= basePower + 1500, message: 'equipped-unit buff applied' }
        ];
    }
});

export const BT02Module: UnifiedTestModule = {
    packId: 'BT02',
    displayName: 'BT02 Unified Tests',
    tests
};

export default tests;
