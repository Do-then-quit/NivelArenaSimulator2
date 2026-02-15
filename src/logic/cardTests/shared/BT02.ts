import { RuleValidator } from '../../RuleValidator';
import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [];

function getBaseTraitToken(getCard: (id: string) => any): string {
    const card = getCard('BT02-010');
    return card.effects?.[0]?.action?.params?.filter?.value || 'BASE_TRAIT';
}

function getKeywordFilterValue(
    getCard: (id: string) => any,
    cardId: string,
    effectIndex: number = 0
): string[] {
    const card = getCard(cardId);
    const filters = card.effects?.[effectIndex]?.targets?.filters || [];
    const keywordFilter = filters.find((filter: any) => filter.type === 'HAS_KEYWORD');
    if (Array.isArray(keywordFilter?.value)) {
        return keywordFilter.value;
    }

    if (typeof keywordFilter?.value === 'string') {
        return [keywordFilter.value];
    }

    return ['KEYWORD'];
}

function autoResolveInteractions(engine: any, maxSteps: number = 32): void {
    const triedSelections = new Set<string>();

    for (let step = 0; step < maxSteps; step++) {
        if (engine.state.interactionMode === 'NORMAL') return;

        const actorId = engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id;
        const legal = engine.getLegalActions(actorId) as any[];
        if (!legal.length) return;

        let action: any | undefined;

        if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
            action = legal.find(candidate => candidate.type === 'RESOLVE_OPTIONAL' && candidate.confirm === true) ?? legal[0];
        } else if (engine.state.interactionMode === 'SELECT_COST') {
            action = legal.find(candidate => candidate.type === 'SELECT_COST_HAND')
                ?? legal.find(candidate => candidate.type === 'SELECT_COST')
                ?? legal[0];
        } else if (engine.state.interactionMode === 'SELECT_TARGET') {
            if (engine.state.pendingEffect?.actionType === 'TAKE_ALL_REVEALED') {
                action = legal.find(candidate => candidate.type === 'CONFIRM_TARGETS') ?? legal[0];
                if (action.type === 'CONFIRM_TARGETS') {
                    triedSelections.clear();
                }
            } else {
                const selectors = legal.filter(candidate =>
                    candidate.type === 'SELECT_ZONE_TARGET' ||
                    candidate.type === 'SELECT_HAND_TARGET' ||
                    candidate.type === 'SELECT_TRASH_TARGET' ||
                    candidate.type === 'SELECT_REVEALED_TARGET'
                );

                action = selectors.find(candidate => !triedSelections.has(JSON.stringify(candidate)));
                if (action) {
                    triedSelections.add(JSON.stringify(action));
                } else {
                    action = legal.find(candidate => candidate.type === 'CONFIRM_TARGETS') ?? legal[0];
                    if (action.type === 'CONFIRM_TARGETS') {
                        triedSelections.clear();
                    }
                }
            }
        } else {
            action = legal[0];
        }

        if (!action) return;
        const ok = engine.step(action);
        if (!ok) return;
    }
}

function processAttackerEffects(engine: any, playerIndex: number, zoneIndex: number): void {
    const player = engine.state.players[playerIndex];
    const opponent = engine.state.players[1 - playerIndex];
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return;

    engine.effectManager.processEffects('ATTACKER' as any, {
        sourceCard: zone.unit,
        player,
        opponent,
        unitZone: zone,
        machine: engine
    } as any);

    zone.items.forEach((item: any) => {
        engine.effectManager.processEffects('ATTACKER' as any, {
            sourceCard: item,
            player,
            opponent,
            unitZone: zone,
            machine: engine
        } as any);
    });

    autoResolveInteractions(engine);
}

function processDefenderEffects(engine: any, playerIndex: number, zoneIndex: number): void {
    const player = engine.state.players[playerIndex];
    const opponent = engine.state.players[1 - playerIndex];
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return;

    engine.effectManager.processEffects('DEFENDER' as any, {
        sourceCard: zone.unit,
        player,
        opponent,
        unitZone: zone,
        machine: engine
    } as any);

    zone.items.forEach((item: any) => {
        engine.effectManager.processEffects('DEFENDER' as any, {
            sourceCard: item,
            player,
            opponent,
            unitZone: zone,
            machine: engine
        } as any);
    });

    autoResolveInteractions(engine);
}

tests.push({
    cardId: 'BT02-001-Entry-Behavior',
    name: 'Entry grants attacker +1500 to self',
    description: 'BT02-001 entry should grant attacker +1500 for this turn.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.hand = [getCard('BT02-001')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playUnit(0, 0);
        const zone = p1.unitZones[0];
        const before = engine.getUnitPower(zone, p1);
        processAttackerEffects(engine, 0, 0);
        const after = engine.getUnitPower(zone, p1);
        return [{ pass: after >= before + 1500, message: 'attacker +1500 applied' }];
    }
});

tests.push({
    cardId: 'BT02-002-Entry-Behavior',
    name: 'Entry grants attacker +500 to friendly units',
    description: 'BT02-002 entry should grant attacker +500 to all friendly units.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[1].unit = getCard('ST01-002');
        p1.hand = [getCard('BT02-002')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playUnit(0, 0);
        const zone = p1.unitZones[1];
        const before = engine.getUnitPower(zone, p1);
        processAttackerEffects(engine, 0, 1);
        const after = engine.getUnitPower(zone, p1);
        return [{ pass: after >= before + 500, message: 'ally attacker +500 applied' }];
    }
});

tests.push({
    cardId: 'BT02-003-Attacker-Behavior',
    name: 'Attacker grants dualist and +4000',
    description: 'BT02-003 should gain DUALIST and +4000 power at attacker timing.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-003');
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const zone = p1.unitZones[0];
        const before = engine.getUnitPower(zone, p1);
        processAttackerEffects(engine, 0, 0);
        const after = engine.getUnitPower(zone, p1);
        return [
            { pass: after >= before + 4000, message: 'attacker +4000 applied' },
            {
                pass: zone.temporaryEffects.some((effect: any) =>
                    effect.description === 'DUALIST' || effect.action?.params?.keyword === 'DUALIST'
                ),
                message: 'dualist granted on attacker timing'
            }
        ];
    }
});

tests.push({
    cardId: 'BT02-003-Trigger-Behavior',
    name: 'Trigger returns self to hand',
    description: 'BT02-003 trigger should return itself from damage to hand.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-003')];
        p1.hand = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        return [
            { pass: p1.hand.some(card => card.id === 'BT02-003'), message: 'trigger card returned to hand' },
            { pass: p1.damage.every(card => card.id !== 'BT02-003'), message: 'trigger card removed from damage zone' }
        ];
    }
});

tests.push({
    cardId: 'BT02-005-Attacker-Behavior',
    name: 'Attacker +3000 applies',
    description: 'BT02-005 should gain +3000 at attacker timing.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-005');
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const zone = p1.unitZones[0];
        const before = engine.getUnitPower(zone, p1);
        processAttackerEffects(engine, 0, 0);
        const after = engine.getUnitPower(zone, p1);
        return [{ pass: after >= before + 3000, message: 'attacker +3000 applied' }];
    }
});

