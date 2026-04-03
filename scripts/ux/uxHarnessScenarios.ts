export type UxHarnessSource = 'quick-play' | 'checkpoint';

export interface UxHarnessScenarioDefinition {
    id: string;
    label: string;
    source: UxHarnessSource;
    checkpoint?: string;
    expectedPhase: string;
    expectedActionGroup: 'PHASE' | 'INTERACTION' | 'PLAY' | 'ATTACK' | 'ACTIVE' | 'SYSTEM';
    expectMandatoryQueue: boolean;
    expectAttackStep: boolean;
    expectSelectionProgress: boolean;
    expectConfirmTargets: boolean;
    expectDisabledSummary: boolean;
    expectNextPhase: boolean;
}

export const UX_HARNESS_SCORE_WEIGHTS = {
    rulesAccuracy: 40,
    phaseStepVisibility: 20,
    actionClarity: 20,
    timingCausality: 15,
    visualStability: 5,
} as const;

export const UX_HARNESS_THRESHOLDS = {
    total: 92,
    rulesAccuracy: 38,
    actionClarity: 18,
    timingCausality: 13,
    mandatoryHiddenCount: 0,
} as const;

export const UX_HARNESS_SCENARIOS: UxHarnessScenarioDefinition[] = [
    {
        id: 'quick-play-main',
        label: 'Quick Play -> Keep Hand -> Keep Hand -> P1 MAIN',
        source: 'quick-play',
        expectedPhase: '메인',
        expectedActionGroup: 'PLAY',
        expectMandatoryQueue: false,
        expectAttackStep: false,
        expectSelectionProgress: false,
        expectConfirmTargets: false,
        expectDisabledSummary: true,
        expectNextPhase: true,
    },
    {
        id: 'checkpoint-p1-main-after-mulligan',
        label: 'Checkpoint: P1_MAIN_AFTER_MULLIGAN',
        source: 'checkpoint',
        checkpoint: 'P1_MAIN_AFTER_MULLIGAN',
        expectedPhase: '메인',
        expectedActionGroup: 'PLAY',
        expectMandatoryQueue: false,
        expectAttackStep: false,
        expectSelectionProgress: false,
        expectConfirmTargets: false,
        expectDisabledSummary: true,
        expectNextPhase: true,
    },
    {
        id: 'checkpoint-attack-declare-window',
        label: 'Checkpoint: ATTACK_DECLARE_WINDOW',
        source: 'checkpoint',
        checkpoint: 'ATTACK_DECLARE_WINDOW',
        expectedPhase: '어택',
        expectedActionGroup: 'ATTACK',
        expectMandatoryQueue: false,
        expectAttackStep: true,
        expectSelectionProgress: false,
        expectConfirmTargets: false,
        expectDisabledSummary: true,
        expectNextPhase: true,
    },
    {
        id: 'checkpoint-block-decision-window',
        label: 'Checkpoint: BLOCK_DECISION_WINDOW',
        source: 'checkpoint',
        checkpoint: 'BLOCK_DECISION_WINDOW',
        expectedPhase: '어택',
        expectedActionGroup: 'INTERACTION',
        expectMandatoryQueue: false,
        expectAttackStep: true,
        expectSelectionProgress: false,
        expectConfirmTargets: false,
        expectDisabledSummary: false,
        expectNextPhase: false,
    },
    {
        id: 'checkpoint-mandatory-target-selection',
        label: 'Checkpoint: MANDATORY_TARGET_SELECTION',
        source: 'checkpoint',
        checkpoint: 'MANDATORY_TARGET_SELECTION',
        expectedPhase: '메인',
        expectedActionGroup: 'INTERACTION',
        expectMandatoryQueue: true,
        expectAttackStep: false,
        expectSelectionProgress: false,
        expectConfirmTargets: true,
        expectDisabledSummary: false,
        expectNextPhase: false,
    },
    {
        id: 'checkpoint-end-phase-hand-adjust',
        label: 'Checkpoint: END_PHASE_HAND_ADJUST',
        source: 'checkpoint',
        checkpoint: 'END_PHASE_HAND_ADJUST',
        expectedPhase: '엔드',
        expectedActionGroup: 'INTERACTION',
        expectMandatoryQueue: true,
        expectAttackStep: false,
        expectSelectionProgress: false,
        expectConfirmTargets: true,
        expectDisabledSummary: false,
        expectNextPhase: false,
    },
];
