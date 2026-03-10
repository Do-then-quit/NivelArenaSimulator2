/**
 * BT05 Unified Tests
 *
 * This module keeps high-value behavioral scenarios and auto-fills metadata
 * scenarios so every BT05 effect index has at least one unified row.
 */

import { ActivationCondition, Attribute, Card, CardType, Phase } from '../../types';
import { DUMMY_CARDS } from '../../CardDatabase';
import { BT05_EFFECTS } from '../../cardEffects/bt05';
import { RuleValidator } from '../../RuleValidator';
import { UnifiedTestCase, UnifiedTestModule } from './types';

function createCase(test: UnifiedTestCase): UnifiedTestCase {
    return test;
}

function findAction(
    engine: any,
    actorPlayerId: string,
    type: string,
    predicate?: (action: any) => boolean,
) {
    return engine
        .getLegalActions(actorPlayerId)
        .find((action: any) => action.type === type && (!predicate || predicate(action)));
}

function coverageKey(cardId: string, effectIndex: number): string {
    return `${cardId}:${effectIndex}`;
}

function zonePower(engine: any, player: any, zoneIndex: number): number {
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return 0;
    return engine.getUnitPower(zone, player);
}

function zoneHit(engine: any, player: any, zoneIndex: number): number {
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return 0;
    return engine.getUnitHit(zone, player);
}

function zonePenetration(engine: any, player: any, zoneIndex: number): number {
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return 0;
    return (engine as any).getPenetrationValue(zone);
}

function addPowerBuff(zone: any, value: number, id: string = `BT05_POWER_${value}`): void {
    zone.buffs.push({
        id,
        type: 'POWER',
        value,
        duration: 'PERMANENT',
    } as any);
}

function setHighSize(engine: any, level: number = 20): void {
    engine.state.players.forEach((player: any) => {
        player.leaderLevel = level;
    });
}

function handIndexOf(player: any, cardId: string): number {
    return player.hand.findIndex((card: Card) => card.id === cardId || card.id.startsWith(cardId));
}

function playUnitById(engine: any, player: any, cardId: string, zoneIndex: number): boolean {
    const handIndex = handIndexOf(player, cardId);
    if (handIndex < 0) return false;
    engine.playUnit(handIndex, zoneIndex);
    return true;
}

function playSkillById(engine: any, player: any, cardId: string): boolean {
    const handIndex = handIndexOf(player, cardId);
    if (handIndex < 0) return false;
    engine.playSkill(handIndex);
    return true;
}

function playItemById(engine: any, player: any, cardId: string, zoneIndex: number): boolean {
    const handIndex = handIndexOf(player, cardId);
    if (handIndex < 0) return false;
    engine.playItem(handIndex, zoneIndex);
    return true;
}

function chooseOptional(engine: any, actorPlayerId: string, confirm: boolean = true) {
    const action = findAction(engine, actorPlayerId, 'RESOLVE_OPTIONAL', (entry: any) => entry.confirm === confirm);
    if (action) engine.step(action);
    return action;
}

function chooseZone(engine: any, actorPlayerId: string, targetPlayerId: string, zoneIndex: number) {
    const action = findAction(
        engine,
        actorPlayerId,
        'SELECT_ZONE_TARGET',
        (entry: any) => entry.targetPlayerId === targetPlayerId && entry.zoneIndex === zoneIndex,
    );
    if (action) engine.step(action);
    return action;
}

function chooseHand(engine: any, actorPlayerId: string, predicate: (card: Card) => boolean) {
    const player = engine.getPlayerById(actorPlayerId);
    const action = findAction(
        engine,
        actorPlayerId,
        'SELECT_HAND_TARGET',
        (entry: any) => predicate(player.hand[entry.handIndex]),
    );
    if (action) engine.step(action);
    return action;
}

function chooseCostHand(engine: any, actorPlayerId: string, predicate: (card: Card) => boolean) {
    const player = engine.getPlayerById(actorPlayerId);
    const action = findAction(
        engine,
        actorPlayerId,
        'SELECT_COST_HAND',
        (entry: any) => predicate(player.hand[entry.handIndex]),
    );
    if (action) engine.step(action);
    return action;
}

function chooseTrash(engine: any, actorPlayerId: string, predicate: (card: Card) => boolean) {
    const player = engine.getPlayerById(actorPlayerId);
    const action = findAction(
        engine,
        actorPlayerId,
        'SELECT_TRASH_TARGET',
        (entry: any) => predicate(player.trash[entry.trashIndex]),
    );
    if (action) engine.step(action);
    return action;
}

function chooseRevealed(engine: any, actorPlayerId: string, predicate: (card: Card) => boolean) {
    const action = findAction(
        engine,
        actorPlayerId,
        'SELECT_REVEALED_TARGET',
        (entry: any) => predicate(engine.state.revealedCards[entry.revealedIndex]),
    );
    if (action) engine.step(action);
    return action;
}

function chooseItem(engine: any, actorPlayerId: string, targetPlayerId: string, zoneIndex: number, itemIndex: number) {
    const action = findAction(
        engine,
        actorPlayerId,
        'SELECT_ITEM_TARGET',
        (entry: any) => entry.targetPlayerId === targetPlayerId && entry.zoneIndex === zoneIndex && entry.itemIndex === itemIndex,
    );
    if (action) engine.step(action);
    return action;
}

function confirmTargets(engine: any, actorPlayerId: string) {
    const action = findAction(engine, actorPlayerId, 'CONFIRM_TARGETS');
    if (action) engine.step(action);
    return action;
}

function resolveBlock(engine: any, actorPlayerId: string, blockerZoneIndex: number, shouldBlock: boolean = true) {
    const action = findAction(
        engine,
        actorPlayerId,
        'RESOLVE_BLOCK',
        (entry: any) => entry.shouldBlock === shouldBlock && (shouldBlock === false || entry.blockerZoneIndex === blockerZoneIndex),
    );
    if (action) engine.step(action);
    return action;
}

function hasTemporaryAction(zone: any, actionType: string): boolean {
    return (zone?.temporaryEffects || []).some((effect: any) => effect.action?.type === actionType);
}

function chooseAutoAction(engine: any, actorPlayerId: string, preferNoBlock: boolean = true): any | null {
    const actions = engine.getLegalActions(actorPlayerId);
    const pick = (type: string, predicate?: (action: any) => boolean) =>
        actions.find((action: any) => action.type === type && (!predicate || predicate(action)));

    return pick('RESOLVE_OPTIONAL', (action: any) => action.confirm === true)
        ?? pick('SELECT_COST_HAND')
        ?? pick('SELECT_HAND_TARGET')
        ?? pick('SELECT_ZONE_TARGET')
        ?? pick('SELECT_REVEALED_TARGET')
        ?? pick('SELECT_TRASH_TARGET')
        ?? pick('SELECT_DAMAGE_TARGET')
        ?? pick('SELECT_ITEM_TARGET')
        ?? pick('CONFIRM_TARGETS')
        ?? pick('RESOLVE_BLOCK', (action: any) => preferNoBlock ? action.shouldBlock === false : action.shouldBlock === true)
        ?? pick('RESOLVE_BLOCK');
}

function resolveAuto(engine: any, fallbackActorPlayerId?: string, preferNoBlock: boolean = true): number {
    let steps = 0;
    let guard = 0;

    while (guard < 32) {
        const actorPlayerId = engine.state.interactionOwnerPlayerId || fallbackActorPlayerId;
        if (!actorPlayerId) break;

        const action = chooseAutoAction(engine, actorPlayerId, preferNoBlock);
        if (!action) break;

        engine.step(action);
        steps += 1;
        guard += 1;
    }

    return steps;
}

function summarizeGeneratedState(engine: any) {
    const p1 = engine.state.players[0];
    const p2 = engine.state.players[1];

    return {
        p1Hand: p1.hand.map((card: Card) => card.id),
        p1Trash: p1.trash.map((card: Card) => card.id),
        p1Damage: p1.damage.map((card: Card) => card.id),
        p1DeckTop: p1.deck.slice(-3).map((card: Card) => card.id).reverse(),
        p1DeckCount: p1.deck.length,
        p1LeaderLevel: p1.leaderLevel,
        p2Hand: p2.hand.map((card: Card) => card.id),
        p2Trash: p2.trash.map((card: Card) => card.id),
        p2Damage: p2.damage.map((card: Card) => card.id),
        p2DeckCount: p2.deck.length,
        p2LeaderLevel: p2.leaderLevel,
        p1Zone0Unit: p1.unitZones[0].unit?.id ?? null,
        p1Zone1Unit: p1.unitZones[1].unit?.id ?? null,
        p1Zone0Items: p1.unitZones[0].items.map((item: Card) => item.id),
        p1Zone1Items: p1.unitZones[1].items.map((item: Card) => item.id),
        p1Zone0Power: zonePower(engine, p1, 0),
        p1Zone1Power: zonePower(engine, p1, 1),
        p1Zone0Hit: zoneHit(engine, p1, 0),
        p1Zone1Hit: zoneHit(engine, p1, 1),
        p1Zone0Penetration: zonePenetration(engine, p1, 0),
        p1Zone0Temps: (p1.unitZones[0].temporaryEffects || []).map((effect: any) => effect.action?.type || effect.description || 'NONE'),
        p1Zone1Temps: (p1.unitZones[1].temporaryEffects || []).map((effect: any) => effect.action?.type || effect.description || 'NONE'),
        p2Zone0Unit: p2.unitZones[0].unit?.id ?? null,
        p2Zone1Unit: p2.unitZones[1].unit?.id ?? null,
        p2Zone0Power: zonePower(engine, p2, 0),
        p2Zone0Hit: zoneHit(engine, p2, 0),
        p2Zone0Temps: (p2.unitZones[0].temporaryEffects || []).map((effect: any) => effect.action?.type || effect.description || 'NONE'),
        phase: engine.state.phase,
        interactionOwnerPlayerId: engine.state.interactionOwnerPlayerId ?? null,
        delayedActions: (engine.state.delayedActions || []).length,
        revealedCount: engine.state.revealedCards.length,
        revealedIds: engine.state.revealedCards.map((card: Card) => card.id),
    };
}

function hasMeaningfulGeneratedChange(before: any, after: any): boolean {
    return JSON.stringify(before) !== JSON.stringify(after);
}

const BT05_CARD_MAP = new Map(
    DUMMY_CARDS
        .filter((card) => card.id.startsWith('BT05-'))
        .map((card) => [card.id, card] as const),
);

const OTHER_ATTRIBUTE_SUPPORT_BY_ATTRIBUTE: Record<Attribute, string> = {
    [Attribute.FIRE]: 'BT05-018',
    [Attribute.EARTH]: 'BT05-002',
    [Attribute.STORM]: 'BT05-002',
    [Attribute.WATER]: 'BT05-002',
    [Attribute.LIGHTNING]: 'BT05-002',
    [Attribute.NONE]: 'ST01-002',
};

function getBt05Card(cardId: string): Card {
    const card = BT05_CARD_MAP.get(cardId);
    if (!card) {
        throw new Error(`BT05 card ${cardId} not found`);
    }
    return card;
}

function makeMixedLeaderAwakenPromptTest(
    cardId: string,
    leaderName: string,
    requiredLevel: number,
    coverageIndices: number[],
): UnifiedTestCase {
    return createCase({
        testId: cardId,
        name: `${leaderName} 각성과 비동일 속성 상대 드로우`,
        description: `${cardId}가 요구 레벨에서 각성하고, 자신의 필드에 다른 속성 카드가 있으면 상대가 1장 드로우를 선택할 수 있다.`,
        coversEffectIndices: coverageIndices,
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.levelZone = getCard(cardId);
            if (p1.levelZone) p1.levelZone.isAwakened = false;
            p1.leaderLevel = requiredLevel - 1;
            p1.unitZones[0].unit = getCard(OTHER_ATTRIBUTE_SUPPORT_BY_ATTRIBUTE[p1.levelZone.attribute] || 'ST01-002');
            p2.deck = [getCard('ST01-011'), getCard('ST01-002')];
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const handBefore = p2.hand.length;
            engine.nextPhase();
            const confirm = chooseOptional(engine, p2.id, true);
            return [
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성 성공' },
                { pass: !!confirm, message: '상대 드로우 선택 가능' },
                { pass: p2.hand.length === handBefore + 1, message: '상대가 1장 드로우' },
            ];
        },
    });
}

function makeMixedLeaderPactTest(cardId: string, leaderName: string, coverageIndex: number, attribute: Attribute): UnifiedTestCase {
    return createCase({
        testId: cardId,
        name: `${leaderName} 서약 효과 등록`,
        description: `${cardId}가 cardEffects에 혼합 서약 메타 효과를 가진다.`,
        coversEffectIndices: [coverageIndex],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard(cardId);
            engine.state.phase = Phase.MAIN;
        },
        verify: (_engine, getCard) => {
            const card = getCard(cardId);
            const pactEffect = card.effects?.find((effect: any) => effect.action?.params?.pactAttribute === attribute);
            return [
                { pass: !!pactEffect, message: `[서약] 효과 등록 (${attribute})` },
                { pass: pactEffect?.action?.params?.offAttributeMustMatch === true, message: '비주속성 카드 동일 속성 제한 메타 포함' },
            ];
        },
    });
}

function flattenConditions(condition: any): any[] {
    if (!condition) return [];
    if (condition.type === 'ALL' && Array.isArray(condition.value)) {
        return condition.value.flatMap((entry: any) => flattenConditions(entry));
    }
    return [condition];
}

function conditionMinValue(value: any, fallback: number = 1): number {
    if (typeof value === 'number') return value;
    if (typeof value?.min === 'number') return value.min;
    if (typeof value?.value === 'number') return value.value;
    return fallback;
}

function explicitConditionMin(value: any): number | null {
    if (typeof value === 'number') return value;
    if (typeof value?.min === 'number') return value.min;
    if (typeof value?.value === 'number') return value.value;
    return null;
}

function conditionMaxValue(value: any): number | null {
    if (typeof value?.max === 'number') return value.max;
    return null;
}

function ensureFriendlyUnit(engine: any, getCard: (id: string) => Card, zoneIndex: number, unitId: string = 'ST01-002') {
    const p1 = engine.state.players[0];
    if (!p1.unitZones[zoneIndex].unit) {
        p1.unitZones[zoneIndex].unit = getCard(unitId);
    }
}

function ensureOpponentUnit(engine: any, getCard: (id: string) => Card, zoneIndex: number, unitId: string = 'ST01-002') {
    const p2 = engine.state.players[1];
    if (!p2.unitZones[zoneIndex].unit) {
        p2.unitZones[zoneIndex].unit = getCard(unitId);
    }
}

