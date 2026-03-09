import { ActivationCondition, Attribute, CardType, Effect } from '../types';

const SELF_UNIT = { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' } as const;
const ENCOUNTER_UNIT = { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' } as const;
const OTHER_FRIENDLY_UNIT = {
    scope: 'MY_FIELD',
    type: 'UNIT',
    count: 1,
    filters: [{ type: 'EXCLUDE_SELF' }],
    selectMode: 'MANUAL',
} as const;

function awakenLeader(level: number, attribute: Attribute): Effect[] {
    return [
        {
            activation: ActivationCondition.AWAKEN,
            description: `각성 : 자신의 리더 레벨이 ${level} 이상이라면 이 카드를 뒤집는다.`,
            condition: { type: 'LEADER_LEVEL', value: level },
            action: { type: 'AWAKEN' as any, params: {} },
        },
        {
            activation: ActivationCondition.AWAKEN,
            description: '자신의 필드에 같은 속성이 아닌 카드가 있다면 상대는 카드를 1장 드로우할 수 있다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'PROMPT_OPPONENT_DRAW_IF_FIELD_HAS_NON_ATTRIBUTE',
                    attribute,
                },
            },
        },
    ];
}

function mixedPactLeader(attribute: Attribute): Effect {
    return {
        activation: ActivationCondition.PASSIVE,
        description: `[서약] 자신의 덱에 [${attribute}] 카드를 넣어야 한다. [${attribute}] 이외의 카드는 모두 같은 속성이어야 한다.`,
        action: { type: 'NONE', params: { pactAttribute: attribute, offAttributeMustMatch: true } },
    };
}

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

function escapeBottomDraw(description: string, count: number = 1): Effect {
    return {
        activation: ActivationCondition.ESCAPE,
        description,
        action: {
            type: 'COMPLEX_ACTION',
            params: {
                mode: 'MOVE_SELF_TO_DECK_BOTTOM_THEN_SUBACTIONS',
                subActions: [{ type: 'DRAW', params: { count } }],
            },
        },
    };
}

function triggerReturnSelfToHand(): Effect {
    return {
        activation: ActivationCondition.DAMAGE_TRIGGER,
        description: '트리거 / 이 카드를 자신의 패에 넣는다.',
        action: { type: 'RETURN_TO_HAND', params: {} },
    };
}

function triggerTrashSelf(): Effect {
    return {
        activation: ActivationCondition.DAMAGE_TRIGGER,
        description: '트리거 / 이 카드를 트래시한다.',
        action: { type: 'TRASH_SELF', params: {} },
    };
}

function triggerTrashSelfRecoverTotalCost2(): Effect[] {
    return [
        triggerTrashSelf(),
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '코스트 합이 2코스트 이하가 되도록 자신의 트래시 존에서 [트리거]를 가지지 않은 카드를 2장까지 골라 패에 넣는다.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 2,
                filters: [{ type: 'NOT_HAS_KEYWORD', value: '트리거' }],
                selectMode: 'MANUAL',
                totalCostLimit: 2,
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ];
}

function grantExitReturn(duration: 'TURN_END' | 'OPP_TURN_END' = 'TURN_END'): Effect {
    return {
        activation: ActivationCondition.EXIT,
        description: '엑시트 : 귀환',
        action: { type: 'RETURN_FROM_TRASH_AT_TURN_END' as const, params: {} },
        duration,
    };
}

function noEquipCondition(): Effect {
    return {
        activation: ActivationCondition.PASSIVE,
        description: '장착 조건: 없음.',
        action: { type: 'NONE', params: {} },
    };
}

