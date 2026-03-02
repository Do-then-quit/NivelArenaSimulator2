import { ActivationCondition, Effect } from '../types';

export const SB01_EFFECTS: Record<string, Effect[]> = {
    'SB01-001': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 자신의 스킬 존에서 스킬을 1장 골라 트래시할 수 있다. 그러면 상대 유닛 1장을 골라 트래시한 코스트 x2000만큼 파워를 감소시킨다.',
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_001_ENTRY_PROMPT_SKILL_COST_DEBUFF',
                },
            },
        },
    ],
    'SB01-002': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 필드의 자신 [어태커] 유닛이 3장 이상이라면 이 공격이 끝날 때까지 관통[1]을 얻는다.',
            condition: {
                type: 'CONTEXT_FLAG',
                value: {
                    key: 'FRIENDLY_ATTACKER_COUNT',
                    min: 3,
                },
            },
            action: { type: 'PENETRATION', params: { value: 1 } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '[액티브: 메인] 자신의 패를 1장 트래시한다. 그러면 트래시한 카드 코스트 이하의 [어태커] 자신 유닛 모두는 이 턴 동안 코스트당 파워+1000, 히트+1.',
            cost: { type: 'TRASH_HAND', amount: 1 },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_002_ACTIVE_MAIN_BUFF_ATTACKERS_BY_DISCARDED_COST',
                },
            },
        },
    ],
    'SB01-003': [
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 듀얼리스트.',
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'APPLY_DUALIST_MARK', params: {} },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 이 공격이 끝날 때까지 자신의 대미지 1장마다 파워+500.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_003_ATTACKER_BUFF_BY_DAMAGE_COUNT',
                },
            },
        },
        {
            activation: ActivationCondition.ON_KILL,
            description: '이 유닛이 공격으로 상대 유닛을 전투 트래시했다면, 트래시된 유닛의 히트 이하로 패를 트래시할 수 있다. 트래시한 수만큼 1대미지.',
            condition: { type: 'TRASH_REASON', value: ['BATTLE'] },
            optional: true,
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_003_ON_KILL_PROMPT_DISCARD_FOR_DAMAGE',
                },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 자신의 패에 넣는다.',
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    'SB01-004': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '자신 [어태커] 유닛 수만큼 드로우. 상대 턴 종료까지 상대가 효과로 드로우하면 이벤트마다 1대미지.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_004_ACTIVE_DRAW_AND_PUNISH',
                },
            },
        },
    ],
    'SB01-005': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '1장 드로우 후 상대 유닛 1장에 EXIT 부여. 자신 [어태커] 2장 이상이면 이 스킬을 트래시할 수 있다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_005_ACTIVE_DRAW_MARK_AND_OPTIONAL_TRASH',
                },
            },
        },
    ],
    'SB01-006': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '[액티브: 어택] 자신의 사이즈가 필드 코스트 합보다 3 이상 높다면 패 1장을 트래시하고, 3코 이하 자신 유닛 1장에 [어태커] 돌파 부여.',
            condition: {
                type: 'ALL',
                value: [
                    { type: 'CONTEXT_FLAG', value: 'PHASE_ATTACK' },
                    { type: 'SIZE_MARGIN_MIN', value: 3 },
                ],
            },
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 3 }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_006_ACTIVE_ATTACK_GRANT_BREAKTHROUGH_TO_LOW_COST',
                },
            },
        },
    ],
    'SB01-007': [
        {
            activation: ActivationCondition.EXIT,
            description: '[엑시트] 덱 위 1장 공개. 패 1장을 트래시하면 공개된 유닛을 빈 유닛 존에 배치하고 0코스트가 된다. 나머지는 트래시.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_007_EXIT_REVEAL_AND_DISCARD_TO_DEPLOY',
                },
            },
        },
    ],
    'SB01-008': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[전선구축] 자신의 모든 유닛 존에 유닛이 있다면 파워+2000.',
            condition: { type: 'FRONTLINE' },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '필드의 3코스트 이하 자신 유닛은 "[엑시트] 효과로 트래시됐다면 패 1장을 트래시할 수 있다. 그러면 빈 유닛 존에 이 유닛을 배치"를 얻는다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'COST_LIMIT', value: 3 }],
                selectMode: 'ALL',
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.EXIT,
                        description: '[엑시트] 효과로 트래시됐다면 패를 1장 트래시할 수 있다. 그러면 이 유닛을 빈 유닛 존에 배치한다.',
                        condition: { type: 'TRASH_REASON', value: ['EFFECT'] },
                        optional: true,
                        cost: { type: 'TRASH_HAND', amount: 1 },
                        action: {
                            type: 'COMPLEX_ACTION',
                            params: {
                                mode: 'SB01_008_EXIT_REDEPLOY_IF_EFFECT_TRASHED',
                            },
                        },
                    },
                },
            },
        },
    ],
    'SB01-009': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[레벨링크: 6] 상대는 패에서 4코스트 이하 유닛을 이 유닛 레인에 배치할 수 없다.',
            condition: { type: 'LEVEL_LINK', value: 6 },
            action: { type: 'NONE', params: { preventOpponentPlayUnitCostMax: 4 } },
        },
    ],
    'SB01-010': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[레벨링크: 8] 히트+1.',
            condition: { type: 'LEVEL_LINK', value: 8 },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: '[어태커] 이 공격이 끝날 때까지 상대는 이 유닛보다 히트가 낮은 유닛으로 방어하려면 차이만큼 패를 트래시해야 한다.',
            action: { type: 'NONE', params: { requireBlockHandDiscardByHitDiff: true } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 자신의 패에 넣는다.',
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    'SB01-011': [
        {
            activation: ActivationCondition.EXIT,
            description: '[엑시트] 자신의 턴이라면 이 턴 동안 효과로 트래시된 자신 유닛 수만큼 드로우한다. 3장 이상이면 상대에게 1대미지.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_011_EXIT_DRAW_BY_EFFECT_TRASHED_COUNT',
                },
            },
        },
    ],
    'SB01-012': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '[액티브: 메인] 이 턴 동안 필드에서 트래시된 자신 유닛이 1장 이상이라면 이 유닛을 트래시하고 상대에게 1대미지.',
            condition: { type: 'TRASHED_FRIENDLY_BY_EFFECT_THIS_TURN_MIN', value: 1 },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    subActions: [
                        { type: 'DESTROY_SELF', params: {} },
                        { type: 'DAMAGE', params: { value: 1 } },
                    ],
                },
            },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 자신의 패에 넣는다.',
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    'SB01-013': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 이 턴 동안 자신의 [액티브] 효과로 상대에게 주는 1대미지를 2대미지로 변경한다. 이 유닛을 트래시하고 손의 5코 유닛으로 교체할 수 있다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_013_ENTRY_ENABLE_ACTIVE_DAMAGE_BONUS',
                },
            },
        },
    ],
    'SB01-014': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '트래시의 2코스트 이하 유닛 1장을 사이즈를 무시하고 빈 유닛 존에 배치한다. 그 유닛은 EXIT로 스킬 존의 〈페인 이터〉를 트래시한다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_014_ACTIVE_DEPLOY_LOW_COST_FROM_TRASH',
                },
            },
        },
    ],
    'SB01-015': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '필드의 5코스트 이하 자신 유닛 1장을 트래시한다. 그러면 같은 원래 코스트/같은 카드명의 유닛을 트래시에서 같은 칸에 배치한다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 5 }],
                selectMode: 'MANUAL',
            },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_015_ACTIVE_TRASH_AND_REDEPLOY_SAME_NAME',
                },
            },
        },
    ],
    'SB01-016': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 필드의 [디펜더] 자신 유닛 1장마다 필드의 모든 자신 유닛 파워+1000.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 0, selectMode: 'ALL' },
            action: {
                type: 'BUFF_POWER',
                params: {
                    value: 1000,
                    dynamic: 'DEFENDER_UNIT_COUNT_MULTIPLIER',
                },
            },
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: '[디펜더] 상대 유닛 1장을 골라 이 턴이 끝날 때까지 공격할 수 없게 한다.',
            optional: true,
            targets: { scope: 'OPP_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'LOCK_ATTACK_UNTIL_TURN_END', params: {} },
            duration: 'TURN_END',
        },
    ],
    'SB01-017': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[가디언] 방벽[1].',
            action: { type: 'NONE', params: { guardianBarrierCost: 1 } },
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: '[디펜더] 패 1장을 트래시할 수 있다. 그러면 공격 유닛은 다음 상대 턴 종료까지 공격할 수 없다.',
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_017_DEFENDER_DISCARD_LOCK_ATTACKER_UNTIL_NEXT_OPP_TURN_END',
                },
            },
        },
    ],
    'SB01-018': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 조우 유닛이 4코스트 이상이라면 패 1장을 트래시할 수 있다. 그러면 조우 유닛과 장착 아이템을 모두 패로 되돌린다.',
            condition: { type: 'ENCOUNTER_COST_MIN', value: 4 },
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: { scope: 'ENCOUNTER', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'RETURN_UNIT_AND_ITEMS_TO_HAND', params: {} },
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: '[디펜더] 이 방어가 끝날 때까지 파워+3000.',
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'BATTLE_END',
        },
    ],
    'SB01-019': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 필드의 [디펜더] 자신 유닛은 "[디펜더] 상대에게 1대미지"를 얻는다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'HAS_KEYWORD', value: '디펜더' }],
                selectMode: 'ALL',
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.DEFENDER,
                        description: '[디펜더] 상대에게 1대미지를 준다.',
                        action: { type: 'DAMAGE', params: { value: 1 } },
                    },
                },
            },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 이 유닛의 파워가 5000 이상이면 필드의 [디펜더] 자신 유닛은 "[디펜더] 카드 1장 드로우"를 추가로 얻는다.',
            condition: { type: 'SELF_POWER_MIN', value: 5000 },
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'HAS_KEYWORD', value: '디펜더' }],
                selectMode: 'ALL',
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.DEFENDER,
                        description: '[디펜더] 카드를 1장 드로우한다.',
                        action: { type: 'DRAW', params: { count: 1 } },
                    },
                },
            },
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: '[디펜더] 이 방어가 끝날 때까지 파워+4000.',
            action: { type: 'BUFF_POWER', params: { value: 4000 } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 트래시한다.',
            action: { type: 'TRASH_SELF', params: {} },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '필드의 상대 유닛 중 코스트가 가장 낮은 유닛 1장을 골라 그 유닛과 장착 아이템을 모두 패로 되돌린다.',
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'LOWEST_COST_ONLY' }],
                selectMode: 'MANUAL',
            },
            action: { type: 'RETURN_UNIT_AND_ITEMS_TO_HAND', params: {} },
        },
    ],
    'SB01-020': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 필드의 [디펜더] 자신 유닛은 "[패시브] 조우 유닛은 광전사를 얻는다"를 얻는다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                filters: [{ type: 'HAS_KEYWORD', value: '디펜더' }],
                selectMode: 'ALL',
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: '패시브 : 조우 유닛은 광전사를 얻는다.',
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
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 이 유닛의 파워가 6000 이상이라면 상대 효과로 트래시될 때 패 1장을 트래시해 파괴를 대체할 수 있다.',
            condition: {
                type: 'ALL',
                value: [
                    { type: 'SELF_POWER_MIN', value: 6000 },
                    { type: 'TRASH_REASON', value: ['EFFECT'] },
                ],
            },
            action: {
                type: 'NONE',
                params: {
                    destroyReplacement: 'SB01_020_DISCARD_HAND_PREVENT_DESTROY',
                },
            },
        },
        {
            activation: ActivationCondition.DEFENDER,
            description: '[디펜더] 이 방어가 끝날 때까지 파워+4000.',
            action: { type: 'BUFF_POWER', params: { value: 4000 } },
            duration: 'BATTLE_END',
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 자신의 패에 넣는다.',
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    'SB01-021': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 필드의 자신 유닛 수만큼 손/트래시에서 아이템을 골라 사이즈를 무시하고 1장씩 장착한다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_021_ENTRY_PROMPT_SELECT_ITEMS_AND_EQUIP',
                },
            },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '[암드] 아이템 장착 자신 유닛이 3장 이상이라면 파워+2000.',
            condition: {
                type: 'ALL',
                value: [
                    { type: 'HAS_ITEM', value: { minCount: 1 } },
                    { type: 'EQUIPPED_UNIT_COUNT_MIN', value: 3 },
                ],
            },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '[암드] 아이템 장착 자신 유닛이 3장 이상이라면 히트+1.',
            condition: {
                type: 'ALL',
                value: [
                    { type: 'HAS_ITEM', value: { minCount: 1 } },
                    { type: 'EQUIPPED_UNIT_COUNT_MIN', value: 3 },
                ],
            },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: '트리거 / 이 카드를 자신의 패에 넣는다.',
            action: { type: 'RETURN_TO_HAND', params: {} },
        },
    ],
    'SB01-022': [
        {
            activation: ActivationCondition.PASSIVE,
            description: '[패시브] 필드의 모든 자신 유닛은 "[암드] 조우 유닛이 전투나 자신의 효과로 트래시되면 상대는 패를 1장 트래시"를 얻는다.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 0,
                selectMode: 'ALL',
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ON_KILL,
                        description: '[암드] 조우 유닛이 전투나 자신의 효과로 트래시되면 상대는 패를 1장 트래시한다.',
                        condition: {
                            type: 'ALL',
                            value: [
                                { type: 'HAS_ITEM', value: { minCount: 1 } },
                                { type: 'TRASH_REASON', value: ['BATTLE', 'EFFECT'] },
                            ],
                        },
                        targets: {
                            scope: 'OPP_HAND',
                            type: 'CARD',
                            count: 1,
                            selectMode: 'MANUAL',
                        },
                        action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } },
                    },
                },
            },
        },
    ],
    'SB01-023': [
        {
            activation: ActivationCondition.ENTRY,
            description: '[엔트리] 자신의 패를 최대 2장 트래시한다. 그 수만큼 드로우. 이 효과로 아이템 2장 이상 트래시했다면 추가 1드로우.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_023_ENTRY_DISCARD_UP_TO_TWO_THEN_DRAW',
                },
            },
        },
    ],
    'SB01-024': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: '[암드][액티브: 메인] 아이템 장착 중이라면 트래시에서 장착 수 이하 코스트 카드 1장을 패에 넣는다.',
            condition: { type: 'HAS_ITEM', value: { minCount: 1 } },
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_024_ACTIVE_MAIN_RECOVER_FROM_TRASH_BY_EQUIPPED_COUNT',
                },
            },
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: '[암드] 아이템을 장착하고 있다면 파워+3000.',
            condition: { type: 'HAS_ITEM', value: { minCount: 1 } },
            targets: { scope: 'SELF', type: 'UNIT', count: 1, selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
        },
    ],
    'SB01-025': [
        {
            activation: ActivationCondition.ACTIVE,
            description: '패의 아이템을 1장 이상 트래시한다. 트래시한 수만큼 드로우한다.',
            action: {
                type: 'COMPLEX_ACTION',
                params: {
                    mode: 'SB01_025_ACTIVE_DISCARD_ITEMS_AND_DRAW',
                },
            },
        },
    ],
};
