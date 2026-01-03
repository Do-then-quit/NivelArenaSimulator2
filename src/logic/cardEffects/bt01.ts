import { Effect, ActivationCondition, CardType } from '../types';

export const BT01_EFFECTS: Record<string, Effect[]> = {
    'BT01-072': [
        {
            activation: ActivationCondition.PASSIVE,
            description: "Passive: All other friendly units gain 'Exit: Draw 1'",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                filters: [
                    { type: 'EXCLUDE_SELF' }
                ],
                selectMode: 'ALL'
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    effect: {
                        activation: ActivationCondition.EXIT,
                        description: "Granted: Exit: Draw 1",
                        action: {
                            type: 'DRAW',
                            params: { value: 1 }
                        }
                    }
                }
            }
        }
    ],
    'BT01-019': [
        {
            activation: ActivationCondition.ENTRY,
            description: "Entry: All friendly units gain 'Attacker: Penetration[1]' until end of turn.",
            targets: {
                scope: 'MY_FIELD',
                type: 'UNIT',
                selectMode: 'ALL'
            },
            action: {
                type: 'GRANT_EFFECT',
                params: {
                    duration: 'TURN_END',
                    effect: {
                        activation: ActivationCondition.ATTACKER,
                        description: "Granted: Penetration[1]",
                        action: {
                            type: 'PENETRATION',
                            params: { value: 1 }
                        }
                    }
                }
            }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "Trigger: Return this card to hand.",
            action: {
                type: 'RETURN_TO_HAND',
                params: {}
            }
        }
    ],
    'BT01-005': [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 광전사 (이 유닛은 가능하다면 반드시 공격해야 한다).",
            action: { type: 'NONE', params: {} }
        }
    ],
    'BT01-014': [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 광전사 (이 유닛은 가능하다면 반드시 공격해야 한다).",
            action: { type: 'NONE', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다. 자신의 트래시 존에서 2코스트 이하인 유닛을 1장 골라 자신의 패에 넣는다.",
            action: { type: 'TRASH_SELF', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "트리거 / 이 카드를 트래시한다. 자신의 트래시 존에서 2코스트 이하인 유닛을 1장 골라 자신의 패에 넣는다. (후속효과)",
            targets: {
                scope: 'MY_TRASH',
                type: 'UNIT',
                filters: [{ type: 'COST_LIMIT', value: 2 }],
                selectMode: 'MANUAL'
            },
            action: { type: 'MOVE_FROM_TRASH_TO_HAND', params: {} }
        }
    ],
    'BT01-060': [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 이 유닛으로 공격하려면 자신의 패를 1장 골라 트래시해야 한다.",
            action: { type: 'NONE', params: {} }
        }
    ],
    'BT01-065': [
        {
            activation: ActivationCondition.PASSIVE,
            description: "패시브 : 이 유닛으로 공격하려면 자신의 패를 1장 골라 트래시해야 한다.",
            action: { type: 'NONE', params: {} }
        }
    ]
};