export const BT05_EFFECTS: Record<string, Effect[]> = {
    // Fire
    'BT05-001': [
        ...awakenLeader(5, Attribute.FIRE),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '각성면 [액티브: 메인] 자신의 패를 1장 골라 트래시한다. 그러면 자신의 트래시 존에서 [트리거]를 가지지 않고 2코스트 이하인 스킬 카드를 1장 골라 패에 넣는다.',
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.SKILL },
                    { type: 'NOT_HAS_KEYWORD', value: '트리거' },
                    { type: 'COST_LIMIT', value: 2 },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
        mixedPactLeader(Attribute.FIRE),
    ],
    'BT05-002': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '[믹스][어태커] 자신의 필드에 [화염] 이외의 카드가 있다면 이 공격이 끝날 때까지 조우 유닛의 파워-2000.',
            condition: nonAttributeCondition(Attribute.FIRE),
            targets: ENCOUNTER_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            duration: 'BATTLE_END',
        },
    ],
    'BT05-003': [
        ...creditEffects(1),
        {
            activation: ActivationCondition.ENTRY,
            description: '[믹스][엔트리] 자신의 필드에 [화염] 이외의 카드가 있다면 이 턴이 끝날 때까지 조우 유닛의 파워-4000.',
            condition: nonAttributeCondition(Attribute.FIRE),
            targets: ENCOUNTER_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: -4000 } },
            duration: 'TURN_END',
        },
    ],
    'BT05-004': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 필드에 있는 모든 자신 유닛은 [어태커] 약탈[1]을 얻는다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: '어태커 : 약탈[1]',
                        action: { type: 'PLUNDER', params: { value: 1, duration: 'BATTLE_END' } },
                        duration: 'PERMANENT',
                    },
                },
            },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 필드에 있는 모든 자신 유닛은 [어태커] 이 공격이 끝날 때까지 파워+2000을 얻는다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: '어태커 : 이 공격이 끝날 때까지 파워+2000.',
                        action: { type: 'BUFF_POWER', params: { value: 2000 } },
                        duration: 'PERMANENT',
                    },
                },
            },
        },
        {
            activation: ActivationCondition.ESCAPE,
            description: '[이스케이프] 자신의 메인 페이즈가 시작할 때 이 유닛을 주인의 덱 맨 아래에 놓는다. 이 턴 동안 자신이 다음에 패에서 배치하는 유닛 1장은 이 턴이 끝날 때까지 [어태커] 관통[1]을 얻는다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'MOVE_SELF_TO_DECK_BOTTOM_THEN_SUBACTIONS',
                    subActions: [
                        {
                            type: 'QUEUE_NEXT_PLAY_UNIT_EFFECTS',
                            params: {
                                effects: [
                                    {
                                        activation: ActivationCondition.ATTACKER,
                                        description: '어태커 : 관통[1]',
                                        action: { type: 'PENETRATION', params: { value: 1, duration: 'BATTLE_END' } },
                                        duration: 'TURN_END',
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        },
    ],
    'BT05-005': [
        {
            activation: ActivationCondition.ESCAPE,
            description: '[이스케이프] 자신의 메인 페이즈가 시작할 때 필드에 있는 상대 유닛을 2장까지 고른다. 이 턴이 끝날 때까지 고른 유닛의 파워가 이 유닛의 파워만큼 감소한다. 이 유닛을 주인의 덱 맨 아래에 놓는다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_005_ESCAPE_DEBUFF_UP_TO_TWO_THEN_BOTTOM' } },
        },
        ...triggerTrashSelfRecoverTotalCost2(),
    ],
    'BT05-006': [
        ...creditEffects(1),
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 필드에 있는 다른 모든 자신 유닛은 [어태커] 이 공격이 끝날 때까지 파워+3000을 얻는다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'EXCLUDE_SELF' }],
                selectMode: 'ALL',
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: '어태커 : 이 공격이 끝날 때까지 파워+3000.',
                        action: { type: 'BUFF_POWER', params: { value: 3000 } },
                        duration: 'PERMANENT',
                    },
                },
            },
        },
    ],
    'BT05-007': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 이 턴이 끝날 때까지 상대는 [디펜더] 효과를 발동할 수 없다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'LOCK_ACTIVATION_UNTIL_TURN_END',
                    target: 'OPPONENT',
                    activation: ActivationCondition.DEFENDER,
                },
            },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 이 턴이 끝날 때까지 상대는 [엑시트] 효과를 발동할 수 없다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'LOCK_ACTIVATION_UNTIL_TURN_END',
                    target: 'OPPONENT',
                    activation: ActivationCondition.EXIT,
                },
            },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 이 공격이 끝날 때까지 파워+2000.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'BATTLE_END',
        },
    ],
    'BT05-008': [
        ...creditEffects(1),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '[믹스][액티브: 메인] 자신의 필드에 [화염] 이외의 카드가 있다면 필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-2000. 이 효과는 이 턴 동안 발동한 스킬의 수만큼 추가로 처리한다.',
            condition: nonAttributeCondition(Attribute.FIRE),
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_008_REPEAT_TARGET_DEBUFF_BY_SKILL_COUNT' } },
        },
    ],
    'BT05-009': [
        ...creditEffects(1),
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 이 공격이 끝날 때까지 조우 유닛의 파워-4000. 이 효과로 그 유닛을 트래시했다면 자신의 트래시 존에서 [트리거]를 가지지 않고 2코스트 이하인 스킬 카드를 1장 골라 패에 넣는다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_009_ATTACKER_DEBUFF_AND_RECOVER_IF_DESTROYED' } },
        },
    ],
    'BT05-010': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 자신의 트래시 존에서 〈몽환의 악마 시셀라〉 이외의 [트리거]를 가지지 않은 카드를 1장 골라 덱 맨 아래에 놓는다. 그러면 이 턴이 끝날 때까지 조우 유닛의 파워-1000. 이 효과는 조우 유닛이 있다면 추가로 발동할 수 있다.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'NOT_HAS_KEYWORD', value: '트리거' },
                    { type: 'EXCLUDE_CARD_ID', value: 'BT05-010' },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_010_ENTRY_BOTTOM_CARD_AND_REPEAT_ENCOUNTER_DEBUFF' } },
        },
    ],
    'BT05-011': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[믹스][엔트리] 자신의 필드에 [화염] 이외의 카드가 있고 2코스트 이상인 스킬이 2장 이상이라면 그중 1장을 골라 트래시한다. 이 효과로 트래시한 스킬의 효과를 발동할 수 있다.',
            condition: nonAttributeCondition(Attribute.FIRE),
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_011_ENTRY_TRASH_SKILL_AND_CAST' } },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 관통[X: 이 턴 동안 발동한 스킬의 수].',
            targets: SELF_UNIT as any,
            action: { type: 'PENETRATION', params: { dynamic: 'SKILL_ACTIVATION_COUNT_THIS_TURN', duration: 'BATTLE_END' } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: 'X가 3 이상이라면 추가로 이 공격이 끝날 때까지 듀얼리스트를 얻는다.',
            condition: { type: 'SKILL_ACTIVATION_COUNT_THIS_TURN_MIN', value: 3 },
            targets: SELF_UNIT as any,
            action: { type: 'APPLY_DUALIST_MARK', params: {} },
            duration: 'BATTLE_END',
        },
        ...triggerTrashSelfRecoverTotalCost2(),
    ],
    'BT05-012': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 상대 유닛을 1장 골라, 자신의 턴이 끝날 때까지 파워-3000.',
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -3000 } },
            duration: 'TURN_END',
        },
    ],
    'BT05-013': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 [트리거]를 가지지 않은 자신 유닛을 1장 고른다. 그러면 자신의 트래시 존에서 그 유닛보다 코스트가 낮고 [트리거]를 가지지 않은 카드를 1장 골라 패에 넣는다. 고른 유닛을 주인의 덱 맨 아래에 놓는다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'NOT_HAS_KEYWORD', value: '트리거' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_013_RECOVER_LOWER_COST_THEN_BOTTOM_TARGET' } },
        },
    ],
    'BT05-014': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 코스트가 자신의 리더 레벨 이하인 모든 자신 유닛은 이 턴이 끝날 때까지 [어태커] 듀얼리스트를 얻는다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'COST_LIMIT_BY_LEADER_LEVEL' }],
                selectMode: 'ALL',
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: '어태커 : 듀얼리스트',
                        action: { type: 'APPLY_DUALIST_MARK', params: {} },
                        duration: 'TURN_END',
                    },
                },
            },
        },
    ],
    'BT05-015': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 상대 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 「[패시브] 이 유닛이 트래시되면 자신의 트래시 존에 있는 이 카드를 대미지 존에 놓는다」를 얻는다.',
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_015_GRANT_TRASHED_MOVE_SKILL_TO_DAMAGE' } },
        },
    ],
    'BT05-016': [
        noEquipCondition(),
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 자신의 턴 동안 파워+1000.',
            condition: { type: 'YOUR_TURN' },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
        },
    ],
    'BT05-017': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '장착 조건: [어태커]를 가진 유닛.',
            condition: { type: 'HAS_KEYWORD', value: '어태커' },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '[믹스][어태커] 자신의 필드에 [화염] 이외의 카드가 있다면 관통[1]을 얻는다.',
            condition: nonAttributeCondition(Attribute.FIRE),
            targets: SELF_UNIT as any,
            action: { type: 'PENETRATION', params: { value: 1, duration: 'BATTLE_END' } },
            duration: 'BATTLE_END',
        },
    ],

    // Earth
    'BT05-018': [
        ...creditEffects(1),
        {
            activation: ActivationCondition.PASSIVE,
            description: '[레벨링크: 4] 자신의 리더 레벨이 4 이상이라면 필드에 있는 다른 모든 자신 유닛의 파워+2000.',
            condition: { type: 'LEVEL_LINK', value: 4 },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'EXCLUDE_SELF' }],
                selectMode: 'ALL',
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    'BT05-019': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '[액티브: 메인] 필드에 있는 자신 유닛을 1장 골라 그 유닛의 히트만큼 자신의 덱 맨 위에서 카드를 공개한다. 그중 1장을 골라 패에 넣고 나머지는 트래시한다. 고른 유닛을 주인의 덱 맨 아래에 놓는다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_019_REVEAL_BY_HIT_PICK_AND_BOTTOM_TARGET' } },
        },
    ],
    'BT05-020': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 자신의 리더 레벨+1.',
            action: { type: 'GAIN_LEVEL', params: { value: 1 } },
        },
    ],
    'BT05-021': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[믹스][엔트리] 자신의 필드에 [대지] 이외의 카드가 있고 자신의 리더 레벨이 10 이상이라면 이 턴이 끝날 때까지 자신의 사이즈+5.',
            condition: {
                type: 'ALL',
                value: [
                    nonAttributeCondition(Attribute.EARTH),
                    { type: 'LEADER_LEVEL', value: { min: 10 } },
                ],
            },
            targets: SELF_UNIT as any,
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: '패시브 : 이 턴이 끝날 때까지 자신의 사이즈+5.',
                        action: { type: 'MODIFY_PLAYER_SIZE', params: { value: 5 } },
                        duration: 'TURN_END',
                    },
                },
            },
        },
        {
            activation: ActivationCondition.ENTRY,
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            description: '[믹스][엔트리] 자신의 필드에 [대지] 이외의 카드가 있고 자신의 리더 레벨이 9 이하라면 자신의 패를 1장 골라 트래시할 수 있다. 그러면 자신의 리더 레벨+2.',
            condition: {
                type: 'ALL',
                value: [
                    nonAttributeCondition(Attribute.EARTH),
                    { type: 'LEADER_LEVEL', value: { max: 9 } },
                ],
            },
            action: { type: 'GAIN_LEVEL', params: { value: 2 } },
        },
    ],
    'BT05-022': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[레벨링크: 6] 자신의 리더 레벨이 6 이상이라면 파워+2000.',
            condition: { type: 'LEVEL_LINK', value: 6 },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '[레벨링크: 8] 자신의 리더 레벨이 8 이상이라면 파워+2000, 히트+1.',
            condition: { type: 'LEVEL_LINK', value: 8 },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '[레벨링크: 8] 자신의 리더 레벨이 8 이상이라면 히트+1.',
            condition: { type: 'LEVEL_LINK', value: 8 },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_HIT', params: { value: 1 } },
        },
    ],
    'BT05-023': [
        {
            activation: ActivationCondition.ESCAPE,
            description: '[이스케이프] 자신의 메인 페이즈가 시작할 때 자신의 패를 1장 골라 트래시할 수 있다. 그러면 이 유닛보다 파워가 낮은 상대 유닛을 1장 골라 트래시한다. 이 유닛을 주인의 덱 맨 아래에 놓는다.',
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'POWER_LOWER_THAN_SOURCE' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_023_ESCAPE_DESTROY_LOWER_POWER_THEN_BOTTOM' } },
        },
    ],
    'BT05-024': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '[믹스][어태커] 자신의 필드에 [대지] 이외의 카드가 있고 자신의 리더 레벨이 10 이상이라면 조우 유닛은 이 턴이 끝날 때까지 공격을 방어할 수 없다.',
            condition: {
                type: 'ALL',
                value: [
                    nonAttributeCondition(Attribute.EARTH),
                    { type: 'LEADER_LEVEL', value: { min: 10 } },
                ],
            },
            targets: ENCOUNTER_UNIT as any,
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: '패시브 : 이 유닛은 이 턴이 끝날 때까지 공격을 방어할 수 없다.',
                        action: { type: 'NONE', params: { cannotBlock: true } },
                        duration: 'TURN_END',
                    },
                },
            },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '[믹스][어태커] 자신의 필드에 [대지] 이외의 카드가 있고 자신의 리더 레벨이 9 이하라면 자신의 리더 레벨+2.',
            condition: {
                type: 'ALL',
                value: [
                    nonAttributeCondition(Attribute.EARTH),
                    { type: 'LEADER_LEVEL', value: { max: 9 } },
                ],
            },
            action: { type: 'GAIN_LEVEL', params: { value: 2 } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '[레벨링크: 8] 자신의 리더 레벨이 8 이상이라면 필드에 있는 다른 모든 자신 유닛의 파워+3000.',
            condition: { type: 'LEVEL_LINK', value: 8 },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'EXCLUDE_SELF' }],
                selectMode: 'ALL',
            },
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
        },
        triggerReturnSelfToHand(),
    ],
    'BT05-025': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[레벨링크: 7] 자신의 리더 레벨이 7 이상이라면 파워+5000.',
            condition: { type: 'LEVEL_LINK', value: 7 },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 5000 } },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '[레벨링크: 9][액티브: 메인] 자신의 리더 레벨이 9 이상이라면 자신의 패를 원하는 수만큼 골라 트래시할 수 있다. 그러면 이 턴이 끝날 때까지 트래시한 카드 1장마다 파워+1000. 조우 유닛보다 파워가 12000 이상 높다면 이 턴이 끝날 때까지 [어태커] 돌파를 얻는다.',
            condition: { type: 'LEVEL_LINK', value: 9 },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_025_ACTIVE_DISCARD_ANY_FOR_BUFF_AND_BREAKTHROUGH' } },
        },
    ],
    'BT05-026': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 3코스트 이하인 자신 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 「[어태커] 조우 유닛보다 파워가 높다면 이 공격이 끝날 때까지 돌파를 얻는다」를 얻는다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 3 }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: '어태커 : 조우 유닛보다 파워가 높다면 이 공격이 끝날 때까지 돌파를 얻는다.',
                        condition: { type: 'POWER_MARGIN_MIN', value: 1 },
                        action: { type: 'BREAKTHROUGH', params: { mode: 'ALL' } },
                        duration: 'TURN_END',
                    },
                },
            },
        },
    ],
    'BT05-027': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 자신 유닛을 1장 골라 주인의 덱 맨 아래에 놓는다. 그러면 자신의 패에서 그 유닛의 코스트+3 이하인 유닛 카드를 1장 골라 그 유닛이 있던 유닛 존에 사이즈를 무시하고 배치한다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_027_BOTTOM_FRIENDLY_AND_DEPLOY_FROM_HAND' } },
        },
    ],
    'BT05-028': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 자신 유닛을 1장 골라 주인의 덱 맨 아래에 놓는다. 자신의 덱 맨 위에서 카드를 3장 공개하고, 그중 유닛 카드를 1장 골라 비어 있는 자신의 유닛 존에 사이즈를 무시하고 배치한다. 그 유닛의 코스트가 자신의 리더 레벨 이하라면 이 스킬은 이 턴이 끝날 때까지 0코스트가 된다. 나머지는 모두 트래시한다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_028_BOTTOM_FRIENDLY_REVEAL3_DEPLOY_AND_ZERO_SELF' } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            optional: true,
            description: '트리거 / 이 카드를 트래시할 수 있다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'ST08_006_TRIGGER_TRASH_SELF',
                    setContextFlag: 'BT05_028_TRIGGER_TRASHED',
                },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '그렇지 않으면 자신의 리더 레벨+1.',
            condition: { type: 'CONTEXT_FLAG', value: { key: 'BT05_028_TRIGGER_TRASHED', equals: false } },
            action: { type: 'GAIN_LEVEL', params: { value: 1 } },
        },
    ],
    'BT05-029': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 자신 유닛 1장과 그 유닛의 파워 이하인 상대 유닛을 1장 고른다. 고른 자신 유닛을 주인의 덱 맨 아래에 놓는다. 그러면 고른 상대 유닛은 이 턴이 끝날 때까지 공격을 방어할 수 없다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_029_BOTTOM_FRIENDLY_AND_LOCK_OPP_BLOCK' } },
        },
    ],
    'BT05-030': [
        noEquipCondition(),
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 조우 유닛보다 파워가 3000 이상 높다면 이 공격이 끝날 때까지 관통[1]을 얻는다.',
            condition: { type: 'POWER_MARGIN_MIN', value: 3000 },
            targets: SELF_UNIT as any,
            action: { type: 'PENETRATION', params: { value: 1, duration: 'BATTLE_END' } },
            duration: 'BATTLE_END',
        },
    ],
    'BT05-031': [
        noEquipCondition(),
        {
            activation: ActivationCondition.PASSIVE,
            description: '파워+3000.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
        },
    ],

    // Storm
    'BT05-032': [
        ...awakenLeader(5, Attribute.STORM),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '각성면 [액티브: 메인] 아래 효과 중 하나를 고른다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_032_LEADER_CHOOSE_RETURN_OR_DESTROY' } },
        },
        mixedPactLeader(Attribute.STORM),
    ],
    'BT05-033': [
        {
            activation: ActivationCondition.EXIT,
            description: '[엑시트] 필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-2000.',
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.EXIT,
            description: '자신의 필드에 [폭풍] 이외의 카드가 있다면 추가로 파워-2000.',
            condition: nonAttributeCondition(Attribute.STORM),
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            duration: 'TURN_END',
        },
    ],
    'BT05-034': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 필드에 있는 다른 자신 유닛을 1장 고른다. 그 유닛은 상대의 턴이 끝날 때까지 [엑시트] 귀환을 얻는다.',
            targets: OTHER_FRIENDLY_UNIT as any,
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: grantExitReturn('OPP_TURN_END'),
                },
            },
        },
    ],
    'BT05-035': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '[액티브: 메인] 필드에 있는 자신 유닛을 1장 골라 트래시한다. 그러면 이 턴이 끝날 때까지 [어태커] 돌파를 얻는다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_035_TRASH_FRIENDLY_AND_GAIN_BREAKTHROUGH' } },
        },
    ],
    'BT05-036': [
        ...creditEffects(1),
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 자신의 트래시 존에서 [엑시트]를 가지고 [트리거]를 가지지 않은 유닛 카드를 1장 골라 그 카드가 가진 [엑시트] 효과를 하나 골라 발동할 수 있다. 그러면 그 카드를 덱 맨 아래에 놓는다.',
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
    'BT05-037': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[믹스] 자신의 필드에 [폭풍] 이외의 카드가 있다면 파워+2000.',
            condition: nonAttributeCondition(Attribute.STORM),
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
        {
            activation: ActivationCondition.EXIT,
            description: '[믹스][엑시트] 자신의 필드에 [폭풍] 이외의 카드가 있다면 자신의 트래시 존에서 [트리거]를 가지지 않고 2코스트 이하인 유닛 카드를 1장 골라 비어 있는 자신의 유닛 존에 사이즈를 무시하고 배치한다.',
            condition: nonAttributeCondition(Attribute.STORM),
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_STORM_EXIT_DEPLOY_LOW_COST_FROM_TRASH' } },
        },
    ],
    'BT05-038': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 필드에 있는 자신 유닛을 1장 골라 트래시한다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
        {
            activation: ActivationCondition.EXIT,
            description: '[믹스][엑시트] 자신의 필드에 [폭풍] 이외의 카드가 있다면 필드에 있는 조우 유닛을 가지지 않은 상대 유닛을 1장 골라 트래시한다.',
            condition: nonAttributeCondition(Attribute.STORM),
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'NO_ENCOUNTER' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
    ],
    'BT05-039': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 자신의 트래시 존에서 [엑시트]를 가지고 [트리거]를 가지지 않은 유닛 카드를 1장 골라 그 카드가 가진 [엑시트] 효과를 하나 골라 발동할 수 있다. 그러면 그 카드를 덱 맨 아래에 놓는다.',
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
        {
            activation: ActivationCondition.EXIT,
            description: '[믹스][엑시트] 자신의 필드에 [폭풍] 이외의 카드가 있다면 자신의 트래시 존에서 [트리거]를 가지지 않고 2코스트 이하인 유닛 카드를 1장 골라 비어 있는 자신의 유닛 존에 사이즈를 무시하고 배치한다.',
            condition: nonAttributeCondition(Attribute.STORM),
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_STORM_EXIT_DEPLOY_LOW_COST_FROM_TRASH' } },
        },
    ],
    'BT05-040': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 필드에 있는 다른 자신 유닛을 1장 골라 트래시한다.',
            condition: { type: 'MY_FIELD_UNIT_COUNT', value: { min: 2 } },
            targets: OTHER_FRIENDLY_UNIT as any,
            action: { type: 'DESTROY_UNIT', params: {} },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '그렇지 않으면 자신의 패를 1장 골라 트래시한다.',
            condition: { type: 'MY_FIELD_UNIT_COUNT', value: { max: 1 } },
            targets: { scope: 'MY_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'SELF', count: 1 } },
        },
        {
            activation: ActivationCondition.EXIT,
            description: '[믹스][엑시트] 자신의 필드에 [폭풍] 이외의 카드가 있다면 필드에 있는 상대 유닛 중 코스트가 가장 낮은 유닛을 1장 골라 트래시한다.',
            condition: nonAttributeCondition(Attribute.STORM),
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'LOWEST_COST_ONLY' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
    ],
    'BT05-041': [
        {
            activation: ActivationCondition.EXIT,
            description: '[믹스][엑시트] 자신의 필드에 [폭풍] 이외의 카드가 있다면 자신의 트래시 존에서 [트리거]를 가지지 않은 카드를 9장까지 골라 덱 맨 아래에 놓을 수 있다. 그러면 이 효과로 되돌린 카드 3장마다 상대에게 1대미지를 준다.',
            condition: nonAttributeCondition(Attribute.STORM),
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_041_EXIT_BOTTOM_UP_TO_NINE_AND_DAMAGE' } },
        },
        {
            activation: ActivationCondition.EXIT,
            description: '[믹스][엑시트] 자신의 필드에 [폭풍] 이외의 카드가 있다면 귀환을 얻는다.',
            condition: nonAttributeCondition(Attribute.STORM),
            action: { type: 'RETURN_FROM_TRASH_AT_TURN_END', params: {} },
        },
        triggerReturnSelfToHand(),
    ],
    'BT05-042': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 트래시 존에서 [엑시트]를 가지고 [트리거]를 가지지 않은 유닛 카드를 1장 골라 덱 맨 아래에 놓는다. 그러면 그 카드의 코스트 이하인 자신 유닛을 필드에서 1장 골라, 이 턴이 끝날 때까지 히트+1.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_042_BOTTOM_EXIT_UNIT_AND_BUFF_HIT' } },
        },
    ],
    'BT05-043': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 패에서 유닛 카드를 1장 골라 트래시한다. 그러면 그 카드보다 코스트가 낮은 유닛을 필드에서 1장 골라 트래시한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_043_TRASH_HAND_UNIT_THEN_DESTROY_LOWER_COST' } },
        },
    ],
    'BT05-044': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 트래시 존에서 [엑시트]를 가지고 [트리거]를 가지지 않은 유닛 카드를 1장 골라 그 카드가 가진 [엑시트] 효과를 하나 골라 발동할 수 있다. 그러면 그 카드를 덱 맨 아래에 놓는다. 이 스킬의 효과는 자신의 필드에 [폭풍] 이외의 카드가 있다면 1번만 더 처리할 수 있다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_044_BORROW_EXIT_EFFECT', repeatsIfMix: 1 } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 트래시한다.',
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '자신의 트래시 존에서 [엑시트]를 가지고 [트리거]를 가지지 않은 유닛 카드를 1장 골라 그 카드가 가진 [엑시트] 효과를 하나 골라 발동할 수 있다. 그러면 그 카드를 덱 맨 아래에 놓는다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_044_BORROW_EXIT_EFFECT', repeatsIfMix: 0 } },
        },
    ],
    'BT05-045': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 자신 유닛을 1장 골라 트래시한다. 그러면 카드를 2장 드로우한다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'DESTROY_UNIT', params: {} },
                        { type: 'DRAW', params: { count: 2 } },
                    ],
                },
            },
        },
    ],
    'BT05-046': [
        noEquipCondition(),
        {
            activation: ActivationCondition.TURN_END,
            description: '[패시브] 상대의 턴이 끝날 때 자신의 패를 1장 골라 트래시할 수 있다. 그렇지 않으면 이 유닛을 트래시한다.',
            condition: { type: 'OPPONENT_TURN' },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_046_OPP_TURN_END_DISCARD_OR_DESTROY' } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '파워+2000.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    'BT05-047': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '장착 조건: 3코스트 이상인 유닛.',
            condition: { type: 'COST_COMPARISON', value: { operator: 'GTE', cost: 3 } },
            action: { type: 'NONE', params: {} },
        },
        grantExitReturn(),
    ],

    // Water
    'BT05-048': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] [이스케이프]를 가진 모든 자신 유닛의 파워+1500.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'HAS_KEYWORD', value: '이스케이프' }],
                selectMode: 'ALL',
            },
            action: { type: 'BUFF_POWER', params: { value: 1500 } },
        },
        escapeBottomDraw('[이스케이프] 자신의 메인 페이즈가 시작할 때 이 유닛을 주인의 덱 맨 아래에 놓는다. 카드를 1장 드로우한다.', 1),
    ],
    'BT05-049': [
        {
            activation: ActivationCondition.DEFENDER,
            description: '[디펜더] 공격한 유닛의 히트-1만큼 자신의 패를 골라 트래시할 수 있다. 그러면 이번 공격을 종료한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_049_DEFENDER_DISCARD_AND_TERMINATE_ATTACK' } },
        },
    ],
    'BT05-050': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '[믹스][어태커] 자신의 필드에 [파도] 이외의 카드가 있다면 침투[1]을 얻는다.',
            condition: nonAttributeCondition(Attribute.WATER),
            targets: SELF_UNIT as any,
            action: { type: 'APPLY_INFILTRATION_MARK', params: { value: 1 } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 자신의 패가 6장 이상이라면 이 공격이 끝날 때까지 돌파를 얻는다.',
            condition: { type: 'MY_HAND_COUNT', value: { min: 6 } },
            action: { type: 'BREAKTHROUGH', params: { mode: 'ALL' } },
            duration: 'BATTLE_END',
        },
    ],
    'BT05-051': [
        ...creditEffects(1),
        {
            activation: ActivationCondition.ENTRY,
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            description: '[엔트리] 조우 유닛이 4코스트 이하라면 자신의 패를 1장 골라 트래시할 수 있다. 그러면 그 유닛을 패로 되돌리고 이 유닛의 히트가 이 턴이 끝날 때까지 1이 된다.',
            condition: { type: 'ENCOUNTER_COST_MAX', value: 4 },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_051_052_RETURN_ENCOUNTER_AND_SET_HIT', comparator: 'LTE', value: 4 } },
        },
    ],
    'BT05-052': [
        {
            activation: ActivationCondition.ENTRY,
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            description: '[엔트리] 조우 유닛이 4코스트 이상이라면 자신의 패를 1장 골라 트래시할 수 있다. 그러면 그 유닛을 패로 되돌리고 이 유닛의 히트가 이 턴이 끝날 때까지 1이 된다.',
            condition: { type: 'ENCOUNTER_COST_MIN', value: 4 },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_051_052_RETURN_ENCOUNTER_AND_SET_HIT', comparator: 'GTE', value: 4 } },
        },
        escapeBottomDraw('[이스케이프] 자신의 메인 페이즈가 시작할 때 이 유닛을 주인의 덱 맨 아래에 놓는다. 카드를 1장 드로우한다.', 1),
    ],
    'BT05-053': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '[액티브: 메인] 필드에 있는 자신 유닛을 1장 고르고 자신의 패를 1장 골라 트래시할 수 있다. 그러면 그 유닛은 이 턴이 끝날 때까지 [어태커] 돌파[코스트 초과]를 얻는다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_053_GRANT_COST_OVER_BREAKTHROUGH' } },
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
    'BT05-054': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[가디언] 방벽[2].',
            action: { type: 'NONE', params: { guardianBarrierCost: 2 } },
        },
        escapeBottomDraw('[이스케이프] 자신의 메인 페이즈가 시작할 때 이 유닛을 주인의 덱 맨 아래에 놓는다. 카드를 1장 드로우한다.', 1),
    ],
    'BT05-055': [
        {
            activation: ActivationCondition.ENTRY,
            optional: true,
            description: '[믹스][엔트리] 자신의 필드에 [파도] 이외의 카드가 있다면 필드에 있는 자신 유닛을 1장 골라 주인의 덱 맨 아래에 놓을 수 있다. 그 유닛이 [이스케이프]를 가지고 있다면 상대에게 1대미지를 준다.',
            condition: nonAttributeCondition(Attribute.WATER),
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_055_ENTRY_OPTIONAL_BOTTOM_AND_DAMAGE_IF_ESCAPE' } },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '[액티브: 메인] 필드에 있는 자신 유닛을 1장 고른다. 그 유닛은 다음 자신의 턴이 끝날 때까지 「[이스케이프] 자신의 메인 페이즈가 시작할 때 이 유닛을 주인의 덱 맨 아래에 놓는다. 카드를 1장 드로우하고 상대에게 1대미지를 준다」를 얻는다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    untilSourceOwnerNextTurnEnd: true,
                    effect: {
                        activation: ActivationCondition.ESCAPE,
                        description: '[이스케이프] 자신의 메인 페이즈가 시작할 때 이 유닛을 주인의 덱 맨 아래에 놓는다. 카드를 1장 드로우하고 상대에게 1대미지를 준다.',
                        action: {
                            type: 'COMPLEX_ACTION',
                            params: {
                                mode: 'MOVE_SELF_TO_DECK_BOTTOM_THEN_SUBACTIONS',
                                subActions: [
                                    { type: 'DRAW', params: { count: 1 } },
                                    { type: 'DAMAGE', params: { value: 1 } },
                                ],
                            },
                        },
                    },
                },
            },
        },
    ],
    'BT05-056': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            description: '[액티브: 메인] 자신의 패를 1장 골라 트래시할 수 있다. 그러면 자신의 스킬 존에 있는 스킬의 수만큼 상대에게 대미지를 준다. 이 유닛은 이 턴이 끝날 때까지 공격할 수 없다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_056_DISCARD_DAMAGE_BY_SKILL_ZONE_AND_LOCK_ATTACK' } },
        },
    ],
    'BT05-057': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 [이스케이프]를 가진 자신 유닛을 1장 고른다. 그 유닛이 가진 [이스케이프] 효과를 하나 골라 발동한다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_KEYWORD', value: '이스케이프' }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'PROMPT_SELECT_TARGET_EFFECT_TO_ACTIVATE',
                    activation: ActivationCondition.ESCAPE,
                    targetOwner: 'SELF',
                    targetArea: 'FIELD',
                },
            },
        },
        triggerReturnSelfToHand(),
    ],
    'BT05-058': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 조우 유닛을 가지고 [이스케이프]를 가진 자신 유닛을 1장 고른다. 상대는 그 유닛의 조우 유닛을 패로 되돌릴 수 있다. 그렇지 않으면 자신은 고른 유닛의 히트만큼 카드를 드로우한다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [
                    { type: 'HAS_KEYWORD', value: '이스케이프' },
                    { type: 'HAS_ENCOUNTER' },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_058_OPP_CHOOSE_RETURN_ENCOUNTER_OR_DRAW' } },
        },
    ],
    'BT05-059': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 코스트가 자신의 리더 레벨 이상인 상대 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 공격을 방어할 수 없다.',
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_MIN_BY_LEADER_LEVEL' }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: '패시브 : 이 유닛은 이 턴이 끝날 때까지 공격을 방어할 수 없다.',
                        action: { type: 'NONE', params: { cannotBlock: true } },
                        duration: 'TURN_END',
                    },
                },
            },
        },
    ],
    'BT05-060': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '카드를 2장 드로우한다.',
            action: { type: 'DRAW', params: { count: 2 } },
        },
    ],
    'BT05-061': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '장착 조건: 6코스트 이하인 유닛.',
            condition: { type: 'COST_COMPARISON', value: { operator: 'LTE', cost: 6 } },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 조우 유닛보다 코스트가 3 이상 낮다면 이 공격이 끝날 때까지 돌파를 얻는다.',
            condition: { type: 'ENCOUNTER_COST_MARGIN_MIN', value: 3 },
            action: { type: 'BREAKTHROUGH', params: { mode: 'ALL' } },
            duration: 'BATTLE_END',
        },
    ],
    'BT05-062': [
        noEquipCondition(),
        {
            activation: ActivationCondition.PASSIVE,
            description: '[가디언] 방벽[2].',
            action: { type: 'NONE', params: { guardianBarrierCost: 2 } },
        },
    ],

    // Lightning
    'BT05-063': [
        ...awakenLeader(5, Attribute.LIGHTNING),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '각성면 [액티브: 메인] 자신의 패를 1장 골라 트래시한다. 그러면 자신의 트래시 존에서 이 효과로 트래시한 카드와 카드명이 다른 아이템 카드를 1장 골라 필드에 있는 자신 유닛에 사이즈를 무시하고 장착할 수 있다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_063_LEADER_DISCARD_THEN_EQUIP_DIFFERENT_NAME_ITEM' } },
        },
        mixedPactLeader(Attribute.LIGHTNING),
    ],
    'BT05-064': [
        ...creditEffects(1),
    ],
    'BT05-065': [
        {
            activation: ActivationCondition.ENTRY,
            optional: true,
            description: '[믹스][엔트리] 자신의 필드에 [번개] 이외의 카드가 있다면 자신의 덱 맨 위에서 카드를 3장 트래시할 수 있다. 그러면 자신의 대미지 존에서 카드를 1장 골라 패에 넣는다.',
            condition: nonAttributeCondition(Attribute.LIGHTNING),
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_065_ENTRY_MILL3_AND_RECOVER_DAMAGE' } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 트래시한다.',
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '자신의 덱에서 1코스트 이하인 아이템 카드를 1장 골라 패에 넣는다. 덱을 섞는다.',
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 999,
                    filters: [
                        { type: 'UNIT_TYPE', value: CardType.ITEM },
                        { type: 'COST_LIMIT', value: 1 },
                    ],
                    remainingDestination: 'DECK',
                },
            },
        },
    ],
    'BT05-066': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 자신의 덱 맨 위에서 카드를 3장 트래시한다. 이 효과로 트래시한 아이템 카드가 1장 이상이라면 카드를 1장 드로우한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT03_069_TRASH_TOP3_DRAW_IF_ITEM' } },
        },
    ],
    'BT05-067': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[믹스][암드] 자신의 필드에 [번개] 이외의 카드가 있다면 이 유닛이 장착한 아이템 1종류마다 파워+2000.',
            condition: nonAttributeCondition(Attribute.LIGHTNING),
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 2000, dynamic: 'ITEM_DISTINCT_NAME_COUNT_MULTIPLIER' } },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '[믹스][암드][어태커] 자신의 필드에 [번개] 이외의 카드가 있고 이 유닛이 장착한 아이템이 4종류 이상이라면 카드를 1장 드로우한다.',
            condition: {
                type: 'ALL',
                value: [
                    nonAttributeCondition(Attribute.LIGHTNING),
                    { type: 'ITEM_DISTINCT_NAME_COUNT_MIN', value: 4 },
                ],
            },
            action: { type: 'DRAW', params: { count: 1 } },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '[믹스][암드][어태커] 자신의 필드에 [번개] 이외의 카드가 있고 이 유닛이 장착한 아이템이 4종류 이상이라면 상대에게 2대미지를 준다.',
            condition: {
                type: 'ALL',
                value: [
                    nonAttributeCondition(Attribute.LIGHTNING),
                    { type: 'ITEM_DISTINCT_NAME_COUNT_MIN', value: 4 },
                ],
            },
            action: { type: 'DAMAGE', params: { value: 2 } },
        },
        triggerReturnSelfToHand(),
    ],
    'BT05-068': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 필드에 있는 아이템을 장착한 모든 자신 유닛의 파워+2000.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'ITEM_COUNT_MIN', value: 1 }],
                selectMode: 'ALL',
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    'BT05-069': [
        {
            activation: ActivationCondition.EXIT,
            description: '[믹스][엑시트] 자신의 필드에 [번개] 이외의 카드가 있다면 자신의 대미지 존에서 카드를 1장 골라 패에 넣는다.',
            condition: nonAttributeCondition(Attribute.LIGHTNING),
            targets: { scope: 'MY_DAMAGE', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'MOVE_FROM_DAMAGE_TO_HAND', params: {} },
        },
        {
            activation: ActivationCondition.EXIT,
            description: '[믹스][엑시트] 자신의 필드에 [번개] 이외의 카드가 있다면 자신의 트래시 존에서 [트리거]를 가지지 않은 카드를 1장 골라 대미지 존에 놓는다.',
            condition: nonAttributeCondition(Attribute.LIGHTNING),
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [{ type: 'NOT_HAS_KEYWORD', value: '트리거' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_DAMAGE', params: {} },
        },
    ],
    'BT05-070': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 자신의 패를 2장까지 골라 트래시하고, 트래시한 수만큼 카드를 드로우한다. 이 효과로 트래시한 아이템 카드가 2장 이상이라면 추가로 카드를 1장 드로우한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_070_ENTRY_DISCARD_UP_TO_TWO_AND_DRAW' } },
        },
    ],
    'BT05-071': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[믹스][암드] 자신의 필드에 [번개] 이외의 카드가 있고 아이템을 장착하고 있다면 파워+3000.',
            condition: {
                type: 'ALL',
                value: [
                    nonAttributeCondition(Attribute.LIGHTNING),
                    { type: 'HAS_ITEM', value: { minCount: 1 } },
                ],
            },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '[믹스][암드] 자신의 필드에 [번개] 이외의 카드가 있고 아이템을 장착하고 있다면 히트+1.',
            condition: {
                type: 'ALL',
                value: [
                    nonAttributeCondition(Attribute.LIGHTNING),
                    { type: 'HAS_ITEM', value: { minCount: 1 } },
                ],
            },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_HIT', params: { value: 1 } },
        },
    ],
    'BT05-072': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 자신의 덱 맨 위에서 카드를 3장 공개한다. 그중 3장까지 골라 트래시하고 나머지는 모두 다시 덱에 넣고 섞는다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_072_REVEAL_THREE_AND_TRASH_ANY' } },
        },
    ],
    'BT05-073': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[믹스] 자신의 필드에 [번개] 이외의 카드가 있다면 아이템을 1장 이상 장착할 때마다 카드를 1장 드로우한다.',
            condition: nonAttributeCondition(Attribute.LIGHTNING),
            action: { type: 'NONE', params: { onItemEquippedDraw: 1 } },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 이 공격이 끝날 때까지 이 유닛이 장착한 아이템 1장마다 파워+2000.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 2000, dynamic: 'ITEM_COUNT_MULTIPLIER' } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 이 유닛이 장착한 아이템을 2장 골라 트래시할 수 있다. 그러면 다른 레인에 있는 상대 유닛을 1장 골라 트래시한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_073_TRASH_TWO_ITEMS_AND_DESTROY_OTHER_LANE' } },
        },
        triggerReturnSelfToHand(),
    ],
    'BT05-074': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 패에서 아이템 카드를 1장 이상 골라 트래시한다. 그러면 트래시한 수만큼 카드를 드로우한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'SB01_025_ACTIVE_DISCARD_ITEMS_AND_DRAW' } },
        },
    ],
    'BT05-075': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 아이템을 장착한 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 히트+1.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'ITEM_COUNT_MIN', value: 1 }],
                selectMode: 'MANUAL',
            },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END',
        },
    ],
    'BT05-076': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '카드를 2장 드로우한다. 그러면 자신의 패를 2장 골라 트래시한다. 자신의 트래시 존에서 [트리거]를 가지지 않고 카드명이 다른 아이템 카드를 2장까지 골라 자신의 패에 넣는다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_076_DRAW_DISCARD_AND_RECOVER_DISTINCT_ITEMS' } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 트래시한다.',
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '자신의 덱에서 1코스트 이하인 아이템 카드를 1장 골라 패에 넣는다. 덱을 섞는다.',
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 999,
                    filters: [
                        { type: 'UNIT_TYPE', value: CardType.ITEM },
                        { type: 'COST_LIMIT', value: 1 },
                    ],
                    remainingDestination: 'DECK',
                },
            },
        },
    ],
    'BT05-077': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 트래시 존에서 아이템 카드를 1장 골라 필드에 있는 자신 유닛에 사이즈를 무시하고 장착한다. 자신의 필드에 [번개] 이외의 카드가 있다면 이 카드를 트래시한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_077_EQUIP_ITEM_FROM_TRASH_AND_OPTIONAL_TRASH_SELF' } },
        },
    ],
    'BT05-078': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 아이템을 장착한 자신 유닛을 1장 골라 트래시한다. 그러면 카드를 2장 드로우하고 자신의 필드에 [번개] 이외의 카드가 있다면 상대에게 1대미지를 준다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'ITEM_COUNT_MIN', value: 1 }],
                selectMode: 'MANUAL',
            },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_078_TRASH_EQUIPPED_UNIT_DRAW_AND_DAMAGE_IF_MIX' } },
        },
    ],
    'BT05-079': [
        noEquipCondition(),
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 자신과 상대의 턴마다 1번씩, 이 유닛이 전투나 효과로 트래시될 때 자신의 덱 맨 위에서 카드를 3장 트래시할 수 있다. 이 효과로 트래시한 아이템 카드가 1장 이상이라면 이 유닛은 트래시되지 않는다.',
            action: { type: 'NONE', params: { destroyReplacement: 'BT05_079_MILL3_IF_ITEM' } },
        },
    ],
    'BT05-080': [
        noEquipCondition(),
        {
            activation: ActivationCondition.PASSIVE,
            description: '파워+1000.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            condition: { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
            description: '[액티브: 어택] 필드에 있는 자신 유닛이 장착한 〈아스트라페〉 이외의 아이템을 1장 골라 다른 자신 유닛에 장착한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT05_080_MOVE_EQUIPPED_ITEM_TO_OTHER_FRIENDLY' } },
        },
    ],
    'BT05-081': [
        noEquipCondition(),
        {
            activation: ActivationCondition.PASSIVE,
            description: '파워+2000.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 자신의 필드에 [번개] 이외의 카드가 있다면 추가로 파워+1000.',
            condition: nonAttributeCondition(Attribute.LIGHTNING),
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
        },
    ],
    'BT05-082': [
        noEquipCondition(),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '[액티브: 메인] 카드를 1장 드로우한다. 그러면 자신의 패를 1장 골라 트래시한다.',
            action: { type: 'DRAW_THEN_DISCARD', params: { drawCount: 1, discardCount: 1, discardFrom: 'HAND' } },
        },
    ],
    'BT05-083': [
        noEquipCondition(),
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 카드를 1장 드로우한다.',
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    'BT05-084': [
        noEquipCondition(),
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 이 유닛이 장착한 아이템 1장마다 파워+1000.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 1000, dynamic: 'ITEM_COUNT_MULTIPLIER' } },
        },
    ],
    'BT05-085': [
        noEquipCondition(),
        {
            activation: ActivationCondition.PASSIVE,
            description: '히트+1.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_HIT', params: { value: 1 } },
        },
    ],
    'BT05-086': [
        noEquipCondition(),
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 자신의 트래시 존에서 [트리거]를 가지지 않고 코스트가 이 유닛이 장착한 아이템의 수 이하인 스킬 카드나 아이템 카드를 1장 골라 패에 넣는다.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'CARD_TYPE_IN', value: [CardType.SKILL, CardType.ITEM] },
                    { type: 'NOT_HAS_KEYWORD', value: '트리거' },
                    { type: 'COST_LIMIT_BY_EQUIPPED_ITEM_COUNT' },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
};
