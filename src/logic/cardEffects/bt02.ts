import { ActivationCondition, CardType, Effect } from '../types';

export const BT02_EFFECTS: Record<string, Effect[]> = {
    'BT02-001': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: gain attacker +1500 this turn.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: 'Granted attacker +1500',
                        action: { type: 'BUFF_POWER', params: { value: 1500 } }
                    }
                }
            },
            duration: 'TURN_END'
        }
    ],
    'BT02-002': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: all your units gain attacker +500 this turn.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: 'Granted attacker +500',
                        action: { type: 'BUFF_POWER', params: { value: 500 } }
                    }
                }
            },
            duration: 'TURN_END'
        }
    ],
    'BT02-003': [
        {
            activation: ActivationCondition.ATTACKER,
            description: 'Attacker: gain dualist for this combat.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: 'DUALIST',
                        action: { type: 'NONE', params: { keyword: 'DUALIST' } }
                    }
                }
            },
            duration: 'BATTLE_END'
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: 'Attacker: +4000 power for this attack.',
            action: { type: 'BUFF_POWER', params: { value: 4000 } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: return this card to hand.',
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    'BT02-004': [],
    'BT02-005': [
        {
            activation: ActivationCondition.ATTACKER,
            description: 'Attacker: +3000 power for this attack.',
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'TURN_END'
        }
    ],
    'BT02-006': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: recover a cost 2 or less unit from trash.',
            targets: {
                scope: 'MY_TRASH',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 2 }],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    'BT02-007': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'All your units gain attacker plunder[1] this turn.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: 'Granted plunder[1]',
                        action: { type: 'PLUNDER', params: { value: 1 } }
                    }
                }
            },
            duration: 'TURN_END'
        }
    ],
    'BT02-008': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Recover a cost 7 or higher unit from trash.',
            targets: {
                scope: 'MY_TRASH',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_MIN', value: 7 }],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    'BT02-009': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Equip: host cost 3 or less gets +4000 power.',
            targets: {
                scope: 'SELF',
                type: 'UNIT',
                filters: [{ type: 'COST_LIMIT', value: 3 }],
                selectMode: 'ALL'
            },
            action: { type: 'BUFF_POWER', params: { value: 4000 } }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Host gains berserk.',
            action: { type: 'NONE', params: { keyword: 'BERSERK' } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: recover a cost 2 or less unit from trash.',
            targets: {
                scope: 'MY_TRASH',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'COST_LIMIT', value: 2 }],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    'BT02-010': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: reveal top 1, take a Base unit.',
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 1,
                    filter: { type: 'HAS_TRAIT', value: '베이스' }
                }
            }
        }
    ],
    'BT02-011': [
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: leader level +1.',
            action: { type: 'GAIN_LEVEL', params: { value: 1 } }
        }
    ],
    'BT02-012': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Passive: +1 hit per friendly Base unit.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_HIT', params: { value: 1, dynamic: 'BASE_UNIT_COUNT_MULTIPLIER' } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: return this card to hand.',
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    'BT02-013': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: choose a friendly unit, +2000 this turn.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END'
        }
    ],
    'BT02-014': [],
    'BT02-015': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'If all your unit zones are occupied, gain 1 level.',
            condition: { type: 'FRONTLINE' },
            action: { type: 'GAIN_LEVEL', params: { value: 1 } }
        }
    ],
    'BT02-016': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Choose a unit with an equipped item and trash one equipped item.',
            targets: {
                scope: 'BOTH_FIELDS',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'ITEM_COUNT_MIN', value: 1 }],
                selectMode: 'MANUAL'
            },
            action: { type: 'DESTROY_EQUIPPED_ITEM', params: {} }
        }
    ],
    'BT02-017': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'All your Base units get +1500 until opponent turn end.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                filters: [{ type: 'HAS_TRAIT', value: '베이스' }],
                selectMode: 'ALL'
            },
            action: { type: 'BUFF_POWER', params: { value: 1500 } },
            duration: 'OPP_TURN_END'
        }
    ],
    'BT02-018': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'If host has Base trait, host gets +1 hit.',
            targets: {
                scope: 'SELF',
                type: 'UNIT',
                filters: [{ type: 'HAS_TRAIT', value: '베이스' }],
                selectMode: 'ALL'
            },
            action: { type: 'BUFF_HIT', params: { value: 1 } }
        }
    ],
    'BT02-019': [
        {
            activation: ActivationCondition.EXIT,
            description: 'Exit: choose a friendly unit, +1 hit this turn.',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END'
        }
    ],
    'BT02-020': [
        {
            activation: ActivationCondition.UNIT_TRASHED,
            description: 'When another unit is trashed by effect, this gets +1000 this turn.',
            condition: { type: 'UNIT_TRASHED_OTHER', trashedByEffectOnly: true } as any,
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 1000 } },
            duration: 'TURN_END'
        }
    ],
    'BT02-021': [
        {
            activation: ActivationCondition.DEFENDER,
            description: 'Defender: terminate the current attack and trash this unit.',
            action: { type: 'TERMINATE_ATTACK', params: {} }
        }
    ],
    'BT02-022': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'If 2+ of your units were trashed by effects this turn, deal 1 damage.',
            condition: { type: 'EFFECT_TRASHED_UNITS_THIS_TURN', value: 2 } as any,
            action: { type: 'DAMAGE', params: { value: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: return this card to hand.',
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    'BT02-023': [],
    'BT02-024': [
        {
            activation: ActivationCondition.EXIT,
            description: 'Exit: mutual destruction.',
            action: { type: 'MUTUAL_DESTRUCTION', params: {} }
        }
    ],
    'BT02-025': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Recover a cost 2 or less Exit unit from trash.',
            targets: {
                scope: 'MY_TRASH',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_KEYWORD', value: '엑시트' }, { type: 'COST_LIMIT', value: 2 }],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: recover an Exit unit from trash.',
            targets: {
                scope: 'MY_TRASH',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_KEYWORD', value: '엑시트' }],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    'BT02-026': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Trash 1 unit from hand, draw cards equal to its hit.',
            cost: { type: 'TRASH_HAND', amount: 1, cardTypeFilter: CardType.UNIT },
            action: { type: 'DRAW_DYNAMIC', params: { multiplier: 'COST_PAYMENT_HIT' } }
        }
    ],
    'BT02-027': [
        {
            activation: ActivationCondition.TURN_END,
            description: 'At opponent turn end, trash host unit.',
            condition: { type: 'OPPONENT_TURN' },
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'DESTROY_UNIT', params: {} }
        }
    ],
    'BT02-028': [
        {
            activation: ActivationCondition.AWAKEN,
            description: 'Awaken at leader level 5.',
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Awakened: your Guardian units get +1000.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                filters: [{ type: 'HAS_KEYWORD', value: '가디언' }],
                selectMode: 'ALL'
            },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    'BT02-029': [
        {
            activation: ActivationCondition.DEFENDER,
            description: 'Defender: +2000 power until end of battle.',
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    'BT02-030': [],
    'BT02-031': [
        {
            activation: ActivationCondition.DEFENDER,
            description: 'Defender: +2000 power until end of battle.',
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    'BT02-032': [
        {
            activation: ActivationCondition.ATTACKER,
            description: 'Attacker: breakthrough against cost 6 or higher.',
            action: { type: 'BREAKTHROUGH', params: { costMin: 6 } }
        }
    ],
    'BT02-033': [],
    'BT02-034': [],
    'BT02-035': [
        {
            activation: ActivationCondition.ATTACKER,
            description: 'Attacker: gain infiltration this combat.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: 'INFILTRATION',
                        action: { type: 'NONE', params: { keyword: 'INFILTRATION' } }
                    }
                }
            },
            duration: 'BATTLE_END'
        }
    ],
    'BT02-036': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: choose a friendly Guardian, +1 hit this turn.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_KEYWORD', value: '가디언' }],
                selectMode: 'MANUAL'
            },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: return lowest-cost opponent unit and its items to hand.',
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'LOWEST_COST_IN_SCOPE' }],
                selectMode: 'MANUAL'
            },
            action: { type: 'RETURN_UNIT_AND_ITEMS_TO_HAND', params: {} }
        }
    ],
    'BT02-037': [],
    'BT02-038': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Passive: your Defender units get +2000.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                filters: [{ type: 'HAS_KEYWORD', value: '디펜더' }],
                selectMode: 'ALL'
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    'BT02-039': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: +2000 power until opponent turn end.',
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'OPP_TURN_END'
        }
    ],
    'BT02-040': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: draw 1.',
            action: { type: 'DRAW', params: { count: 1 } }
        }
    ],
    'BT02-041': [
        {
            activation: ActivationCondition.ATTACKER,
            description: 'Attacker: if hand is 5+, gain breakthrough against cost 6+.',
            condition: { type: 'HAND_COUNT', value: 5 } as any,
            action: { type: 'BREAKTHROUGH', params: { costMin: 6 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: draw 1.',
            action: { type: 'DRAW', params: { count: 1 } }
        }
    ],
    'BT02-042': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: move a skill from trash to top of deck.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [{ type: 'CARD_TYPE', value: CardType.SKILL }],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_DECK_TOP', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: return this card to hand.',
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    'BT02-043': [
        {
            activation: ActivationCondition.DEFENDER,
            description: 'Defender: +4000 power until end of battle.',
            action: { type: 'BUFF_POWER', params: { value: 4000 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: return lowest-cost opponent unit and items to hand.',
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'LOWEST_COST_IN_SCOPE' }],
                selectMode: 'MANUAL'
            },
            action: { type: 'RETURN_UNIT_AND_ITEMS_TO_HAND', params: {} }
        }
    ],
    'BT02-044': [],
    'BT02-045': [
        {
            id: 'BT02-045-HAND-DISCARD',
            activation: ActivationCondition.HAND_DISCARDED,
            description: 'Once each turn, when your hand is trashed by effect, draw 1.',
            condition: { type: 'ONCE_PER_TURN' },
            action: { type: 'DRAW', params: { count: 1 } }
        }
    ],
    'BT02-046': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Passive: opponent units of cost 3+ gain berserk.',
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                filters: [{ type: 'COST_MIN', value: 3 }],
                selectMode: 'ALL'
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: 'BERSERK',
                        action: { type: 'NONE', params: { keyword: 'BERSERK' } }
                    }
                }
            }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: return this card to hand.',
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    'BT02-047': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Choose your Defender unit. It gets +3500 this turn.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_KEYWORD', value: '디펜더' }],
                selectMode: 'MANUAL'
            },
            action: { type: 'BUFF_POWER', params: { value: 3500 } },
            duration: 'TURN_END'
        }
    ],
    'BT02-048': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Choose two friendly units; second gains power equal to first current power.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 2,
                selectMode: 'MANUAL'
            },
            action: { type: 'BUFF_POWER_FROM_FIRST_TO_SECOND', params: {} },
            duration: 'TURN_END'
        }
    ],
    'BT02-049': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Choose 2 friendly Defenders, deal 1 damage and they cannot attack this turn.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 2,
                filters: [{ type: 'HAS_KEYWORD', value: '디펜더' }],
                selectMode: 'MANUAL'
            },
            action: { type: 'DAMAGE_AND_EXHAUST_SELECTED', params: { damage: 1 } }
        }
    ],
    'BT02-050': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Choose your Guardian unit. +2000 this turn, and if hand is 5+ also +1 hit.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'HAS_KEYWORD', value: '가디언' }],
                selectMode: 'MANUAL'
            },
            action: { type: 'BUFF_POWER_AND_HIT_IF_HAND', params: { power: 2000, hit: 1, handCount: 5 } },
            duration: 'TURN_END'
        }
    ],
    'BT02-051': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Trash 2 cards from hand, then deal 1 damage.',
            cost: { type: 'TRASH_HAND', amount: 2 },
            action: { type: 'DAMAGE', params: { value: 1 } }
        }
    ],
    'BT02-052': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Host cost 3 or less gets +1000 power.',
            targets: {
                scope: 'SELF',
                type: 'UNIT',
                filters: [{ type: 'COST_LIMIT', value: 3 }],
                selectMode: 'ALL'
            },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    'BT02-053': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'If host has Guardian, +2000 power.',
            targets: {
                scope: 'SELF',
                type: 'UNIT',
                filters: [{ type: 'HAS_KEYWORD', value: '가디언' }],
                selectMode: 'ALL'
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    'BT02-054': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Equip condition: host cost 4 or higher.',
            condition: { type: 'COST_COMPARISON', value: { operator: 'GTE', cost: 4 } as any },
            action: { type: 'NONE', params: {} }
        },
        {
            activation: ActivationCondition.ATTACKER,
            description: 'Attacker: gain infiltration this combat.',
            condition: { type: 'COST_COMPARISON', value: { operator: 'GTE', cost: 4 } as any },
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.PASSIVE,
                        description: 'INFILTRATION',
                        action: { type: 'NONE', params: { keyword: 'INFILTRATION' } }
                    }
                }
            },
            duration: 'BATTLE_END'
        }
    ],
    'BT02-055': [
        {
            activation: ActivationCondition.AWAKEN,
            description: 'Awaken at leader level 6.',
            condition: { type: 'LEADER_LEVEL', value: 6 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Awakened: your equipped units get +1500.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                filters: [{ type: 'ITEM_COUNT_MIN', value: 1 }],
                selectMode: 'ALL'
            },
            action: { type: 'BUFF_POWER', params: { value: 1500 } }
        }
    ],
    'BT02-056': [
        {
            activation: ActivationCondition.EXIT,
            description: 'Exit: recover a cost 1 item from trash.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [{ type: 'CARD_TYPE', value: CardType.ITEM }, { type: 'COST_EQUAL', value: 1 }],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    'BT02-057': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Armed: +2000 power per equipped item.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000, dynamic: 'EQUIPPED_ITEM_COUNT_MULTIPLIER' } }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: 'If 3+ items equipped, gain attacker draw 1.',
            condition: { type: 'HAS_ITEM', value: { min: 3 } },
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: 'Granted attacker draw 1',
                        action: { type: 'DRAW', params: { count: 1 } }
                    }
                }
            }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: draw 2 then discard 2 from hand.',
            action: { type: 'DRAW_THEN_DISCARD', params: { drawCount: 2, discardCount: 2, discardFrom: 'HAND' } }
        }
    ],
    'BT02-058': [
        {
            activation: ActivationCondition.EXIT,
            description: 'Exit: swap an item between damage and hand.',
            action: { type: 'SWAP_DAMAGE_ITEM_WITH_HAND', params: {} }
        }
    ],
    'BT02-059': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: optionally return one equipped item from a friendly unit to hand.',
            optional: true,
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'ITEM_COUNT_MIN', value: 1 }],
                selectMode: 'MANUAL'
            },
            action: { type: 'RETURN_FIRST_EQUIPPED_ITEM_TO_HAND', params: {} }
        }
    ],
    'BT02-060': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Passive: +2000 power per your equipped unit.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000, dynamic: 'EQUIPPED_UNIT_COUNT_MULTIPLIER' } }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: 'If you control 3+ equipped units, +1 hit.',
            condition: { type: 'EQUIPPED_UNIT_COUNT', value: 3 } as any,
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_HIT', params: { value: 1 } }
        }
    ],
    'BT02-061': [],
    'BT02-062': [
        {
            activation: ActivationCondition.ATTACKER,
            description: 'Armed attacker: if equipped, gain penetration[1].',
            condition: { type: 'HAS_ITEM' },
            action: { type: 'PENETRATION', params: { value: 1 } }
        }
    ],
    'BT02-063': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: optionally trash an item from hand to destroy encounter unit.',
            optional: true,
            cost: { type: 'TRASH_HAND', amount: 1, cardTypeFilter: CardType.ITEM },
            targets: { scope: 'ENCOUNTER_UNIT', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'DESTROY_UNIT', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: search deck for an item cost 1 or less.',
            action: {
                type: 'SEARCH_DECK_TO_HAND',
                params: {
                    count: 1,
                    shuffleAfter: true,
                    filters: [
                        { type: 'CARD_TYPE', value: CardType.ITEM },
                        { type: 'COST_LIMIT', value: 1 }
                    ]
                }
            }
        }
    ],
    'BT02-064': [],
    'BT02-065': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Armed Unique (approx): if equipped, +2500 power.',
            condition: { type: 'HAS_ITEM' },
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2500 } }
        }
    ],
    'BT02-066': [
        {
            activation: ActivationCondition.EXIT,
            description: 'Armed: when trashed, return one equipped item to hand.',
            condition: { type: 'HAS_ITEM' },
            action: { type: 'RETURN_FIRST_EQUIPPED_ITEM_TO_HAND', params: {} }
        }
    ],
    'BT02-067': [
        {
            activation: ActivationCondition.ATTACKER,
            description: 'Armed Unique (approx): if equipped, gain breakthrough.',
            condition: { type: 'HAS_ITEM' },
            action: { type: 'BREAKTHROUGH', params: { unconditional: true } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: return this card to hand.',
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    'BT02-068': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: reveal top 2 and choose 1 item.',
            action: {
                type: 'REVEAL_TOP_AND_CHOOSE_TO_HAND',
                params: {
                    count: 2,
                    filter: { type: 'CARD_TYPE', value: CardType.ITEM }
                }
            }
        }
    ],
    'BT02-069': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Armed: prevent destruction by trashing one equipped item.',
            condition: { type: 'HAS_ITEM' },
            action: { type: 'NONE', params: { preventDestroyBy: 'TRASH_ITEM' } }
        }
    ],
    'BT02-070': [],
    'BT02-071': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: optionally put up to 3 items from trash to deck bottom.',
            optional: true,
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 3,
                filters: [{ type: 'CARD_TYPE', value: CardType.ITEM }],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_DECK_BOTTOM', params: {} }
        },
        {
            activation: ActivationCondition.ENTRY,
            description: 'Then destroy encounter unit.',
            targets: { scope: 'ENCOUNTER_UNIT', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'DESTROY_UNIT', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: return this card to hand.',
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    'BT02-072': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Armed: if equipped, +1 hit.',
            condition: { type: 'HAS_ITEM' },
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_HIT', params: { value: 1 } }
        }
    ],
    'BT02-073': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Swap an item between damage and hand.',
            action: { type: 'SWAP_DAMAGE_ITEM_WITH_HAND', params: {} }
        }
    ],
    'BT02-074': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Search deck for a Unique item.',
            action: {
                type: 'SEARCH_DECK_TO_HAND',
                params: {
                    count: 1,
                    shuffleAfter: true,
                    filters: [
                        { type: 'CARD_TYPE', value: CardType.ITEM },
                        { type: 'HAS_TRAIT', value: '유니크' }
                    ]
                }
            }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: search deck for an item cost 1 or less.',
            action: {
                type: 'SEARCH_DECK_TO_HAND',
                params: {
                    count: 1,
                    shuffleAfter: true,
                    filters: [
                        { type: 'CARD_TYPE', value: CardType.ITEM },
                        { type: 'COST_LIMIT', value: 1 }
                    ]
                }
            }
        }
    ],
    'BT02-075': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Choose a unit with an equipped item, move one equipped item to deck bottom.',
            targets: {
                scope: 'BOTH_FIELDS',
                type: 'UNIT',
                count: 1,
                filters: [{ type: 'ITEM_COUNT_MIN', value: 1 }],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_EQUIPPED_ITEM_TO_DECK_BOTTOM', params: {} }
        }
    ],
    'BT02-076': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Recover an item cost 1 or less from trash.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                filters: [{ type: 'CARD_TYPE', value: CardType.ITEM }, { type: 'COST_LIMIT', value: 1 }],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    'BT02-077': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Reveal top 5 and take revealed items.',
            action: {
                type: 'REVEAL_TOP_AND_TAKE_ALL_BY_FILTER',
                params: {
                    count: 5,
                    filter: { type: 'CARD_TYPE', value: CardType.ITEM }
                }
            }
        }
    ],
    'BT02-078': [],
    'BT02-079': [
        {
            activation: ActivationCondition.ATTACKER,
            description: 'Attacker: +2000 power for this attack.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'TURN_END'
        }
    ],
    'BT02-080': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'If host has Armed, +3000 power.',
            targets: {
                scope: 'SELF',
                type: 'UNIT',
                filters: [{ type: 'HAS_KEYWORD', value: '암드' }],
                selectMode: 'ALL'
            },
            action: { type: 'BUFF_POWER', params: { value: 3000 } }
        }
    ],
    'BT02-081': [
        {
            id: 'BT02-081-PREVENT',
            activation: ActivationCondition.PASSIVE,
            description: 'Once each turn, prevent host destruction by discarding hand equal to host hit.',
            condition: { type: 'ONCE_PER_TURN' },
            action: { type: 'NONE', params: { preventDestroyBy: 'DISCARD_HIT' } }
        }
    ],
};
