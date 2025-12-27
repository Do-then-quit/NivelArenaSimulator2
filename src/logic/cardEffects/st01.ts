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
    ],
    "ST01-010": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "엑티브메인 : 자신의 패를 1장 골라 덱에 넣고 섞는다. 그러면 이 턴이 끝날 때까지 조우 유닛의 파워-3000.",
            cost: { type: 'NONE' }, // Cost selection handled by Action if we want it to be part of effect
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -3000 } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다. 필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-5000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -5000 } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ],
    "ST01-011": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 관통[1]",
            action: { type: 'PENETRATION', params: { value: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }],
    "ST01-012": [
        {
            activation: ActivationCondition.ENTRY, // Skills use ENTRY or special TRIGGER for activation
            description: "필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-2000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            duration: 'TURN_END'
        }
    ],
    "ST01-013": [
        {
            activation: ActivationCondition.ENTRY,
            description: "자신의 트래시 존에서 2코스트 이하인 유닛을 1장 골라 자신의 패에 넣는다.",
            targets: { 
                scope: 'SELF', // Scope is usually handled specifically for Trash in TargetSelector if not standard
                type: 'CARD', 
                count: 1, 
                selectMode: 'MANUAL', 
                conditions: { costMax: 2 } 
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: { costMax: 2 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다. 자신의 트래시 존에서 2코스트 이하인 유닛을 1장 골라 자신의 패에 넣는다.",
            targets: { scope: 'SELF', type: 'CARD', count: 1, selectMode: 'MANUAL', conditions: { costMax: 2 } },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: { costMax: 2 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ]
};