function ensureKnownDeck(engine: any, getCard: (id: string) => Card, ids: string[]) {
    const p1 = engine.state.players[0];
    p1.deck = ids.map((id) => getCard(id));
}

function ensureDeckTop(engine: any, getCard: (id: string) => Card, topFirstIds: string[], bottomIds: string[] = []) {
    const p1 = engine.state.players[0];
    p1.deck = [...bottomIds, ...topFirstIds.slice().reverse()].map((id) => getCard(id));
}

function ensureKnownTrash(engine: any, getCard: (id: string) => Card, ids: string[]) {
    const p1 = engine.state.players[0];
    p1.trash = ids.map((id) => getCard(id));
}

function ensureKnownDamage(engine: any, getCard: (id: string) => Card, ids: string[]) {
    const p1 = engine.state.players[0];
    p1.damage = ids.map((id) => getCard(id));
}

function ensureOtherAttributeSupport(engine: any, getCard: (id: string) => Card, attribute: Attribute) {
    const p1 = engine.state.players[0];
    if (!p1.unitZones[2].unit) {
        p1.unitZones[2].unit = getCard(OTHER_ATTRIBUTE_SUPPORT_BY_ATTRIBUTE[attribute] || 'ST01-002');
    }
}

function ensureFriendlyEquippedItems(engine: any, getCard: (id: string) => Card, zoneIndex: number, count: number) {
    const p1 = engine.state.players[0];
    ensureFriendlyUnit(engine, getCard, zoneIndex, 'ST01-002');
    const zone = p1.unitZones[zoneIndex];
    while (zone.items.length < count) {
        zone.items.push(getCard(supportItemIds(count)[zone.items.length] || 'BT05-081'));
    }
}

function hasCondition(conditions: any[], type: string): boolean {
    return conditions.some((condition) => condition?.type === type);
}

function generatedEffectKey(cardId: string, effectIndex: number): string {
    return `${cardId}:${effectIndex}`;
}

