import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ui/playbackOrchestrator', () => ({
    skipPlaybackQueue: vi.fn(() => false),
}));

describe('game hotkeys playback skip', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        document.body.innerHTML = `
            <div id="app"></div>
            <button id="next-phase"></button>
        `;
    });

    it('uses space to skip playback queue before next phase', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { handleGameHotkeys } = await import('../../src/ui/hotkeys');
        const playback = await import('../../src/ui/playbackOrchestrator');
        const skipMock = vi.mocked(playback.skipPlaybackQueue);
        const nextPhaseButton = document.getElementById('next-phase') as HTMLButtonElement;
        const clickSpy = vi.spyOn(nextPhaseButton, 'click');

        uiState.currentScreen = Screen.GAME;
        skipMock.mockReturnValueOnce(true);

        const event = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
        handleGameHotkeys(event);

        expect(skipMock).toHaveBeenCalledTimes(1);
        expect(event.defaultPrevented).toBe(true);
        expect(clickSpy).not.toHaveBeenCalled();
    });

    it('falls back to next phase when playback queue is idle', async () => {
        const { uiState, Screen } = await import('../../src/ui/appState');
        const { handleGameHotkeys } = await import('../../src/ui/hotkeys');
        const playback = await import('../../src/ui/playbackOrchestrator');
        const skipMock = vi.mocked(playback.skipPlaybackQueue);
        const nextPhaseButton = document.getElementById('next-phase') as HTMLButtonElement;
        const clickSpy = vi.spyOn(nextPhaseButton, 'click');

        uiState.currentScreen = Screen.GAME;
        skipMock.mockReturnValueOnce(false);
        nextPhaseButton.disabled = false;

        const event = new KeyboardEvent('keydown', { code: 'Space', cancelable: true });
        handleGameHotkeys(event);

        expect(skipMock).toHaveBeenCalledTimes(1);
        expect(clickSpy).toHaveBeenCalledTimes(1);
    });
});
