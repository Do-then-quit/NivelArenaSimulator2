import { Card, CardType } from '../../logic/types';
import { DUMMY_CARDS } from '../../logic/CardDatabase';
import { DeckPersistence, SavedDeck } from '../../logic/DeckPersistence';
import {
    BotModelId,
    getBotModelLabel,
} from '../../logic/ai/BotRegistry';
import {
    BotReplayDeckLoadout,
    BotReplaySimulationResult,
    createRandomLegalLoadout,
    createReplayPlaybackEngine,
    runBotVsBotReplaySimulation,
} from '../../logic/ai/BotVsBotReplay';
import { materializeDeckForMatch } from '../../../scripts/ai/deck_pool';
import { DebugManager } from '../../logic/DebugManager';
import { uiState, Screen } from '../appState';
import { clearBotStepTimer } from '../gameLoop';

function parsePositiveInt(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
}

function formatReplayActionSummary(summary: string): string {
    return summary.replace(/^Bot P[12]:\s*/, '');
}

function resolveSavedDeckCards(savedDeck: SavedDeck): Card[] {
    return savedDeck.cardIds
        .map(cardId => DUMMY_CARDS.find(card => card.id === cardId))
        .filter((card): card is Card => !!card);
}

function resolveCustomReplayLoadout(seed: number, player1DeckId: string | null, player2DeckId: string | null): BotReplayDeckLoadout | null {
    const savedDecks = DeckPersistence.getAllDecks();
    if (savedDecks.length === 0) {
        alert('No saved decks found. Create decks in Deck Builder first.');
        return null;
    }

    const savedDeck1 = savedDecks.find(deck => deck.id === player1DeckId) ?? null;
    const savedDeck2 = savedDecks.find(deck => deck.id === player2DeckId) ?? null;
    if (!savedDeck1 || !savedDeck2) {
        alert('Please select valid saved decks for both players.');
        return null;
    }

    const leader1Template = savedDeck1.leaderId ? DUMMY_CARDS.find(card => card.id === savedDeck1.leaderId) ?? null : null;
    const leader2Template = savedDeck2.leaderId ? DUMMY_CARDS.find(card => card.id === savedDeck2.leaderId) ?? null : null;
    if (!leader1Template || !leader2Template || leader1Template.type !== CardType.LEADER || leader2Template.type !== CardType.LEADER) {
        alert('Both custom decks must have a valid leader.');
        return null;
    }

    const deck1Source = resolveSavedDeckCards(savedDeck1);
    const deck2Source = resolveSavedDeckCards(savedDeck2);
    if (deck1Source.length !== savedDeck1.cardIds.length || deck2Source.length !== savedDeck2.cardIds.length) {
        alert('Some cards from selected decks could not be resolved from current card database.');
        return null;
    }

    const leader1: Card = { ...leader1Template, id: `${leader1Template.id}_L_${seed}_1` };
    const leader2: Card = { ...leader2Template, id: `${leader2Template.id}_L_${seed}_2` };
    const deck1 = materializeDeckForMatch(deck1Source, seed + 901, 'CUSTOM_P1');
    const deck2 = materializeDeckForMatch(deck2Source, seed + 902, 'CUSTOM_P2');

    return {
        seed,
        leader1,
        leader2,
        deck1,
        deck2,
        description: `Custom decks: ${savedDeck1.name} vs ${savedDeck2.name}`,
    };
}

