import { DeckPersistence } from '../../logic/DeckPersistence';
import { Screen, uiState } from '../appState';
import { DeckSummary, RoomPlayerView } from '../../shared/onlineProtocol';
import {
    createRoom,
    ensureOnlineClient,
    getLocalSelectedDeckId,
    joinRoom,
    leaveRoomAndDisconnect,
    setReady,
    submitDeckSelection,
} from '../online/onlineMatchController';

const ONLINE_NAME_KEY = 'nivelarena_online_name';

function getSavedPlayerName(): string {
    const saved = localStorage.getItem(ONLINE_NAME_KEY);
    return saved?.trim() ? saved.trim() : 'Player';
}

function savePlayerName(name: string): void {
    localStorage.setItem(ONLINE_NAME_KEY, name);
}

function sanitizeRoomCode(value: string): string {
    return value.replace(/\D/g, '').slice(0, 6);
}

function getLocalPlayer(): RoomPlayerView | null {
    const room = uiState.onlineSession.room;
    const localClientId = uiState.onlineSession.localClientId;
    if (!room || !localClientId) return null;
    return room.players.find(player => player.clientId === localClientId) ?? null;
}

function isDeckSummaryValid(summary: DeckSummary | null): boolean {
    if (!summary) return false;
    if (!summary.leaderId) return false;
    return summary.cardCount === 40 && summary.valid;
}

function renderDeckSummary(summary: DeckSummary | null): string {
    if (!summary) return '<span class="online-room-deck-empty">No deck submitted</span>';
    const validity = isDeckSummaryValid(summary) ? 'Valid' : 'Invalid';
    return `
        <div class="online-room-deck-summary">
            <div><strong>${summary.deckName}</strong></div>
            <div>Leader: ${summary.leaderId}</div>
            <div>Cards: ${summary.cardCount}/40</div>
            <div>Status: ${validity}</div>
        </div>
    `;
}

