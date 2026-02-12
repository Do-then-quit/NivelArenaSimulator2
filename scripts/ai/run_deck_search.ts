interface DeckSearchPlaceholderReport {
    status: 'not_started';
    phase: number;
    message: string;
    nextSteps: string[];
}

export function runDeckSearchCli(): DeckSearchPlaceholderReport {
    const report: DeckSearchPlaceholderReport = {
        status: 'not_started',
        phase: 5,
        message: 'Deck search CLI is reserved for Phase 5. Implement DeckCodec/DeckLegality/DeckSearchGA first.',
        nextSteps: [
            'Implement src/logic/ai/deck/DeckCodec.ts',
            'Implement src/logic/ai/deck/DeckLegality.ts',
            'Implement src/logic/ai/deck/DeckSearchGA.ts',
            'Wire this CLI to run reproducible seeded search and emit artifacts/ai/deck-search/*.json',
        ],
    };

    console.log(JSON.stringify(report, null, 2));
    return report;
}

const maybeMain = process.argv[1] ?? '';
if (maybeMain.endsWith('run_deck_search.ts') || maybeMain.endsWith('run_deck_search.js')) {
    runDeckSearchCli();
}
