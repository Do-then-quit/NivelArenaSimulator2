import { createGameUxCheckpoint, type GameUxCheckpoint } from '../../../src/ui/harness/gameUxCheckpoints';
import { setupUiDom, setupUiHarness } from './ui_click_harness';

export type { GameUxCheckpoint } from '../../../src/ui/harness/gameUxCheckpoints';

export async function renderGameUxCheckpoint(checkpoint: GameUxCheckpoint) {
    const engine = createGameUxCheckpoint(checkpoint, { enableUiTrace: true });
    setupUiDom();
    const harness = await setupUiHarness(engine);
    return {
        engine,
        ...harness,
    };
}

export { createGameUxCheckpoint };
