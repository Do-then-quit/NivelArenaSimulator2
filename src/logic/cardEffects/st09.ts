import { ActivationCondition, Attribute, CardType, Effect } from '../types';

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

function nonAttributeCondition(attribute: Attribute) {
    return { type: 'FIELD_HAS_NON_ATTRIBUTE_CARD' as const, value: attribute };
}

function escapeBottomWithSubActions(description: string, subActions: Array<{ type: string; params?: Record<string, any>; description?: string }>): Effect {
    return {
        activation: ActivationCondition.ESCAPE,
        description,
        action: {
            type: 'COMPLEX_ACTION',
            params: {
                mode: 'MOVE_SELF_TO_DECK_BOTTOM_THEN_SUBACTIONS',
                subActions,
            },
        },
    };
}

export const ST09_EFFECTS: Record<string, Effect[]> = {
    'ST09-001': [
        {
            activation: ActivationCondition.AWAKEN,
            description: '각성 : 자신의 리더 레벨이 5 이상이라면 이 카드를 뒤집는다.',
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} },
        },
        {
            activation: ActivationCondition.AWAKEN,
            description: '자신의 필드에 [파도] 이외의 카드가 있다면 상대는 카드를 1장 드로우할 수 있다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'PROMPT_OPPONENT_DRAW_IF_FIELD_HAS_NON_ATTRIBUTE',
                    attribute: Attribute.WATER,
                },
            },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '각성면 [액티브: 메인] 필드에 있는 자신 유닛을 1장 고른다. 그 유닛은 다음 자신의 턴이 끝날 때까지 「[이스케이프] 자신의 메인 페이즈가 시작할 때 이 유닛을 주인의 덱 맨 아래에 놓는다. 상대에게 1대미지를 준다」를 얻는다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    untilSourceOwnerNextTurnEnd: true,
                    effect: {
                        activation: ActivationCondition.ESCAPE,
                        description: '[이스케이프] 자신의 메인 페이즈가 시작할 때 이 유닛을 주인의 덱 맨 아래에 놓는다. 상대에게 1대미지를 준다.',
                        action: {
                            type: 'COMPLEX_ACTION',
                            params: {
                                mode: 'MOVE_SELF_TO_DECK_BOTTOM_THEN_SUBACTIONS',
                                subActions: [{ type: 'DAMAGE', params: { value: 1 } }],
                            },
                        },
                    },
                },
            },
        },
    ],
    'ST09-002': [
        ...creditEffects(1),
        escapeBottomWithSubActions(
            '[이스케이프] 자신의 메인 페이즈가 시작할 때 이 유닛을 주인의 덱 맨 아래에 놓는다. 카드를 1장 드로우한다.',
            [{ type: 'DRAW', params: { count: 1 } }],
        ),
    ],
    'ST09-003': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[믹스] 자신의 필드에 [파도] 이외의 카드가 있다면 필드에 있는 모든 자신 유닛은 [어태커] 침투[1]을 얻는다.',
            condition: nonAttributeCondition(Attribute.WATER),
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: '어태커 : 침투[1]',
                        action: { type: 'APPLY_INFILTRATION_MARK', params: { value: 1 } },
                        duration: 'BATTLE_END',
                    },
                },
            },
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: '[디펜더] 이 방어가 끝날 때까지 파워+3000.',
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'BATTLE_END',
        },
    ],
    'ST09-004': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '[믹스][어태커] 자신의 필드에 [파도] 이외의 카드가 있다면 침투[2]를 얻는다.',
            condition: nonAttributeCondition(Attribute.WATER),
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'APPLY_INFILTRATION_MARK', params: { value: 2 } },
            duration: 'BATTLE_END',
        },
    ],
    'ST09-005': [
        {
            activation: ActivationCondition.TURN_END,
            description: '[패시브] 자신의 턴이 끝날 때 자신의 패가 8장 이상이라면 7장이 되도록 카드를 골라 트래시한다. 그러면 트래시한 카드의 수만큼 상대에게 대미지를 준다.',
            condition: { type: 'MY_HAND_COUNT', value: { min: 8 } },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'ST09_005_END_TURN_DISCARD_TO_7_AND_DAMAGE' } },
        },
        escapeBottomWithSubActions(
            '[이스케이프] 자신의 메인 페이즈가 시작할 때 이 유닛을 주인의 덱 맨 아래에 놓는다. 카드를 1장 드로우한다.',
            [{ type: 'DRAW', params: { count: 1 } }],
        ),
    ],
    'ST09-006': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 자신과 상대의 턴마다 1번씩, 필드에 있는 다른 자신 유닛이 자신의 덱 맨 아래에 놓이면 그 유닛의 히트만큼 상대에게 대미지를 줄 수 있다.',
            action: {
                type: 'NONE',
                params: { onFriendlyFieldUnitBottomToDeckDamageByHitOncePerTurn: true },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 자신의 패에 넣는다.',
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    'ST09-007': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '이 턴이 끝날 때까지 자신의 효과로 상대에게 대미지를 줄 때마다 카드를 1장 드로우한다. 자신은 이 턴이 끝날 때까지 〈몽환 나비〉를 발동할 수 없다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'ST09_007_ENABLE_DRAW_ON_EFFECT_DAMAGE' } },
        },
    ],
    'ST09-008': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 덱 맨 위에서 카드를 5장 트래시한다. 이 효과로 트래시한 카드 중 스킬 카드를 1장 골라 효과를 발동할 수 있다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_TRASH_TOP_AND_PROMPT_TRASHED_SKILL_CAST',
                    count: 5,
                    allowSkip: true,
                },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 트래시한다.',
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '자신의 덱 맨 위에서 카드를 1장 공개하고, 그중 스킬 카드를 1장 골라 트래시할 수 있다. 그러면 그 카드의 효과를 발동한다. 나머지는 모두 패에 넣는다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'ST09_008_TRIGGER_REVEAL1_OPTIONAL_CAST_SKILL' } },
        },
    ],
    'ST09-009': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 침투[1]',
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'APPLY_INFILTRATION_MARK', params: { value: 1 } },
            duration: 'BATTLE_END',
        },
    ],
    'ST09-010': [
        {
            activation: ActivationCondition.EXIT,
            description: '[엑시트] 필드에 있는 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 히트+1.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END',
        },
    ],
    'ST09-011': [
        {
            activation: ActivationCondition.EXIT,
            description: '[엑시트] 카드를 1장 드로우한다.',
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    'ST09-012': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 필드에 있는 다른 자신 유닛 1장과 그 유닛의 코스트 이하인 상대 유닛을 1장 고를 수 있다. 그러면 고른 유닛을 모두 트래시한다.',
            optional: true,
            action: { type: 'COMPLEX_ACTION', params: { mode: 'ST09_012_ENTRY_DESTROY_PAIR' } },
        },
        {
            activation: ActivationCondition.EXIT,
            optional: true,
            description: '[엑시트] 필드에 있는 2코스트 이하인 유닛을 1장 골라 트래시할 수 있다.',
            targets: {
                scope: 'BOTH_FIELDS',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 2 }],
                selectMode: 'MANUAL',
            },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 트래시한다.',
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '자신의 트래시 존에서 [엑시트]를 가지고 [트리거]를 가지지 않은 유닛 카드를 1장 골라 그 카드가 가진 [엑시트] 효과를 하나 골라 발동할 수 있다. 그러면 그 카드를 덱 맨 아래에 놓는다.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'HAS_KEYWORD', value: '엑시트' },
                    { type: 'NOT_HAS_KEYWORD', value: '트리거' },
                ],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'PROMPT_SELECT_TARGET_EFFECT_TO_ACTIVATE',
                    activation: ActivationCondition.EXIT,
                    targetOwner: 'SELF',
                    targetArea: 'TRASH',
                    preMoveToDeckBottom: true,
                },
            },
        },
    ],
    'ST09-013': [
        {
            activation: ActivationCondition.UNIT_TRASHED,
            description: '[패시브] 자신과 상대의 턴마다 1번씩, 필드에 있는 유닛이 자신의 효과로 트래시되면 자신의 패를 1장 골라 트래시할 수 있다. 그러면 그 효과로 트래시된 유닛의 수만큼 상대에게 대미지를 준다.',
            condition: {
                type: 'ALL',
                value: [
                    { type: 'CONTEXT_FLAG', value: 'TRASHED_IS_OTHER_BY_EFFECT' },
                    { type: 'ONCE_PER_TURN' },
                ],
            },
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            action: { type: 'DAMAGE', params: { value: 1 } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 자신의 패에 넣는다.',
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    'ST09-014': [
        ...creditEffects(1),
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 조우 유닛의 히트만큼 자신의 패를 골라 트래시할 수 있다. 그러면 조우 유닛을 트래시한다.',
            optional: true,
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'DESTROY_UNIT_WITH_HIT_COST', params: {} },
        },
    ],
    'ST09-015': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 자신 유닛 1장과 그 유닛보다 코스트가 낮은 상대 유닛을 1장 고른다. 그러면 고른 유닛을 모두 트래시한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'ST09_015_DESTROY_PAIR_LOWER_COST' } },
        },
    ],
    'ST09-016': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 자신 유닛을 1장 골라 트래시한다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: '그러면 상대에게 1대미지를 준다.',
            action: { type: 'DAMAGE', params: { value: 1 } },
        },
        {
            activation: ActivationCondition.ACTIVE,
            optional: true,
            description: '자신의 필드에 [폭풍] 이외의 카드가 있다면 카드를 1장 드로우할 수 있다.',
            condition: nonAttributeCondition(Attribute.STORM),
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    'ST09-017': [
        {
            activation: ActivationCondition.EXIT,
            description: '[엑시트] 카드를 2장 드로우한다.',
            action: { type: 'DRAW', params: { count: 2 } },
        },
    ],
};