tests.push({
    cardId: 'BT02-006-Entry-Behavior',
    name: 'Entry recovers low-cost unit from trash',
    description: 'BT02-006 should recover a cost 2 or less unit from trash.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const recovered = getCard('ST01-002');
        recovered.cost = 2;
        p1.trash = [recovered];
        p1.hand = [getCard('BT02-006')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playUnit(0, 0);
        autoResolveInteractions(engine);
        return [
            { pass: p1.hand.some(card => card.id === 'ST01-002'), message: 'recovered unit moved to hand' },
            { pass: !p1.trash.some(card => card.id === 'ST01-002'), message: 'recovered unit removed from trash' }
        ];
    }
});

tests.push({
    cardId: 'BT02-006-Entry-Filter-Behavior',
    name: 'Entry only recovers cost 2 or less',
    description: 'BT02-006 entry should not recover units over cost 2.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const low = getCard('ST01-002');
        low.cost = 2;
        const high = getCard('ST01-003');
        high.cost = 3;
        p1.trash = [high, low];
        p1.hand = [getCard('BT02-006')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playUnit(0, 0);
        autoResolveInteractions(engine);
        return [
            { pass: p1.hand.some(card => card.id === 'ST01-002'), message: 'cost 2 target was recovered' },
            { pass: p1.hand.every(card => card.id !== 'ST01-003'), message: 'cost 3 target was not recovered' },
            { pass: p1.trash.some(card => card.id === 'ST01-003'), message: 'cost 3 target remains in trash' }
        ];
    }
});

tests.push({
    cardId: 'BT02-007-Active-Behavior',
    name: 'Active grants attacker plunder',
    description: 'BT02-007 should grant attacker plunder[1] to friendly units this turn.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('ST01-002');
        p1.hand = [getCard('BT02-007')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const zone = p1.unitZones[0];
        engine.playSkill(0);
        processAttackerEffects(engine, 0, 0);
        return [{
            pass: zone.buffs.some((buff: any) => buff.type === 'PLUNDER' && (buff.value || 0) >= 1),
            message: 'attacker plunder buff applied'
        }];
    }
});

tests.push({
    cardId: 'BT02-008-Active-Behavior',
    name: 'Active recovers cost 7+ unit',
    description: 'BT02-008 active should recover cost 7 or higher unit from trash.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const high = getCard('ST01-009');
        high.cost = 7;
        p1.trash = [high];
        p1.hand = [getCard('BT02-008')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playSkill(0);
        autoResolveInteractions(engine);
        return [{ pass: p1.hand.some(card => card.id === 'ST01-009'), message: 'high-cost unit recovered' }];
    }
});

tests.push({
    cardId: 'BT02-008-Active-Filter-Behavior',
    name: 'Active only recovers cost 7 or higher',
    description: 'BT02-008 active should not recover units under cost 7.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const high = getCard('ST01-009');
        high.cost = 7;
        const low = getCard('ST01-006');
        low.cost = 6;
        p1.trash = [low, high];
        p1.hand = [getCard('BT02-008')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playSkill(0);
        autoResolveInteractions(engine);
        return [
            { pass: p1.hand.some(card => card.id === 'ST01-009'), message: 'cost 7 target was recovered' },
            { pass: p1.hand.every(card => card.id !== 'ST01-006'), message: 'cost 6 target was not recovered' },
            { pass: p1.trash.some(card => card.id === 'ST01-006'), message: 'cost 6 target remains in trash' }
        ];
    }
});

tests.push({
    cardId: 'BT02-009-Passive-Behavior',
    name: 'Passive grants host power and berserk',
    description: 'BT02-009 should grant +4000 to low-cost host and apply berserk keyword.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const host = getCard('ST01-002');
        host.cost = 2;
        p1.unitZones[0].unit = host;
        p1.unitZones[0].items = [getCard('BT02-009')];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const raw = p1.unitZones[0].unit?.power ?? 0;
        const power = engine.getUnitPower(p1.unitZones[0], p1);
        const phaseGate = RuleValidator.canEndPhase(engine, p1);
        return [
            { pass: power >= raw + 4000, message: 'host received +4000 passive buff' },
            { pass: phaseGate.valid === false, message: 'berserk passive blocks phase end before attack' }
        ];
    }
});

tests.push({
    cardId: 'BT02-009-Passive-HostCostGate-Behavior',
    name: 'Passive +4000 does not apply to host cost 4+',
    description: 'BT02-009 power passive must only apply when host cost is 3 or less.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const host = getCard('ST01-002');
        host.cost = 4;
        p1.unitZones[0].unit = host;
        p1.unitZones[0].items = [getCard('BT02-009')];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const raw = p1.unitZones[0].unit?.power ?? 0;
        const power = engine.getUnitPower(p1.unitZones[0], p1);
        return [{ pass: power === raw, message: 'cost gate prevented +4000 passive buff' }];
    }
});

tests.push({
    cardId: 'BT02-009-Trigger-Behavior',
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
    cardId: 'BT02-010-Entry-Behavior',
    name: 'Entry reveals top card and takes Base unit',
    description: 'BT02-010 should reveal top 1 and add matching Base unit to hand.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const baseTrait = getBaseTraitToken(getCard);
        const baseUnit = getCard('ST01-003');
        baseUnit.traits = baseTrait;
        p1.deck = [baseUnit];
        p1.hand = [getCard('BT02-010')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playUnit(0, 0);
        autoResolveInteractions(engine);
        return [{ pass: p1.hand.some(card => card.id === 'ST01-003'), message: 'revealed Base unit added to hand' }];
    }
});

tests.push({
    cardId: 'BT02-011-Trigger-Behavior',
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
    cardId: 'BT02-012-Passive-Behavior',
    name: 'Passive hit scales by Base unit count',
    description: 'BT02-012 should gain hit based on friendly Base unit count.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const baseTrait = getBaseTraitToken(getCard);
        const self = getCard('BT02-012');
        self.traits = 'NOT_BASE';
        const ally1 = getCard('ST01-002');
        const ally2 = getCard('ST01-003');
        ally1.traits = baseTrait;
        ally2.traits = baseTrait;
        p1.unitZones[0].unit = self;
        p1.unitZones[1].unit = ally1;
        p1.unitZones[2].unit = ally2;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const raw = p1.unitZones[0].unit?.hit ?? 0;
        const hit = engine.getUnitHit(p1.unitZones[0], p1);
        return [{ pass: hit >= raw + 2, message: 'hit scaled by Base unit count' }];
    }
});

tests.push({
    cardId: 'BT02-012-Trigger-Behavior',
    name: 'Trigger returns self to hand (012)',
    description: 'BT02-012 trigger should return itself from damage to hand.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-012')];
        p1.hand = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        return [
            { pass: p1.hand.some(card => card.id === 'BT02-012'), message: 'trigger card returned to hand' },
            { pass: p1.damage.every(card => card.id !== 'BT02-012'), message: 'trigger card removed from damage zone' }
        ];
    }
});

tests.push({
    cardId: 'BT02-013-Entry-Behavior',
    name: 'Entry buffs selected friendly unit',
    description: 'BT02-013 should grant +2000 to one selected friendly unit.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[1].unit = getCard('ST01-002');
        p1.hand = [getCard('BT02-013')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const beforeSelf = p1.unitZones[0].unit ? engine.getUnitPower(p1.unitZones[0], p1) : 0;
        const beforeAlly = p1.unitZones[1].unit ? engine.getUnitPower(p1.unitZones[1], p1) : 0;
        engine.playUnit(0, 0);
        autoResolveInteractions(engine);
        const afterSelf = p1.unitZones[0].unit ? engine.getUnitPower(p1.unitZones[0], p1) : 0;
        const afterAlly = p1.unitZones[1].unit ? engine.getUnitPower(p1.unitZones[1], p1) : 0;
        return [{
            pass: (afterSelf >= beforeSelf + 2000) || (afterAlly >= beforeAlly + 2000),
            message: 'one friendly target received +2000 entry buff'
        }];
    }
});