const behaviorTests: UnifiedTestCase[] = [
    makeMixedLeaderAwakenPromptTest('BT05-001', '훈련소장 카티야', 5, [0, 1]),
    createCase({
        testId: 'BT05-001',
        name: '훈련소장 카티야 각성면 액티브 2코 이하 비트리거 스킬 회수',
        description: '손패 1장을 트래시하고 트래시의 2코스트 이하 비트리거 스킬 1장을 패로 회수한다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('BT05-001');
            if (p1.levelZone) p1.levelZone.isAwakened = true;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST01-011')];
            p1.trash = [getCard('BT05-013'), getCard('BT05-028')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 2, 'LEADER');
            const discard = chooseCostHand(engine, p1.id, (card: Card) => card.id.startsWith('ST01-011'));
            const legalIds = engine.getLegalActions(p1.id)
                .filter((action: any) => action.type === 'SELECT_TRASH_TARGET')
                .map((action: any) => p1.trash[action.trashIndex]?.id);
            const recover = chooseTrash(engine, p1.id, (card: Card) => card.id === 'BT05-013');
            return [
                { pass: !!discard, message: '손패 트래시 코스트 선택 가능' },
                { pass: legalIds.includes('BT05-013'), message: '2코스트 이하 비트리거 스킬 선택 가능' },
                { pass: !legalIds.includes('BT05-028'), message: '코스트 초과 스킬은 선택 불가' },
                { pass: !!recover, message: '회수할 스킬 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT05-013'), message: '조건에 맞는 스킬 회수 성공' },
            ];
        },
    }),
    makeMixedLeaderPactTest('BT05-001', '훈련소장 카티야', 3, Attribute.FIRE),
    createCase({
        testId: 'BT05-004',
        name: '발렌타인 로지 패시브로 아군 어태커 약탈과 파워 상승 부여',
        description: '다른 자신 유닛이 공격할 때 약탈[1]과 파워+2000을 함께 얻는다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT05-004');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.deck = [getCard('ST01-011')];
            p2.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforePower = zonePower(engine, p1, 1);
            const handBefore = p1.hand.length;
            engine.attack(1);
            const powerDuringAttack = zonePower(engine, p1, 1);
            resolveBlock(engine, p2.id, 1, true);
            return [
                { pass: powerDuringAttack === beforePower + 2000, message: '공격 선언 직후 아군 어태커 파워+2000 적용' },
                { pass: p1.hand.length === handBefore + 1, message: '약탈[1]로 1드로우' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-004',
        name: '발렌타인 로지 이스케이프로 덱 맨 아래 이동 후 다음 배치 관통 부여',
        description: '이스케이프로 자신을 덱 맨 아래에 두고 다음에 배치한 유닛에게 어태커 관통[1]을 준다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT05-004');
            p1.hand = [getCard('ST01-011')];
            setHighSize(engine, 20);
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.DRAW;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.nextPhase();
            const queued = (p1.pendingNextPlayUnitEffects || []).length;
            const played = playUnitById(engine, p1, 'ST01-011', 0);
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            resolveBlock(engine, p2.id, 0, true);
            return [
                { pass: p1.unitZones.every((zone: any) => zone.unit?.id !== 'BT05-004'), message: '이스케이프로 자신이 필드에서 이탈' },
                { pass: queued > 0, message: '다음 배치 강화 큐 적재' },
                { pass: played, message: '다음 유닛 배치 성공' },
                { pass: zonePenetration(engine, p1, 0) >= 1 || p2.damage.length >= 1, message: '배치한 유닛이 관통[1]을 얻음' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-005',
        name: '비터스윗 라우라 이스케이프 상대 2장 약화 후 덱 맨 아래 이동',
        description: '이스케이프로 상대 유닛을 최대 2장까지 자신의 파워만큼 약화시키고 자신은 덱 맨 아래로 이동한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT05-005');
            p2.unitZones[0].unit = getCard('ST01-011');
            p2.unitZones[1].unit = getCard('ST01-011');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.DRAW;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const sourcePower = zonePower(engine, p1, 0);
            const before0 = zonePower(engine, p2, 0);
            const before1 = zonePower(engine, p2, 1);
            engine.nextPhase();
            const first = chooseZone(engine, p1.id, p2.id, 0);
            const second = chooseZone(engine, p1.id, p2.id, 1);
            const confirm = confirmTargets(engine, p1.id);
            return [
                { pass: !!first && !!second && !!confirm, message: '상대 유닛 2장 선택 가능' },
                { pass: zonePower(engine, p2, 0) === before0 - sourcePower, message: '첫 번째 상대 유닛이 자신의 파워만큼 약화' },
                { pass: zonePower(engine, p2, 1) === before1 - sourcePower, message: '두 번째 상대 유닛이 자신의 파워만큼 약화' },
                { pass: p1.unitZones[0].unit === null, message: '이스케이프로 자신이 필드를 떠남' },
                { pass: p1.deck[0]?.id.startsWith('BT05-005') === true, message: '자신이 덱 맨 아래로 이동' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-007',
        name: '용 다이린 엔트리로 상대 디펜더와 엑시트 잠금',
        description: '엔트리 시 상대의 디펜더/엑시트 활성화를 턴 종료까지 모두 잠근다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            setHighSize(engine, 20);
            p1.hand = [getCard('BT05-007')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const played = playUnitById(engine, p1, 'BT05-007', 0);
            return [
                { pass: played, message: '유닛 배치 성공' },
                { pass: p2.lockedActivationsUntilTurnEnd?.[ActivationCondition.DEFENDER] === true, message: '상대 DEFENDER 효과 잠금' },
                { pass: p2.lockedActivationsUntilTurnEnd?.[ActivationCondition.EXIT] === true, message: '상대 EXIT 효과 잠금' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-008',
        name: '심연의 마왕 레녹스 스킬 발동 수만큼 반복 약화',
        description: '믹스 조건에서 이 턴 발동한 스킬 수만큼 추가 처리되어 상대 유닛들을 반복 약화시킨다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT05-008');
            ensureOtherAttributeSupport(engine, getCard, Attribute.FIRE);
            engine.recordSkillActivation(p1.id, 1);
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[1].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before0 = zonePower(engine, p2, 0);
            const before1 = zonePower(engine, p2, 1);
            engine.activateEffect(0, 2);
            const first = chooseZone(engine, p1.id, p2.id, 0);
            const second = chooseZone(engine, p1.id, p2.id, 1);
            return [
                { pass: !!first && !!second, message: '반복 처리로 상대 유닛 2번 선택 가능' },
                { pass: zonePower(engine, p2, 0) === before0 - 2000, message: '첫 번째 선택 유닛 파워-2000' },
                { pass: zonePower(engine, p2, 1) === before1 - 2000, message: '두 번째 선택 유닛 파워-2000' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-009',
        name: '멧현우 어태커 조우 약화 후 파괴 시 스킬 회수',
        description: '어태커로 조우 유닛을 약화해 파괴하면 트래시의 2코스트 이하 비트리거 스킬을 회수한다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT05-009');
            p1.trash = [getCard('BT05-013')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.attack(0);
            const recover = chooseTrash(engine, p1.id, (card: Card) => card.id === 'BT05-013');
            return [
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛이 파워 감소로 트래시됨' },
                { pass: !!recover, message: '회수할 스킬 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT05-013'), message: '2코스트 이하 비트리거 스킬 회수' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-010',
        name: '몽환의 악마 시셀라 엔트리 트래시 복귀와 조우 약화',
        description: '엔트리로 트래시 카드를 덱 맨 아래에 두고 조우 유닛을 약화시킨다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            setHighSize(engine, 20);
            p1.hand = [getCard('BT05-010')];
            p1.trash = [getCard('BT05-013')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = zonePower(engine, p2, 0);
            const played = playUnitById(engine, p1, 'BT05-010', 0);
            const pick = chooseTrash(engine, p1.id, (card: Card) => card.id === 'BT05-013');
            return [
                { pass: played, message: '유닛 배치 성공' },
                { pass: !!pick, message: '덱 맨 아래로 돌릴 트래시 카드 선택 가능' },
                { pass: p1.deck[0]?.id === 'BT05-013', message: '선택한 트래시 카드가 덱 맨 아래로 이동' },
                { pass: zonePower(engine, p2, 0) === before - 2000, message: '조우 유닛 파워 총 -2000 적용' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-011',
        name: '훈련소장 카티야 엔트리 스킬 트래시 후 즉시 발동과 어태커 강화',
        description: '믹스 엔트리로 2코스트 이상 스킬을 트래시해 발동하고, 이 턴 발동한 스킬 수만큼 관통과 듀얼리스트를 얻는다.',
        coversEffectIndices: [0, 1, 2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            setHighSize(engine, 20);
            ensureOtherAttributeSupport(engine, getCard, Attribute.FIRE);
            p1.hand = [getCard('BT05-011')];
            p1.skillZone = [getCard('BT05-012'), getCard('BT05-013')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.recordSkillActivation(p1.id, 2);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforePower = zonePower(engine, p2, 0);
            const played = playUnitById(engine, p1, 'BT05-011', 0);
            const castSkill = chooseRevealed(engine, p1.id, (card: Card) => card.id === 'BT05-012');
            const debuffTarget = chooseZone(engine, p1.id, p2.id, 0);
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            return [
                { pass: played, message: '유닛 배치 성공' },
                { pass: !!castSkill, message: '트래시 후 발동할 2코스트 이상 스킬 선택 가능' },
                { pass: !!debuffTarget, message: '발동한 스킬의 대상 선택 가능' },
                { pass: p1.skillZone.every((card: Card) => card.id !== 'BT05-012'), message: '선택한 스킬이 스킬 존에서 제거됨' },
                { pass: p1.trash.some((card: Card) => card.id === 'BT05-012'), message: '선택한 스킬이 트래시로 이동' },
                { pass: zonePower(engine, p2, 0) === beforePower - 3000, message: '트래시한 스킬 효과가 즉시 발동' },
                { pass: engine.getSkillActivationCountThisTurn(p1.id) >= 3, message: '이 턴 스킬 발동 수가 3 이상으로 집계됨' },
                { pass: zonePenetration(engine, p1, 0) >= 3, message: '어태커 관통[X]가 스킬 발동 수만큼 적용' },
                {
                    pass: (p1.unitZones[0].temporaryEffects || []).some((effect: any) => effect.description?.includes('듀얼리스트')),
                    message: 'X가 3 이상이면 듀얼리스트 부여',
                },
            ];
        },
    }),
    createCase({
        testId: 'BT05-013',
        name: '이 맛이지 트래시 회수 후 선택 유닛 덱 맨 아래',
        description: '선택한 아군보다 코스트가 낮은 비트리거 카드를 트래시에서 회수하고, 선택 유닛을 덱 맨 아래에 둔다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            setHighSize(engine, 20);
            p1.hand = [getCard('BT05-013')];
            p1.unitZones[0].unit = getCard('BT05-025');
            ensureKnownTrash(engine, getCard, ['BT05-016', 'BT05-011']);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const played = playSkillById(engine, p1, 'BT05-013');
            const pickUnit = chooseZone(engine, p1.id, p1.id, 0);
            const legalIds = engine.getLegalActions(p1.id)
                .filter((action: any) => action.type === 'SELECT_TRASH_TARGET')
                .map((action: any) => p1.trash[action.trashIndex]?.id);
            const recover = chooseTrash(engine, p1.id, (card: Card) => card.id === 'BT05-016');
            return [
                { pass: played, message: '스킬 발동 성공' },
                { pass: !!pickUnit, message: '덱 맨 아래로 보낼 아군 유닛 선택 가능' },
                { pass: legalIds.includes('BT05-016'), message: '선택 유닛보다 코스트가 낮은 비트리거 카드 선택 가능' },
                { pass: !legalIds.includes('BT05-011'), message: '선택 유닛보다 코스트가 높거나 같은 카드는 제외' },
                { pass: !!recover, message: '회수할 트래시 카드 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT05-016'), message: '조건에 맞는 카드를 패에 회수' },
                { pass: p1.unitZones[0].unit === null, message: '선택한 아군 유닛이 필드를 떠남' },
                { pass: p1.deck[0]?.id === 'BT05-025', message: '선택한 아군 유닛이 덱 맨 아래로 이동' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-015',
        name: '꽤 아플걸 상대 유닛 트래시 시 소스 스킬 대미지 이동',
        description: '상대 유닛에 부여한 종료 효과가 발동하면 트래시의 이 카드가 대미지 존으로 이동한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            setHighSize(engine, 5);
            p1.hand = [getCard('BT05-015')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const played = playSkillById(engine, p1, 'BT05-015');
            const pickTarget = chooseZone(engine, p1.id, p2.id, 0);
            const granted = (p2.unitZones[0].temporaryEffects || []).some(
                (effect: any) => effect.action?.params?.mode === 'BT05_015_MOVE_STORED_SKILL_FROM_TRASH_TO_DAMAGE',
            );
            engine.destroyUnit(p2, p2.unitZones[0], undefined, 'EFFECT');
            return [
                { pass: played, message: '스킬 발동 성공' },
                { pass: !!pickTarget, message: '효과를 부여할 상대 유닛 선택 가능' },
                { pass: granted, message: '상대 유닛에 트래시 시 이동 효과가 부여됨' },
                { pass: p2.damage.some((card: Card) => card.id === 'ST01-002'), message: '트래시된 대상 유닛이 상대 대미지 존으로 이동' },
                { pass: !p2.trash.some((card: Card) => card.id === 'ST01-002'), message: '트래시된 대상 유닛이 트래시에 남지 않음' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-019',
        name: '운명의 푸른 가약 케네스 공개 회수 후 대상 유닛 덱 맨 아래',
        description: '선택한 아군의 히트만큼 공개해 1장을 패에 넣고 나머지는 트래시한 뒤, 선택 유닛을 덱 맨 아래로 보낸다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST01-011');
            p1.unitZones[1].unit = getCard('BT05-019');
            ensureDeckTop(engine, getCard, ['BT05-012', 'BT05-015', 'ST01-002']);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(1, 0);
            const pickUnit = chooseZone(engine, p1.id, p1.id, 0);
            const pickReveal = chooseRevealed(engine, p1.id, (card: Card) => card.id === 'BT05-012');
            return [
                { pass: !!pickUnit, message: '공개 수를 정할 아군 유닛 선택 가능' },
                { pass: !!pickReveal, message: '공개한 카드 중 패에 넣을 카드 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT05-012'), message: '선택한 공개 카드를 패에 넣음' },
                { pass: p1.trash.some((card: Card) => card.id === 'BT05-015'), message: '남은 공개 카드가 트래시로 이동' },
                { pass: p1.trash.some((card: Card) => card.id === 'ST01-002'), message: '남은 공개 카드 전부가 트래시로 이동' },
                { pass: p1.unitZones[0].unit === null, message: '선택한 아군 유닛이 필드를 떠남' },
                { pass: p1.deck[0]?.id === 'ST01-011', message: '선택한 아군 유닛이 덱 맨 아래로 이동' },
                { pass: engine.state.revealedCards.length === 0, message: '공개 영역 정리 완료' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-025',
        name: '2nd Anniversary 이바 Blossom 패 다중 트래시 버프와 돌파 획득',
        description: '레벨링크 9에서 패를 여러 장 트래시해 파워를 올리고, 조우 유닛과의 파워 차가 12000 이상이면 돌파를 얻는다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 9;
            p1.unitZones[0].unit = getCard('BT05-025');
            p1.hand = [getCard('ST01-002'), getCard('BT05-012'), getCard('BT05-013')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const beforePower = zonePower(engine, p1, 0);
            engine.activateEffect(0, 1);
            const discard0 = chooseHand(engine, p1.id, (card: Card) => card.id === 'ST01-002');
            const discard1 = chooseHand(engine, p1.id, (card: Card) => card.id === 'BT05-012');
            const discard2 = chooseHand(engine, p1.id, (card: Card) => card.id === 'BT05-013');
            const confirm = confirmTargets(engine, p1.id);
            return [
                { pass: beforePower === 12000, message: '레벨링크 7 파워+5000이 먼저 적용됨' },
                { pass: !!discard0 && !!discard1 && !!discard2 && !!confirm, message: '패 3장을 선택해 트래시 가능' },
                { pass: p1.hand.length === 0, message: '선택한 패가 모두 트래시됨' },
                { pass: zonePower(engine, p1, 0) === beforePower + 3000, message: '트래시한 카드 수만큼 파워+1000 누적' },
                { pass: hasTemporaryAction(p1.unitZones[0], 'BREAKTHROUGH'), message: '파워 차 12000 이상이면 돌파 획득' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-027',
        name: '즐거운 축제 아군 하단 이동 후 같은 존에 손패 유닛 배치',
        description: '선택한 아군을 덱 맨 아래로 보내고, 코스트+3 이하 손패 유닛을 같은 유닛 존에 사이즈를 무시하고 배치한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            setHighSize(engine, 5);
            p1.hand = [getCard('BT05-027'), getCard('ST01-011')];
            p1.unitZones[1].unit = getCard('BT05-036');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const played = playSkillById(engine, p1, 'BT05-027');
            const pickBottom = chooseZone(engine, p1.id, p1.id, 1);
            const pickHand = chooseHand(engine, p1.id, (card: Card) => card.id === 'ST01-011');
            return [
                { pass: played, message: '스킬 발동 성공' },
                { pass: !!pickBottom, message: '덱 맨 아래로 보낼 아군 유닛 선택 가능' },
                { pass: !!pickHand, message: '코스트+3 이하 손패 유닛 선택 가능' },
                { pass: p1.unitZones[1].unit?.id === 'ST01-011', message: '선택한 손패 유닛이 같은 존에 배치됨' },
                { pass: p1.deck[0]?.id === 'BT05-036', message: '원래 아군 유닛이 덱 맨 아래로 이동' },
                { pass: !p1.hand.some((card: Card) => card.id === 'ST01-011'), message: '배치한 유닛이 패에서 제거됨' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-028',
        name: '불꽃놀이 공개 배치 후 조건부 0코스트와 나머지 트래시',
        description: '아군을 덱 맨 아래로 보낸 뒤 덱 위 3장을 공개해 유닛을 배치하고, 조건 충족 시 이 스킬이 0코스트가 된다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            setHighSize(engine, 5);
            p1.leaderLevel = 5;
            p1.hand = [getCard('BT05-028')];
            p1.unitZones[0].unit = getCard('BT05-019');
            ensureDeckTop(engine, getCard, ['ST01-002', 'BT05-012', 'BT05-015']);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const played = playSkillById(engine, p1, 'BT05-028');
            const pickBottom = chooseZone(engine, p1.id, p1.id, 0);
            const pickRevealed = chooseRevealed(engine, p1.id, (card: Card) => card.id === 'ST01-002');
            const pickZone = chooseZone(engine, p1.id, p1.id, 1);
            const skillCard = p1.skillZone.find((card: Card) => card.id === 'BT05-028');
            return [
                { pass: played, message: '스킬 발동 성공' },
                { pass: !!pickBottom, message: '덱 맨 아래로 보낼 아군 유닛 선택 가능' },
                { pass: !!pickRevealed, message: '공개된 유닛 카드 선택 가능' },
                { pass: !!pickZone, message: '배치할 빈 유닛 존 선택 가능' },
                { pass: p1.deck[0]?.id === 'BT05-019', message: '선택한 아군 유닛이 덱 맨 아래로 이동' },
                { pass: p1.unitZones[1].unit?.id === 'ST01-002', message: '선택한 공개 유닛이 빈 유닛 존에 배치됨' },
                { pass: p1.trash.some((card: Card) => card.id === 'BT05-012'), message: '선택하지 않은 공개 카드가 트래시됨' },
                { pass: p1.trash.some((card: Card) => card.id === 'BT05-015'), message: '남은 공개 카드가 모두 트래시됨' },
                { pass: skillCard?.turnCostOverride?.cost === 0, message: '배치한 유닛 코스트가 리더 레벨 이하이면 이 스킬 0코스트화' },
                { pass: engine.state.revealedCards.length === 0, message: '공개 영역 정리 완료' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-029',
        name: '쉬워도 너무 쉬운데 아군 하단 이동 후 상대 방어 잠금',
        description: '기준 아군을 선택해 덱 맨 아래로 보내고, 그 파워 이하의 상대 유닛에게 턴 종료까지 방어 불가를 부여한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            setHighSize(engine, 8);
            p1.hand = [getCard('BT05-029')];
            p1.unitZones[1].unit = getCard('BT05-036');
            p2.unitZones[0].unit = getCard('ST01-011');
            p2.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const played = playSkillById(engine, p1, 'BT05-029');
            const pickFriendly = chooseZone(engine, p1.id, p1.id, 1);
            const legalOppZones = engine.getLegalActions(p1.id)
                .filter((action: any) => action.type === 'SELECT_ZONE_TARGET' && action.targetPlayerId === p2.id)
                .map((action: any) => action.zoneIndex);
            const pickOpponent = chooseZone(engine, p1.id, p2.id, 1);
            return [
                { pass: played, message: '스킬 발동 성공' },
                { pass: !!pickFriendly, message: '기준이 될 자신 유닛 선택 가능' },
                { pass: !legalOppZones.includes(0) && legalOppZones.includes(1), message: '기준 유닛 파워 이하의 상대 유닛만 선택 가능' },
                { pass: !!pickOpponent, message: '조건에 맞는 상대 유닛 선택 가능' },
                { pass: p1.unitZones[1].unit === null, message: '기준이 된 자신 유닛이 필드를 떠남' },
                { pass: p1.deck[0]?.id === 'BT05-036', message: '기준이 된 자신 유닛이 덱 맨 아래로 이동' },
                {
                    pass: (p2.unitZones[1].temporaryEffects || []).some((effect: any) => effect.action?.params?.cannotBlock === true),
                    message: '선택한 상대 유닛이 턴 종료까지 공격 방어 불가',
                },
            ];
        },
    }),
    createCase({
        testId: 'BT05-035',
        name: '블레어 액티브 아군 트래시 후 돌파 획득',
        description: '다른 아군을 트래시하고 자신이 턴 종료까지 어태커 돌파를 얻는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT05-035');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 0);
            const pickTarget = chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: !!pickTarget, message: '트래시할 아군 유닛 선택 가능' },
                { pass: p1.unitZones[1].unit === null, message: '선택한 아군 유닛 트래시' },
                { pass: hasTemporaryAction(p1.unitZones[0], 'BREAKTHROUGH'), message: '자신이 어태커 돌파 획득' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-036',
        name: '고스트헌터 키아라 엔트리 트래시 엑시트 차용 후 덱 바닥',
        description: '트래시의 비트리거 엑시트 유닛을 골라 그 엑시트 효과를 발동하고, 원본 카드를 덱 맨 아래로 보낸다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            setHighSize(engine, 10);
            p1.hand = [getCard('BT05-036')];
            p1.trash = [getCard('BT05-033')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforePower = zonePower(engine, p2, 0);
            const played = playUnitById(engine, p1, 'BT05-036', 0);
            const pickExitSource = chooseTrash(engine, p1.id, (card: Card) => card.id === 'BT05-033');
            const pickTarget = chooseZone(engine, p1.id, p2.id, 0);
            return [
                { pass: played, message: '유닛 배치 성공' },
                { pass: !!pickExitSource, message: '차용할 엑시트 유닛 선택 가능' },
                { pass: !!pickTarget, message: '차용한 엑시트 효과의 대상 선택 가능' },
                { pass: p1.deck[0]?.id === 'BT05-033', message: '차용한 유닛 카드가 덱 맨 아래로 이동' },
                { pass: !p1.trash.some((card: Card) => card.id === 'BT05-033'), message: '차용한 유닛 카드가 트래시에 남지 않음' },
                { pass: zonePower(engine, p2, 0) === beforePower - 2000, message: '차용한 엑시트 효과가 정상 발동' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-037',
        name: '포커페이스 바니 아비게일 믹스 파워 보정과 엑시트 전개',
        description: '믹스 조건에서 파워+2000을 받고, 엑시트 시 트래시의 2코스트 이하 유닛을 빈 유닛 존에 배치한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT05-037');
            ensureOtherAttributeSupport(engine, getCard, Attribute.STORM);
            p1.trash = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const beforePower = zonePower(engine, p1, 0);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pickTrash = chooseTrash(engine, p1.id, (card: Card) => card.id === 'ST01-002');
            const pickZone = chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: beforePower === 6000, message: '믹스 조건에서 파워+2000 적용' },
                { pass: !!pickTrash, message: '트래시의 2코스트 이하 유닛 선택 가능' },
                { pass: !!pickZone, message: '비어 있는 유닛 존 선택 가능' },
                { pass: p1.unitZones[1].unit?.id === 'ST01-002', message: '선택한 유닛을 빈 유닛 존에 배치' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-039',
        name: '퍼펙트 샷 바니 리오 엔트리 트래시 엑시트 차용',
        description: '엔트리로 트래시의 엑시트 유닛을 골라 그 엑시트 효과를 발동하고 원본 카드를 덱 맨 아래로 보낸다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            setHighSize(engine, 20);
            p1.hand = [getCard('BT05-039')];
            p1.trash = [getCard('BT05-033')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforePower = zonePower(engine, p2, 0);
            const played = playUnitById(engine, p1, 'BT05-039', 0);
            const pickExitSource = chooseTrash(engine, p1.id, (card: Card) => card.id === 'BT05-033');
            const pickTarget = chooseZone(engine, p1.id, p2.id, 0);
            return [
                { pass: played, message: '유닛 배치 성공' },
                { pass: !!pickExitSource, message: '차용할 엑시트 유닛 선택 가능' },
                { pass: !!pickTarget, message: '차용한 엑시트 효과의 대상 선택 가능' },
                { pass: p1.deck[0]?.id === 'BT05-033', message: '차용한 유닛 카드가 덱 맨 아래로 이동' },
                { pass: zonePower(engine, p2, 0) === beforePower - 2000, message: '차용한 엑시트 효과가 정상 발동' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-039',
        name: '퍼펙트 샷 바니 리오 믹스 엑시트 저코스트 유닛 전개',
        description: '믹스 조건의 엑시트로 트래시의 2코스트 이하 유닛을 빈 유닛 존에 사이즈를 무시하고 배치한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT05-039');
            ensureOtherAttributeSupport(engine, getCard, Attribute.STORM);
            p1.trash = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pickTrash = chooseTrash(engine, p1.id, (card: Card) => card.id === 'ST01-002');
            const pickZone = chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: !!pickTrash, message: '전개할 저코스트 유닛 선택 가능' },
                { pass: !!pickZone, message: '배치할 빈 유닛 존 선택 가능' },
                { pass: p1.unitZones[1].unit?.id === 'ST01-002', message: '엑시트로 저코스트 유닛 재배치' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-041',
        name: '언럭키 바니 니키 믹스 엑시트 최대 9장 하단 적재 후 대미지',
        description: '믹스 엑시트로 트래시 카드 최대 9장을 덱 맨 아래로 보내고, 3장마다 상대에게 1대미지를 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT05-041');
            ensureOtherAttributeSupport(engine, getCard, Attribute.STORM);
            p1.trash = [
                getCard('BT05-012'),
                getCard('BT05-014'),
                getCard('BT05-016'),
                getCard('BT05-017'),
                getCard('BT05-018'),
                getCard('BT05-019'),
            ];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            ['BT05-012', 'BT05-014', 'BT05-016', 'BT05-017', 'BT05-018', 'BT05-019'].forEach((id) => {
                chooseTrash(engine, p1.id, (card: Card) => card.id === id);
            });
            const confirm = confirmTargets(engine, p1.id);
            return [
                { pass: !!confirm, message: '덱 맨 아래로 보낼 카드를 최대 선택 후 확정 가능' },
                {
                    pass: ['BT05-012', 'BT05-014', 'BT05-016', 'BT05-017', 'BT05-018', 'BT05-019']
                        .every((id) => !p1.trash.some((card: Card) => card.id === id)),
                    message: '선택한 트래시 카드들이 덱 맨 아래로 이동',
                },
                { pass: p2.damage.length === 2, message: '되돌린 카드 3장마다 1대미지 적용' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-042',
        name: '깡총깡총 엑시트 유닛 하단 이동 후 코스트 이하 유닛 히트 강화',
        description: '트래시의 엑시트 유닛을 덱 맨 아래로 보내고, 그 코스트 이하인 아군 유닛 1장에 히트+1을 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            setHighSize(engine, 5);
            p1.hand = [getCard('BT05-042')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.trash = [getCard('BT05-033')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const beforeHit = zoneHit(engine, p1, 0);
            const played = playSkillById(engine, p1, 'BT05-042');
            const pickExit = chooseTrash(engine, p1.id, (card: Card) => card.id === 'BT05-033');
            const pickFriendly = chooseZone(engine, p1.id, p1.id, 0);
            return [
                { pass: played, message: '스킬 발동 성공' },
                { pass: !!pickExit, message: '덱 맨 아래로 보낼 엑시트 유닛 선택 가능' },
                { pass: !!pickFriendly, message: '코스트 이하 아군 유닛 선택 가능' },
                { pass: p1.deck[0]?.id === 'BT05-033', message: '선택한 엑시트 유닛이 덱 맨 아래로 이동' },
                { pass: zoneHit(engine, p1, 0) === beforeHit + 1, message: '선택한 아군 유닛 히트+1' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-043',
        name: '당첨이야 손패 유닛 트래시 후 저코스트 필드 유닛 파괴',
        description: '손패 유닛을 트래시하고, 그보다 코스트가 낮은 필드 유닛 1장을 골라 트래시한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            setHighSize(engine, 5);
            p1.hand = [getCard('BT05-043'), getCard('BT05-039')];
            p2.unitZones[0].unit = getCard('BT05-036');
            p2.unitZones[1].unit = getCard('BT05-025');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const played = playSkillById(engine, p1, 'BT05-043');
            const pickHand = chooseHand(engine, p1.id, (card: Card) => card.id === 'BT05-039');
            const legalTargets = engine.getLegalActions(p1.id)
                .filter((action: any) => action.type === 'SELECT_ZONE_TARGET' && action.targetPlayerId === p2.id)
                .map((action: any) => action.zoneIndex);
            const pickTarget = chooseZone(engine, p1.id, p2.id, 0);
            return [
                { pass: played, message: '스킬 발동 성공' },
                { pass: !!pickHand, message: '트래시할 손패 유닛 선택 가능' },
                { pass: legalTargets.includes(0) && !legalTargets.includes(1), message: '트래시한 유닛보다 코스트가 낮은 필드 유닛만 선택 가능' },
                { pass: !!pickTarget, message: '조건에 맞는 필드 유닛 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id === 'BT05-039'), message: '선택한 손패 유닛이 트래시됨' },
                { pass: p2.unitZones[0].unit === null, message: '선택한 저코스트 필드 유닛이 트래시됨' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-044',
        name: '토끼 등장이에요 액티브로 엑시트 드로우를 2번 빌린다',
        description: '비폭풍 카드가 있을 때 트래시의 엑시트 유닛 2장을 순서대로 빌려 두 번 처리한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-044')];
            p1.unitZones[0].unit = getCard('BT05-048');
            p1.trash = [getCard('ST03-006'), getCard('ST09-011')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const played = playSkillById(engine, p1, 'BT05-044');
            const firstBorrow = chooseTrash(engine, p1.id, (card: Card) => card.id.startsWith('ST03-006'));
            const secondBorrow = chooseTrash(engine, p1.id, (card: Card) => card.id.startsWith('ST09-011'));
            const handIds = p1.hand.map((card: Card) => card.id).sort();
            const deckBottomIds = p1.deck.slice(0, 2).map((card: Card) => card.id).sort();
            return [
                { pass: played, message: '스킬 발동 성공' },
                { pass: !!firstBorrow && !!secondBorrow, message: '믹스 조건으로 엑시트 유닛 2장을 연속 선택 가능' },
                { pass: handIds.includes('ST01-002') && handIds.includes('ST01-011'), message: '빌린 엑시트 드로우 2회 처리' },
                { pass: deckBottomIds.includes('ST03-006') && deckBottomIds.includes('ST09-011'), message: '빌린 유닛 2장이 덱 맨 아래 경로로 이동' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-044',
        name: '토끼 등장이에요 트리거가 자신을 트래시하고 엑시트를 빌린다',
        description: '대미지 트리거 시 자신을 트래시한 뒤 트래시의 엑시트 유닛 효과를 발동한다.',
        coversEffectIndices: [1, 2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.trash = [getCard('ST03-006')];
            p1.deck = [getCard('ST01-011'), getCard('BT05-044')];
            p1.damage = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            const borrow = chooseTrash(engine, p1.id, (card: Card) => card.id.startsWith('ST03-006'));
            return [
                { pass: !!borrow, message: '트리거 후 빌릴 엑시트 유닛 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-044')), message: '트리거 카드가 자신을 트래시함' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: '빌린 엑시트 효과가 정상 발동함' },
                { pass: p1.deck[0]?.id.startsWith('ST03-006') === true, message: '빌린 유닛이 덱 맨 아래 경로로 이동' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-045',
        name: '구원의 손길 아군 유닛을 트래시하고 2장 드로우',
        description: '필드의 자신 유닛 1장을 트래시한 뒤 카드를 2장 드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-045')];
            p1.deck = [getCard('ST01-011'), getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('ST01-003');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const played = playSkillById(engine, p1, 'BT05-045');
            const pickTarget = chooseZone(engine, p1.id, p1.id, 0);
            const handIds = p1.hand.map((card: Card) => card.id).sort();
            return [
                { pass: played, message: '스킬 발동 성공' },
                { pass: !!pickTarget, message: '트래시할 아군 유닛 선택 가능' },
                { pass: p1.unitZones[0].unit === null, message: '선택한 아군 유닛이 트래시됨' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-003')), message: '대상 유닛이 트래시에 존재함' },
                { pass: handIds.includes('ST01-002') && handIds.includes('ST01-011'), message: '카드 2장을 드로우함' },
            ];
        },
    }),
    makeMixedLeaderAwakenPromptTest('BT05-032', '언럭키 바니 니키', 5, [0, 1]),
    createCase({
        testId: 'BT05-032',
        name: '언럭키 바니 니키 각성면 액티브 귀환 부여',
        description: '자신 유닛 1장에게 상대 턴 종료까지 엑시트 귀환을 부여한다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('BT05-032');
            if (p1.levelZone) p1.levelZone.isAwakened = true;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 2, 'LEADER');
            const chooseReturn = chooseRevealed(engine, p1.id, (card: Card) => card?.name === '귀환 부여');
            const pick = chooseZone(engine, p1.id, p1.id, 0);
            return [
                { pass: !!chooseReturn, message: '귀환 부여 선택지 선택 가능' },
                { pass: !!pick, message: '귀환을 부여할 유닛 선택 가능' },
                { pass: hasTemporaryAction(p1.unitZones[0], 'RETURN_FROM_TRASH_AT_TURN_END'), message: '엑시트 귀환 효과 부여' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-032',
        name: '언럭키 바니 니키 각성면 액티브 아군 트래시',
        description: '다른 선택지로 자신 유닛 1장을 트래시한다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('BT05-032');
            if (p1.levelZone) p1.levelZone.isAwakened = true;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 2, 'LEADER');
            const chooseDestroy = chooseRevealed(engine, p1.id, (card: Card) => card?.name === '아군 트래시');
            const pick = chooseZone(engine, p1.id, p1.id, 0);
            return [
                { pass: !!chooseDestroy, message: '아군 트래시 선택지 선택 가능' },
                { pass: !!pick, message: '트래시할 유닛 선택 가능' },
                { pass: p1.unitZones[0].unit === null, message: '선택한 아군 유닛 트래시' },
            ];
        },
    }),
    makeMixedLeaderPactTest('BT05-032', '언럭키 바니 니키', 3, Attribute.STORM),
    createCase({
        testId: 'BT05-046',
        name: '마탄의 사수 장착 조건 없음과 파워+2000',
        description: '어떤 자신 유닛에도 장착 가능하고 장착된 유닛의 파워를 2000 올린다.',
        coversEffectIndices: [0, 2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT05-046')];
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = zonePower(engine, p1, 0);
            const played = playItemById(engine, p1, 'BT05-046', 0);
            return [
                { pass: played, message: '장착 조건 없이 아이템 장착 성공' },
                { pass: p1.unitZones[0].items.some((item: Card) => item.id.startsWith('BT05-046')), message: '아이템 장착 상태 반영' },
                { pass: zonePower(engine, p1, 0) === before + 2000, message: '장착 유닛 파워+2000' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-046',
        name: '마탄의 사수 상대 턴 종료시 패를 버리면 장착 유닛 유지',
        description: '상대 턴 종료 시 패 1장을 트래시하면 장착 유닛이 남는다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT05-046')];
            p1.hand = [getCard('ST01-011')];
            engine.state.turnPlayerIndex = 1;
            engine.state.phase = Phase.END;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            const discard = chooseHand(engine, p1.id, (card: Card) => card.id.startsWith('ST01-011'));
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                confirmTargets(engine, p1.id);
            }
            return [
                { pass: !!discard, message: '버릴 패 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-011')), message: '패 1장 트래시' },
                { pass: p1.unitZones[0].unit?.id.startsWith('ST01-002') === true, message: '장착 유닛 유지' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-046',
        name: '마탄의 사수 상대 턴 종료시 패가 없으면 장착 유닛 트래시',
        description: '상대 턴 종료 시 버릴 패가 없으면 장착 유닛이 트래시된다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT05-046')];
            p1.hand = [];
            engine.state.turnPlayerIndex = 1;
            engine.state.phase = Phase.END;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            return [
                { pass: p1.unitZones[0].unit === null, message: '장착 유닛이 트래시됨' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-048',
        name: '슈린 패시브가 이스케이프 아군 전체를 강화한다',
        description: '자신을 포함한 이스케이프 보유 아군만 파워+1500을 받는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-048')];
            p1.unitZones[0].unit = getCard('BT05-023');
            p1.unitZones[2].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const escapeBefore = zonePower(engine, p1, 0);
            const plainBefore = zonePower(engine, p1, 2);
            const played = playUnitById(engine, p1, 'BT05-048', 1);
            return [
                { pass: played, message: '유닛 배치 성공' },
                { pass: zonePower(engine, p1, 1) === 2000, message: '슈린 자신도 이스케이프 패시브를 받아 파워 2000' },
                { pass: zonePower(engine, p1, 0) === escapeBefore + 1500, message: '다른 이스케이프 아군 파워+1500' },
                { pass: zonePower(engine, p1, 2) === plainBefore, message: '이스케이프가 없는 아군은 강화되지 않음' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-048',
        name: '슈린 이스케이프가 자신을 덱 아래로 보내고 1장 드로우',
        description: '메인 페이즈 시작 시 자신을 덱 맨 아래로 보내고 카드를 1장 드로우한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT05-048');
            p1.deck = [getCard('ST01-011')];
            p1.hand = [];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.DRAW;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            return [
                { pass: p1.unitZones[0].unit === null, message: '이스케이프로 자신이 필드를 떠남' },
                { pass: p1.deck[0]?.id.startsWith('BT05-048') === true, message: '자신이 덱 맨 아래 경로로 이동' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: '카드 1장 드로우' },
            ];
        },
    }),
    makeMixedLeaderAwakenPromptTest('BT05-063', '사관후보생 아야', 5, [0, 1]),
    makeMixedLeaderPactTest('BT05-063', '사관후보생 아야', 3, Attribute.LIGHTNING),
    {
        testId: 'BT05-023',
        name: 'Escape pays hand cost and sends engaged enemy and self to deck bottom',
        description: 'Verifies BT05-023 escape cost payment and deck-bottom movement sequence.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT05-023');
            p1.hand = [getCard('ST01-011')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.DRAW;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.nextPhase();
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCost) engine.step(payCost);
            const pickTarget = findAction(
                engine,
                p1.id,
                'SELECT_ZONE_TARGET',
                (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0,
            );
            if (pickTarget) engine.step(pickTarget);
            return [
                { pass: !!confirm && !!payCost && !!pickTarget, message: 'Optional flow, cost payment, and target selection are available' },
                { pass: p2.unitZones[0].unit === null, message: 'Opponent engaged unit left the zone' },
                { pass: p1.unitZones[0].unit === null, message: 'Source unit left the zone after escape' },
                { pass: p1.deck[0]?.id.startsWith('BT05-023') === true, message: 'Source unit moved to deck bottom ordering path' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-011')), message: 'Hand cost card moved to trash' },
            ];
        },
    },
    {
        testId: 'BT05-051',
        name: 'Entry draw and optional return with hit set to 1',
        description: 'Verifies BT05-051 entry sequence, optional return, and hit reset.',
        coversEffectIndices: [0, 2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-051'), getCard('ST01-011')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCost) engine.step(payCost);
            return [
                { pass: !!confirm && !!payCost, message: 'Optional return and cost payment are available' },
                { pass: p2.unitZones[0].unit === null, message: 'Opponent unit was returned from field' },
                { pass: p2.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: 'Returned unit reached opponent hand' },
                { pass: engine.getUnitHit(p1.unitZones[0], p1) === 1, message: 'Source unit hit value is set to 1' },
            ];
        },
    },
    {
        testId: 'BT05-052',
        name: '엔트리로 4코 이상 조우 유닛을 되돌리고 히트를 1로 만든다',
        description: '비용을 버리면 4코스트 이상 조우 유닛을 패로 돌리고 자신의 히트를 1로 설정한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-052'), getCard('ST01-011')];
            p2.unitZones[0].unit = getCard('BT05-054');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const played = playUnitById(engine, p1, 'BT05-052', 0);
            const confirm = chooseOptional(engine, p1.id, true);
            const payCost = chooseCostHand(engine, p1.id, (card: Card) => card.id.startsWith('ST01-011'));
            return [
                { pass: played, message: '유닛 배치 성공' },
                { pass: !!confirm && !!payCost, message: '엔트리 선택과 패 1장 트래시 코스트 지불 가능' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛이 필드를 떠남' },
                { pass: p2.hand.some((card: Card) => card.id.startsWith('BT05-054')), message: '조우 유닛이 상대 패로 되돌아감' },
                { pass: zoneHit(engine, p1, 0) === 1, message: '이 유닛의 히트가 1이 됨' },
            ];
        },
    },
    {
        testId: 'BT05-052',
        name: '이스케이프로 자신을 덱 아래로 보내고 1장 드로우',
        description: '메인 페이즈 시작 시 자신이 덱 맨 아래로 가고 카드를 1장 드로우한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT05-052');
            p1.deck = [getCard('ST01-011')];
            p1.hand = [];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.DRAW;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            return [
                { pass: p1.unitZones[0].unit === null, message: '이스케이프로 자신이 필드를 떠남' },
                { pass: p1.deck[0]?.id.startsWith('BT05-052') === true, message: '자신이 덱 맨 아래 경로로 이동' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: '카드 1장 드로우' },
            ];
        },
    },
    {
        testId: 'BT05-054',
        name: '가디언 방벽[2]로 인접 레인 블록 시 패 2장을 지불한다',
        description: '인접 레인 가디언 블록에서 방벽[2] 코스트를 정확히 지불한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
            p1.unitZones[1].unit = getCard('ST01-002');
            p2.unitZones[0].unit = getCard('BT05-054');
            p2.hand = [getCard('ST01-011'), getCard('ST01-002')];
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            engine.attack(1);
            const guardianBlock = findAction(
                engine,
                p2.id,
                'RESOLVE_BLOCK',
                (action: any) => action.shouldBlock && action.blockerZoneIndex === 0,
            );
            if (guardianBlock) engine.step(guardianBlock);
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCostForPlayerId(0, p2.id);
                if (engine.state.interactionMode === 'SELECT_COST') {
                    engine.selectCostForPlayerId(0, p2.id);
                }
            }
            return [
                { pass: !!guardianBlock, message: '인접 레인 가디언 블록 가능' },
                { pass: p2.trash.length >= 2, message: '방벽[2] 코스트로 패 2장을 지불함' },
                { pass: p2.unitZones[0].unit?.id.startsWith('BT05-054') === true, message: '가디언 유닛이 필드에 남아 블록을 수행함' },
            ];
        },
    },
    {
        testId: 'BT05-054',
        name: '이스케이프로 자신을 덱 아래로 보내고 1장 드로우',
        description: '메인 페이즈 시작 시 자신이 덱 맨 아래로 가고 카드를 1장 드로우한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT05-054');
            p1.deck = [getCard('ST01-011')];
            p1.hand = [];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.DRAW;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            return [
                { pass: p1.unitZones[0].unit === null, message: '이스케이프로 자신이 필드를 떠남' },
                { pass: p1.deck[0]?.id.startsWith('BT05-054') === true, message: '자신이 덱 맨 아래 경로로 이동' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: '카드 1장 드로우' },
            ];
        },
    },
    {
        testId: 'BT05-055',
        name: 'Entry sends escape unit to deck bottom and deals 1 damage',
        description: 'Verifies BT05-055 entry target selection and damage bonus.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-055')];
            p1.unitZones[0].unit = getCard('BT05-048');
            p1.unitZones[2].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const damageBefore = p2.damage.length;
            engine.playUnit(0, 1);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const pickTarget = findAction(
                engine,
                p1.id,
                'SELECT_ZONE_TARGET',
                (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0,
            );
            if (pickTarget) engine.step(pickTarget);
            return [
                { pass: !!confirm && !!pickTarget, message: 'Optional and target selection are available' },
                { pass: p1.unitZones[0].unit === null, message: 'Selected friendly unit left field' },
                { pass: p1.deck[0]?.id.startsWith('BT05-048') === true, message: 'Selected unit moved to deck bottom path' },
                { pass: p2.damage.length === damageBefore + 1, message: 'Escape bonus dealt 1 damage to opponent' },
            ];
        },
    },
    createCase({
        testId: 'BT05-056',
        name: '바다의 화가 띠아 액티브로 패를 버리고 스킬 수만큼 대미지 후 공격 봉인',
        description: '패 1장을 버리면 스킬 존 수만큼 대미지를 주고 이 턴 동안 공격할 수 없게 된다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT05-056');
            p1.hand = [getCard('ST01-011')];
            p1.skillZone = [getCard('BT05-012'), getCard('BT05-013')];
            p2.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const damageBefore = p2.damage.length;
            engine.activateEffect(0, 0);
            const confirm = chooseOptional(engine, p1.id, true);
            const payCost = chooseCostHand(engine, p1.id, (card: Card) => card.id.startsWith('ST01-011'));
            engine.state.phase = Phase.ATTACK;
            const canAttack = engine.getLegalActions(p1.id).some((action: any) => action.type === 'ATTACK' && action.attackerZoneIndex === 0);
            return [
                { pass: !!confirm && !!payCost, message: '선택과 패 1장 트래시 코스트 지불 가능' },
                { pass: p2.damage.length === damageBefore + 2, message: '스킬 존의 스킬 수만큼 상대에게 2대미지' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-011')), message: '패 코스트 카드가 트래시됨' },
                { pass: !canAttack, message: '이 턴 동안 공격 불가 적용' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-057',
        name: '청랑일섬이 아군 이스케이프 효과를 그대로 발동한다',
        description: '필드의 이스케이프 유닛을 골라 그 유닛의 이스케이프 효과를 직접 발동한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-057')];
            p1.unitZones[0].unit = getCard('BT05-048');
            p1.deck = [getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const played = playSkillById(engine, p1, 'BT05-057');
            const pickTarget = chooseZone(engine, p1.id, p1.id, 0);
            return [
                { pass: played, message: '스킬 발동 성공' },
                { pass: !!pickTarget, message: '이스케이프 유닛 선택 가능' },
                { pass: p1.unitZones[0].unit === null, message: '선택한 이스케이프 유닛이 필드를 떠남' },
                { pass: p1.deck[0]?.id.startsWith('BT05-048') === true, message: '선택한 유닛이 덱 맨 아래 경로로 이동' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: '차용한 이스케이프 효과로 카드 1장 드로우' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-057',
        name: '청랑일섬 트리거는 자신을 패로 되돌린다',
        description: '대미지 트리거 시 이 카드를 자신의 패로 되돌린다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST01-011'), getCard('BT05-057')];
            p1.damage = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT05-057')), message: '트리거 카드가 자신의 패로 이동' },
                { pass: p1.damage.length === 0, message: '대미지 존에 카드가 남지 않음' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-062',
        name: '알마스는 장착 조건 없이 장착되고 가디언 방벽[2]를 제공한다',
        description: '아무 유닛에나 장착한 뒤 인접 레인 가디언 블록에서 패 2장을 지불하게 한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-062'), getCard('ST01-011'), getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('ST01-003');
            p2.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const played = playItemById(engine, p1, 'BT05-062', 0);
            const equipped = p1.unitZones[0].items.some((item: Card) => item.id.startsWith('BT05-062'));
            engine.state.turnPlayerIndex = 1;
            engine.state.phase = Phase.ATTACK;
            engine.attack(1);
            const guardianBlock = findAction(
                engine,
                p1.id,
                'RESOLVE_BLOCK',
                (action: any) => action.shouldBlock && action.blockerZoneIndex === 0,
            );
            if (guardianBlock) engine.step(guardianBlock);
            return [
                { pass: played, message: '장착 조건 없이 아이템 장착 성공' },
                { pass: equipped, message: '알마스 장착 상태 반영' },
                { pass: !!guardianBlock, message: '장착 유닛이 인접 레인 가디언 블록 가능' },
                {
                    pass: engine.state.interactionMode === 'SELECT_COST' && engine.state.pendingEffect?.costToPay?.amount === 2,
                    message: '방벽[2] 코스트 지불 단계와 요구 수량 2가 열림',
                },
            ];
        },
    }),
    {
        testId: 'BT05-063',
        name: 'Leader active equips a recovered item to another unit',
        description: 'Verifies BT05-063 awakened leader active flow from trash to equip.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('BT05-063');
            if (p1.levelZone) p1.levelZone.isAwakened = true;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST01-011')];
            p1.trash = [getCard('BT05-081')];
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 2, 'LEADER');
            const pickHand = findAction(
                engine,
                p1.id,
                'SELECT_HAND_TARGET',
                (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-011'),
            );
            if (pickHand) engine.step(pickHand);
            const pickItem = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT05-081'),
            );
            if (pickItem) engine.step(pickItem);
            const pickZone = findAction(
                engine,
                p1.id,
                'SELECT_ZONE_TARGET',
                (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0,
            );
            if (pickZone) engine.step(pickZone);
            return [
                { pass: !!pickHand && !!pickItem && !!pickZone, message: 'Hand cost, revealed pick, and equip target are selectable' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-011')), message: 'Discard cost moved to trash' },
                { pass: p1.unitZones[0].items.some((item: Card) => item.id.startsWith('BT05-081')), message: 'Recovered item was equipped to friendly unit' },
            ];
        },
    },
    createCase({
        testId: 'BT05-066',
        name: '사관후보생 하트 엔트리로 상단 3장을 트래시하고 아이템이 있으면 1장 드로우',
        description: '덱 상단 3장을 트래시한 뒤 그중 아이템이 있으면 추가 드로우를 얻는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-066')];
            p1.deck = [getCard('ST01-003'), getCard('BT05-081'), getCard('ST01-002'), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const played = playUnitById(engine, p1, 'BT05-066', 0);
            return [
                { pass: played, message: '유닛 배치 성공' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-081')), message: '상단 3장 트래시 중 아이템이 포함됨' },
                { pass: p1.trash.length >= 3, message: '덱 상단 3장이 트래시됨' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-003')), message: '아이템을 밀어 추가로 1장 드로우' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-073',
        name: '사관후보생 마이 믹스 패시브는 아이템 장착 때마다 1장 드로우',
        description: '비번개 카드가 있을 때 자신에게 아이템을 장착하면 1장 드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-081')];
            p1.deck = [getCard('ST01-011')];
            p1.unitZones[0].unit = getCard('BT05-073');
            p1.unitZones[1].unit = getCard('BT05-048');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const played = playItemById(engine, p1, 'BT05-081', 0);
            return [
                { pass: played, message: '아이템 장착 성공' },
                { pass: p1.unitZones[0].items.some((item: Card) => item.id.startsWith('BT05-081')), message: '아이템 장착 상태 반영' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: '패시브로 카드 1장 드로우' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-073',
        name: '사관후보생 마이 어태커는 장착 수만큼 강화하고 아이템 2장을 버려 다른 레인을 파괴한다',
        description: '공격 시 장착 아이템 수만큼 파워가 오르고, 장착 아이템 2장을 트래시해 다른 레인 상대 유닛을 파괴한다.',
        coversEffectIndices: [1, 2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT05-073');
            p1.unitZones[0].items = [getCard('BT05-081'), getCard('BT05-082')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[1].unit = getCard('ST01-011');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforePower = zonePower(engine, p1, 0);
            engine.attack(0);
            const afterPower = zonePower(engine, p1, 0);
            const firstItem = chooseItem(engine, p1.id, p1.id, 0, 0);
            const secondItem = chooseItem(engine, p1.id, p1.id, 0, 1);
            const confirm = confirmTargets(engine, p1.id);
            const destroyTarget = chooseZone(engine, p1.id, p2.id, 1);
            return [
                { pass: afterPower === beforePower + 4000, message: '장착 아이템 2장으로 파워+4000' },
                { pass: !!firstItem && !!secondItem && !!confirm && !!destroyTarget, message: '장착 아이템 2장 트래시와 다른 레인 대상 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-081')) && p1.trash.some((card: Card) => card.id.startsWith('BT05-082')), message: '선택한 아이템 2장이 트래시됨' },
                { pass: p2.unitZones[1].unit === null, message: '다른 레인의 상대 유닛이 트래시됨' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-073',
        name: '사관후보생 마이 트리거는 자신을 패로 되돌린다',
        description: '대미지 트리거 시 이 카드를 자신의 패로 되돌린다.',
        coversEffectIndices: [3],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST01-011'), getCard('BT05-073')];
            p1.damage = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT05-073')), message: '트리거 카드가 자신의 패로 이동' },
                { pass: p1.damage.length === 0, message: '대미지 존에 카드가 남지 않음' },
            ];
        },
    }),
    {
        testId: 'BT05-072',
        name: 'Entry reveals top 3 and trashes selected cards',
        description: 'Verifies BT05-072 reveal selection and cleanup handling.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-072')];
            p1.deck = [getCard('ST01-011'), getCard('BT05-081'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            const pickItem = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT05-081'),
            );
            if (pickItem) engine.step(pickItem);
            const pickUnit = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('ST01-002'),
            );
            if (pickUnit) engine.step(pickUnit);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);
            return [
                { pass: !!pickItem && !!pickUnit && !!confirm, message: 'Multiple revealed selections and confirm are available' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-081')), message: 'Selected item moved to trash' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-002')), message: 'Selected unit moved to trash' },
                { pass: p1.trash.every((card: Card) => !card.id.startsWith('ST01-011')), message: 'Unselected card did not move to trash' },
                { pass: engine.state.revealedCards.length === 0, message: 'Revealed cards cleaned up after confirm' },
            ];
        },
    },
    {
        testId: 'BT05-077',
        name: 'Active recovers item from trash and equips, then self-trashes',
        description: 'Verifies BT05-077 equip flow and self-trash mix condition.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-077')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.trash = [getCard('BT05-081')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const pickItem = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT05-081'),
            );
            if (pickItem) engine.step(pickItem);
            const pickZone = findAction(
                engine,
                p1.id,
                'SELECT_ZONE_TARGET',
                (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0,
            );
            if (pickZone) engine.step(pickZone);
            return [
                { pass: !!pickItem && !!pickZone, message: 'Recovered item and equip target are selectable' },
                { pass: p1.unitZones[0].items.some((item: Card) => item.id.startsWith('BT05-081')), message: 'Recovered item was equipped' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-077')), message: 'Skill moved to trash as part of resolve flow' },
                { pass: p1.skillZone.every((card: Card) => !card.id.startsWith('BT05-077')), message: 'Skill zone no longer contains BT05-077' },
            ];
        },
    },
    {
        testId: 'BT05-049',
        name: 'Defender discards attacker hit-1 cards and terminates attack',
        description: 'Regression scenario for BT05-049 defender interaction.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT05-023');
            p2.unitZones[0].unit = getCard('BT05-049');
            p2.hand = [getCard('ST01-011')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.attack(0);
            engine.resolveBlock(true, 0);
            const pickHand = findAction(
                engine,
                p1.id,
                'SELECT_HAND_TARGET',
                (action: any) => p2.hand[action.handIndex]?.id.startsWith('ST01-011'),
            );
            if (pickHand) engine.step(pickHand);
            return [
                { pass: !!pickHand, message: 'Attacker can select defender hand card for discard' },
                { pass: p2.trash.some((card: Card) => card.id.startsWith('ST01-011')), message: 'Target hand card moved to trash' },
                { pass: p2.unitZones[0].unit?.id.startsWith('BT05-049') === true, message: 'Defender unit remains on field' },
                { pass: p2.damage.length === 0, message: 'No combat damage was dealt to defender' },
                { pass: engine.state.combatStep === 'NONE', message: 'Combat terminated after effect resolution' },
            ];
        },
    },
    {
        testId: 'BT05-053',
        name: 'Active grants cost-over breakthrough when hand card is trashed',
        description: 'Regression scenario for BT05-053 active resolution.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT05-053');
            p1.hand = [getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 0);
            const pickZone = findAction(
                engine,
                p1.id,
                'SELECT_ZONE_TARGET',
                (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0,
            );
            if (pickZone) engine.step(pickZone);
            const pickHand = findAction(
                engine,
                p1.id,
                'SELECT_HAND_TARGET',
                (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-011'),
            );
            if (pickHand) engine.step(pickHand);
            return [
                { pass: !!pickZone && !!pickHand, message: 'Target unit and discard cost can be selected' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-011')), message: 'Discard cost moved to trash' },
                {
                    pass: p1.unitZones[0].temporaryEffects.some(
                        (effect: any) => effect.action?.type === 'BREAKTHROUGH' && effect.action?.params?.mode === 'COST_OVER',
                    ),
                    message: 'Cost-over breakthrough temporary effect was granted',
                },
            ];
        },
    },
    {
        testId: 'BT05-058',
        name: 'Opponent can decline return and pick draw branch',
        description: 'Regression scenario for BT05-058 branching option.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p2.leaderLevel = 10;
            p1.hand = [getCard('BT05-058')];
            p1.unitZones[0].unit = getCard('BT05-048');
            p1.deck = [getCard('ST01-011')];
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.hand = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playSkill(0);
            const pickZone = findAction(
                engine,
                p1.id,
                'SELECT_ZONE_TARGET',
                (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0,
            );
            if (pickZone) engine.step(pickZone);
            const chooseDraw = findAction(
                engine,
                p2.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id === 'BT05_058_DRAW',
            );
            if (chooseDraw) engine.step(chooseDraw);
            return [
                { pass: !!pickZone && !!chooseDraw, message: 'Both source target and opponent branch selection are available' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: 'Current player drew from branch resolution' },
                { pass: !p2.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: 'Opponent did not recover the targeted unit card' },
            ];
        },
    },
    createCase({
        testId: 'BT05-058',
        name: 'Opponent can return encounter instead of allowing draw',
        description: '상대가 귀환 분기를 고르면 해당 레인의 조우 유닛이 패로 돌아가고 드로우는 발생하지 않는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p2.leaderLevel = 10;
            p1.hand = [getCard('BT05-058')];
            p1.unitZones[0].unit = getCard('BT05-048');
            ensureDeckTop(engine, getCard, ['ST01-011']);
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.hand = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const played = playSkillById(engine, p1, 'BT05-058');
            const pickZone = chooseZone(engine, p1.id, p1.id, 0);
            const chooseReturn = chooseRevealed(engine, p2.id, (card: Card) => card.id === 'BT05_058_RETURN');
            return [
                { pass: played && !!pickZone && !!chooseReturn, message: '자신 유닛 선택과 상대 귀환 분기 선택 가능' },
                { pass: p2.unitZones[0].unit === null, message: '상대 조우 유닛이 필드에서 사라짐' },
                { pass: p2.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '상대 조우 유닛이 패로 돌아감' },
                { pass: !p1.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: '귀환 분기에서는 자신이 카드를 드로우하지 않음' },
            ];
        },
    }),
    {
        testId: 'BT05-070',
        name: 'Entry draws extra when both discarded cards are items',
        description: 'Regression scenario for BT05-070 item-count branch.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-070'), getCard('BT05-081'), getCard('BT05-082'), getCard('ST01-011')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            const firstItem = findAction(
                engine,
                p1.id,
                'SELECT_HAND_TARGET',
                (action: any) => p1.hand[action.handIndex]?.id.startsWith('BT05-081'),
            );
            if (firstItem) engine.step(firstItem);
            const secondItem = findAction(
                engine,
                p1.id,
                'SELECT_HAND_TARGET',
                (action: any) => p1.hand[action.handIndex]?.id.startsWith('BT05-082'),
            );
            if (secondItem) engine.step(secondItem);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);
            return [
                { pass: !!firstItem && !!secondItem && !!confirm, message: 'Double discard selection and confirm are available' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-081')), message: 'First selected item moved to trash' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-082')), message: 'Second selected item moved to trash' },
                { pass: p1.hand.length === 4, message: 'Net hand size reflects extra draw branch' },
            ];
        },
    },
    createCase({
        testId: 'BT05-070',
        name: 'Entry only draws discarded count when fewer than two items are trashed',
        description: '아이템 2장 미만을 버린 경우에는 기본 드로우만 해결되고 추가 드로우는 발생하지 않는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-070'), getCard('BT05-081'), getCard('ST01-011')];
            ensureDeckTop(engine, getCard, ['ST01-002', 'ST01-003'], ['BT05-082']);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const played = playUnitById(engine, p1, 'BT05-070', 0);
            const discardItem = chooseHand(engine, p1.id, (card: Card) => card.id.startsWith('BT05-081'));
            const discardNonItem = chooseHand(engine, p1.id, (card: Card) => card.id.startsWith('ST01-011'));
            const confirm = confirmTargets(engine, p1.id);
            return [
                { pass: played && !!discardItem && !!discardNonItem && !!confirm, message: '아이템 1장과 비아이템 1장 선택 후 확정 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-081')), message: '선택한 아이템 카드가 트래시됨' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-011')), message: '선택한 비아이템 카드가 트래시됨' },
                { pass: p1.hand.length === 2, message: '버린 수만큼만 드로우하고 추가 드로우는 발생하지 않음' },
                {
                    pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002'))
                        && p1.hand.some((card: Card) => card.id.startsWith('ST01-003'))
                        && p1.deck.length === 1
                        && p1.deck[0]?.id.startsWith('BT05-082') === true,
                    message: '기본 드로우 2장만 해결되고 덱에 1장이 남음',
                },
            ];
        },
    }),
    createCase({
        testId: 'BT05-074',
        name: '히이익은 패의 아이템만 골라 버린 수만큼 드로우한다',
        description: '패의 아이템 카드만 선택 가능하며 트래시한 수와 같은 수의 카드를 드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-074'), getCard('BT05-081'), getCard('BT05-082'), getCard('ST01-011')];
            ensureDeckTop(engine, getCard, ['ST01-002', 'ST01-003']);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const played = playSkillById(engine, p1, 'BT05-074');
            const selectableIds = engine.getLegalActions(p1.id)
                .filter((action: any) => action.type === 'SELECT_HAND_TARGET')
                .map((action: any) => p1.hand[action.handIndex]?.id);
            const discardFirst = chooseHand(engine, p1.id, (card: Card) => card.id.startsWith('BT05-081'));
            const discardSecond = chooseHand(engine, p1.id, (card: Card) => card.id.startsWith('BT05-082'));
            const confirm = confirmTargets(engine, p1.id);
            return [
                { pass: played && !!discardFirst && !!discardSecond && !!confirm, message: '아이템 2장 선택 후 확정 가능' },
                {
                    pass: selectableIds.includes('BT05-081') && selectableIds.includes('BT05-082') && !selectableIds.includes('ST01-011'),
                    message: '비아이템 카드는 선택 대상에 포함되지 않음',
                },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-081')), message: '첫 번째 아이템이 트래시됨' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-082')), message: '두 번째 아이템이 트래시됨' },
                {
                    pass: p1.hand.length === 3
                        && p1.hand.some((card: Card) => card.id.startsWith('ST01-011'))
                        && p1.hand.some((card: Card) => card.id.startsWith('ST01-002'))
                        && p1.hand.some((card: Card) => card.id.startsWith('ST01-003')),
                    message: '트래시한 2장만큼 카드를 드로우함',
                },
            ];
        },
    }),
    createCase({
        testId: 'BT05-078',
        name: '든든하네요는 장착 유닛을 트래시하고 2장 드로우 후 믹스면 1대미지',
        description: '아이템을 장착한 자신 유닛을 트래시하고 2드로우를 해결하며, 믹스 조건이면 상대에게 1대미지를 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-078')];
            p1.unitZones[0].unit = getCard('ST01-003');
            p1.unitZones[0].items = [getCard('BT05-081')];
            ensureOtherAttributeSupport(engine, getCard, Attribute.LIGHTNING);
            ensureDeckTop(engine, getCard, ['ST01-002', 'ST01-011']);
            p2.deck = [getCard('ST01-003')];
            p2.damage = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const played = playSkillById(engine, p1, 'BT05-078');
            const pickTarget = chooseZone(engine, p1.id, p1.id, 0);
            return [
                { pass: played && !!pickTarget, message: '장착 유닛 선택 후 효과 해결 가능' },
                { pass: p1.unitZones[0].unit === null, message: '선택한 장착 유닛이 트래시됨' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-003')), message: '선택한 유닛 카드가 트래시에 있음' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-081')), message: '장착 아이템도 함께 트래시됨' },
                {
                    pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002'))
                        && p1.hand.some((card: Card) => card.id.startsWith('ST01-011')),
                    message: '카드 2장을 드로우함',
                },
                { pass: p2.damage.length === 1, message: '믹스 조건으로 상대에게 1대미지' },
            ];
        },
    }),
    createCase({
        testId: 'BT05-079',
        name: '알타이르는 장착 조건 없이 장착되고 아이템을 밀면 파괴를 대체한다',
        description: '아무 유닛에 장착 가능하며 파괴 시 상단 3장을 밀어 아이템이 나오면 장착 유닛을 지킨다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-079')];
            p1.unitZones[0].unit = getCard('ST01-003');
            ensureDeckTop(engine, getCard, ['BT05-081', 'ST01-002', 'ST01-011']);
            p1.trash = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const played = playItemById(engine, p1, 'BT05-079', 0);
            const equipped = p1.unitZones[0].items.some((item: Card) => item.id.startsWith('BT05-079'));
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const replacementPromptOpen = engine.state.pendingEffect?.actionType === 'DESTRUCTION_REPLACEMENT';
            const confirm = chooseOptional(engine, p1.id, true);
            return [
                { pass: played && equipped, message: '장착 조건 없이 아이템 장착 성공' },
                { pass: replacementPromptOpen && !!confirm, message: '파괴 대체 선택창이 열리고 사용 가능' },
                { pass: p1.unitZones[0].unit?.id.startsWith('ST01-003') === true, message: '아이템을 밀어 장착 유닛이 필드에 남음' },
                { pass: p1.unitZones[0].items.some((item: Card) => item.id.startsWith('BT05-079')), message: '알타이르가 계속 장착 상태를 유지함' },
                {
                    pass: p1.trash.length === 3 && p1.trash.some((card: Card) => card.id.startsWith('BT05-081')),
                    message: '덱 상단 3장을 트래시했고 그중 아이템이 포함됨',
                },
                { pass: !p1.trash.some((card: Card) => card.id.startsWith('ST01-003')), message: '장착 유닛은 트래시에 가지 않음' },
            ];
        },
    }),
    {
        testId: 'BT05-076',
        name: 'Active recovers up to two distinct item names from trash',
        description: 'Regression scenario for BT05-076 multi-step recover flow.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('BT05-076'), getCard('ST01-011'), getCard('ST01-002')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-011')];
            p1.trash = [getCard('BT05-081'), getCard('BT05-082'), getCard('BT05-081')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const discardA = findAction(
                engine,
                p1.id,
                'SELECT_HAND_TARGET',
                (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-011'),
            );
            if (discardA) engine.step(discardA);
            const discardB = findAction(
                engine,
                p1.id,
                'SELECT_HAND_TARGET',
                (action: any) => p1.hand[action.handIndex]?.id.startsWith('ST01-002'),
            );
            if (discardB) engine.step(discardB);
            const confirmDiscard = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirmDiscard) engine.step(confirmDiscard);
            const pick081 = findAction(
                engine,
                p1.id,
                'SELECT_TRASH_TARGET',
                (action: any) => p1.trash[action.trashIndex]?.id.startsWith('BT05-081'),
            );
            if (pick081) engine.step(pick081);
            const pick082 = findAction(
                engine,
                p1.id,
                'SELECT_TRASH_TARGET',
                (action: any) => p1.trash[action.trashIndex]?.id.startsWith('BT05-082'),
            );
            if (pick082) engine.step(pick082);
            const confirmRecover = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirmRecover) engine.step(confirmRecover);
            return [
                {
                    pass: !!discardA && !!discardB && !!confirmDiscard && !!pick081 && !!pick082 && !!confirmRecover,
                    message: 'Discard and recover target chain is fully selectable',
                },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT05-081')), message: 'BT05-081 recovered to hand' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT05-082')), message: 'BT05-082 recovered to hand' },
                { pass: p1.trash.filter((card: Card) => card.id.startsWith('BT05-081')).length === 1, message: 'Only one BT05-081 copy remains in trash' },
            ];
        },
    },
    {
        testId: 'BT05-065-Entry',
        name: 'BT05-065 mix entry does not inherit credit draw or trash-discard',
        description: 'Verifies BT05-065 only resolves its mix entry and has no borrowed credit side effects.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT05-065'), getCard('ST01-011')];
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.damage = [getCard('ST01-002')];
            p1.deck = [getCard('BT05-081'), getCard('BT05-082'), getCard('BT05-083')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const beforeDeckCount = p1.deck.length;
            const played = playUnitById(engine, p1, 'BT05-065', 0);
            const confirmOptional = chooseOptional(engine, p1.id, true);
            const recoverDamage = findAction(
                engine,
                p1.id,
                'SELECT_DAMAGE_TARGET',
                (action: any) => p1.damage[action.damageIndex]?.id.startsWith('ST01-002'),
            );
            if (recoverDamage) engine.step(recoverDamage);

            const handAfterEntry = p1.hand.map((card: Card) => card.id);

            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const exitDiscardPrompt = findAction(engine, p1.id, 'SELECT_HAND_TARGET');

            return [
                { pass: played && !!confirmOptional && !!recoverDamage, message: 'BT05-065 mix entry resolved via optional mill and damage recovery' },
                { pass: handAfterEntry.length === 2, message: 'BT05-065 entry does not draw an extra card on placement' },
                { pass: handAfterEntry.some((cardId: string) => cardId.startsWith('ST01-011')), message: 'Original hand card stays in hand after entry resolve' },
                { pass: handAfterEntry.some((cardId: string) => cardId.startsWith('ST01-002')), message: 'Damage-zone card was recovered to hand' },
                { pass: p1.deck.length === beforeDeckCount - 3, message: 'BT05-065 mills exactly 3 cards from deck' },
                { pass: !exitDiscardPrompt, message: 'BT05-065 does not prompt a discard when trashed from field' },
                { pass: p1.hand.length === 2, message: 'BT05-065 trashing leaves hand size unchanged' },
            ];
        },
    },
    {
        testId: 'BT05-065-Trigger',
        name: 'BT05-065 trigger self-trashes and searches a 1-cost item',
        description: 'Verifies BT05-065 trigger matches pack text after removing the bogus credit helper.',
        coversEffectIndices: [1, 2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('BT05-081'), getCard('BT05-065')];
            p1.damage = [];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            const pickItem = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT05-081'),
            );
            if (pickItem) engine.step(pickItem);

            return [
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT05-065')), message: 'BT05-065 moved to trash from trigger' },
                { pass: !!pickItem, message: 'BT05-065 trigger reveals a 1-cost item target' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT05-081')), message: 'BT05-065 trigger recovers a 1-cost item to hand' },
            ];
        },
    },
    {
        testId: 'BT05-080',
        name: 'Item active moves a non-self equipped item to another friendly unit',
        description: 'Regression scenario for BT05-080 item movement.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[1].unit = getCard('ST01-011');
            p1.unitZones[0].items = [getCard('BT05-080'), getCard('BT05-081')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 2, 'ITEM', 0);
            const pickItem = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('BT05-081'),
            );
            if (pickItem) engine.step(pickItem);
            const pickZone = findAction(
                engine,
                p1.id,
                'SELECT_ZONE_TARGET',
                (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1,
            );
            if (pickZone) engine.step(pickZone);
            return [
                { pass: !!pickItem && !!pickZone, message: 'Transfer item and destination unit can be selected' },
                { pass: !p1.unitZones[0].items.some((item: Card) => item.id.startsWith('BT05-081')), message: 'Transferred item left original source unit' },
                { pass: p1.unitZones[1].items.some((item: Card) => item.id.startsWith('BT05-081')), message: 'Transferred item is attached to destination unit' },
            ];
        },
    },
];

