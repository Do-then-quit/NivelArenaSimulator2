import { ActivationCondition, Card, Phase } from '../../types';
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

function setHighSize(engine: any, level: number = 10): void {
    engine.state.players.forEach((player: any) => {
        player.leaderLevel = level;
    });
}

function addPowerBuff(zone: any, value: number, id: string = `BT04_POWER_${value}`): void {
    zone.buffs.push({
        id,
        type: 'POWER',
        value,
        duration: 'PERMANENT',
    } as any);
}

function repeatCard(getCard: (id: string) => Card, id: string, count: number): Card[] {
    return Array.from({ length: count }, () => getCard(id));
}

function handIndexOf(player: any, cardId: string): number {
    return player.hand.findIndex((card: Card) => card.id === cardId);
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

function chooseDamage(engine: any, actorPlayerId: string, predicate: (card: Card) => boolean) {
    const player = engine.getPlayerById(actorPlayerId);
    const action = findAction(
        engine,
        actorPlayerId,
        'SELECT_DAMAGE_TARGET',
        (entry: any) => predicate(player.damage[entry.damageIndex]),
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

function chooseCostHand(engine: any, actorPlayerId: string, predicate?: (card: Card) => boolean) {
    const player = engine.getPlayerById(actorPlayerId);
    const action = findAction(
        engine,
        actorPlayerId,
        'SELECT_COST_HAND',
        (entry: any) => !predicate || predicate(player.hand[entry.handIndex]),
    );
    if (action) engine.step(action);
    return action;
}

function confirmTargets(engine: any, actorPlayerId: string) {
    const action = findAction(engine, actorPlayerId, 'CONFIRM_TARGETS');
    if (action) engine.step(action);
    return action;
}

function chooseOption(engine: any, actorPlayerId: string, label: string) {
    return chooseRevealed(engine, actorPlayerId, (card: Card) => card?.name === label);
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

function hasTemporaryEffect(zone: any, text: string): boolean {
    return (zone?.temporaryEffects || []).some((effect: any) => String(effect?.description || '').includes(text));
}

function advanceUntil(engine: any, predicate: () => boolean, maxSteps: number = 24): boolean {
    let guard = 0;
    while (!predicate() && guard < maxSteps) {
        engine.nextPhase();
        guard += 1;
    }
    return predicate();
}

function makeAwakenTest(cardId: string, leaderLevel: number, cardName: string): UnifiedTestCase {
    return createCase({
        testId: cardId,
        name: `${cardName} 각성`,
        description: `${cardId} 리더가 요구 레벨에서 각성한다.`,
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.levelZone = getCard(cardId);
            p1.levelZone.isAwakened = false;
            p1.leaderLevel = leaderLevel - 1;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel >= leaderLevel, message: `리더 레벨 ${leaderLevel} 도달` },
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성 성공' },
            ];
        },
    });
}

function makeDamageReferenceBonusTest(
    cardId: string,
    cardName: string,
    coverageIndex: number,
    actualDamageCount: number,
    recoverCardId: string,
    blockedCardId: string,
    sourceType: 'LEADER' | 'UNIT',
): UnifiedTestCase {
    return createCase({
        testId: cardId,
        name: `${cardName} 대미지 참조 보정`,
        description: `${cardId}의 대미지 존 참조 보정이 다른 카드 효과에 반영된다.`,
        coversEffectIndices: [coverageIndex],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine, 20);
            if (sourceType === 'LEADER') {
                p1.levelZone = getCard(cardId);
                p1.levelZone.isAwakened = true;
            } else {
                p1.unitZones[1].unit = getCard(cardId);
            }
            p1.hand = [getCard('BT04-012')];
            p1.damage = repeatCard(getCard, 'ST01-002', actualDamageCount);
            p1.trash = [getCard(recoverCardId), getCard(blockedCardId)];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-012', 0);

            const legal = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_TRASH_TARGET') as Array<any>;
            const selectableIds = legal.map((action: any) => p1.trash[action.trashIndex]?.id);
            const pick = chooseTrash(engine, p1.id, (card: Card) => card?.id === recoverCardId);
            return [
                { pass: selectableIds.includes(recoverCardId), message: '보정 범위 카드 선택 가능' },
                { pass: !selectableIds.includes(blockedCardId), message: '보정 범위 초과 카드는 선택 불가' },
                { pass: !!pick, message: '회수 대상 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id === recoverCardId), message: '보정 결과 트래시 회수 성공' },
            ];
        },
    });
}

function makeFlatAttackerPowerTest(cardId: string, cardName: string, powerGain: number, coverageIndex: number): UnifiedTestCase {
    return createCase({
        testId: cardId,
        name: `${cardName} 어태커 파워 +${powerGain}`,
        description: `${cardId}의 어태커 파워 증가를 확인한다.`,
        coversEffectIndices: [coverageIndex],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard(cardId);
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p1, 0);
            engine.attack(0);
            const after = zonePower(engine, p1, 0);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK');
            return [
                { pass: !!block, message: '공격 중 블록 판단 단계 진입' },
                { pass: after === before + powerGain, message: `어태커 파워 +${powerGain} 반영 (${after})` },
            ];
        },
    });
}

function makeReturnSelfToHandTriggerTest(cardId: string, cardName: string, coverageIndex: number): UnifiedTestCase {
    return createCase({
        testId: cardId,
        name: `${cardName} 트리거 패 복귀`,
        description: `${cardId}가 대미지 트리거로 자신의 패로 돌아간다.`,
        coversEffectIndices: [coverageIndex],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard(cardId)];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some((card: Card) => card.id === cardId), message: '대미지 트리거로 패 복귀' },
            ];
        },
    });
}

function makeMoveSelfToDamageExitTest(cardId: string, cardName: string, coverageIndex: number): UnifiedTestCase {
    return createCase({
        testId: cardId,
        name: `${cardName} EXIT 자기 대미지 이동`,
        description: `${cardId}가 EXIT로 자신의 대미지 존에 놓인다.`,
        coversEffectIndices: [coverageIndex],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard(cardId);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            return [
                { pass: p1.damage.some((card: Card) => card.id === cardId), message: 'EXIT로 자기 자신이 대미지 존으로 이동' },
            ];
        },
    });
}

