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
            actionDurationOverride: 'TURN_END',
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
            description: "엔트리 : 자신의 패를 모두 트래시할 수 있다. 그러면 카드를 3장 드로우한다.",
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
    "BT06-029": [
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
            description: "자신의 트래시 존에서 코스트가 자신의 리더 레벨 이하인 스킬 카드를 1장 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.SKILL },
                    { type: 'COST_LIMIT_BY_LEADER_LEVEL' },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT06-030": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 모든 자신 유닛은 이 턴이 끝날 때까지 파워+2000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-031": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 트래시 존에서 [트리거]를 가지지 않고 파워가 5000 이하인 유닛 카드를 1장 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'NOT_HAS_KEYWORD', value: '트리거' },
                    { type: 'POWER_LIMIT', value: 5000 },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT06-032": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 자신 유닛을 1장 고른다. 그 유닛은 이 턴이 끝날 때까지 [어태커] 듀얼리스트를 얻는다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'APPLY_DUALIST_MARK', params: {} },
            duration: 'TURN_END',
        },
    ],
    "BT06-033": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-2000. 이 효과로 그 유닛을 트래시했다면 카드를 1장 드로우한다.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER_AND_DRAW_IF_TRASHED', params: { value: -2000, drawCount: 1 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-034": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 3코스트 이하인 자신 유닛을 1장 고른다. 조우 유닛이 있다면 고른 유닛으로 공격한다.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 3 }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT06_034_FORCE_SELECTED_ATTACK_IF_ENCOUNTER' },
            },
        },
    ],
    "BT06-035": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛을 1장 고른다. 자신과 상대의 패 장수가 다르다면 이 턴이 끝날 때까지 그 차이 1장마다 그 유닛의 파워-2000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT06_035_APPLY_HAND_DIFF_DEBUFF', duration: 'TURN_END' },
            },
        },
    ],
    "BT06-036": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "이 턴이 끝날 때까지 상대는 [엑시트] 효과를 발동할 수 없다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'LOCK_ACTIVATION_UNTIL_TURN_END',
                    target: 'OPPONENT',
                    activation: ActivationCondition.EXIT,
                },
            },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-2000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -2000 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-037": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 3코스트 이하인 자신 유닛을 1장 고른다. 그 유닛은 이 턴의 어택 페이즈 중 1번 더 공격할 수 있다.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 3 }],
                selectMode: 'MANUAL',
            },
            action: { type: 'GRANT_EXTRA_ATTACK_THIS_TURN', params: { value: 1 } },
        },
    ],
    "BT06-038": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛을 2장까지 골라, 이 턴이 끝날 때까지 파워-3000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 2, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -3000, allowPartialSelection: true } },
            duration: 'TURN_END',
        },
    ],
    "BT06-039": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛을 1장 고른다. 자신의 패를 원하는 수만큼 골라 트래시한다. 이 턴이 끝날 때까지 트래시한 카드 1장마다 그 유닛의 파워-3000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT06_039_PROMPT_DISCARD_FOR_SCALING_DEBUFF', duration: 'TURN_END' },
            },
        },
    ],
    "BT06-040": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛을 1장 골라, 이 턴이 끝날 때까지 파워-6000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: -6000 } },
            duration: 'TURN_END',
        },
    ],
    "BT06-041": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 조우 유닛의 파워-1000. 이 효과로 그 유닛을 트래시했다면 추가 효과를 처리한다.",
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'BUFF_POWER_AND_DRAW_IF_TRASHED',
                params: {
                    value: -1000,
                    drawCount: 0,
                    setContextFlagOnTrashed: 'BT06_041_ENCOUNTER_TRASHED',
                },
            },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 효과로 조우 유닛을 트래시했다면, 장착된 〈천둥의 망치〉 1장을 트래시할 수 있다. 그러면 카드를 2장 드로우한다.",
            optional: true,
            condition: { type: 'CONTEXT_FLAG', value: { key: 'BT06_041_ENCOUNTER_TRASHED', equals: true } },
            targets: {
                scope: 'MY_FIELD_ITEMS',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'HAS_NAME', value: '천둥의 망치' },
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
    "BT06-042": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 자신의 트래시 존에서 〈반역의 결의〉 이외의 2코스트 이하인 카드를 1장 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'EXCLUDE_CARD_ID', value: 'BT06-042' },
                    { type: 'COST_LIMIT', value: 2 },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT06-043": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 5 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "각성면 액티브: 메인 - 자신의 덱 맨 위에서 카드를 1장 트래시한다. 이 효과로 트래시한 카드 중 스킬 카드를 1장 골라 효과를 발동할 수 있다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_TRASH_TOP_AND_PROMPT_TRASHED_SKILL_CAST',
                    count: 1,
                    allowSkip: true,
                },
            },
        },
    ],
    "BT06-044": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "버프 1 액티브: 메인 - 자신의 스킬 존에 있는 스킬이 1장 이상이라면 카드를 1장 드로우한다.",
            condition: { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    "BT06-045": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 필드에 있는 광전사를 가진 모든 상대 유닛의 파워-500.",
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'HAS_KEYWORD', value: '광전사' }],
                selectMode: 'ALL',
            },
            action: { type: 'BUFF_POWER', params: { value: -500 } },
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+1000.",
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
        },
    ],
    "BT06-046": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "액티브: 메인 - 필드에 있는 자신 유닛을 1장 고른다. 그 유닛은 상대의 턴이 끝날 때까지 「디펜더 : 이 방어가 끝날 때까지 파워+2000」을 얻는다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.DEFENDER,
                        description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
                        action: { type: 'BUFF_POWER', params: { value: 2000 } },
                        duration: 'BATTLE_END',
                    },
                },
            },
            duration: 'OPP_TURN_END',
        },
    ],
    "BT06-047": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 덱 맨 위에서 카드를 3장 공개하고, 그중 스킬 카드를 1장 골라 패에 넣는다. 나머지는 모두 트래시한다.",
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
    "BT06-048": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 이 유닛은 공격할 수 없다.",
            action: { type: 'NONE', params: { cannotAttack: true } },
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    "BT06-049": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 트래시 존에서 3코스트 이하인 스킬 카드를 1장 골라 패에 넣는다.",
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
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT06-050": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    "BT06-051": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 조우 유닛은 상대의 턴이 끝날 때까지 공격할 수 없다.",
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT06_051_LOCK_ENCOUNTER_UNTIL_OPP_TURN_END' },
            },
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    "BT06-052": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 필드에 있는 버프를 가진 모든 자신 유닛의 파워+1500.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'HAS_KEYWORD', value: '버프' }],
                selectMode: 'ALL',
            },
            action: { type: 'BUFF_POWER', params: { value: 1500 } },
        },
    ],
    "BT06-053": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 스킬 존에서 3코스트 이하인 스킬을 1장 고를 수 있다. 그러면 그 스킬은 이 턴이 끝날 때까지 0코스트가 된다.",
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'PROMPT_SELECT_SKILL_ZONE_CARD_FOR_ZERO_COST',
                    costMax: 3,
                    allowSkip: true,
                    contextFlagKey: 'BT06_053_SKILL_SELECTED',
                },
            },
        },
    ],
    "BT06-054": [
        {
            id: 'BT06-054-DRAWN-PASSIVE',
            activation: ActivationCondition.DRAWN,
            description: "패시브 : 자신과 상대의 턴마다 1번씩, 상대가 트리거 이외의 효과로 카드를 드로우했다면 카드를 1장 드로우한다.",
            condition: {
                type: 'ONCE_PER_TURN',
                value: { contextFlag: 'OPPONENT_DREW_NON_TRIGGER_EFFECT' },
            },
            action: { type: 'DRAW', params: { count: 1 } },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 덱 맨 위에서 카드를 3장 트래시할 수 있다. 그러면 이 효과로 트래시한 카드 중 스킬 카드를 1장 골라 효과를 발동할 수 있다.",
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_TRASH_TOP_AND_PROMPT_TRASHED_SKILL_CAST',
                    count: 3,
                    allowSkip: true,
                },
            },
        },
    ],
    "BT06-055": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 덱 맨 위에서 카드를 3장 트래시할 수 있다. 그러면 이 효과로 트래시한 카드 중 스킬 카드를 1장 골라 효과를 발동할 수 있다.",
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_TRASH_TOP_AND_PROMPT_TRASHED_SKILL_CAST',
                    count: 3,
                    allowSkip: true,
                },
            },
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    "BT06-056": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "버프 1 액티브: 메인 - 자신의 스킬 존에 있는 스킬이 1장 이상이라면 필드에 있는 디펜더를 가진 자신 유닛을 2장 고른다. 그러면 상대에게 1대미지를 준다. 고른 2장은 이 턴이 끝날 때까지 공격할 수 없다.",
            condition: { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 2,
                filters: [{ type: 'HAS_KEYWORD', value: '디펜더' }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'DAMAGE', params: { value: 1 } },
                        { type: 'LOCK_ATTACK_UNTIL_TURN_END', params: {} },
                    ],
                },
            },
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    "BT06-057": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 상대의 턴이 끝날 때까지 「패시브 : 조우 유닛은 광전사를 얻는다」를 얻는다.",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: "패시브 : 조우 유닛은 광전사를 얻는다.",
                        targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 0, selectMode: 'ALL' },
                        action: {
                            type: 'GRANT_EFFECT',
                            params: {
                                effect: {
                                    activation: ActivationCondition.PASSIVE,
                                    description: '광전사',
                                    action: { type: 'NONE', params: { keyword: 'BERSERK' } },
                                    duration: 'TURN_END',
                                },
                            },
                        },
                    },
                },
            },
            duration: 'OPP_TURN_END',
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+3000.",
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
        },
    ],
    "BT06-058": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "버프 2 액티브: 어택 - 자신의 스킬 존에 있는 스킬이 2장 이상이고 조우 유닛이 4코스트 이상이라면 조우 유닛과 그 유닛이 장착한 아이템을 모두 주인의 패로 되돌린다. 이 유닛의 히트가 이 턴이 끝날 때까지 1이 된다.",
            condition: {
                type: 'ALL',
                value: [
                    { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
                    { type: 'SKILL_ZONE_COUNT_MIN', value: 2 },
                ],
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT06_058_RETURN_ENCOUNTER_AND_SET_HIT' },
            },
        },
    ],
    "BT06-059": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    "BT06-060": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "버프 1 액티브: 어택 - 자신의 스킬 존에 있는 스킬이 1장 이상이라면 자신의 트래시 존에서 트리거를 가지지 않고 3코스트 이상인 스킬 카드를 1장 골라 덱 맨 아래에 놓는다. 그러면 상대에게 1대미지를 준다.",
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
                    { type: 'NOT_HAS_KEYWORD', value: '트리거' },
                    { type: 'COST_MIN', value: 3 },
                ],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'MOVE_FROM_TRASH_TO_DECK_BOTTOM', params: {} },
                        { type: 'DAMAGE', params: { value: 1 } },
                    ],
                },
            },
        },
    ],
    "BT06-061": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 상대의 턴이 끝날 때까지 상대는 패에서 4코스트 이상인 유닛을 이 유닛이 있는 레인에 배치할 수 없다.",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: "패시브 : 상대는 패에서 4코스트 이상인 유닛을 이 유닛이 있는 레인에 배치할 수 없다.",
                        action: { type: 'NONE', params: { preventOpponentPlayUnitCostMin: 4 } },
                    },
                },
            },
            duration: 'OPP_TURN_END',
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "버프 1 액티브: 메인 - 자신의 스킬 존에 있는 스킬이 1장 이상이라면 상대의 턴이 끝날 때까지 「패시브 : 조우 유닛은 광전사를 얻는다」를 얻는다.",
            condition: { type: 'SKILL_ZONE_COUNT_MIN', value: 1 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: "패시브 : 조우 유닛은 광전사를 얻는다.",
                        targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 0, selectMode: 'ALL' },
                        action: {
                            type: 'GRANT_EFFECT',
                            params: {
                                effect: {
                                    activation: ActivationCondition.PASSIVE,
                                    description: '광전사',
                                    action: { type: 'NONE', params: { keyword: 'BERSERK' } },
                                    duration: 'TURN_END',
                                },
                            },
                        },
                    },
                },
            },
            duration: 'OPP_TURN_END',
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+3000.",
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT06-062": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 필드에 있는 히트가 1 이하인 상대 유닛을 1장 고른다. 그 유닛은 상대의 턴이 끝날 때까지 공격할 수 없다.",
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HIT_LIMIT', value: 1 }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT06_051_LOCK_ENCOUNTER_UNTIL_OPP_TURN_END' },
            },
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "버프 2 액티브: 메인 - 자신의 스킬 존에 있는 스킬이 2장 이상이라면 자신의 트래시 존에서 트리거를 가지지 않고 카드명이 다른 스킬 카드 3장을 골라 덱 맨 아래에 원하는 순서대로 놓는다. 그러면 상대에게 2대미지를 준다. 이 유닛은 이 턴이 끝날 때까지 공격할 수 없다.",
            condition: {
                type: 'ALL',
                value: [
                    { type: 'SKILL_ZONE_COUNT_MIN', value: 2 },
                    {
                        type: 'TRASH_DISTINCT_NAME_COUNT_MIN',
                        value: { min: 3, cardType: CardType.SKILL, excludeKeyword: '트리거' },
                    },
                ],
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_062_PROMPT_UNIQUE_TRASH_SKILLS',
                    requiredCount: 3,
                    cardType: CardType.SKILL,
                    excludeKeyword: '트리거',
                    damageValue: 2,
                },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT06-063": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 덱 맨 위에서 카드를 5장 트래시할 수 있다. 그러면 이 효과로 트래시한 카드 중 스킬 카드를 1장 골라 효과를 발동할 수 있다.",
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_TRASH_TOP_AND_PROMPT_TRASHED_SKILL_CAST',
                    count: 5,
                    allowSkip: true,
                },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT06-064": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "버프 2 액티브: 메인 - 자신의 스킬 존에 있는 스킬이 2장 이상이라면 상대의 턴이 끝날 때까지 「패시브 : 조우 유닛은 광전사를 얻는다」를 얻는다.",
            condition: { type: 'SKILL_ZONE_COUNT_MIN', value: 2 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: "패시브 : 조우 유닛은 광전사를 얻는다.",
                        targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 0, selectMode: 'ALL' },
                        action: {
                            type: 'GRANT_EFFECT',
                            params: {
                                effect: {
                                    activation: ActivationCondition.PASSIVE,
                                    description: '광전사',
                                    action: { type: 'NONE', params: { keyword: 'BERSERK' } },
                                    duration: 'TURN_END',
                                },
                            },
                        },
                    },
                },
            },
            duration: 'OPP_TURN_END',
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "가디언 : 방벽[3]",
            action: { type: 'NONE', params: { guardianBarrierCost: 3 } },
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT06-065": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    "BT06-066": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 덱 맨 위에서 카드를 1장 트래시한다. 이 효과로 트래시한 카드 중 스킬 카드를 1장 골라 효과를 발동할 수 있다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_TRASH_TOP_AND_PROMPT_TRASHED_SKILL_CAST',
                    count: 1,
                    allowSkip: true,
                },
            },
        },
    ],
    "BT06-067": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 자신 유닛을 1장 골라, 상대의 턴이 끝날 때까지 파워+2000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'OPP_TURN_END',
        },
    ],
    "BT06-068": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 패를 1장 골라 트래시할 수 있다. 그러면 카드를 2장 드로우한다.",
            optional: true,
            targets: { scope: 'MY_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'DISCARD', params: { target: 'SELF', count: 1 } },
                        { type: 'DRAW', params: { count: 2 } },
                    ],
                },
            },
        },
    ],
    "BT06-069": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 자신 유닛을 1장 고른다. 그 유닛은 상대의 턴이 끝날 때까지 「패시브 : 조우 유닛은 광전사를 얻는다」를 얻는다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: "패시브 : 조우 유닛은 광전사를 얻는다.",
                        targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 0, selectMode: 'ALL' },
                        action: {
                            type: 'GRANT_EFFECT',
                            params: {
                                effect: {
                                    activation: ActivationCondition.PASSIVE,
                                    description: '광전사',
                                    action: { type: 'NONE', params: { keyword: 'BERSERK' } },
                                    duration: 'TURN_END',
                                },
                            },
                        },
                    },
                },
            },
            duration: 'OPP_TURN_END',
        },
    ],
    "BT06-070": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛을 2장까지 고른다. 고른 유닛은 모두 상대의 턴이 끝날 때까지 「어태커 : 상대는 카드를 1장 드로우한다」를 얻는다.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 2, selectMode: 'MANUAL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_070_GRANT_ATTACKER_OPPONENT_DRAW_UNTIL_OPP_TURN_END',
                    allowPartialSelection: true,
                    untilTurnCountOffset: 1,
                },
            },
        },
    ],
    "BT06-071": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 트래시 존에서 [트리거]를 가지지 않고 파워가 4000 이상인 유닛 카드를 1장 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'UNIT',
                count: 1,
                filters: [
                    { type: 'NOT_HAS_KEYWORD', value: '트리거' },
                    { type: 'POWER_MIN', value: 4000 },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT06-072": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 자신 유닛을 1장 고른다. 그 유닛은 상대의 턴이 끝날 때까지 「[패시브] 이 유닛이 있는 레인에 상대 유닛이 배치되면 그 유닛의 히트가 1이 된다」를 얻는다. 그 유닛의 조우 유닛의 히트가 상대의 턴이 끝날 때까지 1이 된다.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: "패시브 : 이 유닛이 있는 레인의 조우 유닛의 히트가 1이 된다.",
                        targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 0, selectMode: 'ALL' },
                        action: { type: 'BUFF_HIT', params: { value: 1, mode: 'SET' } },
                    },
                },
            },
            duration: 'OPP_TURN_END',
        },
    ],
    "BT06-073": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "카드를 3장 드로우한다. 그러면 상대는 카드를 1장 드로우한다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'DRAW', params: { count: 3 } },
                        { type: 'DRAW', params: { count: 1, target: 'OPPONENT' } },
                    ],
                },
            },
        },
    ],
    "BT06-074": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 상대 유닛을 1장 고른다. 그 유닛은 상대의 턴이 끝날 때까지 공격할 수 없다.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'BT06_051_LOCK_ENCOUNTER_UNTIL_OPP_TURN_END' },
            },
        },
    ],
    "BT06-075": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 [엔트리]를 가진 자신 유닛을 1장 고른다. 그 유닛이 가진 [엔트리] 효과를 하나 골라 발동한다.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_KEYWORD', value: '엔트리' }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: { mode: 'PROMPT_SELECT_ENTRY_EFFECT' },
            },
        },
    ],
    "BT06-076": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 모든 상대 유닛은 상대의 턴이 끝날 때까지 광전사를 얻는다.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_GRANT_BERSERK_UNTIL_OPP_TURN_END',
                    untilTurnCountOffset: 1,
                },
            },
        },
    ],
    "BT06-077": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 [디펜더]를 가진 자신 유닛의 수만큼 카드를 드로우한다. 상대의 턴이 끝날 때까지 상대는 [어태커] 효과를 발동할 수 없다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_077_DRAW_BY_DEFENDER_AND_LOCK_OPP_ATTACKER',
                    untilTurnCountOffset: 1,
                },
            },
        },
    ],
    "BT06-078": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 패에서 스킬 카드를 1장 골라 트래시한다. 그러면 상대에게 1대미지를 준다.",
            targets: {
                scope: 'MY_HAND',
                type: 'CARD',
                count: 1,
                filters: [{ type: 'UNIT_TYPE', value: CardType.SKILL }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'DISCARD', params: { target: 'SELF', count: 1 } },
                        { type: 'DAMAGE', params: { value: 1 } },
                    ],
                },
            },
        },
    ],
    "BT06-079": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 트래시 존에서 〈데이드림 콜〉 이외의 [트리거]를 가지지 않고 카드명이 다른 스킬 카드를 3장 골라 덱 맨 아래에 원하는 순서대로 놓는다. 그러면 상대에게 1대미지를 준다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_062_PROMPT_UNIQUE_TRASH_SKILLS',
                    requiredCount: 3,
                    cardType: CardType.SKILL,
                    excludeKeyword: '트리거',
                    excludeName: '데이드림 콜',
                    damageValue: 1,
                },
            },
        },
    ],
    "BT06-080": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 패를 모두 트래시한다. 패가 5장이 될 때까지 카드를 드로우한다.",
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'BT06_080_DISCARD_ALL_AND_DRAW_TO_HAND_SIZE',
                    targetHandSize: 5,
                },
            },
        },
    ],
    "BT06-081": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "필드에 있는 모든 상대 유닛은 상대의 턴이 끝날 때까지 파워-5000.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: -5000 } },
            duration: 'OPP_TURN_END',
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "상대는 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1, target: 'OPPONENT' } },
        },
    ],
    "BT06-082": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "상대에게 2대미지를 준다.",
            action: { type: 'DAMAGE', params: { value: 2 } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "자신의 트래시 존에서 코스트가 자신의 리더 레벨 이하인 유닛 카드를 1장 골라 패에 넣는다.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.UNIT },
                    { type: 'COST_LIMIT_BY_LEADER_LEVEL' },
                ],
                selectMode: 'MANUAL',
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT06-083": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    "BT06-084": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 6코스트 이하",
            condition: { type: 'COST_COMPARISON', value: { operator: 'LTE', cost: 6 } },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "가디언 : 상쇄〈사신의 수의〉",
            action: {
                type: 'NONE',
                params: {
                    guardianBlockItemCost: {
                        itemName: '사신의 수의',
                        itemCardId: 'BT06-084',
                        count: 1,
                    },
                },
            },
        },
    ],

};
