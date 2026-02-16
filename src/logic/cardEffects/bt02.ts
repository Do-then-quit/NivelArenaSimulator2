import { Effect, ActivationCondition, CardType } from '../types';

export const BT02_EFFECTS: Record<string, Effect[]> = {
    "BT02-001": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 이 턴이 끝날 때까지 어태커 : 파워+1500을 얻는다.",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL', count: 1 },
            action: { type: 'GRANT_EFFECT', params: { effect: { activation: ActivationCondition.ATTACKER, description: '어태커 : 파워+1500', action: { type: 'BUFF_POWER', params: { value: 1500 } }, duration: 'TURN_END' } } },
            duration: 'TURN_END',
        },
    ],
    "BT02-002": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 아군 전원에게 이 턴 어태커 : 파워+500 부여.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'ALL', count: 0 },
            action: { type: 'GRANT_EFFECT', params: { effect: { activation: ActivationCondition.ATTACKER, description: '어태커 : 파워+500', action: { type: 'BUFF_POWER', params: { value: 500 } }, duration: 'TURN_END' } } },
            duration: 'TURN_END',
        },
    ],
    "BT02-003": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 듀얼리스트",
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL', count: 1 },
            action: { type: 'APPLY_DUALIST_MARK', params: {} },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+4000.",
            action: { type: 'BUFF_POWER', params: { value: 4000 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT02-004": [],
    "BT02-005": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+3000.",
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'TURN_END',
        },
    ],
    "BT02-006": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 자신의 트래시 존에서 2코스트 이하인 유닛을 1장 골라 패에 넣는다.",
            targets: { scope: 'MY_TRASH', type: 'UNIT', count: 1, selectMode: 'MANUAL', filters: [{ type: 'COST_LIMIT', value: 2 }] },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT02-007": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 아군 전원에게 이 턴 어태커 : 약탈[1] 부여.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: { type: 'GRANT_EFFECT', params: { effect: { activation: ActivationCondition.ATTACKER, description: '어태커 : 약탈[1]', action: { type: 'PLUNDER', params: { value: 1 } }, duration: 'TURN_END' } } },
            duration: 'TURN_END',
        },
    ],
    "BT02-008": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 자신의 트래시 존에서 7코스트 이상인 유닛을 1장 골라 패에 넣는다.",
            targets: { scope: 'MY_TRASH', type: 'UNIT', count: 1, selectMode: 'MANUAL', filters: [{ type: 'COST_MIN', value: 7 }] },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT02-009": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 3코스트 이하",
            condition: { type: 'COST_COMPARISON', value: { operator: 'LTE', cost: 3 } },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 3코스트이하 : 파워+4000.",
            action: { type: 'BUFF_POWER', params: { value: 4000 } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "광전사",
            action: { type: 'NONE', params: { keyword: 'BERSERK' } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "자신의 트래시 존에서 2코스트 이하 유닛 1장 회수.",
            targets: { scope: 'MY_TRASH', type: 'UNIT', count: 1, selectMode: 'MANUAL', filters: [{ type: 'COST_LIMIT', value: 2 }] },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT02-010": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 덱 상단 1장 공개 후 베이스 유닛을 패로.",
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 1,
                    filters: [
                        { type: 'UNIT_TYPE', value: CardType.UNIT },
                        { type: 'HAS_TRAIT', value: '베이스' },
                    ],
                },
            },
        },
    ],
    "BT02-011": [
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
    "BT02-012": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 아군 베이스 유닛 수만큼 히트+1.",
            action: { type: 'BUFF_HIT', params: { value: 1, dynamic: 'BASE_UNIT_COUNT_MULTIPLIER' } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT02-013": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 아군 유닛 1장 파워+2000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END',
        },
    ],
    "BT02-014": [],
    "BT02-015": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 전선구축이면 리더 레벨+1.",
            condition: { type: 'FRONTLINE' },
            action: { type: 'GAIN_LEVEL', params: { value: 1 } },
        },
    ],
    "BT02-016": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 필드 아이템 1장 트래시.",
            targets: { scope: 'FIELD_ITEMS', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_ITEM', params: {} },
        },
    ],
    "BT02-017": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 아군 베이스 유닛 전원 상대 턴 종료까지 파워+1500.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL', filters: [{ type: 'HAS_TRAIT', value: '베이스' }] },
            action: { type: 'BUFF_POWER', params: { value: 1500 } },
            duration: 'OPP_TURN_END',
        },
    ],
    "BT02-018": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 베이스",
            condition: { type: 'HAS_TRAIT', value: '베이스' },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "히트+1.",
            action: { type: 'BUFF_HIT', params: { value: 1 } },
        },
    ],
    "BT02-019": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 아군 유닛 1장 히트+1.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END',
        },
    ],
    "BT02-020": [
        {
            activation: ActivationCondition.UNIT_TRASHED,
            description: "패시브 : 필드의 다른 유닛이 효과로 트래시될 때마다 파워+1000.",
            condition: { type: 'CONTEXT_FLAG', value: { key: 'TRASHED_IS_OTHER_BY_EFFECT', equals: true } },
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
            duration: 'TURN_END',
        },
    ],
    "BT02-021": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 종결",
            action: { type: 'TERMINATE_ATTACK', params: {} },
        },
    ],
    "BT02-022": [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: "액티브메인 : 이번 턴 효과로 트래시된 아군 유닛이 2장 이상이면 상대에게 1대미지.",
            condition: { type: 'TRASHED_FRIENDLY_BY_EFFECT_THIS_TURN_MIN', value: 2 },
            action: { type: 'DAMAGE', params: { value: 1 } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT02-023": [],
    "BT02-024": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 공멸.",
            action: { type: 'MUTUAL_DESTRUCTION', params: {} },
        },
    ],
    "BT02-025": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 엑시트 2코 이하 유닛 1장 회수.",
            targets: { scope: 'MY_TRASH', type: 'UNIT', count: 1, selectMode: 'MANUAL', filters: [{ type: 'HAS_KEYWORD', value: '엑시트' }, { type: 'COST_LIMIT', value: 2 }] },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "자신의 트래시 존에서 엑시트 유닛 1장 회수.",
            targets: { scope: 'MY_TRASH', type: 'UNIT', count: 1, selectMode: 'MANUAL', filters: [{ type: 'HAS_KEYWORD', value: '엑시트' }] },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT02-026": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 손패 유닛 1장 트래시 후 그 히트만큼 드로우.",
            cost: { type: 'TRASH_HAND', amount: 1, cardTypeFilter: CardType.UNIT },
            action: { type: 'DRAW_BY_TARGET_HIT', params: { source: 'COST_PAYMENT' } },
        },
    ],
    "BT02-027": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 없음 : 파워+4000.",
            action: { type: 'BUFF_POWER', params: { value: 4000 } },
        },
        {
            activation: ActivationCondition.TURN_END,
            description: "패시브 : 상대의 턴이 끝날 때 이 유닛을 트래시한다.",
            condition: { type: 'OPPONENT_TURN' },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'DESTROY_UNIT', params: {} },
        },
    ],
    "BT02-028": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 5 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "각성면 패시브 : 필드의 가디언 아군 파워+1000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL', filters: [{ type: 'HAS_KEYWORD', value: '가디언' }] },
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
        },
    ],
    "BT02-029": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    "BT02-030": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "가디언 : 방벽[1]",
            action: { type: 'NONE', params: { guardianBarrierCost: 1 } },
        },
    ],
    "BT02-031": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    "BT02-032": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 돌파[6코스트 이상]",
            action: { type: 'BREAKTHROUGH', params: { costMin: 6 } },
            duration: 'TURN_END',
        },
    ],
    "BT02-033": [],
    "BT02-034": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "가디언 : 방벽[1]",
            action: { type: 'NONE', params: { guardianBarrierCost: 1 } },
        },
    ],
    "BT02-035": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 침투[1]",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'APPLY_INFILTRATION_MARK', params: {} },
            duration: 'TURN_END',
        },
    ],
    "BT02-036": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 가디언 아군 1장 히트+1.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL', filters: [{ type: 'HAS_KEYWORD', value: '가디언' }] },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "최저 코스트 상대 유닛과 아이템 패복귀.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL', filters: [{ type: 'LOWEST_COST_ONLY' }] },
            action: { type: 'RETURN_UNIT_AND_ITEMS_TO_HAND', params: {} },
        },
    ],
    "BT02-037": [],
    "BT02-038": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 아군 디펜더 파워+2000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL', filters: [{ type: 'HAS_KEYWORD', value: '디펜더' }] },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    "BT02-039": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "가디언 : 방벽[2]",
            action: { type: 'NONE', params: { guardianBarrierCost: 2 } },
        },
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 상대 턴 종료까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'OPP_TURN_END',
        },
    ],
    "BT02-040": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    "BT02-041": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 손패 5장 이상이면 이 공격이 끝날 때까지 돌파[6코스트 이상] 획득.",
            condition: { type: 'MY_HAND_COUNT', value: { min: 5 } },
            action: { type: 'BREAKTHROUGH', params: { costMin: 6 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "카드를 1장 드로우한다.",
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    "BT02-042": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 트래시의 비트리거 스킬 1장을 덱 맨 위로.",
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
                filters: [
                    { type: 'UNIT_TYPE', value: CardType.SKILL },
                    { type: 'NOT_HAS_KEYWORD', value: '트리거' },
                ],
            },
            action: { type: 'MOVE_FROM_TRASH_TO_DECK_TOP', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT02-043": [
        {
            activation: ActivationCondition.DEFENDER,
            description: "디펜더 : 이 방어가 끝날 때까지 파워+4000.",
            action: { type: 'BUFF_POWER', params: { value: 4000 } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "최저 코스트 상대 유닛과 아이템 패복귀.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL', filters: [{ type: 'LOWEST_COST_ONLY' }] },
            action: { type: 'RETURN_UNIT_AND_ITEMS_TO_HAND', params: {} },
        },
    ],
    "BT02-044": [],
    "BT02-045": [
        {
            id: 'BT02-045-HAND-TRASH-DRAW',
            activation: ActivationCondition.HAND_TRASHED,
            description: "패시브 : 턴당 1회, 효과로 자신의 패가 트래시되면 1드로우.",
            condition: { type: 'ONCE_PER_TURN', value: { contextFlag: 'HAND_TRASH_OWNER_IS_SELF' } },
            action: { type: 'DRAW', params: { count: 1 } },
        },
    ],
    "BT02-046": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "가디언 : 방벽[3]",
            action: { type: 'NONE', params: { guardianBarrierCost: 3 } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 상대 3코스트 이상 유닛은 광전사를 얻는다.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL', filters: [{ type: 'COST_MIN', value: 3 }] },
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
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT02-047": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 아군 디펜더 1장 파워+3500.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL', filters: [{ type: 'HAS_KEYWORD', value: '디펜더' }] },
            action: { type: 'BUFF_POWER', params: { value: 3500 } },
            duration: 'TURN_END',
        },
    ],
    "BT02-048": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 가디언 1장 + 비가디언 1장 선택, 비가디언이 가디언 현재 파워만큼 증가.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 2, selectMode: 'MANUAL' },
            action: { type: 'COMPLEX_ACTION', params: { mode: 'GUARDIAN_TRANSFER_POWER' } },
            duration: 'TURN_END',
        },
    ],
    "BT02-049": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 디펜더 2장 선택, 1대미지, 선택 유닛 2장 공격불가.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 2, selectMode: 'MANUAL', filters: [{ type: 'HAS_KEYWORD', value: '디펜더' }] },
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
    ],
    "BT02-050": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 가디언 1장 파워+2000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL', filters: [{ type: 'HAS_KEYWORD', value: '가디언' }] },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 손패 5장 이상이면 추가 히트+1.",
            condition: { type: 'MY_HAND_COUNT', value: { min: 5 } },
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL', filters: [{ type: 'HAS_KEYWORD', value: '가디언' }] },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END',
        },
    ],
    "BT02-051": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 손패 2장 트래시 후 상대에게 1대미지.",
            cost: { type: 'TRASH_HAND', amount: 2 },
            action: { type: 'DAMAGE', params: { value: 1 } },
        },
    ],
    "BT02-052": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 3코스트 이하",
            condition: { type: 'COST_COMPARISON', value: { operator: 'LTE', cost: 3 } },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "파워+1000.",
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
        },
    ],
    "BT02-053": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 가디언",
            condition: { type: 'HAS_KEYWORD', value: '가디언' },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
    ],
    "BT02-054": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 4코스트 이상",
            condition: { type: 'COST_COMPARISON', value: { operator: 'GTE', cost: 4 } },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 침투[1]",
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'APPLY_INFILTRATION_MARK', params: {} },
            duration: 'TURN_END',
        },
    ],
    "BT02-055": [
        {
            activation: ActivationCondition.AWAKEN,
            description: "각성 : 자신의 리더 레벨이 6 이상이라면 이 카드를 뒤집는다.",
            condition: { type: 'LEADER_LEVEL', value: 6 },
            action: { type: 'AWAKEN' as any, params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "각성면 패시브 : 아이템 장착 아군 유닛 파워+1500.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL', filters: [{ type: 'ITEM_COUNT_MIN', value: 1 }] },
            action: { type: 'BUFF_POWER', params: { value: 1500 } },
        },
    ],
    "BT02-056": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 트래시 1코 아이템 1장 회수.",
            targets: { scope: 'MY_TRASH', type: 'CARD', count: 1, selectMode: 'MANUAL', filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }, { type: 'COST_EQUAL', value: 1 }] },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT02-057": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "암드 : 장착 아이템 수 x2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000, dynamic: 'ITEM_COUNT_MULTIPLIER' } },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: "장착 3개 이상이면 어태커 : 1드로우.",
            condition: { type: 'HAS_ITEM', value: 3 },
            action: { type: 'DRAW', params: { count: 1 } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "카드를 2장 드로우한다.",
            action: { type: 'DRAW', params: { count: 2 } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "패를 2장 골라 트래시한다.",
            targets: { scope: 'MY_HAND', type: 'CARD', count: 2, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'SELF', count: 2 } },
        },
    ],
    "BT02-058": [
        {
            activation: ActivationCondition.EXIT,
            description: "엑시트 : 대미지존 아이템 1장 패로.",
            targets: { scope: 'MY_DAMAGE', type: 'CARD', count: 1, selectMode: 'MANUAL', filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }] },
            action: { type: 'MOVE_FROM_DAMAGE_TO_HAND', params: {} },
        },
        {
            activation: ActivationCondition.EXIT,
            description: "그러면 패 1장을 대미지존으로.",
            targets: { scope: 'MY_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'MOVE_FROM_HAND_TO_DAMAGE', params: {} },
        },
    ],
    "BT02-059": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 아군 장착 아이템 1장 패복귀.",
            optional: true,
            targets: { scope: 'MY_FIELD_ITEMS', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'RETURN_ITEM_TO_HAND', params: {} },
        },
    ],
    "BT02-060": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 아이템 장착 아군 유닛 수 x2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000, dynamic: 'EQUIPPED_UNIT_COUNT_MULTIPLIER' } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "아이템 장착 아군이 3장 이상이면 히트+1.",
            condition: { type: 'EQUIPPED_UNIT_COUNT_MIN', value: 3 },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
        },
    ],
    "BT02-061": [],
    "BT02-062": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "암드 : 어태커 : 장착 시 관통[1].",
            condition: { type: 'HAS_ITEM', value: 1 },
            action: { type: 'PENETRATION', params: { value: 1 } },
            duration: 'TURN_END',
        },
    ],
    "BT02-063": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 조우 히트만큼 손패 아이템 코스트 지불 시 조우 트래시.",
            optional: true,
            action: { type: 'DESTROY_ENCOUNTER', params: { requireHandItemCostByEncounterHit: true } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "자신의 덱에서 1코스트 이하 아이템 1장 서치.",
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 999,
                    filters: [
                        { type: 'UNIT_TYPE', value: CardType.ITEM },
                        { type: 'COST_LIMIT', value: 1 },
                    ],
                },
            },
        },
    ],
    "BT02-064": [],
    "BT02-065": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "암드 유니크 : 유니크 아이템 장착 시 파워+2500.",
            condition: { type: 'HAS_ITEM', value: { minCount: 1, hasTrait: '유니크' } },
            action: { type: 'BUFF_POWER', params: { value: 2500 } },
        },
    ],
    "BT02-066": [
        {
            activation: ActivationCondition.EXIT,
            description: "암드 : 전투/효과 트래시 시 장착 아이템 1장 패복귀.",
            condition: { type: 'TRASH_REASON', value: ['BATTLE', 'EFFECT'] },
            optional: true,
            action: { type: 'RETURN_ITEM_TO_HAND', params: { fromEquippedSnapshot: true } },
        },
    ],
    "BT02-067": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "암드 유니크 : 유니크 장착 & 아이템수>=조우히트이면 돌파.",
            condition: { type: 'ITEM_COUNT_GTE_ENCOUNTER_HIT', value: { requireTrait: '유니크' } },
            action: { type: 'BREAKTHROUGH', params: { mode: 'ALL' } },
            duration: 'TURN_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT02-068": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 상단 2장 공개, 아이템 1회수, 나머지 덱하단 순서 지정.",
            action: {
                type: 'REVEAL_TOP_PICK_TO_HAND_THEN_ORDER_BOTTOM',
                params: {
                    count: 2,
                    pickCount: 1,
                    allowPartialSelection: false,
                    filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }],
                },
            },
        },
    ],
    "BT02-069": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "암드 : 전투/효과 파괴 대체(장착 아이템 1장 트래시).",
            action: { type: 'NONE', params: { destroyReplacement: 'TRASH_EQUIPPED_ITEM' } },
        },
    ],
    "BT02-070": [],
    "BT02-071": [
        {
            activation: ActivationCondition.ENTRY,
            description: "엔트리 : 트래시 아이템 3장 덱하단 순서지정 후 조우 트래시.",
            optional: true,
            targets: { scope: 'MY_TRASH', type: 'CARD', count: 3, selectMode: 'MANUAL', filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }] },
            action: { type: 'MOVE_FROM_TRASH_TO_DECK_BOTTOM', params: { thenDestroyEncounter: true } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    "BT02-072": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "암드 : 장착 시 히트+1.",
            condition: { type: 'HAS_ITEM', value: 1 },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
        },
    ],
    "BT02-073": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 대미지존 아이템 1장 패로, 이후 패 1장 대미지존.",
            targets: { scope: 'MY_DAMAGE', type: 'CARD', count: 1, selectMode: 'MANUAL', filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }] },
            action: { type: 'MOVE_FROM_DAMAGE_TO_HAND', params: {} },
        },
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 패 1장을 대미지존으로.",
            targets: { scope: 'MY_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'MOVE_FROM_HAND_TO_DAMAGE', params: {} },
        },
    ],
    "BT02-074": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 유니크 아이템 서치.",
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 999,
                    filters: [
                        { type: 'UNIT_TYPE', value: CardType.ITEM },
                        { type: 'HAS_TRAIT', value: '유니크' },
                    ],
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
            description: "1코스트 이하 아이템 서치.",
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 999,
                    filters: [
                        { type: 'UNIT_TYPE', value: CardType.ITEM },
                        { type: 'COST_LIMIT', value: 1 },
                    ],
                },
            },
        },
    ],
    "BT02-075": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 필드 아이템 1장을 주인 덱 맨 아래로.",
            targets: { scope: 'FIELD_ITEMS', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'MOVE_ITEM_TO_DECK_BOTTOM', params: {} },
        },
    ],
    "BT02-076": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 트래시 1코 이하 아이템 1장 회수.",
            targets: { scope: 'MY_TRASH', type: 'CARD', count: 1, selectMode: 'MANUAL', filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }, { type: 'COST_LIMIT', value: 1 }] },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} },
        },
    ],
    "BT02-077": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "스킬 : 상단 5공개, 아이템 최대2회수, 나머지 덱하단 순서지정.",
            action: {
                type: 'REVEAL_TOP_PICK_TO_HAND_THEN_ORDER_BOTTOM',
                params: {
                    count: 5,
                    pickCount: 2,
                    allowPartialSelection: true,
                    filters: [{ type: 'UNIT_TYPE', value: CardType.ITEM }],
                },
            },
        },
    ],
    "BT02-078": [],
    "BT02-079": [
        {
            activation: ActivationCondition.ATTACKER,
            description: "어태커 : 이 공격이 끝날 때까지 파워+2000.",
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END',
        },
    ],
    "BT02-080": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "장착조건 암드",
            condition: { type: 'HAS_KEYWORD', value: '암드' },
            action: { type: 'NONE', params: {} },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: "파워+3000.",
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
        },
    ],
    "BT02-081": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 전투/효과 파괴 시 히트만큼 손패 트래시하면 생존(턴당1회).",
            action: { type: 'NONE', params: { destroyReplacement: 'DISCARD_HAND_BY_HIT' } },
        },
    ],
};