tests.push({
    cardId: 'BT02-015-Active-Behavior',
    name: 'Active gains level when frontline occupied',
    description: 'BT02-015 should gain 1 level when all 3 lanes are occupied.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.leaderLevel = 5;
        p1.unitZones[0].unit = getCard('ST01-002');
        p1.unitZones[1].unit = getCard('ST01-003');
        p1.unitZones[2].unit = getCard('ST01-004');
        p1.hand = [getCard('BT02-015')];
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const before = p1.leaderLevel;
        engine.playSkill(0);
        autoResolveInteractions(engine);
        return [{ pass: p1.leaderLevel === before + 1, message: 'leader level +1 resolved' }];
    }
});

tests.push({
    cardId: 'BT02-016-Active-Behavior',
    name: 'Active destroys one equipped item',
    description: 'BT02-016 should trash one equipped item from selected unit.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.hand = [getCard('BT02-016')];
        p1.leaderLevel = 10;
        p2.unitZones[0].unit = getCard('ST01-002');
        p2.unitZones[0].items = [getCard('BT02-078')];
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p2 = engine.state.players[1];
        engine.playSkill(0);
        autoResolveInteractions(engine);
        return [
            { pass: p2.unitZones[0].items.length === 0, message: 'equipped item removed from target zone' },
            { pass: p2.trash.some(card => card.id === 'BT02-078'), message: 'equipped item moved to trash' }
        ];
    }
});

tests.push({
    cardId: 'BT02-017-Active-Behavior',
    name: 'Active buffs Base units',
    description: 'BT02-017 should buff friendly Base units by +1500.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const baseTrait = getBaseTraitToken(getCard);
        const base1 = getCard('ST01-002');
        const base2 = getCard('ST01-003');
        base1.traits = baseTrait;
        base2.traits = baseTrait;
        p1.unitZones[0].unit = base1;
        p1.unitZones[1].unit = base2;
        p1.hand = [getCard('BT02-017')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const before0 = engine.getUnitPower(p1.unitZones[0], p1);
        const before1 = engine.getUnitPower(p1.unitZones[1], p1);
        engine.playSkill(0);
        const after0 = engine.getUnitPower(p1.unitZones[0], p1);
        const after1 = engine.getUnitPower(p1.unitZones[1], p1);
        return [
            { pass: after0 >= before0 + 1500, message: 'first Base unit buffed' },
            { pass: after1 >= before1 + 1500, message: 'second Base unit buffed' }
        ];
    }
});

tests.push({
    cardId: 'BT02-018-Passive-Behavior',
    name: 'Passive grants +1 hit to Base host',
    description: 'BT02-018 should grant +1 hit when equipped to a Base trait unit.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const host = getCard('ST01-002');
        host.traits = getBaseTraitToken(getCard);
        p1.unitZones[0].unit = host;
        p1.unitZones[0].items = [getCard('BT02-018')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const raw = p1.unitZones[0].unit?.hit ?? 0;
        const hit = engine.getUnitHit(p1.unitZones[0], p1);
        return [{ pass: hit >= raw + 1, message: 'base host gained +1 hit' }];
    }
});

tests.push({
    cardId: 'BT02-019-Exit-Behavior',
    name: 'Exit grants +1 hit to selected ally',
    description: 'BT02-019 should grant +1 hit to a friendly unit on exit.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-019');
        p1.unitZones[1].unit = getCard('ST01-002');
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const before = engine.getUnitHit(p1.unitZones[1], p1);
        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
        autoResolveInteractions(engine);
        const after = engine.getUnitHit(p1.unitZones[1], p1);
        return [{ pass: after >= before + 1, message: 'exit hit buff resolved' }];
    }
});

tests.push({
    cardId: 'BT02-020-UnitTrashed-Behavior',
    name: 'Buffs self when another unit is trashed by effect',
    description: 'BT02-020 should gain +1000 when another unit is trashed by effect.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-020');
        p1.unitZones[1].unit = getCard('ST01-002');
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const before = engine.getUnitPower(p1.unitZones[0], p1);
        engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');
        const after = engine.getUnitPower(p1.unitZones[0], p1);
        return [{ pass: after >= before + 1000, message: 'unit trashed trigger buff applied' }];
    }
});

tests.push({
    cardId: 'BT02-021-Defender-Behavior',
    name: 'Defender terminates attack and trashes self',
    description: 'BT02-021 should terminate attack and trash itself as defender.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.unitZones[0].unit = getCard('ST01-009');
        p1.unitZones[0].unit.power = 8000;
        p2.unitZones[0].unit = getCard('BT02-021');
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
    },
    verify: (engine) => {
        const p2 = engine.state.players[1];
        const damageBefore = p2.damage.length;
        engine.attack(0);
        engine.resolveBlock(true);
        autoResolveInteractions(engine);
        return [
            { pass: p2.damage.length === damageBefore, message: 'damage prevented by terminated attack' },
            { pass: p2.unitZones[0].unit === null, message: 'defender trashed itself' }
        ];
    }
});

tests.push({
    cardId: 'BT02-022-ActiveMain-Behavior',
    name: 'ActiveMain deals damage after 2 effect-trash events',
    description: 'BT02-022 should deal 1 damage when 2+ own units were trashed by effect this turn.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-022');
        p1.unitZones[1].unit = getCard('ST01-002');
        p1.unitZones[2].unit = getCard('ST01-003');
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        const before = p2.damage.length;
        engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');
        engine.destroyUnit(p1, p1.unitZones[2], undefined, 'EFFECT');
        engine.activateEffect(0, 0);
        return [{ pass: p2.damage.length === before + 1, message: 'conditioned active main damage resolved' }];
    }
});

tests.push({
    cardId: 'BT02-022-Trigger-Behavior',
    name: 'Trigger returns self to hand (022)',
    description: 'BT02-022 trigger should return itself from damage zone to hand.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-022')];
        p1.hand = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        return [
            { pass: p1.hand.some(card => card.id === 'BT02-022'), message: 'trigger source returned to hand' },
            { pass: !p1.damage.some(card => card.id === 'BT02-022'), message: 'trigger source removed from damage zone' }
        ];
    }
});

tests.push({
    cardId: 'BT02-024-Exit-Behavior',
    name: 'Exit mutual destruction can destroy killer',
    description: 'BT02-024 should destroy the killer when killer cost is not greater than source cost.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        const source = getCard('BT02-024');
        source.cost = 6;
        const killer = getCard('ST01-002');
        killer.cost = 2;
        p1.unitZones[0].unit = source;
        p2.unitZones[0].unit = killer;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        const killer = p2.unitZones[0].unit;
        engine.destroyUnit(p1, p1.unitZones[0], killer || undefined, 'COMBAT');
        autoResolveInteractions(engine);
        return [{ pass: p2.unitZones[0].unit === null, message: 'killer removed by mutual destruction' }];
    }
});

