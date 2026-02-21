import { Phase, Card, CardType } from '../../logic/types';
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
import { attachListeners } from './gameBindings';

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

    return `
        <div class="modal-overlay">
            <div class="trash-modal">
                <h3>Revealed Cards</h3>
                <p style="text-align: center; color: #a0aec0; margin-bottom: 20px;">
                    ${isTakeAll ? 'Cards matching the filter will be added to hand' : (isSelecting ? 'Select a card to add to hand' : 'Cards revealed by effect')}
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
                    <button id="game-over-menu-btn" class="primary-btn">Back to Main Menu</button>
                </div>
            </div>
        </div>
    `;
}

function renderPlayer(player: any, isOpponent: boolean, isMainPhase: boolean, legalActions: any[]) {
    if (!uiState.game) return '';
    const localHumanCanInput = canLocalHumanInput();
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
    const leaderHasActivatableEffect =
        !isOpponent &&
        player.levelZone?.isAwakened === true &&
        activatableEffectActions.some((action: any) => action.sourceType === 'LEADER');
    return `
      <div class="player-area ${isOpponent ? 'opponent' : 'current'}">
        <div class="level-zone">
            <div class="leader-slot">
                ${player.levelZone ? renderCard(player.levelZone, true) : ''}
                ${!isOpponent && localHumanCanInput && leaderHasActivatableEffect ? '<button class="leader-active-btn">Active</button>' : ''}
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
        const isEncounterLane = uiState.game!.state.phase === Phase.BLOCK && isOpponent && pendingAttackerLaneIndex === i;
        const canBlockWithThisZone = uiState.game!.state.phase === Phase.BLOCK && isOpponent && blockableZoneSet.has(i);
        const showPassControl = uiState.game!.state.phase === Phase.BLOCK && isOpponent && hasBlockPassAction && isEncounterLane;
        const isBlockingTarget = isEncounterLane || canBlockWithThisZone;
        const zoneHasActivatableEffect = !isOpponent && activatableEffectActions.some((action: any) => action.zoneIndex === i);
        const canAttackFromThisZone = !isOpponent && attackActionZoneSet.has(i);
        const isSelected = uiState.game!.state.pendingEffect?.selectedTargets?.includes(z);

        return `
                    <div class="zone unit-zone ${!isOpponent && localHumanCanInput ? 'interactive drop-zone' : ''} ${isBlockingTarget ? 'blocking-target' : ''} ${isSelected ? 'selected-target' : ''}" data-player="${isOpponent ? 'opponent' : 'current'}" data-index="${i}">
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

                        ${z.unit && !isOpponent && localHumanCanInput && canAttackFromThisZone ? '<button class="attack-btn">Attack</button>' : ''}
                        ${!isOpponent && localHumanCanInput && zoneHasActivatableEffect ? '<button class="active-btn">Active</button>' : ''}
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
                <div class="damage-zone">
                    ${player.damage.map((c: any, damageIndex: number) => {
        const isDamageSelected = uiState.game!.state.pendingEffect?.selectedTargets?.includes(c);
        return `<div class="damage-card-item ${isDamageSelected ? 'selected-target' : ''}" data-player="${isOpponent ? 'opponent' : 'current'}" data-index="${damageIndex}">${renderCard(c, true)}</div>`;
    }).join('')}
                    ${player.damage.length === 0 ? '<span style="color: rgba(255,255,255,0.1); align-self: center; width: 100%; text-align: center; font-weight: bold;">DAMAGE ZONE</span>' : ''}
                </div>
                <div class="skill-zone ${!isOpponent && isMainPhase && localHumanCanInput ? 'interactive drop-zone-skill' : ''}">
                    ${player.skillZone.map((c: any) => renderCard(c, true)).join('')}
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

export function renderCard(card: Card, isSmall: boolean = false, calculatedPower?: number, calculatedHit?: number) {
    const isUnit = card.type === CardType.UNIT;
    const power = calculatedPower !== undefined ? calculatedPower : card.power;
    const hit = calculatedHit !== undefined ? calculatedHit : card.hit;

    return `
        <div class="card ${card.attribute.toLowerCase()} ${isSmall ? 'small-card' : ''} ${card.isAwakened ? 'awakened' : ''}">
            ${card.imageUrl ? `<img src="${card.imageUrl}" class="card-image" alt="${card.name}">` : ''}
            <div class="card-overlay">
                <div class="card-cost">${card.cost}</div>
                <div class="card-name">${card.name}</div>
                ${isUnit && !isSmall ? `
                    <div class="card-stats-row">
                        <span class="stat-power" ${calculatedPower !== undefined && calculatedPower !== card.power ? 'style="color:#4ecdc4; font-weight:bold;"' : ''}>P:${power}</span>
                        <span class="stat-hit" ${calculatedHit !== undefined && calculatedHit !== card.hit ? 'style="color:#ff6b6b; font-weight:bold;"' : ''}>H:${hit}</span>
                    </div>
                ` : ''}
            </div>
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

    const currentPlayer = uiState.game.currentPlayer;
    const opponent = uiState.game.opponentPlayer;
    const revealCurrentPlayerHand = shouldRevealHandForPlayer(currentPlayer.id);
    const revealOpponentHand = shouldRevealHandForPlayer(opponent.id);
    const inputOwnerId = getActionOwnerPlayerId(uiState.game);
    const inputOwner = uiState.game.state.players.find(player => player.id === inputOwnerId) ?? null;
    const localHumanCanInput = canLocalHumanInput();
    const inputOwnerLegalActions = uiState.game.getLegalActions(inputOwnerId);
    const inputOwnerControl = inputOwner
        ? (isBotControlledPlayer(inputOwner.id) ? getBotLabelForPlayerId(inputOwner.id) : 'Human')
        : 'N/A';
    const verificationGame = isVerificationGame();

    const isMainPhase = uiState.game.state.phase === Phase.MAIN;

    uiState.app.innerHTML = `
    <div class="game-container">
      <div class="header">
        <h1>NivelArena</h1>
        ${uiState.game.state.interactionMode === 'SELECT_TARGET' ? (() => {
            const pending = uiState.game!.state.pendingEffect as any;
            const maxCount = pending?.targetSchema?.count || 0;
            const currentCount = pending.selectedTargets?.length || 0;
            const actorId = getActionOwnerPlayerId(uiState.game!);
            const canConfirm = uiState.game!.getLegalActions(actorId).some(action => action.type === 'CONFIRM_TARGETS');
            const sacrificeHint = pending?.actionType === 'SACRIFICE_TO_BUFF'
                ? (currentCount === 0
                    ? 'Step 1/2: Select the unit to trash.'
                    : currentCount === 1
                        ? 'Step 2/2: Select the unit to receive +2000 power.'
                        : 'Selection complete. Confirm to resolve.')
                : '';

            return `
            <div style="background: #e17055; color: white; padding: 10px; border-radius: 4px; display: flex; align-items: center; gap: 15px;">
                <span style="animation: pulse 1s infinite;">SELECT TARGETS (${currentCount}/${maxCount === 0 ? 'All' : maxCount})</span>
                ${sacrificeHint ? `<span style="font-size: 0.85rem; opacity: 0.9;">${sacrificeHint}</span>` : ''}
                <button id="confirm-targets-btn" class="primary-btn" ${canConfirm ? '' : 'disabled'} style="background: ${canConfirm ? '#2ecc71' : '#636e72'}; border: none; padding: 5px 15px;">Confirm</button>
            </div>
            `;
        })() : ''}
        ${uiState.game.state.interactionMode === 'SELECT_COST' ? `
            <div style="background: #0984e3; color: white; padding: 10px; border-radius: 4px; animation: pulse 1s infinite;">
                SELECT CARD TO TRASH (COST)
            </div>
        ` : ''}
        <button id="db-back-to-menu" class="secondary-btn" style="position: absolute; top: 10px; left: 10px;">Menu</button>
      </div>
      ${verificationGame ? renderVerificationSessionPanel() : ''}

      <div class="opponent-hand-zone">
          ${opponent.hand.map((c, i) => {
            const pending = uiState.game!.state.pendingEffect as any;
            const isTargetCandidate = uiState.game!.state.interactionMode === 'SELECT_TARGET' &&
                pending &&
                uiState.game!.isPendingCardTarget(c);
            return `
              <div class="card-in-hand ${isTargetCandidate ? 'target-candidate' : ''} ${revealOpponentHand ? '' : 'concealed-hand'}" data-index="${i}" data-hand-revealed="${revealOpponentHand ? '1' : '0'}">
                  ${revealOpponentHand ? renderCard(c) : renderHiddenHandCard(false)}
              </div>
          `}).join('')}
      </div>

      ${renderPlayer(opponent, true, isMainPhase, inputOwnerLegalActions)}

      <div class="game-divider"></div>

      ${renderPlayer(currentPlayer, false, isMainPhase, inputOwnerLegalActions)}

      <div class="hand-zone">
          ${currentPlayer.hand.map((c, i) => {
                const isCostCandidate = uiState.game!.state.interactionMode === 'SELECT_COST';
                const pending = uiState.game!.state.pendingEffect as any;
                const isTargetCandidate = uiState.game!.state.interactionMode === 'SELECT_TARGET' &&
                    pending &&
                    uiState.game!.isPendingCardTarget(c);

                return `
              <div class="card-in-hand ${isCostCandidate ? 'cost-candidate' : ''} ${isTargetCandidate ? 'target-candidate' : ''} ${revealCurrentPlayerHand ? '' : 'concealed-hand'}" draggable="${isMainPhase && uiState.game!.state.interactionMode === 'NORMAL' && localHumanCanInput}" data-index="${i}" data-hand-revealed="${revealCurrentPlayerHand ? '1' : '0'}">
                  ${revealCurrentPlayerHand ? renderCard(c) : renderHiddenHandCard(false)}
              </div>
          `}).join('')}
      </div>

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

      ${renderOptionalEffectModal()}
      ${renderMulliganModal()}
      ${renderTrashModal()}
      ${renderRevealedCardsModal()}
      ${renderGameOverModal()}
      ${renderReplayOverlayControls()}
    </div>
  `;

    attachListeners(renderCard);
    scheduleAutoPhaseAdvance();
    scheduleBotStep();
}
