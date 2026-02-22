import { ActivationCondition, CardType, Effect } from '../types';

export const ST11_EFFECTS: Record<string, Effect[]> = {
    "ST11-001": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 5 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "각성면 액티브 메인 : 자신의 스킬 존에 있는 스킬이 1장 이상이라면 자신의 트래시 존에서 스킬 존 개수보다 코스트가 낮은 스킬 카드를 1장 패에 넣는다.",
            condition: { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.SKILL },
                    { type: 'COST_LOWER_THAN_SKILL_ZONE_COUNT' }
                ],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    "ST11-002": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 이 유닛은 공격할 수 없다.",
            action: { type: 'NONE', params: { cannotAttack: true } }
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+1000.",
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    "ST11-003": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } }
        },
        {
            activation: ActivationCondition.ENTRY,
            description: "그러면 자신의 패를 1장 골라 트래시한다.",
            targets: { scope: 'MY_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'SELF', count: 1 } }
        }
    ],
    "ST11-004": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 덱 맨 위에서 3장을 공개하고 그중 버프를 가진 유닛 1장을 패에 넣고 나머지는 모두 트래시한다.",
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 3,
                    remainingDestination: 'TRASH',
                    filters: [
                        { type: 'UNIT_TYPE', value: CardType.UNIT },
                        { type: 'HAS_KEYWORD', value: '버프' }
                    ]
                }
            }
        }
    ],
    "ST11-005": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+3000.",
            action: { type: 'BUFF_POWER', params: { value: 3000 } }
        }
    ],
    "ST11-006": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } }
        }
    ],
    "ST11-007": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 필드에 있는 디펜더를 가진 모든 자신 유닛의 파워+1500.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'HAS_KEYWORD', value: '디펜더' }],
                selectMode: 'ALL'
            },
            action: { type: 'BUFF_POWER', params: { value: 1500 } }
        }
    ],
    "ST11-008": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "가디언 : 방벽[1]",
            action: { type: 'NONE', params: { guardianBarrierCost: 1 } }
        }
    ],
    "ST11-009": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "가디언 : 방벽[1]",
            action: { type: 'NONE', params: { guardianBarrierCost: 1 } }
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "버프 1 액티브 메인 : 스킬 존에 스킬이 1장 이상이면 필드의 모든 자신 유닛은 상대 턴 종료까지 디펜더 이 방어가 끝날 때까지 파워+2000을 얻는다.",
            condition: { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.DEFENDER,
                        description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
                        action: { type: 'BUFF_POWER', params: { value: 2000 } },
                        duration: 'BATTLE_END'
                    }
                }
            },
            duration: 'OPP_TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "ST11-010": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "버프 1 액티브 메인 : 스킬 존에 스킬이 1장 이상이면 필드에 있는 히트가 1 이하인 상대 유닛 1장은 상대 턴 종료까지 공격할 수 없다.",
            condition: { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HIT_LIMIT', value: 1 }],
                selectMode: 'MANUAL'
            },
            action: { type: 'LOCK_ATTACK_UNTIL_TURN_END', params: {} }
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    "ST11-011": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "가디언 : 방벽[2]",
            action: { type: 'NONE', params: { guardianBarrierCost: 2 } }
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "버프 1 액티브 메인 : 스킬 존에 스킬이 1장 이상이면 필드에 있는 모든 자신 유닛은 상대 턴 종료까지 파워+2000.",
            condition: { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'OPP_TURN_END'
        }
    ],
    "ST11-012": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "버프 1 액티브 메인 : 스킬 존에 스킬이 1장 이상이면 상대 턴 종료까지 어태커 돌파[4코스트 이하]를 얻는다.",
            condition: { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: "어태커 : 돌파[4코스트 이하]",
                        action: { type: 'BREAKTHROUGH', params: { costMax: 4 } },
                        duration: 'TURN_END'
                    }
                }
            },
            duration: 'OPP_TURN_END'
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 침투[1]",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'APPLY_INFILTRATION_MARK', params: {} },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "필드에 있는 상대 유닛 중 코스트가 가장 낮은 유닛을 1장 골라 그 유닛과 장착 아이템을 모두 주인의 패로 되돌린다.",
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'LOWEST_COST_ONLY' }],
                selectMode: 'MANUAL'
            },
            action: { type: 'RETURN_UNIT_AND_ITEMS_TO_HAND', params: {} }
        }
    ],
    "ST11-013": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 자신 유닛 1장을 골라 상대 턴 종료까지 파워+1000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
            duration: 'OPP_TURN_END'
        }
    ],
    "ST11-014": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "카드를 2장 드로우한다.",
            action: { type: 'DRAW', params: { count: 2 } }
        }
    ],
    "ST11-015": [
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
    "ST11-016": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛 1장을 고른다. 그 유닛은 이 턴이 끝날 때까지 공격을 방어할 수 없다.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: "패시브 : 이 유닛은 공격을 방어할 수 없다.",
                        action: { type: 'NONE', params: { cannotBlock: true } },
                        duration: 'TURN_END'
                    }
                }
            },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "자신의 트래시 존에서 코스트가 자신의 리더 레벨 이하인 유닛 카드 1장을 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'COST_LIMIT_BY_LEADER_LEVEL' }
                ],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    "ST11-017": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "액티브 메인 : 카드를 1장 드로우한다. 그러면 상대는 카드를 1장 드로우한다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'DRAW', params: { count: 1 } },
                        { type: 'DRAW', params: { count: 1, target: 'OPPONENT' } }
                    ]
                }
            }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "필드에 있는 상대 유닛 중 코스트가 가장 낮은 유닛을 1장 골라 그 유닛과 장착 아이템을 모두 주인의 패로 되돌린다.",
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'LOWEST_COST_ONLY' }],
                selectMode: 'MANUAL'
            },
            action: { type: 'RETURN_UNIT_AND_ITEMS_TO_HAND', params: {} }
        }
    ]
};
