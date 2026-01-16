import { Effect, ActivationCondition } from '../types';

export const ST04_EFFECTS: Record<string, Effect[]> = {
    // ST04-001: Dorothy (Leader)
    "ST04-001": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "기본면 서약 : 자신의 덱에 파도 : 카드만 넣을 수 있다.",
            condition: { type: 'DECK_CONSTRAINT', value: '파도' },
            action: { type: 'DECK_CONSTRAINT', params: { attribute: '파도' } }
        },
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 4 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 4 },
            action: { type: 'AWAKEN', params: {} }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "각성면 패시브 : 필드에 있는 모든 자신 유닛은 상대의 턴 동안 파워+1000.",
            condition: { type: 'OPPONENT_TURN' },
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],

    // ST04-003: Marian (Guardian: Block [Cost: Trash 1 Hand])
    "ST04-003": [
        {
            activation: ActivationCondition.GUARDIAN,
            description: "가디언 : 방벽[1] (인접한 레인에 있는 상대 유닛이 공격할 때 자신의 패를 1장 트래시하면 그 유닛의 공격을 방어한다).",
            cost: { type: 'TRASH_HAND', amount: 1 },
            action: { type: 'BLOCK' as any, params: {} }
        }
    ],

    // ST04-005: Mary (Entry: Draw 1)
    "ST04-005": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } }
        }
    ],

    // ST04-006: Neon (Defender: Power +3000)
    "ST04-006": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+3000.",
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'BATTLE_END'
        }
    ],

    // ST04-007: Alice (Attacker: Breakthrough [Cost >= 4])
    "ST04-007": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 돌파[4코스트 이상] (4코스트 이상인 상대 유닛은 이 유닛의 공격을 방어할 수 없다).",
            action: { type: 'BREAKTHROUGH', params: { costMin: 4 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],

    // ST04-010: Helm (Passive: Buff Guardians +2000)
    "ST04-010": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 필드에 있는 가디언 : 을 가진 모든 자신 유닛의 파워+2000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', conditions: { hasKeyword: '가디언' }, selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],

    // ST04-011: Dorothy (Guardian + Defender)
    "ST04-011": [
        {
            activation: ActivationCondition.GUARDIAN,
            description: "가디언 : 방벽[3] (인접한 레인에 있는 상대 유닛이 공격할 때 자신의 패를 3장 트래시하면 그 유닛의 공격을 방어한다).",
            cost: { type: 'TRASH_HAND', amount: 3 },
            action: { type: 'BLOCK' as any, params: {} }
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'BATTLE_END'
        }
    ],

    // ST04-012: Senior's Cheering (Active: Buff Guardian +2000)
    "ST04-012": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 가디언 : 을 가진 자신 유닛을 1장 골라, 상대의 턴이 끝날 때까지 파워+2000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', conditions: { hasKeyword: '가디언' }, selectMode: 'MANUAL', count: 1 },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'OPP_TURN_END'
        }
    ],

    // ST04-013: Are you mad? (Active: Buff Hit +1)
    "ST04-013": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 가디언 : 을 가진 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 히트+1.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', conditions: { hasKeyword: '가디언' }, selectMode: 'MANUAL', count: 1 },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다. 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ],

    // ST04-014: Nursing (Active: Draw 2)
    "ST04-014": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "카드를 2장 드로우한다.",
            action: { type: 'DRAW', params: { count: 2 } }
        }
    ],

    // ST04-015: Paradise Lost
    "ST04-015": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 가디언 : 을 가진 자신 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 어태커 : &nbsp; 돌파를 얻는다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', conditions: { hasKeyword: '가디언' }, selectMode: 'MANUAL', count: 1 },
            action: { type: 'GRANT_KEYWORD', params: { keywords: ['어태커', '돌파'] } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다. 필드에 있는 상대 유닛 중 코스트가 가장 낮은 유닛을 1장 골라 그 유닛과 그 유닛이 장착한 아이템을 모두 주인의 패로 되돌린다.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', conditions: { isLowestCost: true }, selectMode: 'MANUAL', count: 1 },
            action: { type: 'RETURN_TO_HAND', params: { includeEquipped: true } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ],

    // ST04-016: Kevlar Jacket (Defender Item)
    "ST04-016": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'BATTLE_END'
        }
    ],

    // ST04-017: Rare Metal Glove (Active Item)
    "ST04-017": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "액티브메인 : 카드를 1장 드로우한다.",
            // Condition 'hasKeyword: 디펜더' is implicit in usage restriction, 
            // but we can add check here if we want to enforce it at usage time.
            // Following current pattern where items are equipped based on rules.
            // If the card says "Equip Condition: Defender", that's a deck/play restriction.
            // But if it says "Active: ...", and the item is already equipped, we just check cost?
            // "장착조건 디펜더" means it can only be EQUIPPED to a Defender.
            action: { type: 'DRAW', params: { count: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다. 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ]
};
