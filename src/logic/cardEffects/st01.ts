import { Effect, ActivationCondition } from '../types';

export const ST01_EFFECTS: Record<string, Effect[]> = {
    "ST01-001": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "각성면 패시브 : 자신의 턴 동안 필드에 있는 모든 자신 유닛의 파워+1000.",
            condition: { type: 'ALWAYS' },
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    "ST01-003": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+1000.",
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
            duration: 'TURN_END'
        }
    ],
    "ST01-005": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END'
        }
    ],
    "ST01-006": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 이 턴이 끝날 때까지 조우 유닛의 파워-3000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -3000 } },
            duration: 'TURN_END'
        }
    ],
    "ST01-007": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+1000.",
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
            duration: 'TURN_END'
        }
    ],
    "ST01-008": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 자신의 턴 동안 필드에 있는 어태커 : 를 가진 모든 자신 유닛의 파워+1000.",
            condition: { type: 'ALWAYS' },
            targets: { 
                scope: 'MY_FIELD', 
                type: 'UNIT', 
                selectMode: 'ALL',
                filters: [{ type: 'HAS_TRAIT', value: '어태커' }]
            },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ]
};
