import { ActivationCondition, CardType, Effect } from '../types';

export const ST10_EFFECTS: Record<string, Effect[]> = {
    "ST10-001": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 5 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "각성면 액티브: 어택 - 자신의 패를 1장 트래시하고 3코스트 이하인 자신 유닛 1장을 고른다. 그 유닛은 이 턴의 어택 페이즈 중 1번 더 공격할 수 있다.",
            condition: { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 3 }],
                selectMode: 'MANUAL'
            },
            action: { type: 'GRANT_EXTRA_ATTACK_THIS_TURN', params: { value: 1 } },
            duration: 'TURN_END'
        }
    ],
    "ST10-002": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 패를 1장 트래시할 수 있다. 그러면 카드를 1장 드로우한다.",
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            action: { type: 'DRAW', params: { count: 1 } }
        }
    ],
    "ST10-003": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 조우 유닛이 있다면 이 유닛으로 공격한다.",
            action: { type: 'AUTO_ATTACK_IF_ENCOUNTER', params: {} }
        },
        {
            activation: ActivationCondition.BATTLE_END,
            description: "패시브 : 이 유닛이 공격하거나 방어한 전투가 끝날 때 이 유닛을 트래시한다.",
            action: { type: 'DESTROY_SELF', params: {} }
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 듀얼리스트",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'APPLY_DUALIST_MARK', params: {} }
        }
    ],
    "ST10-004": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 덱 맨 위에서 3장을 공개하고 그중 [체인] 유닛 1장을 패에 넣는다. 나머지는 트래시한다.",
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 3,
                    remainingDestination: 'TRASH',
                    filters: [
                        { type: 'UNIT_TYPE', value: CardType.UNIT },
                        { type: 'HAS_KEYWORD', value: '체인' }
                    ]
                }
            }
        }
    ],
    "ST10-005": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+2000.",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'BATTLE_END'
        }
    ],
    "ST10-006": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "체인 2 어태커 : 이 턴 동안 자신 유닛이 공격한 횟수가 2번 이상이라면 이 공격이 끝날 때까지 약탈[1]을 얻는다.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 2 },
            action: { type: 'PLUNDER', params: { value: 1 } },
            duration: 'BATTLE_END'
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 필드에 있는 다른 자신 유닛 1장을 고르고 이 턴이 끝날 때까지 파워+2000.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'EXCLUDE_SELF' }],
                selectMode: 'MANUAL'
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END'
        }
    ],
    "ST10-007": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "액티브: 메인 : 자신의 스킬 존에 스킬이 1장 이상이라면 상대 턴 종료까지 어태커 파워+2000 효과를 얻는다.",
            condition: { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: "어태커 : 이 공격이 끝날 때까지 파워+2000.",
                        action: { type: 'BUFF_POWER', params: { value: 2000 } },
                        duration: 'BATTLE_END'
                    }
                }
            },
            duration: 'OPP_TURN_END'
        }
    ],
    "ST10-008": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "체인 2 어태커 : 이 턴 동안 자신 유닛이 공격한 횟수가 2번 이상이라면 이 턴이 끝날 때까지 조우 유닛의 파워-3000.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 2 },
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: -3000 } },
            duration: 'TURN_END'
        }
    ],
    "ST10-009": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 필드에 있는 모든 자신 유닛은 이 턴이 끝날 때까지 어태커 파워+1000을 얻는다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: "어태커 : 이 공격이 끝날 때까지 파워+1000.",
                        action: { type: 'BUFF_POWER', params: { value: 1000 } },
                        duration: 'BATTLE_END'
                    }
                }
            },
            duration: 'TURN_END'
        }
    ],
    "ST10-010": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "체인 2 어태커 : 이 턴 동안 자신 유닛이 공격한 횟수가 2번 이상이라면 이 공격이 끝날 때까지 히트+1.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 2 },
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'BATTLE_END'
        }
    ],
    "ST10-011": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "체인 3 어태커 : 이 턴 동안 자신 유닛이 공격한 횟수가 3번 이상이라면 이 공격이 끝날 때까지 돌파를 얻는다.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 3 },
            action: { type: 'BREAKTHROUGH', params: { mode: 'ALL' } },
            duration: 'BATTLE_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "ST10-012": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 듀얼리스트",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'APPLY_DUALIST_MARK', params: {} }
        }
    ],
    "ST10-013": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "상대 유닛 1장을 골라 이 턴이 끝날 때까지 파워-1000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -1000 } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 자신 유닛을 1장 골라 트래시할 수 있다.",
            condition: { type: 'CONTEXT_FLAG', value: { key: 'LAST_EFFECT_SKIPPED_NO_TARGET', equals: false } },
            optional: true,
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_UNIT', params: {} }
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "상대 유닛을 고르지 못했다면 필드에 있는 자신 유닛을 1장 골라 트래시한다.",
            condition: { type: 'CONTEXT_FLAG', value: { key: 'LAST_EFFECT_SKIPPED_NO_TARGET', equals: true } },
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_UNIT', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "ST10-014": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "코스트 합이 자신의 패 장수 이하가 되도록 트래시 존에서 이 카드 이외의 카드를 2장까지 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 2,
                filters: [{ type: 'EXCLUDE_CARD_ID', value: 'ST10-014' }],
                totalCostLimit: { type: 'MY_HAND_COUNT' },
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: { allowPartialSelection: true } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "자신의 트래시 존에서 코스트가 자신의 리더 레벨 이하인 스킬 카드 1장을 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.SKILL },
                    { type: 'COST_LIMIT_BY_LEADER_LEVEL' }
                ],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    "ST10-015": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 트래시 존에서 유닛 카드 1장을 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [{ type: 'UNIT_TYPE', value: CardType.UNIT }],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    "ST10-016": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신은 이 턴이 끝날 때까지 〈피의 기사〉를 발동할 수 없다.",
            action: { type: 'LOCK_SKILL_ID_UNTIL_TURN_END', params: { skillId: 'ST10-016' } }
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 자신 유닛 1장을 고른다. 그 유닛은 이 턴이 끝날 때까지 어태커: 조우 유닛을 트래시한다를 얻는다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: "어태커 : 조우 유닛을 트래시한다.",
                        action: { type: 'DESTROY_ENCOUNTER', params: {} },
                        duration: 'TURN_END'
                    }
                }
            },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "ST10-017": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 이 유닛의 효과로 자신 유닛의 공격 횟수를 참조할 때 1번 더 한 것으로 취급한다.",
            action: { type: 'NONE', params: { attackCountReferenceBonus: 1 } }
        }
    ],
};