tests.push({
    cardId: 'BT02-025-Active-Behavior',
    name: 'Active recovers low-cost Exit unit',
    description: 'BT02-025 active should recover a cost 2 or less Exit unit from trash.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const exitKeyword = getKeywordFilterValue(getCard, 'BT02-025', 0);
        const recovered = getCard('ST01-002');
        recovered.cost = 2;
        recovered.keywords = exitKeyword;
        p1.trash = [recovered];
        p1.hand = [getCard('BT02-025')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playSkill(0);
        autoResolveInteractions(engine);
        return [
            { pass: p1.hand.some(card => card.id === 'ST01-002'), message: 'exit unit recovered by active effect' },
            { pass: !p1.trash.some(card => card.id === 'ST01-002'), message: 'recovered card removed from trash' }
        ];
    }
});

tests.push({
    cardId: 'BT02-025-Trigger-Behavior',
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
    cardId: 'BT02-026-Active-Behavior',
    name: 'Active draws by trashed hand unit hit',
    description: 'BT02-026 should draw cards equal to hit of trashed hand unit.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const handUnit = getCard('ST01-002');
        handUnit.hit = 2;
        p1.hand = [getCard('BT02-026'), handUnit];
        p1.deck = [getCard('ST01-003'), getCard('ST01-004'), getCard('ST01-005')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playSkill(0);
        autoResolveInteractions(engine);
        return [{ pass: p1.hand.length === 2, message: 'net hand count matches draw(2) after cost payment' }];
    }
});

tests.push({
    cardId: 'BT02-027-TurnEnd-Behavior',
    name: 'Turn-end destroys host on opponent turn end',
    description: 'BT02-027 should trash host unit at opponent turn end.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.unitZones[0].unit = getCard('ST01-002');
        p1.unitZones[0].items = [getCard('BT02-027')];
        engine.state.turnPlayerIndex = 1;
        engine.effectManager.processEffects('TURN_END' as any, {
            sourceCard: p1.unitZones[0].items[0],
            player: p1,
            opponent: p2,
            unitZone: p1.unitZones[0],
            machine: engine
        } as any);
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        return [{ pass: p1.unitZones[0].unit === null, message: 'host destroyed at turn end trigger' }];
    }
});

tests.push({
    cardId: 'BT02-028-Awaken-Behavior',
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
    cardId: 'BT02-028-Passive-Behavior',
    name: 'Passive buffs only guardian units when awakened',
    description: 'BT02-028 passive should grant +1000 only to friendly units with guardian keyword.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const guardianKeyword = getKeywordFilterValue(getCard, 'BT02-028', 1);
        const guardian = getCard('ST01-002');
        guardian.keywords = guardianKeyword;
        const nonGuardian = getCard('ST01-003');
        nonGuardian.keywords = ['NON_GUARDIAN'];

        p1.levelZone = getCard('BT02-028');
        p1.levelZone.isAwakened = true;
        p1.unitZones[0].unit = guardian;
        p1.unitZones[1].unit = nonGuardian;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const guardianRaw = p1.unitZones[0].unit?.power ?? 0;
        const nonGuardianRaw = p1.unitZones[1].unit?.power ?? 0;
        const guardianBuffed = engine.getUnitPower(p1.unitZones[0], p1);
        const nonGuardianBuffed = engine.getUnitPower(p1.unitZones[1], p1);
        return [
            { pass: guardianBuffed >= guardianRaw + 1000, message: 'guardian unit received passive buff' },
            { pass: nonGuardianBuffed === nonGuardianRaw, message: 'non-guardian unit not buffed by passive' }
        ];
    }
});

tests.push({
    cardId: 'BT02-029-Defender-Behavior',
    name: 'Defender gains +2000 power',
    description: 'BT02-029 should gain +2000 power at defender timing.',
    setup: (engine, getCard) => {
        const p2 = engine.state.players[1];
        p2.unitZones[0].unit = getCard('BT02-029');
    },
    verify: (engine) => {
        const p2 = engine.state.players[1];
        const before = engine.getUnitPower(p2.unitZones[0], p2);
        processDefenderEffects(engine, 1, 0);
        const after = engine.getUnitPower(p2.unitZones[0], p2);
        return [{ pass: after >= before + 2000, message: 'defender +2000 applied' }];
    }
});

tests.push({
    cardId: 'BT02-031-Defender-Behavior',
    name: 'Defender gains +2000 power (031)',
    description: 'BT02-031 should gain +2000 power at defender timing.',
    setup: (engine, getCard) => {
        const p2 = engine.state.players[1];
        p2.unitZones[0].unit = getCard('BT02-031');
    },
    verify: (engine) => {
        const p2 = engine.state.players[1];
        const before = engine.getUnitPower(p2.unitZones[0], p2);
        processDefenderEffects(engine, 1, 0);
        const after = engine.getUnitPower(p2.unitZones[0], p2);
        return [{ pass: after >= before + 2000, message: 'defender +2000 applied' }];
    }
});

tests.push({
    cardId: 'BT02-032-Attacker-Behavior',
    name: 'Attacker breakthrough bypasses cost 6+ blocker',
    description: 'BT02-032 should deal direct damage against cost 6+ encounter blocker.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.unitZones[0].unit = getCard('BT02-032');
        p1.unitZones[0].unit.hit = 2;
        const blocker = getCard('ST01-009');
        blocker.cost = 6;
        blocker.power = 9999;
        p2.unitZones[0].unit = blocker;
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
    },
    verify: (engine) => {
        const p2 = engine.state.players[1];
        const before = p2.damage.length;
        engine.attack(0);
        return [
            { pass: p2.damage.length >= before + 1, message: 'direct damage dealt by breakthrough' },
            { pass: !!p2.unitZones[0].unit, message: 'blocker remained (block was bypassed)' }
        ];
    }
});

tests.push({
    cardId: 'BT02-035-Attacker-Behavior',
    name: 'Attacker infiltration draws on unblocked attack',
    description: 'BT02-035 should draw 1 when attacking unblocked after gaining infiltration.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-035');
        p1.deck = [getCard('ST01-002')];
        p1.hand = [];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const before = p1.hand.length;
        engine.attack(0);
        return [{ pass: p1.hand.length >= before + 1, message: 'infiltration draw resolved' }];
    }
});

tests.push({
    cardId: 'BT02-036-Entry-Behavior',
    name: 'Entry grants +1 hit to Guardian ally',
    description: 'BT02-036 entry should grant +1 hit to selected friendly Guardian.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const guardianKeyword = getKeywordFilterValue(getCard, 'BT02-036', 0);
        const guardian = getCard('ST01-002');
        guardian.keywords = guardianKeyword;
        p1.unitZones[1].unit = guardian;
        p1.hand = [getCard('BT02-036')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const before = engine.getUnitHit(p1.unitZones[1], p1);
        engine.playUnit(0, 0);
        autoResolveInteractions(engine);
        const after = engine.getUnitHit(p1.unitZones[1], p1);
        return [{ pass: after >= before + 1, message: 'guardian hit buff applied on entry' }];
    }
});

