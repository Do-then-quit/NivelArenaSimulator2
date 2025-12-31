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
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다. 상대의 패가 3장 이상이라면 상대는 상대의 패를 1장 골라 트래시한다.",
            condition: { type: 'OPPONENT_HAND_COUNT', value: 3 },
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
};
