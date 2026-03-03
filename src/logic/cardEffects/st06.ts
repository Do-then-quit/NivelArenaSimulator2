import { ActivationCondition, CardType, Effect } from '../types';

export const ST06_EFFECTS: Record<string, Effect[]> = {
    "ST06-001": [
        {
            activation: ActivationCondition.AWAKEN,
            description: '각성 : 자신의 리더 레벨이 5 이상이라면 이 카드를 뒤집는다.',
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '각성면 액티브 메인 : 필드에 있는 0코스트인 자신 유닛을 1장 골라 이 턴이 끝날 때까지 파워+2000, 히트+1.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 0 }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'BUFF_POWER', params: { value: 2000, duration: 'TURN_END' } },
                        { type: 'BUFF_HIT', params: { value: 1, duration: 'TURN_END' } },
                    ],
                },
            },
        },
    ],
    "ST06-002": [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 필드에 있는 다른 자신 유닛을 1장 골라 이 턴이 끝날 때까지 파워+3000.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'EXCLUDE_SELF' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'TURN_END',
        },
    ],
    "ST06-003": [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 덱 맨 위에서 카드를 5장 공개하고 그중 성약 카드를 1장 패에 넣는다. 나머지는 모두 트래시한다.',
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 5,
                    remainingDestination: 'TRASH',
                    filters: [{ type: 'HAS_TRAIT', value: '성약' }],
                },
            },
        },
    ],
    "ST06-004": [
        {
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 필드에 있는 계승자 또는 과거 혹은 미래를 가진 다른 자신 유닛 1장마다 파워+1000.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: {
                type: 'BUFF_POWER',
                params: {
                    value: 1000,
                    dynamic: 'OTHER_FRIENDLY_TRAIT_ANY_COUNT_MULTIPLIER',
                    traits: ['계승자', '과거 혹은 미래'],
                    excludeSelf: true,
                },
            },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 필드에 있는 다른 자신 유닛을 1장 고르고 이 턴이 끝날 때까지 어태커 이 공격이 끝날 때까지 파워+3000을 얻는다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'EXCLUDE_SELF' }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: '어태커 : 이 공격이 끝날 때까지 파워+3000.',
                        action: { type: 'BUFF_POWER', params: { value: 3000 } },
                        duration: 'BATTLE_END',
                    },
                },
            },
            duration: 'TURN_END',
        },
    ],
    "ST06-005": [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 덱 맨 위에서 카드를 3장 공개하고 그중 계승자 카드를 1장 패에 넣는다. 나머지는 모두 트래시한다.',
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 3,
                    remainingDestination: 'TRASH',
                    filters: [{ type: 'HAS_TRAIT', value: '계승자' }],
                },
            },
        },
    ],
    "ST06-006": [
        {
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 필드에 있는 계승자 또는 과거 혹은 미래를 가진 다른 자신 유닛 1장마다 파워+1000.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: {
                type: 'BUFF_POWER',
                params: {
                    value: 1000,
                    dynamic: 'OTHER_FRIENDLY_TRAIT_ANY_COUNT_MULTIPLIER',
                    traits: ['계승자', '과거 혹은 미래'],
                    excludeSelf: true,
                },
            },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 이 카드 이외의 계승자를 가진 자신 유닛을 1장 고른다. 그 유닛의 엔트리 효과를 하나 선택해 발동한다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [
                    { type: 'EXCLUDE_SELF' },
                    { type: 'HAS_TRAIT', value: '계승자' },
                    { type: 'HAS_KEYWORD', value: '엔트리' },
                ],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'PROMPT_SELECT_ENTRY_EFFECT' },
            },
        },
    ],
    "ST06-007": [
        {
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 자신의 스킬 존에 스킬이 1장 이상이라면 파워+5000.',
            condition: { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 5000 } },
        },
    ],
    "ST06-008": [
        {
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 필드에 있는 계승자 또는 과거 혹은 미래를 가진 다른 자신 유닛 1장마다 파워+1000.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: {
                type: 'BUFF_POWER',
                params: {
                    value: 1000,
                    dynamic: 'OTHER_FRIENDLY_TRAIT_ANY_COUNT_MULTIPLIER',
                    traits: ['계승자', '과거 혹은 미래'],
                    excludeSelf: true,
                },
            },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 필드에 있는 다른 자신 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 어태커 듀얼리스트와 어태커 이 공격이 끝날 때까지 파워+2000을 얻는다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'EXCLUDE_SELF' }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        {
                            type: 'GRANT_EFFECT',
                            params: {
                                effect: {
                                    activation: ActivationCondition.ATTACKER,
                                    description: '어태커 : 듀얼리스트',
                                    action: { type: 'NONE', params: {} },
                                    duration: 'TURN_END',
                                },
                                duration: 'TURN_END',
                            },
                        },
                        {
                            type: 'GRANT_EFFECT',
                            params: {
                                effect: {
                                    activation: ActivationCondition.ATTACKER,
                                    description: '어태커 : 이 공격이 끝날 때까지 파워+2000.',
                                    action: { type: 'BUFF_POWER', params: { value: 2000 } },
                                    duration: 'BATTLE_END',
                                },
                                duration: 'TURN_END',
                            },
                        },
                    ],
                },
            },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 자신의 패에 넣는다.',
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "ST06-009": [
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 이 공격이 끝날 때까지 파워+2000.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'BATTLE_END',
        },
    ],
    "ST06-010": [
        {
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 필드에 있는 계승자 또는 과거 혹은 미래를 가진 다른 자신 유닛 1장마다 파워+1000.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: {
                type: 'BUFF_POWER',
                params: {
                    value: 1000,
                    dynamic: 'OTHER_FRIENDLY_TRAIT_ANY_COUNT_MULTIPLIER',
                    traits: ['계승자', '과거 혹은 미래'],
                    excludeSelf: true,
                },
            },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 자신의 패를 1장 트래시할 수 있다. 그러면 필드에 있는 다른 자신 유닛을 1장 골라 이 턴이 끝날 때까지 어태커 관통[1]을 얻는다.',
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'EXCLUDE_SELF' }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: '어태커 : 관통[1]',
                        action: { type: 'PENETRATION', params: { value: 1 } },
                        duration: 'TURN_END',
                    },
                },
            },
            duration: 'TURN_END',
        },
    ],
    "ST06-011": [
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 필드에 있는 상대 유닛을 1장 고른다. 그 유닛의 히트만큼 패를 트래시하면 이 턴이 끝날 때까지 그 유닛의 파워를 자신 필드 현재 파워 합만큼 감소시킨다.',
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'ST06_011_ATTACKER_OPTIONAL_DISCARD_FOR_TOTAL_POWER_DEBUFF',
                },
            },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 트래시한다.',
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '필드에 있는 유닛을 1장까지 골라 자신의 턴이 끝날 때까지 파워-3000.',
            targets: {
                scope: 'BOTH_FIELDS',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            },
            action: {
                type: 'BUFF_POWER',
                params: {
                    value: -3000,
                    untilOwnerTurnEnd: true,
                    allowPartialSelection: true,
                    minSelection: 0,
                },
            },
        },
    ],
    "ST06-012": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브 메인 : 자신의 패에서 스킬 카드를 2장까지 골라 트래시한다. 이 턴이 끝날 때까지 트래시한 코스트 합 1마다 조우 유닛의 파워-1000.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'ST06_012_ACTIVE_MAIN_DISCARD_SKILLS_FOR_ENCOUNTER_DEBUFF',
                },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 자신의 트래시 존에서 계승자를 가진 유닛 카드 1장을 골라 패에 넣는다.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'HAS_TRAIT', value: '계승자' },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "ST06-013": [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신은 이 턴이 끝날 때까지 성약을 가진 스킬을 발동할 수 없다.',
            action: { type: 'LOCK_SKILL_TRAIT_UNTIL_TURN_END', params: { trait: '성약' } },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 유닛을 1장 골라 이 턴이 끝날 때까지 파워-3000.',
            targets: {
                scope: 'BOTH_FIELDS',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            },
            action: { type: 'BUFF_POWER', params: { value: -3000 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 계승자를 가진 자신 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 0코스트가 된다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_TRAIT', value: '계승자' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'SET_TARGET_COST_THIS_TURN', params: { cost: 0 } },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: '카드를 1장 드로우한다.',
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    "ST06-014": [
        {
            activation: ActivationCondition.ACTIVE,
            description: '코스트 합이 자신의 대미지 존 카드 수 이하가 되도록 트래시에서 이 카드 이외의 카드를 2장까지 패에 넣는다.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 2,
                filters: [{ type: 'EXCLUDE_CARD_ID', value: 'ST06-014' }],
                totalCostLimit: { type: 'MY_DAMAGE_COUNT' },
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: { allowPartialSelection: true } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 트래시한다.',
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '필드에 있는 유닛을 1장까지 골라 자신의 턴이 끝날 때까지 파워-3000.',
            targets: {
                scope: 'BOTH_FIELDS',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            },
            action: {
                type: 'BUFF_POWER',
                params: {
                    value: -3000,
                    untilOwnerTurnEnd: true,
                    allowPartialSelection: true,
                    minSelection: 0,
                },
            },
        },
    ],
    "ST06-015": [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신은 이 턴이 끝날 때까지 성약을 가진 스킬을 발동할 수 없다.',
            action: { type: 'LOCK_SKILL_TRAIT_UNTIL_TURN_END', params: { trait: '성약' } },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 상대 유닛을 1장 고른다. 그 유닛의 현재 파워가 자신 필드 현재 파워 합 이하라면 그 유닛을 트래시한다.',
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST06_015_DESTROY_IF_POWER_LEQ_MY_FIELD_SUM' },
            },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 계승자를 가진 자신 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 0코스트가 된다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_TRAIT', value: '계승자' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'SET_TARGET_COST_THIS_TURN', params: { cost: 0 } },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: '카드를 1장 드로우한다.',
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    "ST06-016": [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신은 이 턴이 끝날 때까지 성약을 가진 스킬을 발동할 수 없다.',
            action: { type: 'LOCK_SKILL_TRAIT_UNTIL_TURN_END', params: { trait: '성약' } },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 조우 유닛을 가진 자신 유닛을 1장 고른다. 그 유닛은 이 턴 공격 페이즈 중 1번 더 공격할 수 있고 이 턴이 끝날 때까지 파워+2000.',
            targets: {
                scope: 'SHARED_LANE',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'GRANT_EXTRA_ATTACK_THIS_TURN', params: { value: 1 } },
                        { type: 'BUFF_POWER', params: { value: 2000, duration: 'TURN_END' } },
                    ],
                },
            },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 계승자를 가진 자신 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 0코스트가 된다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_TRAIT', value: '계승자' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'SET_TARGET_COST_THIS_TURN', params: { cost: 0 } },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: '카드를 1장 드로우한다.',
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    "ST06-017": [
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 자신의 트래시 존에서 트래시된 장착 유닛보다 코스트가 낮은 유닛 카드 1장을 패에 넣는다.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'COST_LOWER_THAN_TRASHED_UNIT' },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
};