tests.push({
    cardId: 'BT02-036-Trigger-Behavior',
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
    cardId: 'BT02-038-Passive-Behavior',
    name: 'Passive buffs Defender allies',
    description: 'BT02-038 should grant +2000 power to friendly Defender units.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const defenderKeyword = getKeywordFilterValue(getCard, 'BT02-038', 0);
        const defender = getCard('ST01-002');
        defender.keywords = defenderKeyword;
        p1.unitZones[0].unit = getCard('BT02-038');
        p1.unitZones[1].unit = defender;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const raw = p1.unitZones[1].unit?.power ?? 0;
        const power = engine.getUnitPower(p1.unitZones[1], p1);
        return [{ pass: power >= raw + 2000, message: 'defender ally buffed by passive' }];
    }
});

tests.push({
    cardId: 'BT02-039-Entry-Behavior',
    name: 'Entry buffs self by +2000',
    description: 'BT02-039 should gain +2000 power on entry.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.hand = [getCard('BT02-039')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playUnit(0, 0);
        const raw = p1.unitZones[0].unit?.power ?? 0;
        const power = engine.getUnitPower(p1.unitZones[0], p1);
        return [{ pass: power >= raw + 2000, message: 'entry self buff applied' }];
    }
});

tests.push({
    cardId: 'BT02-040-Entry-Behavior',
    name: 'Entry draws 1 card',
    description: 'BT02-040 should draw 1 card on entry.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002')];
        p1.hand = [getCard('BT02-040')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playUnit(0, 0);
        return [{ pass: p1.hand.some(card => card.id === 'ST01-002'), message: 'entry draw resolved' }];
    }
});

tests.push({
    cardId: 'BT02-041-Attacker-Behavior',
    name: 'Attacker breakthrough activates at hand>=5',
    description: 'BT02-041 should bypass cost 6+ blocker when hand count condition is met.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.unitZones[0].unit = getCard('BT02-041');
        p1.unitZones[0].unit.hit = 2;
        p1.hand = [
            getCard('ST01-002'),
            getCard('ST01-003'),
            getCard('ST01-004'),
            getCard('ST01-005'),
            getCard('ST01-006')
        ];
        const blocker = getCard('ST01-009');
        blocker.cost = 6;
        blocker.power = 9999;
        p2.unitZones[0].unit = blocker;
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
    },
    verify: (engine) => {
        const p2 = engine.state.players[1];
        const before = p2.damage.length;
        engine.attack(0);
        return [
            { pass: p2.damage.length >= before + 1, message: 'conditional breakthrough dealt direct damage' },
            { pass: !!p2.unitZones[0].unit, message: 'cost 6 blocker remained (block bypassed)' }
        ];
    }
});

tests.push({
    cardId: 'BT02-041-Trigger-Behavior',
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
    cardId: 'BT02-042-Entry-Behavior',
    name: 'Entry moves skill from trash to deck top',
    description: 'BT02-042 should move selected skill card from trash to top of deck.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.trash = [getCard('BT02-047')];
        p1.hand = [getCard('BT02-042')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playUnit(0, 0);
        autoResolveInteractions(engine);
        const top = p1.deck[p1.deck.length - 1];
        return [
            { pass: !!top && top.id === 'BT02-047', message: 'selected skill moved to deck top' },
            { pass: !p1.trash.some(card => card.id === 'BT02-047'), message: 'selected skill removed from trash' }
        ];
    }
});

tests.push({
    cardId: 'BT02-042-Trigger-Behavior',
    name: 'Trigger returns self to hand (042)',
    description: 'BT02-042 trigger should return itself from damage to hand.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-042')];
        p1.hand = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        return [
            { pass: p1.hand.some(card => card.id === 'BT02-042'), message: 'trigger card returned to hand' },
            { pass: p1.damage.every(card => card.id !== 'BT02-042'), message: 'trigger card removed from damage zone' }
        ];
    }
});

tests.push({
    cardId: 'BT02-043-Defender-Behavior',
    name: 'Defender grants +4000 power',
    description: 'BT02-043 should gain +4000 power at defender timing.',
    setup: (engine, getCard) => {
        const p2 = engine.state.players[1];
        p2.unitZones[0].unit = getCard('BT02-043');
    },
    verify: (engine) => {
        const p2 = engine.state.players[1];
        const before = engine.getUnitPower(p2.unitZones[0], p2);
        processDefenderEffects(engine, 1, 0);
        const after = engine.getUnitPower(p2.unitZones[0], p2);
        return [{ pass: after >= before + 4000, message: 'defender +4000 applied' }];
    }
});

tests.push({
    cardId: 'BT02-043-Trigger-Behavior',
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
    cardId: 'BT02-045-HandDiscarded-Behavior',
    name: 'Hand-discard trigger draws 1',
    description: 'BT02-045 should draw when hand cards are discarded by effect.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const discardedUnit = getCard('ST01-002');
        discardedUnit.hit = 0;
        p1.unitZones[0].unit = getCard('BT02-045');
        p1.hand = [getCard('BT02-026'), discardedUnit, getCard('ST01-003')];
        p1.deck = [getCard('ST01-004')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const beforeHand = p1.hand.length;
        engine.playSkill(0);
        autoResolveInteractions(engine);
        return [
            { pass: p1.hand.length === beforeHand - 1, message: 'net hand count reflects discard and trigger draw' },
            { pass: p1.hand.some(card => card.id === 'ST01-004'), message: 'draw from HAND_DISCARDED resolved' },
            { pass: p1.trash.some(card => card.id === 'ST01-002'), message: 'a hand unit was trashed by effect cost' }
        ];
    }
});

tests.push({
    cardId: 'BT02-046-Passive-Behavior',
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
    cardId: 'BT02-046-Trigger-Behavior',
    name: 'Trigger returns self to hand (046)',
    description: 'BT02-046 trigger should return itself from damage to hand.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-046')];
        p1.hand = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        return [
            { pass: p1.hand.some(card => card.id === 'BT02-046'), message: 'trigger card returned to hand' },
            { pass: p1.damage.every(card => card.id !== 'BT02-046'), message: 'trigger card removed from damage zone' }
        ];
    }
});

tests.push({
    cardId: 'BT02-047-Active-Behavior',
    name: 'Active buffs selected Defender',
    description: 'BT02-047 should grant +3500 to one friendly Defender unit.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const defenderKeyword = getKeywordFilterValue(getCard, 'BT02-047', 0);
        const defender = getCard('ST01-002');
        defender.keywords = defenderKeyword;
        p1.unitZones[0].unit = defender;
        p1.hand = [getCard('BT02-047')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const before = engine.getUnitPower(p1.unitZones[0], p1);
        engine.playSkill(0);
        autoResolveInteractions(engine);
        const after = engine.getUnitPower(p1.unitZones[0], p1);
        return [{ pass: after >= before + 3500, message: 'defender received +3500 buff' }];
    }
});

