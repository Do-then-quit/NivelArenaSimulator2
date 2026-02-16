import { Effect, ActivationCondition } from '../types';

export const ST04_EFFECTS: Record<string, Effect[]> = {
    "ST04-001": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 4 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 4 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "각성면 패시브 : 필드에 있는 모든 자신 유닛은 상대의 턴 동안 파워+1000.",
            condition: { type: 'OPPONENT_TURN' },
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    "ST04-003": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "가디언 : 방벽[1]",
            action: { type: 'NONE', params: { guardianBarrierCost: 1 } }
        }
    ],
    "ST04-005": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } }
        }
    ],
    "ST04-006": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+3000.",
            action: { type: 'BUFF_POWER', params: { value: 3000 } }
        }
    ],
    "ST04-007": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 돌파[4코스트 이상]",
            action: { type: 'BREAKTHROUGH', params: { costMin: 4 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "ST04-008": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "가디언 : 방벽[2]",
            action: { type: 'NONE', params: { guardianBarrierCost: 2 } }
        }
    ],
    "ST04-010": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 필드에 있는 가디언 : 을 가진 모든 자신 유닛의 파워+2000.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                selectMode: 'ALL',
                count: 0,
                filters: [{ type: 'HAS_KEYWORD', value: '가디언' }]
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    "ST04-011": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "가디언 : 방벽[3]",
            action: { type: 'NONE', params: { guardianBarrierCost: 3 } }
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    "ST04-012": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 가디언 : 을 가진 자신 유닛을 1장 골라, 상대의 턴이 끝날 때까지 파워+2000.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'HAS_KEYWORD', value: '가디언' }]
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'OPP_TURN_END'
        }
    ],
    "ST04-013": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 가디언 : 을 가진 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 히트+1.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'HAS_KEYWORD', value: '가디언' }]
            },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } }
        }
    ],
    "ST04-014": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "카드를 2장 드로우한다.",
            action: { type: 'DRAW', params: { count: 2 } }
        }
    ],
    "ST04-015": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 가디언 : 을 가진 자신 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 어태커 : 돌파를 얻는다.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'HAS_KEYWORD', value: '가디언' }]
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: "어태커 : 돌파",
                        action: { type: 'BREAKTHROUGH', params: { mode: 'ALL' } },
                        duration: 'TURN_END'
                    }
                }
            },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 필드에 있는 상대 유닛 중 코스트가 가장 낮은 유닛을 1장 골라 그 유닛과 그 유닛이 장착한 아이템을 모두 주인의 패로 되돌린다.",
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'LOWEST_COST_ONLY' }]
            },
            action: { type: 'RETURN_UNIT_AND_ITEMS_TO_HAND', params: {} }
        }
    ],
    "ST04-016": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "장착조건 없음 : 디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    "ST04-017": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 디펜더",
            condition: { type: 'HAS_KEYWORD', value: '디펜더' },
            action: { type: 'NONE', params: {} }
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "액티브메인 : 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ]
};
