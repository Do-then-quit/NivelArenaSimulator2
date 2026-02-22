import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('main screen routing', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        localStorage.clear();
    });

    it('routes to setup screen from custom simulation buttons', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderMenu } = await import('../../src/ui/screens/menu');

        uiState.render = vi.fn();
        renderMenu();

        (document.getElementById('custom-sim-btn') as HTMLButtonElement).click();
        expect(uiState.currentScreen).toBe(Screen.SETUP);

        uiState.currentScreen = Screen.MENU;
        (document.getElementById('custom-vs-bot-btn') as HTMLButtonElement).click();
        expect(uiState.currentScreen).toBe(Screen.SETUP);
    });

    it('routes to replay setup and test screens from menu actions', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { renderMenu } = await import('../../src/ui/screens/menu');

        uiState.render = vi.fn();
        renderMenu();

        (document.getElementById('bot-replay-btn') as HTMLButtonElement).click();
        expect(uiState.currentScreen).toBe(Screen.BOT_REPLAY_SETUP);

        uiState.currentScreen = Screen.MENU;
        (document.getElementById('card-test-btn') as HTMLButtonElement).click();
        expect(uiState.currentScreen).toBe(Screen.TEST);

        uiState.currentScreen = Screen.MENU;
        (document.getElementById('online-room-btn') as HTMLButtonElement).click();
        expect(uiState.currentScreen).toBe(Screen.ONLINE_ROOM);
    });
});
