import { describe, expect, it } from 'vitest';
import { ActivationCondition, Attribute, CardType, Phase, TargetSchema } from '../../src/logic/types';
import { createGameUxCheckpoint } from './helpers/game_ux_harness';

function makeHandCard(id: string) {
    return {
        id,
        name: `핸드 카드 ${id}`,
        type: CardType.UNIT,
        attribute: Attribute.FIRE,
        cost: 1,
        power: 1000,
        hit: 1000,
        text: '',
        effects: [],
    };
}

describe('game UX snapshot harness', () => {
    it('builds main-phase action visibility with enabled and blocked reasons', () => {
        const engine = createGameUxCheckpoint('P1_MAIN_AFTER_MULLIGAN');

        const snapshot = engine.getUiSnapshot('P1');
        const enabledPlacement = snapshot.visibleActions.find(action =>
            action.actionType === 'PLAY_UNIT' &&
            action.enabled &&
            action.label.includes('신병 배치 -> 2라인 일반 배치'),
        );
        const blockedUpgrade = snapshot.visibleActions.find(action =>
            action.actionType === 'PLAY_UNIT' &&
            action.label.includes('신병 배치 -> 1라인 업그레이드'),
        );
        const sizeBlockedPlacement = snapshot.visibleActions.find(action =>
            action.actionType === 'PLAY_UNIT' &&
            action.label.includes('대형 증원 -> 2라인 일반 배치'),
        );
        const spentActive = snapshot.visibleActions.find(action =>
            action.actionType === 'ACTIVATE_EFFECT' &&
            action.label.includes('1라인 액티브'),
        );

        expect(snapshot.timingWindow.phase).toBe(Phase.MAIN);
        expect(snapshot.timingWindow.phaseLabel).toBe('메인');
        expect(enabledPlacement?.enabled).toBe(true);
        expect(blockedUpgrade?.enabled).toBe(false);
        expect(blockedUpgrade?.reason).toBe('이 라인은 이번 턴 일반 배치/업그레이드를 이미 사용했습니다.');
        expect(sizeBlockedPlacement?.enabled).toBe(false);
        expect(sizeBlockedPlacement?.reason).toBe('현재 사이즈를 초과합니다.');
        expect(spentActive?.enabled).toBe(false);
        expect(spentActive?.reason).toBe('이번 턴에 이미 사용한 액티브입니다.');
        expect(snapshot.auditTrail[0]?.detail).toContain('메인 페이즈 배치/업그레이드 판단 준비');
    });

    it('builds attack timing snapshot with declaration-step clarity', () => {
        const engine = createGameUxCheckpoint('ATTACK_DECLARE_WINDOW');

        const snapshot = engine.getUiSnapshot('P1');
        const readyAttack = snapshot.visibleActions.find(action =>
            action.actionType === 'ATTACK' &&
            action.label.includes('1라인 공격 선언'),
        );
        const exhaustedAttack = snapshot.visibleActions.find(action =>
            action.actionType === 'ATTACK' &&
            action.label.includes('2라인 공격 선언'),
        );
        const spentAttack = snapshot.visibleActions.find(action =>
            action.actionType === 'ATTACK' &&
            action.label.includes('3라인 공격 선언'),
        );

        expect(snapshot.timingWindow.phase).toBe(Phase.ATTACK);
        expect(snapshot.timingWindow.combatStep).toBe('ATTACK_DECLARATION');
        expect(snapshot.timingWindow.combatStepLabel).toBe('공격 선언');
        expect(readyAttack?.enabled).toBe(true);
        expect(exhaustedAttack?.reason).toBe('이 유닛은 Exhaust 상태입니다.');
        expect(spentAttack?.reason).toBe('이 유닛은 이번 턴 이미 공격했습니다.');
    });

    it('builds mandatory target-selection queue and audit trail from pending entry effect', () => {
        const engine = createGameUxCheckpoint('MANDATORY_TARGET_SELECTION');

        const snapshot = engine.getUiSnapshot('P1');
        const confirmAction = snapshot.visibleActions.find(action => action.actionType === 'CONFIRM_TARGETS');

        expect(snapshot.timingWindow.awaitingMandatory).toBe(true);
        expect(snapshot.timingWindow.interactionMode).toBe('SELECT_TARGET');
        expect(snapshot.mandatoryQueue[0]).toMatchObject({
            title: '강제 대상 선택',
            reason: '이 유닛이 유닛 존에 등장했기 때문에 발동',
            sourceCardName: '엔트리 병사',
            controllerPlayerId: 'P1',
            actionType: 'DESTROY_UNIT',
        });
        expect(confirmAction?.enabled).toBe(false);
        expect(confirmAction?.reason).toBe('필요한 대상을 모두 선택하면 확정할 수 있습니다.');
        expect(snapshot.auditTrail[0]?.title).toBe('입력 대기');
        expect(snapshot.auditTrail[0]?.detail).toContain('대상 선택 창이 열렸습니다.');
    });

    it('surfaces end-phase hand adjustment as a mandatory discard interaction', () => {
        const engine = createGameUxCheckpoint('P1_MAIN_AFTER_MULLIGAN');
        const actor = engine.currentPlayer;
        const opponent = engine.opponentPlayer;
        const discardSchema: TargetSchema = {
            scope: 'MY_HAND',
            type: 'CARD',
            count: 1,
            selectMode: 'MANUAL',
        };
        const endPhaseEffect = {
            id: 'end-phase-hand-adjust',
            activation: ActivationCondition.TURN_END,
            description: '핸드 제한(7장)까지 버릴 카드 지정',
            targets: discardSchema,
            action: { type: 'TRASH_SELF', params: {} },
        };

        actor.hand = Array.from({ length: 8 }, (_, index) => makeHandCard(`E${index + 1}`));
        engine.state.phase = Phase.END;
        engine.state.interactionMode = 'SELECT_TARGET';
        engine.state.pendingEffect = {
            sourceCard: actor.levelZone!,
            sourcePlayerId: actor.id,
            controllerPlayerId: actor.id,
            actionType: 'END_PHASE_HAND_ADJUST',
            actionValue: { requiredDiscardCount: 1 },
            effectDescription: endPhaseEffect.description,
            triggerReason: '턴 종료 규칙 처리',
            selectionPurpose: '핸드 제한(7장)까지 버릴 카드 지정',
            validTargets: 'MY_HAND',
            targetSchema: discardSchema,
            selectedTargets: [],
        };
        engine.setPendingRuntime({
            sourceCard: actor.levelZone!,
            player: actor,
            opponent,
            machine: engine,
            sourceActivation: ActivationCondition.TURN_END,
            sourceEffectDescription: endPhaseEffect.description,
        }, endPhaseEffect);
        engine.setInteractionOwner(actor.id);
        (engine as any).uiTraceHistory.length = 0;

        const snapshot = engine.getUiSnapshot(actor.id);

        expect(snapshot.timingWindow.phase).toBe(Phase.END);
        expect(snapshot.mandatoryQueue[0]?.reason).toBe('턴 종료 규칙 처리');
        expect(snapshot.mandatoryQueue[0]?.preview).toBe('핸드 제한(7장)까지 버릴 카드 지정');
        expect(snapshot.auditTrail[0]?.title).toBe('효과 해결 대기');
    });

    it('adds a deck-zero warning without declaring immediate defeat', () => {
        const engine = createGameUxCheckpoint('P1_MAIN_AFTER_MULLIGAN');
        engine.currentPlayer.deck = [];

        const snapshot = engine.getUiSnapshot('P1');
        const warning = snapshot.visibleActions.find(action => action.group === 'SYSTEM' && action.label === '덱 상태 경고');

        expect(warning?.enabled).toBe(false);
        expect(warning?.reason).toBe('덱은 0장이지만 즉시 패배는 아닙니다. 다음 드로우 요구가 발생하면 패배합니다.');
        expect(snapshot.timingWindow.phaseLabel).toBe('메인');
    });
});
