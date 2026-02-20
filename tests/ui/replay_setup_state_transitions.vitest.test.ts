import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('replay setup state transitions', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        localStorage.clear();
    });

    it('returns to menu when back button is clicked', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderBotReplaySetup } = await import('../../src/ui/screens/replaySetup');

        uiState.render = vi.fn();
        uiState.currentScreen = Screen.BOT_REPLAY_SETUP;
        uiState.botReplaySetupState.running = false;

        renderBotReplaySetup();
        (document.getElementById('bot-replay-back') as HTMLButtonElement).click();

        expect(uiState.currentScreen).toBe(Screen.MENU);
    });

    it('updates model and deck mode from setup inputs', async () => {
        const { uiState } = await import('../../src/ui/appState');
        const { renderBotReplaySetup } = await import('../../src/ui/screens/replaySetup');

        uiState.render = vi.fn();
        uiState.botReplaySetupState.running = false;
        renderBotReplaySetup();

        const p1ModelSelect = document.getElementById('bot-replay-p1-model') as HTMLSelectElement;
        const alternateModel = Array.from(p1ModelSelect.options)
            .map(option => option.value)
            .find(value => value !== uiState.botReplaySetupState.player1BotId) ?? p1ModelSelect.value;

        p1ModelSelect.value = alternateModel;
        p1ModelSelect.dispatchEvent(new Event('change', { bubbles: true }));
        expect(uiState.botReplaySetupState.player1BotId).toBe(alternateModel);

        const customRadio = document.querySelector<HTMLInputElement>('input[name="replay-deck-mode"][value="CUSTOM"]');
        customRadio!.checked = true;
        customRadio!.dispatchEvent(new Event('change', { bubbles: true }));
        expect(uiState.botReplaySetupState.deckMode).toBe('CUSTOM');
    });
});
