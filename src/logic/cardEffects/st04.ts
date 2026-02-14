import { ActivationCondition, Effect } from '../types';

export const ST04_EFFECTS: Record<string, Effect[]> = {
    'ST04-001': [
        {
            activation: ActivationCondition.AWAKEN,
            description: 'Awaken at leader level 4.',
            condition: { type: 'LEADER_LEVEL', value: 4 },
            action: { type: 'AWAKEN' as any, params: {} }
        },
        {
            activation: ActivationCondition.PASSIVE,
            description: 'AWAKENED: During opponent turn, your units get +1000 power.',
            condition: { type: 'OPPONENT_TURN' },
            targets: { scope: 'MY_FIELD', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 1000 } }
        }
    ],
    'ST04-005': [
        {
            activation: ActivationCondition.ENTRY,
            description: 'Entry: Draw 1 card.',
            action: { type: 'DRAW', params: { count: 1 } }
        }
    ],
    'ST04-006': [
        {
            activation: ActivationCondition.DEFENDER,
            description: 'Defender: +3000 power until end of battle.',
            action: { type: 'BUFF_POWER', params: { value: 3000 } }
        }
    ],
    'ST04-007': [
        {
            activation: ActivationCondition.ATTACKER,
            description: 'Breakthrough against cost 4 or higher defenders.',
            action: { type: 'BREAKTHROUGH', params: { costMin: 4 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Return this card to your hand.',
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    'ST04-010': [
        {
            activation: ActivationCondition.PASSIVE,
            description: 'Guardian allies get +2000 power.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                selectMode: 'ALL',
                filters: [{ type: 'HAS_KEYWORD', value: '가디언' }]
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    'ST04-011': [
        {
            activation: ActivationCondition.DEFENDER,
            description: 'Defender: +2000 power until end of battle.',
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    'ST04-012': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Choose a friendly Guardian unit. It gets +2000 power until opponent turn end.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'HAS_KEYWORD', value: '가디언' }]
            },
            action: { type: 'BUFF_POWER', params: { value: 2000 } },
            duration: 'OPP_TURN_END'
        }
    ],
    'ST04-013': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Choose a friendly Guardian unit. It gets +1 hit until turn end.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'HAS_KEYWORD', value: '가디언' }]
            },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Draw 1 card.',
            action: { type: 'DRAW', params: { count: 1 } }
        }
    ],
    'ST04-014': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Draw 2 cards.',
            action: { type: 'DRAW', params: { count: 2 } }
        }
    ],
    'ST04-015': [
        {
            activation: ActivationCondition.ACTIVE,
            description: 'Choose a friendly Guardian unit. It gains unconditional breakthrough until turn end.',
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'HAS_KEYWORD', value: '가디언' }]
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: 'Granted unconditional breakthrough',
                        action: { type: 'BREAKTHROUGH', params: { unconditional: true } }
                    }
                }
            },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Return lowest-cost opponent unit and its attached items to hand.',
            targets: {
                scope: 'OPP_FIELD',
                type: 'UNIT',
                count: 1,
                selectMode: 'MANUAL',
                filters: [{ type: 'LOWEST_COST_IN_SCOPE' }]
            },
            action: { type: 'RETURN_UNIT_AND_ITEMS_TO_HAND', params: {} }
        }
    ],
    'ST04-016': [
        {
            activation: ActivationCondition.DEFENDER,
            description: 'Defender item: +2000 power until end of battle.',
            targets: { scope: 'SELF', type: 'UNIT', selectMode: 'ALL' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    'ST04-017': [
        {
            activation: ActivationCondition.ACTIVE_MAIN,
            description: 'Active Main: Draw 1 card.',
            condition: { type: 'HOST_HAS_KEYWORD', value: '디펜더' },
            action: { type: 'DRAW', params: { count: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Trash this card.',
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: 'Trigger: Draw 1 card.',
            action: { type: 'DRAW', params: { count: 1 } }
        }
    ]
};

