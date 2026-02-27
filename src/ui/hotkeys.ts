import { Screen, uiState } from './appState';
import { skipPlaybackQueue } from './playbackOrchestrator';

function isTypingElement(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
}

export function handleVerificationHotkeys(event: KeyboardEvent) {
    if (uiState.currentScreen !== Screen.GAME || !uiState.verificationSession || !uiState.game) return;
    if (isTypingElement(event.target)) return;

    const normalizedKey = event.key.toLowerCase();
    if (normalizedKey === 'n') {
        event.preventDefault();
        uiState.goToNextVerificationTest?.();
        return;
    }
    if (normalizedKey === 'v') {
        event.preventDefault();
        uiState.returnToVerificationScreen?.();
    }
}

export function handleGameHotkeys(event: KeyboardEvent) {
    if (uiState.currentScreen !== Screen.GAME) return;
    if (isTypingElement(event.target)) return;
    if (event.code !== 'Space') return;

    if (skipPlaybackQueue()) {
        event.preventDefault();
        return;
    }

    const nextPhaseButton = document.getElementById('next-phase') as HTMLButtonElement | null;
    if (!nextPhaseButton || nextPhaseButton.disabled) return;

    event.preventDefault();
    nextPhaseButton.click();
}