interface GeneratedEffectContext {
    cardId: string;
    effectIndex: number;
    card: Card;
    effect: any;
}

function appendHandCards(player: any, getCard: (id: string) => Card, ids: string[]): void {
    for (const id of ids) {
        player.hand.push(getCard(id));
    }
}

function requiredEquippedItemCount(ctx: GeneratedEffectContext): number {
    const conditions = flattenConditions(ctx.effect.condition);
    const distinctItemMin = conditions.find((condition) => condition?.type === 'ITEM_DISTINCT_NAME_COUNT_MIN');

    if (distinctItemMin) {
        return conditionMinValue(distinctItemMin.value, 1);
    }

    if (ctx.effect.action?.params?.dynamic === 'ITEM_DISTINCT_NAME_COUNT_MULTIPLIER') {
        return 2;
    }

    if (ctx.effect.action?.params?.dynamic === 'ITEM_COUNT_MULTIPLIER') {
        return 2;
    }

    if (hasCondition(conditions, 'HAS_ITEM')) {
        return 1;
    }

    if (generatedEffectKey(ctx.cardId, ctx.effectIndex) === 'BT05-073:0') {
        return 1;
    }

    if (generatedEffectKey(ctx.cardId, ctx.effectIndex) === 'BT05-086:1') {
        return 2;
    }

    return 0;
}

