import { Effect, ActivationCondition, CardType } from '../types';

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
            targets: { scope: 'MY_FIELD', type: 'UNIT', filters: [{ type: 'HAS_KEYWORD', value: '어태커' }, { type: 'HAS_KEYWORD', value: '관통' }], selectMode: 'ALL', count: 0 },
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
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 어태커 : 를 가진 유닛을 1장 골은다. 그 유닛은 어태커 : 관통[1] 을 얻는다.",
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
            activation: ActivationCondition.ACTIVE,
            description: "이 턴이 끝날 때까지 필드에 있는 모든 상대 유닛의 파워-1000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: -1000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-022": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛을 2장까지 골라, 이 턴이 끝날 때까지 파워-2000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', selectMode: 'MANUAL', count: 2 },
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-023": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "이 턴이 끝날 때까지 필드에 있는 어태커 : 를 가진 모든 자신 유닛의 파워+2500.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', filters: [{ type: 'HAS_KEYWORD', value: '어태커' }], selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 2500 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-024": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-3000. 이 효과로 그 유닛을 트래시했다면 카드를 1장 드로우한다.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', selectMode: 'MANUAL', count: 1 },
            action: { type: 'BUFF_POWER_AND_DRAW_IF_TRASHED', params: { value: -3000, drawCount: 1 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-025": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 트래시 존에서 어태커 : 를 가진 유닛을 1장 골라 자신의 패에 넣는다.",
            targets: { scope: 'MY_TRASH', type: 'UNIT', filters: [{ type: 'HAS_KEYWORD', value: '어태커' }], selectMode: 'MANUAL', count: 1 },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    "BT01-026": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 관통[1]",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
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
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 약탈[1]",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'PLUNDER', params: { value: 1 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-028": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 5 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "각성면 패시브 : 필드에 있는 《베이스》를 가진 모든 자신 유닛의 파워+1000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', filters: [{ type: 'HAS_TRAIT', value: '베이스' }], selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    "BT01-029": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 상대의 턴이 끝날 때까지 파워+1000.",
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
            duration: 'OPP_TURN_END'
        }
    ],
    "BT01-030": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 전선구축[파워+3000]",
            condition: { type: 'FRONTLINE' as any },
            action: { type: 'BUFF_POWER', params: { value: 3000 } }
        }
    ],
    "BT01-032": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 이 유닛의 파워가 필드에 있는 《베이스》를 가진 자신 유닛의 수×500만큼 증가한다.",
            action: { type: 'BUFF_POWER', params: { value: 500, dynamic: 'BASE_UNIT_COUNT_MULTIPLIER' } }
        }
    ],
    "BT01-033": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 이 턴이 끝날 때까지 히트+1.",
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-034": [
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "BT01-035": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 돌파[1코스트 이하]",
            action: { type: 'BREAKTHROUGH', params: { costMax: 1 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-036": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 필드에 있는 《베이스》를 가진 모든 자신 유닛의 파워+2000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', filters: [{ type: 'HAS_TRAIT', value: '베이스' }], selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    "BT01-037": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 전선구축[히트+1]",
            condition: { type: 'FRONTLINE' as any },
            action: { type: 'BUFF_HIT', params: { value: 1 } }
        }
    ],
    "BT01-038": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "액티브메인 : 자신의 패를 1장 골라 트래시한다. 그러면 필드에 있는 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 파워+4000.",
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'MANUAL', count: 1 },
            action: { type: 'BUFF_POWER', params: { value: 4000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-039": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 상대의 턴이 끝날 때까지 파워+3000.",
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'OPP_TURN_END'
        }
    ],
    "BT01-040": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 이 유닛의 파워가 자신의 리더 레벨×500만큼 증가한다.",
            action: { type: 'BUFF_POWER', params: { value: 500, dynamic: 'LEADER_LEVEL_MULTIPLIER' } }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 레벨링크[10: 히트+1]",
            condition: { type: 'LEVEL_LINK' as any, value: 10 },
            action: { type: 'BUFF_HIT', params: { value: 1 } }
        }
    ],
    "BT01-041": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 필드에 있는 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 파워+2000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'MANUAL', count: 1 },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-044": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 덱 맨 위에서 카드를 3장 공개하고, 그 중 《베이스》를 가진 유닛을 1장 골라 자신의 패에 넣는다.",
            action: { type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND', params: { count: 3, filter: { type: 'HAS_TRAIT', value: '베이스' } } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다. 자신의 리더 레벨+1.",
            action: { type: 'GAIN_LEVEL', params: { value: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ],
    "BT01-045": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 필드에 있는 1코스트인 모든 자신 유닛의 파워+2000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', filters: [{ type: 'COST_LIMIT', value: 1 }], selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    "BT01-046": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 필드에 있는 《베이스》를 가진 자신 유닛을 1장 고른다. 그 유닛은 어태커 : 돌파[3코스트 이하]를 얻는다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', filters: [{ type: 'HAS_TRAIT', value: '베이스' }], selectMode: 'MANUAL', count: 1 },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: "어태커 : 돌파[3코스트 이하]",
                        action: { type: 'BREAKTHROUGH', params: { costMax: 3 } },
                        duration: 'TURN_END'
                    }
                }
            },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "BT01-047": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 《베이스》를 가진 1코스트인 자신 유닛을 1장 곤른다. 이 턴이 끝날 때까지 그 유닛의 히트가 2가 된다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', filters: [{ type: 'HAS_TRAIT', value: '베이스' }, { type: 'COST_LIMIT', value: 1 }], selectMode: 'MANUAL', count: 1 },
            action: { type: 'BUFF_HIT', params: { value: 2, mode: 'SET' } },
            duration: 'TURN_END'
        }
    ],
    "BT01-048": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "현재 필드에 있는 모든 자신 유닛은 상대의 턴이 끝날 때까지 파워+500.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 500 } },
            duration: 'OPP_TURN_END'
        }
    ],
    "BT01-049": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 《베이스》를 가진 자신 유닛의 수만큼 카드를 드로우한다.",
            action: { type: 'DRAW_DYNAMIC', params: { multiplier: 'BASE_UNIT_COUNT' } }
        }
    ],
    "BT01-050": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 모든 유닛 존에 유닛이 존재한다면 현재 필드에 있는 모든 자신 유닛은 상대의 턴이 끝날 때까지 파워+1500.",
            condition: { type: 'FRONTLINE' as any },
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 1500 } },
            duration: 'OPP_TURN_END'
        }
    ],
    "BT01-051": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 덱 맨 위에서 카드를 3장 공개하고, 그 중 3코스트 이하인 카드를 모두 자신의 패에 넣는다.",
            action: { type: 'REVEAL_TOP_AND_TAKE_ALL_BY_FILTER', params: { count: 3, filter: { type: 'COST_LIMIT', value: 3 } } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다. 필드에 있는 3코스트 이하인 상대 유닛을 1장 골라 트래시한다.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', filters: [{ type: 'COST_LIMIT', value: 3 }], selectMode: 'MANUAL', count: 1 },
            action: { type: 'DESTROY_UNIT', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ],
    "BT01-052": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "현재 필드에 있는 《베이스》를 가진 모든 자신 유닛은 이 턴이 끝날 때까지 히트+1.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', filters: [{ type: 'HAS_TRAIT', value: '베이스' }], selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-053": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 돌파[2코스트 이하]",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BREAKTHROUGH', params: { costMax: 2 } },
            duration: 'TURN_END'
        }
    ],
    "BT01-054": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 없음 : 파워+5000.",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 5000 } }
        }
    ],
    "BT01-055": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 5 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.UNIT_TRASHED,
            condition: { type: 'ONCE_PER_TURN', trashedUnitCostMin: 5, friendlyOnly: true },
            description: "각성면 패시브 : 자신과 상대의 턴마다 한 번씩, 필드에서 5코스트 이상인 자신 유닛이 트래시되면 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } },
            targets: { scope: 'MY_LEADER', type: 'LEADER', selectMode: 'ALL' }
        }
    ],
    "BT01-056": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-2000.",
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' }
        }
    ],
    "BT01-057": [], // Vanilla
    "BT01-058": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 종결 (방어 선언 즉시 상대의 이번 공격을 종료하고 이 유닛을 트래시한다).",
            action: { type: 'TERMINATE_ATTACK', params: {} }
        }
    ],
    "BT01-059": [], // Vanilla
    "BT01-060": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 이 유닛으로 공격하려면 자신의 패를 1장 골라 트래시해야 한다.",
            action: { type: 'NONE', params: {} }
        }
    ],
    "BT01-061": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "액티브메인 : 필드에 있는 자신 유닛을 2장 골라 그 중 1장을 트래시한다. 다른 유닛 1장은 이 턴이 끝날 때까지 파워+2000.",
            action: { type: 'SACRIFICE_TO_BUFF', params: { powerValue: 2000 } },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 2,
                selectMode: 'MANUAL',
            }
        }
    ],
    "BT01-062": [], // Vanilla
    "BT01-063": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 필드에 있는 엑시트 : 공멸 을 가진 모든 자신 유닛의 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                filters: [{ type: 'HAS_KEYWORD', value: '공멸' }],
                selectMode: 'ALL'
            }
        }
    ],
    "BT01-064": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 패를 2장 골라 트래시할 수 있다. 트래시했다면 조우 유닛을 트래시한다.",
            cost: { type: 'TRASH_HAND', amount: 2 },
            action: { type: 'DESTROY_ENCOUNTER', params: {} },
            optional: true
        }
    ],
    "BT01-065": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 이 유닛으로 공격하려면 자신의 패를 1장 골라 트래시해야 한다.",
            action: { type: 'NONE', params: {} }
        }
    ],
    "BT01-066": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 상대의 패가 3장 이상이라면 상대는 상대의 패를 1장 골라 트래시해야 한다.",
            condition: { type: 'OPPONENT_HAND_COUNT', value: 3 },
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } },
            targets: { scope: 'OPP_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' }
        }
    ],
    "BT01-067": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 공멸 (이 유닛을 전투로 트래시한 상대 유닛의 코스트가 이 유닛의 코스트 이하라면 그 유닛을 트래시한다).",
            action: { type: 'MUTUAL_DESTRUCTION', params: {} }
        }
    ],
    "BT01-068": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 카드를 2장 드로우한다.",
            action: { type: 'DRAW', params: { count: 2 } }
        },
        {
            activation: ActivationCondition.EXIT,
            description: "그 중 1장을 골라 트래시한다.",
            action: { type: 'DISCARD', params: { target: 'SELF', count: 1 } },
            targets: { scope: 'LAST_DRAWN', type: 'CARD', count: 1, selectMode: 'MANUAL' }
        }
    ],
    "BT01-069": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 조우 유닛이 2코스트 이하라면 그 유닛을 트래시한다.",
            action: { type: 'DESTROY_ENCOUNTER', params: { costMax: 2 } }
        }
    ],
    "BT01-070": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 종결 (방어 선언 즉시 상대의 이번 공격을 종료하고 이 유닛을 트래시한다).",
            action: { type: 'TERMINATE_ATTACK', params: {} }
        }
    ],
    "BT01-071": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 필드에 있는 자신 유닛을 1장 골라 트래시한다.",
            action: { type: 'DESTROY_UNIT', params: {} },
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' }
        },
        {
            activation: ActivationCondition.ENTRY,
            description: "그 후, 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 : 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "BT01-072": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 필드에 있는 다른 모든 자신 유닛은 「 엑시트 : 카드를 1장 드로우한다 」 를 얻는다.",
            action: {
                type: 'GRANT_EFFECT', params: {
                    effect: {
                        activation: ActivationCondition.EXIT,
                        description: "엑시트 : 카드를 1장 드로우한다.",
                        action: { type: 'DRAW', params: { count: 1 } }
                    }
                }
            },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                filters: [{ type: 'EXCLUDE_SELF' }],
                selectMode: 'ALL'
            }
        }
    ],
    "BT01-073": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 패에 조우 유닛보다 코스트가 높은 유닛을 1장 골라 트래시할 수 있다. 트래시했다면 조우 유닛을 트래시한다.",
            cost: {
                type: 'TRASH_HAND',
                amount: 1,
                cardTypeFilter: CardType.UNIT
            },
            condition: { type: 'COST_COMPARISON', value: { operator: 'HIGHER_THAN_ENCOUNTER' } as any },
            action: { type: 'DESTROY_ENCOUNTER', params: {} },
            optional: true
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 : 이 카드를 트래시한다. 상대의 패가 3장 이상이라면 상대는 상대의 패를 1장 골라 트래시한다.",
            condition: { type: 'OPPONENT_HAND_COUNT', value: 3 },
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } },
            targets: { scope: 'OPP_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' }
        }
    ],
    "BT01-074": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 필드에서 유닛을 1장 골라 트래시한다. 그 유닛의 히트만큼 카드를 드로우한다.",
            action: { type: 'DESTROY_UNIT_AND_DRAW_BY_HIT', params: {} } as any,
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 : 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "BT01-075": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 자신의 패를 1장 골라 트래시한다. 그 카드와 같은 코스트를 가진 유닛을 필드에서 1장 골라 트래시한다.",
            cost: { type: 'TRASH_HAND', amount: 1 },
            action: { type: 'DESTROY_UNIT', params: {} },
            targets: {
                scope: 'BOTH_FIELDS',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_EQUAL' } as any],
                selectMode: 'MANUAL'
            }
        }
    ],
    "BT01-076": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 필드에 있는 엑시트 : 공멸 을 가진 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 파워+4500.",
            action: { type: 'BUFF_POWER', params: { value: 4500 } },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                filters: [{ type: 'HAS_KEYWORD', value: '공멸' }],
                selectMode: 'MANUAL'
            }
        }
    ],
    "BT01-077": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 필드에 있는 유닛을 1장 골라 그 유닛의 히트만큼 자신의 패를 트래시한다. 그러면 그 유닛을 트래시한다.",
            action: { type: 'DESTROY_UNIT_WITH_HIT_COST', params: {} } as any,
            targets: { scope: 'BOTH_FIELDS', type: 'UNIT', count: 1, selectMode: 'MANUAL' }
        }
    ],
    "BT01-078": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 고른 유닛의 코스트 합이 4코스트 이하가 되도록 필드에 있는 상대 유닛을 2장까지 골라 트래시한다.",
            action: { type: 'DESTROY_UNIT', params: {} },
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 2,
                totalCostLimit: 4,
                selectMode: 'MANUAL'
            }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 : 이 카드를 트래시한다. 자신의 트래시 존에서 엑시트 : 를 가진 유닛을 1장 골라 자신의 패에 넣는다.",
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
            targets: {
                scope: 'MY_TRASH',
                type: 'UNIT',
                filters: [{ type: 'HAS_KEYWORD', value: '엑시트' }],
                count: 1,
                selectMode: 'MANUAL'
            }
        }
    ],
    "BT01-079": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 자신의 트래시 존에서 엑시트 : 를 가진 2코스트 이하인 유닛을 2장까지 골라 자신의 패에 넣는다.",
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
            targets: {
                scope: 'MY_TRASH',
                type: 'UNIT',
                filters: [
                    { type: 'HAS_KEYWORD', value: '엑시트' },
                    { type: 'COST_EQUAL', value: 2 } as any // Simplified for 2 or less
                ],
                count: 2,
                selectMode: 'MANUAL'
            }
        }
    ],
    "BT01-080": [
        {
            activation: ActivationCondition.EXIT,
            description: "장착조건 없음 : 엑시트 : 카드를 2장 드로우한다.",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'DRAW', params: { count: 2 } }
        }
    ],
    "BT01-081": [
        {
            activation: ActivationCondition.EXIT,
            description: "장착 조건: 엑시트를 가진 유닛 엑시트 : 귀환 (이 턴이 끝날 때 이 유닛을 자신의 트래시 존에서 자신의 패로 되돌린다).",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'RETURN_FROM_TRASH_AT_TURN_END', params: {} }
        }
    ],
};
