import { describe, it, expect, beforeEach } from 'vitest';
import {
    createGame,
    getCard,
    placeUnit,
    playUnit,
    handSize,
    setPhase,
    setLeaderLevel,
    awakenLeader,
    getUnitPower,
    getUnitHit,
    damageCount,
    equipItem
} from '../../helpers/test_helpers';
import { Phase, ActivationCondition } from '../../../src/logic/types';

describe('ST03 Storm Starter Deck', () => {
    describe('Leader: ST03-001 Modernia', () => {
        it('should awaken and buff EXIT units', () => {
            const engine = createGame('ST03-001');
            const player = engine.currentPlayer;

            awakenLeader(engine);

            // Privaty (ST03-003) has EXIT activation. Modernia buffs EXIT units by +1000.
            placeUnit(engine, 'ST03-003', 0); // Privaty 500

            // 500 + 1000 = 1500
            expect(getUnitPower(engine, 0)).toBe(1500);
        });
    });

    describe('Units', () => {
        it('ST03-003 Privaty: should discard opponent hand on EXIT', () => {
            const engine = createGame('ST03-001');
            const opponent = engine.opponentPlayer;
            const trashMe = getCard('ST03-002');
            opponent.hand = [trashMe];

            placeUnit(engine, 'ST03-003', 0);
            engine.destroyUnit(engine.currentPlayer, engine.currentPlayer.unitZones[0]);

            expect(engine.state.interactionMode).toBe('SELECT_TARGET');
            engine.selectHandTarget(0, true); // Select from opponent hand

            expect(opponent.hand).toHaveLength(0);
            expect(opponent.trash).toContainEqual(expect.objectContaining({ id: trashMe.id }));
        });

        it('ST03-007 D: should have Mutual Destruction', () => {
            const engine = createGame('ST03-001');
            placeUnit(engine, 'ST03-002', 0); // 3000 Pwr
            placeUnit(engine, 'ST03-007', 0, true); // D (Mutual Destruction)

            // Make attacker stronger to trash D
            engine.currentPlayer.unitZones[0].unit!.power = 5000;

            setPhase(engine, Phase.ATTACK);
            engine.attack(0);
            engine.resolveBlock(true);

            expect(engine.currentPlayer.unitZones[0].unit).toBeNull(); // Both should be trashed
            expect(engine.opponentPlayer.unitZones[0].unit).toBeNull();
        });

        it('ST03-011 Modernia: should trash encounter unit on entry (Cost: Trash All Hand)', () => {
            const engine = createGame('ST03-001');
            const player = engine.currentPlayer;
            placeUnit(engine, 'ST03-002', 0, true); // Enemy unit

            player.hand = [getCard('ST03-002'), getCard('ST03-002')]; // Hand for cost
            setLeaderLevel(engine, 10);
            playUnit(engine, 'ST03-011', 0);

            // Modernia Entry is optional
            expect(engine.state.interactionMode).toBe('SELECT_OPTIONAL');
            engine.resolveOptionalEffect(true);

            expect(player.hand).toHaveLength(0);
            expect(engine.opponentPlayer.unitZones[0].unit).toBeNull();
        });
    });

    describe('Skills', () => {
        it('ST03-012 Surprise Attack: should trash from both hands', () => {
            const engine = createGame('ST03-001');
            const player = engine.currentPlayer;
            const opponent = engine.opponentPlayer;

            player.hand = [getCard('ST03-002')];
            opponent.hand = [getCard('ST03-002')];
            setLeaderLevel(engine, 10);

            const skill = getCard('ST03-012');
            player.hand.push(skill);

            setPhase(engine, Phase.MAIN);
            engine.playSkill(player.hand.length - 1);

            expect(engine.state.interactionMode).toBe('SELECT_TARGET');
            engine.selectHandTarget(0, false); // My hand

            expect(engine.state.interactionMode).toBe('SELECT_TARGET');
            engine.selectHandTarget(0, true); // Opponent hand

            expect(player.hand).toHaveLength(0);
            expect(opponent.hand).toHaveLength(0);
        });

        it('ST03-015 Come On!: should trash own unit and encounter unit', () => {
            const engine = createGame('ST03-001');
            const player = engine.currentPlayer;
            placeUnit(engine, 'ST03-002', 0);
            placeUnit(engine, 'ST03-002', 0, true);

            setLeaderLevel(engine, 10);
            player.hand = [getCard('ST03-015')];

            setPhase(engine, Phase.MAIN);
            engine.playSkill(0);

            expect(engine.state.interactionMode).toBe('SELECT_TARGET');
            engine.selectTarget(0, false); // My unit

            expect(engine.currentPlayer.unitZones[0].unit).toBeNull();
            expect(engine.opponentPlayer.unitZones[0].unit).toBeNull();
        });
    });

    describe('Items', () => {
        it('ST03-016 Kevlar Vest: should end battle on defense', () => {
            const engine = createGame('ST03-001');
            placeUnit(engine, 'ST03-002', 0); // 3000 Power
            placeUnit(engine, 'ST03-002', 0, true);
            equipItem(engine, 'ST03-016', 0, true); // Vest on opponent

            setPhase(engine, Phase.ATTACK);
            engine.attack(0);
            engine.resolveBlock(true);

            expect(engine.opponentPlayer.unitZones[0].unit).toBeNull(); // Blocker destroyed by item
            expect(engine.currentPlayer.unitZones[0].unit).not.toBeNull(); // Attacker survived
        });
    });
});