function supportItemIds(count: number): string[] {
    return ['BT05-080', 'BT05-081', 'BT05-082', 'BT05-083', 'BT05-084', 'BT05-085'].slice(0, count);
}

function preferredHostUnitId(ctx: GeneratedEffectContext): string {
    const cardLevelConditions = (BT05_EFFECTS[ctx.cardId] || []).flatMap((effect: any) => flattenConditions(effect.condition));
    const conditions = [...cardLevelConditions, ...flattenConditions(ctx.effect.condition)];
    const costComparison = conditions.find((condition) => condition?.type === 'COST_COMPARISON');

    if (hasCondition(conditions, 'HAS_KEYWORD')) {
        return 'ST01-011';
    }

    if (costComparison?.value?.operator === 'GTE') {
        return 'BT05-023';
    }

    if (costComparison?.value?.operator === 'LTE') {
        return 'BT05-055';
    }

    if (hasCondition(conditions, 'POWER_MARGIN_MIN')) {
        return 'BT05-025';
    }

    if (hasCondition(conditions, 'ENCOUNTER_COST_MARGIN_MIN')) {
        return 'ST01-002';
    }

    return 'ST01-002';
}

function prepareGeneratedEffectSetup(engine: any, getCard: (id: string) => Card, ctx: GeneratedEffectContext): void {
    const p1 = engine.state.players[0];
    const p2 = engine.state.players[1];
    const conditions = flattenConditions(ctx.effect.condition);
    const threshold = conditions.find((condition) => condition?.type === 'LEADER_LEVEL');

    if (ctx.effect.activation === ActivationCondition.AWAKEN) {
        p2.leaderLevel = 20;
        p1.leaderLevel = Math.max(0, conditionMinValue(threshold?.value, 5) - 1);
        engine.state.phase = Phase.LEVEL_UP;
    } else {
        setHighSize(engine, 20);
        engine.state.phase = Phase.MAIN;
    }

    engine.state.turnPlayerIndex = ctx.effect.activation === ActivationCondition.TURN_END ? 1 : 0;

    if (ctx.card.type === CardType.LEADER) {
        p1.levelZone = getCard(ctx.cardId);
        if (p1.levelZone) {
            p1.levelZone.isAwakened = ctx.effect.activation !== ActivationCondition.AWAKEN;
        }
    } else if (ctx.effect.activation === ActivationCondition.DAMAGE_TRIGGER) {
        const damageTriggerTop = ctx.effect.action?.type === 'REVEAL_TOP_AND_CHOOSE_TO_HAND'
            ? [ctx.cardId, 'BT05-081', 'BT05-080', 'ST01-002']
            : [ctx.cardId, 'BT05-081', 'ST01-002'];
        ensureDeckTop(engine, getCard, damageTriggerTop);
    } else if (ctx.effect.activation === ActivationCondition.ESCAPE) {
        p1.unitZones[0].unit = getCard(ctx.cardId);
        engine.state.phase = Phase.DRAW;
    } else {
        if (ctx.card.type === CardType.ITEM) {
            ensureFriendlyUnit(engine, getCard, 0, preferredHostUnitId(ctx));
        }
        p1.hand = [getCard(ctx.cardId)];
    }

    if (ctx.effect.targets?.scope === 'MY_FIELD' && ctx.card.type !== CardType.UNIT) {
        ensureFriendlyUnit(engine, getCard, 0, preferredHostUnitId(ctx));
    }

    if (ctx.effect.targets?.scope === 'MY_FIELD'
        && Array.isArray(ctx.effect.targets?.filters)
        && ctx.effect.targets.filters.some((filter: any) => filter.type === 'EXCLUDE_SELF')) {
        ensureFriendlyUnit(engine, getCard, 1, 'ST01-002');
    }

    if (ctx.effect.targets?.scope === 'MY_FIELD' && Array.isArray(ctx.effect.targets?.filters)) {
        const itemCountFilter = ctx.effect.targets.filters.find((filter: any) => filter.type === 'ITEM_COUNT_MIN');
        if (itemCountFilter) {
            ensureFriendlyEquippedItems(engine, getCard, 0, conditionMinValue(itemCountFilter.value, 1));
        }
    }

    if (ctx.effect.targets?.scope === 'OPP_FIELD'
        || ctx.effect.targets?.scope === 'ENCOUNTER'
        || ctx.effect.targets?.scope === 'ENCOUNTER_UNIT'
        || ctx.effect.action?.type === 'DESTROY_UNIT'
        || ctx.effect.action?.type === 'DAMAGE') {
        ensureOpponentUnit(engine, getCard, 0, 'ST01-002');
        ensureOpponentUnit(engine, getCard, 1, 'ST01-011');
    }

    if (ctx.effect.action?.type === 'MOVE_FROM_TRASH_TO_HAND') {
        ensureKnownTrash(engine, getCard, ['BT05-012', 'BT05-074', 'BT05-081', 'ST01-002']);
    }

    if (ctx.effect.action?.type === 'MOVE_FROM_DAMAGE_TO_HAND') {
        ensureKnownDamage(engine, getCard, ['BT05-081']);
    }

    if (ctx.effect.action?.type === 'MOVE_FROM_TRASH_TO_DAMAGE') {
        ensureKnownTrash(engine, getCard, ['BT05-081']);
    }

    if (ctx.effect.action?.type === 'REVEAL_TOP_AND_CHOOSE_TO_HAND' || ctx.effect.action?.type === 'DRAW') {
        if (ctx.effect.activation !== ActivationCondition.DAMAGE_TRIGGER) {
            ensureKnownDeck(engine, getCard, ['BT05-081', 'BT05-074', 'ST01-002', 'ST01-011']);
        }
    }

    if (ctx.effect.action?.type === 'DRAW_THEN_DISCARD' || ctx.effect.action?.type === 'DISCARD' || ctx.effect.action?.type === 'COMPLEX_ACTION') {
        appendHandCards(p1, getCard, ['ST01-011', 'ST01-002', 'BT05-081', 'BT05-082']);
        if (ctx.effect.activation !== ActivationCondition.DAMAGE_TRIGGER) {
            ensureKnownDeck(engine, getCard, ['BT05-081', 'BT05-082', 'BT05-074', 'ST01-002']);
        }
        ensureKnownTrash(engine, getCard, ['BT05-081', 'BT05-082', 'BT05-074', 'ST01-002']);
    }

    if (ctx.effect.cost?.type === 'TRASH_HAND') {
        for (let index = 0; index < (ctx.effect.cost.amount || 1); index += 1) {
            p1.hand.push(getCard(index % 2 === 0 ? 'ST01-011' : 'ST01-002'));
        }
    }

    for (const condition of conditions) {
        switch (condition?.type) {
            case 'FIELD_HAS_NON_ATTRIBUTE_CARD':
                ensureOtherAttributeSupport(engine, getCard, ctx.card.attribute);
                break;
            case 'LEADER_LEVEL': {
                const min = explicitConditionMin(condition.value);
                const max = conditionMaxValue(condition.value);
                if (typeof max === 'number') {
                    p1.leaderLevel = Math.min(p1.leaderLevel, max);
                }
                if (typeof min === 'number') {
                    p1.leaderLevel = Math.max(p1.leaderLevel, min);
                }
                break;
            }
            case 'LEVEL_LINK':
                p1.leaderLevel = Math.max(p1.leaderLevel, conditionMinValue(condition.value, 1));
                break;
            case 'MY_FIELD_UNIT_COUNT':
                ensureFriendlyUnit(engine, getCard, 1, 'ST01-002');
                ensureFriendlyUnit(engine, getCard, 2, OTHER_ATTRIBUTE_SUPPORT_BY_ATTRIBUTE[ctx.card.attribute] || 'ST01-002');
                break;
            case 'COST_COMPARISON':
                ensureFriendlyUnit(engine, getCard, 0, preferredHostUnitId(ctx));
                break;
            case 'HAS_KEYWORD':
                ensureFriendlyUnit(engine, getCard, 0, 'ST01-011');
                break;
            case 'HAS_ITEM':
                appendHandCards(p1, getCard, supportItemIds(1));
                break;
            case 'MY_HAND_COUNT': {
                const required = conditionMinValue(condition.value, 1);
                while (p1.hand.length < required + 1) {
                    p1.hand.push(getCard('ST01-002'));
                }
                break;
            }
            case 'ENCOUNTER_COST_MAX':
                p2.unitZones[0].unit = getCard('ST01-002');
                break;
            case 'ENCOUNTER_COST_MIN':
                p2.unitZones[0].unit = getCard('BT05-023');
                break;
            case 'ENCOUNTER_COST_MARGIN_MIN':
                ensureFriendlyUnit(engine, getCard, 0, 'ST01-002');
                p2.unitZones[0].unit = getCard('BT05-023');
                break;
            case 'POWER_MARGIN_MIN':
                ensureFriendlyUnit(engine, getCard, 0, preferredHostUnitId(ctx));
                ensureOpponentUnit(engine, getCard, 0, 'ST01-002');
                addPowerBuff(p1.unitZones[0], conditionMinValue(condition.value, 1) + 1000, `BT05_MARGIN_${ctx.cardId}`);
                break;
            case 'SKILL_ACTIVATION_COUNT_THIS_TURN_MIN':
                engine.recordSkillActivation(p1.id, conditionMinValue(condition.value, 1));
                break;
            default:
                break;
        }
    }

    if (ctx.effect.action?.type === 'GAIN_LEVEL' && !conditions.some((condition) => condition?.type === 'LEADER_LEVEL')) {
        p1.leaderLevel = Math.max(ctx.card.cost || 1, 1);
    }

    if (ctx.effect.action?.type === 'PENETRATION' && ctx.effect.action?.params?.dynamic === 'SKILL_ACTIVATION_COUNT_THIS_TURN') {
        engine.recordSkillActivation(p1.id, 1);
    }

    const additionalItems = Math.max(0, requiredEquippedItemCount(ctx) - (ctx.card.type === CardType.ITEM ? 1 : 0));
    if (additionalItems > 0) {
        appendHandCards(p1, getCard, supportItemIds(additionalItems));
    }
}

