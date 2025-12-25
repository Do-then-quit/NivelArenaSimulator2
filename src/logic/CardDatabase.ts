import { Card, CardType, Attribute, ActivationCondition, Effect } from './types';
import rawST02 from '../../ST02.json';

const MANUAL_EFFECTS: Record<string, Effect[]> = {
    "ST02-001": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "각성면 패시브 : 자신의 사이즈+1.",
            action: { type: 'MODIFY_PLAYER_SIZE', params: { value: 1 } }
        }
    ],
    "ST02-003": [
        {
            activation: ActivationCondition.EXIT,
            description: "자신의 리더 레벨+1.",
            action: { type: 'GAIN_LEVEL', params: { value: 1 } }
        }
    ],
    "ST02-005": [
        {
            activation: ActivationCondition.ENTRY,
            description: "자신의 리더 레벨+1.",
            action: { type: 'GAIN_LEVEL', params: { value: 1 } }
        }
    ],
    "ST02-007": [
        {
            activation: ActivationCondition.ACTIVE,
            description: "자신의 패를 1장 골라 트래시한다. 그러면 필드에 있는 《베이스》를 가진 모든 자신 유닛은 이 턴이 끝날 때까지 히트+1.",
            cost: { type: 'TRASH_HAND', amount: 1 },
            targets: { scope: 'MY_FIELD', type: 'UNIT', conditions: { hasTrait: '베이스' }, selectMode: 'ALL', count: 0 },
            action: { type: 'BUFF_HIT', params: { value: 1 } },
            duration: 'TURN_END'
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다. 자신의 리더 레벨+1.",
            action: { type: 'GAIN_LEVEL', params: { value: 1 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ],
    "ST02-009": [
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다. 필드에 있는 3코스트 이하인 상대 유닛을 1장 골라 트래시한다.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', conditions: { costMax: 3 }, selectMode: 'MANUAL', count: 1 },
            action: { type: 'DESTROY_UNIT', params: { costMax: 3 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ],
    "ST02-010": [
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 자신의 패에 넣는다.",
            action: { type: 'RETURN_TO_HAND', params: {} }
        }
    ],
    "ST02-011": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "이 유닛의 파워가 자신의 리더 레벨×1000만큼 증가한다.",
            condition: { type: 'ALWAYS' },
            action: { type: 'BUFF_POWER', params: { value: 1000, dynamic: 'LEADER_LEVEL_MULTIPLIER' } }
        }
    ],
    "ST02-012": [
        {
            activation: ActivationCondition.ENTRY,
            description: "필드에 있는 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 파워+3000.",
            targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
            action: { type: 'BUFF_POWER', params: { value: 3000 } },
            duration: 'TURN_END'
        }
    ],
    "ST02-013": [
        {
            activation: ActivationCondition.ENTRY,
            description: "자신의 리더 레벨+1.",
            action: { type: 'GAIN_LEVEL', params: { value: 1 } }
        }
    ],
    "ST02-014": [
        {
            activation: ActivationCondition.ENTRY,
            description: "자신의 덱 맨 위에서 3장 공개 -> 1장 패",
            action: { type: 'DRAW', params: { count: 1, selection: 'LOOK_3_PICK_1' } }
        }
    ],
    "ST02-015": [
        {
            activation: ActivationCondition.ENTRY,
            description: "자신 유닛과 상대 유닛이 모두 있는 레인을 하나 골라, 그 레인에서 파워가 가장 낮은 유닛을 트래시한다. 같다면 모두 트래시한다.",
            targets: { scope: 'SHARED_LANE', type: 'ALL', count: 1, selectMode: 'MANUAL' },
            action: { type: 'DESTROY_LANE_LOWEST', params: {} }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다. 필드에 있는 3코스트 이하인 상대 유닛을 1장 골라 트래시한다.",
            targets: { scope: 'OPP_FIELD', type: 'UNIT', conditions: { costMax: 3 }, selectMode: 'MANUAL', count: 1 },
            action: { type: 'DESTROY_UNIT', params: { costMax: 3 } }
        },
        {
            activation: ActivationCondition.DAMAGE_TRIGGER,
            description: "이 카드를 트래시한다.",
            action: { type: 'TRASH_SELF', params: {} }
        }
    ],
    "ST02-016": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "파워+2000",
            condition: { type: 'ALWAYS' },
            action: { type: 'BUFF_POWER', params: { value: 2000 } }
        }
    ],
    "ST02-017": [
        {
            activation: ActivationCondition.PASSIVE,
            description: "히트+1",
            condition: { type: 'COST_COMPARISON', value: { operator: 'GTE', cost: 4 } },
            action: { type: 'BUFF_HIT', params: { value: 1 } }
        }
    ]
};

function mapType(rawType: string): CardType {
    switch (rawType) {
        case '리더': return CardType.LEADER;
        case '유닛': return CardType.UNIT;
        case '스킬': return CardType.SKILL;
        case '아이템': return CardType.ITEM;
        default: return CardType.UNIT;
    }
}

function mapAttribute(rawAttr: string): Attribute {
    switch (rawAttr) {
        case '화염': return Attribute.FIRE;
        case '대지': return Attribute.EARTH;
        case '폭풍': return Attribute.STORM;
        case '파도': return Attribute.WATER;
        case '번개': return Attribute.LIGHTNING;
        case '없음': return Attribute.NONE;
        default: return Attribute.NONE;
    }
}

export const DUMMY_CARDS: Card[] = rawST02.map((raw: any) => ({
    id: raw.id,
    name: raw.name,
    type: mapType(raw.type),
    attribute: mapAttribute(raw.attribute),
    cost: raw.cost === '레어도' ? 0 : parseInt(raw.cost),
    power: raw.power === '-' ? undefined : parseInt(raw.power),
    hit: raw.hit === '-' ? undefined : parseInt(raw.hit),
    text: raw.text,
    traits: raw.traits,
    keywords: raw.keywords,
    imageUrl: `/assets/cards/${raw.id}.jpg`,
    effects: MANUAL_EFFECTS[raw.id] || []
}));

export function createDeck(): Card[] {

    const deck: Card[] = [];
    // Only use Units for the deck as requested
    const deckPool = DUMMY_CARDS;
    for (let i = 0; i < 40; i++) {
        const template = deckPool[i % deckPool.length];
        deck.push({ ...template, id: `${template.id}_${i}` });
    }
    return deck;
}