tests.push({
    cardId: 'BT02-048-Active-Behavior',
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
    cardId: 'BT02-049-Active-Behavior',
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
    cardId: 'BT02-050-Active-Behavior',
    name: 'Active buffs guardian and grants hit at hand>=5',
    description: 'BT02-050 should grant +2000 power and +1 hit when hand size condition is met.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const guardianKeyword = getKeywordFilterValue(getCard, 'BT02-050', 0);
        const guardian = getCard('ST01-002');
        guardian.keywords = guardianKeyword;
        p1.unitZones[0].unit = guardian;
        p1.hand = [
            getCard('BT02-050'),
            getCard('ST01-002'),
            getCard('ST01-003'),
            getCard('ST01-004'),
            getCard('ST01-005'),
            getCard('ST01-006')
        ];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const beforePower = engine.getUnitPower(p1.unitZones[0], p1);
        const beforeHit = engine.getUnitHit(p1.unitZones[0], p1);
        engine.playSkill(0);
        autoResolveInteractions(engine);
        const afterPower = engine.getUnitPower(p1.unitZones[0], p1);
        const afterHit = engine.getUnitHit(p1.unitZones[0], p1);
        return [
            { pass: afterPower >= beforePower + 2000, message: 'guardian got +2000 power' },
            { pass: afterHit >= beforeHit + 1, message: 'guardian got +1 hit with hand condition' }
        ];
    }
});

tests.push({
    cardId: 'BT02-051-Active-Behavior',
    name: 'Active discards 2 then deals 1 damage',
    description: 'BT02-051 should pay 2 hand cards and then deal 1 damage.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.hand = [getCard('BT02-051'), getCard('ST01-002'), getCard('ST01-003')];
        p1.leaderLevel = 10;
        p2.deck = [getCard('ST01-004')];
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        const before = p2.damage.length;
        engine.playSkill(0);
        autoResolveInteractions(engine);
        return [
            { pass: p2.damage.length === before + 1, message: '1 damage dealt after cost' },
            { pass: p1.hand.length === 0, message: 'two hand cards discarded as cost' }
        ];
    }
});

tests.push({
    cardId: 'BT02-052-Passive-Behavior',
    name: 'Passive grants +1000 to cost<=3 host',
    description: 'BT02-052 should grant +1000 power to a cost 3 or less host.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const host = getCard('ST01-002');
        host.cost = 3;
        p1.unitZones[0].unit = host;
        p1.unitZones[0].items = [getCard('BT02-052')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const raw = p1.unitZones[0].unit?.power ?? 0;
        const power = engine.getUnitPower(p1.unitZones[0], p1);
        return [{ pass: power >= raw + 1000, message: 'cost-limited passive buff applied' }];
    }
});

tests.push({
    cardId: 'BT02-053-Passive-Behavior',
    name: 'Passive grants +2000 to Guardian host',
    description: 'BT02-053 should grant +2000 power when host has Guardian keyword.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const guardianKeyword = getKeywordFilterValue(getCard, 'BT02-053', 0);
        const host = getCard('ST01-002');
        host.keywords = guardianKeyword;
        p1.unitZones[0].unit = host;
        p1.unitZones[0].items = [getCard('BT02-053')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const raw = p1.unitZones[0].unit?.power ?? 0;
        const power = engine.getUnitPower(p1.unitZones[0], p1);
        return [{ pass: power >= raw + 2000, message: 'guardian passive buff applied' }];
    }
});

tests.push({
    cardId: 'BT02-054-Attacker-Behavior',
    name: 'Attacker grants infiltration to cost>=4 host',
    description: 'BT02-054 should grant INFILTRATION to host at attacker timing when cost condition is met.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const host = getCard('ST01-009');
        host.cost = 4;
        p1.unitZones[0].unit = host;
        p1.unitZones[0].items = [getCard('BT02-054')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        processAttackerEffects(engine, 0, 0);
        return [{
            pass: p1.unitZones[0].temporaryEffects.some((effect: any) =>
                effect.description === 'INFILTRATION' || effect.action?.params?.keyword === 'INFILTRATION'
            ),
            message: 'infiltration granted to host'
        }];
    }
});

tests.push({
    cardId: 'BT02-054-Passive-Behavior',
    name: 'Passive equip condition enforces host cost',
    description: 'BT02-054 should equip only to host cost 4 or higher.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const lowHost = getCard('ST01-002');
        lowHost.cost = 3;
        const highHost = getCard('ST01-003');
        highHost.cost = 4;
        p1.unitZones[0].unit = lowHost;
        p1.unitZones[1].unit = highHost;
        p1.hand = [getCard('BT02-054'), getCard('BT02-054')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playItem(0, 0);
        engine.playItem(0, 1);
        return [
            { pass: p1.unitZones[0].items.length === 0, message: 'item not equipped to invalid low-cost host' },
            { pass: p1.unitZones[1].items.some(item => item.id === 'BT02-054'), message: 'item equipped to valid cost 4+ host' }
        ];
    }
});

tests.push({
    cardId: 'BT02-055-Awaken-Behavior',
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

tests.push({
    cardId: 'BT02-055-Passive-Behavior',
    name: 'Passive buffs only equipped units when awakened',
    description: 'BT02-055 passive should grant +1500 only to friendly units that have equipped items.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.levelZone = getCard('BT02-055');
        p1.levelZone.isAwakened = true;

        p1.unitZones[0].unit = getCard('ST01-002');
        p1.unitZones[0].items = [getCard('BT02-078')];
        p1.unitZones[1].unit = getCard('ST01-003');
        p1.unitZones[1].items = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const equippedRaw = p1.unitZones[0].unit?.power ?? 0;
        const unequippedRaw = p1.unitZones[1].unit?.power ?? 0;
        const equippedBuffed = engine.getUnitPower(p1.unitZones[0], p1);
        const unequippedBuffed = engine.getUnitPower(p1.unitZones[1], p1);
        return [
            { pass: equippedBuffed >= equippedRaw + 1500, message: 'equipped unit received passive buff' },
            { pass: unequippedBuffed === unequippedRaw, message: 'unequipped unit not buffed by passive' }
        ];
    }
});

tests.push({
    cardId: 'BT02-056-Exit-Behavior',
    name: 'Exit recovers a cost 1 item',
    description: 'BT02-056 should recover a cost 1 item from trash on exit.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-056');
        p1.trash = [getCard('BT02-079')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
        autoResolveInteractions(engine);
        return [
            { pass: p1.hand.some(card => card.id === 'BT02-079'), message: 'cost 1 item recovered to hand' },
            { pass: !p1.trash.some(card => card.id === 'BT02-079'), message: 'recovered item removed from trash' }
        ];
    }
});

tests.push({
    cardId: 'BT02-057-Passive-Behavior',
    name: 'Passive scales power and grants attacker draw',
    description: 'BT02-057 should gain power per item and grant attacker draw at 3 equipped items.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-057');
        p1.unitZones[0].items = [getCard('BT02-078'), getCard('BT02-079'), getCard('BT02-080')];
        p1.deck = [getCard('ST01-002')];
        p1.hand = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const zone = p1.unitZones[0];
        const raw = zone.unit?.power ?? 0;
        const power = engine.getUnitPower(zone, p1);

        const p2 = engine.state.players[1];
        engine.effectManager.processEffects('PASSIVE' as any, {
            sourceCard: zone.unit,
            player: p1,
            opponent: p2,
            unitZone: zone,
            machine: engine
        } as any);

        const beforeHand = p1.hand.length;
        processAttackerEffects(engine, 0, 0);
        return [
            { pass: power >= raw + 6000, message: 'power scaled by equipped item count' },
            { pass: p1.hand.length >= beforeHand + 1, message: 'granted attacker draw resolved at 3 items' }
        ];
    }
});