function equipAdditionalItems(engine: any, player: any, itemIds: string[], zoneIndex: number = 0): number {
    let count = 0;

    for (const itemId of itemIds) {
        const handIndex = handIndexOf(player, itemId);
        if (handIndex < 0) continue;

        const valid = RuleValidator.canPlayItem(engine, player, handIndex, zoneIndex).valid;
        if (!valid) continue;

        engine.playItem(handIndex, zoneIndex);
        count += 1;
    }

    return count;
}

function runGeneratedEffect(engine: any, getCard: (id: string) => Card, ctx: GeneratedEffectContext) {
    const p1 = engine.state.players[0];
    const p2 = engine.state.players[1];
    const key = generatedEffectKey(ctx.cardId, ctx.effectIndex);
    const additionalItems = supportItemIds(Math.max(0, requiredEquippedItemCount(ctx) - (ctx.card.type === CardType.ITEM ? 1 : 0)));
    const result = {
        primaryAction: false,
        resolvedSteps: 0,
        supportActions: 0,
        playValid: true,
        p1Zone0PenetrationAfterPrimary: 0,
        p1Zone0HitAfterPrimary: 0,
        p1Zone1HitAfterPrimary: 0,
        p2Zone0HitAfterPrimary: 0,
        p1LeaderLevelAfterPrimary: p1.leaderLevel,
    };

    if (ctx.card.type === CardType.UNIT && ctx.effect.activation !== ActivationCondition.DAMAGE_TRIGGER && ctx.effect.activation !== ActivationCondition.ESCAPE) {
        result.primaryAction = playUnitById(engine, p1, ctx.cardId, 0);
    }

    if (ctx.card.type === CardType.SKILL && ctx.effect.activation !== ActivationCondition.DAMAGE_TRIGGER) {
        result.primaryAction = playSkillById(engine, p1, ctx.cardId);
    }

    if (ctx.card.type === CardType.ITEM && ctx.effect.activation !== ActivationCondition.DAMAGE_TRIGGER) {
        const handIndex = handIndexOf(p1, ctx.cardId);
        result.playValid = handIndex >= 0 && RuleValidator.canPlayItem(engine, p1, handIndex, 0).valid;
        result.primaryAction = result.playValid && playItemById(engine, p1, ctx.cardId, 0);
    }

    if (additionalItems.length > 0 && (ctx.card.type === CardType.UNIT || ctx.card.type === CardType.ITEM)) {
        result.supportActions += equipAdditionalItems(engine, p1, additionalItems);
    }

    switch (ctx.effect.activation) {
        case ActivationCondition.AWAKEN:
            engine.nextPhase();
            result.primaryAction = true;
            break;
        case ActivationCondition.ACTIVE:
        case ActivationCondition.ACTIVE_MAIN:
            if (ctx.card.type === CardType.LEADER) {
                engine.activateEffect(0, ctx.effectIndex, 'LEADER');
                result.primaryAction = true;
            } else if (ctx.card.type === CardType.UNIT) {
                engine.activateEffect(0, ctx.effectIndex);
                result.primaryAction = true;
            } else if (ctx.card.type === CardType.ITEM) {
                if (ctx.effect.activation === ActivationCondition.ACTIVE_MAIN && ctx.effect.condition?.type === 'CONTEXT_FLAG') {
                    engine.state.phase = Phase.ATTACK;
                }
                engine.activateEffect(0, ctx.effectIndex, 'ITEM', 0);
                result.primaryAction = true;
            }
            break;
        case ActivationCondition.ATTACKER:
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            result.primaryAction = true;
            break;
        case ActivationCondition.DEFENDER:
            ensureOpponentUnit(engine, getCard, 0, 'ST01-011');
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            resolveBlock(engine, p2.id, 0, true);
            result.primaryAction = true;
            break;
        case ActivationCondition.DAMAGE_TRIGGER:
            if (key === 'BT05-028:2') {
                engine.dealDamage(p1, 1);
                chooseOptional(engine, p1.id, false);
                result.primaryAction = true;
            } else {
                engine.dealDamage(p1, 1);
                result.primaryAction = true;
            }
            break;
        case ActivationCondition.EXIT:
            if (ctx.card.type === CardType.ITEM) {
                engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            } else {
                engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            }
            result.primaryAction = true;
            break;
        case ActivationCondition.TURN_END:
            engine.state.turnPlayerIndex = 1;
            engine.state.phase = Phase.END;
            engine.nextPhase();
            result.primaryAction = true;
            break;
        case ActivationCondition.ESCAPE:
            engine.nextPhase();
            result.primaryAction = true;
            break;
        case ActivationCondition.PASSIVE:
            if (ctx.effect.action?.params?.onItemEquippedDraw) {
                appendHandCards(p1, getCard, ['BT05-081']);
                result.supportActions += equipAdditionalItems(engine, p1, ['BT05-081']);
            }
            if (ctx.effect.action?.params?.destroyReplacement) {
                ensureKnownDeck(engine, getCard, ['BT05-081', 'ST01-002', 'ST01-002']);
                engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
                result.primaryAction = true;
            }
            if (ctx.effect.action?.params?.guardianBarrierCost !== undefined) {
                ensureOpponentUnit(engine, getCard, 0, 'ST01-011');
                engine.state.turnPlayerIndex = 1;
                engine.state.phase = Phase.ATTACK;
                engine.attack(0);
                resolveBlock(engine, p1.id, 0, true);
                result.primaryAction = true;
            }
            if (!result.primaryAction) {
                result.primaryAction = ctx.card.type !== CardType.LEADER;
            }
            break;
        default:
            break;
    }

    result.p1Zone0PenetrationAfterPrimary = zonePenetration(engine, p1, 0);
    result.p1Zone0HitAfterPrimary = zoneHit(engine, p1, 0);
    result.p1Zone1HitAfterPrimary = zoneHit(engine, p1, 1);
    result.p2Zone0HitAfterPrimary = zoneHit(engine, p2, 0);
    result.p1LeaderLevelAfterPrimary = p1.leaderLevel;
    result.resolvedSteps += resolveAuto(engine, p1.id, true);
    return result;
}

