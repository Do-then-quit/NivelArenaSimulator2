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
};
