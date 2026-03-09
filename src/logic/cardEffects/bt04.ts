import { ActivationCondition, CardType, Effect } from '../types';

const SELF_UNIT = { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' } as const;
const ENCOUNTER_UNIT = { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' } as const;
const OTHER_FRIENDLY_UNIT = {
    scope: 'MY_FIELD',
    type: 'UNIT',
    count: 1,
    filters: [{ type: 'EXCLUDE_SELF' }],
    selectMode: 'MANUAL',
} as const;

function awaken(level: number): Effect {
    return {
        activation: ActivationCondition.AWAKEN,
        description: `각성 : 자신의 리더 레벨이 ${level} 이상이라면 이 카드를 뒤집는다.`,
        condition: { type: 'LEADER_LEVEL', value: level },
        action: { type: 'AWAKEN' as any, params: {} },
    };
}

function selfAttackerPower(value: number): Effect {
    return {
        activation: ActivationCondition.ATTACKER,
        description: `어태커 : 이 공격이 끝날 때까지 파워+${value}.`,
        targets: SELF_UNIT as any,
        action: { type: 'BUFF_POWER', params: { value } },
        duration: 'BATTLE_END',
    };
}

function passiveDamageReferenceBonus(value: number): Effect {
    return {
        activation: ActivationCondition.PASSIVE,
        description: `패시브 : 자신의 효과로 대미지 존에 있는 카드의 수를 참조할 때 자신의 대미지 존에 카드가 ${value}장 더 있는 것으로 취급한다.`,
        action: { type: 'NONE', params: { damageCountReferenceBonus: value } },
    };
}

function pactDeckOnly(attribute: string): Effect {
    return {
        activation: ActivationCondition.PASSIVE,
        description: `[서약] 자신의 덱에 [${attribute}]카드만 넣을 수 있다.`,
        action: { type: 'NONE', params: { pactAttribute: attribute } },
    };
}

function berserkKeyword(): Effect {
    return {
        activation: ActivationCondition.PASSIVE,
        description: '광전사 (이 유닛은 가능하다면 반드시 공격해야 한다).',
        action: { type: 'NONE', params: { keyword: 'BERSERK' } },
    };
}

function entryBuffOtherFriendly3000(): Effect {
    return {
        activation: ActivationCondition.ENTRY,
        description: '엔트리 : 필드에 있는 다른 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 파워+3000.',
        targets: OTHER_FRIENDLY_UNIT as any,
        action: { type: 'BUFF_POWER', params: { value: 3000 } },
        duration: 'TURN_END',
    };
}

function triggerTrashSelf(): Effect {
    return {
        activation: ActivationCondition.DAMAGE_TRIGGER,
        description: '트리거 / 이 카드를 트래시한다.',
        action: { type: 'TRASH_SELF', params: {} },
    };
}

function triggerReturnSelfToHand(): Effect {
    return {
        activation: ActivationCondition.DAMAGE_TRIGGER,
        description: '트리거 / 이 카드를 자신의 패에 넣는다.',
        action: { type: 'RETURN_TO_HAND', params: {} },
    };
}

export const BT04_EFFECTS: Record<string, Effect[]> = {
    'BT04-001': [
        awaken(5),
        {
            activation: ActivationCondition.PASSIVE,
            description: '각성면 패시브 : 자신의 효과로 대미지 존에 있는 카드의 수를 참조할 때 자신의 대미지 존에 카드가 4장 더 있는 것으로 취급한다.',
            action: { type: 'NONE', params: { damageCountReferenceBonus: 4 } },
        },
        pactDeckOnly('화염'),
    ],
    'BT04-002': [
        awaken(5),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '각성면 액티브: 메인 - 이 턴 동안 자신이 다음에 패에서 배치하는 유닛 1장은 이 턴이 끝날 때까지 파워+3000.',
            action: {
                type: 'QUEUE_NEXT_PLAY_UNIT_EFFECTS',
                params: {
                    effects: [
                        {
                            activation: ActivationCondition.ACTIVE,
                            description: '다음에 패에서 배치하는 유닛 1장은 이 턴이 끝날 때까지 파워+3000.',
                            action: { type: 'BUFF_POWER', params: { value: 3000 } },
                            duration: 'TURN_END',
                        },
                    ],
                },
            },
        },
        pactDeckOnly('화염'),
    ],
    'BT04-003': [selfAttackerPower(2000)],
    'BT04-004': [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 자신의 덱 맨 위에서 카드를 3장 공개하고, 그중 《나탈론 학원》을 가진 카드를 1장 골라 패에 넣는다. 나머지는 모두 트래시한다.',
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 3,
                    remainingDestination: 'TRASH',
                    filters: [{ type: 'HAS_TRAIT', value: '나탈론 학원' }],
                },
            },
        },
    ],
    'BT04-005': [
        {
            activation: ActivationCondition.ENTRY,
            optional: true,
            description: '엔트리 : 자신의 덱 맨 위에서 카드를 1장 대미지 존에 놓을 수 있다. 그러면 카드를 1장 드로우한다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT04_MOVE_TOP_DECK_TO_DAMAGE',
                    count: 1,
                    thenSubActions: [
                        { type: 'DRAW', params: { count: 1 } },
                    ],
                },
            },
        },
    ],
    'BT04-006': [
        passiveDamageReferenceBonus(1),
        selfAttackerPower(1000),
    ],
    'BT04-007': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 이 공격이 끝날 때까지 자신의 대미지 존에 있는 카드 1장마다 파워+500.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 500, dynamic: 'DAMAGE_COUNT_MULTIPLIER' } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 자신의 대미지 존에 있는 카드가 10장 이상이라면 추가로 히트+1.',
            condition: { type: 'MY_DAMAGE_COUNT', value: { min: 10 } },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'BATTLE_END',
        },
    ],
    'BT04-008': [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 상대의 대미지 존에 있는 카드가 3장 이하라면 자신의 덱 맨 위에서 카드를 1장 대미지 존에 놓는다. 그러면 상대에게 1대미지를 준다.',
            condition: { type: 'OPP_DAMAGE_COUNT', value: { max: 3 } },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT04_MOVE_TOP_DECK_TO_DAMAGE',
                    count: 1,
                    thenSubActions: [{ type: 'DAMAGE', params: { value: 1 } }],
                },
            },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 상대의 대미지 존에 있는 카드가 4장 이상이라면 이 턴이 끝날 때까지 파워+3000.',
            condition: { type: 'OPP_DAMAGE_COUNT', value: { min: 4 } },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'TURN_END',
        },
    ],
    'BT04-009': [selfAttackerPower(2000)],
    'BT04-010': [
        entryBuffOtherFriendly3000(),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브: 메인 - 이 유닛의 파워가 5000 이상이라면 이 턴이 끝날 때까지 조우 유닛의 파워-3000.',
            condition: { type: 'SELF_POWER_MIN', value: 5000 },
            targets: ENCOUNTER_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: -3000 } },
            duration: 'TURN_END',
        },
    ],
    'BT04-011': [selfAttackerPower(3000)],
    'BT04-012': [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 코스트가 자신의 대미지 존에 있는 카드의 수 이하이고 《여름 스페셜》을 가진 카드를 자신의 트래시 존에서 1장 골라 패에 넣는다.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'HAS_TRAIT', value: '여름 스페셜' },
                    { type: 'COST_LIMIT_BY_DAMAGE_COUNT' },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    'BT04-013': [
        entryBuffOtherFriendly3000(),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브: 메인 - 이 유닛의 파워가 5000 이상이라면 자신의 덱 맨 위에서 카드를 1장 대미지 존에 놓는다. 그러면 카드를 2장 드로우한다.',
            condition: { type: 'SELF_POWER_MIN', value: 5000 },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT04_MOVE_TOP_DECK_TO_DAMAGE',
                    count: 1,
                    thenSubActions: [{ type: 'DRAW', params: { count: 2 } }],
                },
            },
        },
    ],
    'BT04-014': [
        passiveDamageReferenceBonus(2),
        selfAttackerPower(3500),
    ],
    'BT04-015': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 자신과 상대의 대미지 존에 있는 카드가 5장 이상이라면 카드를 1장 드로우한다.',
            condition: { type: 'TOTAL_DAMAGE_COUNT', value: { min: 5 } },
            action: { type: 'DRAW', params: { count: 1 } },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 자신과 상대의 대미지 존에 있는 카드가 15장 이상이라면 추가로 카드를 1장 드로우한다.',
            condition: { type: 'TOTAL_DAMAGE_COUNT', value: { min: 15 } },
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    'BT04-016': [
        entryBuffOtherFriendly3000(),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브: 메인 - 이 유닛의 파워에 따라 아래 효과 중 하나를 고른다.',
            condition: { type: 'SELF_POWER_MIN', value: 5000 },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT04_PROMPT_SCRIPTED_OPTIONS',
                    prompt: '후계자 태유의 효과를 선택한다.',
                    options: [
                        {
                            label: '5000 이상',
                            text: '필드에 있는 다른 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 파워+3000.',
                            minSelfPower: 5000,
                            subActions: [
                                {
                                    type: 'BUFF_POWER',
                                    targets: OTHER_FRIENDLY_UNIT,
                                    params: { value: 3000 },
                                    duration: 'TURN_END',
                                },
                            ],
                        },
                        {
                            label: '8000 이상',
                            text: '조우 유닛의 파워가 이 턴이 끝날 때까지 1000이 된다.',
                            minSelfPower: 8000,
                            subActions: [
                                {
                                    type: 'SET_POWER',
                                    targets: ENCOUNTER_UNIT,
                                    params: { value: 1000 },
                                    duration: 'TURN_END',
                                },
                            ],
                        },
                    ],
                },
            },
        },
    ],
    'BT04-017': [
        {
            activation: ActivationCondition.ENTRY,
            optional: true,
            description: '엔트리 : 자신의 패를 1장 골라 트래시할 수 있다. 그러면 자신의 트래시 존에서 《계승자》를 가진 유닛 카드를 1장 골라 패에 넣는다.',
            cost: { type: 'TRASH_HAND', amount: 1 },
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
    'BT04-018': [
        entryBuffOtherFriendly3000(),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브: 메인 - 이 유닛의 파워에 따라 아래 효과 중 하나를 고른다.',
            condition: { type: 'SELF_POWER_MIN', value: 5000 },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT04_PROMPT_SCRIPTED_OPTIONS',
                    prompt: '전학생 아딘의 효과를 선택한다.',
                    options: [
                        {
                            label: '5000 이상',
                            text: '필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-2000.',
                            minSelfPower: 5000,
                            subActions: [
                                {
                                    type: 'BUFF_POWER',
                                    targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
                                    params: { value: -2000 },
                                    duration: 'TURN_END',
                                },
                            ],
                        },
                        {
                            label: '8000 이상',
                            text: '이 턴이 끝날 때까지 [어태커] 관통[1] 과 [어태커] 침투[1] 을 얻는다.',
                            minSelfPower: 8000,
                            subActions: [
                                {
                                    type: 'GRANT_EFFECT',
                                    targets: SELF_UNIT,
                                    params: {
                                        effect: {
                                            activation: ActivationCondition.ATTACKER,
                                            description: '어태커 : 관통[1]',
                                            action: { type: 'PENETRATION', params: { value: 1 } },
                                            duration: 'TURN_END',
                                        },
                                    },
                                    duration: 'TURN_END',
                                },
                                {
                                    type: 'GRANT_EFFECT',
                                    targets: SELF_UNIT,
                                    params: {
                                        effect: {
                                            activation: ActivationCondition.ATTACKER,
                                            description: '어태커 : 침투[1]',
                                            action: { type: 'APPLY_INFILTRATION_MARK', params: {} },
                                            duration: 'TURN_END',
                                        },
                                    },
                                    duration: 'TURN_END',
                                },
                            ],
                        },
                    ],
                },
            },
        },
    ],
    'BT04-019': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 상대의 대미지 존에 있는 카드가 4장 이하라면 자신의 패를 1장 골라 자신의 대미지 존에 놓을 수 있다. 그러면 상대에게 1대미지를 준다.',
            condition: { type: 'OPP_DAMAGE_COUNT', value: { max: 4 } },
            optional: true,
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_019_ATTACKER_OPTIONAL_HAND_TO_DAMAGE_THEN_DAMAGE' } },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 상대의 대미지 존에 있는 카드가 5장 이상이라면 이 공격이 끝날 때까지 파워+4000.',
            condition: { type: 'OPP_DAMAGE_COUNT', value: { min: 5 } },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 4000 } },
            duration: 'BATTLE_END',
        },
        berserkKeyword(),
    ],
    'BT04-020': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 필드에 있는 《계승자》나 《과거 혹은 미래》를 가진 다른 자신 유닛 1장마다 파워+1000.',
            targets: SELF_UNIT as any,
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
            description: '엔트리 : 필드에 있는 《계승자》나 《과거 혹은 미래》를 가진 다른 자신 유닛 1장마다 카드를 1장 드로우한다.',
            action: {
                type: 'DRAW_DYNAMIC',
                params: {
                    multiplier: 'OTHER_FRIENDLY_TRAIT_ANY_COUNT',
                    traits: ['계승자', '과거 혹은 미래'],
                    excludeSelf: true,
                },
            },
        },
    ],
    'BT04-021': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '액티브: 어택 - 자신과 상대의 대미지 존에 있는 카드가 10장 이상이라면 자신의 패를 1장 골라 트래시할 수 있다. 그러면 이 유닛은 이 턴의 어택 페이즈 중 1번 더 공격할 수 있다.',
            condition: {
                type: 'ALL',
                value: [
                    { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
                    { type: 'TOTAL_DAMAGE_COUNT', value: { min: 10 } },
                ],
            },
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: SELF_UNIT as any,
            action: { type: 'GRANT_EXTRA_ATTACK_THIS_TURN', params: { value: 1 } },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 이 공격이 끝날 때까지 파워+3000.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 자신의 대미지 존에 있는 카드가 10장 이상이라면 이 카드를 트래시한다.',
            condition: { type: 'MY_DAMAGE_COUNT', value: { min: 10 } },
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 상대의 대미지 존에 있는 카드가 6장 이하라면 상대에게 1대미지를 준다.',
            condition: { type: 'OPP_DAMAGE_COUNT', value: { max: 6 } },
            action: { type: 'DAMAGE', params: { value: 1 } },
        },
    ],
    'BT04-022': [
        entryBuffOtherFriendly3000(),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브: 메인 - 이 유닛의 파워에 따라 아래 효과 중 하나를 고른다.',
            condition: { type: 'SELF_POWER_MIN', value: 5000 },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT04_PROMPT_SCRIPTED_OPTIONS',
                    prompt: '풍기위원 아리아의 효과를 선택한다.',
                    options: [
                        {
                            label: '5000 이상',
                            text: '자신의 트래시 존에서 3코스트 이하이고 〈풍기위원 아리아〉 이외의 《나탈론 학원》을 가진 유닛 카드를 1장 골라 패에 넣는다.',
                            minSelfPower: 5000,
                            subActions: [
                                {
                                    type: 'MOVE_FROM_TRASH_TO_HAND',
                                    targets: {
                                        scope: 'MY_TRASH',
                                        type: 'CARD',
                                        count: 1,
                                        filters: [
                                            { type: 'UNIT_TYPE', value: CardType.UNIT },
                                            { type: 'HAS_TRAIT', value: '나탈론 학원' },
                                            { type: 'COST_LIMIT', value: 3 },
                                            { type: 'EXCLUDE_CARD_ID', value: 'BT04-022' },
                                        ],
                                        selectMode: 'MANUAL',
                                    },
                                    params: {},
                                },
                            ],
                        },
                        {
                            label: '8000 이상',
                            text: '이 턴이 끝날 때까지 [어태커] 듀얼리스트 를 얻는다.',
                            minSelfPower: 8000,
                            subActions: [
                                {
                                    type: 'GRANT_EFFECT',
                                    targets: SELF_UNIT,
                                    params: {
                                        effect: {
                                            activation: ActivationCondition.ATTACKER,
                                            description: '어태커 : 듀얼리스트',
                                            action: { type: 'APPLY_DUALIST_MARK', params: {} },
                                            duration: 'TURN_END',
                                        },
                                    },
                                    duration: 'TURN_END',
                                },
                            ],
                        },
                    ],
                },
            },
        },
    ],
    'BT04-023': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 이 공격이 끝날 때까지 자신의 대미지 존에 있는 카드 1장마다 파워+1000.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 1000, dynamic: 'DAMAGE_COUNT_MULTIPLIER' } },
            duration: 'BATTLE_END',
        },
    ],
    'BT04-024': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 자신과 상대의 대미지 존에 있는 카드가 20장 이상이라면 상대에게 1대미지를 준다.',
            condition: { type: 'TOTAL_DAMAGE_COUNT', value: { min: 20 } },
            action: { type: 'DAMAGE', params: { value: 1 } },
        },
    ],
    'BT04-025': [
        entryBuffOtherFriendly3000(),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브: 메인 - 이 유닛의 파워에 따라 아래 효과 중 하나를 고른다.',
            condition: { type: 'SELF_POWER_MIN', value: 9000 },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT04_PROMPT_SCRIPTED_OPTIONS',
                    prompt: '고독한 늑대 페이라의 효과를 선택한다.',
                    options: [
                        {
                            label: '9000 이상',
                            text: '필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-7000.',
                            minSelfPower: 9000,
                            subActions: [
                                {
                                    type: 'BUFF_POWER',
                                    targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
                                    params: { value: -7000 },
                                    duration: 'TURN_END',
                                },
                            ],
                        },
                        {
                            label: '12000 이상',
                            text: '이 턴이 끝날 때까지 전투로 상대 유닛을 트래시하면 1번 더 공격할 수 있다.',
                            minSelfPower: 12000,
                            subActions: [
                                {
                                    type: 'GRANT_EFFECT',
                                    targets: SELF_UNIT,
                                    params: {
                                        effect: {
                                            activation: ActivationCondition.ON_KILL,
                                            description: '온킬 : 이 유닛은 이 턴의 어택 페이즈 중 1번 더 공격할 수 있다.',
                                            action: { type: 'GRANT_EXTRA_ATTACK_THIS_TURN', params: { value: 1 } },
                                            duration: 'TURN_END',
                                        },
                                    },
                                    duration: 'TURN_END',
                                },
                            ],
                        },
                    ],
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
            optional: true,
            description: '트리거 / 필드에 있는 유닛을 1장까지 골라, 자신의 턴이 끝날 때까지 파워-3000.',
            targets: { scope: 'BOTH_FIELDS', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -3000, untilSourceOwnerTurnEnd: true } },
        },
    ],
    'BT04-026': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 이 공격이 끝날 때까지 자신의 대미지 존에 있는 카드 1장마다 파워+1000.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 1000, dynamic: 'DAMAGE_COUNT_MULTIPLIER' } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 자신의 대미지 존에 있는 카드가 5장 이상이라면 추가로 히트+1.',
            condition: { type: 'MY_DAMAGE_COUNT', value: { min: 5 } },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'BATTLE_END',
        },
    ],
    'BT04-027': [
        entryBuffOtherFriendly3000(),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브: 메인 - 이 유닛의 파워에 따라 아래 효과 중 하나를 고른다.',
            condition: { type: 'SELF_POWER_MIN', value: 6000 },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT04_PROMPT_SCRIPTED_OPTIONS',
                    prompt: '조장 아룬카의 효과를 선택한다.',
                    options: [
                        {
                            label: '6000 이상',
                            text: '자신의 스킬 존에서 스킬을 1장 골라 트래시한다.',
                            minSelfPower: 6000,
                            subActions: [
                                {
                                    type: 'COMPLEX_ACTION',
                                    params: { mode: 'BT03_PROMPT_SELECT_SKILL_ZONE_CARD_TO_TRASH', contextFlagKey: 'BT04_027_TRASHED_SKILL' },
                                },
                            ],
                        },
                        {
                            label: '9000 이상',
                            text: '이 턴이 끝날 때까지 [어태커] 관통[1] 을 얻고 히트+1.',
                            minSelfPower: 9000,
                            subActions: [
                                {
                                    type: 'GRANT_EFFECT',
                                    targets: SELF_UNIT,
                                    params: {
                                        effect: {
                                            activation: ActivationCondition.ATTACKER,
                                            description: '어태커 : 관통[1]',
                                            action: { type: 'PENETRATION', params: { value: 1 } },
                                            duration: 'TURN_END',
                                        },
                                    },
                                    duration: 'TURN_END',
                                },
                                {
                                    type: 'BUFF_HIT',
                                    targets: SELF_UNIT,
                                    params: { value: 1 },
                                    duration: 'TURN_END',
                                },
                            ],
                        },
                    ],
                },
            },
        },
        triggerReturnSelfToHand(),
    ],
    'BT04-028': [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 자신과 상대의 대미지 존에 있는 카드가 10장 이상이라면 이 턴이 끝날 때까지 상대는 [엑시트] 효과를 발동할 수 없다.',
            condition: { type: 'TOTAL_DAMAGE_COUNT', value: { min: 10 } },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'LOCK_ACTIVATION_UNTIL_TURN_END', target: 'OPPONENT', activation: ActivationCondition.EXIT },
            },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 자신과 상대의 대미지 존에 있는 카드가 20장 이상이라면 필드에 있는 상대 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 트래시되면 자신의 대미지 존에 놓이는 [엑시트]를 얻는다.',
            condition: { type: 'TOTAL_DAMAGE_COUNT', value: { min: 20 } },
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.EXIT,
                        description: '엑시트 : 이 유닛을 자신의 대미지 존에 놓는다.',
                        action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_MOVE_SOURCE_CARD_FROM_TRASH_TO_DAMAGE' } },
                        duration: 'TURN_END',
                    },
                },
                duration: 'TURN_END',
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 자신의 대미지 존에 있는 카드가 10장 이상이라면 이 카드를 트래시한다.',
            condition: { type: 'MY_DAMAGE_COUNT', value: { min: 10 } },
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 상대의 대미지 존에 있는 카드가 6장 이하라면 상대에게 1대미지를 준다.',
            condition: { type: 'OPP_DAMAGE_COUNT', value: { max: 6 } },
            action: { type: 'DAMAGE', params: { value: 1 } },
        },
    ],
    'BT04-029': [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 자신과 상대의 대미지 존에 있는 카드가 10장 이상이라면 이 턴이 끝날 때까지 다른 모든 자신 유닛의 파워+6000을 얻는다.',
            condition: { type: 'TOTAL_DAMAGE_COUNT', value: { min: 10 } },
            targets: SELF_UNIT as any,
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: '패시브 : 필드에 있는 다른 모든 자신 유닛의 파워+6000.',
                        targets: {
                            scope: 'MY_FIELD',
                            type: 'UNIT',
                            count: 0,
                            filters: [{ type: 'EXCLUDE_SELF' }],
                            selectMode: 'ALL',
                        },
                        action: { type: 'BUFF_POWER', params: { value: 6000 } },
                        duration: 'TURN_END',
                    },
                },
                duration: 'TURN_END',
            },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 자신과 상대의 대미지 존에 있는 카드가 20장 이상이라면 추가로 조우 유닛을 트래시한다.',
            condition: { type: 'TOTAL_DAMAGE_COUNT', value: { min: 20 } },
            targets: ENCOUNTER_UNIT as any,
            action: { type: 'DESTROY_UNIT', params: {} },
        },
        triggerReturnSelfToHand(),
    ],
    'BT04-030': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 파워+3000.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'TURN_END',
        },
    ],
    'BT04-031': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 대미지 존에 있는 카드가 5장 이상이라면 카드를 1장 드로우한다. 추가로 이 턴이 끝날 때까지 자신의 효과로 대미지 존에 있는 카드의 수를 참조할 때 자신의 대미지 존에 카드가 3장 더 있는 것으로 취급한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_031_DRAW_IF_DAMAGE5_AND_ADD_BONUS' } },
        },
    ],
    'BT04-032': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 상대 유닛을 1장 고른다. 이 턴이 끝날 때까지 자신의 대미지 존에 있는 카드 1장마다 그 유닛의 파워-500.',
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -500, dynamic: 'DAMAGE_COUNT_MULTIPLIER' } },
            duration: 'TURN_END',
        },
    ],
    'BT04-033': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '이 턴 동안 자신이 다음에 패에서 배치하는 유닛 1장은 이 턴이 끝날 때까지 [어태커] 약탈[1] 을 얻고 파워+3000.',
            action: {
                type: 'QUEUE_NEXT_PLAY_UNIT_EFFECTS',
                params: {
                    effects: [
                        {
                            activation: ActivationCondition.ACTIVE,
                            description: '다음에 패에서 배치하는 유닛 1장은 이 턴이 끝날 때까지 파워+3000.',
                            action: { type: 'BUFF_POWER', params: { value: 3000 } },
                            duration: 'TURN_END',
                        },
                        {
                            activation: ActivationCondition.ACTIVE,
                            description: '다음에 패에서 배치하는 유닛 1장은 이 턴이 끝날 때까지 [어태커] 약탈[1] 을 얻는다.',
                            action: {
                                type: 'GRANT_EFFECT',
                                params: {
                                    effect: {
                                        activation: ActivationCondition.ATTACKER,
                                        description: '어태커 : 약탈[1]',
                                        action: { type: 'PLUNDER', params: { value: 1 } },
                                        duration: 'TURN_END',
                                    },
                                },
                            },
                            duration: 'TURN_END',
                        },
                    ],
                },
            },
        },
    ],
    'BT04-034': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 모든 자신 유닛은 이 턴이 끝날 때까지 파워+2000. 자신과 상대의 대미지 존에 있는 카드가 10장 이상이라면 추가로 카드를 1장 드로우한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_034_BUFF_ALL_AND_DRAW_IF_TOTAL_DAMAGE10' } },
        },
    ],
    'BT04-035': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 자신 유닛과 상대 유닛을 1장씩 고른다. 이 턴이 끝날 때까지 상대 유닛의 파워가 자신 유닛의 파워만큼 감소한다. 그러면 고른 자신 유닛을 트래시한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_035_COMPARE_POWER_AND_TRASH' } },
        },
        triggerReturnSelfToHand(),
    ],
    'BT04-036': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 자신 유닛이 2장이라면 필드에 있는 모든 자신 유닛은 이 턴이 끝날 때까지 파워+3000.',
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT04_BUFF_ALL_FRIENDLY_IF_UNIT_COUNT', requiredCount: 2, power: 3000 },
            },
        },
    ],
    'BT04-037': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신은 이 턴이 끝날 때까지 《성약》을 가진 스킬을 발동할 수 없다. 자신의 트래시 존에서 4코스트 이하인 카드를 1장 골라 패에 넣는다. 그러면 패를 1장 골라 트래시한다. 필드에 있는 《계승자》를 가진 자신 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 0코스트가 된다. 그러면 카드를 1장 드로우한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_037_RETURN_TRASH_DISCARD_ZERO_COST_DRAW' } },
        },
    ],
    'BT04-038': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '장착 조건: 나탈론 학원을 가진 유닛.',
            condition: { type: 'HAS_TRAIT', value: '나탈론 학원' },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 자신의 턴 동안 파워+3000.',
            condition: { type: 'YOUR_TURN' },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
        },
    ],
    'BT04-039': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '장착 조건: 여름 스페셜을 가진 유닛.',
            condition: { type: 'HAS_TRAIT', value: '여름 스페셜' },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 이 공격이 끝날 때까지 자신의 대미지 존에 있는 카드 1장마다 파워+1000.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 1000, dynamic: 'DAMAGE_COUNT_MULTIPLIER' } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 자신과 상대의 대미지 존에 있는 카드가 15장 이상이라면 추가로 [어태커] 듀얼리스트 를 얻는다.',
            condition: { type: 'TOTAL_DAMAGE_COUNT', value: { min: 15 } },
            targets: SELF_UNIT as any,
            action: { type: 'APPLY_DUALIST_MARK', params: {} },
            duration: 'BATTLE_END',
        },
    ],
    'BT04-040': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '장착 조건: 없음.',
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 자신의 대미지 존에 있는 카드가 5장 이상 9장 이하라면 관통[1]을 얻는다.',
            condition: { type: 'MY_DAMAGE_COUNT', value: { min: 5, max: 9 } },
            targets: SELF_UNIT as any,
            action: { type: 'PENETRATION', params: { value: 1 } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 자신의 대미지 존에 있는 카드가 10장 이상이라면 관통[2]를 얻는다.',
            condition: { type: 'MY_DAMAGE_COUNT', value: { min: 10 } },
            targets: SELF_UNIT as any,
            action: { type: 'PENETRATION', params: { value: 2 } },
            duration: 'BATTLE_END',
        },
    ],
    'BT04-041': [
        awaken(6),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '각성면 액티브: 메인 - 자신의 패에서 《용의 계곡》이나 《혹한의 날들》을 가진 카드를 1장 골라 대미지 존에 놓는다. 그러면 자신의 트래시 존에서 그 카드의 코스트 이하인 카드를 1장 골라 패에 넣는다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_041_LEADER_MOVE_HAND_TO_DAMAGE_THEN_RECOVER_BY_COST' } },
        },
        pactDeckOnly('폭풍'),
    ],
    'BT04-042': [
        awaken(5),
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '각성면 액티브: 메인 - 필드에 있는 자신 유닛을 1장 골라 트래시한다. 그러면 필드에 있는 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 파워+2000.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 2, selectMode: 'MANUAL' },
            action: { type: 'SACRIFICE_TO_BUFF', params: { powerValue: 2000, duration: 'TURN_END' } },
        },
        pactDeckOnly('폭풍'),
    ],
    'BT04-043': [
        {
            activation: ActivationCondition.DEFENDER,
            description: '디펜더 : 종결',
            action: { type: 'TERMINATE_ATTACK', params: {} },
        },
    ],
    'BT04-044': [
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 자신의 덱 맨 위에서 카드를 3장 트래시한다. 이 효과로 트래시된 [엑시트]를 가진 유닛 카드가 1장 이상이라면 카드를 1장 드로우한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_044_MILL3_DRAW_IF_EXIT_UNIT' } },
        },
    ],
    'BT04-045': [
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 효과로 트래시됐다면 자신의 패를 1장 골라 트래시할 수 있다. 그러면 이 턴이 끝날 때 비어 있는 자신의 유닛 존에 이 유닛 카드를 배치한다.',
            condition: { type: 'TRASH_REASON', value: 'EFFECT' },
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_045_REDEPLOY_SELF_AT_TURN_END' } },
        },
    ],
    'BT04-046': [
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 필드에 있는 상대 유닛을 1장 골라, 자신의 턴이 끝날 때까지 파워-2000.',
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -2000, untilSourceOwnerTurnEnd: true } },
        },
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 자신의 턴이라면 추가로 파워-1000.',
            condition: { type: 'YOUR_TURN' },
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -1000, untilSourceOwnerTurnEnd: true } },
        },
    ],
    'BT04-047': [
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 이 유닛을 자신의 대미지 존에 놓는다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_MOVE_SOURCE_CARD_FROM_TRASH_TO_DAMAGE' } },
        },
    ],
    'BT04-048': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브: 메인 - 필드에 있는 다른 자신 유닛을 1장 골라 대미지 존에 놓는다. 그러면 이 턴이 끝날 때까지 파워+2000, 히트+1.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'EXCLUDE_SELF' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_048_MOVE_OTHER_FRIENDLY_TO_DAMAGE_AND_BUFF_SELF' } },
        },
    ],
    'BT04-049': [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 필드에 있는 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 턴 종료 시 자신을 트래시하는 효과를 얻고 히트+1.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_049_GRANT_TURN_END_TRASH_AND_HIT' } },
        },
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 필드에 있는 자신 유닛을 1장 골라, 상대의 턴이 끝날 때까지 파워+2000.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'OPP_TURN_END',
        },
    ],
    'BT04-050': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 이 턴 동안 필드에서 트래시된 자신 유닛이 1장 이상이라면 이 턴이 끝날 때까지 파워+3000.',
            condition: { type: 'FIELD_TRASHED_FRIENDLY_THIS_TURN_MIN', value: { min: 1 } },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
        },
    ],
    'BT04-051': [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 자신의 패를 1장 골라 대미지 존에 놓는다.',
            targets: { scope: 'MY_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'MOVE_FROM_HAND_TO_DAMAGE', params: { setContextFlag: 'BT04_051_MOVED' } },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '그러면 카드를 1장 드로우한다.',
            condition: { type: 'CONTEXT_FLAG', value: 'BT04_051_MOVED' },
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    'BT04-052': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 이 턴이 끝날 때까지 [엑시트] 자신의 패를 1장 골라 트래시할 수 있다. 그러면 코스트가 이 턴 동안 《호문클루스》를 가진 자신 유닛이 공격한 수 이하인 카드를 자신의 트래시 존에서 1장 골라 패에 넣는다를 얻는다.',
            targets: SELF_UNIT as any,
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.EXIT,
                        optional: true,
                        cost: { type: 'TRASH_HAND', amount: 1 },
                        description: '엑시트 : 자신의 패를 1장 골라 트래시할 수 있다. 그러면 코스트가 이 턴 동안 《호문클루스》를 가진 자신 유닛이 공격한 수 이하인 카드를 자신의 트래시 존에서 1장 골라 패에 넣는다.',
                        action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_052_EXIT_DISCARD_FOR_HOMUNCULUS_RECOVER' } },
                        duration: 'TURN_END',
                    },
                },
                duration: 'TURN_END',
            },
        },
    ],
    'BT04-053': [
        {
            activation: ActivationCondition.ENTRY,
            optional: true,
            description: '엔트리 : 카드를 2장 드로우할 수 있다.',
            action: { type: 'DRAW', params: { count: 2, setContextFlag: 'BT04_053_DREW' } },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '그러면 자신의 패를 1장 골라 대미지 존에 놓는다.',
            condition: { type: 'CONTEXT_FLAG', value: 'BT04_053_DREW' },
            targets: { scope: 'MY_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'MOVE_FROM_HAND_TO_DAMAGE', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 자신의 턴 동안 자신의 대미지 존에 있는 《용의 계곡》을 가진 카드 1장마다 파워+1000.',
            condition: { type: 'YOUR_TURN' },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 1000, dynamic: 'DAMAGE_TRAIT_COUNT_MULTIPLIER', trait: '용의 계곡' } },
        },
    ],
    'BT04-054': [
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 자신의 트래시 존에서 《런웨이 파이터》를 가진 카드를 1장 골라 패에 넣는다.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [{ type: 'HAS_TRAIT', value: '런웨이 파이터' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    'BT04-055': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브: 메인 - 이 턴 동안 효과로 자신의 대미지 존에 카드가 놓였다면 카드를 1장 드로우한다.',
            condition: { type: 'DAMAGE_PLACED_IN_MY_ZONE_BY_EFFECT_THIS_TURN', value: { min: 1 } },
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    'BT04-056': [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 자신의 패를 1장 골라 트래시한다. 조우 유닛이 3코스트 이하라면 그 유닛을 트래시한다.',
            condition: { type: 'ENCOUNTER_COST_MAX', value: 3 },
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: ENCOUNTER_UNIT as any,
            action: { type: 'DESTROY_UNIT', params: {} },
        },
    ],
    'BT04-057': [
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 이 유닛을 자신의 대미지 존에 놓는다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_MOVE_SOURCE_CARD_FROM_TRASH_TO_DAMAGE' } },
        },
    ],
    'BT04-058': [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 필드에 있는 자신 유닛을 1장 골라 트래시한다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_UNIT', params: { setContextFlag: 'BT04_058_TRASHED' } },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '그러면 이 턴이 끝날 때까지 히트+1.',
            condition: { type: 'CONTEXT_FLAG', value: 'BT04_058_TRASHED' },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END',
        },
    ],
    'BT04-059': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브: 메인 - 이 턴 동안 필드에서 트래시된 자신 유닛이 1장 이상이라면 필드에 있는 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 파워+5000.',
            condition: { type: 'FIELD_TRASHED_FRIENDLY_THIS_TURN_MIN', value: { min: 1 } },
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: 5000 } },
            duration: 'TURN_END',
        },
    ],
    'BT04-060': [
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 필드에 있는 상대 유닛을 1장 골라, 상대의 턴이 끝날 때까지 파워-4000.',
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -4000, untilOwnerTurnEnd: true } },
        },
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 자신의 턴이라면 추가로 파워-1000.',
            condition: { type: 'YOUR_TURN' },
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -1000, untilOwnerTurnEnd: true } },
        },
    ],
    'BT04-061': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브: 메인 - 자신의 패에서 카드를 1장 골라 대미지 존에 놓는다. 그러면 자신의 트래시 존에서 유닛 카드를 1장 골라 패에 넣는다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_061_MOVE_HAND_TO_DAMAGE_THEN_RECOVER_UNIT' } },
        },
    ],
    'BT04-062': [
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 자신의 패를 1장 골라 트래시할 수 있다. 그러면 카드에 따라 트래시 존에서 카드를 1장 골라 패에 넣는다.',
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_062_EXIT_DISCARD_AND_RECOVER' } },
        },
    ],
    'BT04-063': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브: 메인 - 이 턴 동안 자신의 필드, 덱, 패에 있는 카드가 대미지 존에 놓였다면 카드를 1장 드로우한다.',
            condition: {
                type: 'DAMAGE_PLACED_IN_MY_ZONE_BY_EFFECT_THIS_TURN',
                value: { min: 1, originAreas: ['FIELD', 'DECK', 'HAND'] },
            },
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    'BT04-064': [
        {
            activation: ActivationCondition.ENTRY,
            optional: true,
            description: '엔트리 : 자신의 트래시 존에서 카드를 1장 골라 대미지 존에 놓을 수 있다.',
            targets: { scope: 'MY_TRASH', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'MOVE_FROM_TRASH_TO_DAMAGE', params: {} },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '액티브: 메인 - 조우 유닛의 코스트가 자신의 대미지 존에 있는 《용의 계곡》을 가진 카드의 수 미만이라면 자신의 패를 1장 골라 트래시한다. 그러면 조우 유닛을 트래시한다.',
            condition: { type: 'ENCOUNTER_COST_LOWER_THAN_MY_DAMAGE_TRAIT_COUNT', value: { trait: '용의 계곡' } },
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: ENCOUNTER_UNIT as any,
            action: { type: 'DESTROY_UNIT', params: {} },
        },
    ],
    'BT04-065': [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 필드에 있는 자신 유닛을 1장 골라 트래시한다.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '[가디언] 희생[1]',
            action: { type: 'NONE', params: { guardianBarrierCost: 1 } },
        },
    ],
    'BT04-066': [
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 자신의 덱 맨 위에서 카드를 4장 공개할 수 있다. 그러면 그중 1장을 골라 대미지 존에 놓고 1장을 골라 패에 넣는다. 나머지는 모두 트래시한다.',
            optional: true,
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_066_REVEAL4_SPLIT_DAMAGE_HAND_TRASH' } },
        },
    ],
    'BT04-067': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '어태커 : 이 턴이 끝날 때까지 [엑시트] 이 턴 동안 《호문클루스》를 가진 자신 유닛이 공격한 수 이하의 코스트이고 〈라비 : 내달리는 무지개〉 이외의 《호문클루스》를 가진 유닛 카드를 자신의 트래시 존에서 1장 골라 비어 있는 자신의 유닛 존에 배치한다를 얻는다.',
            targets: SELF_UNIT as any,
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.EXIT,
                        description: '엑시트 : 조건에 맞는 《호문클루스》 유닛 카드를 자신의 트래시 존에서 1장 골라 비어 있는 자신의 유닛 존에 배치한다.',
                        action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_067_EXIT_REDEPLOY_HOMUNCULUS_FROM_TRASH' } },
                        duration: 'TURN_END',
                    },
                },
                duration: 'TURN_END',
            },
        },
    ],
    'BT04-068': [
        {
            activation: ActivationCondition.ENTRY,
            optional: true,
            description: '엔트리 : 자신의 패에서 카드를 1장 골라 대미지 존에 놓을 수 있다.',
            targets: { scope: 'MY_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'MOVE_FROM_HAND_TO_DAMAGE', params: { setContextFlag: 'BT04_068_MOVED_TO_DAMAGE' } },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 놓지 않았다면 필드에 있는 자신 유닛을 1장 골라 트래시한다.',
            condition: { type: 'CONTEXT_FLAG', value: { key: 'BT04_068_MOVED_TO_DAMAGE', equals: false } },
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 자신의 대미지 존에 있는 《용의 계곡》을 가진 카드 1장마다 파워+1000.',
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 1000, dynamic: 'DAMAGE_TRAIT_COUNT_MULTIPLIER', trait: '용의 계곡' } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '패시브 : 자신의 대미지 존에 있는 《용의 계곡》을 가진 카드가 5장 이상이라면 추가로 히트+1.',
            condition: { type: 'MY_DAMAGE_TRAIT_COUNT', value: { trait: '용의 계곡', min: 5 } },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_HIT', params: { value: 1 } },
        },
    ],
    'BT04-069': [
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 자신의 트래시 존에서 [트리거]를 가지지 않고 카드명이 다른 카드를 6장 골라 덱 맨 아래에 원하는 순서대로 놓을 수 있다. 그러면 비어 있는 자신의 유닛 존에 이 유닛 카드를 배치한다. 고른 카드 중 《런웨이 파이터》를 가진 카드가 2장 이상이고 자신의 대미지 존에 있는 카드가 7장 이상이라면 자신의 대미지 존에서 카드를 1장 골라 트래시할 수 있다.',
            optional: true,
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_069_EXIT_BOTTOM6_AND_REVIVE_SELF' } },
        },
    ],
    'BT04-070': [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 필드에 있는 자신 유닛을 1장 골라 트래시한다. 다른 자신 유닛을 트래시했다면 카드를 1장 드로우하고, 상대의 턴이 끝날 때까지 파워+2000.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_070_ENTRY_TRASH_FRIENDLY_FOR_DRAW_AND_BUFF' } },
        },
        {
            activation: ActivationCondition.EXIT,
            optional: true,
            description: '엑시트 : 자신의 패를 1장 골라 트래시할 수 있다. 그러면 [엔트리], [어태커], [액티브] 중 1개를 선언한다. 다음 턴이 끝날 때까지 상대는 그 효과를 발동할 수 없다.',
            cost: { type: 'TRASH_HAND', amount: 1 },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT04_PROMPT_SCRIPTED_OPTIONS',
                    prompt: '잠글 효과를 선언한다.',
                    options: [
                        {
                            label: '엔트리',
                            text: '[엔트리]를 선언한다.',
                            subActions: [
                                {
                                    type: 'COMPLEX_ACTION',
                                    params: {
                                        mode: 'LOCK_ACTIVATION_UNTIL_TURN_END',
                                        target: 'OPPONENT',
                                        activation: ActivationCondition.ENTRY,
                                        untilTurnCountOffset: 1,
                                    },
                                },
                            ],
                        },
                        {
                            label: '어태커',
                            text: '[어태커]를 선언한다.',
                            subActions: [
                                {
                                    type: 'COMPLEX_ACTION',
                                    params: {
                                        mode: 'LOCK_ACTIVATION_UNTIL_TURN_END',
                                        target: 'OPPONENT',
                                        activation: ActivationCondition.ATTACKER,
                                        untilTurnCountOffset: 1,
                                    },
                                },
                            ],
                        },
                        {
                            label: '액티브',
                            text: '[액티브]를 선언한다.',
                            subActions: [
                                {
                                    type: 'COMPLEX_ACTION',
                                    params: {
                                        mode: 'LOCK_ACTIVATION_UNTIL_TURN_END',
                                        target: 'OPPONENT',
                                        activation: ActivationCondition.ACTIVE,
                                        untilTurnCountOffset: 1,
                                    },
                                },
                            ],
                        },
                    ],
                },
            },
        },
        triggerReturnSelfToHand(),
    ],
    'BT04-071': [
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 효과로 트래시됐다면 자신의 패를 1장 골라 트래시할 수 있다. 그러면 상대에게 1대미지를 준다.',
            condition: { type: 'TRASH_REASON', value: 'EFFECT' },
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            action: { type: 'DAMAGE', params: { value: 1 } },
        },
    ],
    'BT04-072': [
        {
            activation: ActivationCondition.ENTRY,
            optional: true,
            description: '엔트리 : 카드를 1장 드로우할 수 있다.',
            action: { type: 'DRAW', params: { count: 1, setContextFlag: 'BT04_072_DREW' } },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '그러면 자신의 패에서 카드를 1장 골라 대미지 존에 놓는다.',
            condition: { type: 'CONTEXT_FLAG', value: 'BT04_072_DREW' },
            targets: { scope: 'MY_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'MOVE_FROM_HAND_TO_DAMAGE', params: {} },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 자신의 대미지 존에 있는 《용의 계곡》을 가진 카드가 5장 이상이라면 자신의 대미지 존에서 카드를 1장 골라 트래시하고, 이 턴이 끝날 때까지 트래시한 카드의 코스트 1마다 파워+1000.',
            condition: { type: 'MY_DAMAGE_TRAIT_COUNT', value: { trait: '용의 계곡', min: 5 } },
            targets: { scope: 'MY_DAMAGE', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'MOVE_FROM_DAMAGE_TO_TRASH',
                params: {
                    setContextFlag: 'BT04_072_TRASHED_DAMAGE',
                    storeMovedCardCostFlag: 'trashedCardCost',
                },
            },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '이 턴이 끝날 때까지 트래시한 카드의 코스트 1마다 파워+1000.',
            condition: { type: 'CONTEXT_FLAG', value: 'BT04_072_TRASHED_DAMAGE' },
            targets: SELF_UNIT as any,
            action: { type: 'BUFF_POWER', params: { value: 1000, dynamic: 'TRASHED_CARD_COST_MULTIPLIER' } },
            duration: 'TURN_END',
        },
        triggerReturnSelfToHand(),
    ],
    'BT04-073': [
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 코스트 합이 자신의 대미지 존에 있는 《용의 계곡》을 가진 카드의 수 이하가 되도록 필드에 있는 상대 유닛을 원하는 수만큼 골라 트래시한다. 2장 이상 트래시했다면 이 유닛은 이 턴이 끝날 때까지 공격할 수 없다.',
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 3,
                totalCostLimit: { type: 'MY_DAMAGE_TRAIT_COUNT', trait: '용의 계곡' },
                selectMode: 'MANUAL',
            },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_073_DESTROY_SELECTED_AND_LOCK_IF_TWO' } },
        },
        triggerTrashSelf(),
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 코스트가 자신의 대미지 존에 있는 《용의 계곡》을 가진 카드의 수 이하인 상대 유닛을 1장 골라 트래시한다.',
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT_BY_DAMAGE_TRAIT_COUNT', value: { trait: '용의 계곡' } }],
                selectMode: 'MANUAL',
            },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
    ],
    'BT04-074': [
        {
            activation: ActivationCondition.ENTRY,
            optional: true,
            description: '엔트리 : 필드에 있는 다른 자신 유닛을 1장 골라 트래시할 수 있다. 그러면 트래시한 유닛의 코스트 이하인 상대 유닛을 필드에서 1장 골라 트래시한다.',
            targets: OTHER_FRIENDLY_UNIT as any,
            action: {
                type: 'DESTROY_UNIT',
                params: {
                    setContextFlag: 'BT04_074_TRASHED_OTHER',
                    storeDestroyedUnitCostFlag: 'trashedCardCost',
                    storeDestroyedUnitAsContext: true,
                },
            },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '그러면 트래시한 유닛의 코스트 이하인 상대 유닛을 1장 골라 트래시한다.',
            condition: { type: 'CONTEXT_FLAG', value: 'BT04_074_TRASHED_OTHER' },
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT_BY_COST_PAYMENT' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
        triggerTrashSelf(),
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 자신의 트래시 존에서 [엑시트]를 가진 유닛 카드를 1장 골라 패에 넣는다.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'HAS_KEYWORD', value: '엑시트' },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    'BT04-075': [
        {
            activation: ActivationCondition.ENTRY,
            optional: true,
            description: '엔트리 : 카드를 1장 드로우할 수 있다.',
            action: { type: 'DRAW', params: { count: 1, setContextFlag: 'BT04_075_DREW' } },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '그러면 자신의 패에서 카드를 1장 골라 대미지 존에 놓는다.',
            condition: { type: 'CONTEXT_FLAG', value: 'BT04_075_DREW' },
            targets: { scope: 'MY_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'MOVE_FROM_HAND_TO_DAMAGE', params: {} },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: '엔트리 : 자신의 대미지 존에 있는 《용의 계곡》을 가진 카드가 8장 이상이라면 조우 유닛을 상대의 대미지 존에 놓는다.',
            condition: { type: 'MY_DAMAGE_TRAIT_COUNT', value: { trait: '용의 계곡', min: 8 } },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_075_MOVE_ENCOUNTER_TO_OPP_DAMAGE' } },
        },
    ],
    'BT04-076': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 대미지 존에서 카드를 2장까지 골라 트래시하고, 트래시한 수만큼 자신의 트래시 존에서 카드를 골라 대미지 존에 놓는다. 자신의 대미지 존에 있는 《용의 계곡》을 가진 카드가 5장 이상이라면 카드를 1장 드로우한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_076_SWAP_DAMAGE_AND_TRASH' } },
        },
        triggerTrashSelf(),
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 코스트가 자신의 대미지 존에 있는 《용의 계곡》을 가진 카드의 수 이하인 상대 유닛을 1장 골라 트래시한다.',
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT_BY_DAMAGE_TRAIT_COUNT', value: { trait: '용의 계곡' } }],
                selectMode: 'MANUAL',
            },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
    ],
    'BT04-077': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 패에서 카드를 1장 골라 대미지 존에 놓는다. 그러면 카드를 2장 드로우한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_077_MOVE_HAND_TO_DAMAGE_THEN_DRAW2' } },
        },
    ],
    'BT04-078': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드에 있는 자신 유닛을 1장 골라 트래시한다. 그러면 카드를 2장 드로우한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_078_TRASH_FRIENDLY_THEN_DRAW2' } },
        },
    ],
    'BT04-079': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신은 이 턴이 끝날 때까지 〈친구를 위한 마법〉을 발동할 수 없다. 자신의 트래시 존에 있는 《호문클루스》를 가진 유닛 카드가 5장 이상이라면 상대에게 1대미지를 준다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_079_LOCK_SELF_AND_DAMAGE_IF_HOMUNCULUS5' } },
        },
    ],
    'BT04-080': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 대미지 존에 있는 카드가 8장 이상이라면 그중 1장을 골라 트래시한다.',
            condition: { type: 'MY_DAMAGE_COUNT', value: { min: 8 } },
            targets: { scope: 'MY_DAMAGE', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'MOVE_FROM_DAMAGE_TO_TRASH', params: {} },
        },
    ],
    'BT04-081': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 대미지 존에 있는 《용의 계곡》을 가진 카드가 5장 이상이라면 필드에 있는 5코스트 이하인 상대 유닛을 1장 골라 트래시한다.',
            condition: { type: 'MY_DAMAGE_TRAIT_COUNT', value: { trait: '용의 계곡', min: 5 } },
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 5 }],
                selectMode: 'MANUAL',
            },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
    ],
    'BT04-082': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신의 모든 유닛 존에 유닛이 없다면 자신의 트래시 존에서 《호문클루스》를 가지고 카드명이 다른 유닛 카드를 3장 고른다. 그러면 비어 있는 자신의 유닛 존에 사이즈를 무시하고 고른 카드를 모두 배치한다. 이 효과로 배치한 모든 유닛은 이 턴이 끝날 때 트래시된다.',
            condition: { type: 'MY_FIELD_UNIT_COUNT', value: { max: 0 } },
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 3,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'HAS_TRAIT', value: '호문클루스' },
                ],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT04_082_DEPLOY_SELECTED_HOMUNCULUS_AND_MARK_TURN_END_TRASH',
                    requireDistinctNames: true,
                },
            },
        },
        triggerTrashSelf(),
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 자신의 트래시 존에서 《호문클루스》를 가진 유닛 카드를 1장 골라 패에 넣는다.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'HAS_TRAIT', value: '호문클루스' },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    'BT04-083': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '장착 조건: 5코스트 이상인 유닛.',
            condition: { type: 'COST_COMPARISON', value: { operator: 'GTE', cost: 5 } },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: '액티브: 어택 - 이 턴 동안 필드에서 전투나 효과로 트래시된 자신 유닛이 1장 이상이라면 이 턴이 끝날 때까지 히트+1. 3장 이상이라면 추가로 히트+1.',
            condition: { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT04_083_BUFF_HIT_BY_FRIENDLY_TRASH_COUNT' } },
        },
    ],
    'BT04-084': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '장착 조건: 4코스트 이하인 유닛.',
            condition: { type: 'COST_COMPARISON', value: { operator: 'LTE', cost: 4 } },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.EXIT,
            description: '엑시트 : 비어 있는 자신의 유닛 존에 이 유닛 카드를 배치한다.',
            action: { type: 'COMPLEX_ACTION', params: { mode: 'BT03_067_PROMPT_REVIVE_TRASHED_EQUIPPED_UNIT' } },
        },
    ],
};
