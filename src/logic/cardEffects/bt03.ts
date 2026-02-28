import { ActivationCondition, CardType, Effect } from '../types';

export const BT03_EFFECTS: Record<string, Effect[]> = {
    "BT03-001": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 5 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "각성면 액티브: 메인 - 자신의 스킬 존에 있는 스킬이 1장 이상이라면 필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-2000.",
            condition: { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            duration: 'TURN_END',
        },
    ],
    "BT03-002": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 조우 유닛의 파워-1500.",
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: -1500 } },
            duration: 'BATTLE_END',
        },
    ],
    "BT03-003": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 조우 유닛의 파워-2000.",
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            duration: 'BATTLE_END',
        },
    ],
    "BT03-004": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 필드에 있는 [어태커] 관통[1] 을 가진 자신 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 [어태커] 관통[2] 를 얻고 파워+1000.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [
                    { type: 'HAS_KEYWORD', value: '어태커' },
                    { type: 'HAS_KEYWORD', value: '관통' },
                ],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        {
                            type: 'GRANT_EFFECT',
                            params: {
                                effect: {
                                    activation: ActivationCondition.ATTACKER,
                                    description: '어태커 : 관통[2]',
                                    action: { type: 'PENETRATION', params: { value: 2 } },
                                    duration: 'TURN_END',
                                },
                            },
                        },
                        {
                            type: 'BUFF_POWER',
                            params: { value: 1000, duration: 'TURN_END' },
                        },
                    ],
                },
            },
            duration: 'TURN_END',
        },
    ],
    "BT03-005": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+3000.",
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'BATTLE_END',
        },
    ],
    "BT03-006": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 스킬 존에서 스킬을 1장 골라 트래시할 수 있다. 그러면 카드를 1장 드로우한다.",
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_PROMPT_SELECT_SKILL_ZONE_CARD_TO_TRASH',
                    contextFlagKey: 'BT03_006_SKILL_TRASHED',
                    followUpSubActions: [
                        {
                            type: 'DRAW',
                            description: 'BT03-006 follow-up: draw 1',
                            params: { count: 1 },
                        },
                    ],
                },
            },
        },
    ],
    "BT03-007": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 자신의 패가 3장 이하라면 자신의 트래시 존에서 3코스트 이하인 스킬 카드를 1장 골라 패에 넣을 수 있다. 그러면 이 공격이 끝날 때까지 파워+2000.",
            condition: { type: 'MY_HAND_COUNT', value: { max: 3 } },
            optional: true,
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.SKILL },
                    { type: 'COST_LIMIT', value: 3 },
                ],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
                        {
                            type: 'BUFF_POWER',
                            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
                            params: { value: 2000, duration: 'BATTLE_END' },
                        },
                    ],
                },
            },
        },
    ],
    "BT03-008": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "액티브: 메인 - 자신의 스킬 존에서 2코스트 이하인 스킬을 1장 골라 트래시할 수 있다. 그러면 이 턴이 끝날 때까지 [어태커] 관통[1]을 얻는다.",
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_PROMPT_SELECT_SKILL_ZONE_CARD_TO_TRASH',
                    costMax: 2,
                    contextFlagKey: 'BT03_008_SKILL_TRASHED',
                    followUpSubActions: [
                        {
                            type: 'GRANT_EFFECT',
                            description: 'BT03-008 follow-up: grant attacker penetration[1]',
                            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
                            params: {
                                effect: {
                                    activation: ActivationCondition.ATTACKER,
                                    description: '어태커 : 관통[1]',
                                    action: { type: 'PENETRATION', params: { value: 1 } },
                                    duration: 'TURN_END',
                                },
                            },
                            duration: 'TURN_END',
                        },
                    ],
                },
            },
        },
    ],
    "BT03-009": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 자신의 패를 원하는 수만큼 골라 트래시한다. 이 턴이 끝날 때까지 트래시한 카드 1장마다 조우 유닛의 파워-2500.",
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_039_PROMPT_DISCARD_FOR_SCALING_DEBUFF',
                    valuePerCard: 2500,
                    duration: 'TURN_END',
                },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-5000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -5000 } },
            duration: 'TURN_END',
        },
    ],
    "BT03-010": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 이 턴이 끝날 때까지 조우 유닛의 파워-4000. 이 효과로 그 유닛을 트래시했다면 카드를 1장 드로우한다.",
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER_AND_DRAW_IF_TRASHED', params: { value: -4000, drawCount: 1 } },
            duration: 'TURN_END',
        },
    ],
    "BT03-011": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "액티브: 메인 - 자신의 스킬 존에서 스킬을 1장 골라 트래시할 수 있다. 그러면 자신의 트래시 존에서 그 카드보다 코스트가 낮은 카드를 1장 골라 패에 넣는다.",
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT03_011_PROMPT_TRASH_LOWER_COST_TO_HAND' },
            },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT03-012": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 패를 2장까지 고르고 나머지는 모두 트래시한다. 패가 3장이 될 때까지 카드를 드로우한다.",
            targets: { scope: 'MY_HAND', type: 'CARD', count: 2, selectMode: 'MANUAL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_029_KEEP_AND_REFILL',
                    targetHandSize: 3,
                    allowPartialSelection: true,
                },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "자신의 트래시 존에서 2코스트 이하인 유닛 카드를 1장 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'COST_LIMIT', value: 2 },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT03-013": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛을 1장 고른다. 자신과 상대의 패 장수가 다르다면 이 턴이 끝날 때까지 그 차이 1장마다 그 유닛의 파워-1000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_035_APPLY_HAND_DIFF_DEBUFF',
                    valuePerDiff: 1000,
                    duration: 'TURN_END',
                },
            },
        },
    ],
    "BT03-014": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 [어태커]를 가진 4코스트 이하인 자신 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 [어태커] 듀얼리스트를 얻는다.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [
                    { type: 'HAS_KEYWORD', value: '어태커' },
                    { type: 'COST_LIMIT', value: 4 },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'APPLY_DUALIST_MARK', params: { duration: 'TURN_END' } },
            duration: 'TURN_END',
        },
    ],
    "BT03-015": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛을 1장 고른다. 자신의 패에서 유닛 카드를 1장 골라 트래시하면 이 턴이 끝날 때까지 그 유닛의 파워가 트래시한 유닛 카드의 파워만큼 감소한다.",
            optional: true,
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_015_PROMPT_UNIT_DISCARD_FOR_POWER_DEBUFF',
                    duration: 'TURN_END',
                },
            },
        },
    ],
    "BT03-016": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 조우 유닛의 파워-1000.",
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'BUFF_POWER_AND_DRAW_IF_TRASHED',
                params: {
                    value: -1000,
                    drawCount: 0,
                    setContextFlagOnTrashed: 'BT03_016_ENCOUNTER_TRASHED',
                },
            },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 효과로 조우 유닛을 트래시했다면, 장착된 〈티탄 매터 바이저〉 1장을 트래시할 수 있다. 그러면 카드를 2장 드로우한다.",
            optional: true,
            condition: { type: 'CONTEXT_FLAG', value: { key: 'BT03_016_ENCOUNTER_TRASHED', equals: true } },
            targets: {
                scope: 'MY_FIELD_ITEMS',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'HAS_NAME', value: '티탄 매터 바이저' },
                    { type: 'EQUIPPED_ON_SOURCE_UNIT' },
                ],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'DESTROY_ITEM', params: {} },
                        { type: 'DRAW', params: { count: 2 } },
                    ],
                },
            },
        },
    ],
    "BT03-017": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착 조건: 3코스트 이상인 유닛",
            condition: { type: 'COST_COMPARISON', value: { operator: 'GTE', cost: 3 } },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "액티브: 메인 - 자신의 패를 1장 골라 트래시할 수 있다. 그러면 필드에 있는 상대 유닛을 1장 고른다. 그 유닛의 파워가 이 턴이 끝날 때까지 3000이 된다.",
            optional: true,
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_017_PROMPT_DISCARD_THEN_SET_OPP_POWER',
                    setValue: 3000,
                    duration: 'TURN_END',
                },
            },
        },
    ],
    "BT03-018": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 5 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "각성면 패시브 : [전선구축] 자신의 모든 유닛 존에 유닛이 존재한다면 모든 자신 유닛의 파워+1000.",
            condition: { type: 'FRONTLINE' },
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
        },
    ],
    "BT03-019": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "[레벨링크: 6] 자신의 리더 레벨이 6 이상이라면 파워+2000.",
            condition: { type: 'LEVEL_LINK', value: 6 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    "BT03-020": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "[레벨링크: 6][전선구축] 자신의 리더 레벨이 6 이상이고 자신의 모든 유닛 존에 유닛이 존재한다면 파워+3000.",
            condition: {
                type: 'ALL',
                value: [
                    { type: 'LEVEL_LINK', value: 6 },
                    { type: 'FRONTLINE' },
                ],
            },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "[레벨링크: 6][전선구축] 자신의 리더 레벨이 6 이상이고 자신의 모든 유닛 존에 유닛이 존재한다면 히트+1.",
            condition: {
                type: 'ALL',
                value: [
                    { type: 'LEVEL_LINK', value: 6 },
                    { type: 'FRONTLINE' },
                ],
            },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "필드에 있는 3코스트 이하인 상대 유닛을 1장 골라 트래시한다.",
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 3 }],
                selectMode: 'MANUAL',
            },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
    ],
    "BT03-021": [
        {
            activation: ActivationCondition.ENTRY,
            description: "[전선구축][엔트리] 자신의 모든 유닛 존에 유닛이 존재한다면 리더 레벨+1.",
            condition: { type: 'FRONTLINE' },
            action: { type: 'GAIN_LEVEL', params: { value: 1 } },
        },
    ],
    "BT03-022": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "[레벨링크: 6][전선구축] 자신의 리더 레벨이 6 이상이고 자신의 모든 유닛 존에 유닛이 존재한다면 3코스트 이하인 다른 모든 자신 유닛의 파워+2000.",
            condition: {
                type: 'ALL',
                value: [
                    { type: 'LEVEL_LINK', value: 6 },
                    { type: 'FRONTLINE' },
                ],
            },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [
                    { type: 'COST_LIMIT', value: 3 },
                    { type: 'EXCLUDE_SELF' },
                ],
                selectMode: 'ALL',
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    "BT03-023": [
        {
            activation: ActivationCondition.ENTRY,
            description: "[엔트리] 자신의 덱 맨 위에서 카드를 2장 공개하고, 그중 4코스트 이하인 유닛 카드를 1장 골라 패에 넣는다. 나머지는 모두 트래시한다.",
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 2,
                    remainingDestination: 'TRASH',
                    filters: [
                        { type: 'UNIT_TYPE', value: CardType.UNIT },
                        { type: 'COST_LIMIT', value: 4 },
                    ],
                },
            },
        },
    ],
    "BT03-024": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "[패시브] 필드에 있는 다른 모든 자신 유닛의 히트 1마다 파워+1000.",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'BUFF_POWER',
                params: {
                    value: 1000,
                    dynamic: 'OTHER_FRIENDLY_HIT_TOTAL_MULTIPLIER',
                    excludeSelf: true,
                },
            },
        },
    ],
    "BT03-025": [
        {
            activation: ActivationCondition.ENTRY,
            description: "[엔트리] 자신의 리더 레벨이 10 이상이라면 카드를 1장 드로우한다. 아니라면 리더 레벨+1.",
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT03_025_ENTRY_LEVEL_OR_DRAW' },
            },
        },
    ],
    "BT03-026": [],
    "BT03-027": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "[액티브: 메인] 조우 유닛보다 파워가 3500 이상 높다면 이 턴이 끝날 때까지 [어태커] 관통[1]을 얻는다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_027_GRANT_PENETRATION_IF_POWER_AHEAD',
                    threshold: 3500,
                    penetrationValue: 1,
                    duration: 'TURN_END',
                },
            },
        },
    ],
    "BT03-028": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "[레벨링크: 10][어태커] 자신의 리더 레벨이 10 이상이라면 돌파[4코스트 이하]를 얻는다.",
            condition: { type: 'LEVEL_LINK', value: 10 },
            action: { type: 'BREAKTHROUGH', params: { costMax: 4 } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT03-029": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 5코스트 이상인 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 히트+1.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_MIN', value: 5 }],
                selectMode: 'MANUAL',
            },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END',
        },
    ],
    "BT03-030": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 3코스트 이하인 모든 자신 유닛은 이 턴이 끝날 때까지 히트+1. 3코스트 이하인 자신 유닛이 3장 이상이라면 추가로 카드를 1장 드로우한다.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'COST_LIMIT', value: 3 }],
                selectMode: 'ALL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_030_BUFF_HIT_AND_DRAW_IF_LOW_COST_UNITS_MIN',
                    hitValue: 1,
                    minCount: 3,
                    drawCount: 1,
                    duration: 'TURN_END',
                },
            },
            duration: 'TURN_END',
        },
    ],
    "BT03-031": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 3코스트 이하인 자신 유닛을 1장 고른다. 그 유닛의 파워가 조우 유닛의 파워보다 높다면 조우 유닛을 트래시한다.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 3 }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT03_031_DESTROY_ENCOUNTER_IF_SELECTED_UNIT_POWER_HIGHER' },
            },
        },
    ],
    "BT03-032": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 3코스트 이하인 모든 자신 유닛은 이 턴이 끝날 때까지 파워+5000. 3코스트 이하인 자신 유닛이 3장 이상이라면 추가로 히트+1.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'COST_LIMIT', value: 3 }],
                selectMode: 'ALL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_032_BUFF_LOW_COST_UNITS_AND_BONUS_HIT',
                    powerValue: 5000,
                    hitValue: 1,
                    minCount: 3,
                    duration: 'TURN_END',
                },
            },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "자신의 리더 레벨+1.",
            action: { type: 'GAIN_LEVEL', params: { value: 1 } },
        },
    ],
    "BT03-033": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착 조건: 5코스트 이상인 유닛",
            condition: { type: 'COST_COMPARISON', value: { operator: 'GTE', cost: 5 } },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 자신의 사이즈+1.",
            action: { type: 'MODIFY_PLAYER_SIZE', params: { value: 1 } },
        },
    ],
    "BT03-034": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착 조건: 3코스트 이하인 유닛",
            condition: { type: 'COST_COMPARISON', value: { operator: 'LTE', cost: 3 } },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 파워+2500.",
            action: { type: 'BUFF_POWER', params: { value: 2500 } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 히트+1.",
            action: { type: 'BUFF_HIT', params: { value: 1 } },
        },
    ],
    "BT03-035": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 5 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "각성면 액티브: 메인 - 상대의 패가 3장 이상이라면 자신의 패를 1장 골라 트래시할 수 있다. 그러면 상대는 패를 1장 골라 트래시한다.",
            condition: { type: 'OPPONENT_HAND_COUNT', value: 3 },
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: { scope: 'OPP_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } },
        },
    ],
    "BT03-036": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 필드에 있는 [엑시트]를 가진 자신 유닛 1장마다 카드를 1장 드로우한다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT03_036_DRAW_BY_EXIT_UNIT_COUNT', drawPerUnit: 1 },
            },
        },
    ],
    "BT03-037": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 필드에 있는 상대 유닛을 1장 고른다. 이 턴이 끝날 때까지 필드에 있는 [엑시트]를 가진 자신 유닛 1장마다 그 유닛의 파워-2500.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_037_APPLY_DEBUFF_BY_EXIT_UNIT_COUNT',
                    valuePerUnit: 2500,
                    duration: 'TURN_END',
                },
            },
            duration: 'TURN_END',
        },
    ],
    "BT03-038": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 상대의 패가 3장 이상이라면 자신의 패를 1장 골라 트래시할 수 있다. 그러면 상대는 패를 1장 골라 트래시한다.",
            condition: { type: 'OPPONENT_HAND_COUNT', value: 3 },
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: { scope: 'OPP_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } },
        },
    ],
    "BT03-039": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 자신의 트래시 존에서 4코스트인 유닛 카드를 1장 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'COST_EQUAL', value: 4 },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT03-040": [
        {
            activation: ActivationCondition.DRAWN,
            description: "패시브 : 상대가 [트리거]가 아닌 효과로 카드를 드로우했다면 상대는 패를 4장만 남기고 모두 트래시한다.",
            condition: { type: 'CONTEXT_FLAG', value: 'OPPONENT_DREW_NON_TRIGGER_EFFECT' },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_040_PROMPT_OPP_DISCARD_TO_HAND_SIZE',
                    keepCount: 4,
                },
            },
        },
    ],
    "BT03-041": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "가디언 희생[1] : 인접 레인 가디언 방어 시 필드의 다른 자신 유닛 1장을 트래시해야 한다.",
            action: {
                type: 'NONE',
                params: {
                    guardianBlockUnitSacrificeCost: 1,
                },
            },
        },
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 상대의 턴이라면 자신의 패에서 [엑시트]를 가진 유닛 카드나 [엑시트]를 가진 아이템 카드를 1장 골라 트래시할 수 있다. 그러면 유닛이 없는 자신의 유닛 존에 이 유닛 카드를 배치하고 자신의 턴이 끝날 때까지 파워+2500.",
            condition: { type: 'OPPONENT_TURN' },
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_041_EXIT_PROMPT_DISCARD_AND_REVIVE',
                    powerBuffValue: 2500,
                },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT03-042": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 이 턴 동안 트래시된 상대의 패가 1장 이상이라면 파워+2500.",
            condition: { type: 'OPPONENT_HAND_TRASHED_BY_EFFECT_THIS_TURN_MIN', value: 1 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2500 } },
        },
    ],
    "BT03-043": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 조우 유닛이 4코스트 이하라면 그 유닛은 이 턴이 끝날 때까지 [디펜더] 종결을 얻는다.",
            targets: {
                scope: 'ENCOUNTER',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 4 }],
                selectMode: 'ALL',
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.DEFENDER,
                        description: "디펜더 : 종결",
                        action: { type: 'TERMINATE_ATTACK', params: {} },
                        duration: 'TURN_END',
                    },
                },
            },
            duration: 'TURN_END',
        },
    ],
    "BT03-044": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 상대의 패가 1장 이하라면 조우 유닛을 트래시한다.",
            condition: { type: 'OPPONENT_HAND_COUNT', value: { max: 1 } },
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "액티브: 메인 - 상대의 패가 2장 이하라면 이 턴이 끝날 때까지 파워+3000.",
            condition: { type: 'OPPONENT_HAND_COUNT', value: { max: 2 } },
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "자신의 트래시 존에서 [엑시트]를 가진 유닛 카드를 1장 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'HAS_KEYWORD', value: '엑시트' },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT03-045": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 필드에 있는 자신 유닛을 1장 골라 트래시한다. 그러면 필드에 있는 모든 자신 유닛은 이 턴이 끝날 때까지 [엑시트] 귀환을 얻는다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_045_TRASH_AND_GRANT_EXIT_RETURN',
                    duration: 'TURN_END',
                },
            },
            duration: 'TURN_END',
        },
    ],
    "BT03-046": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 2코스트 이하인 자신 유닛을 1장 골라 트래시한다. 그러면 카드를 1장 드로우한다.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 2 }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'DESTROY_UNIT', params: {} },
                        { type: 'DRAW', params: { count: 1 } },
                    ],
                },
            },
        },
    ],
    "BT03-047": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 [엑시트]를 가진 모든 자신 유닛은 이 턴이 끝날 때까지 파워+2000.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'HAS_KEYWORD', value: '엑시트' }],
                selectMode: 'ALL',
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END',
        },
    ],
    "BT03-048": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 트래시 존에서 4코스트 이상 6코스트 이하인 유닛 카드를 1장 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'COST_MIN', value: 4 },
                    { type: 'COST_LIMIT', value: 6 },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "상대의 패가 3장 이상이라면 상대는 패를 1장 골라 트래시한다.",
            condition: { type: 'OPPONENT_HAND_COUNT', value: 3 },
            targets: { scope: 'OPP_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } },
        },
    ],
    "BT03-049": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 자신 유닛을 1장 고른다. 필드에 있는 다른 모든 자신 유닛의 파워가 이 턴이 끝날 때까지 그 유닛의 파워만큼 증가한다. 그 유닛을 트래시한다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_049_BUFF_OTHERS_BY_SELECTED_POWER_THEN_TRASH',
                    duration: 'TURN_END',
                },
            },
            duration: 'TURN_END',
        },
    ],
    "BT03-050": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 상대의 패가 3장 이하라면 필드에 있는 3코스트 이하인 상대 유닛을 1장 골라 트래시한다.",
            condition: { type: 'OPPONENT_HAND_COUNT', value: { max: 3 } },
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 3 }],
                selectMode: 'MANUAL',
            },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
    ],
    "BT03-051": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "액티브: 메인 - 필드에 있는 [엑시트]를 가진 다른 자신 유닛을 1장 고른다. 상대의 턴이 끝날 때까지 그 유닛이 가진 [엑시트]효과를 하나 골라 얻는다.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [
                    { type: 'HAS_KEYWORD', value: '엑시트' },
                    { type: 'EXCLUDE_SELF' },
                ],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT03_051_PROMPT_SELECT_TARGET_EXIT_EFFECT',
                    duration: 'OPP_TURN_END',
                },
            },
            duration: 'OPP_TURN_END',
        },
    ],
};