tests.push({
    cardId: 'BT02-057-Trigger-Behavior',
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
    cardId: 'BT02-058-Exit-Behavior',
    name: 'Exit swaps one item between damage and hand',
    description: 'BT02-058 should swap a damage item with one hand card on exit.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-058');
        p1.damage = [getCard('BT02-078')];
        p1.hand = [getCard('ST01-002')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
        autoResolveInteractions(engine);
        return [
            { pass: p1.hand.some(card => card.id === 'BT02-078'), message: 'damage item moved to hand' },
            { pass: p1.damage.length === 1 && p1.damage[0].id === 'ST01-002', message: 'hand card moved to damage zone' }
        ];
    }
});

tests.push({
    cardId: 'BT02-059-Entry-Behavior',
    name: 'Entry optionally returns equipped item to hand',
    description: 'BT02-059 should return one equipped item from a friendly unit to hand.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[1].unit = getCard('ST01-002');
        p1.unitZones[1].items = [getCard('BT02-078')];
        p1.hand = [getCard('BT02-059')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playUnit(0, 0);
        autoResolveInteractions(engine);
        return [
            { pass: p1.unitZones[1].items.length === 0, message: 'equipped item removed from lane' },
            { pass: p1.hand.some(card => card.id === 'BT02-078'), message: 'equipped item returned to hand' }
        ];
    }
});

tests.push({
    cardId: 'BT02-060-Passive-Behavior',
    name: 'Passive scales by equipped unit count',
    description: 'BT02-060 should gain power per equipped unit and +1 hit at 3 equipped units.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-060');
        p1.unitZones[0].items = [getCard('BT02-078')];
        p1.unitZones[1].unit = getCard('ST01-002');
        p1.unitZones[1].items = [getCard('BT02-079')];
        p1.unitZones[2].unit = getCard('ST01-003');
        p1.unitZones[2].items = [getCard('BT02-080')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const rawPower = p1.unitZones[0].unit?.power ?? 0;
        const rawHit = p1.unitZones[0].unit?.hit ?? 0;
        const power = engine.getUnitPower(p1.unitZones[0], p1);
        const hit = engine.getUnitHit(p1.unitZones[0], p1);
        return [
            { pass: power >= rawPower + 6000, message: 'power scaled by 3 equipped units' },
            { pass: hit >= rawHit + 1, message: 'hit threshold bonus applied' }
        ];
    }
});

tests.push({
    cardId: 'BT02-062-Attacker-Behavior',
    name: 'Attacker penetration deals extra damage',
    description: 'BT02-062 should deal penetration damage when equipped and winning blocked combat.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.unitZones[0].unit = getCard('BT02-062');
        p1.unitZones[0].unit.power = 9000;
        p1.unitZones[0].items = [getCard('BT02-078')];
        p2.unitZones[0].unit = getCard('ST01-002');
        p2.unitZones[0].unit.power = 1000;
        p2.deck = [getCard('ST01-003')];
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
    },
    verify: (engine) => {
        const p2 = engine.state.players[1];
        const before = p2.damage.length;
        engine.attack(0);
        engine.resolveBlock(true);
        autoResolveInteractions(engine);
        return [
            { pass: p2.unitZones[0].unit === null, message: 'blocker destroyed in combat' },
            { pass: p2.damage.length === before + 1, message: 'penetration damage dealt to leader' }
        ];
    }
});

tests.push({
    cardId: 'BT02-063-Entry-Behavior',
    name: 'Entry optional cost destroys encounter unit',
    description: 'BT02-063 should trash an item from hand and destroy encounter unit on entry.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.hand = [getCard('BT02-063'), getCard('BT02-078')];
        p1.leaderLevel = 10;
        p2.unitZones[0].unit = getCard('ST01-002');
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.playUnit(0, 0);
        autoResolveInteractions(engine);
        return [
            { pass: p2.unitZones[0].unit === null, message: 'encounter unit destroyed by optional entry effect' },
            { pass: p1.trash.some(card => card.id === 'BT02-078'), message: 'item cost was paid from hand' }
        ];
    }
});

tests.push({
    cardId: 'BT02-063-Trigger-Behavior',
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
    cardId: 'BT02-065-Passive-Behavior',
    name: 'Passive grants +2500 when equipped',
    description: 'BT02-065 should gain +2500 power while equipped.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-065');
        p1.unitZones[0].items = [getCard('BT02-078')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const raw = p1.unitZones[0].unit?.power ?? 0;
        const power = engine.getUnitPower(p1.unitZones[0], p1);
        return [{ pass: power >= raw + 2500, message: 'equipped passive +2500 applied' }];
    }
});

tests.push({
    cardId: 'BT02-066-Exit-Behavior',
    name: 'Exit returns an equipped item to hand',
    description: 'BT02-066 should return one equipped item to hand when trashed.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-066');
        p1.unitZones[0].items = [getCard('BT02-078')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        const zone = p1.unitZones[0];
        engine.effectManager.processEffects('EXIT' as any, {
            sourceCard: zone.unit,
            player: p1,
            opponent: p2,
            unitZone: zone,
            machine: engine
        } as any);
        autoResolveInteractions(engine);
        return [
            { pass: p1.hand.some(card => card.id === 'BT02-078'), message: 'equipped item returned on exit' },
            { pass: p1.unitZones[0].items.length === 0, message: 'returned item removed from host lane' }
        ];
    }
});

tests.push({
    cardId: 'BT02-067-Attacker-Behavior',
    name: 'Attacker breakthrough applies when equipped',
    description: 'BT02-067 should bypass blocker when equipped due unconditional breakthrough.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.unitZones[0].unit = getCard('BT02-067');
        p1.unitZones[0].unit.hit = 2;
        p1.unitZones[0].items = [getCard('BT02-078')];
        const blocker = getCard('ST01-002');
        blocker.cost = 2;
        blocker.power = 9999;
        p2.unitZones[0].unit = blocker;
        engine.state.turnPlayerIndex = 0;
        engine.state.phase = Phase.ATTACK;
    },
    verify: (engine) => {
        const p2 = engine.state.players[1];
        const before = p2.damage.length;
        engine.attack(0);
        return [
            { pass: p2.damage.length >= before + 1, message: 'unconditional breakthrough dealt direct damage' },
            { pass: !!p2.unitZones[0].unit, message: 'blocker remained (block was bypassed)' }
        ];
    }
});

tests.push({
    cardId: 'BT02-067-Trigger-Behavior',
    name: 'Trigger returns self to hand (067)',
    description: 'BT02-067 trigger should return itself from damage to hand.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-067')];
        p1.hand = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        return [
            { pass: p1.hand.some(card => card.id === 'BT02-067'), message: 'trigger card returned to hand' },
            { pass: p1.damage.every(card => card.id !== 'BT02-067'), message: 'trigger card removed from damage zone' }
        ];
    }
});

tests.push({
    cardId: 'BT02-068-Entry-Behavior',
    name: 'Entry reveals top 2 and takes item',
    description: 'BT02-068 should reveal top 2 and move one item card to hand.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-078')];
        p1.hand = [getCard('BT02-068')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playUnit(0, 0);
        autoResolveInteractions(engine);
        return [{ pass: p1.hand.some(card => card.id === 'BT02-078'), message: 'revealed item selected into hand' }];
    }
});

