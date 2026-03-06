import { Phase, Card, GameState, PendingEffect } from '../../logic/types';
import { PHASE_THEME_CLASSES, Screen, uiState } from '../appState';
import {
    canLocalHumanInput,
    clearAutoPhaseAdvanceTimer,
    getActionOwnerPlayerId,
    getBotLabelForPlayerId,
    isBotControlledPlayer,
    scheduleAutoPhaseAdvance,
    scheduleBotStep,
    shouldRevealHandForPlayer,
} from '../gameLoop';
import { shouldDelayInteractionModal } from '../playbackOrchestrator';
import { getBottomPlayer, getTopPlayer } from '../playerPerspective';
import { attachListeners } from './gameBindings';

const MIN_BATTLE_SCALE = 0.58;
const AUTO_LOG_COLLAPSE_HEIGHT_THRESHOLD = 980;
const AUTO_LOG_COLLAPSE_WIDTH_THRESHOLD = 1680;
const MOBILE_PORTRAIT_WIDTH_THRESHOLD = 1200;
const BATTLE_BOARD_WIDTH_PX = 760;
const HAND_ZONE_HORIZONTAL_PADDING_PX = 28;
const HAND_CARD_WIDTH_PX = 130;
const HAND_CARD_MAX_GAP_PX = 8;
const HAND_CARD_MIN_STEP_PX = 24;
const DAMAGE_CARD_WIDTH_PX = 70;
const DAMAGE_STACK_VISIBLE_WIDTH_PX = 220;
const DAMAGE_CARD_MAX_STEP_PX = 54;
const DAMAGE_CARD_MIN_STEP_PX = 16;
const SKILL_ZONE_PROMPT_ACTION_TYPES = new Set<string>([
    'BT06_SELECT_SKILL_ZONE_CARD',
    'BT03_SELECT_SKILL_ZONE_CARD_TO_TRASH',
    'BT03_011_SELECT_SKILL_ZONE_CARD_TO_TRASH',
    'BT03_052_SELECT_SKILL_ZONE_COST3_TO_TRASH',
    'BT03_062_SELECT_SKILL_ZONE_TO_CAST',
    'SB01_001_SELECT_SKILL_ZONE_TO_TRASH',
]);

let gameResizeRafId: number | null = null;
let gameResizeListenerBound = false;
let boundVisualViewport: VisualViewport | null = null;

export interface BattleScaleInput {
    naturalWidth: number;
    naturalHeight: number;
    availableWidth: number;
    availableHeight: number;
    minScale?: number;
}

export function computeBattleScale(input: BattleScaleInput): number {
    const minScale = input.minScale ?? MIN_BATTLE_SCALE;
    if (input.naturalWidth <= 0 || input.naturalHeight <= 0) return 1;
    if (input.availableWidth <= 0 || input.availableHeight <= 0) return minScale;

    const scaleX = input.availableWidth / input.naturalWidth;
    const scaleY = input.availableHeight / input.naturalHeight;
    const unclamped = Math.min(scaleX, scaleY, 1);

    if (!Number.isFinite(unclamped) || unclamped <= 0) return minScale;
    return Math.max(minScale, unclamped);
}

export interface AutoCollapseLogInput {
    viewportWidth: number;
    viewportHeight: number;
    widthThreshold?: number;
    heightThreshold?: number;
}

export function shouldAutoCollapseLog(input: AutoCollapseLogInput): boolean {
    const widthThreshold = input.widthThreshold ?? AUTO_LOG_COLLAPSE_WIDTH_THRESHOLD;
    const heightThreshold = input.heightThreshold ?? AUTO_LOG_COLLAPSE_HEIGHT_THRESHOLD;
    return input.viewportWidth < widthThreshold || input.viewportHeight < heightThreshold;
}

export interface MobilePortraitLayoutInput {
    viewportWidth: number;
    viewportHeight: number;
    widthThreshold?: number;
}

export function shouldUseMobilePortraitLayout(input: MobilePortraitLayoutInput): boolean {
    const widthThreshold = input.widthThreshold ?? MOBILE_PORTRAIT_WIDTH_THRESHOLD;
    const hasValidViewport = input.viewportWidth > 0 && input.viewportHeight > 0;
    if (!hasValidViewport) return false;
    const isPortrait = input.viewportHeight > input.viewportWidth;
    return isPortrait && input.viewportWidth <= widthThreshold;
}

function computeDamageStackStep(cardCount: number): number {
    if (cardCount <= 1) return DAMAGE_CARD_WIDTH_PX;
    const idealStep = (DAMAGE_STACK_VISIBLE_WIDTH_PX - DAMAGE_CARD_WIDTH_PX) / (cardCount - 1);
    if (!Number.isFinite(idealStep) || idealStep <= 0) return DAMAGE_CARD_MIN_STEP_PX;
    return Math.max(DAMAGE_CARD_MIN_STEP_PX, Math.min(DAMAGE_CARD_MAX_STEP_PX, idealStep));
}

function getViewportMetrics(): { width: number; height: number } {
    const viewport = window.visualViewport;
    if (viewport && viewport.width > 0 && viewport.height > 0) {
        return {
            width: Math.round(viewport.width),
            height: Math.round(viewport.height),
        };
    }
    return {
        width: window.innerWidth,
        height: window.innerHeight,
    };
}

function applyAutoLogCollapsePolicy(): boolean {
    const viewport = getViewportMetrics();
    const autoCollapsed = shouldAutoCollapseLog({
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
    });
    const previousExpanded = uiState.gameLogView.expanded;

    uiState.gameLogView.autoCollapsed = autoCollapsed;
    if (uiState.gameLogView.manualOverride) return false;

    uiState.gameLogView.expanded = !autoCollapsed;
    return previousExpanded !== uiState.gameLogView.expanded;
}

function applyBattleLayoutScale() {
    const viewport = uiState.app.querySelector<HTMLElement>('.battle-fit-viewport');
    const content = uiState.app.querySelector<HTMLElement>('.battle-fit-content');
    if (!viewport || !content) return;

    content.style.setProperty('--battle-scale', '1');

    const naturalWidth = content.offsetWidth;
    const naturalHeight = content.offsetHeight;
    const availableWidth = viewport.clientWidth;
    const availableHeight = viewport.clientHeight;

    let scale = computeBattleScale({
        naturalWidth,
        naturalHeight,
        availableWidth,
        availableHeight,
    });

    // If clamp-based scale still clips content, force fit to keep lower hand visible.
    if (
        naturalWidth > 0 &&
        naturalHeight > 0 &&
        (naturalWidth * scale > availableWidth + 1 || naturalHeight * scale > availableHeight + 1)
    ) {
        const hardFitScale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight, 1);
        if (Number.isFinite(hardFitScale) && hardFitScale > 0) {
            scale = Math.max(0.45, hardFitScale);
        }
    }

    content.style.setProperty('--battle-scale', scale.toFixed(4));
}

function bindBattleAssetLoadReflow() {
    const content = uiState.app.querySelector<HTMLElement>('.battle-fit-content');
    if (!content) return;

    content.querySelectorAll('img').forEach((img) => {
        if (img.complete) return;
        img.addEventListener('load', handleGameResize, { once: true });
        img.addEventListener('error', handleGameResize, { once: true });
    });
}

function handleGameResize() {
    if (uiState.currentScreen !== Screen.GAME || !uiState.game) return;
    uiState.hoverPreview.hide();
    uiState.trashHoverOverlay?.hide();

    if (gameResizeRafId !== null) {
        window.cancelAnimationFrame(gameResizeRafId);
    }

    gameResizeRafId = window.requestAnimationFrame(() => {
        gameResizeRafId = null;
        const logStateChanged = applyAutoLogCollapsePolicy();
        if (logStateChanged) {
            uiState.render?.();
            return;
        }
        applyBattleLayoutScale();
    });
}

