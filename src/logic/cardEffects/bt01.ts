import { Effect, ActivationCondition } from '../types';

export const BT01_EFFECTS: Record<string, Effect[]> = {
    "BT01-001": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 6 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 6 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "각성면 패시브 : 자신의 턴 동안 필드에 있는 어태커 : 를 가진 모든 자신 유닛의 파워+2000.",
            condition: { type: 'YOUR_TURN' },
            targets: { scope: 'MY_FIELD', type: 'UNIT', filters: [{ type: 'HAS_KEYWORD', value: '어태커' }], selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    "BT01-002": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-004": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 관통[1]",
            action: { type: 'PENETRATION', params: { value: 1 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-006": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 약탈[1]",
            action: { type: 'PLUNDER', params: { value: 1 } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-5000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', selectMode: 'MANUAL', count: 1 },
            action: { type: 'BUFF_POWER', params: { value: -5000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-008": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 필드에 있는 어태커 : 관통 을 가진 모든 자신 유닛의 파워+1500.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', filters: [{ type: 'HAS_KEYWORD', value: '관통' }], selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 1500 } }
        }
    ],
    "BT01-009": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+1000.",
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-011": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "액티브메인 : 필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-1500.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', selectMode: 'MANUAL', count: 1 },
            action: { type: 'BUFF_POWER', params: { value: -1500 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-012": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 이 턴이 끝날 때까지 필드에 있는 모든 자신 유닛은 「 어태커 : 이 공격이 끝날 때까지 파워+1000 」 을 얻는다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'ALL', count: 0 },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: "어태커 : 파워+1000",
                        action: { type: 'BUFF_POWER', params: { value: 1000 } },
                        duration: 'TURN_END'
                    }
                }
            },
            duration: 'TURN_END'
        }
    ],
    "BT01-013": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+1000.",
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-014": [
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "자신의 트래시 존에서 2코스트 이하인 유닛을 1장 골라 자신의 패에 넣는다.",
            targets: { scope: 'MY_TRASH', type: 'UNIT', filters: [{ type: 'COST_LIMIT', value: 2 }], selectMode: 'MANUAL', count: 1 },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    "BT01-015": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 이 턴이 끝날 때까지 조우 유닛의 파워-4000.",
            targets: { scope: 'ENCOUNTER_UNIT', type: 'UNIT', selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: -4000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-016": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-017": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 이 턴이 끝날 때까지 조우 유닛의 파워가 1000이 된다.",
            targets: { scope: 'ENCOUNTER_UNIT', type: 'UNIT', selectMode: 'ALL', count: 0 },
            action: { type: 'SET_POWER', params: { value: 1000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-018": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 필드에 있는 어태커 : 를 가진 모든 자신 유닛의 파워+2000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', filters: [{ type: 'HAS_KEYWORD', value: '어태커' }], selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    "BT01-019": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 이 턴이 끝날 때까지 필드에 있는 모든 자신 유닛은 어태커 : 관통[1] 을 얻는다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'ALL', count: 0 },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: "어태커 : 관통[1]",
                        action: { type: 'PENETRATION', params: { value: 1 } },
                        duration: 'TURN_END'
                    }
                }
            },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "BT01-020": [
        {
            activation: ActivationCondition.ENTRY,
            description: "필드에 있는 어태커 : 를 가진 유닛을 1장 고른다. 그 유닛은 어태커 : 관통[1] 을 얻는다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', filters: [{ type: 'HAS_KEYWORD', value: '어태커' }], selectMode: 'MANUAL', count: 1 },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: "어태커 : 관통[1]",
                        action: { type: 'PENETRATION', params: { value: 1 } },
                        duration: 'TURN_END'
                    }
                }
            },
            duration: 'TURN_END'
        }
    ],
    "BT01-021": [
        {
            activation: ActivationCondition.ENTRY,
            description: "이 턴이 끝날 때까지 필드에 있는 모든 상대 유닛의 파워-1000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: -1000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-022": [
        {
            activation: ActivationCondition.ENTRY,
            description: "필드에 있는 상대 유닛을 2장까지 골라, 이 턴이 끝날 때까지 파워-2000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', selectMode: 'MANUAL', count: 2 },
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-023": [
        {
            activation: ActivationCondition.ENTRY,
            description: "이 턴이 끝날 때까지 필드에 있는 어태커 : 를 가진 모든 자신 유닛의 파워+2500.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', filters: [{ type: 'HAS_KEYWORD', value: '어태커' }], selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 2500 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-024": [
        {
            activation: ActivationCondition.ENTRY,
            description: "필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-3000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', selectMode: 'MANUAL', count: 1 },
            action: { type: 'BUFF_POWER', params: { value: -3000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-025": [
        {
            activation: ActivationCondition.ENTRY,
            description: "자신의 트래시 존에서 어태커 : 를 가진 유닛을 1장 골라 자신의 패에 넣는다.",
            targets: { scope: 'MY_TRASH', type: 'UNIT', filters: [{ type: 'HAS_KEYWORD', value: '어태커' }], selectMode: 'MANUAL', count: 1 },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    "BT01-026": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "어태커 : 관통[1]",
            action: { type: 'PENETRATION', params: { value: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "BT01-027": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 약탈[1]",
            action: { type: 'PLUNDER', params: { value: 1 } },
            duration: 'TURN_END'
        }
    ]
};
