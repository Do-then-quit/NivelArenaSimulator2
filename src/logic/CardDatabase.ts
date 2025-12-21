import { Card, CardType, Attribute, ActivationCondition } from './types';

export const DUMMY_CARDS: Card[] = [
    {
        id: "ST02-001",
        name: "길티",
        type: CardType.LEADER,
        attribute: Attribute.EARTH,
        cost: 0,
        text: "기본면 서약 : 자신의 덱에 대지 : 카드만 넣을 수 있다. 각성 : 자신의 리더 레벨이 6 이상이라면 이 카드를 뒤집는다. 각성면 패시브 : 자신의 사이즈+1.",
        traits: "미실리스",
        keywords: "패시브",
        imageUrl: "/assets/cards/ST02-001.jpg"
    },
    {
        id: "ST02-002",
        name: "N102",
        type: CardType.UNIT,
        attribute: Attribute.EARTH,
        cost: 1,
        power: 3500,
        hit: 1,
        text: "-",
        traits: "베이스 / 미실리스",
        keywords: "-",
        imageUrl: "/assets/cards/ST02-002.jpg"
    },
    {
        id: "ST02-003",
        name: "미카",
        type: CardType.UNIT,
        attribute: Attribute.EARTH,
        cost: 1,
        power: 1500,
        hit: 1,
        text: "엑시트 : 자신의 리더 레벨+1.",
        traits: "이펙트 / 테트라",
        keywords: "엑시트",
        imageUrl: "/assets/cards/ST02-003.jpg",
        effects: [
            {
                activation: ActivationCondition.EXIT,
                description: "자신의 리더 레벨+1.",
                action: { type: 'GAIN_LEVEL', params: { value: 1 } }
            }
        ]
    },
    {
        id: "ST02-004",
        name: "율리아",
        type: CardType.UNIT,
        attribute: Attribute.EARTH,
        cost: 2,
        power: 4500,
        hit: 1,
        text: "-",
        traits: "베이스 / 미실리스",
        keywords: "-",
        imageUrl: "/assets/cards/ST02-004.jpg"
    },
    {
        id: "ST02-005",
        name: "얀",
        type: CardType.UNIT,
        attribute: Attribute.EARTH,
        cost: 3,
        power: 2500,
        hit: 1,
        text: "엔트리 : 자신의 리더 레벨+1.",
        traits: "이펙트 / 테트라",
        keywords: "엔트리",
        imageUrl: "/assets/cards/ST02-005.jpg",
        effects: [
            {
                activation: ActivationCondition.ENTRY,
                description: "자신의 리더 레벨+1.",
                action: { type: 'GAIN_LEVEL', params: { value: 1 } }
            }
        ]
    },
    {
        id: "ST02-006",
        name: "도라",
        type: CardType.UNIT,
        attribute: Attribute.EARTH,
        cost: 3,
        power: 5500,
        hit: 1,
        text: "-",
        traits: "베이스 / 테트라",
        keywords: "-",
        imageUrl: "/assets/cards/ST02-006.jpg"
    },
    {
        id: "ST02-007",
        name: "브리드",
        type: CardType.UNIT,
        attribute: Attribute.EARTH,
        cost: 3,
        power: 3500,
        hit: 1,
        // Active Main: Trash 1 card from hand -> All 'Base' units get Hit+1
        text: "엑티브메인 : 자신의 패를 1장 골라 트래시한다. 그러면 필드에 있는 《베이스》를 가진 모든 자신 유닛은 이 턴이 끝날 때까지 히트+1. 트리거 / 이 카드를 트래시한다. 자신의 리더 레벨+1.",
        traits: "이펙트 / 엘리시온",
        keywords: "액티브",
        imageUrl: "/assets/cards/ST02-007.jpg",
        effects: [
            {
                activation: ActivationCondition.ACTIVE,
                description: "자신의 패를 1장 골라 트래시한다. 그러면 필드에 있는 《베이스》를 가진 모든 자신 유닛은 이 턴이 끝날 때까지 히트+1.",
                cost: { type: 'TRASH_HAND', amount: 1 },
                targets: { scope: 'MY_FIELD', type: 'UNIT', conditions: { hasTrait: '베이스' }, selectMode: 'RANDOM', count: 0 }, // count 0 = ALL
                action: { type: 'BUFF_HIT', params: { value: 1 } },
                duration: 'TURN_END'
            },
            {
                activation: ActivationCondition.DAMAGE_TRIGGER,
                description: "자신의 리더 레벨+1.",
                action: { type: 'GAIN_LEVEL', params: { value: 1 } }
            }
        ]
    },
    {
        id: "ST02-008",
        name: "마르차나",
        type: CardType.UNIT,
        attribute: Attribute.EARTH,
        cost: 4,
        power: 6500,
        hit: 2,
        text: "-",
        traits: "베이스 / 엘리시온",
        keywords: "-",
        imageUrl: "/assets/cards/ST02-008.jpg"
    },
    {
        id: "ST02-009",
        name: "길티",
        type: CardType.UNIT,
        attribute: Attribute.EARTH,
        cost: 5,
        power: 8500,
        hit: 2,
        text: "트리거 / 이 카드를 트래시한다. 필드에 있는 3코스트 이하인 상대 유닛을 1장 골라 트래시한다.",
        traits: "베이스 / 미실리스",
        keywords: "-",
        imageUrl: "/assets/cards/ST02-009.jpg",
        effects: [
            {
                activation: ActivationCondition.DAMAGE_TRIGGER,
                description: "필드에 있는 3코스트 이하인 상대 유닛을 1장 골라 트래시한다.",
                targets: { scope: 'OPP_FIELD', type: 'UNIT', conditions: { costMax: 3 }, selectMode: 'MANUAL', count: 1 },
                action: { type: 'DESTROY_UNIT', params: {} }
            }
        ]
    },
    {
        id: "ST02-010",
        name: "스노우 화이트",
        type: CardType.UNIT,
        attribute: Attribute.EARTH,
        cost: 6,
        power: 6500,
        hit: 2,
        text: "어태커 : 돌파[2코스트 이하] (2코스트 이하인 상대 유닛은 이 유닛의 공격을 방어할 수 없다). 트리거 / 이 카드를 자신의 패에 넣는다.",
        traits: "이펙트 / 필그림",
        keywords: "어태커",
        imageUrl: "/assets/cards/ST02-010.jpg",
        effects: [
            {
                activation: ActivationCondition.DAMAGE_TRIGGER,
                description: "이 카드를 자신의 패에 넣는다.",
                action: { type: 'RETURN_TO_HAND', params: {} }
            }
            // Breakthrough logic is usually handled by game rules engine, not typical effect action, but could be specific effect if we want.
        ]
    },
    {
        id: "ST02-011",
        name: "디젤",
        type: CardType.UNIT,
        attribute: Attribute.EARTH,
        cost: 7,
        power: 3000,
        hit: 3,
        text: "패시브 : 이 유닛의 파워가 자신의 리더 레벨×1000만큼 증가한다.",
        traits: "이펙트 / 엘리시온",
        keywords: "패시브",
        imageUrl: "/assets/cards/ST02-011.jpg",
        effects: [
            {
                activation: ActivationCondition.PASSIVE,
                description: "이 유닛의 파워가 자신의 리더 레벨×1000만큼 증가한다.",
                condition: { type: 'ALWAYS' },
                action: { type: 'BUFF_POWER', params: { value: 1000, dynamic: 'LEADER_LEVEL_MULTIPLIER' } }
            }
        ]
    },
    {
        id: "ST02-012",
        name: "크레센도",
        type: CardType.SKILL,
        attribute: Attribute.EARTH,
        cost: 1,
        text: "필드에 있는 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 파워+3000.",
        traits: "-",
        keywords: "-",
        imageUrl: "/assets/cards/ST02-012.jpg",
        effects: [
            {
                activation: ActivationCondition.ENTRY,
                description: "필드에 있는 자신 유닛을 1장 골라, 이 턴이 끝날 때까지 파워+3000.",
                targets: { scope: 'MY_FIELD', type: 'UNIT', count: 1, selectMode: 'MANUAL' },
                action: { type: 'BUFF_POWER', params: { value: 3000 } },
                duration: 'TURN_END'
            }
        ]
    },
    {
        id: "ST02-013",
        name: "스승의 은혜",
        type: CardType.SKILL,
        attribute: Attribute.EARTH,
        cost: 2,
        text: "자신의 리더 레벨+1.",
        traits: "-",
        keywords: "-",
        imageUrl: "/assets/cards/ST02-013.jpg",
        effects: [
            {
                activation: ActivationCondition.ENTRY,
                description: "자신의 리더 레벨+1.",
                action: { type: 'GAIN_LEVEL', params: { value: 1 } }
            }
        ]
    },
    {
        id: "ST02-014",
        name: "프라이즈",
        type: CardType.SKILL,
        attribute: Attribute.EARTH,
        cost: 3,
        text: "자신의 덱 맨 위에서 카드를 3장 공개하고, 그 중 1장을 골라 자신의 패에 넣는다. 나머지 2장은 다시 덱에 넣고 섞는다.",
        traits: "-",
        keywords: "-",
        imageUrl: "/assets/cards/ST02-014.jpg",
        effects: [
            {
                activation: ActivationCondition.ENTRY,
                description: "자신의 덱 맨 위에서 3장 공개 -> 1장 패",
                action: { type: 'DRAW', params: { count: 1, selection: 'LOOK_3_PICK_1' } } // Simplified for now
            }
        ]
    },
    {
        id: "ST02-015",
        name: "엑셀러레이션",
        type: CardType.SKILL,
        attribute: Attribute.EARTH,
        cost: 4,
        text: "자신 유닛과 상대 유닛이 모두 있는 레인을 하나 골라, 그 레인에서 파워가 가장 낮은 유닛을 트래시한다. 같다면 모두 트래시한다. 트리거 / 이 카드를 트래시한다. 필드에 있는 3코스트 이하인 상대 유닛을 1장 골라 트래시한다.",
        traits: "-",
        keywords: "-",
        imageUrl: "/assets/cards/ST02-015.jpg",
        effects: [
            {
                activation: ActivationCondition.ENTRY,
                description: "자신 유닛과 상대 유닛이 모두 있는 레인을 하나 골라, 그 레인에서 파워가 가장 낮은 유닛을 트래시한다. 같다면 모두 트래시한다.",
                targets: { scope: 'SHARED_LANE', type: 'ALL', count: 1, selectMode: 'MANUAL' },
                action: { type: 'DESTROY_LANE_LOWEST', params: {} }
            }
        ]
    },
    {
        id: "ST02-016",
        name: "케블라 프로텍터",
        type: CardType.ITEM,
        attribute: Attribute.EARTH,
        cost: 1,
        text: "장착조건 없음 : 파워+2000.",
        traits: "-",
        keywords: "-",
        imageUrl: "/assets/cards/ST02-016.jpg",
        effects: [
            {
                activation: ActivationCondition.PASSIVE,
                description: "파워+2000",
                condition: { type: 'ALWAYS' },
                action: { type: 'BUFF_POWER', params: { value: 2000 } }
            }
        ]
    },
    {
        id: "ST02-017",
        name: "레어 메탈 헬멧",
        type: CardType.ITEM,
        attribute: Attribute.EARTH,
        cost: 3,
        text: "장착조건 4코스트이상 : 히트+1.",
        traits: "-",
        keywords: "-",
        imageUrl: "/assets/cards/ST02-017.jpg",
        effects: [
            {
                activation: ActivationCondition.PASSIVE,
                description: "히트+1",
                condition: { type: 'COST_COMPARISON', value: { operator: 'GTE', cost: 4 } }, // New logic needed?
                action: { type: 'BUFF_HIT', params: { value: 1 } }
            }
        ]
    }
];

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
