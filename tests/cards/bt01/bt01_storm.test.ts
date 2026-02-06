/**
 * BT01 Storm Attribute Card Tests (BT01-055 to BT01-081)
 * 
 * Leader: BT01-055 (Snow White)
 * Units: BT01-056 to BT01-073
 * Skills: BT01-074 to BT01-079
 * Items: BT01-080 to BT01-081
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../../src/logic/GameEngine';
import { Phase, ActivationCondition } from '../../../src/logic/types';
import { DUMMY_CARDS } from '../../../src/logic/CardDatabase';
import {
    getCard,
    createGame,
    placeUnit,
    equipItem,
    addToHand,
    setPhase,
    awakenLeader,
    setLeaderLevel,
    getUnitPower,
    getUnitHit,
    hasUnit,
    damageCount,
    handSize,
    isInTrash
} from '../../helpers/test_helpers';

describe('BT01 Storm Attribute', () => {
    describe('BT01-055: Snow White (Leader)', () => {
        it('should awaken at leader level 5', () => {
            const engine = createGame('BT01-055');
            const player = engine.currentPlayer;

            expect(player.levelZone?.isAwakened).toBeFalsy();

            player.leaderLevel = 4;
            engine.state.phase = Phase.LEVEL_UP;
            engine.nextPhase();

            expect(player.leaderLevel).toBe(5);
            expect(player.levelZone?.isAwakened).toBe(true);
        });

        it('should draw a card when 5+ cost unit is trashed (awakened)', () => {
            const engine = createGame('BT01-055');
            const player = engine.currentPlayer;

            player.levelZone!.isAwakened = true;

            // Place 5-cost unit
            const expensiveUnit = placeUnit(engine, 'ST03-002', 0);
            expensiveUnit.cost = 5;

            // Setup deck for draw
            engine.currentPlayer.deck = [getCard('ST03-002'), getCard('ST03-002')];

            const initialHandSize = handSize(engine);

            // Destroy the unit
            engine.destroyUnit(player, player.unitZones[0]);

            // Should have drawn a card
            expect(handSize(engine)).toBe(initialHandSize + 1);
        });
    });

    describe('BT01-056: Dorothy (Exit: Debuff enemy)', () => {
        it('should debuff opponent unit by -2000 on exit', () => {
            const engine = createGame('BT01-055');

            // Place unit with Exit effect
            placeUnit(engine, 'BT01-056', 0);

            // Place opponent unit
            const oppUnit = placeUnit(engine, 'ST03-002', 0, true);
            const basePower = oppUnit.power!;

            // Destroy the Dorothy unit
            engine.destroyUnit(engine.currentPlayer, engine.currentPlayer.unitZones[0]);

            // Should be in target selection for debuff
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTarget(0, true);
            }

            const actualPower = getUnitPower(engine, 0, true);
            expect(actualPower).toBe(basePower - 2000);
        });
    });

    describe('BT01-058: Privaty (Defender: Terminate)', () => {
        it('should terminate attack when defending', () => {
            const engine = createGame('BT01-055');

            // Place defender with Terminate
            placeUnit(engine, 'BT01-058', 0, true);

            // Place attacker
            const attacker = placeUnit(engine, 'ST03-002', 0);
            attacker.power = 10000;

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);

            // Choose to block
            engine.resolveBlock(true);

            // Terminate should end attack, defender is trashed
            expect(hasUnit(engine, 0, true)).toBe(false);
            // Attacker should survive
            expect(hasUnit(engine, 0)).toBe(true);
        });
    });

    describe('BT01-067: D (Exit: Mutual Destruction)', () => {
        it('should destroy attacker if cost is equal or lower', () => {
            const engine = createGame('BT01-055');

            // Place D (cost 3 with Mutual Destruction)
            const d = placeUnit(engine, 'BT01-067', 0, true);
            d.cost = 3;
            d.power = 1000;

            // Place attacker with equal cost
            const attacker = placeUnit(engine, 'ST03-002', 0);
            attacker.cost = 3;
            attacker.power = 5000;

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            engine.resolveBlock(true);

            // Both should be destroyed
            expect(hasUnit(engine, 0)).toBe(false);
            expect(hasUnit(engine, 0, true)).toBe(false);
        });
    });

    describe('BT01-068: Tia (Exit: Draw 2, discard 1)', () => {
        it('should draw 2 then discard 1 on exit', () => {
            const engine = createGame('BT01-055');
            placeUnit(engine, 'BT01-068', 0);

            engine.currentPlayer.deck = [
                getCard('ST03-002'),
                getCard('ST03-002'),
                getCard('ST03-002')
            ];

            const initialHandSize = handSize(engine);
            engine.destroyUnit(engine.currentPlayer, engine.currentPlayer.unitZones[0]);

            // Select one of the revealed cards to discard
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectRevealedTarget(0);
            }

            // Draw 2, discard 1 => net +1
            expect(handSize(engine)).toBe(initialHandSize + 1);
        });
    });

    describe('BT01-069: K (Entry: Destroy 2-cost encounter)', () => {
        it('should have Entry effect registered', () => {
            const k = getCard('BT01-069');

            expect(k.effects).toBeDefined();
            expect(k.effects!.some(e => e.activation === ActivationCondition.ENTRY)).toBe(true);
        });

        it('should NOT destroy encounter if 3+ cost', () => {
            const engine = createGame('BT01-055');

            const oppUnit = placeUnit(engine, 'ST03-002', 0, true);
            oppUnit.cost = 3;

            const k = getCard('BT01-069');
            engine.currentPlayer.hand = [k];
            engine.state.phase = Phase.MAIN;
            setLeaderLevel(engine, 10);
            engine.playUnit(0, 0);

            // Encounter should survive
            expect(hasUnit(engine, 0, true)).toBe(true);
        });
    });

    describe('BT01-070: Belorta (Defender: Terminate)', () => {
        it('should terminate attack as defender', () => {
            const engine = createGame('BT01-055');

            placeUnit(engine, 'BT01-070', 0, true);

            const attacker = placeUnit(engine, 'ST03-002', 0);
            attacker.power = 10000;

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            engine.resolveBlock(true);

            // Defender trashed, attacker survives
            expect(hasUnit(engine, 0, true)).toBe(false);
            expect(hasUnit(engine, 0)).toBe(true);
        });
    });

    describe('BT01-072: Sin (Passive: Grant Exit Draw to others)', () => {
        it('should let other units draw 1 on exit', () => {
            const engine = createGame('BT01-055');
            placeUnit(engine, 'BT01-072', 0);
            placeUnit(engine, 'ST03-002', 1);

            engine.currentPlayer.deck = [
                getCard('ST03-002'),
                getCard('ST03-002')
            ];

            const initialHandSize = handSize(engine);
            engine.effectManager.processEffects(ActivationCondition.PASSIVE, {
                sourceCard: engine.currentPlayer.unitZones[0].unit!,
                player: engine.currentPlayer,
                opponent: engine.opponentPlayer,
                unitZone: engine.currentPlayer.unitZones[0],
                machine: engine
            });
            engine.destroyUnit(engine.currentPlayer, engine.currentPlayer.unitZones[1]);

            expect(handSize(engine)).toBe(initialHandSize + 1);
        });
    });
});

describe('BT01 Storm Skills', () => {
    describe('BT01-075: Precision Strike (Cost-based destroy)', () => {
        it('should have ACTIVE effect with target selection', () => {
            const skill = getCard('BT01-075');

            expect(skill.effects).toBeDefined();
            expect(skill.effects!.some(e => e.activation === ActivationCondition.ACTIVE)).toBe(true);
        });
    });

    describe('BT01-076: Exit Buff (+4500 to 공멸 unit)', () => {
        it('should have ACTIVE effect registered', () => {
            const skill = getCard('BT01-076');

            expect(skill.effects).toBeDefined();
            expect(skill.effects!.some(e => e.activation === ActivationCondition.ACTIVE)).toBe(true);
        });
    });

    describe('BT01-078: Mass Destruction (Destroy up to 2, total 4 cost)', () => {
        it('should have ACTIVE effect registered', () => {
            const skill = getCard('BT01-078');

            expect(skill.effects).toBeDefined();
            expect(skill.effects!.some(e => e.activation === ActivationCondition.ACTIVE)).toBe(true);
        });
    });

    describe('BT01-079: Exit Recovery (Recover 2 Exit units)', () => {
        it('should have ACTIVE effect registered', () => {
            const skill = getCard('BT01-079');

            expect(skill.effects).toBeDefined();
            expect(skill.effects!.some(e => e.activation === ActivationCondition.ACTIVE)).toBe(true);
        });
    });
});

describe('BT01 Storm Items', () => {
    describe('BT01-080: Storm Cloak (Exit: Draw 2)', () => {
        it('should have Exit effect registered', () => {
            const item = getCard('BT01-080');

            expect(item.effects).toBeDefined();
            expect(item.effects!.some(e => e.activation === ActivationCondition.EXIT)).toBe(true);
        });

        it('should draw cards on equipped unit exit', () => {
            const engine = createGame('BT01-055');

            const unit = placeUnit(engine, 'ST03-002', 0);
            equipItem(engine, 'BT01-080', 0);

            engine.currentPlayer.deck = [
                getCard('ST03-002'),
                getCard('ST03-002'),
                getCard('ST03-002')
            ];

            const initialHandSize = handSize(engine);

            engine.destroyUnit(engine.currentPlayer, engine.currentPlayer.unitZones[0]);

            // Should have drawn at least 1 card (effect triggered)
            expect(handSize(engine)).toBeGreaterThan(initialHandSize);
        });
    });

    describe('BT01-081: Phoenix Feather (Exit: Return at turn end)', () => {
        it('should return to hand at end of turn', () => {
            const engine = createGame('BT01-055');

            const unit = placeUnit(engine, 'ST03-002', 0);
            equipItem(engine, 'BT01-081', 0);

            engine.destroyUnit(engine.currentPlayer, engine.currentPlayer.unitZones[0]);

            engine.state.phase = Phase.END;
            engine.nextPhase();

            expect(engine.currentPlayer.hand.some(c => c.id === 'BT01-081')).toBe(true);
        });
    });
});

