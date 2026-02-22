import { HoverPreview } from '../HoverPreview';
import { TrashHoverOverlay } from '../TrashHoverOverlay';
import { GameEngine } from '../logic/GameEngine';
import { CardTester } from '../logic/CardTester';
import { Card } from '../logic/types';
import {
    BotLike,
    BotModelId,
    getAvailableBotModels,
} from '../logic/ai/BotRegistry';
import {
    BotReplayActionLog,
    BotReplayDeckLoadout,
    BotReplaySimulationResult,
} from '../logic/ai/BotVsBotReplay';
import { createGameLogFeed, GameLogCategory } from './gameLogFeed';

export enum Screen {
    MENU,
    DECK_BUILDER,
    SETUP,
    BOT_REPLAY_SETUP,
    GAME,
    TEST,
}

export const PHASE_THEME_CLASSES = [
    'phase-theme-level-up',
    'phase-theme-draw',
    'phase-theme-main',
    'phase-theme-attack',
    'phase-theme-block',
    'phase-theme-end',
] as const;

export interface VerificationSessionState {
    orderedTestIds: string[];
    currentIndex: number;
    currentTestId: string;
    currentInstructions: string;
}

export type PlayerControlMode = 'HUMAN' | 'BOT';
export type ReplayDeckMode = 'CUSTOM' | 'RANDOM';

export interface MatchControlConfig {
    label: string;
    player1Control: PlayerControlMode;
    player2Control: PlayerControlMode;
    player1BotId?: BotModelId;
    player2BotId?: BotModelId;
}

export interface MatchViewConfig {
    revealBotHand: boolean;
}

export interface BotReplaySetupState {
    player1BotId: BotModelId;
    player2BotId: BotModelId;
    deckMode: ReplayDeckMode;
    player1DeckId: string | null;
    player2DeckId: string | null;
    randomSeed: number;
    randomMirrorDeck: boolean;
    maxSteps: number;
    running: boolean;
    progressSteps: number;
    statusText: string;
}

export interface BotReplaySession {
    loadout: BotReplayDeckLoadout;
    result: BotReplaySimulationResult;
    actions: BotReplayActionLog[];
    currentActionIndex: number;
    player1BotId: BotModelId;
    player2BotId: BotModelId;
    playerBotModelById: Record<string, BotModelId>;
    playerBotLabelById: Record<string, string>;
}

export interface GameLogViewState {
    expanded: boolean;
    filter: 'ALL' | GameLogCategory;
    maxVisibleEntries: number;
}

export const HUMAN_VS_HUMAN_CONFIG: MatchControlConfig = {
    label: 'HUMAN vs HUMAN',
    player1Control: 'HUMAN',
    player2Control: 'HUMAN',
};

export const HUMAN_VS_BASELINE_CONFIG: MatchControlConfig = {
    label: 'HUMAN vs BASELINE BOT',
    player1Control: 'HUMAN',
    player2Control: 'BOT',
    player2BotId: 'baseline',
};

export interface UITestResult {
    testId: string;
    success: boolean;
    logs: string[];
    error?: string;
}

export const uiState = {
    currentScreen: Screen.MENU,
    game: null as GameEngine | null,
    hoverPreview: new HoverPreview(),
    trashHoverOverlay: null as TrashHoverOverlay | null,
    app: document.querySelector<HTMLDivElement>('#app')!,
    cardTester: new CardTester(),
    testResults: [] as UITestResult[],
    testRunning: false,
    verificationSession: null as VerificationSessionState | null,
    pendingSetupConfig: HUMAN_VS_HUMAN_CONFIG as MatchControlConfig,
    activeMatchConfig: HUMAN_VS_HUMAN_CONFIG as MatchControlConfig,
    pendingMatchViewConfig: { revealBotHand: true } as MatchViewConfig,
    activeMatchViewConfig: { revealBotHand: true } as MatchViewConfig,
    botByPlayerId: new Map<string, BotLike>(),
    botLabelByPlayerId: new Map<string, string>(),
    botStepTimer: null as number | null,
    autoPhaseAdvanceTimer: null as number | null,
    availableBotModels: getAvailableBotModels(),
    botReplaySetupState: {
        player1BotId: 'baseline',
        player2BotId: 'strong-v1',
        deckMode: 'RANDOM',
        player1DeckId: null,
        player2DeckId: null,
        randomSeed: Date.now(),
        randomMirrorDeck: false,
        maxSteps: 2400,
        running: false,
        progressSteps: 0,
        statusText: '',
    } as BotReplaySetupState,
    replaySession: null as BotReplaySession | null,
    gameLogFeed: createGameLogFeed(500),
    gameLogView: {
        expanded: true,
        filter: 'ALL',
        maxVisibleEntries: 120,
    } as GameLogViewState,
    selectedPacks: new Set<string>(),
    draggedCardIndex: null as number | null,

    // callbacks wired by main orchestrator
    render: null as (() => void) | null,
    startGame: null as ((
        deck1: Card[],
        deck2: Card[],
        leader1: Card,
        leader2: Card,
        controlConfig?: MatchControlConfig,
        viewConfig?: MatchViewConfig,
    ) => void) | null,
    startVerificationScenario: null as ((testId: string, orderedTestIds: string[]) => void) | null,
    goToNextVerificationTest: null as (() => void) | null,
    returnToVerificationScreen: null as (() => void) | null,
};

uiState.trashHoverOverlay = new TrashHoverOverlay(uiState.hoverPreview);
