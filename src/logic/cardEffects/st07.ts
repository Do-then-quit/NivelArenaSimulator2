import { ActivationCondition, CardType, Effect } from '../types';

export const ST07_EFFECTS: Record<string, Effect[]> = {
    "ST07-001": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 4 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 4 },
            action: { type: 'AWAKEN' as any, params: {} },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "각성면 액티브 메인 : 자신의 패를 1장 골라 트래시한다. 그러면 그 카드의 코스트 이하이고 《호문클루스》를 가진 필드에 있는 모든 자신 유닛은 이 턴이 끝날 때까지 히트+1.",
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [
                    { type: 'HAS_TRAIT', value: '호문클루스' },
                    { type: 'COST_LIMIT_BY_COST_PAYMENT' },
                ],
                selectMode: 'ALL',
            },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END',
        },
    ],
    "ST07-002": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 턴이 끝날 때까지 「엑시트 : 이 턴 동안 《호문클루스》를 가진 자신 유닛이 공격한 수만큼 카드를 드로우한다」를 얻는다.",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.EXIT,
                        description: "엑시트 : 이 턴 동안 《호문클루스》를 가진 자신 유닛이 공격한 수만큼 카드를 드로우한다.",
                        action: {
                            type: 'COMPLEX_ACTION',
                            params: { mode: 'ST07_002_EXIT_DRAW_BY_HOMUNCULUS_ATTACK_COUNT' },
                        },
                        duration: 'TURN_END',
                    },
                },
            },
            duration: 'TURN_END',
        },
    ],
    "ST07-003": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 턴이 끝날 때까지 「엑시트 : 이 턴 동안 《호문클루스》를 가진 자신 유닛이 공격한 수만큼 자신의 덱 맨 위에서 카드를 공개하고, 그중 1장을 골라 패에 넣는다. 나머지는 모두 트래시한다」를 얻는다.",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.EXIT,
                        description: "엑시트 : 이 턴 동안 《호문클루스》를 가진 자신 유닛이 공격한 수만큼 자신의 덱 맨 위에서 카드를 공개하고, 그중 1장을 골라 패에 넣는다. 나머지는 모두 트래시한다.",
                        action: {
                            type: 'COMPLEX_ACTION',
                            params: { mode: 'ST07_003_EXIT_REVEAL_BY_HOMUNCULUS_ATTACK_COUNT' },
                        },
                        duration: 'TURN_END',
                    },
                },
            },
            duration: 'TURN_END',
        },
    ],
    "ST07-004": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 턴이 끝날 때까지 「엑시트 : 이 턴 동안 《호문클루스》를 가진 자신 유닛이 공격한 수 이하의 코스트인 상대 유닛을 필드에서 1장 골라 트래시한다」를 얻는다.",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.EXIT,
                        description: "엑시트 : 이 턴 동안 《호문클루스》를 가진 자신 유닛이 공격한 수 이하의 코스트인 상대 유닛을 필드에서 1장 골라 트래시한다.",
                        action: {
                            type: 'COMPLEX_ACTION',
                            params: { mode: 'ST07_004_EXIT_DESTROY_BY_HOMUNCULUS_ATTACK_COUNT' },
                        },
                        duration: 'TURN_END',
                    },
                },
            },
            duration: 'TURN_END',
        },
    ],
    "ST07-005": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    "ST07-006": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 턴이 끝날 때까지 「엑시트 : 이 턴 동안 《호문클루스》를 가진 자신 유닛이 공격한 수만큼 자신의 덱 맨 위에서 카드를 트래시한다. 이 효과로 트래시된 《호문클루스》를 가진 카드 1장마다 상대에게 1대미지를 준다」를 얻는다.",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.EXIT,
                        description: "엑시트 : 이 턴 동안 《호문클루스》를 가진 자신 유닛이 공격한 수만큼 자신의 덱 맨 위에서 카드를 트래시한다. 이 효과로 트래시된 《호문클루스》를 가진 카드 1장마다 상대에게 1대미지를 준다.",
                        action: {
                            type: 'COMPLEX_ACTION',
                            params: { mode: 'ST07_006_EXIT_TRASH_TOP_AND_DAMAGE_BY_HOMUNCULUS_COUNT' },
                        },
                        duration: 'TURN_END',
                    },
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
            description: "자신의 트래시 존에서 《호문클루스》를 가진 유닛 카드를 1장 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'HAS_TRAIT', value: '호문클루스' },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "ST07-007": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 턴이 끝날 때까지 「엑시트 : 필드에 있는 상대 유닛을 1장 골라, 자신의 턴이 끝날 때까지 파워-3000. 이 효과는 이 턴 동안 《호문클루스》를 가진 자신 유닛이 공격한 수만큼 발동할 수 있다」를 얻는다.",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.EXIT,
                        description: "엑시트 : 필드에 있는 상대 유닛을 1장 골라, 자신의 턴이 끝날 때까지 파워-3000. 이 효과는 이 턴 동안 《호문클루스》를 가진 자신 유닛이 공격한 수만큼 발동할 수 있다.",
                        action: {
                            type: 'COMPLEX_ACTION',
                            params: { mode: 'ST07_007_EXIT_SELECT_REPEAT_DEBUFF_BY_HOMUNCULUS_COUNT' },
                        },
                        duration: 'TURN_END',
                    },
                },
            },
            duration: 'TURN_END',
        },
    ],
    "ST07-008": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "액티브: 어택 필드에 있는 자신 유닛을 1장 골라 트래시한다.",
            condition: { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
    ],
    "ST07-009": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "액티브: 어택 필드에 있는 《호문클루스》와 엑시트를 가진 자신 유닛을 1장 골라 트래시한다. 그러면 이 턴이 끝날 때까지 히트+1.",
            condition: { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [
                    { type: 'HAS_TRAIT', value: '호문클루스' },
                    { type: 'HAS_KEYWORD', value: '엑시트' },
                ],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST07_009_ACTIVE_ATTACK_TRASH_EXIT_HOMUNCULUS_FOR_HIT' },
            },
        },
    ],
    "ST07-010": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "액티브: 메인 이 턴 동안 필드에서 전투나 효과로 트래시된 자신 유닛이 1장 이상이라면 자신의 패를 1장 골라 트래시할 수 있다. 그러면 자신의 트래시 존에서 엑시트를 가진 3코스트 이하인 유닛 카드를 1장 골라 비어 있는 자신의 유닛 존에 배치한다.",
            condition: { type: 'FIELD_TRASHED_FRIENDLY_THIS_TURN_MIN', value: 1 },
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST07_010_ACTIVE_MAIN_DEPLOY_EXIT_FROM_TRASH' },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "ST07-011": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 트래시 존에서 《호문클루스》를 가지고 트리거를 가지지 않은 카드를 조우 유닛의 코스트만큼 골라 덱 맨 아래에 원하는 순서대로 놓을 수 있다. 그러면 조우 유닛을 트래시한다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST07_011_ENTRY_RETURN_HOMUNCULUS_TO_BOTTOM' },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "자신의 트래시 존에서 《호문클루스》를 가진 유닛 카드를 1장 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'HAS_TRAIT', value: '호문클루스' },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "ST07-012": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 이 턴 동안 필드에서 트래시된 자신 유닛이 1장 이상이라면 이 턴이 끝날 때까지 파워+3000.",
            condition: { type: 'FIELD_TRASHED_FRIENDLY_THIS_TURN_MIN', value: 1 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 이 턴 동안 필드에서 트래시된 자신 유닛이 1장 이상이라면 이 턴이 끝날 때까지 히트+1.",
            condition: { type: 'FIELD_TRASHED_FRIENDLY_THIS_TURN_MIN', value: 1 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
        },
    ],
    "ST07-013": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 덱 맨 위에서 카드를 4장 트래시한다. 자신의 트래시 존에서 카드를 1장 골라 대미지 존에 놓는다. 자신의 대미지 존에 있는 카드가 7장 이상이라면 카드를 1장 드로우할 수 있다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST07_013_TRASH_TOP4_THEN_MOVE_TO_DAMAGE_AND_OPTIONAL_DRAW' },
            },
        },
    ],
    "ST07-014": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 덱 맨 위에서 카드를 4장 트래시한다. 자신의 트래시 존에서 런웨이 파이터를 가진 유닛 카드를 1장 골라 패에 넣을 수 있다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST07_014_ACTIVE_TRASH_TOP4_THEN_OPTIONAL_RUNWAY_RECOVER' },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "자신의 덱 맨 위에서 카드를 4장 트래시한다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'ST07_014_TRIGGER_TRASH_TOP4' },
            },
        },
    ],
    "ST07-015": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 자신 유닛을 1장 골라 트래시한다. 그러면 카드를 1장 드로우한다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_UNIT_AND_DRAW', params: { drawCount: 1 } },
        },
    ],
    "ST07-016": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 호문클루스를 가진 자신 유닛을 1장 고른다. 조우 유닛이 있다면 고른 유닛으로 공격한다.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_TRAIT', value: '호문클루스' }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT06_034_FORCE_SELECTED_ATTACK_IF_ENCOUNTER' },
            },
        },
    ],
    "ST07-017": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착 조건: 없음.",
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "파워+2000.",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
        {
            activation: ActivationCondition.TURN_END,
            description: "패시브 : 자신의 턴이 끝날 때 이 유닛을 트래시한다. 그러면 카드를 1장 드로우한다.",
            condition: { type: 'YOUR_TURN' },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'DESTROY_UNIT_AND_DRAW', params: { drawCount: 1 } },
        },
    ],
};