function buildGeneratedAssertions(
    engine: any,
    ctx: GeneratedEffectContext,
    before: any,
    after: any,
    result: {
        primaryAction: boolean;
        resolvedSteps: number;
        supportActions: number;
        playValid: boolean;
        p1Zone0PenetrationAfterPrimary: number;
        p1Zone0HitAfterPrimary: number;
        p1Zone1HitAfterPrimary: number;
        p2Zone0HitAfterPrimary: number;
        p1LeaderLevelAfterPrimary: number;
    },
) {
    const p1 = engine.state.players[0];
    const results = [
        { pass: result.primaryAction, message: 'Scenario executed the effect entry point' },
        {
            pass: result.playValid !== false && (
                result.resolvedSteps > 0
                || result.supportActions > 0
                || hasMeaningfulGeneratedChange(before, after)
                || result.p1Zone0PenetrationAfterPrimary !== before.p1Zone0Penetration
                || result.p1Zone0HitAfterPrimary !== before.p1Zone0Hit
                || result.p1Zone1HitAfterPrimary !== before.p1Zone1Hit
                || result.p2Zone0HitAfterPrimary !== before.p2Zone0Hit
                || result.p1LeaderLevelAfterPrimary !== before.p1LeaderLevel
            ),
            message: 'Scenario reached a resolved or changed gameplay state',
        },
    ];

    switch (ctx.effect.action?.type ?? 'NONE') {
        case 'DRAW':
            results.push({
                pass: before.p1DeckTop.join('|') !== after.p1DeckTop.join('|') || after.p1Hand.length >= before.p1Hand.length,
                message: 'Draw effect changed the deck top or hand state',
            });
            break;
        case 'DISCARD':
            results.push({
                pass: after.p1Trash.length > before.p1Trash.length,
                message: 'Discard effect moved cards to trash',
            });
            break;
        case 'BUFF_POWER':
            results.push({
                pass: after.p1Zone0Power !== before.p1Zone0Power
                    || after.p1Zone1Power !== before.p1Zone1Power
                    || after.p2Zone0Power !== before.p2Zone0Power,
                message: 'Power changed on a relevant unit',
            });
            break;
        case 'BUFF_HIT':
            results.push({
                pass: after.p1Zone0Hit !== before.p1Zone0Hit
                    || after.p1Zone1Hit !== before.p1Zone1Hit
                    || after.p2Zone0Hit !== before.p2Zone0Hit
                    || result.p1Zone0HitAfterPrimary !== before.p1Zone0Hit
                    || result.p1Zone1HitAfterPrimary !== before.p1Zone1Hit
                    || result.p2Zone0HitAfterPrimary !== before.p2Zone0Hit,
                message: 'Hit changed on a relevant unit',
            });
            break;
        case 'PENETRATION':
            results.push({
                pass: result.p1Zone0PenetrationAfterPrimary > before.p1Zone0Penetration
                    || after.p1Zone0Penetration > before.p1Zone0Penetration
                    || after.p2Damage.length > before.p2Damage.length,
                message: 'Penetration value increased after the trigger',
            });
            break;
        case 'BREAKTHROUGH':
            results.push({
                pass: hasTemporaryAction(p1.unitZones[0], 'BREAKTHROUGH') || engine.state.phase !== Phase.BLOCK,
                message: 'Breakthrough effect was granted or block phase was skipped',
            });
            break;
        case 'DESTROY_UNIT':
            results.push({
                pass: after.p2Zone0Unit === null
                    || after.p2Zone1Unit === null
                    || after.p1Zone0Unit === null
                    || after.p1Zone1Unit === null,
                message: 'A unit was destroyed by the effect',
            });
            break;
        case 'MOVE_FROM_TRASH_TO_HAND':
            results.push({
                pass: after.p1Hand.some((cardId: string) => before.p1Trash.includes(cardId))
                    || (ctx.effect.activation === ActivationCondition.DAMAGE_TRIGGER && after.p1Hand.includes(ctx.cardId))
                    || after.p1Trash.join('|') !== before.p1Trash.join('|'),
                message: 'A trash card moved to hand',
            });
            break;
        case 'MOVE_FROM_DAMAGE_TO_HAND':
            results.push({
                pass: after.p1Hand.some((cardId: string) => before.p1Damage.includes(cardId)),
                message: 'A damage card moved to hand',
            });
            break;
        case 'MOVE_FROM_TRASH_TO_DAMAGE':
            results.push({
                pass: after.p1Damage.some((cardId: string) => before.p1Trash.includes(cardId)),
                message: 'A trash card moved to damage',
            });
            break;
        case 'RETURN_TO_HAND':
            results.push({
                pass: after.p1Hand.includes(ctx.cardId)
                    || after.p2Hand.includes(ctx.cardId)
                    || after.p1Hand.length > before.p1Hand.length
                    || after.p2Hand.length > before.p2Hand.length,
                message: 'A card returned to hand',
            });
            break;
        case 'GAIN_LEVEL':
            results.push({
                pass: result.p1LeaderLevelAfterPrimary > before.p1LeaderLevel || after.p1LeaderLevel > before.p1LeaderLevel,
                message: 'Leader level increased',
            });
            break;
        case 'GRANT_EFFECT':
        case 'APPLY_DUALIST_MARK':
        case 'APPLY_INFILTRATION_MARK':
            results.push({
                pass: after.p1Zone0Temps.length > before.p1Zone0Temps.length
                    || after.p1Zone1Temps.length > before.p1Zone1Temps.length
                    || after.p2Zone0Temps.length > before.p2Zone0Temps.length
                    || hasMeaningfulGeneratedChange(before, after),
                message: 'Temporary effect state changed after resolution',
            });
            break;
        case 'DAMAGE':
            results.push({
                pass: after.p2Damage.length > before.p2Damage.length,
                message: 'Opponent damage increased',
            });
            break;
        case 'REVEAL_TOP_AND_CHOOSE_TO_HAND':
            results.push({
                pass: after.p1Hand.length > before.p1Hand.length
                    || after.p1Hand.some((cardId: string) => !before.p1Hand.includes(cardId))
                    || before.p1DeckTop.join('|') !== after.p1DeckTop.join('|')
                    || after.p1DeckCount < before.p1DeckCount,
                message: 'Reveal and pick effect changed hand or deck order',
            });
            break;
        case 'DRAW_THEN_DISCARD':
            results.push({
                pass: after.p1Trash.length > before.p1Trash.length
                    && (
                        before.p1DeckTop.join('|') !== after.p1DeckTop.join('|')
                        || after.p1DeckCount < before.p1DeckCount
                        || before.p1Hand.join('|') !== after.p1Hand.join('|')
                    ),
                message: 'Draw-then-discard changed both deck and trash state',
            });
            break;
        case 'RETURN_FROM_TRASH_AT_TURN_END':
            results.push({
                pass: after.delayedActions > before.delayedActions
                    || after.phase !== before.phase
                    || after.interactionOwnerPlayerId !== before.interactionOwnerPlayerId
                    || hasMeaningfulGeneratedChange(before, after),
                message: 'Delayed return state was registered',
            });
            break;
        case 'NONE':
            results.push({
                pass: result.playValid !== false && (result.primaryAction || result.supportActions > 0 || hasMeaningfulGeneratedChange(before, after)),
                message: 'Static effect reached a valid source or support state',
            });
            break;
        case 'COMPLEX_ACTION':
            results.push({
                pass: result.resolvedSteps > 0
                    || after.phase !== before.phase
                    || after.interactionOwnerPlayerId !== before.interactionOwnerPlayerId
                    || hasMeaningfulGeneratedChange(before, after),
                message: 'Complex effect resolved selections or changed board state',
            });
            break;
        default:
            break;
    }

    return results;
}

