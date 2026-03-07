import { ActivationCondition, Effect } from '../types';

function creditEffects(amount: number): Effect[] {
    return [
        {
            activation: ActivationCondition.ENTRY,
            description: `[크레딧: ${amount}] 이 유닛이 배치되면 카드를 ${amount}장 드로우한다.`,
            action: { type: 'DRAW', params: { count: amount } },
        },
        {
            activation: ActivationCondition.EXIT,
            description: `[크레딧: ${amount}] 이 유닛이 트래시되면 자신의 패를 ${amount}장 골라 트래시한다.`,
            targets: {
                scope: 'MY_HAND',
                type: 'CARD',
                count: amount,
                selectMode: 'MANUAL',
            },
            action: { type: 'DISCARD', params: { target: 'SELF', count: amount } },
        },
    ];
}

export const ST08_EFFECTS: Record<string, Effect[]> = {
    'ST08-001': [
        {
            activation: ActivationCondition.AWAKEN,
            description: '각성 : 자신의 리더 레벨이 7 이상이라면 이 카드를 뒤집는다.',
            condition: { type: 'LEADER_LEVEL', value: 7 },
            action: { type: 'AWAKEN' as any, params: {} },
        },
        {
            activation: ActivationCondition.AWAKEN,
            description: '자신의 필드에 [대지] 이외의 카드가 있다면 상대는 카드를 1장 드로우할 수 있다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST08_001_AWAKEN_OPPONENT_DRAW_IF_NON_EARTH_PRESENT' },
            },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '각성면 [액티브: 메인] 자신의 패를 1장 골라 트래시한다. 그러면 자신의 덱 맨 위에서 카드를 1장 공개하고, 그중 유닛 카드를 1장 골라 비어 있는 자신의 유닛 존에 사이즈를 무시하고 배치할 수 있다. 나머지는 모두 트래시한다.',
            cost: { type: 'TRASH_HAND', amount: 1 },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST08_001_ACTIVE_REVEAL_TOP_DEPLOY' },
            },
        },
    ],
    'ST08-002': creditEffects(1),
    'ST08-003': [
        {
            activation: ActivationCondition.ESCAPE,
            description: '[이스케이프] 자신의 메인 페이즈가 시작할 때 이 유닛을 주인의 덱 맨 아래에 놓는다. 자신의 리더 레벨+1.',
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST08_003_ESCAPE_BOTTOM_LEVEL' },
            },
        },
    ],
    'ST08-005': creditEffects(1),
    'ST08-006': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[레벨링크: 6] 자신의 리더 레벨이 6 이상이라면 필드에 있는 다른 모든 자신 유닛의 파워+2000.',
            condition: { type: 'LEVEL_LINK', value: 6 },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'EXCLUDE_SELF' }],
                selectMode: 'ALL',
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
        {
            activation: ActivationCondition.ESCAPE,
            description: '[레벨링크: 8][이스케이프] 자신의 리더 레벨이 8 이상이라면 자신의 메인 페이즈가 시작할 때 이 유닛을 주인의 덱 맨 아래에 놓는다. 그러면 자신의 덱 맨 위에서 카드를 3장 공개하고, 그중 유닛 카드를 1장 골라 비어 있는 자신의 유닛 존에 사이즈를 무시하고 배치한다. 그 유닛은 이 턴이 끝날 때까지 0코스트가 되고 파워+5000, 히트+1. 나머지는 모두 트래시한다.',
            condition: { type: 'LEVEL_LINK', value: 8 },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST08_006_ESCAPE_REVEAL3_DEPLOY_BUFF' },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            optional: true,
            description: '트리거 / 이 카드를 트래시할 수 있다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'ST08_006_TRIGGER_TRASH_SELF',
                    setContextFlag: 'ST08_006_TRIGGER_TRASHED',
                },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '그렇지 않으면 자신의 리더 레벨+1.',
            condition: { type: 'CONTEXT_FLAG', value: { key: 'ST08_006_TRIGGER_TRASHED', equals: false } },
            action: { type: 'GAIN_LEVEL', params: { value: 1 } },
        },
    ],
    'ST08-007': [
        {
            activation: ActivationCondition.ESCAPE,
            description: '[이스케이프] 자신의 메인 페이즈가 시작할 때 이 유닛을 주인의 덱 맨 아래에 놓는다. 상대의 턴이 끝날 때까지 상대가 패에서 파워가 4000 이하인 유닛을 배치할 때마다 자신은 카드를 1장 드로우하고 상대에게 1대미지를 준다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST08_007_ESCAPE_BOTTOM_SET_REACTIVE' },
            },
        },
    ],
    'ST08-008': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 리더 레벨+1.',
            action: { type: 'GAIN_LEVEL', params: { value: 1 } },
        },
    ],
    'ST08-009': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 덱 맨 위에서 카드를 1장 공개하고, 그중 유닛 카드를 1장 골라 비어 있는 자신의 유닛 존에 사이즈를 무시하고 배치한다. 나머지는 모두 트래시한다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST08_009_REVEAL_TOP_DEPLOY_UNIT' },
            },
        },
    ],
    'ST08-010': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '장착 조건: 없음.',
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '파워+1000.',
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
        },
    ],
    'ST08-011': [
        ...creditEffects(1),
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 이 공격이 끝날 때까지 파워+2000.',
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'BATTLE_END',
        },
    ],
    'ST08-012': [
        ...creditEffects(1),
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 이 공격이 끝날 때까지 파워+3000.',
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'BATTLE_END',
        },
    ],
    'ST08-004': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '[액티브: 메인] 자신의 패에서 코스트가 자신의 리더 레벨 이하인 유닛 카드를 1장 골라 비어 있는 자신의 유닛 존에 사이즈를 무시하고 배치할 수 있다. 그 유닛은 이 턴이 끝날 때까지 공격할 수 없다.',
            targets: {
                scope: 'MY_HAND',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: 'UNIT' as any },
                    { type: 'COST_LIMIT_BY_LEADER_LEVEL' },
                ],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST08_004_ACTIVE_DEPLOY_FROM_HAND' },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 자신의 패에 넣는다.',
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    'ST08-013': [
        ...creditEffects(2),
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 이 공격이 끝날 때까지 파워+4000.',
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 4000 } },
            duration: 'BATTLE_END',
        },
    ],
    'ST08-015': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 자신 유닛을 1장 골라, 자신의 턴이 끝날 때까지 파워+2000. 그 유닛이 [어태커]를 가지고 있다면 자신의 트래시 존에서 [트리거]를 가지지 않고 2코스트인 스킬 카드를 1장 골라 패에 넣는다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST08_015_BUFF_AND_RECOVER_IF_ATTACKER' },
            },
            duration: 'TURN_END',
        },
    ],
    'ST08-014': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 자신의 패 1장마다 파워-1000.',
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: -1000, dynamic: 'MY_HAND_COUNT_MULTIPLIER' } },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: '[액티브: 어택] 이 유닛의 파워가 11000 이상이라면 이 턴의 어택 페이즈 중 1번 더 공격할 수 있다.',
            condition: {
                type: 'ALL',
                value: [
                    { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
                    { type: 'SELF_POWER_MIN', value: 11000 },
                ],
            },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'GRANT_EXTRA_ATTACK_THIS_TURN', params: { value: 1 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 자신의 패에 넣는다.',
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    'ST08-016': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 스킬 존에 있는 스킬을 모두 트래시한다. 이 효과로 트래시한 스킬이 3장 이상이라면 상대에게 1대미지를 준다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST08_016_TRASH_SKILLS_DAMAGE_IF_THREE' },
            },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신은 이 턴이 끝날 때까지 〈타락의 유열 속으로〉를 발동할 수 없다.',
            action: { type: 'LOCK_SKILL_ID_UNTIL_TURN_END', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 자신의 패에 넣는다.',
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    'ST08-017': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '장착 조건: 없음.',
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 자신과 상대의 패 장수가 다르다면 이 공격이 끝날 때까지 그 차이 1장마다 조우 유닛의 파워-1000.',
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: -1000, dynamic: 'HAND_COUNT_DIFF_MULTIPLIER' } },
            duration: 'BATTLE_END',
        },
    ],
};