function renderEntryPanel() {
    const savedName = getSavedPlayerName();

    uiState.app.innerHTML = `
        <div class="setup-screen">
            <h1>Online Match (Room Code)</h1>
            <div class="setup-main" style="grid-template-columns: 1fr; max-width: 520px; margin: 0 auto;">
                <div class="player-setup">
                    <h3>Connection</h3>
                    <div class="preview-info"><strong>Status:</strong> ${uiState.onlineSession.connected ? 'Connected' : 'Connecting...'}</div>
                    <label style="display:block; margin-top: 10px;">Player Name</label>
                    <input id="online-player-name" class="db-input" type="text" maxlength="20" value="${savedName}" />

                    <div style="display:flex; gap: 10px; margin-top: 14px;">
                        <button id="online-create-room-btn" class="primary-btn">Create Room</button>
                        <button id="online-back-btn" class="secondary-btn">Back to Menu</button>
                    </div>

                    <div style="margin-top: 20px;">
                        <label style="display:block;">Room Code (6 digits)</label>
                        <input id="online-room-code-input" class="db-input" type="text" maxlength="6" placeholder="123456" />
                        <button id="online-join-room-btn" class="primary-btn" style="margin-top: 10px; width: 100%;">Join Room</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const getName = () => {
        const input = document.getElementById('online-player-name') as HTMLInputElement | null;
        const name = input?.value.trim() ?? '';
        if (!name) return null;
        savePlayerName(name);
        return name;
    };

    document.getElementById('online-create-room-btn')?.addEventListener('click', () => {
        const name = getName();
        if (!name) {
            alert('Please enter a player name.');
            return;
        }
        createRoom(name);
    });

    document.getElementById('online-join-room-btn')?.addEventListener('click', () => {
        const name = getName();
        if (!name) {
            alert('Please enter a player name.');
            return;
        }
        const codeInput = document.getElementById('online-room-code-input') as HTMLInputElement | null;
        const roomCode = sanitizeRoomCode(codeInput?.value ?? '');
        if (roomCode.length !== 6) {
            alert('Room code must be 6 digits.');
            return;
        }
        joinRoom(roomCode, name);
    });

    document.getElementById('online-room-code-input')?.addEventListener('input', (event) => {
        const input = event.target as HTMLInputElement;
        input.value = sanitizeRoomCode(input.value);
    });

    document.getElementById('online-back-btn')?.addEventListener('click', () => {
        leaveRoomAndDisconnect();
        uiState.currentScreen = Screen.MENU;
        uiState.render?.();
    });
}

function renderLobbyPanel() {
    const room = uiState.onlineSession.room;
    if (!room) return;
    const localPlayer = getLocalPlayer();
    const localDecks = DeckPersistence.getAllDecks();
    const selectedDeckId = getLocalSelectedDeckId() ?? localDecks[0]?.id ?? '';
    const localReady = localPlayer?.ready ?? false;
    const roomPlayers = [...room.players].sort((a, b) => a.slot.localeCompare(b.slot));
    const inGame = room.phase === 'IN_GAME';
    const canReady = !!localPlayer?.deckSummary && isDeckSummaryValid(localPlayer.deckSummary) && !inGame;

    uiState.app.innerHTML = `
        <div class="setup-screen">
            <h1>Online Room #${room.roomCode}</h1>
            <div class="setup-main" style="grid-template-columns: 1fr; max-width: 760px; margin: 0 auto;">
                <div class="player-setup">
                    <h3>Room Status</h3>
                    <div class="preview-info"><strong>Connection:</strong> ${uiState.onlineSession.connected ? 'Connected' : 'Disconnected'}</div>
                    <div class="preview-info"><strong>Phase:</strong> ${room.phase}</div>
                    <div class="preview-info"><strong>Role:</strong> ${uiState.onlineSession.role ?? 'N/A'}</div>
                </div>

                <div class="player-setup">
                    <h3>Players</h3>
                    ${roomPlayers.map(player => `
                        <div style="border:1px solid rgba(255,255,255,0.2); border-radius:8px; padding:10px; margin-bottom:10px;">
                            <div><strong>${player.slot}</strong> - ${player.name} ${player.clientId === uiState.onlineSession.localClientId ? '(You)' : ''}</div>
                            <div>Ready: ${player.ready ? 'YES' : 'NO'} / Connected: ${player.connected ? 'YES' : 'NO'}</div>
                            ${renderDeckSummary(player.deckSummary)}
                        </div>
                    `).join('')}
                </div>

                <div class="player-setup">
                    <h3>Your Deck</h3>
                    <select id="online-local-deck-select">
                        ${localDecks.length === 0 ? '<option value="">No saved decks</option>' : localDecks.map(deck => `
                            <option value="${deck.id}" ${deck.id === selectedDeckId ? 'selected' : ''}>${deck.name}</option>
                        `).join('')}
                    </select>
                    <div style="display:flex; gap:10px; margin-top:12px; flex-wrap: wrap;">
                        <button id="online-submit-deck-btn" class="secondary-btn" ${localDecks.length === 0 ? 'disabled' : ''}>Submit Deck</button>
                        <button id="online-open-deck-builder-btn" class="secondary-btn">Open Deck Builder</button>
                        <button id="online-ready-btn" class="primary-btn" ${canReady ? '' : 'disabled'}>${localReady ? 'Unready' : 'Ready'}</button>
                        <button id="online-leave-room-btn" class="secondary-btn">Leave Room</button>
                    </div>
                    ${!canReady ? '<p style="margin-top: 10px; color:#f6e58d;">Ready requires a valid submitted deck (40 cards + leader) and lobby phase.</p>' : ''}
                    ${uiState.onlineSession.pendingRequestId ? `<p style="margin-top:10px; color:#74b9ff;">Waiting commit: ${uiState.onlineSession.pendingRequestId}</p>` : ''}
                </div>
            </div>
        </div>
    `;

    document.getElementById('online-submit-deck-btn')?.addEventListener('click', () => {
        const select = document.getElementById('online-local-deck-select') as HTMLSelectElement | null;
        const deckId = select?.value ?? '';
        if (!deckId) {
            alert('Select a saved deck first.');
            return;
        }
        const ok = submitDeckSelection(deckId);
        if (!ok) {
            alert('Deck must contain exactly 40 cards and a leader.');
        }
    });

    document.getElementById('online-open-deck-builder-btn')?.addEventListener('click', () => {
        uiState.deckBuilderReturnScreen = Screen.ONLINE_ROOM;
        uiState.currentScreen = Screen.DECK_BUILDER;
        uiState.render?.();
    });

    document.getElementById('online-ready-btn')?.addEventListener('click', () => {
        setReady(!localReady);
    });

    document.getElementById('online-leave-room-btn')?.addEventListener('click', () => {
        leaveRoomAndDisconnect();
        uiState.currentScreen = Screen.MENU;
        uiState.render?.();
    });
}

export function renderOnlineRoom() {
    ensureOnlineClient();
    if (!uiState.onlineSession.room) {
        renderEntryPanel();
        return;
    }
    renderLobbyPanel();
}