export function renderBotReplaySetup() {
    const savedDecks = DeckPersistence.getAllDecks();
    const usingCustomDecks = uiState.botReplaySetupState.deckMode === 'CUSTOM';

    if (!uiState.botReplaySetupState.player1DeckId && savedDecks[0]) {
        uiState.botReplaySetupState.player1DeckId = savedDecks[0].id;
    }
    if (!uiState.botReplaySetupState.player2DeckId) {
        uiState.botReplaySetupState.player2DeckId = savedDecks[1]?.id ?? savedDecks[0]?.id ?? null;
    }

    uiState.app.innerHTML = `
        <div class="setup-screen bot-replay-setup">
            <h1>Bot vs Bot Replay Setup</h1>
            <div class="setup-main">
                <div class="player-setup">
                    <h3>Player 1 Bot</h3>
                    <div class="deck-select">
                        <label>Bot Model:</label>
                        <select id="bot-replay-p1-model" ${uiState.botReplaySetupState.running ? 'disabled' : ''}>
                            ${uiState.availableBotModels.map(bot => `<option value="${bot.id}" ${uiState.botReplaySetupState.player1BotId === bot.id ? 'selected' : ''}>${bot.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="deck-preview-small">
                        <div class="preview-info"><strong>Model:</strong> ${getBotModelLabel(uiState.botReplaySetupState.player1BotId)}</div>
                    </div>
                </div>
                <div class="vs-divider">VS</div>
                <div class="player-setup">
                    <h3>Player 2 Bot</h3>
                    <div class="deck-select">
                        <label>Bot Model:</label>
                        <select id="bot-replay-p2-model" ${uiState.botReplaySetupState.running ? 'disabled' : ''}>
                            ${uiState.availableBotModels.map(bot => `<option value="${bot.id}" ${uiState.botReplaySetupState.player2BotId === bot.id ? 'selected' : ''}>${bot.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="deck-preview-small">
                        <div class="preview-info"><strong>Model:</strong> ${getBotModelLabel(uiState.botReplaySetupState.player2BotId)}</div>
                    </div>
                </div>
            </div>

            <div class="setup-extra-options">
                <h3>Deck Source</h3>
                <label class="setup-radio-option">
                    <input type="radio" name="replay-deck-mode" value="CUSTOM" ${usingCustomDecks ? 'checked' : ''} ${uiState.botReplaySetupState.running ? 'disabled' : ''}>
                    <span>Saved Custom Decks</span>
                </label>
                <label class="setup-radio-option">
                    <input type="radio" name="replay-deck-mode" value="RANDOM" ${usingCustomDecks ? '' : 'checked'} ${uiState.botReplaySetupState.running ? 'disabled' : ''}>
                    <span>Random Legal Deck Generator</span>
                </label>

                <div class="bot-replay-options-grid">
                    ${usingCustomDecks ? `
                        <div class="deck-select">
                            <label>Player 1 Deck:</label>
                            <select id="bot-replay-p1-deck" ${savedDecks.length === 0 || uiState.botReplaySetupState.running ? 'disabled' : ''}>
                                ${savedDecks.map(deck => `<option value="${deck.id}" ${uiState.botReplaySetupState.player1DeckId === deck.id ? 'selected' : ''}>${deck.name}</option>`).join('')}
                                ${savedDecks.length === 0 ? '<option value="">No saved decks</option>' : ''}
                            </select>
                        </div>
                        <div class="deck-select">
                            <label>Player 2 Deck:</label>
                            <select id="bot-replay-p2-deck" ${savedDecks.length === 0 || uiState.botReplaySetupState.running ? 'disabled' : ''}>
                                ${savedDecks.map(deck => `<option value="${deck.id}" ${uiState.botReplaySetupState.player2DeckId === deck.id ? 'selected' : ''}>${deck.name}</option>`).join('')}
                                ${savedDecks.length === 0 ? '<option value="">No saved decks</option>' : ''}
                            </select>
                        </div>
                    ` : `
                        <div class="deck-select">
                            <label>Random Seed:</label>
                            <input id="bot-replay-seed" type="number" value="${uiState.botReplaySetupState.randomSeed}" ${uiState.botReplaySetupState.running ? 'disabled' : ''} />
                        </div>
                        <label class="setup-radio-option bot-replay-inline">
                            <input id="bot-replay-mirror" type="checkbox" ${uiState.botReplaySetupState.randomMirrorDeck ? 'checked' : ''} ${uiState.botReplaySetupState.running ? 'disabled' : ''}>
                            <span>Use Same Random Deck for Both Bots (Mirror)</span>
                        </label>
                    `}
                </div>

                <div class="deck-select">
                    <label>Simulation Max Steps:</label>
                    <input id="bot-replay-max-steps" type="number" min="50" value="${uiState.botReplaySetupState.maxSteps}" ${uiState.botReplaySetupState.running ? 'disabled' : ''} />
                </div>
            </div>

            ${uiState.botReplaySetupState.running ? `<div class="bot-replay-running">Simulating... steps=${uiState.botReplaySetupState.progressSteps}${uiState.botReplaySetupState.statusText ? ` (${uiState.botReplaySetupState.statusText})` : ''}</div>` : ''}

            <div class="setup-actions">
                <button id="bot-replay-back" class="secondary-btn" ${uiState.botReplaySetupState.running ? 'disabled' : ''}>Back to Menu</button>
                <button id="bot-replay-start" class="primary-btn" ${(uiState.botReplaySetupState.running || (usingCustomDecks && savedDecks.length === 0)) ? 'disabled' : ''}>Run 1 Game & Prepare Replay</button>
            </div>
        </div>
    `;

    document.getElementById('bot-replay-back')?.addEventListener('click', () => {
        if (uiState.botReplaySetupState.running) return;
        uiState.currentScreen = Screen.MENU;
        uiState.render?.();
    });

    document.getElementById('bot-replay-p1-model')?.addEventListener('change', (event) => {
        const target = event.target as HTMLSelectElement;
        uiState.botReplaySetupState.player1BotId = target.value as BotModelId;
    });

    document.getElementById('bot-replay-p2-model')?.addEventListener('change', (event) => {
        const target = event.target as HTMLSelectElement;
        uiState.botReplaySetupState.player2BotId = target.value as BotModelId;
    });

    document.querySelectorAll<HTMLInputElement>('input[name="replay-deck-mode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            uiState.botReplaySetupState.deckMode = radio.value as 'CUSTOM' | 'RANDOM';
            renderBotReplaySetup();
        });
    });

    document.getElementById('bot-replay-p1-deck')?.addEventListener('change', (event) => {
        const target = event.target as HTMLSelectElement;
        uiState.botReplaySetupState.player1DeckId = target.value || null;
    });

    document.getElementById('bot-replay-p2-deck')?.addEventListener('change', (event) => {
        const target = event.target as HTMLSelectElement;
        uiState.botReplaySetupState.player2DeckId = target.value || null;
    });

    document.getElementById('bot-replay-seed')?.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        uiState.botReplaySetupState.randomSeed = parsePositiveInt(target.value, Date.now());
    });

    document.getElementById('bot-replay-mirror')?.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        uiState.botReplaySetupState.randomMirrorDeck = target.checked;
    });

    document.getElementById('bot-replay-max-steps')?.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        uiState.botReplaySetupState.maxSteps = parsePositiveInt(target.value, 2400);
    });

    document.getElementById('bot-replay-start')?.addEventListener('click', () => {
        if (uiState.botReplaySetupState.running) return;
        void startBotReplayFromSetup();
    });
}

