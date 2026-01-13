import { Effect, ActivationCondition } from '../types';

export const ST03_EFFECTS: Record<string, Effect[]> = {
    "ST03-001": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 4 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 4 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "각성면 패시브 : 필드에 있는 엑시트 : 를 가진 모든 자신 유닛의 파워+1000.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                selectMode: 'ALL',
                filters: [{ type: 'HAS_KEYWORD', value: '엑시트' }]
            },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    "ST03-003": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 상대는 상대의 패를 1장 골라 트래시한다.",
            targets: { scope: 'OPP_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다. 상대의 패가 3장 이상이라면 상대는 상대의 패를 1장 골라 트래시한다.",
            condition: { type: 'OPPONENT_HAND_COUNT', value: 3 },
            targets: { scope: 'OPP_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ],
    "ST03-005": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 조우 유닛이 1코스트 이하라면 그 유닛을 트래시한다.",
            targets: { scope: 'ENCOUNTER_UNIT', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'DESTROY_UNIT', params: { costMax: 1 } }
        }
    ],
    "ST03-006": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } }
        }
    ],
    "ST03-007": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 공멸 (이 유닛을 전투로 트래시한 상대 유닛의 코스트가 이 유닛의 코스트 이하라면 그 유닛을 트래시한다).",
            action: { type: 'MUTUAL_DESTRUCTION', params: {} }
        }
    ],
    "ST03-008": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 필드에 있는 엑시트 : 를 가진 모든 자신 유닛의 파워+1000.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                selectMode: 'ALL',
                filters: [{ type: 'HAS_KEYWORD', value: '엑시트' }]
            },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    "ST03-010": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 자신의 트래시 존에서 엑시트 : 를 가진 2코스트 이하인 유닛을 1장 골라 자신의 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
                filters: [
                    { type: 'HAS_KEYWORD', value: '엑시트' },
                    { type: 'COST_LIMIT', value: 2 }
                ]
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다. 상대의 패가 3장 이상이라면 상대는 상대의 패를 1장 골라 트래시한다.",
            condition: { type: 'OPPONENT_HAND_COUNT', value: 3 },
            targets: { scope: 'OPP_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ],
    "ST03-011": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 패를 모두 트래시할 수 있다. 2장 이상 트래시했다면 조우 유닛을 트래시한다.",
            optional: true,
            action: { type: 'DISCARD_ALL', params: {} }
        },
        {
            activation: ActivationCondition.ENTRY,
            description: "(2장 이상 트래시했다면 조우 유닛을 트래시한다)",
            condition: { type: 'DISCARDED_COUNT' as any, value: 2 },
            targets: { scope: 'ENCOUNTER_UNIT', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'DESTROY_UNIT', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "ST03-012": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 패를 1장 골라 트래시한다. 그러면 상대는 패를 1장 골라 트래시한다.",
            targets: { scope: 'MY_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'PLAYER', count: 1 } }
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "(그러면 상대는 패를 1장 골라 트래시한다)",
            targets: { scope: 'OPP_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } }
        }
    ],
    "ST03-013": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 패에서 유닛을 1장 골라 트래시한다. 그 유닛보다 코스트가 낮은 유닛을 필드에서 1장 골라 트래시한다.",
            cost: { type: 'TRASH_HAND', amount: 1, cardTypeFilter: 'UNIT' as any },
            targets: {
                scope: 'BOTH_FIELDS',
                type: 'UNIT',
                selectMode: 'MANUAL',
                count: 1,
                filters: [{ type: 'COST_LOWER_THAN_COST_PAYMENT' }]
            },
            action: { type: 'DESTROY_UNIT', params: {} }
        }
    ],
    "ST03-014": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 자신 유닛을 1장 골라 트래시한다. 그러면 카드를 2장 드로우한다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_UNIT', params: {} }
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "(그러면 카드를 2장 드로우한다)",
            action: { type: 'DRAW', params: { count: 2 } }
        }
    ],
    "ST03-015": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 자신 유닛을 1장 골라, 그 유닛과 조우 유닛을 모두 트래시한다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_UNIT', params: { alsoDestroyEncounter: true } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다. 자신의 트래시 존에서 엑시트 : 를 가진 유닛을 1장 골라 자신의 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'HAS_KEYWORD', value: '엑시트' }]
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ],
    "ST03-016": [
        {
            activation: ActivationCondition.PASSIVE, // Item Passive
            description: "장착조건 없음 : 파워+3000.",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 3000 } }
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 종결 (방어 선언 즉시 상대의 이번 공격을 종료하고 이 유닛을 트래시한다).",
            action: { type: 'TERMINATE_ATTACK', params: {} }
        }
    ],
    "ST03-017": [
        {
            activation: ActivationCondition.EXIT,
            description: "장착조건 없음 : 엑시트 : 공멸 (이 유닛을 전투로 트래시한 상대 유닛의 코스트가 이 유닛의 코스트 이하라면 그 유닛을 트래시한다).",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'MUTUAL_DESTRUCTION', params: {} }
        }
    ]
};
