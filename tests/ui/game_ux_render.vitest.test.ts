import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderGameUxCheckpoint } from './helpers/game_ux_harness';

vi.mock('../../src/ui/screens/gameBindings', () => ({
    attachListeners: vi.fn(),
}));

vi.mock('../../src/ui/gameLoop', () => ({
    canLocalHumanInput: vi.fn(() => true),
    clearAutoPhaseAdvanceTimer: vi.fn(),
    getActionOwnerPlayerId: vi.fn((engine: any) => engine.state.interactionOwnerPlayerId ?? engine.currentPlayer.id),
    getBotLabelForPlayerId: vi.fn(() => 'Bot'),
    isBotControlledPlayer: vi.fn(() => false),
    scheduleAutoPhaseAdvance: vi.fn(),
    scheduleBotStep: vi.fn(),
    shouldRevealHandForPlayer: vi.fn(() => true),
}));

describe('game UX render harness', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('renders the top phase ribbon for the first main phase', { timeout: 10000 }, async () => {
        await renderGameUxCheckpoint('P1_MAIN_AFTER_MULLIGAN');

        const ribbonLabels = Array.from(document.querySelectorAll('[data-testid="phase-ribbon-label"]')).map(node => node.textContent?.trim());
        const activeStep = document.querySelector('[data-testid="phase-ribbon-step"].active [data-testid="phase-ribbon-label"]')?.textContent?.trim();

        expect(ribbonLabels).toEqual(['레벨업', '드로우', '메인', '어택', '엔드']);
        expect(activeStep).toBe('메인');
        expect(document.querySelector('[data-testid="phase-ribbon"]')).toBeTruthy();
    });

    it('renders attack sub-steps with current declaration highlighted', { timeout: 10000 }, async () => {
        await renderGameUxCheckpoint('ATTACK_DECLARE_WINDOW');

        const stepLabels = Array.from(document.querySelectorAll('.attack-step-chip')).map(node => node.textContent?.trim());
        const activeStep = document.querySelector('.attack-step-chip.active')?.textContent?.trim();

        expect(stepLabels).toEqual(['공격 선언', '방어 선언', '전투/대미지', '전투 종료']);
        expect(activeStep).toBe('공격 선언');
    });

    it('renders action availability with enabled and disabled reasons', { timeout: 10000 }, async () => {
        await renderGameUxCheckpoint('P1_MAIN_AFTER_MULLIGAN');

        const text = document.body.textContent || '';
        const playGroup = document.querySelector('[data-testid="ux-action-group-PLAY"]');
        const legalSubject = document.querySelector('[data-subject-key*="UX-HAND-LEGAL"]');
        const disabledSummary = document.querySelector('[data-testid="ux-action-disabled-summary"]');

        expect(text).toContain('지금 할 수 있는 행동');
        expect(playGroup?.textContent).toContain('신병 배치');
        expect(playGroup?.textContent).toContain('대형 증원');
        expect(legalSubject).toBeTruthy();
        expect(disabledSummary).toBeTruthy();
        expect(text).toContain('현재 사이즈를 초과합니다.');
        expect(text).toContain('이 라인은 이번 턴 일반 배치/업그레이드를 이미 사용했습니다.');
        expect(text).toContain('이번 턴에 이미 사용한 액티브입니다.');
    });

    it('renders a visible mandatory queue during forced target selection', { timeout: 10000 }, async () => {
        await renderGameUxCheckpoint('MANDATORY_TARGET_SELECTION');

        const queue = document.querySelector('.mandatory-queue-panel');
        const text = document.body.textContent || '';

        expect(queue).toBeTruthy();
        expect(text).toContain('해결 대기열');
        expect(text).toContain('강제 대상 선택');
        expect(text).toContain('엔트리 병사');
        expect(text).toContain('이 유닛이 유닛 존에 등장했기 때문에 발동');
        expect(document.querySelector('[data-testid="mandatory-queue-progress"]')?.textContent).toContain('0 / 1 선택');
    });

    it('renders audit trail copy with timing and cause context', { timeout: 10000 }, async () => {
        await renderGameUxCheckpoint('P1_MAIN_AFTER_MULLIGAN');

        const text = document.body.textContent || '';

        expect(text).toContain('판정 요약');
        expect(text).toContain('효과 실행');
        expect(text).toContain('메인 페이즈 배치/업그레이드 판단 준비');
        expect(text).toContain('턴 1');
    });

    it('renders phase toasts in the lower control column instead of the top chrome', { timeout: 10000 }, async () => {
        const { uiState, renderGame } = await renderGameUxCheckpoint('P1_MAIN_AFTER_MULLIGAN');
        uiState.playback.toasts = [{
            id: 'toast-phase-main',
            message: '페이즈 전환: 메인',
            createdAtMs: Date.now(),
            expiresAtMs: Date.now() + 10000,
            kind: 'PHASE',
        }];

        renderGame();

        expect(document.querySelector('.game-controls [data-testid="ux-toast-stack"]')).toBeTruthy();
        expect(document.querySelector('.game-top-bar [data-testid="ux-toast-stack"]')).toBeNull();
        expect(document.querySelector('[data-testid="ux-toast-item"]')?.getAttribute('data-toast-kind')).toBe('PHASE');
    });
});