function ensureGameResizeListener() {
    if (!gameResizeListenerBound) {
        window.addEventListener('resize', handleGameResize);
        window.addEventListener('orientationchange', handleGameResize);
        window.addEventListener('scroll', handleGameResize, { passive: true });
        gameResizeListenerBound = true;
    }

    const viewport = window.visualViewport;
    if (viewport && viewport !== boundVisualViewport) {
        if (boundVisualViewport) {
            boundVisualViewport.removeEventListener('resize', handleGameResize);
            boundVisualViewport.removeEventListener('scroll', handleGameResize);
        }
        viewport.addEventListener('resize', handleGameResize);
        viewport.addEventListener('scroll', handleGameResize);
        boundVisualViewport = viewport;
    }
}

function isVerificationGame(): boolean {
    return !!uiState.verificationSession && uiState.currentScreen === Screen.GAME && !!uiState.game;
}

export function applyPhaseThemeClass(phase: Phase | null) {
    document.body.classList.remove(...PHASE_THEME_CLASSES);
    if (phase === null) return;

    const phaseClassMap: Record<Phase, string> = {
        [Phase.LEVEL_UP]: 'phase-theme-level-up',
        [Phase.DRAW]: 'phase-theme-draw',
        [Phase.MAIN]: 'phase-theme-main',
        [Phase.ATTACK]: 'phase-theme-attack',
        [Phase.BLOCK]: 'phase-theme-block',
        [Phase.END]: 'phase-theme-end',
    };

    document.body.classList.add(phaseClassMap[phase]);
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function resolveCardCostForDisplay(card: Card): number {
    const engine = uiState.game as any;
    if (engine && typeof engine.getCardCost === 'function') {
        return engine.getCardCost(card);
    }
    return Math.max(0, Number(card?.cost || 0));
}

function formatPlaybackLogTime(createdAtMs: number): string {
    const d = new Date(createdAtMs);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

function renderPlaybackLogPanel(): string {
    const isExpanded = uiState.gameLogView.expanded;
    const maxVisible = Math.max(1, uiState.gameLogView.maxVisibleEntries);
    const visibleEntries = uiState.playback.logEntries.slice(-maxVisible);
    const latestMessage = visibleEntries.length > 0
        ? escapeHtml(visibleEntries[visibleEntries.length - 1].message)
        : '아직 효과 로그가 없습니다.';

    return `
        <aside class="game-log-panel fx-log-panel ${isExpanded ? '' : 'collapsed'}">
            <div class="game-log-header fx-log-header">
                <div class="game-log-title fx-log-title">효과 로그</div>
                <div class="fx-log-header-actions">
                    <div class="fx-log-count">${uiState.playback.logEntries.length}</div>
                    <button id="fx-log-toggle" class="secondary-btn small-btn">${isExpanded ? '접기' : '펼치기'}</button>
                </div>
            </div>
            ${isExpanded ? `
                <div class="game-log-body fx-log-body">
                    ${visibleEntries.length === 0 ? '<div class="game-log-empty">아직 효과 로그가 없습니다.</div>' : ''}
                    ${visibleEntries.map(entry => `
                        <div class="fx-log-entry">
                            <div class="fx-log-time">${formatPlaybackLogTime(entry.createdAtMs)}</div>
                            <div class="fx-log-message">${escapeHtml(entry.message).replace(/\n/g, '<br>')}</div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="fx-log-collapsed-preview">${latestMessage}</div>
            `}
        </aside>
    `;
}

function renderVerificationSessionPanel(): string {
    if (!uiState.verificationSession) return '';
    if (uiState.verificationPanelCollapsed) {
        return `
            <div class="verification-session-collapsed">
                <button id="verification-panel-toggle-btn" class="secondary-btn">Show Test Panel</button>
            </div>
        `;
    }
    const currentOrder = uiState.verificationSession.currentIndex + 1;
    const totalTests = uiState.verificationSession.orderedTestIds.length;
    const hasNextTest = uiState.verificationSession.currentIndex < totalTests - 1;
    const safeInstructions = escapeHtml(uiState.verificationSession.currentInstructions).replace(/\n/g, '<br>');
    return `
        <div class="verification-session-panel">
            <div class="verification-session-actions">
                <button id="verification-back-btn" class="secondary-btn">Back to Verification (V)</button>
                <button id="verification-next-btn" class="primary-btn" ${hasNextTest ? '' : 'disabled'}>Next Test (N)</button>
                <button id="verification-panel-toggle-btn" class="secondary-btn">Hide Panel</button>
            </div>
            <div class="verification-session-meta">
                <strong>${currentOrder} / ${totalTests}</strong>
                <span>${uiState.verificationSession.currentTestId}</span>
                ${hasNextTest ? '' : '<span class="verification-session-last">Last test in this run</span>'}
            </div>
            <div class="verification-session-instructions">${safeInstructions}</div>
        </div>
    `;
}

function getReplayTerminationLabel(reason: string): string {
    switch (reason) {
        case 'winner':
            return 'Winner reached';
        case 'max_steps':
            return 'Stopped by max steps';
        case 'no_action':
            return 'Stopped: bot had no legal action';
        case 'invalid_action':
            return 'Stopped: invalid action';
        default:
            return reason;
    }
}

function renderGameControlButtons(localHumanCanInput: boolean): string {
    if (!uiState.replaySession || !uiState.game) {
        return `<button id="next-phase" class="primary-btn" ${uiState.game?.state.phase === Phase.BLOCK || uiState.game?.state.interactionMode !== 'NORMAL' || !localHumanCanInput ? 'disabled' : ''}>Next Phase</button>`;
    }

    const replay = uiState.replaySession;
    const consumed = replay.currentActionIndex;
    const total = replay.actions.length;
    const lastAction = consumed > 0 ? replay.actions[consumed - 1].summary : 'Not started';
    const nextAction = consumed < total ? replay.actions[consumed].summary : 'Replay complete';
    const winnerName = replay.result.winnerId
        ? uiState.game.state.players.find(player => player.id === replay.result.winnerId)?.name ?? 'Winner'
        : 'None';
    const disabledNext = consumed >= total ? 'disabled' : '';

    return `
        <div class="replay-controls">
            <div class="replay-status">
                <div><strong>Replay:</strong> ${consumed} / ${total}</div>
                <div><strong>Last:</strong> ${lastAction}</div>
                <div><strong>Next:</strong> ${nextAction}</div>
                <div><strong>Result:</strong> ${getReplayTerminationLabel(replay.result.terminationReason)} / Winner: ${winnerName}</div>
            </div>
            <div class="replay-actions">
                <button id="replay-restart" class="secondary-btn">Restart Replay</button>
                <button id="replay-next-action" class="primary-btn" ${disabledNext}>Next Action</button>
            </div>
        </div>
    `;
}

function renderReplayOverlayControls(): string {
    if (!uiState.replaySession) return '';

    const consumed = uiState.replaySession.currentActionIndex;
    const total = uiState.replaySession.actions.length;
    const disabledNext = consumed >= total ? 'disabled' : '';

    return `
        <div class="replay-overlay-controls">
            <button id="replay-overlay-restart" class="secondary-btn">Restart Replay</button>
            <button id="replay-overlay-next-action" class="primary-btn" ${disabledNext}>Next Action</button>
        </div>
    `;
}

function isInteractionModalDelayed(): boolean {
    if (!uiState.game) return false;
    return shouldDelayInteractionModal(uiState.game.state.interactionMode);
}

function renderPlaybackToasts(): string {
    const now = Date.now();
    const toasts = uiState.playback.toasts.filter(toast => toast.expiresAtMs > now).slice(-3);
    if (toasts.length === 0) return '';
    return `
        <div class="fx-toast-stack">
            ${toasts.map(toast => `<div class="fx-toast-item">${escapeHtml(toast.message)}</div>`).join('')}
        </div>
    `;
}

function renderPlaybackControls(): string {
    if (!uiState.playback.enabled) return '';
    const options: Array<{ value: 'SLOW' | 'NORMAL' | 'FAST'; label: string }> = [
        { value: 'SLOW', label: '느림' },
        { value: 'NORMAL', label: '보통' },
        { value: 'FAST', label: '빠름' },
    ];
    return `
        <div class="playback-speed-controls">
            ${options.map(option => `
                <button
                    class="secondary-btn small-btn ${uiState.playback.speed === option.value ? 'active' : ''}"
                    data-playback-speed="${option.value}"
                >
                    ${option.label}
                </button>
            `).join('')}
            <button id="playback-skip-btn" class="secondary-btn small-btn">Skip (Space)</button>
        </div>
    `;
}

function renderMobileFloatingMenuButton(inOnlineMatch: boolean): string {
    return `
        <div class="mobile-floating-menu">
            <button id="db-back-to-menu" class="secondary-btn game-menu-btn mobile-menu-fab">${inOnlineMatch ? 'Room' : 'Menu'}</button>
        </div>
    `;
}

function renderMobileInteractionOverlay(interactionBannerHtml: string): string {
    if (!interactionBannerHtml) return '';
    return `
        <div class="mobile-interaction-overlay">
            ${interactionBannerHtml}
        </div>
    `;
}

function renderMobileFloatingActions(localHumanCanInput: boolean): string {
    const nextPhaseDisabled = uiState.game?.state.phase === Phase.BLOCK
        || uiState.game?.state.interactionMode !== 'NORMAL'
        || !localHumanCanInput;
    return `
        <div class="mobile-floating-actions">
            <button id="mobile-log-fab" class="secondary-btn mobile-fab">로그</button>
            ${uiState.replaySession ? '' : `<button id="next-phase" class="primary-btn mobile-fab mobile-next-phase-fab" ${nextPhaseDisabled ? 'disabled' : ''}>Next</button>`}
        </div>
    `;
}

function renderMobileLogSheet(): string {
    const open = uiState.mobileGameView.logSheetOpen;
    return `
        <div id="mobile-log-sheet-backdrop" class="mobile-log-sheet-backdrop ${open ? 'open' : ''}"></div>
        <aside class="mobile-log-sheet ${open ? 'open' : ''}">
            <div class="mobile-log-sheet-header">
                <div class="mobile-log-sheet-title">효과 로그</div>
                <button id="mobile-log-sheet-close" class="secondary-btn small-btn">닫기</button>
            </div>
            ${renderPlaybackLogPanel()}
        </aside>
    `;
}

const ACTIVATION_REASON_LABELS: Record<string, string> = {
    ENTRY: '엔트리 효과',
    PASSIVE: '패시브 유발',
    ACTIVE: '액티브 효과',
    ACTIVE_MAIN: '메인 액티브 효과',
    ATTACKER: '어태커 트리거',
    DEFENDER: '디펜더 트리거',
    EXIT: '엑시트 트리거',
    ON_KILL: '격파 트리거',
    DAMAGE_TRIGGER: '데미지 트리거',
    TURN_START: '턴 시작 트리거',
    TURN_END: '턴 종료 트리거',
    BATTLE_END: '배틀 종료 트리거',
    AWAKEN: '각성 트리거',
    UNIT_TRASHED: '유닛 트래시 트리거',
    ESCAPE: '이스케이프 트리거',
    HAND_TRASHED: '패 트래시 트리거',
    DRAWN: '드로우 트리거',
};

const MASKED_SOURCE_ACTIVATIONS = new Set<string>([
    'DAMAGE_TRIGGER',
    'DRAWN',
    'HAND_TRASHED',
]);

function getPlayerName(playerId: string | undefined): string {
    if (!playerId) return '플레이어';
    return uiState.game?.state.players.find(player => player.id === playerId)?.name ?? playerId;
}

function shouldMaskPendingSourceName(pending: PendingEffect): boolean {
    if (!pending.sourcePlayerId) return false;
    if (!uiState.onlineSession.room || uiState.onlineSession.room.phase !== 'IN_GAME') return false;
    if (shouldRevealHandForPlayer(pending.sourcePlayerId)) return false;
    const activation = pending.sourceActivation;
    if (!activation) return false;
    return MASKED_SOURCE_ACTIVATIONS.has(String(activation));
}

function describeTargetScope(scope: string | undefined): string {
    switch (scope) {
        case 'SELF':
            return '자신';
        case 'MY_FIELD':
            return '내 필드';
        case 'OPP_FIELD':
            return '상대 필드';
        case 'BOTH_FIELDS':
        case 'FIELD':
            return '양쪽 필드';
        case 'SHARED_LANE':
            return '같은 라인';
        case 'MY_TRASH':
            return '내 트래시';
        case 'MY_HAND':
            return '내 패';
        case 'OPP_HAND':
            return '상대 패';
        case 'MY_DAMAGE':
            return '내 데미지존';
        case 'MY_FIELD_ITEMS':
            return '내 필드 아이템';
        case 'OPP_FIELD_ITEMS':
            return '상대 필드 아이템';
        case 'FIELD_ITEMS':
            return '양쪽 필드 아이템';
        case 'REVEALED':
            return '공개 카드';
        case 'LAST_DRAWN':
            return '방금 드로우한 카드';
        case 'ENCOUNTER':
        case 'ENCOUNTER_UNIT':
            return '인카운터 라인';
        default:
            return '대상';
    }
}

function describeTargetSelectionPurpose(pending: PendingEffect): string {
    const scope = pending.targetSchema?.scope ?? pending.validTargets;
    const scopeLabel = describeTargetScope(scope);
    const count = pending.targetSchema?.count;

    if (typeof count === 'number') {
        if (count === 0) return `${scopeLabel} 전체 지정`;
        if (count === 1) return `${scopeLabel}에서 1개 지정`;
        return `${scopeLabel}에서 ${count}개 지정`;
    }
    return `${scopeLabel} 대상 지정`;
}

function describeCostSelectionPurpose(pending: PendingEffect): string {
    const amount = Math.max(1, pending.costToPay?.amount || 1);
    const type = pending.costToPay?.type;

    if (type === 'TRASH_HAND') return `패에서 ${amount}장 버려 코스트 지불`;
    if (type === 'SHUFFLE_HAND_TO_DECK') return `패에서 ${amount}장을 덱으로 되돌려 코스트 지불`;
    if (type === 'RETIRE_UNIT') return `유닛 ${amount}장을 퇴각시켜 코스트 지불`;
    return '효과 코스트 지불';
}

function resolveSelectionPurpose(pending: PendingEffect, mode: GameState['interactionMode']): string {
    if (pending.selectionPurpose && pending.selectionPurpose.trim()) {
        return pending.selectionPurpose;
    }
    if (mode === 'SELECT_TARGET') return describeTargetSelectionPurpose(pending);
    if (mode === 'SELECT_COST') return describeCostSelectionPurpose(pending);
    if (mode === 'SELECT_OPTIONAL') return '선택형 효과 발동 여부 결정';
    return '효과 처리';
}

function resolveTriggerReason(pending: PendingEffect): string {
    if (pending.triggerReason && pending.triggerReason.trim()) {
        return pending.triggerReason;
    }
    if (pending.sourceActivation) {
        const key = String(pending.sourceActivation);
        return ACTIVATION_REASON_LABELS[key] ?? key;
    }
    return '효과 처리 중 선택';
}

function renderPendingEffectContext(
    pending: PendingEffect | null,
    mode: GameState['interactionMode'],
): string {
    if (!pending) return '';

    const maskedSource = shouldMaskPendingSourceName(pending);
    const sourceCardLabel = maskedSource
        ? `${getPlayerName(pending.sourcePlayerId)}의 비공개 카드`
        : (pending.sourceCard?.name || '알 수 없는 카드');
    const triggerReason = resolveTriggerReason(pending);
    const selectionPurpose = resolveSelectionPurpose(pending, mode);
    const effectSummary = pending.sourceEffectDescription || pending.effectDescription;
    const selectionHint = pending.sourceEffectDescription && pending.effectDescription
        && pending.sourceEffectDescription !== pending.effectDescription
        ? pending.effectDescription
        : '';

    return `
        <div class="game-interaction-context">
            <span class="game-interaction-context-label">출처 카드</span>
            <span class="game-interaction-context-value">${escapeHtml(sourceCardLabel)}</span>
            <span class="game-interaction-context-label">발동 이유</span>
            <span class="game-interaction-context-value">${escapeHtml(triggerReason)}</span>
            <span class="game-interaction-context-label">현재 선택</span>
            <span class="game-interaction-context-value">${escapeHtml(selectionPurpose)}</span>
            ${effectSummary ? `
                <span class="game-interaction-context-label">예정 효과</span>
                <span class="game-interaction-context-value">${escapeHtml(effectSummary)}</span>
            ` : ''}
            ${selectionHint ? `
                <span class="game-interaction-context-label">선택 안내</span>
                <span class="game-interaction-context-value">${escapeHtml(selectionHint)}</span>
            ` : ''}
        </div>
    `;
}

function renderOptionalEffectModal() {
    if (!uiState.game) return '';
    if (uiState.game.state.interactionMode !== 'SELECT_OPTIONAL') return '';
    if (isInteractionModalDelayed()) return '';
    const pending = uiState.game.state.pendingEffect as any;
    if (!pending) return '';

    const description = pending.effectDescription ?? 'Activate optional effect?';
    const contextHtml = renderPendingEffectContext(pending as PendingEffect, 'SELECT_OPTIONAL');

    return `
        <div class="modal-overlay">
            <div class="modal-content">
                <h3>Optional Effect</h3>
                <p>${description}</p>
                ${contextHtml}
                <div class="modal-actions">
                    <button id="opt-confirm" class="primary-btn">Activate</button>
                    <button id="opt-skip" class="secondary-btn">Skip</button>
                </div>
            </div>
        </div>
    `;
}

function supportsHoverInput(): boolean {
    if (typeof window === 'undefined') return true;
    if (typeof window.matchMedia !== 'function') return true;
    try {
        return window.matchMedia('(hover: hover)').matches;
    } catch {
        return true;
    }
}

function isSkillZonePromptSelectionAction(pending: PendingEffect | null | undefined): boolean {
    if (!pending) return false;
    return pending.validTargets === 'REVEALED' && SKILL_ZONE_PROMPT_ACTION_TYPES.has(pending.actionType);
}

function isSelectionModalTargetScope(scope: any): boolean {
    return scope === 'MY_TRASH' || scope === 'REVEALED';
}

function resolveSelectionModalKey(): string | null {
    if (!uiState.game) return null;
    if (uiState.game.state.interactionMode !== 'SELECT_TARGET') return null;
    const pending = uiState.game.state.pendingEffect as PendingEffect | null;
    if (!pending || !isSelectionModalTargetScope(pending.validTargets)) return null;
    if (isSkillZonePromptSelectionAction(pending)) return null;
    const sourceCardId = pending.sourceCard?.id || 'UNKNOWN';
    return `${pending.sourcePlayerId || 'UNKNOWN'}:${pending.actionType || 'UNKNOWN'}:${pending.validTargets}:${sourceCardId}`;
}

function syncSelectionModalState() {
    const key = resolveSelectionModalKey();
    if (!key) {
        uiState.selectionModalCollapsed = false;
        uiState.selectionModalKey = null;
        return;
    }
    if (uiState.selectionModalKey !== key) {
        uiState.selectionModalKey = key;
        uiState.selectionModalCollapsed = false;
    }
}

function renderSelectionModalToggle() {
    if (!uiState.game) return '';
    if (!resolveSelectionModalKey()) return '';
    const collapsed = uiState.selectionModalCollapsed;
    return `
        <button
            id="selection-modal-toggle-btn"
            class="selection-modal-toggle-btn ${collapsed ? 'collapsed' : ''}"
            type="button"
            title="${collapsed ? '선택창 열기' : '선택창 숨기기'}"
        >
            ${collapsed ? '선택창 보기' : '선택창 숨기기'}
        </button>
    `;
}

function renderTrashModal() {
    if (!uiState.game) return '';
    if (uiState.game.state.interactionMode !== 'SELECT_TARGET') return '';
    if (isInteractionModalDelayed()) return '';
    if (uiState.selectionModalCollapsed) return '';
    const pending = uiState.game.state.pendingEffect as any;
    if (!pending || pending.validTargets !== 'MY_TRASH') return '';

    const sourcePlayer = uiState.game.state.players.find(p => p.id === pending.sourcePlayerId);
    if (!sourcePlayer) return '';
    const trash = sourcePlayer.trash;
    const actorPlayerId = getActionOwnerPlayerId(uiState.game);
    const canConfirm = uiState.game.getLegalActions(actorPlayerId).some(action => action.type === 'CONFIRM_TARGETS');
    const targetCount = pending?.targetSchema?.count ?? 1;
    const selectedCount = pending?.selectedTargets?.length ?? 0;
    const showConfirm = targetCount > 1 || pending?.targetSchema?.selectMode === 'ALL' || pending?.actionValue?.allowPartialSelection === true;

    return `
        <div class="modal-overlay selection-modal-overlay">
            <div class="trash-modal">
                <h3>Select a card from Trash</h3>
                ${showConfirm ? `
                    <p style="text-align: center; color: #a0aec0; margin-bottom: 20px;">
                        Select cards (${selectedCount}/${targetCount}) then confirm
                    </p>
                ` : ''}
                <div class="trash-grid">
                    ${trash.map((c, i) => {
        const isSelected = pending.selectedTargets?.includes(c);
        return `
                        <div class="trash-card-item ${isSelected ? 'selected-target' : ''}" data-index="${i}">
                            ${renderCard(c)}
                        </div>
                    `;
    }).join('')}
                </div>
                ${showConfirm ? `
                    <div class="modal-actions">
                        <button id="confirm-targets-modal-btn" class="primary-btn" ${canConfirm ? '' : 'disabled'}>Confirm</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderRevealedCardsModal() {
    if (!uiState.game) return '';
    if (uiState.game.state.revealedCards.length === 0) return '';
    if (isInteractionModalDelayed()) return '';
    if (uiState.selectionModalCollapsed) return '';

    const pending = uiState.game.state.pendingEffect as PendingEffect | null;
    const isSelecting = uiState.game.state.interactionMode === 'SELECT_TARGET' && pending?.validTargets === 'REVEALED';
    if (isSelecting && isSkillZonePromptSelectionAction(pending)) return '';
    const isTakeAll = pending?.actionType === 'TAKE_ALL_REVEALED';
    const filter = pending?.targetSchema?.filters?.[0];
    const actorPlayerId = uiState.game ? getActionOwnerPlayerId(uiState.game) : '';
    const canConfirm = isSelecting
        ? uiState.game.getLegalActions(actorPlayerId).some(action => action.type === 'CONFIRM_TARGETS')
        : false;
    const targetCount = pending?.targetSchema?.count ?? 1;
    const selectedCount = pending?.selectedTargets?.length ?? 0;
    const selectionGuide = !isSelecting
        ? 'Cards revealed by effect'
        : isTakeAll
            ? 'Cards matching the filter will be added to hand'
            : targetCount > 1
                ? `Select ${targetCount} cards (${selectedCount}/${targetCount}) then confirm`
                : 'Select a card to add to hand';

    return `
        <div class="modal-overlay selection-modal-overlay">
            <div class="trash-modal">
                <h3>Revealed Cards</h3>
                <p style="text-align: center; color: #a0aec0; margin-bottom: 20px;">
                    ${selectionGuide}
                </p>
                <div class="trash-grid">
                    ${uiState.game.state.revealedCards.map((c, i) => {
        const isSelected = isSelecting && !isTakeAll && pending.selectedTargets?.includes(c);

        let matchesFilter = true;
        if (isTakeAll && filter) {
            if (filter.type === 'COST_LIMIT' && resolveCardCostForDisplay(c) > filter.value) matchesFilter = false;
            if (filter.type === 'HAS_TRAIT' && !c.traits?.includes(filter.value)) matchesFilter = false;
        }

        return `
                        <div class="revealed-card-item ${isSelected ? 'selected-target' : ''} ${!matchesFilter ? 'grayscale' : ''}" data-index="${i}" style="${isSelecting && !isTakeAll ? 'cursor: pointer;' : ''}">
                            ${renderCard(c)}
                        </div>
                    `;
    }).join('')}
                </div>
                ${isSelecting ? `
                    <div class="modal-actions">
                        <button id="confirm-targets-modal-btn" class="primary-btn" ${canConfirm ? '' : 'disabled'}>Confirm</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderMulliganModal() {
    if (!uiState.game) return '';
    if (uiState.game.state.interactionMode !== 'SELECT_MULLIGAN') return '';

    const actorId = getActionOwnerPlayerId(uiState.game);
    const actor = uiState.game.state.players.find(player => player.id === actorId);
    if (!actor) return '';

    const localHumanCanInput = canLocalHumanInput();
    const revealActorHand = shouldRevealHandForPlayer(actor.id);
    const waitingLabel = isBotControlledPlayer(actor.id)
        ? `${getBotLabelForPlayerId(actor.id)} is deciding...`
        : 'Waiting for input...';

    return `
        <div class="modal-overlay mulligan-overlay">
            <div class="mulligan-modal">
                <h3>Mulligan</h3>
                <p class="mulligan-desc">
                    ${actor.name} can choose one time: keep this opening hand or redraw all 5 cards.
                </p>
                <div class="mulligan-hand-preview">
                    ${actor.hand.map(card => revealActorHand ? renderCard(card, true) : renderHiddenHandCard(true)).join('')}
                </div>
                <div class="mulligan-actions">
                    <button id="mulligan-keep-btn" class="primary-btn" ${localHumanCanInput ? '' : 'disabled'} style="background:#636e72;">Keep Hand</button>
                    <button id="mulligan-redraw-btn" class="primary-btn" ${localHumanCanInput ? '' : 'disabled'}>Full Mulligan</button>
                </div>
                ${!localHumanCanInput ? `<p class="mulligan-waiting">${waitingLabel}</p>` : ''}
            </div>
        </div>
    `;
}

function renderGameOverModal() {
    const engine = uiState.game;
    if (!engine || !engine.state.winner) return '';
    const onlineMatch = !!uiState.onlineSession.room && !!uiState.onlineSession.role;

    const [player1, player2] = engine.state.players;
    const winner = engine.state.players.find(player => player.id === engine.state.winner) ?? player1;
    const loser = winner.id === player1.id ? player2 : player1;

    const winnerUnits = winner.unitZones.filter(zone => !!zone.unit).length;
    const loserUnits = loser.unitZones.filter(zone => !!zone.unit).length;

    const outcomeReason = loser.damage.length >= 10
        ? 'Defeat Condition: Damage Zone reached 10 cards'
        : loser.deck.length === 0
            ? 'Defeat Condition: Deck ran out during draw/damage processing'
            : 'Defeat Condition met by game rules';

    return `
        <div class="modal-overlay game-over-overlay">
            <div class="game-over-modal">
                <h2>Game Over</h2>
                <p class="game-over-winner">${winner.name} Wins</p>
                <p class="game-over-reason">${outcomeReason}</p>

                <div class="game-over-score">
                    Damage Score: ${player1.name} ${player1.damage.length} : ${player2.damage.length} ${player2.name}
                </div>

                <div class="game-over-stats">
                    <div class="game-over-row game-over-head">
                        <span>Stat</span>
                        <span>${winner.name}</span>
                        <span>${loser.name}</span>
                    </div>
                    <div class="game-over-row">
                        <span>Leader Level</span>
                        <span>${winner.leaderLevel}</span>
                        <span>${loser.leaderLevel}</span>
                    </div>
                    <div class="game-over-row">
                        <span>Damage</span>
                        <span>${winner.damage.length}</span>
                        <span>${loser.damage.length}</span>
                    </div>
                    <div class="game-over-row">
                        <span>Deck</span>
                        <span>${winner.deck.length}</span>
                        <span>${loser.deck.length}</span>
                    </div>
                    <div class="game-over-row">
                        <span>Hand</span>
                        <span>${winner.hand.length}</span>
                        <span>${loser.hand.length}</span>
                    </div>
                    <div class="game-over-row">
                        <span>Trash</span>
                        <span>${winner.trash.length}</span>
                        <span>${loser.trash.length}</span>
                    </div>
                    <div class="game-over-row">
                        <span>Units on Field</span>
                        <span>${winnerUnits}</span>
                        <span>${loserUnits}</span>
                    </div>
                </div>

                <div class="game-over-meta">
                    Final Turn: ${engine.state.turnCount} / Final Phase: ${engine.state.phase}
                </div>

                <div class="modal-actions">
                    <button id="game-over-menu-btn" class="primary-btn">${onlineMatch ? 'Back to Online Room' : 'Back to Main Menu'}</button>
                </div>
            </div>
        </div>
    `;
}

function getSkillPromptSelectionStateForPlayer(playerId: string): {
    candidateSkillIndexes: Set<number>;
    selectedSkillIndexes: Set<number>;
} {
    const emptyState = {
        candidateSkillIndexes: new Set<number>(),
        selectedSkillIndexes: new Set<number>(),
    };
    if (!uiState.game) return emptyState;
    if (uiState.game.state.interactionMode !== 'SELECT_TARGET') return emptyState;
    const pending = uiState.game.state.pendingEffect as PendingEffect | null;
    if (!isSkillZonePromptSelectionAction(pending)) return emptyState;
    if (!pending) return emptyState;
    if (pending.sourcePlayerId !== playerId) return emptyState;

    const options = Array.isArray((pending.actionValue as any)?.options)
        ? (pending.actionValue as any).options
        : [];
    if (options.length === 0) return emptyState;

    const revealedIndexToSkillIndex = new Map<number, number>();
    options.forEach((option: any, revealedIndex: number) => {
        const skillZoneIndex = Number(option?.skillZoneIndex);
        if (!Number.isInteger(skillZoneIndex) || skillZoneIndex < 0) return;
        revealedIndexToSkillIndex.set(revealedIndex, skillZoneIndex);
        emptyState.candidateSkillIndexes.add(skillZoneIndex);
    });

    const selectedTargets = Array.isArray(pending.selectedTargets) ? pending.selectedTargets : [];
    selectedTargets.forEach((selectedCard: Card) => {
        const revealedIndex = uiState.game!.state.revealedCards.indexOf(selectedCard);
        if (revealedIndex < 0) return;
        const skillZoneIndex = revealedIndexToSkillIndex.get(revealedIndex);
        if (typeof skillZoneIndex !== 'number') return;
        emptyState.selectedSkillIndexes.add(skillZoneIndex);
    });

    return emptyState;
}

function renderPlayer(
    player: any,
    isOpponent: boolean,
    isMainPhase: boolean,
    legalActions: any[],
    inputOwnerId: string,
) {
    if (!uiState.game) return '';
    const localHumanCanInput = canLocalHumanInput();
    const pending = uiState.game.state.pendingEffect as PendingEffect | null;
    const targetCount = pending?.targetSchema?.count ?? 1;
    const hasPulseForZone = (zone: 'DECK' | 'DAMAGE') => uiState.playback.activePulseTargets
        .some(target => target.playerId === player.id && target.zone === zone);
    const deckPulseClass = hasPulseForZone('DECK') ? 'fx-pulse-zone fx-pulse-deck' : '';
    const damagePulseClass = hasPulseForZone('DAMAGE') ? 'fx-pulse-zone fx-pulse-damage' : '';
    const isInputOwnerPlayer = player.id === inputOwnerId;
    const blockResolveActions = (legalActions || []).filter((action: any) => action.type === 'RESOLVE_BLOCK');
    const blockableZoneSet = new Set<number>(
        blockResolveActions
            .filter((action: any) => action.shouldBlock && typeof action.blockerZoneIndex === 'number')
            .map((action: any) => action.blockerZoneIndex),
    );
    const hasBlockPassAction = blockResolveActions.some((action: any) => action.shouldBlock === false);
    const activatableEffectActions = (legalActions || []).filter((action: any) => action.type === 'ACTIVATE_EFFECT');
    const attackActionZoneSet = new Set<number>(
        (legalActions || [])
            .filter((action: any) => action.type === 'ATTACK' && typeof action.attackerZoneIndex === 'number')
            .map((action: any) => action.attackerZoneIndex),
    );
    const damageTargetActionsForPlayer = (legalActions || []).filter(
        (action: any) => action.type === 'SELECT_DAMAGE_TARGET' && action.targetPlayerId === player.id,
    );
    const showDamageCardSelectionInline =
        uiState.game.state.interactionMode === 'SELECT_TARGET' &&
        damageTargetActionsForPlayer.length > 0 &&
        !supportsHoverInput();
    const hasDamageSelectionCandidate =
        uiState.game.state.interactionMode === 'SELECT_TARGET' && damageTargetActionsForPlayer.length > 0;
    const hasTrashSelectionCandidate =
        uiState.game.state.interactionMode === 'SELECT_TARGET' &&
        (legalActions || []).some((action: any) => action.type === 'SELECT_TRASH_TARGET' && action.targetPlayerId === player.id);
    const selectedDamageCount = Array.isArray(pending?.selectedTargets)
        ? pending.selectedTargets.filter((target: any) => player.damage.includes(target)).length
        : 0;
    const selectedTrashCount = Array.isArray(pending?.selectedTargets)
        ? pending.selectedTargets.filter((target: any) => player.trash.includes(target)).length
        : 0;
    const damageZoneSelectionClass = hasDamageSelectionCandidate ? 'selection-zone-candidate' : '';
    const damageZoneSelectedClass = selectedDamageCount > 0 ? 'selection-zone-selected' : '';
    const damageStackStep = computeDamageStackStep(player.damage.length);
    const damageCardsMarkup = player.damage.map((c: Card, damageIndex: number) => {
        const isDamageSelected = uiState.game!.state.pendingEffect?.selectedTargets?.includes(c);
        return `<div class="damage-card-item ${isDamageSelected ? 'selected-target' : ''}" data-player="${isOpponent ? 'opponent' : 'current'}" data-index="${damageIndex}">${renderCard(c, true)}</div>`;
    }).join('');
    const trashZoneSelectionClass = hasTrashSelectionCandidate ? 'selection-zone-candidate' : '';
    const trashZoneSelectedClass = selectedTrashCount > 0 ? 'selection-zone-selected' : '';
    const skillPromptState = getSkillPromptSelectionStateForPlayer(player.id);
    const skillPromptTargetCount = skillPromptState.candidateSkillIndexes.size;
    const leaderHasActivatableEffect =
        isInputOwnerPlayer &&
        player.levelZone?.isAwakened === true &&
        activatableEffectActions.some((action: any) => action.sourceType === 'LEADER');
    return `
      <div class="player-area ${isOpponent ? 'opponent' : 'current'}">
        <div class="level-zone">
            <div class="leader-slot">
                ${player.levelZone ? renderCard(player.levelZone, true) : ''}
                ${isInputOwnerPlayer && localHumanCanInput && leaderHasActivatableEffect ? '<button class="leader-active-btn">Active</button>' : ''}
            </div>

            ${Array.from({ length: 10 }, (_, i) => 10 - i).map(lv => `
                <div class="level-indicator ${player.leaderLevel >= lv ? 'active' : ''}">${lv}</div>
            `).join('')}
            <div class="level-indicator" style="color: #fff; font-size: 0.6rem;">LVL</div>
        </div>

        <div class="field-center">
            <div class="units-container">
                ${player.unitZones.map((z: any, i: number) => {
        const pendingAttackerLaneIndex = uiState.game!.state.pendingAttackerIndex ?? -1;
        const isEncounterLane = uiState.game!.state.phase === Phase.BLOCK && isInputOwnerPlayer && pendingAttackerLaneIndex === i;
        const canBlockWithThisZone = uiState.game!.state.phase === Phase.BLOCK && isInputOwnerPlayer && blockableZoneSet.has(i);
        const showPassControl = uiState.game!.state.phase === Phase.BLOCK && isInputOwnerPlayer && hasBlockPassAction && isEncounterLane;
        const isBlockingTarget = isEncounterLane || canBlockWithThisZone;
        const zoneHasActivatableEffect = isInputOwnerPlayer && activatableEffectActions.some((action: any) => action.zoneIndex === i);
        const canAttackFromThisZone = isInputOwnerPlayer && attackActionZoneSet.has(i);
        const isSelected = uiState.game!.state.pendingEffect?.selectedTargets?.includes(z);
        const unitCost = z.unit ? resolveCardCostForDisplay(z.unit) : 0;

        return `
                    <div class="zone unit-zone ${isInputOwnerPlayer && localHumanCanInput ? 'interactive drop-zone' : ''} ${isBlockingTarget ? 'blocking-target' : ''} ${isSelected ? 'selected-target' : ''}" data-player="${isOpponent ? 'opponent' : 'current'}" data-index="${i}">
                        ${z.unit ? renderCard(z.unit, false, uiState.game!.getUnitPower(z, player), uiState.game!.getUnitHit(z, player)) : '<span style="color: rgba(255,255,255,0.1); font-size: 0.8rem; font-weight: bold;">UNIT</span>'}

                        ${z.items.length > 0 ? `
                            <div class="attached-items">
                                ${z.items.map((item: Card, itemIndex: number) => {
            const isItemSelected = uiState.game!.state.pendingEffect?.selectedTargets?.includes(item);
            return `
                                    <div class="mini-item-card ${isItemSelected ? 'selected-target' : ''}" data-player="${isOpponent ? 'opponent' : 'current'}" data-zone-index="${i}" data-item-index="${itemIndex}">
                                        <img src="${item.imageUrl}" alt="${item.name}">
                                    </div>
                                `;
        }).join('')}
                            </div>
                        ` : ''}

                        ${z.unit && isInputOwnerPlayer && localHumanCanInput && canAttackFromThisZone ? '<button class="attack-btn">Attack</button>' : ''}
                        ${isInputOwnerPlayer && localHumanCanInput && zoneHasActivatableEffect ? '<button class="active-btn">Active</button>' : ''}
                        ${(canBlockWithThisZone || showPassControl) && localHumanCanInput ? `
                            <div class="block-controls">
                                ${canBlockWithThisZone ? `<button class="block-btn" data-blocker-zone-index="${i}">Block</button>` : ''}
                                ${showPassControl ? '<button class="pass-btn">Pass</button>' : ''}
                            </div>
                        ` : ''}
                        ${z.unit ? `<div class="stats">C ${unitCost} | ${uiState.game!.getUnitPower(z, player)} / ${uiState.game!.getUnitHit(z, player)}</div>` : ''}
                    </div>
                `;
    }).join('')}
            </div>

            <div class="bottom-center">
                <div class="damage-zone ${showDamageCardSelectionInline ? 'selection-mode' : 'summary-mode'} ${damagePulseClass} ${damageZoneSelectionClass} ${damageZoneSelectedClass}" data-player="${isOpponent ? 'opponent' : 'current'}">
                    ${showDamageCardSelectionInline ? damageCardsMarkup : `
                        <div class="damage-summary ${player.damage.length === 0 ? 'empty' : ''}">
                            <div class="damage-card-strip" style="--damage-step:${damageStackStep}px;">
                                ${damageCardsMarkup || '<div class="damage-card-empty">EMPTY</div>'}
                            </div>
                            <div class="damage-summary-meta">
                                <div class="damage-count">${player.damage.length}</div>
                                <div class="damage-label">DAMAGE</div>
                                ${hasDamageSelectionCandidate ? `<div class="selection-progress-badge">selected ${selectedDamageCount}/${targetCount === 0 ? 'all' : targetCount}</div>` : ''}
                            </div>
                        </div>
                    `}
                </div>
                <div class="skill-zone ${isInputOwnerPlayer && isMainPhase && localHumanCanInput ? 'interactive drop-zone-skill' : ''}">
                    ${player.skillZone.map((c: any, skillIndex: number) => {
        const skillCost = resolveCardCostForDisplay(c);
        const skillPromptCandidateClass = skillPromptState.candidateSkillIndexes.has(skillIndex) ? 'target-candidate' : '';
        const skillPromptSelectedClass = skillPromptState.selectedSkillIndexes.has(skillIndex) ? 'selected-target' : '';
        return `
                        <div class="skill-card-item ${skillPromptCandidateClass} ${skillPromptSelectedClass}" data-player="${isOpponent ? 'opponent' : 'current'}" data-index="${skillIndex}">
                            ${renderCard(c, true)}
                            <div class="skill-cost">C ${skillCost}</div>
                        </div>
                    `;
    }).join('')}
                    ${skillPromptTargetCount > 0 ? `<div class="selection-progress-badge">selected ${skillPromptState.selectedSkillIndexes.size}/${skillPromptTargetCount}</div>` : ''}
                    ${player.skillZone.length === 0 ? '<span style="color: rgba(255,255,255,0.1); font-weight: bold; width: 100%; text-align: center;">SKILL</span>' : ''}
                </div>
            </div>
        </div>

        <div class="field-right">
            <div class="deck-zone ${deckPulseClass}">
                <div class="deck-count">${player.deck.length}</div>
                <div style="font-size: 0.6rem; color: #a0aec0; font-weight: bold;">DECK</div>
            </div>
            <div class="trash-zone ${trashZoneSelectionClass} ${trashZoneSelectedClass}" data-player="${isOpponent ? 'opponent' : 'current'}">
                ${player.trash.length > 0 ? renderCard(player.trash[player.trash.length - 1], true) : '<span style="color: rgba(255,255,255,0.1); font-size: 0.7rem; font-weight: bold;">TRASH</span>'}
                ${hasTrashSelectionCandidate ? `<div class="selection-progress-badge">selected ${selectedTrashCount}/${targetCount === 0 ? 'all' : targetCount}</div>` : ''}
            </div>
        </div>
      </div>
    `;
}

export function renderCard(card: Card, isSmall: boolean = false, _calculatedPower?: number, _calculatedHit?: number) {
    const attributeClass = (card.attribute || 'NONE').toString().toLowerCase();
    const safeName = escapeHtml(card.name || card.id || 'Unknown');
    const safeId = escapeHtml(card.id || '');
    const safeText = escapeHtml(card.text || '');

    return `
        <div class="card ${attributeClass} ${isSmall ? 'small-card' : ''} ${card.isAwakened ? 'awakened' : ''} ${card.imageUrl ? '' : 'card-text-fallback'}">
            ${card.imageUrl
            ? `<img src="${card.imageUrl}" class="card-image" alt="${safeName}">`
            : `
                <div class="card-fallback">
                    <div class="card-fallback-id">${safeId}</div>
                    <div class="card-fallback-name">${safeName}</div>
                    ${safeText ? `<div class="card-fallback-text">${safeText}</div>` : ''}
                </div>
            `}
        </div>
    `;
}

export function renderHiddenHandCard(isSmall: boolean = false) {
    return `
        <div class="card card-back ${isSmall ? 'small-card' : ''}">
            <div class="card-back-pattern"></div>
            <div class="card-back-label">HIDDEN</div>
        </div>
    `;
}

export function renderGame() {
    if (!uiState.game) return;
    syncSelectionModalState();
    clearAutoPhaseAdvanceTimer();
    applyPhaseThemeClass(uiState.game.state.phase);
    applyAutoLogCollapsePolicy();

    const bottomPlayer = getBottomPlayer(uiState.game);
    const topPlayer = getTopPlayer(uiState.game);
    const revealBottomPlayerHand = shouldRevealHandForPlayer(bottomPlayer.id);
    const revealTopPlayerHand = shouldRevealHandForPlayer(topPlayer.id);
    const inputOwnerId = getActionOwnerPlayerId(uiState.game);
    const inputOwner = uiState.game.state.players.find(player => player.id === inputOwnerId) ?? null;
    const localHumanCanInput = canLocalHumanInput();
    const inputOwnerLegalActions = uiState.game.getLegalActions(inputOwnerId);
    const inputOwnerControl = inputOwner
        ? (isBotControlledPlayer(inputOwner.id) ? getBotLabelForPlayerId(inputOwner.id) : 'Human')
        : 'N/A';
    const verificationGame = isVerificationGame();
    const inOnlineMatch = uiState.onlineSession.room?.phase === 'IN_GAME';
    const viewport = getViewportMetrics();
    const isMobilePortraitLayout = shouldUseMobilePortraitLayout({
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
    });
    if (!isMobilePortraitLayout) {
        uiState.mobileGameView.logSheetOpen = false;
        uiState.mobileGameView.selectedHandIndex = null;
    }

    const isMainPhase = uiState.game.state.phase === Phase.MAIN;
    const mobileTapPlayEnabled = isMobilePortraitLayout
        && !uiState.replaySession
        && localHumanCanInput
        && isMainPhase
        && uiState.game.state.interactionMode === 'NORMAL';
    if (!mobileTapPlayEnabled) {
        uiState.mobileGameView.selectedHandIndex = null;
    }
    const computeHandStepPx = (cardCount: number): number => {
        const maxStep = HAND_CARD_WIDTH_PX + HAND_CARD_MAX_GAP_PX;
        if (cardCount <= 1) return maxStep;

        const innerWidth = BATTLE_BOARD_WIDTH_PX - HAND_ZONE_HORIZONTAL_PADDING_PX;
        const idealStep = Math.floor((innerWidth - HAND_CARD_WIDTH_PX) / Math.max(1, cardCount - 1));
        return Math.max(HAND_CARD_MIN_STEP_PX, Math.min(maxStep, idealStep));
    };
    const topHandStepPx = computeHandStepPx(topPlayer.hand.length);
    const bottomHandStepPx = computeHandStepPx(bottomPlayer.hand.length);
    const speedVarsByPreset = {
        SLOW: { beatMs: 520, pulseMs: 620 },
        NORMAL: { beatMs: 320, pulseMs: 420 },
        FAST: { beatMs: 180, pulseMs: 260 },
    } as const;
    const speedVars = speedVarsByPreset[uiState.playback.speed];
    const hasPulseForHand = (playerId: string) => uiState.playback.activePulseTargets
        .some(target => target.playerId === playerId && target.zone === 'HAND');
    const topHandPulseClass = hasPulseForHand(topPlayer.id) ? 'fx-pulse-zone fx-pulse-hand' : '';
    const bottomHandPulseClass = hasPulseForHand(bottomPlayer.id) ? 'fx-pulse-zone fx-pulse-hand' : '';
    const interactionDeferred = isInteractionModalDelayed();
    let interactionBannerHtml = '';

    if (uiState.game.state.interactionMode === 'SELECT_TARGET') {
        const pending = uiState.game.state.pendingEffect as PendingEffect | null;
        const maxCount = pending?.targetSchema?.count || 0;
        const currentCount = pending?.selectedTargets?.length || 0;
        const actorId = getActionOwnerPlayerId(uiState.game);
        const canConfirm = uiState.game.getLegalActions(actorId).some(action => action.type === 'CONFIRM_TARGETS');
        const needsConfirm =
            (pending?.targetSchema?.count ?? 1) !== 1 ||
            pending?.targetSchema?.selectMode === 'ALL' ||
            pending?.actionType === 'TAKE_ALL_REVEALED' ||
            pending?.actionValue?.allowPartialSelection === true;
        const selectionModeHint = needsConfirm
            ? '선택 후 Confirm 버튼으로 확정합니다.'
            : '카드를 클릭하면 즉시 적용됩니다.';
        const sacrificeHint = pending?.actionType === 'SACRIFICE_TO_BUFF'
            ? (currentCount === 0
                ? 'Step 1/2: Select the unit to trash.'
                : currentCount === 1
                    ? 'Step 2/2: Select the unit to receive +2000 power.'
                    : 'Selection complete. Confirm to resolve.')
            : '';
        const contextHtml = renderPendingEffectContext(pending, 'SELECT_TARGET');

        interactionBannerHtml = `
            <div class="game-interaction-banner target-mode">
                <div class="game-interaction-main-row">
                    <span>SELECT TARGETS (${currentCount}/${maxCount === 0 ? 'All' : maxCount})</span>
                    <button id="confirm-targets-btn" class="primary-btn small-btn-inline" ${canConfirm ? '' : 'disabled'}>Confirm</button>
                </div>
                <span class="game-interaction-sub">${selectionModeHint}</span>
                ${sacrificeHint ? `<span class="game-interaction-sub">${sacrificeHint}</span>` : ''}
                ${contextHtml}
            </div>
        `;
    } else if (uiState.game.state.interactionMode === 'SELECT_COST') {
        const pending = uiState.game.state.pendingEffect as PendingEffect | null;
        const contextHtml = renderPendingEffectContext(pending, 'SELECT_COST');
        interactionBannerHtml = `
            <div class="game-interaction-banner cost-mode">
                <div class="game-interaction-main-row">
                    <span>SELECT CARD TO TRASH (COST)</span>
                </div>
                ${contextHtml}
            </div>
        `;
    }
    if (interactionDeferred && uiState.game.state.interactionMode !== 'NORMAL') {
        interactionBannerHtml += `
            <div class="game-interaction-banner fx-processing-banner">
                <span>효과 처리 중... 잠시 후 선택 창이 표시됩니다.</span>
                <span class="game-interaction-sub">Space: 즉시 스킵</span>
            </div>
        `;
    }

    uiState.app.innerHTML = `
    <div class="game-container ${isMobilePortraitLayout ? 'mobile-portrait' : ''}" style="--fx-beat-ms:${speedVars.beatMs}ms; --fx-pulse-ms:${speedVars.pulseMs}ms;">
      ${verificationGame ? renderVerificationSessionPanel() : ''}
      ${isMobilePortraitLayout ? renderMobileFloatingMenuButton(inOnlineMatch) : ''}
      ${isMobilePortraitLayout ? renderMobileInteractionOverlay(interactionBannerHtml) : ''}
      ${isMobilePortraitLayout ? renderPlaybackToasts() : ''}
      <div class="game-layout-root">
        <div class="battle-fit-viewport">
          <div class="battle-fit-content" style="--battle-scale: 1;">
            <div class="opponent-hand-zone fan-layout ${topHandPulseClass}" style="--hand-step:${topHandStepPx}px;">
                ${topPlayer.hand.map((c, i) => {
        const pending = uiState.game!.state.pendingEffect as any;
        const isTargetCandidate = uiState.game!.state.interactionMode === 'SELECT_TARGET' &&
            pending &&
            uiState.game!.isPendingCardTarget(c);
        return `
                  <div class="card-in-hand ${isTargetCandidate ? 'target-candidate' : ''} ${revealTopPlayerHand ? '' : 'concealed-hand'}" data-index="${i}" data-hand-revealed="${revealTopPlayerHand ? '1' : '0'}">
                      ${revealTopPlayerHand ? renderCard(c) : renderHiddenHandCard(false)}
                  </div>
              `;
    }).join('')}
            </div>

            ${renderPlayer(topPlayer, true, isMainPhase, inputOwnerLegalActions, inputOwnerId)}

            <div class="game-divider"></div>

            ${renderPlayer(bottomPlayer, false, isMainPhase, inputOwnerLegalActions, inputOwnerId)}

            <div class="hand-zone fan-layout ${bottomHandPulseClass}" style="--hand-step:${bottomHandStepPx}px;">
                ${bottomPlayer.hand.map((c, i) => {
        const isCostCandidate = uiState.game!.state.interactionMode === 'SELECT_COST';
        const pending = uiState.game!.state.pendingEffect as any;
        const isTargetCandidate = uiState.game!.state.interactionMode === 'SELECT_TARGET' &&
            pending &&
            uiState.game!.isPendingCardTarget(c);

        return `
                  <div class="card-in-hand ${isCostCandidate ? 'cost-candidate' : ''} ${isTargetCandidate ? 'target-candidate' : ''} ${revealBottomPlayerHand ? '' : 'concealed-hand'}" draggable="${isMainPhase && uiState.game!.state.interactionMode === 'NORMAL' && localHumanCanInput}" data-index="${i}" data-hand-revealed="${revealBottomPlayerHand ? '1' : '0'}">
                      ${revealBottomPlayerHand ? renderCard(c) : renderHiddenHandCard(false)}
                  </div>
              `;
    }).join('')}
            </div>
          </div>
        </div>

        ${isMobilePortraitLayout ? '' : `
        <aside class="game-side-rail">
          <div class="game-top-bar">
            <button id="db-back-to-menu" class="secondary-btn game-menu-btn">${inOnlineMatch ? 'Room' : 'Menu'}</button>
            <div class="game-top-title">NivelArena</div>
            ${interactionBannerHtml}
          </div>
          ${renderPlaybackToasts()}
          ${renderPlaybackLogPanel()}
          <div class="game-controls">
            <div class="status-bar">
              <div class="status-item"><span>Turn</span> <strong>${uiState.game.state.turnCount}</strong></div>
              <div class="status-item"><span>Phase</span> <strong>${uiState.game.state.phase}</strong></div>
              <div class="status-item"><span>Active</span> <strong>${uiState.game.currentPlayer.name}</strong></div>
              <div class="status-item"><span>Mode</span> <strong>${uiState.activeMatchConfig.label}</strong></div>
              <div class="status-item"><span>Bot Hand</span> <strong>${uiState.activeMatchViewConfig.revealBotHand ? 'Shown' : 'Hidden'}</strong></div>
              <div class="status-item"><span>Input</span> <strong>${inputOwner?.name ?? 'N/A'} (${inputOwnerControl})</strong></div>
            </div>
            ${renderPlaybackControls()}
            ${renderGameControlButtons(localHumanCanInput)}
          </div>
        </aside>
        `}
      </div>

      ${isMobilePortraitLayout ? renderMobileFloatingActions(localHumanCanInput) : ''}
      ${isMobilePortraitLayout ? renderMobileLogSheet() : ''}
      ${renderOptionalEffectModal()}
      ${renderMulliganModal()}
      ${renderTrashModal()}
      ${renderRevealedCardsModal()}
      ${renderSelectionModalToggle()}
      ${renderGameOverModal()}
      ${renderReplayOverlayControls()}
    </div>
  `;

    ensureGameResizeListener();
    attachListeners(renderCard);
    bindBattleAssetLoadReflow();
    window.requestAnimationFrame(() => {
        if (uiState.currentScreen !== Screen.GAME || !uiState.game) return;
        applyBattleLayoutScale();
    });
    scheduleAutoPhaseAdvance();
    scheduleBotStep();
}
