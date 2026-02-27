import { Phase, Card } from '../../logic/types';
import { PHASE_THEME_CLASSES, Screen, uiState } from '../appState';
import { GameLogCategory } from '../gameLogFeed';
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
import { getBottomPlayer, getTopPlayer } from '../playerPerspective';
import { attachListeners } from './gameBindings';

const MIN_BATTLE_SCALE = 0.58;
const AUTO_LOG_COLLAPSE_HEIGHT_THRESHOLD = 980;
const AUTO_LOG_COLLAPSE_WIDTH_THRESHOLD = 1680;
const BATTLE_BOARD_WIDTH_PX = 760;
const HAND_ZONE_HORIZONTAL_PADDING_PX = 28;
const HAND_CARD_WIDTH_PX = 130;
const HAND_CARD_MAX_GAP_PX = 8;
const HAND_CARD_MIN_STEP_PX = 24;

let gameResizeRafId: number | null = null;
let gameResizeListenerBound = false;

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

function applyAutoLogCollapsePolicy(): boolean {
    const autoCollapsed = shouldAutoCollapseLog({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
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
    if (gameResizeListenerBound) return;
    window.addEventListener('resize', handleGameResize);
    gameResizeListenerBound = true;
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

function getLogCategoryLabel(category: GameLogCategory): string {
    switch (category) {
        case 'ACTION':
            return '행동';
        case 'PHASE':
            return '페이즈';
        case 'COMBAT':
            return '전투';
        case 'EFFECT':
            return '효과';
        case 'TARGET':
            return '대상';
        case 'RULE':
            return '규칙';
        case 'SYSTEM':
            return '시스템';
        default:
            return category;
    }
}

function renderGameLogPanel(): string {
    const filterDefs: Array<{ value: 'ALL' | GameLogCategory; label: string }> = [
        { value: 'ALL', label: '전체' },
        { value: 'ACTION', label: '행동' },
        { value: 'COMBAT', label: '전투' },
        { value: 'EFFECT', label: '효과' },
        { value: 'TARGET', label: '대상' },
        { value: 'PHASE', label: '페이즈' },
        { value: 'RULE', label: '규칙' },
        { value: 'SYSTEM', label: '시스템' },
    ];
    const selectedFilter = uiState.gameLogView.filter;
    const allEntries = uiState.gameLogFeed.getEntries();
    const filteredEntries = selectedFilter === 'ALL'
        ? allEntries
        : allEntries.filter(entry => entry.category === selectedFilter);
    const maxVisible = Math.max(1, uiState.gameLogView.maxVisibleEntries);
    const visibleEntries = filteredEntries.slice(-maxVisible).reverse();
    const isExpanded = uiState.gameLogView.expanded;

    return `
        <aside class="game-log-panel ${isExpanded ? '' : 'collapsed'}">
            <div class="game-log-header">
                <div class="game-log-title">게임 로그</div>
                <div class="game-log-controls">
                    <button id="game-log-clear" class="secondary-btn small-btn">지우기</button>
                    <button id="game-log-toggle" class="secondary-btn small-btn">${isExpanded ? '접기' : '펼치기'}</button>
                </div>
            </div>
            ${isExpanded ? `
                <div class="game-log-filters">
                    ${filterDefs.map(filter => `
                        <button class="game-log-filter-btn ${selectedFilter === filter.value ? 'active' : ''}" data-log-filter="${filter.value}">
                            ${filter.label}
                        </button>
                    `).join('')}
                </div>
                <div class="game-log-body">
                    ${visibleEntries.length === 0 ? '<div class="game-log-empty">아직 로그가 없습니다.</div>' : ''}
                    ${visibleEntries.map(entry => {
        const safeMessage = escapeHtml(entry.message).replace(/\n/g, '<br>');
        const safeSource = escapeHtml(entry.source);
        return `
                            <div class="game-log-entry level-${entry.level.toLowerCase()}">
                                <div class="game-log-entry-meta">
                                    <span class="game-log-badge category-${entry.category.toLowerCase()}">${getLogCategoryLabel(entry.category)}</span>
                                    <span class="game-log-level">${entry.level}</span>
                                    <span class="game-log-turn">T${entry.turnCount ?? '-'}</span>
                                    <span class="game-log-phase">${entry.phase ?? '-'}</span>
                                    <span class="game-log-mode">${entry.interactionMode ?? '-'}</span>
                                </div>
                                <div class="game-log-message">${safeMessage}</div>
                                <div class="game-log-source">${safeSource}</div>
                            </div>
                        `;
    }).join('')}
                </div>
            ` : ''}
        </aside>
    `;
}

function renderVerificationSessionPanel(): string {
    if (!uiState.verificationSession) return '';
    const currentOrder = uiState.verificationSession.currentIndex + 1;
    const totalTests = uiState.verificationSession.orderedTestIds.length;
    const hasNextTest = uiState.verificationSession.currentIndex < totalTests - 1;
    const safeInstructions = escapeHtml(uiState.verificationSession.currentInstructions).replace(/\n/g, '<br>');
    return `
        <div class="verification-session-panel">
            <div class="verification-session-actions">
                <button id="verification-back-btn" class="secondary-btn">Back to Verification (V)</button>
                <button id="verification-next-btn" class="primary-btn" ${hasNextTest ? '' : 'disabled'}>Next Test (N)</button>
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

function renderOptionalEffectModal() {
    if (!uiState.game) return '';
    if (uiState.game.state.interactionMode !== 'SELECT_OPTIONAL') return '';
    const pending = uiState.game.state.pendingEffect as any;
    if (!pending) return '';

    const description = pending.effectDescription ?? 'Activate optional effect?';

    return `
        <div class="modal-overlay">
            <div class="modal-content">
                <h3>Optional Effect</h3>
                <p>${description}</p>
                <div class="modal-actions">
                    <button id="opt-confirm" class="primary-btn">Activate</button>
                    <button id="opt-skip" class="secondary-btn">Skip</button>
                </div>
            </div>
        </div>
    `;
}

function renderTrashModal() {
    if (!uiState.game) return '';
    if (uiState.game.state.interactionMode !== 'SELECT_TARGET') return '';
    const pending = uiState.game.state.pendingEffect as any;
    if (!pending || pending.validTargets !== 'MY_TRASH') return '';

    const sourcePlayer = uiState.game.state.players.find(p => p.id === pending.sourcePlayerId);
    if (!sourcePlayer) return '';
    const trash = sourcePlayer.trash;

    return `
        <div class="modal-overlay">
            <div class="trash-modal">
                <h3>Select a card from Trash</h3>
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
            </div>
        </div>
    `;
}

function renderRevealedCardsModal() {
    if (!uiState.game) return '';
    if (uiState.game.state.revealedCards.length === 0) return '';

    const pending = uiState.game.state.pendingEffect as any;
    const isSelecting = uiState.game.state.interactionMode === 'SELECT_TARGET' && pending?.validTargets === 'REVEALED';
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
        <div class="modal-overlay">
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
            if (filter.type === 'COST_LIMIT' && c.cost > filter.value) matchesFilter = false;
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

function renderPlayer(
    player: any,
    isOpponent: boolean,
    isMainPhase: boolean,
    legalActions: any[],
    inputOwnerId: string,
) {
    if (!uiState.game) return '';
    const localHumanCanInput = canLocalHumanInput();
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
    const showDamageCardSelection =
        uiState.game.state.interactionMode === 'SELECT_TARGET' &&
        damageTargetActionsForPlayer.length > 0;
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
                        ${z.unit ? `<div class="stats">${uiState.game!.getUnitPower(z, player)} / ${uiState.game!.getUnitHit(z, player)}</div>` : ''}
                    </div>
                `;
    }).join('')}
            </div>

            <div class="bottom-center">
                <div class="damage-zone ${showDamageCardSelection ? 'selection-mode' : 'summary-mode'}" data-player="${isOpponent ? 'opponent' : 'current'}">
                    ${showDamageCardSelection ? player.damage.map((c: any, damageIndex: number) => {
        const isDamageSelected = uiState.game!.state.pendingEffect?.selectedTargets?.includes(c);
        return `<div class="damage-card-item ${isDamageSelected ? 'selected-target' : ''}" data-player="${isOpponent ? 'opponent' : 'current'}" data-index="${damageIndex}">${renderCard(c, true)}</div>`;
    }).join('') : `
                        <div class="damage-summary ${player.damage.length === 0 ? 'empty' : ''}">
                            <div class="damage-count">${player.damage.length}</div>
                            <div class="damage-label">DAMAGE</div>
                        </div>
                    `}
                </div>
                <div class="skill-zone ${isInputOwnerPlayer && isMainPhase && localHumanCanInput ? 'interactive drop-zone-skill' : ''}">
                    ${player.skillZone.map((c: any, skillIndex: number) => `
                        <div class="skill-card-item" data-player="${isOpponent ? 'opponent' : 'current'}" data-index="${skillIndex}">
                            ${renderCard(c, true)}
                        </div>
                    `).join('')}
                    ${player.skillZone.length === 0 ? '<span style="color: rgba(255,255,255,0.1); font-weight: bold; width: 100%; text-align: center;">SKILL</span>' : ''}
                </div>
            </div>
        </div>

        <div class="field-right">
            <div class="deck-zone">
                <div class="deck-count">${player.deck.length}</div>
                <div style="font-size: 0.6rem; color: #a0aec0; font-weight: bold;">DECK</div>
            </div>
            <div class="trash-zone" data-player="${isOpponent ? 'opponent' : 'current'}">
                ${player.trash.length > 0 ? renderCard(player.trash[player.trash.length - 1], true) : '<span style="color: rgba(255,255,255,0.1); font-size: 0.7rem; font-weight: bold;">TRASH</span>'}
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

    const isMainPhase = uiState.game.state.phase === Phase.MAIN;
    const computeHandStepPx = (cardCount: number): number => {
        const maxStep = HAND_CARD_WIDTH_PX + HAND_CARD_MAX_GAP_PX;
        if (cardCount <= 1) return maxStep;

        const innerWidth = BATTLE_BOARD_WIDTH_PX - HAND_ZONE_HORIZONTAL_PADDING_PX;
        const idealStep = Math.floor((innerWidth - HAND_CARD_WIDTH_PX) / Math.max(1, cardCount - 1));
        return Math.max(HAND_CARD_MIN_STEP_PX, Math.min(maxStep, idealStep));
    };
    const topHandStepPx = computeHandStepPx(topPlayer.hand.length);
    const bottomHandStepPx = computeHandStepPx(bottomPlayer.hand.length);
    let interactionBannerHtml = '';

    if (uiState.game.state.interactionMode === 'SELECT_TARGET') {
        const pending = uiState.game.state.pendingEffect as any;
        const maxCount = pending?.targetSchema?.count || 0;
        const currentCount = pending?.selectedTargets?.length || 0;
        const actorId = getActionOwnerPlayerId(uiState.game);
        const canConfirm = uiState.game.getLegalActions(actorId).some(action => action.type === 'CONFIRM_TARGETS');
        const sacrificeHint = pending?.actionType === 'SACRIFICE_TO_BUFF'
            ? (currentCount === 0
                ? 'Step 1/2: Select the unit to trash.'
                : currentCount === 1
                    ? 'Step 2/2: Select the unit to receive +2000 power.'
                    : 'Selection complete. Confirm to resolve.')
            : '';

        interactionBannerHtml = `
            <div class="game-interaction-banner target-mode">
                <span>SELECT TARGETS (${currentCount}/${maxCount === 0 ? 'All' : maxCount})</span>
                ${sacrificeHint ? `<span class="game-interaction-sub">${sacrificeHint}</span>` : ''}
                <button id="confirm-targets-btn" class="primary-btn small-btn-inline" ${canConfirm ? '' : 'disabled'}>Confirm</button>
            </div>
        `;
    } else if (uiState.game.state.interactionMode === 'SELECT_COST') {
        interactionBannerHtml = `
            <div class="game-interaction-banner cost-mode">
                <span>SELECT CARD TO TRASH (COST)</span>
            </div>
        `;
    }

    uiState.app.innerHTML = `
    <div class="game-container">
      ${verificationGame ? renderVerificationSessionPanel() : ''}
      <div class="game-layout-root">
        <div class="battle-fit-viewport">
          <div class="battle-fit-content" style="--battle-scale: 1;">
            <div class="opponent-hand-zone fan-layout" style="--hand-step:${topHandStepPx}px;">
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

            <div class="hand-zone fan-layout" style="--hand-step:${bottomHandStepPx}px;">
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

        <aside class="game-side-rail">
          <div class="game-top-bar">
            <button id="db-back-to-menu" class="secondary-btn game-menu-btn">${inOnlineMatch ? 'Room' : 'Menu'}</button>
            <div class="game-top-title">NivelArena</div>
            ${interactionBannerHtml}
          </div>
          ${renderGameLogPanel()}
          <div class="game-controls">
            <div class="status-bar">
              <div class="status-item"><span>Turn</span> <strong>${uiState.game.state.turnCount}</strong></div>
              <div class="status-item"><span>Phase</span> <strong>${uiState.game.state.phase}</strong></div>
              <div class="status-item"><span>Active</span> <strong>${uiState.game.currentPlayer.name}</strong></div>
              <div class="status-item"><span>Mode</span> <strong>${uiState.activeMatchConfig.label}</strong></div>
              <div class="status-item"><span>Bot Hand</span> <strong>${uiState.activeMatchViewConfig.revealBotHand ? 'Shown' : 'Hidden'}</strong></div>
              <div class="status-item"><span>Input</span> <strong>${inputOwner?.name ?? 'N/A'} (${inputOwnerControl})</strong></div>
            </div>
            ${renderGameControlButtons(localHumanCanInput)}
          </div>
        </aside>
      </div>

      ${renderOptionalEffectModal()}
      ${renderMulliganModal()}
      ${renderTrashModal()}
      ${renderRevealedCardsModal()}
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
