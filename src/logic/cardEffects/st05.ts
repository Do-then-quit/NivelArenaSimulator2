import { ActivationCondition, CardType, Effect } from '../types';

export const ST05_EFFECTS: Record<string, Effect[]> = {
    'ST05-001': [
        {
            activation: ActivationCondition.AWAKEN,
            description: 'Awaken at leader level 5.',
            condition: { type: 'LEADER_LEVEL', value: 5 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: 'AWAKENED: Your Armed units get +1000 power.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                selectMode: 'ALL',
                filters: [{ type: 'HAS_KEYWORD', value: '암드' }]
            },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    'ST05-003': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: Draw 1, then discard 1 from hand.',
            action: { type: 'DRAW_THEN_DISCARD', params: { drawCount: 1, discardCount: 1, discardFrom: 'HAND' } }
        }
    ],
    'ST05-005': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Armed: If equipped with item, +1000 power.',
            condition: { type: 'HAS_ITEM' },
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    'ST05-006': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: Search deck for a cost 2 item card, add to hand, then shuffle.',
            action: {
                type: 'SEARCH_DECK_TO_HAND',
                params: {
                    count: 1,
                    shuffleAfter: true,
                    filters: [
                        { type: 'CARD_TYPE', value: CardType.ITEM },
                        { type: 'COST_EQUAL', value: 2 }
                    ]
                }
            }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Search deck for an item card with cost 1 or less, add to hand, then shuffle.',
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
    'ST05-007': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Armed: +1000 power per equipped item.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 1000, dynamic: 'EQUIPPED_ITEM_COUNT_MULTIPLIER' } }
        }
    ],
    'ST05-008': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Your Armed units get +1000 power.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                selectMode: 'ALL',
                filters: [{ type: 'HAS_KEYWORD', value: '암드' }]
            },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    'ST05-010': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Armed: If equipped with item, +2000 power.',
            condition: { type: 'HAS_ITEM' },
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    'ST05-011': [
        {
            activation: ActivationCondition.ATTACKER,
            description: 'Armed attacker: If equipped, opponent discards 1 card.',
            condition: { type: 'HAS_ITEM' },
            targets: { scope: 'OPP_HAND', type: 'CARD', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DISCARD', params: { target: 'OPPONENT', count: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Return this card to your hand.',
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    'ST05-012': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Recover 1 item card from your trash to your hand.',
            targets: {
                scope: 'MY_TRASH',
                type: 'CARD',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'CARD_TYPE', value: CardType.ITEM }]
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Search deck for an item card with cost 1 or less, add to hand, then shuffle.',
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
    'ST05-013': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Choose your unit. Draw cards equal to equipped item count (cost 1 or higher).',
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DRAW_BY_EQUIPPED_ITEM_COUNT', params: { costMin: 1 } }
        }
    ],
    'ST05-014': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Choose your unit with 2+ equipped items, trash it, then trash an opponent unit.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'ITEM_COUNT_MIN', value: 2 }]
            },
            action: { type: 'DESTROY_SELECTED_AND_DESTROY_OPPONENT', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Draw 2, then discard 2 from hand.',
            action: { type: 'DRAW_THEN_DISCARD', params: { drawCount: 2, discardCount: 2, discardFrom: 'HAND' } }
        }
    ],
    'ST05-015': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Item passive: +1500 power.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 1500 } }
        }
    ],
    'ST05-016': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'If host has Armed, +1 hit.',
            condition: { type: 'HOST_HAS_KEYWORD', value: '암드' },
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_HIT', params: { value: 1 } }
        }
    ],
    'ST05-017': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Item passive: +2500 power.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2500 } }
        }
    ]
};

