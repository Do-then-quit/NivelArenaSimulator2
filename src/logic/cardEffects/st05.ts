import { Effect, ActivationCondition, CardType } from '../types';

export const ST05_EFFECTS: Record<string, Effect[]> = {
    "ST05-001": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 5 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "각성면 패시브 : 필드에 있는 암드 : 를 가진 모든 자신 유닛의 파워+1000.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                selectMode: 'ALL',
                count: 0,
                filters: [{ type: 'HAS_KEYWORD', value: '암드' }]
            },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    "ST05-003": [
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
    "ST05-005": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "암드 : 아이템을 장착하고 있다면 파워+1000.",
            condition: { type: 'HAS_ITEM', value: 1 },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    "ST05-006": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 덱에서 2코스트인 아이템 카드를 1장 골라 패에 넣는다. 덱을 섞는다.",
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 999,
                    filters: [
                        { type: 'UNIT_TYPE', value: CardType.ITEM },
                        { type: 'COST_EQUAL', value: 2 }
                    ]
                }
            }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 자신의 덱에서 1코스트 이하인 아이템 카드를 1장 골라 패에 넣는다. 덱을 섞는다.",
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 999,
                    filters: [
                        { type: 'UNIT_TYPE', value: CardType.ITEM },
                        { type: 'COST_LIMIT', value: 1 }
                    ]
                }
            }
        }
    ],
    "ST05-007": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "암드 : 이 유닛이 장착한 아이템 1장마다 파워+1000.",
            action: { type: 'BUFF_POWER', params: { value: 1000, dynamic: 'ITEM_COUNT_MULTIPLIER' } }
        }
    ],
    "ST05-008": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 필드에 있는 암드 : 를 가진 모든 자신 유닛의 파워+1000.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                selectMode: 'ALL',
                count: 0,
                filters: [{ type: 'HAS_KEYWORD', value: '암드' }]
            },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    "ST05-010": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "암드 : 아이템을 장착하고 있다면 파워+2000.",
            condition: { type: 'HAS_ITEM', value: 1 },
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    "ST05-011": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "암드 : 어태커 : 아이템을 장착하고 있다면 상대는 패를 1장 골라 트래시한다.",
            condition: { type: 'HAS_ITEM', value: 1 },
            targets: { scope: 'OPP_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "ST05-012": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 트래시 존에서 아이템 카드를 1장 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }]
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 자신의 덱에서 1코스트 이하인 아이템 카드를 1장 골라 패에 넣는다. 덱을 섞는다.",
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 999,
                    filters: [
                        { type: 'UNIT_TYPE', value: CardType.ITEM },
                        { type: 'COST_LIMIT', value: 1 }
                    ]
                }
            }
        }
    ],
    "ST05-013": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 자신 유닛을 1장 골라 그 유닛이 장착한 1코스트 이상인 아이템의 수만큼 카드를 드로우한다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DRAW_DYNAMIC', params: { multiplier: 'TARGET_ITEM_COUNT', costMin: 1 } }
        }
    ],
    "ST05-014": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 아이템을 2장 이상 장착한 자신 유닛을 1장 골라 트래시한다.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'ITEM_COUNT_MIN', value: 2 }]
            },
            action: { type: 'DESTROY_UNIT', params: {} }
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "그러면 필드에 있는 상대 유닛을 1장 골라 트래시한다.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_UNIT', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "카드를 2장 드로우한다.",
            action: { type: 'DRAW', params: { count: 2 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "그러면 자신의 패를 2장 골라 트래시한다.",
            targets: { scope: 'MY_HAND', type: 'CARD', count: 2, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'SELF', count: 2 } }
        }
    ],
    "ST05-015": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 없음 : 파워+1500.",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 1500 } }
        }
    ],
    "ST05-016": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 암드",
            condition: { type: 'HAS_KEYWORD', value: '암드' },
            action: { type: 'NONE', params: {} }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "히트+1.",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_HIT', params: { value: 1 } }
        }
    ],
    "ST05-017": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 없음 : 파워+2500.",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2500 } }
        }
    ]
};