function initializeReplaySession(
    loadout: BotReplayDeckLoadout,
    result: BotReplaySimulationResult,
    player1BotId: BotModelId,
    player2BotId: BotModelId,
) {
    const playbackEngine = createReplayPlaybackEngine(loadout, true);
    const [player1, player2] = playbackEngine.state.players;

    uiState.replaySession = {
        loadout,
        result,
        actions: result.actions,
        currentActionIndex: 0,
        player1BotId,
        player2BotId,
        playerBotModelById: {
            [player1.id]: player1BotId,
            [player2.id]: player2BotId,
        },
        playerBotLabelById: {
            [player1.id]: getBotModelLabel(player1BotId),
            [player2.id]: getBotModelLabel(player2BotId),
        },
    };

    uiState.gameLogFeed.clear();
    clearBotStepTimer();
    uiState.botByPlayerId.clear();
    uiState.botLabelByPlayerId.clear();
    uiState.activeMatchConfig = {
        label: `${getBotModelLabel(player1BotId)} vs ${getBotModelLabel(player2BotId)} Replay`,
        player1Control: 'BOT',
        player2Control: 'BOT',
        player1BotId,
        player2BotId,
    };
    uiState.activeMatchViewConfig = { revealBotHand: true };
    uiState.game = playbackEngine;

    (window as any).debug = new DebugManager(playbackEngine, uiState.render!);
    uiState.currentScreen = Screen.GAME;
    uiState.gameLogFeed.pushUiLog(
        `[리플레이 준비] ${getBotModelLabel(player1BotId)} vs ${getBotModelLabel(player2BotId)} / ${loadout.description}`,
        'SYSTEM',
    );
    uiState.render?.();
}

