import { ActivationCondition, CardType, Effect } from '../types';

export const BT06_EFFECTS: Record<string, Effect[]> = {
    "BT06-001": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 6 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 6 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "각성면 액티브: 어택 - 필드에 있는 [액티브: 어택]을 가진 자신 유닛 1장을 고르고, 그 유닛이 가진 [액티브: 어택] 효과 1개를 발동한다.",
            condition: { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_ACTIVE_ATTACK_EFFECT', value: { includeActivatedThisTurn: true } }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'PROMPT_SELECT_ATTACK_ACTIVE_EFFECT',
                    includeActivatedThisTurn: true,
                },
            },
        },
    ],
    "BT06-002": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 조우 유닛의 파워-1500.",
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: -1500 } },
            duration: 'BATTLE_END',
        },
    ],
    "BT06-003": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 덱 맨 위에서 카드를 3장 공개하고 그중 스킬 카드 1장을 패에 넣는다. 나머지는 모두 트래시한다.",
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 3,
                    remainingDestination: 'TRASH',
                    filters: [{ type: 'UNIT_TYPE', value: CardType.SKILL }],
                },
            },
        },
    ],
    "BT06-004": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "버프 1 액티브: 어택 - 자신의 스킬 존에 있는 스킬이 1장 이상이라면 상대 유닛 1장을 고르고 이 턴이 끝날 때까지 파워-1500.",
            condition: {
                type: 'ALL',
                value: [
                    { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
                    { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
                ],
            },
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -1500 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-005": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 스킬 존에서 스킬 1장을 고를 수 있다. 그러면 그 스킬은 이 턴이 끝날 때까지 0코스트가 되고, 이 턴이 끝날 때까지 조우 유닛의 파워-3000.",
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'PROMPT_SELECT_SKILL_ZONE_CARD_FOR_ZERO_COST',
                    contextFlagKey: 'BT06_SKILL_ZERO_COST_SELECTED',
                    followUpSubActions: [
                        {
                            type: 'BUFF_POWER',
                            description: 'BT06-005 follow-up: encounter power -3000',
                            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
                            params: { value: -3000 },
                            duration: 'TURN_END',
                        },
                    ],
                },
            },
        },
    ],
    "BT06-006": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "체인 3 어태커 : 이 턴 동안 자신 유닛이 공격한 횟수가 3번 이상이라면 필드에 있는 모든 상대 유닛은 이 턴이 끝날 때까지 파워-5000.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 3 },
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: -5000 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "필드에 있는 상대 유닛 1장을 골라 이 턴이 끝날 때까지 파워-5000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -5000 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-007": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+1000.",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
            duration: 'BATTLE_END',
        },
    ],
    "BT06-008": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "체인 2 어태커 : 이 턴 동안 자신 유닛이 공격한 횟수가 2번 이상이라면 이 공격이 끝날 때까지 파워+4000.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 2 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 4000 } },
            duration: 'BATTLE_END',
        },
    ],
    "BT06-009": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "체인 2 어태커 : 이 턴 동안 자신 유닛이 공격한 횟수가 2번 이상이라면 이 공격이 끝날 때까지 관통[1]을 얻는다.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 2 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'PENETRATION', params: { value: 1 } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "체인 2 어태커 : 이 턴 동안 자신 유닛이 공격한 횟수가 2번 이상이라면 이 공격이 끝날 때까지 파워+1000.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 2 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 필드에 있는 다른 자신 유닛 1장을 골라 이 턴이 끝날 때까지 파워+2000.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'EXCLUDE_SELF' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-010": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 조우 유닛이 있다면 이 유닛으로 공격한다.",
            action: { type: 'AUTO_ATTACK_IF_ENCOUNTER', params: {} },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 듀얼리스트",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'APPLY_DUALIST_MARK', params: {} },
        },
        {
            activation: ActivationCondition.BATTLE_END,
            description: "패시브 : 이 유닛이 공격하거나 방어한 전투가 끝날 때 이 유닛을 트래시한다.",
            action: { type: 'DESTROY_SELF', params: {} },
        },
    ],
    "BT06-011": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 스킬 존에서 스킬 1장을 고를 수 있다. 그러면 그 스킬은 이 턴이 끝날 때까지 0코스트가 되고 카드를 1장 드로우한다.",
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'PROMPT_SELECT_SKILL_ZONE_CARD_FOR_ZERO_COST',
                    contextFlagKey: 'BT06_SKILL_ZERO_COST_SELECTED',
                    followUpSubActions: [
                        {
                            type: 'DRAW',
                            description: 'BT06-011 follow-up: draw 1',
                            params: { count: 1 },
                        },
                    ],
                },
            },
        },
    ],
    "BT06-012": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "체인 2 어태커 : 이 턴 동안 자신 유닛이 공격한 횟수가 2번 이상이라면 필드에 있는 모든 상대 유닛은 이 턴이 끝날 때까지 파워-2000.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 2 },
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-013": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "체인 2 어태커 : 이 턴 동안 자신 유닛이 공격한 횟수가 2번 이상이라면 이 공격이 끝날 때까지 침투[1]를 얻는다.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 2 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'APPLY_INFILTRATION_MARK', params: {} },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "체인 2 어태커 : 이 턴 동안 자신 유닛이 공격한 횟수가 2번 이상이라면 이 공격이 끝날 때까지 파워+1000.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 2 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
            duration: 'BATTLE_END',
        },
    ],
    "BT06-014": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "체인 2 어태커 : 이 턴 동안 자신 유닛이 공격한 횟수가 2번 이상이라면 이 공격이 끝날 때까지 파워+4000.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 2 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 4000 } },
            duration: 'BATTLE_END',
        },
    ],

    "BT06-015": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "??? : ??? ?? [??]? ?? ?? ?? ??? ??+1500.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'HAS_KEYWORD', value: '체인' }],
                selectMode: 'ALL',
            },
            action: { type: 'BUFF_POWER', params: { value: 1500 } },
        },
    ],
    "BT06-016": [
        {
            activation: ActivationCondition.ENTRY,
            description: "??? : ? ?? ?? ??? ?? ??? ??-2000.",
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "??? : ??? ?? ?? ?? ?? ??? ? ?? ?? ??? ??+2000.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'EXCLUDE_SELF' }],
                selectMode: 'ALL',
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-017": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "?? 1 ??? ?? : ??? ?? ?? ?? ??? 1? ????? ?? ?? 1?? ??-2500.",
            condition: {
                type: 'ALL',
                value: [
                    { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
                    { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
                ],
            },
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -2500 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-018": [
        {
            activation: ActivationCondition.ENTRY,
            description: "??? : ??? ?? ?? ??? 1? ??, ? ?? ?? ??? ??+4000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: 4000 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-019": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "?? 3 ??? : ? ? ?? ?? ??? ??? ??? 3? ????? ? ??? ?? ??? ??[2]? ???.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 3 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'PLUNDER', params: { value: 2 } },
            duration: 'BATTLE_END',
        },
    ],
    "BT06-020": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "?? 2 ??? : ? ? ?? ?? ??? ??? ??? 2? ????? ?? ??? ??-3000. ? ??? ?????? ??? 1? ?????.",
            condition: { type: 'ATTACK_COUNT_THIS_TURN_MIN', value: 2 },
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER_AND_DRAW_IF_TRASHED', params: { value: -3000, drawCount: 1 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-021": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "?? 1 ??? ?? : ??? ?? ?? ??? 1? ????? ?? ?? 1?? ??-4000.",
            condition: {
                type: 'ALL',
                value: [
                    { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
                    { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
                ],
            },
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -4000 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "??? / ? ??? ?????.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "??? ?? ?? ??? 1? ?? ? ?? ?? ??? ??-5000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -5000 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-022": [
        {
            activation: ActivationCondition.ENTRY,
            description: "??? : ??? ?? ?? ?? ??? ? ?? ?? ??? ??-2000. ? ??? ???? ?? ??? ?????.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER_AND_DRAW_IF_TRASHED', params: { value: -2000, drawCount: 1 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "?? 1 ??? ?? : ??? ?? ?? ??? 1? ????? ??? ????? 2??? ?? ?? 1?? ?? ???.",
            condition: {
                type: 'ALL',
                value: [
                    { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
                    { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
                ],
            },
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.SKILL },
                    { type: 'COST_LIMIT', value: 2 },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT06-023": [
        {
            activation: ActivationCondition.ENTRY,
            description: "??? : ??? ?? ?? ???? ? ??. ??? ??? 3? ?????.",
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'DISCARD_ALL', params: {} },
                        { type: 'DRAW', params: { count: 3 } },
                    ],
                },
            },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "?? 1 ??? ?? : ??? ?? ?? ??? 1? ????? ??? 3??? ?? ?? ?? 1?? ?????.",
            condition: {
                type: 'ALL',
                value: [
                    { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
                    { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
                ],
            },
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
    "BT06-024": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "?? 2 ??? ?? : ??? ?? ?? ??? 2? ????? ??? ?? ?? ?? ??-3000.",
            condition: {
                type: 'ALL',
                value: [
                    { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
                    { type: 'SKILL_ZONE_COUNT_MIN', value: 2 },
                ],
            },
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: -3000 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "??? / ? ??? ??? ?? ???.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT06-025": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "?? 2 ??? ?? : ??? ?? ?? ??? 2? ????? ??? ?? ?? 1?? ??-7000.",
            condition: {
                type: 'ALL',
                value: [
                    { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
                    { type: 'SKILL_ZONE_COUNT_MIN', value: 2 },
                ],
            },
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -7000 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "??? / ? ??? ??? ?? ???.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT06-026": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "??? ?? ?? ??? 1? ??, ? ?? ?? ??? ??-1000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -1000 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-027": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "? ? ??? 2?? ????, ?? ?? ?? 1?? ?? ?? ???. ???? ?????.",
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 2,
                    remainingDestination: 'TRASH',
                    filters: [{ type: 'UNIT_TYPE', value: CardType.UNIT }],
                },
            },
        },
    ],
    "BT06-028": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "??? ?? ?? ??? 1? ??, ? ?? ?? ??? ??-2000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            duration: 'TURN_END',
        },
    ],

};
