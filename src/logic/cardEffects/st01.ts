import { Effect, ActivationCondition } from '../types';

export const ST01_EFFECTS: Record<string, Effect[]> = {
    "ST01-001": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 5 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "각성면 패시브 : 자신의 턴 동안 필드에 있는 모든 자신 유닛의 파워+1000.",
            condition: { type: 'YOUR_TURN' },
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
            targets: { scope: 'ENCOUNTER_UNIT', type: 'UNIT', count: 1, selectMode: 'ALL' },
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
            condition: { type: 'YOUR_TURN' },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                selectMode: 'ALL',
                filters: [{ type: 'HAS_KEYWORD', value: '어태커' }]
            },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    "ST01-010": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "엑티브메인 : 자신의 패를 1장 골라 덱에 넣고 섞는다. 그러면 이 턴이 끝날 때까지 조우 유닛의 파워-3000.",
            cost: { type: 'SHUFFLE_HAND_TO_DECK', amount: 1 },
            targets: { scope: 'ENCOUNTER_UNIT', type: 'UNIT', count: 1, selectMode: 'ALL' },
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
            activation: ActivationCondition.ACTIVE, // Refactored from ENTRY
            description: "필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-2000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            duration: 'TURN_END'
        }
    ],
    "ST01-013": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 트래시 존에서 2코스트 이하인 유닛을 1장 골라 자신의 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'COST_LIMIT', value: 2 }]
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다. 자신의 트래시 존에서 2코스트 이하인 유닛을 1장 골라 자신의 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'COST_LIMIT', value: 2 }]
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ],
    "ST01-014": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "이 턴이 끝날 때까지 필드에 있는 모든 자신 유닛의 파워+2000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END'
        }
    ],
    "ST01-015": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-5000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -5000 } },
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
    "ST01-016": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+2000.",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END'
        }
    ],
    "ST01-017": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 약탈[1]",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'PLUNDER', params: { value: 1 } }
        }
    ]
};