const tests: UnifiedTestCase[] = [
    makeAwakenTest('BT04-001', 5, '레테'),
    makeDamageReferenceBonusTest('BT04-001', '레테', 1, 1, 'BT04-023', 'BT04-028', 'LEADER'),
    makeAwakenTest('BT04-002', 5, '조장 아룬카'),
    createCase({
        testId: 'BT04-002',
        name: '조장 아룬카 각성면 다음 패 배치 버프',
        description: '각성 액티브가 다음에 패에서 배치한 유닛 1장에만 +3000을 부여한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine, 20);
            p1.levelZone = getCard('BT04-002');
            p1.levelZone.isAwakened = true;
            p1.hand = [getCard('BT04-007'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.activateEffect(0, 1, 'LEADER');
            const queuedBefore = (p1.pendingNextPlayUnitEffects || []).length;
            playUnitById(engine, p1, 'BT04-007', 0);
            playUnitById(engine, p1, 'ST01-002', 1);
            return [
                { pass: queuedBefore > 0, message: '다음 배치 버프 큐 적재' },
                { pass: zonePower(engine, p1, 0) === 4500, message: '첫 배치 유닛 +3000 적용' },
                { pass: zonePower(engine, p1, 1) === 3000, message: '두 번째 배치 유닛은 무버프' },
                { pass: (p1.pendingNextPlayUnitEffects || []).length === 0, message: '버프 큐 소모 완료' },
            ];
        },
    }),
    makeFlatAttackerPowerTest('BT04-003', '아이테르 : 이제라의 작은 별', 2000, 0),
    createCase({
        testId: 'BT04-004',
        name: '연구자 캐롯 엔트리 나탈론 학원 탐색',
        description: '덱 위 3장을 공개해 나탈론 학원 카드 1장을 패에 넣고 나머지를 트래시한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-004')];
            p1.deck = [getCard('ST01-002'), getCard('BT04-010'), getCard('BT04-013')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-004', 0);
            const pick = chooseRevealed(engine, p1.id, (card: Card) => card?.id === 'BT04-013');
            return [
                { pass: !!pick, message: '공개된 나탈론 학원 카드 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-013'), message: '선택한 나탈론 학원 카드 패 획득' },
                { pass: p1.trash.length >= 2, message: '비선택 카드 트래시' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-005',
        name: '프리다 엔트리 덱 맨 위 대미지 후 드로우',
        description: '옵션 수락 시 덱 맨 위 1장을 대미지 존에 놓고 1장 드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-005')];
            p1.deck = [getCard('ST01-011'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-005', 0);
            const confirm = chooseOptional(engine, p1.id, true);
            return [
                { pass: !!confirm, message: '대미지 이동 옵션 수락 가능' },
                { pass: p1.damage.some((card: Card) => card.id === 'ST01-002'), message: '덱 맨 위 카드 대미지 이동' },
                { pass: p1.hand.some((card: Card) => card.id === 'ST01-011'), message: '후속 1드로우 반영' },
            ];
        },
    }),
    makeDamageReferenceBonusTest('BT04-006', '한낮의 유영 플랑', 0, 2, 'BT04-015', 'BT04-023', 'UNIT'),
    makeFlatAttackerPowerTest('BT04-006', '한낮의 유영 플랑', 1000, 1),
    createCase({
        testId: 'BT04-007',
        name: '남국의 이세리아 대미지 수 비례 파워와 히트',
        description: '자신의 대미지 10장에서 어태커 파워와 히트가 함께 증가한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT04-007');
            p1.damage = repeatCard(getCard, 'ST01-002', 10);
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.attack(0);
            return [
                { pass: zonePower(engine, p1, 0) === 6500, message: '대미지 10장 x500 파워 증가' },
                { pass: zoneHit(engine, p1, 0) === 2, message: '대미지 10장 조건 히트+1' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-008',
        name: '수호천사 몽모랑시 엔트리 저대미지 분기',
        description: '상대 대미지 3장 이하일 때 덱 맨 위를 대미지에 놓고 상대에게 1대미지를 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-008')];
            p1.deck = [getCard('ST01-002')];
            p2.damage = repeatCard(getCard, 'ST01-002', 3);
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const beforeOppDamage = p2.damage.length;
            playUnitById(engine, p1, 'BT04-008', 0);
            return [
                { pass: p1.damage.some((card: Card) => card.id === 'ST01-002'), message: '덱 맨 위 카드 대미지 존 이동' },
                { pass: p2.damage.length === beforeOppDamage + 1, message: '상대에게 1대미지' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-008',
        name: '수호천사 몽모랑시 엔트리 고대미지 분기',
        description: '상대 대미지 4장 이상일 때 이 턴이 끝날 때까지 파워+3000을 얻는다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-008')];
            p2.damage = repeatCard(getCard, 'ST01-002', 4);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-008', 0);
            return [
                { pass: zonePower(engine, p1, 0) === 5000, message: '고대미지 분기로 자기 파워+3000' },
            ];
        },
    }),
    makeFlatAttackerPowerTest('BT04-009', '여일의 디에리아 : 홍련의 투희', 2000, 0),
    createCase({
        testId: 'BT04-010',
        name: '유진 엔트리로 다른 아군 +3000',
        description: '엔트리로 다른 자신 유닛 1장에 +3000을 부여한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-010')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 1);
            playUnitById(engine, p1, 'BT04-010', 0);
            const pick = chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: !!pick, message: '다른 아군 선택 가능' },
                { pass: zonePower(engine, p1, 1) === before + 3000, message: '다른 아군 파워+3000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-010',
        name: '유진 액티브로 조우 유닛 -3000',
        description: '자신의 파워가 5000 이상이면 조우 유닛 1장에 -3000을 적용한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT04-010');
            addPowerBuff(p1.unitZones[0], 3000);
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p2, 0);
            engine.activateEffect(0, 1);
            return [
                { pass: zonePower(engine, p2, 0) === before - 3000, message: '조우 유닛 파워-3000' },
            ];
        },
    }),
    makeFlatAttackerPowerTest('BT04-011', '폭격형 카논 : 특별한 선물', 3000, 0),
    createCase({
        testId: 'BT04-012',
        name: '폴리티스 : 여우 신사의 무녀 트래시 회수',
        description: '대미지 수 이하의 여름 스페셜 카드를 트래시에서 패로 회수한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-012')];
            p1.damage = repeatCard(getCard, 'ST01-002', 4);
            p1.trash = [getCard('BT04-023'), getCard('BT04-028')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-012', 0);
            const legalIds = engine
                .getLegalActions(p1.id)
                .filter((action: any) => action.type === 'SELECT_TRASH_TARGET')
                .map((action: any) => p1.trash[action.trashIndex]?.id);
            const pick = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-023');
            return [
                { pass: legalIds.includes('BT04-023'), message: '대미지 수 이하 여름 스페셜 선택 가능' },
                { pass: !legalIds.includes('BT04-028'), message: '대미지 수 초과 여름 스페셜 선택 불가' },
                { pass: !!pick, message: '회수 대상 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-023'), message: '트래시 카드 패 회수 성공' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-013',
        name: '방관자 화영 엔트리로 다른 아군 +3000',
        description: '엔트리로 다른 자신 유닛 1장에 +3000을 부여한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-013')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 1);
            playUnitById(engine, p1, 'BT04-013', 0);
            chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: zonePower(engine, p1, 1) === before + 3000, message: '다른 아군 파워+3000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-013',
        name: '방관자 화영 액티브 덱 맨 위 대미지 후 2드로우',
        description: '자신의 파워가 5000 이상이면 덱 맨 위 1장을 대미지 존에 놓고 2장 드로우한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-013');
            addPowerBuff(p1.unitZones[0], 3000);
            p1.deck = [getCard('ST01-011'), getCard('BT04-030'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            engine.activateEffect(0, 1);
            return [
                { pass: p1.damage.some((card: Card) => card.id === 'ST01-002'), message: '덱 맨 위 카드 대미지 이동' },
                { pass: p1.hand.length === handBefore + 2, message: '후속 2드로우 반영' },
            ];
        },
    }),
    makeDamageReferenceBonusTest('BT04-014', '랑디', 0, 2, 'BT04-023', 'BT04-028', 'UNIT'),
    makeFlatAttackerPowerTest('BT04-014', '랑디', 3500, 1),
    createCase({
        testId: 'BT04-015',
        name: '여름의 제자 알렉사 대미지 합계 드로우',
        description: '자신과 상대 대미지 합계가 15 이상이면 어태커로 총 2장을 드로우한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-015');
            p1.damage = repeatCard(getCard, 'ST01-002', 8);
            engine.opponentPlayer.damage = repeatCard(getCard, 'ST01-002', 7);
            p1.deck = [getCard('ST01-011'), getCard('BT04-030'), getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            engine.attack(0);
            return [
                { pass: p1.hand.length === before + 2, message: '대미지 합계 15 이상으로 2드로우' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-016',
        name: '후계자 태유 엔트리로 다른 아군 +3000',
        description: '엔트리로 다른 자신 유닛 1장에 +3000을 부여한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-016')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 1);
            playUnitById(engine, p1, 'BT04-016', 0);
            chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: zonePower(engine, p1, 1) === before + 3000, message: '엔트리로 다른 아군 파워+3000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-016',
        name: '후계자 태유 액티브 8000 이상 선택지',
        description: '자신의 파워가 8000 이상이면 조우 유닛의 파워를 1000으로 만든다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT04-016');
            addPowerBuff(p1.unitZones[0], 6000);
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.activateEffect(0, 1);
            const chooseHigh = chooseOption(engine, p1.id, '8000 이상');
            return [
                { pass: !!chooseHigh, message: '8000 이상 선택지 선택 가능' },
                { pass: zonePower(engine, p2, 0) === 1000, message: '조우 유닛 파워 1000 설정' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-017',
        name: '로빈 엔트리 손패 트래시 후 계승자 회수',
        description: '옵션 수락 시 손패 1장을 트래시하고 트래시의 계승자 유닛 1장을 회수한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-017'), getCard('ST01-002')];
            p1.trash = [getCard('ST06-006')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-017', 0);
            const confirm = chooseOptional(engine, p1.id, true);
            const pay = chooseCostHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            const pick = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'ST06-006');
            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!pay, message: '손패 1장 트래시 코스트 지불 가능' },
                { pass: !!pick, message: '계승자 유닛 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id === 'ST06-006'), message: '계승자 유닛 회수 성공' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-018',
        name: '전학생 아딘 엔트리로 다른 아군 +3000',
        description: '엔트리로 다른 자신 유닛 1장에 +3000을 부여한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-018')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 1);
            playUnitById(engine, p1, 'BT04-018', 0);
            chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: zonePower(engine, p1, 1) === before + 3000, message: '엔트리로 다른 아군 파워+3000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-018',
        name: '전학생 아딘 액티브 8000 이상 부여',
        description: '자신의 파워가 8000 이상이면 관통[1]과 침투[1]을 얻는다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-018');
            addPowerBuff(p1.unitZones[0], 6000);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.activateEffect(0, 1);
            const chooseHigh = chooseOption(engine, p1.id, '8000 이상');
            return [
                { pass: !!chooseHigh, message: '8000 이상 선택지 선택 가능' },
                { pass: hasTemporaryEffect(p1.unitZones[0], '관통[1]'), message: '관통[1] 부여' },
                { pass: hasTemporaryEffect(p1.unitZones[0], '침투[1]'), message: '침투[1] 부여' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-019',
        name: '축제의 에다 어태커 저상대대미지 분기',
        description: '상대 대미지 4장 이하에서 손패를 대미지 존에 놓고 상대에게 1대미지를 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT04-019');
            p1.hand = [getCard('ST01-002')];
            p2.damage = repeatCard(getCard, 'ST01-002', 4);
            p2.deck = [getCard('ST01-011'), getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const beforeOppDamage = p2.damage.length;
            engine.attack(0);
            const confirm = chooseOptional(engine, p1.id, true);
            const pick = chooseHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            return [
                { pass: !!confirm, message: '손패 대미지 이동 옵션 수락 가능' },
                { pass: !!pick, message: '대미지로 놓을 손패 선택 가능' },
                { pass: p1.damage.some((card: Card) => card.id === 'ST01-002'), message: '손패 카드 대미지 이동' },
                { pass: p2.damage.length === beforeOppDamage + 1, message: '후속 1대미지' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-019',
        name: '축제의 에다 어태커 고상대대미지 분기',
        description: '상대 대미지 5장 이상이면 이 공격 동안 파워+4000을 얻는다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT04-019');
            p2.unitZones[0].unit = getCard('ST10-008');
            p2.damage = repeatCard(getCard, 'ST01-002', 5);
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 0);
            engine.attack(0);
            return [
                { pass: zonePower(engine, p1, 0) === before + 4000, message: '상대 대미지 5장 이상 분기 파워+4000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-020',
        name: '빅토리카 패시브 다른 계승자/과거혹은미래 수 비례',
        description: '다른 계승자/과거 혹은 미래 유닛 수만큼 파워가 오른다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-020');
            p1.unitZones[1].unit = getCard('ST06-006');
            p1.unitZones[2].unit = getCard('ST06-007');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            return [
                { pass: zonePower(engine, p1, 0) === 5000, message: '다른 조건 유닛 2장 x1000 파워 증가' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-020',
        name: '빅토리카 엔트리 조건 유닛 수만큼 드로우',
        description: '다른 계승자/과거 혹은 미래 유닛 수만큼 카드를 드로우한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-020')];
            p1.unitZones[1].unit = getCard('ST06-006');
            p1.unitZones[2].unit = getCard('ST06-007');
            p1.deck = [getCard('ST01-002'), getCard('BT04-030'), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.hand.length;
            playUnitById(engine, p1, 'BT04-020', 0);
            return [
                { pass: p1.hand.length === before + 1, message: '다른 조건 유닛 2장만큼 2드로우' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-021',
        name: '아람 액티브:어택 추가 공격과 파워+3000',
        description: '대미지 합계 10 이상에서 패 1장 코스트 후 추가 공격을 얻고 어태커 파워+3000을 받는다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT04-021');
            p1.hand = [getCard('ST01-002')];
            p1.damage = repeatCard(getCard, 'ST01-002', 5);
            p2.damage = repeatCard(getCard, 'ST01-002', 5);
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.activateEffect(0, 0);
            const confirm = chooseOptional(engine, p1.id, true);
            const pay = chooseCostHand(engine, p1.id);
            const before = zonePower(engine, p1, 0);
            engine.attack(0);
            const buffed = zonePower(engine, p1, 0);
            resolveBlock(engine, engine.opponentPlayer.id, 0, true);
            const canAttackAgain = engine.getLegalActions(p1.id).some((action: any) => action.type === 'ATTACK' && action.attackerZoneIndex === 0);
            return [
                { pass: !!confirm, message: '추가 공격 옵션 수락 가능' },
                { pass: !!pay, message: '손패 1장 코스트 지불 가능' },
                { pass: buffed === before + 3000, message: '어태커 파워+3000 적용' },
                { pass: canAttackAgain, message: '이 턴에 한 번 더 공격 가능' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-021',
        name: '아람 대미지 트리거 자기 트래시와 1대미지',
        description: '자신 대미지 10장 이상, 상대 대미지 6장 이하에서 트리거로 자기 자신을 트래시하고 상대에게 1대미지를 준다.',
        coversEffectIndices: [2, 3],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.damage = repeatCard(getCard, 'ST01-002', 9);
            p1.deck = [getCard('BT04-021')];
            p2.deck = [getCard('ST01-011'), getCard('ST01-002')];
            p2.damage = repeatCard(getCard, 'ST01-002', 6);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const beforeOppDamage = p2.damage.length;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.trash.some((card: Card) => card.id === 'BT04-021'), message: '트리거로 자기 자신 트래시' },
                { pass: p2.damage.length === beforeOppDamage + 1, message: '트리거로 상대에게 1대미지' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-022',
        name: '풍기위원 아리아 엔트리로 다른 아군 +3000',
        description: '엔트리로 다른 자신 유닛 1장에 +3000을 부여한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-022')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 1);
            playUnitById(engine, p1, 'BT04-022', 0);
            chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: zonePower(engine, p1, 1) === before + 3000, message: '엔트리로 다른 아군 파워+3000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-022',
        name: '풍기위원 아리아 액티브 8000 이상 듀얼리스트',
        description: '자신의 파워가 8000 이상이면 듀얼리스트를 얻는다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-022');
            addPowerBuff(p1.unitZones[0], 6000);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.activateEffect(0, 1);
            const chooseHigh = chooseOption(engine, p1.id, '8000 이상');
            return [
                { pass: !!chooseHigh, message: '8000 이상 선택지 선택 가능' },
                { pass: hasTemporaryEffect(p1.unitZones[0], '듀얼리스트'), message: '듀얼리스트 부여' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-023',
        name: '세리스 : 푸른빛 진주 대미지 수 비례 파워',
        description: '대미지 4장에서 어태커 파워가 4000 증가한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT04-023');
            p1.damage = repeatCard(getCard, 'ST01-002', 4);
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 0);
            engine.attack(0);
            return [
                { pass: zonePower(engine, p1, 0) === before + 4000, message: '대미지 4장 x1000 파워 증가' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-024',
        name: '셀린 : 눈부신 여름 총대미지 20 조건 1대미지',
        description: '자신과 상대의 대미지 존 합계가 20 이상이면 어태커로 상대에게 1대미지를 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT04-024');
            p1.damage = repeatCard(getCard, 'ST01-002', 10);
            p2.damage = repeatCard(getCard, 'ST01-002', 10);
            p2.deck = [getCard('ST01-011'), getCard('ST01-002')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const before = p2.damage.length;
            engine.attack(0);
            return [
                { pass: p2.damage.length === before + 1, message: '총대미지 20 조건으로 1대미지' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-025',
        name: '고독한 늑대 페이라 엔트리로 다른 아군 +3000',
        description: '엔트리로 다른 자신 유닛 1장에 +3000을 부여한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-025')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 1);
            playUnitById(engine, p1, 'BT04-025', 0);
            chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: zonePower(engine, p1, 1) === before + 3000, message: '엔트리로 다른 아군 파워+3000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-025',
        name: '고독한 늑대 페이라 액티브 12000 이상 온킬 추가 공격',
        description: '자신의 파워가 12000 이상이면 온킬 추가 공격 효과를 얻는다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-025');
            addPowerBuff(p1.unitZones[0], 9000);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.activateEffect(0, 1);
            const chooseHigh = chooseOption(engine, p1.id, '12000 이상');
            return [
                { pass: !!chooseHigh, message: '12000 이상 선택지 선택 가능' },
                { pass: hasTemporaryEffect(p1.unitZones[0], '온킬'), message: '온킬 추가 공격 효과 부여' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-025',
        name: '고독한 늑대 페이라 트리거 자기 트래시와 유닛 -3000',
        description: '대미지 트리거로 자기 자신을 트래시하고 필드 유닛 1장을 -3000 할 수 있다.',
        coversEffectIndices: [2, 3],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT04-025')];
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.opponentPlayer.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 0);
            engine.dealDamage(p1, 1);
            const pick = chooseOptional(engine, p1.id, true);
            const target = chooseZone(engine, p1.id, p1.id, 0);
            return [
                { pass: p1.trash.some((card: Card) => card.id === 'BT04-025'), message: '트리거로 자기 자신 트래시' },
                { pass: !!pick, message: '파워 감소 옵션 수락 가능' },
                { pass: !!target, message: '필드 유닛 선택 가능' },
                { pass: zonePower(engine, p1, 0) === before - 3000, message: '선택한 유닛 파워-3000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-026',
        name: '바다 향기 루루카 대미지 수 비례 파워와 히트',
        description: '자신의 대미지 5장에서 어태커 파워와 히트가 함께 증가한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT04-026');
            p1.damage = repeatCard(getCard, 'ST01-002', 5);
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.attack(0);
            return [
                { pass: zonePower(engine, p1, 0) === 7500, message: '대미지 5장 x1000 파워 증가' },
                { pass: zoneHit(engine, p1, 0) === 3, message: '대미지 5장 조건 히트+1' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-027',
        name: '조장 아룬카 엔트리로 다른 아군 +3000',
        description: '엔트리로 다른 자신 유닛 1장에 +3000을 부여한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-027')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 1);
            playUnitById(engine, p1, 'BT04-027', 0);
            chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: zonePower(engine, p1, 1) === before + 3000, message: '엔트리로 다른 아군 파워+3000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-027',
        name: '조장 아룬카 액티브 9000 이상 관통[1]과 히트+1',
        description: '자신의 파워가 9000 이상이면 관통[1]과 히트+1을 얻는다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-027');
            addPowerBuff(p1.unitZones[0], 6000);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.activateEffect(0, 1);
            const chooseHigh = chooseOption(engine, p1.id, '9000 이상');
            return [
                { pass: !!chooseHigh, message: '9000 이상 선택지 선택 가능' },
                { pass: hasTemporaryEffect(p1.unitZones[0], '관통[1]'), message: '관통[1] 부여' },
                { pass: zoneHit(engine, p1, 0) === 3, message: '히트+1 부여' },
            ];
        },
    }),
    makeReturnSelfToHandTriggerTest('BT04-027', '조장 아룬카', 2),
    createCase({
        testId: 'BT04-028',
        name: '은빛 해일 화영 엔트리 EXIT 잠금과 EXIT 부여',
        description: '총대미지 20장에서 상대 EXIT를 잠그고 선택한 상대 유닛에 대미지 이동 EXIT를 부여한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-028')];
            p1.damage = repeatCard(getCard, 'ST01-002', 10);
            p2.damage = repeatCard(getCard, 'ST01-002', 10);
            p2.unitZones[0].unit = getCard('BT04-047');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            playUnitById(engine, p1, 'BT04-028', 0);
            const pick = chooseZone(engine, p1.id, p2.id, 0);
            return [
                { pass: !!pick, message: '대미지 이동 EXIT를 부여할 상대 유닛 선택 가능' },
                { pass: p2.lockedActivationsUntilTurnEnd?.[ActivationCondition.EXIT] === true, message: '상대 EXIT 잠금 적용' },
                { pass: hasTemporaryEffect(p2.unitZones[0], '엑시트 : 이 유닛을 자신의 대미지 존에 놓는다.'), message: '선택한 상대 유닛에 EXIT 부여' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-028',
        name: '은빛 해일 화영 대미지 트리거 자기 트래시와 1대미지',
        description: '자신의 대미지 10장 이상, 상대 대미지 6장 이하에서 트리거로 자기 자신을 트래시하고 상대에게 1대미지를 준다.',
        coversEffectIndices: [2, 3],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.damage = repeatCard(getCard, 'ST01-002', 9);
            p1.deck = [getCard('BT04-028')];
            p2.damage = repeatCard(getCard, 'ST01-002', 6);
            p2.deck = [getCard('ST01-011'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const beforeOppDamage = p2.damage.length;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.trash.some((card: Card) => card.id === 'BT04-028'), message: '트리거로 자기 자신 트래시' },
                { pass: p2.damage.length === beforeOppDamage + 1, message: '트리거로 상대에게 1대미지' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-029',
        name: '레테 엔트리 다른 아군 +6000과 조우 유닛 트래시',
        description: '총대미지 20장에서 다른 자신 유닛 모두 +6000, 추가로 조우 유닛을 트래시한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-029')];
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.damage = repeatCard(getCard, 'ST01-002', 10);
            p2.damage = repeatCard(getCard, 'ST01-002', 10);
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p1, 1);
            playUnitById(engine, p1, 'BT04-029', 0);
            return [
                { pass: zonePower(engine, p1, 1) === before + 6000, message: '다른 자신 유닛 전체 +6000 부여' },
                { pass: p2.unitZones[0].unit === null, message: '추가로 조우 유닛 트래시' },
            ];
        },
    }),
    makeReturnSelfToHandTriggerTest('BT04-029', '레테', 2),
    createCase({
        testId: 'BT04-030',
        name: '단 하나의 위로 자신 유닛 +3000',
        description: '필드의 자신 유닛 1장을 선택해 이 턴이 끝날 때까지 +3000을 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-030')];
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 0);
            playSkillById(engine, p1, 'BT04-030');
            const pick = chooseZone(engine, p1.id, p1.id, 0);
            return [
                { pass: !!pick, message: '아군 유닛 선택 가능' },
                { pass: zonePower(engine, p1, 0) === before + 3000, message: '선택한 유닛 파워+3000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-031',
        name: 'XII. The Hanged Man 드로우와 대미지 참조 보정',
        description: '자신의 대미지 5장 이상이면 1드로우하고 참조 보정을 얻는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('BT04-031'), getCard('BT04-012')];
            p1.damage = repeatCard(getCard, 'ST01-002', 5);
            p1.deck = [getCard('ST01-011')];
            p1.trash = [getCard('BT04-028'), getCard('BT04-029')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playSkillById(engine, p1, 'BT04-031');
            const drew = p1.hand.some((card: Card) => card.id === 'ST01-011');
            playUnitById(engine, p1, 'BT04-012', 0);
            const legalIds = engine
                .getLegalActions(p1.id)
                .filter((action: any) => action.type === 'SELECT_TRASH_TARGET')
                .map((action: any) => p1.trash[action.trashIndex]?.id);
            return [
                { pass: drew, message: '대미지 5장 이상에서 1드로우' },
                { pass: legalIds.includes('BT04-029'), message: '참조 보정으로 8코스트 여름 스페셜 선택 가능' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-032',
        name: '매직 버블 메이커 대미지 수 비례 상대 -500',
        description: '자신의 대미지 수만큼 상대 유닛의 파워를 감소시킨다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.hand = [getCard('BT04-032')];
            p1.damage = repeatCard(getCard, 'ST01-002', 6);
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p2, 0);
            playSkillById(engine, p1, 'BT04-032');
            const pick = chooseZone(engine, p1.id, p2.id, 0);
            return [
                { pass: !!pick, message: '상대 유닛 선택 가능' },
                { pass: zonePower(engine, p2, 0) === before - 3000, message: '대미지 6장 x500 파워 감소' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-033',
        name: '함께한 우리의 계절 다음 배치 파워와 약탈',
        description: '다음에 패에서 배치하는 유닛 1장이 +3000과 어태커 약탈[1]을 얻는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-033'), getCard('ST07-007'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playSkillById(engine, p1, 'BT04-033');
            playUnitById(engine, p1, 'ST07-007', 0);
            playUnitById(engine, p1, 'ST01-002', 1);
            return [
                { pass: zonePower(engine, p1, 0) === 5500, message: '다음 배치 유닛 파워+3000' },
                { pass: hasTemporaryEffect(p1.unitZones[0], '약탈[1]'), message: '다음 배치 유닛에 약탈[1] 부여' },
                { pass: !hasTemporaryEffect(p1.unitZones[1], '약탈[1]'), message: '다음 배치 1장에만 적용' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-034',
        name: '고독의 기도 전열 전체 +2000과 추가 드로우',
        description: '모든 자신 유닛 +2000, 총대미지 10 이상이면 추가 1드로우를 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-034')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[1].unit = getCard('BT04-003');
            p1.damage = repeatCard(getCard, 'ST01-002', 5);
            p2.damage = repeatCard(getCard, 'ST01-002', 5);
            p1.deck = [getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before0 = zonePower(engine, p1, 0);
            const before1 = zonePower(engine, p1, 1);
            const handBefore = p1.hand.length;
            playSkillById(engine, p1, 'BT04-034');
            return [
                { pass: zonePower(engine, p1, 0) === before0 + 2000, message: '필드의 자신 유닛 1 +2000' },
                { pass: zonePower(engine, p1, 1) === before1 + 2000, message: '필드의 자신 유닛 2 +2000' },
                { pass: p1.hand.length === handBefore, message: '총대미지 10 이상 추가 1드로우' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-035',
        name: '불타는 뒷골목 아군 파워만큼 상대 감소 후 자기 트래시',
        description: '선택한 아군 파워만큼 상대 유닛 파워를 감소시키고 선택한 아군을 트래시한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-035')];
            p1.unitZones[0].unit = getCard('ST01-011');
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const friendlyPower = zonePower(engine, p1, 0);
            const before = zonePower(engine, p2, 0);
            playSkillById(engine, p1, 'BT04-035');
            chooseZone(engine, p1.id, p1.id, 0);
            chooseZone(engine, p1.id, p2.id, 0);
            return [
                { pass: p1.unitZones[0].unit === null, message: '선택한 아군 유닛 트래시' },
                { pass: zonePower(engine, p2, 0) === before - friendlyPower, message: '선택한 아군 파워만큼 상대 파워 감소' },
            ];
        },
    }),
    makeReturnSelfToHandTriggerTest('BT04-035', '불타는 뒷골목', 1),
    createCase({
        testId: 'BT04-036',
        name: '적야의 선봉 필드 유닛 2장 조건 전원 +3000',
        description: '필드에 자신 유닛이 2장이면 전체 +3000을 부여한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-036')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[1].unit = getCard('BT04-003');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before0 = zonePower(engine, p1, 0);
            const before1 = zonePower(engine, p1, 1);
            playSkillById(engine, p1, 'BT04-036');
            return [
                { pass: zonePower(engine, p1, 0) === before0 + 3000, message: '첫 번째 유닛 +3000' },
                { pass: zonePower(engine, p1, 1) === before1 + 3000, message: '두 번째 유닛 +3000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-037',
        name: '약속된 영광 성약 잠금과 0코스트 부여',
        description: '트래시 회수, 패 1장 트래시, 계승자 0코스트 부여, 1드로우, 성약 잠금을 순서대로 처리한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-037'), getCard('ST06-015'), getCard('ST01-002')];
            p1.trash = [getCard('BT04-003')];
            p1.deck = [getCard('BT04-030')];
            p1.unitZones[0].unit = getCard('ST06-006');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playSkillById(engine, p1, 'BT04-037');
            const recover = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-003');
            const discard = chooseHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            const zeroCostTarget = chooseZone(engine, p1.id, p1.id, 0);
            const locked = engine
                .getLegalActions(p1.id)
                .some((action: any) => action.type === 'PLAY_SKILL' && p1.hand[action.handIndex]?.id === 'ST06-015');
            return [
                { pass: !!recover, message: '트래시 카드 선택 가능' },
                { pass: !!discard, message: '패 1장 트래시 선택 가능' },
                { pass: !!zeroCostTarget, message: '계승자 유닛 선택 가능' },
                { pass: p1.unitZones[0].unit?.turnCostOverride?.cost === 0, message: '계승자 유닛 0코스트 적용' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-003'), message: '트래시 카드 회수 성공' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-030'), message: '후속 1드로우 반영' },
                { pass: locked === false, message: '성약 스킬 잠금 적용' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-038',
        name: '지옥파멸 정수 로브 장착 조건과 자신의 턴 파워+3000',
        description: '나탈론 학원 유닛만 장착 가능하고 자신의 턴 동안 장착 유닛이 +3000을 얻는다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-038')];
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const invalid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            p1.unitZones[0].unit = getCard('BT04-010');
            const valid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            const before = zonePower(engine, p1, 0);
            if (valid) playItemById(engine, p1, 'BT04-038', 0);
            return [
                { pass: invalid === false, message: '비나탈론 학원 유닛 장착 불가' },
                { pass: valid === true, message: '나탈론 학원 유닛 장착 가능' },
                { pass: zonePower(engine, p1, 0) === before + 3000, message: '자신의 턴 장착 유닛 파워+3000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-039',
        name: '지옥파멸 정수 신발 장착 조건과 어태커 강화',
        description: '여름 스페셜 유닛만 장착 가능하고 어태커로 대미지 수 비례 파워와 듀얼리스트를 얻는다.',
        coversEffectIndices: [0, 1, 2],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-039')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.damage = repeatCard(getCard, 'ST01-002', 8);
            p2.damage = repeatCard(getCard, 'ST01-002', 7);
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[1].unit = getCard('ST04-003');
            p2.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const invalid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            p1.unitZones[0].unit = getCard('BT04-023');
            const valid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            if (valid) playItemById(engine, p1, 'BT04-039', 0);
            const before = zonePower(engine, p1, 0);
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            const legal = engine.getLegalActions(p2.id).filter((action: any) => action.type === 'RESOLVE_BLOCK');
            const canGuardianBlock = legal.some((action: any) => action.shouldBlock && action.blockerZoneIndex === 1);
            return [
                { pass: invalid === false, message: '비여름 스페셜 유닛 장착 불가' },
                { pass: valid === true, message: '여름 스페셜 유닛 장착 가능' },
                { pass: zonePower(engine, p1, 0) === before + 16000, message: '기존 어태커와 장착 어태커가 모두 반영된 파워 증가' },
                { pass: canGuardianBlock === false, message: '총대미지 15 이상에서 듀얼리스트 부여' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-040',
        name: '지옥파멸 정수 왕관 5장 이상 9장 이하 관통[1]',
        description: '대미지 7장에서 장착 유닛이 관통[1]을 얻는다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-040')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.damage = repeatCard(getCard, 'ST01-002', 7);
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const valid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            if (valid) playItemById(engine, p1, 'BT04-040', 0);
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            return [
                { pass: valid === true, message: '장착 조건 없음으로 임의 유닛 장착 가능' },
                { pass: zonePenetration(engine, p1, 0) === 1, message: '대미지 5~9장 구간 관통[1]' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-040',
        name: '지옥파멸 정수 왕관 10장 이상 관통[2]',
        description: '대미지 10장에서 장착 유닛이 관통[2]를 얻는다.',
        coversEffectIndices: [2],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-040')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.damage = repeatCard(getCard, 'ST01-002', 10);
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playItemById(engine, p1, 'BT04-040', 0);
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            return [
                { pass: zonePenetration(engine, p1, 0) === 2, message: '대미지 10장 이상 관통[2]' },
            ];
        },
    }),
    makeAwakenTest('BT04-041', 6, '신월의 루나'),
    createCase({
        testId: 'BT04-041',
        name: '신월의 루나 손패 대미지 후 코스트 이하 회수',
        description: '각성 액티브로 손패의 용의 계곡/혹한의 날들 카드를 대미지에 두고 같은 코스트 이하 카드를 회수한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.levelZone = getCard('BT04-041');
            p1.levelZone.isAwakened = true;
            p1.leaderLevel = 6;
            p1.hand = [getCard('BT04-076')];
            p1.trash = [getCard('ST01-002'), getCard('BT04-073')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.activateEffect(0, 1, 'LEADER');
            const chooseHandCard = chooseHand(engine, p1.id, (card: Card) => card?.id === 'BT04-076');
            const legalIds = engine
                .getLegalActions(p1.id)
                .filter((action: any) => action.type === 'SELECT_TRASH_TARGET')
                .map((action: any) => p1.trash[action.trashIndex]?.id);
            chooseTrash(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            return [
                { pass: !!chooseHandCard, message: '손패의 용의 계곡/혹한의 날들 카드 선택 가능' },
                { pass: legalIds.includes('ST01-002'), message: '코스트 이하 카드 선택 가능' },
                { pass: !legalIds.includes('BT04-073'), message: '코스트 초과 카드 선택 불가' },
                { pass: p1.damage.some((card: Card) => card.id === 'BT04-076'), message: '선택한 카드 대미지 이동' },
                { pass: p1.hand.some((card: Card) => card.id === 'ST01-002'), message: '트래시 카드 회수 성공' },
            ];
        },
    }),
    makeAwakenTest('BT04-042', 5, '용의 반려 셰나'),
    createCase({
        testId: 'BT04-042',
        name: '용의 반려 셰나 각성면 액티브 희생 후 +2000',
        description: '자신 유닛 1장을 희생하고 남은 자신 유닛 1장에 +2000을 준다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.levelZone = getCard('BT04-042');
            p1.levelZone.isAwakened = true;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[1].unit = getCard('BT04-003');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 1);
            engine.activateEffect(0, 1, 'LEADER');
            chooseZone(engine, p1.id, p1.id, 0);
            chooseZone(engine, p1.id, p1.id, 1);
            confirmTargets(engine, p1.id);
            return [
                { pass: p1.unitZones[0].unit === null, message: '첫 대상 유닛 희생' },
                { pass: zonePower(engine, p1, 1) === before + 2000, message: '남은 유닛 파워+2000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-043',
        name: '전투형 마야 디펜더 종결',
        description: '방어 선언 즉시 공격을 종료하고 스스로 트래시된다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].unit!.power = 10000;
            p2.unitZones[0].unit = getCard('BT04-043');
            p2.deck = [getCard('ST01-002'), getCard('ST01-011')];
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const beforeDamage = p2.damage.length;
            engine.attack(0);
            engine.resolveBlock(true, 0);
            return [
                { pass: p2.unitZones[0].unit === null, message: '종결 처리 후 디펜더 트래시' },
                { pass: engine.currentPlayer.unitZones[0].unit !== null, message: '공격 유닛 생존' },
                { pass: p2.damage.length === beforeDamage, message: '공격 종료로 플레이어 대미지 없음' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-044',
        name: '죄악의 안젤리카 EXIT 밀3 후 EXIT 유닛이 있으면 드로우',
        description: '덱 위 3장을 트래시하고 EXIT 유닛이 있으면 1장을 드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-044');
            p1.deck = [getCard('ST01-002'), getCard('BT04-047'), getCard('ST01-011'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const handBefore = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            return [
                { pass: p1.trash.filter((card: Card) => card.id !== 'BT04-044').length >= 3, message: '덱 위 3장 트래시' },
                { pass: p1.hand.length === handBefore + 1, message: '밀린 카드에 EXIT 유닛이 있어 1드로우' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-045',
        name: '벨리안 EXIT 효과 트래시 시 턴 종료 재배치',
        description: '효과로 트래시됐을 때 손패 1장 코스트 후 턴 종료에 비어 있는 유닛 존으로 재배치된다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-045');
            p1.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const nextPlayerId = engine.state.players.find((player: any) => player.id !== p1.id)?.id;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const confirm = chooseOptional(engine, p1.id, true);
            const pay = chooseCostHand(engine, p1.id);
            const advanced = advanceUntil(
                engine,
                () => engine.currentPlayer.id === nextPlayerId && engine.state.phase === Phase.LEVEL_UP,
                16,
            );
            return [
                { pass: !!confirm, message: '재배치 옵션 수락 가능' },
                { pass: !!pay, message: '재배치 코스트 손패 1장 지불 가능' },
                { pass: advanced, message: '턴 종료까지 진행 성공' },
                { pass: p1.unitZones.some((zone: any) => zone.unit?.id === 'BT04-045'), message: '턴 종료에 비어 있는 유닛 존으로 재배치' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-046',
        name: '엘비라 EXIT 상대 유닛 -3000',
        description: '자신의 턴 EXIT로 상대 유닛 1장에 총 -3000을 적용한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT04-046');
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p2, 0);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            chooseZone(engine, p1.id, p2.id, 0);
            chooseZone(engine, p1.id, p2.id, 0);
            return [
                { pass: zonePower(engine, p2, 0) === before - 3000, message: '기본 -2000과 자신의 턴 추가 -1000 적용' },
            ];
        },
    }),
    makeMoveSelfToDamageExitTest('BT04-047', '유피네', 0),
    createCase({
        testId: 'BT04-048',
        name: '달토끼 도미니엘 다른 아군 대미지 이동 후 자기 강화',
        description: '다른 아군 유닛 1장을 대미지 존에 두고 자기에게 +2000, 히트+1을 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-048');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforePower = zonePower(engine, p1, 0);
            const beforeHit = zoneHit(engine, p1, 0);
            engine.activateEffect(0, 0);
            const pick = chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: !!pick, message: '다른 자신 유닛 선택 가능' },
                { pass: p1.damage.some((card: Card) => card.id === 'ST01-002'), message: '선택한 유닛 대미지 존 이동' },
                { pass: zonePower(engine, p1, 0) === beforePower + 2000, message: '자기 파워+2000' },
                { pass: zoneHit(engine, p1, 0) === beforeHit + 1, message: '자기 히트+1' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-049',
        name: '라이아 엔트리 턴 종료 자폭 부여와 히트+1',
        description: '자신 유닛 1장에 턴 종료 자폭과 히트+1을 부여한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-049')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const beforeHit = zoneHit(engine, p1, 1);
            playUnitById(engine, p1, 'BT04-049', 0);
            const pick = chooseZone(engine, p1.id, p1.id, 1);
            const advanced = advanceUntil(
                engine,
                () => engine.currentPlayer.id === p2.id && engine.state.phase === Phase.LEVEL_UP,
                16,
            );
            return [
                { pass: !!pick, message: '대상 유닛 선택 가능' },
                { pass: beforeHit + 1 === 2, message: '기준 히트 계산 확인' },
                { pass: advanced, message: '턴 종료까지 진행 성공' },
                { pass: p1.unitZones[1].unit === null, message: '턴 종료 자폭 효과로 대상 유닛 트래시' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-049',
        name: '라이아 EXIT 아군 유닛 +2000',
        description: 'EXIT로 필드의 자신 유닛 1장에 상대 턴 종료까지 +2000을 준다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-049');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 1);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: !!pick, message: '아군 유닛 선택 가능' },
                { pass: zonePower(engine, p1, 1) === before + 2000, message: '상대 턴 종료까지 파워+2000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-050',
        name: '로앤나 필드 트래시 감지 패시브',
        description: '이번 턴 필드에서 트래시된 자신 유닛이 있으면 파워+3000을 얻는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-050');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 0);
            engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');
            return [
                { pass: zonePower(engine, p1, 0) === before + 3000, message: '필드 트래시 감지 후 파워+3000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-051',
        name: '로제 엔트리 손패 대미지 후 1드로우',
        description: '손패 1장을 대미지 존에 놓고 1장을 드로우한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-051'), getCard('ST01-002')];
            p1.deck = [getCard('ST01-011'), getCard('BT04-030')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-051', 0);
            const pick = chooseHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            return [
                { pass: !!pick, message: '대미지 존에 놓을 손패 선택 가능' },
                { pass: p1.damage.some((card: Card) => card.id === 'ST01-002'), message: '손패 카드 대미지 이동' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-030'), message: '후속 1드로우 반영' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-052',
        name: '메르세데스 : 복슬복슬 레이디 어태커 EXIT 회수 부여',
        description: '이 턴에 호문클루스 공격 수만큼 회수 가능한 EXIT 효과를 얻는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-052');
            p1.trash = [getCard('BT04-030')];
            p1.hand = [getCard('ST01-002')];
            engine.opponentPlayer.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.attack(0);
            const granted = hasTemporaryEffect(p1.unitZones[0], '자신의 패를 1장 골라 트래시할 수 있다');
            resolveBlock(engine, engine.opponentPlayer.id, 0, true);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const confirm = chooseOptional(engine, p1.id, true);
            const pay = chooseCostHand(engine, p1.id);
            const pick = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-030');
            return [
                { pass: granted, message: '어태커로 EXIT 회수 효과 부여' },
                { pass: !!confirm, message: '부여된 EXIT 옵션 수락 가능' },
                { pass: !!pay, message: '부여된 EXIT 손패 1장 트래시 가능' },
                { pass: !!pick, message: '공격 수 이하 코스트 카드 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-030'), message: '부여된 EXIT로 트래시 카드 회수 성공' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-053',
        name: '알렌시아 엔트리 2드로우 후 손패 대미지, 자신의 턴 용의 계곡 수 비례 파워',
        description: '옵션 수락 시 2드로우 후 손패 1장을 대미지 존에 놓고, 자신의 턴 용의 계곡 수만큼 파워가 오른다.',
        coversEffectIndices: [0, 1, 2],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-053'), getCard('ST01-002')];
            p1.deck = [getCard('BT04-076'), getCard('BT04-081'), getCard('ST01-011')];
            p1.damage = [getCard('BT04-076'), getCard('BT04-081')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-053', 0);
            const confirm = chooseOptional(engine, p1.id, true);
            const pick = chooseHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            return [
                { pass: !!confirm, message: '2드로우 옵션 수락 가능' },
                { pass: !!pick, message: '대미지 존에 놓을 손패 선택 가능' },
                { pass: p1.damage.some((card: Card) => card.id === 'ST01-002'), message: '선택한 손패 카드 대미지 이동' },
                { pass: zonePower(engine, p1, 0) === 3000, message: '자신의 턴 대미지의 용의 계곡 2장 x1000 파워 증가' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-054',
        name: '토라미 EXIT 런웨이 파이터 회수',
        description: 'EXIT로 트래시의 런웨이 파이터 카드 1장을 패로 회수한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-054');
            p1.trash = [getCard('BT04-062')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-062');
            return [
                { pass: !!pick, message: '런웨이 파이터 카드 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-062'), message: '트래시 카드 패 회수 성공' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-055',
        name: '화원의 리디카 효과 대미지 이동 감지 후 드로우',
        description: '이번 턴 효과로 자신의 대미지 존에 카드가 놓였으면 액티브로 1드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.unitZones[0].unit = getCard('BT04-055');
            p1.hand = [getCard('BT04-051'), getCard('ST01-002')];
            p1.deck = [getCard('BT04-030'), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-051', 1);
            const moveToDamage = chooseHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            const handBefore = p1.hand.length;
            engine.activateEffect(0, 0);
            return [
                { pass: !!moveToDamage, message: '효과로 손패 카드 대미지 존 이동' },
                { pass: p1.hand.length === handBefore + 1, message: '감지 후 액티브 1드로우' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-056',
        name: '라스트 피스 카린 엔트리 손패 트래시 후 3코 이하 조우 제거',
        description: '손패 1장 코스트를 지불하고 3코스트 이하 조우 유닛을 트래시한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-056'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            playUnitById(engine, p1, 'BT04-056', 0);
            const pay = chooseCostHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            return [
                { pass: !!pay, message: '손패 1장 코스트 지불 가능' },
                { pass: p2.unitZones[0].unit === null, message: '선택한 조우 유닛 트래시' },
            ];
        },
    }),
    makeMoveSelfToDamageExitTest('BT04-057', '모르트', 0),
    createCase({
        testId: 'BT04-058',
        name: '벨로나 엔트리 자신 유닛 트래시 후 히트+1',
        description: '자신 유닛 1장을 트래시하면 이 턴이 끝날 때까지 히트+1을 얻는다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-058')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-058', 0);
            const beforeHit = zoneHit(engine, p1, 0);
            const pick = chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: !!pick, message: '트래시할 자신 유닛 선택 가능' },
                { pass: p1.unitZones[1].unit === null, message: '선택한 자신 유닛 트래시' },
                { pass: zoneHit(engine, p1, 0) === beforeHit + 1, message: '자기 히트+1' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-059',
        name: '별의 신탁 엘레나 필드 트래시 감지 후 +5000',
        description: '이번 턴 필드에서 트래시된 자신 유닛이 있으면 자신 유닛 1장에 +5000을 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-059');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 0);
            engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');
            engine.activateEffect(0, 0);
            const pick = chooseZone(engine, p1.id, p1.id, 0);
            return [
                { pass: !!pick, message: '강화할 자신 유닛 선택 가능' },
                { pass: zonePower(engine, p1, 0) === before + 5000, message: '선택한 자신 유닛 파워+5000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-060',
        name: '설국의 솔리타리아 EXIT 상대 유닛 -5000',
        description: '자신의 턴 EXIT로 상대 유닛 1장에 총 -5000을 적용한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT04-060');
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p2, 0);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            chooseZone(engine, p1.id, p2.id, 0);
            chooseZone(engine, p1.id, p2.id, 0);
            return [
                { pass: zonePower(engine, p2, 0) === before - 5000, message: '기본 -4000과 자신의 턴 추가 -1000 적용' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-061',
        name: '페넬로페 손패 대미지 후 유닛 회수',
        description: '손패 1장을 대미지 존에 놓고 트래시의 유닛 카드 1장을 패에 넣는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-061');
            p1.hand = [getCard('ST01-002')];
            p1.trash = [getCard('BT04-054')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.activateEffect(0, 0);
            const chooseHandCard = chooseHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            const chooseTrashCard = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-054');
            return [
                { pass: !!chooseHandCard, message: '대미지로 놓을 손패 선택 가능' },
                { pass: !!chooseTrashCard, message: '회수할 유닛 카드 선택 가능' },
                { pass: p1.damage.some((card: Card) => card.id === 'ST01-002'), message: '손패 카드 대미지 이동' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-054'), message: '트래시 유닛 카드 패 회수' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-062',
        name: '일편고월 벨로나 EXIT 손패 트래시 후 카드 회수',
        description: '손패를 트래시하고 조건에 맞는 트래시 카드 1장을 패에 넣는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-062');
            p1.hand = [getCard('BT04-069')];
            p1.trash = [getCard('BT04-081')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const confirm = chooseOptional(engine, p1.id, true);
            const pay = chooseCostHand(engine, p1.id, (card: Card) => card?.id === 'BT04-069');
            const pick = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-081');
            return [
                { pass: !!confirm, message: '회수 옵션 수락 가능' },
                { pass: !!pay, message: '손패 1장 트래시 가능' },
                { pass: !!pick, message: '회수 대상 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-081'), message: '트래시 카드 회수 성공' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-063',
        name: '세실리아 : 검은 날개의 몽마 손패 대미지 이동 감지 후 드로우',
        description: '이번 턴 효과로 손패 카드가 자신의 대미지 존에 놓였다면 1드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.unitZones[0].unit = getCard('BT04-063');
            p1.hand = [getCard('BT04-051'), getCard('ST01-002')];
            p1.deck = [getCard('BT04-030'), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-051', 1);
            chooseHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            const handBefore = p1.hand.length;
            engine.activateEffect(0, 0);
            return [
                { pass: p1.hand.length === handBefore + 1, message: '손패 대미지 이동 감지 후 1드로우' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-064',
        name: '루나 엔트리 트래시 대미지 이동과 액티브 조우 제거',
        description: '트래시 카드를 대미지 존에 놓고, 대미지의 용의 계곡 수보다 낮은 코스트 조우 유닛을 제거한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-064'), getCard('ST01-002')];
            p1.trash = [getCard('BT04-076')];
            p1.damage = [getCard('BT04-081'), getCard('BT04-053')];
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            playUnitById(engine, p1, 'BT04-064', 0);
            chooseOptional(engine, p1.id, true);
            const moveTrash = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-076');
            engine.activateEffect(0, 1);
            const pay = chooseCostHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            return [
                { pass: !!moveTrash, message: '트래시 카드 대미지 이동 선택 가능' },
                { pass: p1.damage.some((card: Card) => card.id === 'BT04-076'), message: '트래시 카드 대미지 이동' },
                { pass: !!pay, message: '액티브 손패 1장 트래시 코스트 지불 가능' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 제거 성공' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-065',
        name: '밤의 연회 릴리아스 엔트리 자신 유닛 트래시',
        description: '엔트리로 필드의 자신 유닛 1장을 트래시한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-065')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-065', 0);
            const pick = chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: !!pick, message: '트래시할 자신 유닛 선택 가능' },
                { pass: p1.unitZones[1].unit === null, message: '선택한 자신 유닛 트래시' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-065',
        name: '밤의 연회 릴리아스 가디언 희생[1]',
        description: '인접 레인 방어 시 패 1장 코스트를 지불하는 가디언 희생[1]이 적용된다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
            p1.unitZones[1].unit = getCard('ST04-004');
            p2.unitZones[0].unit = getCard('BT04-065');
            p2.hand = [getCard('ST01-002')];
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.attack(1);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
            if (block) engine.step(block);
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCostForPlayerId(0, p2.id);
            }
            return [
                { pass: !!block, message: '인접 레인 가디언 방어 선언 가능' },
                { pass: p2.trash.some((card: Card) => card.id === 'ST01-002'), message: '가디언 희생[1] 코스트 지불' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-066',
        name: '바다의 유령 폴리티스 EXIT 공개 4장 분배',
        description: 'EXIT로 덱 위 4장을 공개해 1장은 대미지, 1장은 패, 나머지는 트래시한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-066');
            p1.deck = [getCard('ST01-002'), getCard('BT04-083'), getCard('ST01-011'), getCard('BT04-076')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const confirm = chooseOptional(engine, p1.id, true);
            const pickDamage = chooseRevealed(engine, p1.id, (card: Card) => card?.id === 'BT04-076');
            const pickHand = chooseRevealed(engine, p1.id, (card: Card) => card?.id === 'ST01-011');
            return [
                { pass: !!confirm, message: 'EXIT 옵션 수락 가능' },
                { pass: !!pickDamage, message: '대미지로 보낼 공개 카드 선택 가능' },
                { pass: !!pickHand, message: '패에 넣을 공개 카드 선택 가능' },
                { pass: p1.damage.some((card: Card) => card.id === 'BT04-076'), message: '공개 카드 1장 대미지 이동' },
                { pass: p1.hand.some((card: Card) => card.id === 'ST01-011'), message: '공개 카드 1장 패 획득' },
                { pass: p1.trash.some((card: Card) => card.id === 'BT04-083') && p1.trash.some((card: Card) => card.id === 'ST01-002'), message: '남은 공개 카드 모두 트래시' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-067',
        name: '라비 : 내달리는 무지개 어태커 EXIT 전개 부여',
        description: '이 턴의 호문클루스 공격 수 이하 코스트의 다른 호문클루스를 EXIT로 전개한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-067');
            p1.trash = [getCard('BT04-052')];
            engine.opponentPlayer.unitZones[0].unit = getCard('ST10-008');
            engine.state.turnStats!.traitAttackCountByPlayerId[p1.id] = { 호문클루스: 1 } as any;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.attack(0);
            const granted = hasTemporaryEffect(p1.unitZones[0], '배치한다');
            resolveBlock(engine, engine.opponentPlayer.id, 0, true);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-052');
            return [
                { pass: granted, message: '어태커로 EXIT 전개 효과 부여' },
                { pass: !!pick, message: '트래시의 다른 호문클루스 선택 가능' },
                { pass: p1.unitZones.some((zone: any) => zone.unit?.id === 'BT04-052'), message: '선택한 호문클루스 전개 성공' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-068',
        name: '심연의 유피네 엔트리 손패를 대미지 존에 놓기',
        description: '옵션 수락 시 손패 1장을 대미지 존에 놓는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-068'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-068', 0);
            const confirm = chooseOptional(engine, p1.id, true);
            const pick = chooseHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            return [
                { pass: !!confirm, message: '손패 대미지 이동 옵션 수락 가능' },
                { pass: !!pick, message: '대미지 존에 놓을 손패 선택 가능' },
                { pass: p1.damage.some((card: Card) => card.id === 'ST01-002'), message: '손패 카드 대미지 이동' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-068',
        name: '심연의 유피네 엔트리 미이동 시 자신 유닛 트래시',
        description: '손패를 대미지에 놓지 않았다면 필드의 자신 유닛 1장을 트래시한다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-068')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-068', 0);
            const skip = chooseOptional(engine, p1.id, false);
            const pick = chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: !!skip, message: '손패 대미지 이동 옵션 거절 가능' },
                { pass: !!pick, message: '트래시할 자신 유닛 선택 가능' },
                { pass: p1.unitZones[1].unit === null, message: '선택한 자신 유닛 트래시' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-068',
        name: '심연의 유피네 대미지의 용의 계곡 수 비례 파워와 히트',
        description: '대미지 존의 용의 계곡 카드 수만큼 파워가 오르고 5장 이상이면 히트+1을 얻는다.',
        coversEffectIndices: [2, 3],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-068');
            p1.damage = [getCard('BT04-076'), getCard('BT04-081'), getCard('BT04-053'), getCard('BT04-064'), getCard('BT04-057')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            return [
                { pass: zonePower(engine, p1, 0) === 8000, message: '용의 계곡 5장 x1000 파워 증가' },
                { pass: zoneHit(engine, p1, 0) === 3, message: '용의 계곡 5장 이상 히트+1' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-069',
        name: '진혼의 로앤나 EXIT 서로 다른 이름 6장 덱 바닥 후 재배치',
        description: '트리거가 없는 카드명이 다른 6장을 덱 맨 아래로 보내고 자신을 빈 유닛 존에 배치한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT04-069');
            p1.trash = [
                getCard('BT04-030'),
                getCard('BT04-031'),
                getCard('BT04-032'),
                getCard('BT04-033'),
                getCard('BT04-034'),
                getCard('BT04-036'),
                getCard('BT04-076'),
            ];
            p1.damage = repeatCard(getCard, 'ST01-002', 7);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const accept = chooseOptional(engine, p1.id, true);
            const legal = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_TRASH_TARGET') as Array<any>;
            const legalIds = legal.map((action: any) => p1.trash[action.trashIndex]?.id);
            ['BT04-030', 'BT04-031', 'BT04-032', 'BT04-033', 'BT04-034', 'BT04-036'].forEach((id) => {
                chooseTrash(engine, p1.id, (card: Card) => card?.id === id);
            });
            const confirm = confirmTargets(engine, p1.id);
            return [
                { pass: !!accept, message: '엑시트 옵션 수락 가능' },
                { pass: !legalIds.includes('BT04-076'), message: '트리거 카드 제외 필터 적용' },
                { pass: !!confirm, message: '서로 다른 이름 6장 선택 후 확정 가능' },
                { pass: p1.unitZones.some((zone: any) => zone.unit?.id === 'BT04-069'), message: '자신이 빈 유닛 존에 재배치' },
                { pass: p1.deck.slice(0, 6).every((card: Card) => ['BT04-030', 'BT04-031', 'BT04-032', 'BT04-033', 'BT04-034', 'BT04-036'].includes(card.id)), message: '선택한 6장이 덱 맨 아래로 이동' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-070',
        name: '용의 반려 셰나 엔트리 다른 아군 희생 시 드로우와 버프',
        description: '다른 자신 유닛을 트래시하면 1드로우하고 상대 턴 종료까지 파워+2000을 얻는다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine, 20);
            p1.hand = [getCard('BT04-070')];
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.deck = [getCard('BT04-030')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-070', 0);
            const pick = chooseZone(engine, p1.id, p1.id, 1);
            return [
                { pass: !!pick, message: '트래시할 자신 유닛 선택 가능' },
                { pass: p1.unitZones[1].unit === null, message: '다른 자신 유닛 트래시 성공' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-030'), message: '다른 자신 유닛을 트래시해 1드로우' },
                { pass: zonePower(engine, p1, 0) === 8000, message: '상대 턴 종료까지 파워+2000' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-070',
        name: '용의 반려 셰나 EXIT 선언형 활성화 잠금',
        description: '손패 1장 코스트 후 [어태커]를 선언하면 다음 턴 종료까지 상대는 어태커 효과를 발동할 수 없다.',
        coversEffectIndices: [1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT04-070');
            p1.hand = [getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('BT04-003');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const confirm = chooseOptional(engine, p1.id, true);
            const pay = chooseCostHand(engine, p1.id);
            const choose = chooseOption(engine, p1.id, '어태커');
            const untilTurn = p2.lockedActivationsUntilTurnCount?.[ActivationCondition.ATTACKER];
            return [
                { pass: !!confirm, message: '활성화 잠금 옵션 수락 가능' },
                { pass: !!pay, message: '손패 1장 코스트 지불 가능' },
                { pass: !!choose, message: '[어태커] 선언 가능' },
                { pass: typeof untilTurn === 'number' && untilTurn >= engine.state.turnCount + 1, message: '다음 턴 종료까지 어태커 잠금 적용' },
            ];
        },
    }),
    makeReturnSelfToHandTriggerTest('BT04-070', '용의 반려 셰나', 2),
    createCase({
        testId: 'BT04-071',
        name: '세릴라 EXIT 효과 트래시 시 손패 코스트 후 1대미지',
        description: '효과로 트래시됐을 때 손패 1장 코스트를 지불하면 상대에게 1대미지를 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT04-071');
            p1.hand = [getCard('ST01-002')];
            p2.deck = [getCard('ST01-011'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = p2.damage.length;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const confirm = chooseOptional(engine, p1.id, true);
            const pay = chooseCostHand(engine, p1.id);
            return [
                { pass: !!confirm, message: '1대미지 옵션 수락 가능' },
                { pass: !!pay, message: '손패 1장 코스트 지불 가능' },
                { pass: p2.damage.length === before + 1, message: '상대에게 1대미지' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-072',
        name: '신월의 루나 엔트리 드로우-손패 대미지-대미지 트래시 버프',
        description: '1드로우 후 손패를 대미지에 놓고, 대미지의 용의 계곡 5장 이상이면 대미지 카드 1장을 트래시해 그 코스트만큼 파워가 오른다.',
        coversEffectIndices: [0, 1, 2, 3],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine, 20);
            p1.hand = [getCard('BT04-072'), getCard('ST01-002')];
            p1.damage = [getCard('BT04-076'), getCard('BT04-081'), getCard('BT04-053'), getCard('BT04-064'), getCard('BT04-057')];
            p1.deck = [getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playUnitById(engine, p1, 'BT04-072', 0);
            const confirm = chooseOptional(engine, p1.id, true);
            const moveHand = chooseHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            const before = zonePower(engine, p1, 0);
            const trashDamage = chooseDamage(engine, p1.id, (card: Card) => card?.id === 'BT04-081');
            return [
                { pass: !!confirm, message: '1드로우 옵션 수락 가능' },
                { pass: p1.hand.some((card: Card) => card.id === 'ST01-011'), message: '1드로우 반영' },
                { pass: !!moveHand, message: '손패 대미지 이동 선택 가능' },
                { pass: !!trashDamage, message: '대미지 카드 트래시 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id === 'BT04-081'), message: '선택한 대미지 카드 트래시' },
                { pass: zonePower(engine, p1, 0) === before + 4000, message: '트래시한 코스트 4만큼 파워 증가' },
            ];
        },
    }),
    makeReturnSelfToHandTriggerTest('BT04-072', '신월의 루나', 4),
    createCase({
        testId: 'BT04-073',
        name: '창공의 일리나브 엔트리 총코스트 제한 다중 파괴와 공격 불가',
        description: '대미지의 용의 계곡 수 이하가 되도록 상대 유닛을 고르고 2장 이상 파괴했다면 공격할 수 없게 된다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-073')];
            p1.damage = [getCard('BT04-076'), getCard('BT04-081'), getCard('BT04-053'), getCard('BT04-075'), getCard('BT04-057')];
            p2.unitZones[0].unit = getCard('ST10-008');
            p2.unitZones[1].unit = getCard('BT04-003');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            playUnitById(engine, p1, 'BT04-073', 0);
            chooseZone(engine, p1.id, p2.id, 0);
            chooseZone(engine, p1.id, p2.id, 1);
            const confirm = confirmTargets(engine, p1.id);
            const canAttack = engine.getLegalActions(p1.id).some((action: any) => action.type === 'ATTACK' && action.attackerZoneIndex === 0);
            return [
                { pass: !!confirm, message: '총코스트 제한 내 다중 선택 후 확정 가능' },
                { pass: p2.unitZones[0].unit === null && p2.unitZones[1].unit === null, message: '선택한 상대 유닛 2장 파괴' },
                { pass: !canAttack, message: '2장 이상 파괴 시 공격 불가 부여' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-073',
        name: '창공의 일리나브 트리거 자기 트래시와 상대 유닛 파괴',
        description: '대미지 트리거로 자기 자신을 트래시하고 조건 이하 코스트의 상대 유닛 1장을 파괴한다.',
        coversEffectIndices: [1, 2],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.damage = [getCard('BT04-076'), getCard('BT04-081'), getCard('BT04-053'), getCard('BT04-075'), getCard('BT04-057')];
            p1.deck = [getCard('BT04-073')];
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.dealDamage(p1, 1);
            const pick = chooseZone(engine, p1.id, p2.id, 0);
            return [
                { pass: p1.trash.some((card: Card) => card.id === 'BT04-073'), message: '트리거로 자기 자신 트래시' },
                { pass: !!pick, message: '조건 이하 코스트 상대 유닛 선택 가능' },
                { pass: p2.unitZones[0].unit === null, message: '선택한 상대 유닛 파괴' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-074',
        name: '숲의 현자 비비안 엔트리 다른 아군 희생 후 비용 이하 상대 파괴',
        description: '다른 자신 유닛을 희생하면 그 코스트 이하의 상대 유닛 1장을 파괴한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine, 20);
            p1.hand = [getCard('BT04-074')];
            p1.unitZones[1].unit = getCard('BT04-065');
            p2.unitZones[0].unit = getCard('BT04-063');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            playUnitById(engine, p1, 'BT04-074', 0);
            chooseOptional(engine, p1.id, true);
            const pay = chooseZone(engine, p1.id, p1.id, 1);
            const destroy = chooseZone(engine, p1.id, p2.id, 0);
            return [
                { pass: !!pay, message: '희생할 다른 자신 유닛 선택 가능' },
                { pass: !!destroy, message: '희생한 유닛 코스트 이하 상대 유닛 선택 가능' },
                { pass: p1.unitZones[1].unit === null, message: '다른 자신 유닛 희생 성공' },
                { pass: p2.unitZones[0].unit === null, message: '조건 이하 상대 유닛 파괴 성공' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-074',
        name: '숲의 현자 비비안 트리거 자기 트래시와 EXIT 유닛 회수',
        description: '대미지 트리거로 자기 자신을 트래시하고 트래시의 EXIT 유닛 1장을 회수한다.',
        coversEffectIndices: [2, 3],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT04-074')];
            p1.trash = [getCard('BT04-054')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            const pick = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-054');
            return [
                { pass: p1.trash.some((card: Card) => card.id === 'BT04-074'), message: '트리거로 자기 자신 트래시' },
                { pass: !!pick, message: '트래시의 EXIT 유닛 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-054'), message: 'EXIT 유닛 패 회수 성공' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-075',
        name: '호반의 마녀 테네브리아 엔트리 드로우-손패 대미지-조우를 상대 대미지로 이동',
        description: '1드로우 후 손패를 대미지에 놓고, 용의 계곡 8장 이상이면 조우 유닛을 상대의 대미지 존으로 보낸다.',
        coversEffectIndices: [0, 1, 2],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-075'), getCard('ST01-002')];
            p1.damage = [
                getCard('BT04-076'),
                getCard('BT04-081'),
                getCard('BT04-053'),
                getCard('BT04-064'),
                getCard('BT04-057'),
                getCard('BT04-076'),
                getCard('BT04-081'),
                getCard('BT04-053'),
            ];
            p1.deck = [getCard('ST01-011')];
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const beforeOppDamage = p2.damage.length;
            playUnitById(engine, p1, 'BT04-075', 0);
            chooseOptional(engine, p1.id, true);
            const moveHand = chooseHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            return [
                { pass: p1.hand.some((card: Card) => card.id === 'ST01-011'), message: '1드로우 반영' },
                { pass: !!moveHand, message: '손패 대미지 이동 선택 가능' },
                { pass: p2.damage.length === beforeOppDamage + 1, message: '조우 유닛이 상대 대미지 존으로 이동' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 필드 이탈' },
            ];
        },
    }),
    makeReturnSelfToHandTriggerTest('BT04-075', '호반의 마녀 테네브리아', 3),
    createCase({
        testId: 'BT04-076',
        name: '내면의 존재 대미지-트래시 교환 후 조건부 드로우',
        description: '대미지 카드 2장을 트래시하고 같은 수만큼 트래시에서 대미지로 옮기며 용의 계곡 5장 이상이면 1드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-076')];
            p1.damage = [getCard('BT04-076'), getCard('BT04-081'), getCard('BT04-053'), getCard('BT04-064'), getCard('BT04-057')];
            p1.trash = [getCard('BT04-081'), getCard('BT04-053')];
            p1.deck = [getCard('BT04-030')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playSkillById(engine, p1, 'BT04-076');
            chooseDamage(engine, p1.id, (card: Card) => card?.id === 'BT04-081');
            chooseDamage(engine, p1.id, (card: Card) => card?.id === 'BT04-053');
            confirmTargets(engine, p1.id);
            chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-081');
            chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-053');
            confirmTargets(engine, p1.id);
            return [
                { pass: p1.trash.some((card: Card) => card.id === 'BT04-081') && p1.trash.some((card: Card) => card.id === 'BT04-053'), message: '선택한 대미지 카드 2장 트래시 이동' },
                { pass: p1.damage.filter((card: Card) => card.id === 'BT04-081').length >= 1 && p1.damage.filter((card: Card) => card.id === 'BT04-053').length >= 1, message: '트래시 카드 2장 대미지 존 이동' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-030'), message: '용의 계곡 5장 이상 조건부 1드로우' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-076',
        name: '내면의 존재 트리거 자기 트래시와 상대 유닛 파괴',
        description: '대미지 트리거로 자기 자신을 트래시하고 조건 이하 코스트 상대 유닛 1장을 파괴한다.',
        coversEffectIndices: [1, 2],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.damage = [getCard('BT04-076'), getCard('BT04-081'), getCard('BT04-053'), getCard('BT04-075')];
            p1.deck = [getCard('BT04-076')];
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.dealDamage(p1, 1);
            const pick = chooseZone(engine, p1.id, p2.id, 0);
            return [
                { pass: p1.trash.some((card: Card) => card.id === 'BT04-076'), message: '트리거로 자기 자신 트래시' },
                { pass: !!pick, message: '조건 이하 코스트 상대 유닛 선택 가능' },
                { pass: p2.unitZones[0].unit === null, message: '상대 유닛 파괴 성공' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-077',
        name: '현혹의 날개 손패 대미지 후 2드로우',
        description: '손패 1장을 대미지 존에 놓고 2장을 드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-077'), getCard('ST01-002')];
            p1.deck = [getCard('BT04-031'), getCard('ST01-011'), getCard('BT04-030')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playSkillById(engine, p1, 'BT04-077');
            const move = chooseHand(engine, p1.id, (card: Card) => card?.id === 'ST01-002');
            return [
                { pass: !!move, message: '대미지 존에 놓을 손패 선택 가능' },
                { pass: p1.damage.some((card: Card) => card.id === 'ST01-002'), message: '손패 카드 대미지 이동' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-030') && p1.hand.some((card: Card) => card.id === 'ST01-011'), message: '후속 2드로우 반영' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-078',
        name: '유혹하는 꽃 자신 유닛 트래시 후 2드로우',
        description: '필드의 자신 유닛 1장을 트래시하고 2장을 드로우한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-078')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.deck = [getCard('BT04-031'), getCard('ST01-011'), getCard('BT04-030')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            playSkillById(engine, p1, 'BT04-078');
            const pick = chooseZone(engine, p1.id, p1.id, 0);
            return [
                { pass: !!pick, message: '트래시할 자신 유닛 선택 가능' },
                { pass: p1.unitZones[0].unit === null, message: '선택한 자신 유닛 트래시' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-030') && p1.hand.some((card: Card) => card.id === 'ST01-011'), message: '후속 2드로우 반영' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-079',
        name: '친구를 위한 마법 자기 잠금과 조건부 1대미지',
        description: '이번 턴 자신을 잠그고 트래시의 호문클루스가 5장 이상이면 상대에게 1대미지를 준다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-079'), getCard('BT04-079')];
            p1.trash = [getCard('BT04-052'), getCard('BT04-067'), getCard('ST07-007'), getCard('ST07-007'), getCard('BT04-052')];
            p2.deck = [getCard('ST01-011'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = p2.damage.length;
            playSkillById(engine, p1, 'BT04-079');
            const locked = engine.getLegalActions(p1.id).some((action: any) => action.type === 'PLAY_SKILL' && p1.hand[action.handIndex]?.id === 'BT04-079');
            return [
                { pass: p2.damage.length === before + 1, message: '트래시의 호문클루스 5장 이상으로 1대미지' },
                { pass: locked === false, message: '같은 이름 스킬 자기 잠금 적용' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-080',
        name: '신부의 결의 대미지 8장 이상에서 1장 트래시',
        description: '자신의 대미지 8장 이상이면 그중 1장을 트래시한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('BT04-080')];
            p1.damage = repeatCard(getCard, 'ST01-002', 8);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = p1.damage.length;
            playSkillById(engine, p1, 'BT04-080');
            const pick = chooseDamage(engine, p1.id, () => true);
            return [
                { pass: !!pick, message: '트래시할 대미지 카드 선택 가능' },
                { pass: p1.damage.length === before - 1, message: '대미지 카드 1장 트래시' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-081',
        name: '유베리우스의 어금니 용의 계곡 5장 이상 상대 5코 이하 제거',
        description: '대미지의 용의 계곡이 5장 이상이면 5코스트 이하 상대 유닛 1장을 트래시한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-081')];
            p1.damage = [getCard('BT04-076'), getCard('BT04-081'), getCard('BT04-053'), getCard('BT04-064'), getCard('BT04-057')];
            p2.unitZones[0].unit = getCard('BT04-063');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            playSkillById(engine, p1, 'BT04-081');
            const pick = chooseZone(engine, p1.id, p2.id, 0);
            return [
                { pass: !!pick, message: '5코스트 이하 상대 유닛 선택 가능' },
                { pass: p2.unitZones[0].unit === null, message: '선택한 상대 유닛 트래시' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-082',
        name: '데빌 드라이브 3장 동시 전개와 턴 종료 트래시',
        description: '빈 필드에서 카드명이 다른 호문클루스 3장을 트래시에서 전개하고, 턴 종료에 모두 트래시한다.',
        coversEffectIndices: [0],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.leaderLevel = 20;
            p2.leaderLevel = 20;
            p1.hand = [getCard('BT04-082')];
            p1.trash = [getCard('BT04-052'), getCard('BT04-067'), getCard('ST07-007')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            playSkillById(engine, p1, 'BT04-082');
            const pick052 = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-052');
            const pick067 = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-067');
            const pickSt07 = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'ST07-007');
            const confirm = confirmTargets(engine, p1.id);
            const deployedIds = p1.unitZones.map((zone: any) => zone.unit?.id).filter(Boolean);
            const advanced = advanceUntil(
                engine,
                () => engine.currentPlayer.id === p2.id && engine.state.phase === Phase.LEVEL_UP,
                16,
            );
            return [
                { pass: !!pick052 && !!pick067 && !!pickSt07 && !!confirm, message: '서로 다른 호문클루스 3장 선택 후 확정 가능' },
                { pass: deployedIds.includes('BT04-052') && deployedIds.includes('BT04-067') && deployedIds.includes('ST07-007'), message: '호문클루스 3장 동시 전개 성공' },
                { pass: advanced, message: '턴 종료까지 진행 성공' },
                { pass: p1.unitZones.every((zone: any) => zone.unit === null), message: '턴 종료 시 전개한 유닛 모두 트래시' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-082',
        name: '데빌 드라이브 트리거 자기 트래시와 호문클루스 회수',
        description: '대미지 트리거로 자기 자신을 트래시하고 트래시의 호문클루스 유닛 1장을 회수한다.',
        coversEffectIndices: [1, 2],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT04-082')];
            p1.trash = [getCard('BT04-052')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            const pick = chooseTrash(engine, p1.id, (card: Card) => card?.id === 'BT04-052');
            return [
                { pass: p1.trash.some((card: Card) => card.id === 'BT04-082'), message: '트리거로 자기 자신 트래시' },
                { pass: !!pick, message: '트래시의 호문클루스 유닛 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id === 'BT04-052'), message: '호문클루스 유닛 패 회수 성공' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-083',
        name: '심연의 칼날 목걸이 장착 조건과 액티브:어택 히트 증가',
        description: '5코스트 이상 유닛만 장착 가능하고, 이번 턴 필드에서 트래시된 자신 유닛 수에 따라 히트가 증가한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine, 20);
            p1.hand = [getCard('BT04-083')];
            p1.unitZones[0].unit = getCard('BT04-023');
            p1.unitZones[1].unit = getCard('BT04-068');
            p1.unitZones[2].unit = getCard('BT04-064');
            p2.unitZones[0].unit = getCard('ST10-008');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const invalid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            p1.unitZones[0].unit = getCard('BT04-068');
            const valid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            if (valid) playItemById(engine, p1, 'BT04-083', 0);
            engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');
            engine.destroyUnit(p1, p1.unitZones[2], undefined, 'EFFECT');
            p1.unitZones[2].unit = getCard('BT04-063');
            engine.destroyUnit(p1, p1.unitZones[2], undefined, 'EFFECT');
            engine.state.phase = Phase.ATTACK;
            const beforeHit = zoneHit(engine, p1, 0);
            engine.activateEffect(0, 1, 'ITEM', 0);
            return [
                { pass: invalid === false, message: '4코스트 이하 유닛 장착 불가' },
                { pass: valid === true, message: '5코스트 이상 유닛 장착 가능' },
                { pass: zoneHit(engine, p1, 0) === beforeHit + 2, message: '필드 트래시 3장 이상으로 히트+2' },
            ];
        },
    }),
    createCase({
        testId: 'BT04-084',
        name: '자각룡의 홍옥 장착 조건과 EXIT 장착 유닛 재배치',
        description: '4코스트 이하 유닛만 장착 가능하고 장착 유닛이 트래시되면 빈 유닛 존으로 재배치한다.',
        coversEffectIndices: [0, 1],
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT04-084')];
            p1.unitZones[0].unit = getCard('BT04-068');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const invalid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            p1.unitZones[0].unit = getCard('BT04-005');
            const valid = RuleValidator.canPlayItem(engine, p1, 0, 0).valid;
            if (valid) playItemById(engine, p1, 'BT04-084', 0);
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = chooseZone(engine, p1.id, p1.id, 2);
            return [
                { pass: invalid === false, message: '5코스트 이상 유닛 장착 불가' },
                { pass: valid === true, message: '4코스트 이하 유닛 장착 가능' },
                { pass: !!pick, message: '재배치할 빈 유닛 존 선택 가능' },
                { pass: p1.unitZones[2].unit?.id === 'BT04-005', message: '장착 유닛 재배치 성공' },
            ];
        },
    }),
];

export const BT04Module: UnifiedTestModule = {
    packId: 'BT04',
    displayName: 'BT04 Unified Tests',
    tests,
};