tests.push({
    cardId: 'BT02-069-Passive-Behavior',
    name: 'Passive prevents destruction by trashing equipped item',
    description: 'BT02-069 should keep host alive by trashing one equipped item instead.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-069');
        p1.unitZones[0].items = [getCard('BT02-078')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.destroyUnit(p1, p1.unitZones[0], undefined, 'COMBAT');
        return [
            { pass: !!p1.unitZones[0].unit, message: 'host survived by prevention' },
            { pass: p1.trash.some(card => card.id === 'BT02-078'), message: 'equipped item trashed as prevention cost' }
        ];
    }
});

tests.push({
    cardId: 'BT02-071-Entry-Behavior',
    name: 'Entry recycles items then destroys encounter',
    description: 'BT02-071 should move selected items from trash to deck and destroy encounter unit.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        p1.trash = [getCard('BT02-078'), getCard('BT02-079')];
        p1.hand = [getCard('BT02-071')];
        p1.leaderLevel = 10;
        p2.unitZones[0].unit = getCard('ST01-002');
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const p2 = engine.state.players[1];
        engine.playUnit(0, 0);
        autoResolveInteractions(engine);
        return [
            { pass: p2.unitZones[0].unit === null, message: 'encounter unit destroyed after entry sequence' },
            { pass: p1.deck.some(card => card.id === 'BT02-078' || card.id === 'BT02-079'), message: 'selected items moved into deck' },
            { pass: !p1.trash.some(card => card.id === 'BT02-078' || card.id === 'BT02-079'), message: 'selected items removed from trash' }
        ];
    }
});

tests.push({
    cardId: 'BT02-071-Trigger-Behavior',
    name: 'Trigger returns self to hand (071)',
    description: 'BT02-071 trigger should return itself from damage to hand.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-071')];
        p1.hand = [];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.dealDamage(p1, 1);
        return [
            { pass: p1.hand.some(card => card.id === 'BT02-071'), message: 'trigger card returned to hand' },
            { pass: p1.damage.every(card => card.id !== 'BT02-071'), message: 'trigger card removed from damage zone' }
        ];
    }
});

tests.push({
    cardId: 'BT02-072-Passive-Behavior',
    name: 'Passive grants +1 hit when equipped',
    description: 'BT02-072 should gain +1 hit while equipped.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('BT02-072');
        p1.unitZones[0].items = [getCard('BT02-078')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const raw = p1.unitZones[0].unit?.hit ?? 0;
        const hit = engine.getUnitHit(p1.unitZones[0], p1);
        return [{ pass: hit >= raw + 1, message: 'equipped passive +1 hit applied' }];
    }
});

tests.push({
    cardId: 'BT02-073-Active-Behavior',
    name: 'Active swaps damage item with hand card',
    description: 'BT02-073 should swap one damage-zone item with one hand card.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.damage = [getCard('BT02-078')];
        p1.hand = [getCard('BT02-073'), getCard('ST01-002')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playSkill(0);
        autoResolveInteractions(engine);
        return [
            { pass: p1.hand.some(card => card.id === 'BT02-078'), message: 'damage item moved to hand' },
            { pass: p1.damage.length === 1 && p1.damage[0].id === 'ST01-002', message: 'hand card moved to damage zone' }
        ];
    }
});

tests.push({
    cardId: 'BT02-074-Active-Behavior',
    name: 'Active searches Unique item from deck',
    description: 'BT02-074 active should search deck for a matching Unique item.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [getCard('ST01-002'), getCard('BT02-078')];
        p1.hand = [getCard('BT02-074')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playSkill(0);
        autoResolveInteractions(engine);
        return [{ pass: p1.hand.some(card => card.id === 'BT02-078'), message: 'unique item searched to hand' }];
    }
});

tests.push({
    cardId: 'BT02-074-Trigger-Behavior',
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
    cardId: 'BT02-075-Active-Behavior',
    name: 'Active moves equipped item to deck bottom',
    description: 'BT02-075 should remove one equipped item and place it on deck bottom.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('ST01-002');
        p1.unitZones[0].items = [getCard('BT02-078')];
        p1.hand = [getCard('BT02-075')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playSkill(0);
        autoResolveInteractions(engine);
        const bottom = p1.deck[0];
        return [
            { pass: p1.unitZones[0].items.length === 0, message: 'equipped item removed from field' },
            { pass: !!bottom && bottom.id === 'BT02-078', message: 'equipped item moved to deck bottom' }
        ];
    }
});

tests.push({
    cardId: 'BT02-076-Active-Behavior',
    name: 'Active recovers item cost 1 or less',
    description: 'BT02-076 should recover a cost 1 or less item from trash.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.trash = [getCard('BT02-079')];
        p1.hand = [getCard('BT02-076')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playSkill(0);
        autoResolveInteractions(engine);
        return [{ pass: p1.hand.some(card => card.id === 'BT02-079'), message: 'low-cost item recovered to hand' }];
    }
});

tests.push({
    cardId: 'BT02-077-Active-Behavior',
    name: 'Active reveals top 5 and takes all items',
    description: 'BT02-077 should add all revealed item cards to hand.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.deck = [
            getCard('BT02-078'),
            getCard('ST01-002'),
            getCard('BT02-079'),
            getCard('ST01-003'),
            getCard('BT02-080')
        ];
        p1.hand = [getCard('BT02-077')];
        p1.leaderLevel = 10;
        engine.state.phase = Phase.MAIN;
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        engine.playSkill(0);
        autoResolveInteractions(engine);
        return [
            { pass: p1.hand.some(card => card.id === 'BT02-078'), message: 'first revealed item added to hand' },
            { pass: p1.hand.some(card => card.id === 'BT02-079'), message: 'second revealed item added to hand' },
            { pass: p1.hand.some(card => card.id === 'BT02-080'), message: 'third revealed item added to hand' }
        ];
    }
});

tests.push({
    cardId: 'BT02-079-Attacker-Behavior',
    name: 'Attacker item grants +2000 power',
    description: 'BT02-079 should grant host +2000 power at attacker timing.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        p1.unitZones[0].unit = getCard('ST01-002');
        p1.unitZones[0].items = [getCard('BT02-079')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const before = engine.getUnitPower(p1.unitZones[0], p1);
        processAttackerEffects(engine, 0, 0);
        const after = engine.getUnitPower(p1.unitZones[0], p1);
        return [{ pass: after >= before + 2000, message: 'attacker item +2000 applied' }];
    }
});

tests.push({
    cardId: 'BT02-080-Passive-Behavior',
    name: 'Passive gives +3000 when host has Armed keyword',
    description: 'BT02-080 should buff host power when host has required keyword.',
    setup: (engine, getCard) => {
        const p1 = engine.state.players[0];
        const armedKeyword = getKeywordFilterValue(getCard, 'BT02-080', 0);
        const host = getCard('ST01-002');
        host.keywords = armedKeyword;
        p1.unitZones[0].unit = host;
        p1.unitZones[0].items = [getCard('BT02-080')];
    },
    verify: (engine) => {
        const p1 = engine.state.players[0];
        const raw = p1.unitZones[0].unit?.power ?? 0;
        const power = engine.getUnitPower(p1.unitZones[0], p1);
        return [{ pass: power >= raw + 3000, message: 'armed host +3000 applied' }];
    }
});

tests.push({
    cardId: 'BT02-081-Passive-Behavior',
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

export const BT02Module: UnifiedTestModule = {
    packId: 'BT02',
    displayName: 'BT02 Unified Tests',
    tests
};

export default tests;
