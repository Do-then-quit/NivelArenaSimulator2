import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('setup bot model selection', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<div id="app"></div>';
        localStorage.clear();
    });

    it('renders a bot selector for custom vs bot and updates the pending config', async () => {
        const { uiState, createHumanVsBotConfig } = await import('../../src/ui/appState');
        const { renderSetup } = await import('../../src/ui/screens/menu');

        uiState.render = vi.fn();
        uiState.pendingSetupConfig = createHumanVsBotConfig('baseline');
        uiState.pendingMatchViewConfig = { revealBotHand: false };

        renderSetup();

        const selector = document.getElementById('setup-bot-model-select') as HTMLSelectElement | null;
        expect(selector).not.toBeNull();
        expect(selector!.value).toBe('baseline');
        expect(document.querySelector('.setup-screen h1')?.textContent).toContain('Baseline');

        selector!.value = 'practice-bt05-nikki-strong-v1';
        selector!.dispatchEvent(new Event('change', { bubbles: true }));

        expect(uiState.pendingSetupConfig.player2BotId).toBe('practice-bt05-nikki-strong-v1');
        expect(uiState.pendingSetupConfig.player2Control).toBe('BOT');
        expect(uiState.pendingMatchViewConfig.revealBotHand).toBe(false);
        expect(document.querySelector('.setup-screen h1')?.textContent).toContain('Practice BT05 Nikki Strong v1');
        expect(document.querySelectorAll('.player-setup h3').item(1)?.textContent).toContain('Practice BT05 Nikki Strong v1');
    });

    it('does not render a bot selector for human vs human setup', async () => {
        const { uiState, HUMAN_VS_HUMAN_CONFIG } = await import('../../src/ui/appState');
        const { renderSetup } = await import('../../src/ui/screens/menu');

        uiState.render = vi.fn();
        uiState.pendingSetupConfig = HUMAN_VS_HUMAN_CONFIG;
        uiState.pendingMatchViewConfig = { revealBotHand: true };

        renderSetup();

        expect(document.getElementById('setup-bot-model-select')).toBeNull();
        expect(document.querySelector('.setup-screen h1')?.textContent).toBe('Simulation Setup');
    });
});