export async function startBotReplayFromSetup() {
    const seed = parsePositiveInt(String(uiState.botReplaySetupState.randomSeed), Date.now());
    const maxSteps = Math.max(50, parsePositiveInt(String(uiState.botReplaySetupState.maxSteps), 2400));
    const player1BotId = uiState.botReplaySetupState.player1BotId;
    const player2BotId = uiState.botReplaySetupState.player2BotId;

    let loadout: BotReplayDeckLoadout | null = null;
    if (uiState.botReplaySetupState.deckMode === 'RANDOM') {
        loadout = createRandomLegalLoadout(seed, uiState.botReplaySetupState.randomMirrorDeck);
    } else {
        loadout = resolveCustomReplayLoadout(seed, uiState.botReplaySetupState.player1DeckId, uiState.botReplaySetupState.player2DeckId);
    }

    if (!loadout) return;

    uiState.botReplaySetupState = {
        ...uiState.botReplaySetupState,
        running: true,
        progressSteps: 0,
        statusText: `seed=${loadout.seed}`,
        randomSeed: loadout.seed,
        maxSteps,
    };
    renderBotReplaySetup();

    try {
        const result = await runBotVsBotReplaySimulation({
            seed: loadout.seed,
            maxSteps,
            enableMulligan: true,
            player1BotId,
            player2BotId,
            loadout,
            onProgress: (steps) => {
                if (uiState.currentScreen !== Screen.BOT_REPLAY_SETUP) return;
                if (steps % 20 !== 0) return;
                uiState.botReplaySetupState = {
                    ...uiState.botReplaySetupState,
                    progressSteps: steps,
                    statusText: `seed=${loadout.seed}, maxSteps=${maxSteps}`,
                };
                renderBotReplaySetup();
            },
        });

        initializeReplaySession(loadout, result, player1BotId, player2BotId);
    } catch (error) {
        console.error(error);
        alert(`Bot replay simulation failed: ${(error as Error).message}`);
        if (uiState.currentScreen === Screen.BOT_REPLAY_SETUP) {
            uiState.botReplaySetupState = {
                ...uiState.botReplaySetupState,
                running: false,
            };
            renderBotReplaySetup();
        }
    }
}

export function stepReplayForward() {
    if (!uiState.replaySession || !uiState.game) return;
    if (uiState.replaySession.currentActionIndex >= uiState.replaySession.actions.length) return;

    const entry = uiState.replaySession.actions[uiState.replaySession.currentActionIndex];
    const ok = uiState.game.step(entry.action);
    if (!ok) {
        alert(`Replay desync at step ${entry.step}: ${entry.summary}`);
        return;
    }

    uiState.replaySession.currentActionIndex += 1;
    uiState.gameLogFeed.pushUiLog(
        `[리플레이] ${entry.actorName}: ${formatReplayActionSummary(entry.summary)}`,
        'ACTION',
    );
    uiState.render?.();
}

export function restartReplayFromBeginning() {
    if (!uiState.replaySession) return;
    initializeReplaySession(
        uiState.replaySession.loadout,
        uiState.replaySession.result,
        uiState.replaySession.player1BotId,
        uiState.replaySession.player2BotId,
    );
}
