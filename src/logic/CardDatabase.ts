import { Card, CardType, Attribute, Effect } from './types';
import rawST01 from '../../packs/ST01.json';
import rawST02 from '../../packs/ST02.json';
import rawST03 from '../../packs/ST03.json';
import rawST04 from '../../packs/ST04.json';
import rawST05 from '../../packs/ST05.json';
import rawST06 from '../../packs/ST06.json';
import rawST07 from '../../packs/ST07.json';
import rawST08 from '../../packs/ST08.json';
import rawST09 from '../../packs/ST09.json';
import rawST10 from '../../packs/ST10.json';
import rawST11 from '../../packs/ST11.json';
import rawBT01 from '../../packs/BT01.json';
import rawBT02 from '../../packs/BT02.json';
import rawBT03 from '../../packs/BT03.json';
import rawBT04 from '../../packs/BT04.json';
import rawBT05 from '../../packs/BT05.json';
import rawBT06 from '../../packs/BT06.json';
import rawSB01 from '../../packs/SB01.json';

import { ST01_EFFECTS } from './cardEffects/st01';
import { ST02_EFFECTS } from './cardEffects/st02';
import { ST03_EFFECTS } from './cardEffects/st03';
import { ST04_EFFECTS } from './cardEffects/st04';
import { ST05_EFFECTS } from './cardEffects/st05';
import { ST06_EFFECTS } from './cardEffects/st06';
import { ST07_EFFECTS } from './cardEffects/st07';
import { ST10_EFFECTS } from './cardEffects/st10';
import { ST11_EFFECTS } from './cardEffects/st11';
import { BT01_EFFECTS } from './cardEffects/bt01';
import { BT02_EFFECTS } from './cardEffects/bt02';
import { BT03_EFFECTS } from './cardEffects/bt03';
import { BT04_EFFECTS } from './cardEffects/bt04';
import { BT06_EFFECTS } from './cardEffects/bt06';
import { SB01_EFFECTS } from './cardEffects/sb01';

const MANUAL_EFFECTS: Record<string, Effect[]> = {
    ...ST01_EFFECTS,
    ...ST02_EFFECTS,
    ...ST03_EFFECTS,
    ...ST04_EFFECTS,
    ...ST05_EFFECTS,
    ...ST06_EFFECTS,
    ...ST07_EFFECTS,
    ...ST10_EFFECTS,
    ...ST11_EFFECTS,
    ...BT01_EFFECTS,
    ...BT02_EFFECTS,
    ...BT03_EFFECTS,
    ...BT04_EFFECTS,
    ...BT06_EFFECTS,
    ...SB01_EFFECTS,
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

const RUNTIME_KEYWORD_ALLOWLIST = new Set([
    '버프',
    '엔트리', '엑시트', '어태커', '디펜더', '이스케이프', '가디언', '공멸', '관통', '약탈',
    '종결', '침투', '듀얼리스트', '액티브', '기동', '패시브', '암드', '전선구축',
    '레벨링크', '믹스', '광전사', '트리거', '돌파', '체인'
]);

function dedupeKeywords(keywords: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const keyword of keywords) {
        if (!seen.has(keyword)) {
            seen.add(keyword);
            out.push(keyword);
        }
    }
    return out;
}

function normalizeKeywordToken(rawKeyword: unknown): string | null {
    if (typeof rawKeyword !== 'string') return null;
    const trimmed = rawKeyword.trim();
    if (!trimmed || trimmed === '-') return null;
    return trimmed;
}

function parseKeywordCsv(rawKeywords: unknown): string[] {
    if (typeof rawKeywords !== 'string') return [];
    return dedupeKeywords(
        rawKeywords
            .split(',')
            .map(token => normalizeKeywordToken(token))
            .filter((token): token is string => !!token),
    );
}

function parseKeywordList(rawKeywordList: unknown): string[] {
    if (!Array.isArray(rawKeywordList)) return [];
    return dedupeKeywords(
        rawKeywordList
            .map(token => normalizeKeywordToken(token))
            .filter((token): token is string => !!token),
    );
}

function parseHeaderKeywords(rawEffectSegments: unknown): string[] {
    if (!Array.isArray(rawEffectSegments)) return [];
    const collected: string[] = [];

    for (const segment of rawEffectSegments) {
        if (!segment || typeof segment !== 'object') continue;
        const headerKeywords = (segment as { headerKeywords?: unknown }).headerKeywords;
        if (!Array.isArray(headerKeywords)) continue;
        for (const keyword of headerKeywords) {
            const normalized = normalizeKeywordToken(keyword);
            if (!normalized) continue;
            collected.push(normalized);
        }
    }

    return dedupeKeywords(collected);
}

function buildRuntimeKeywords(raw: any): string[] {
    const listKeywords = parseKeywordList(raw.keywordList);
    const baseKeywords = listKeywords.length > 0 ? listKeywords : parseKeywordCsv(raw.keywords);
    const headerKeywords = parseHeaderKeywords(raw.effectSegments);
    return dedupeKeywords([...baseKeywords, ...headerKeywords]).filter(keyword => RUNTIME_KEYWORD_ALLOWLIST.has(keyword));
}

function parseCost(rawCost: unknown): number {
    if (rawCost === '레어도') return 0;
    const parsed = Number.parseInt(String(rawCost ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function parseStat(rawStat: unknown): number | undefined {
    const normalized = String(rawStat ?? '').trim();
    if (!normalized || normalized === '-') return undefined;
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export const DUMMY_CARDS: Card[] = [
    ...rawST01, ...rawST02, ...rawST03, ...rawST04, ...rawST05,
    ...rawST06, ...rawST07, ...rawST08, ...rawST09, ...rawST10, ...rawST11,
    ...rawBT01, ...rawBT02, ...rawBT03, ...rawBT04, ...rawBT05, ...rawBT06,
    ...rawSB01
].map((raw: any) => ({
    id: raw.id,
    name: raw.name,
    type: mapType(raw.type),
    attribute: mapAttribute(raw.attribute),
    cost: parseCost(raw.cost),
    power: parseStat(raw.power),
    hit: parseStat(raw.hit),
    text: raw.text || '',
    traits: raw.traits,
    keywords: buildRuntimeKeywords(raw),
    imageUrl: `/assets/cards/${raw.id}.jpg`,
    effects: MANUAL_EFFECTS[raw.id] || []
}));

export function createDeck(): Card[] {
    const deck: Card[] = [];
    // Only use Units for the deck as requested
    const deckPool = DUMMY_CARDS.filter(c => c.type !== CardType.LEADER);
    for (let i = 0; i < 40; i++) {
        const template = deckPool[i % deckPool.length];
        deck.push({ ...template, id: `${template.id}_${i}` });
    }
    return deck;
}