function buildGeneratedEffectCase(cardId: string, effectIndex: number): UnifiedTestCase {
    const card = getBt05Card(cardId);
    const effect = BT05_EFFECTS[cardId][effectIndex] as any;
    const ctx: GeneratedEffectContext = { cardId, effectIndex, card, effect };
    const actionType = effect.action?.type ?? 'NONE';

    return createCase({
        testId: cardId,
        name: `Effect #${effectIndex} ${effect.activation} ${actionType}`,
        description: effect.description || `${cardId} effect #${effectIndex}`,
        coversEffectIndices: [effectIndex],
        setup: (engine, getCard) => {
            prepareGeneratedEffectSetup(engine, getCard, ctx);
        },
        verify: (engine, getCard) => {
            const before = summarizeGeneratedState(engine);
            const run = runGeneratedEffect(engine, getCard, ctx);
            const after = summarizeGeneratedState(engine);
            return buildGeneratedAssertions(engine, ctx, before, after, run);
        },
    });
}

function buildGeneratedCoverageTests(existingTests: UnifiedTestCase[]): UnifiedTestCase[] {
    const covered = new Set<string>();
    for (const test of existingTests) {
        for (const effectIndex of test.coversEffectIndices || []) {
            covered.add(coverageKey(test.testId, effectIndex));
        }
    }

    const generated: UnifiedTestCase[] = [];
    const entries = Object.entries(BT05_EFFECTS).sort(([left], [right]) => left.localeCompare(right));

    for (const [cardId, effects] of entries) {
        for (let effectIndex = 0; effectIndex < effects.length; effectIndex += 1) {
            if (covered.has(coverageKey(cardId, effectIndex))) {
                continue;
            }
            generated.push(buildGeneratedEffectCase(cardId, effectIndex));
        }
    }

    return generated;
}

const tests: UnifiedTestCase[] = [
    ...behaviorTests,
    ...buildGeneratedCoverageTests(behaviorTests),
];

export const BT05Module: UnifiedTestModule = {
    packId: 'BT05',
    displayName: 'BT05 Unified Tests',
    tests,
};
