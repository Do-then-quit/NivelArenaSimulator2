import { ActivationCondition, Card } from '../../types';
import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

function findAction(
    engine: any,
    actorPlayerId: string,
    type: string,
    predicate?: (action: any) => boolean
) {
    return engine
        .getLegalActions(actorPlayerId)
        .find((action: any) => action.type === type && (!predicate || predicate(action)));
}

function getZonePower(engine: any, player: any, zoneIndex: number): number {
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return 0;
    return engine.getUnitPower(zone, player);
}

const tests: UnifiedTestCase[] = [
    {
        testId: 'BT06-001',
        name: '루벤시아 리더 각성',
        description: '리더 레벨 6 이상에서 각성한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('BT06-001');
            p1.levelZone.isAwakened = false;
            p1.leaderLevel = 5;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel >= 6, message: `리더 레벨 증가 (${p1.leaderLevel})` },
                { pass: p1.levelZone?.isAwakened === true, message: 'BT06-001 각성 성공' },
            ];
        },
    },
    {
        testId: 'BT06-001-Active',
        name: '루벤시아 리더 액티브:어택 선택 발동',
        description: '자신 유닛의 액티브:어택 효과를 선택해 발동한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.levelZone = getCard('BT06-001');
            p1.levelZone.isAwakened = true;
            p1.leaderLevel = 6;
            p1.unitZones[0].unit = getCard('BT06-004');
            p1.skillZone = [getCard('ST10-015')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);

            engine.activateEffect(0, 1, 'LEADER');
            const selectUnit = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id && action.zoneIndex === 0
            );
            if (selectUnit) engine.step(selectUnit);

            const selectRevealed = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (selectRevealed) engine.step(selectRevealed);

            const selectOpp = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p2.id && action.zoneIndex === 0
            );
            if (selectOpp) engine.step(selectOpp);

            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            return [
                { pass: !!selectUnit, message: '대상 유닛 선택 진입' },
                { pass: !!selectRevealed, message: '액티브:어택 효과 선택 진입' },
                { pass: !!selectOpp, message: '선택된 효과의 대상 선택 진입' },
                { pass: p2.unitZones[0].unit === null || after === before - 1500, message: '선택 효과 정상 발동 (-1500)' },
            ];
        },
    },
    {
        testId: 'BT06-002',
        name: '하얀 고양이 루 조우 -1500',
        description: '어태커 시 조우 유닛 파워가 전투 종료까지 감소한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-002');
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);
            engine.attack(0);
            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            return [
                { pass: p2.unitZones[0].unit === null || after === before - 1500, message: '조우 유닛 파워 -1500 적용' },
            ];
        },
    },
    {
        testId: 'BT06-003',
        name: '백뢰 유리 엔트리 스킬 탐색',
        description: '덱 상단 3장 공개 후 스킬 1장을 패로 가져오고 나머지를 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-003')];
            p1.deck = [getCard('ST01-002'), getCard('ST10-015'), getCard('ST10-016')];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);

            const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) =>
                (engine.state.revealedCards[action.revealedIndex]?.id || '').startsWith('ST10-015')
            );
            if (pick) engine.step(pick);

            return [
                { pass: !!pick, message: '스킬 카드 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST10-015')), message: '스킬 카드 패 획득' },
                { pass: p1.trash.length >= 2, message: '비선택 카드 트래시' },
            ];
        },
    },
    {
        testId: 'BT06-004',
        name: '그란힐트 액티브:어택 조건부 -1500',
        description: '공격 페이즈 + 스킬존 조건에서 상대 유닛 1장 파워를 감소시킨다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-004');
            p1.skillZone = [getCard('ST10-015')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);
            engine.activateEffect(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p2.id && action.zoneIndex === 0
            );
            if (pick) engine.step(pick);
            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            return [
                { pass: !!pick, message: '상대 유닛 선택 가능' },
                { pass: p2.unitZones[0].unit === null || after === before - 1500, message: '파워 -1500 적용' },
            ];
        },
    },
    {
        testId: 'BT06-005',
        name: '바니 티르 엔트리 선택 0코스트 + 조우 -3000',
        description: '스킬존 스킬 선택 시 해당 스킬을 턴 한정 0코스트로 만들고 조우 유닛 파워를 감소시킨다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-005')];
            p1.skillZone = [getCard('ST10-015')];
            p2.unitZones[0].unit = getCard('ST01-011');
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);

            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);

            const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (pick) engine.step(pick);

            const selectedSkill = p1.skillZone[0] as any;
            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            return [
                { pass: !!confirm, message: '옵션 선택(확인) 가능' },
                { pass: !!pick, message: '스킬존 카드 선택 가능' },
                {
                    pass: selectedSkill?.turnCostOverride?.cost === 0 && selectedSkill?.turnCostOverride?.turnCount === engine.state.turnCount,
                    message: '턴 한정 0코스트 적용',
                },
                { pass: p2.unitZones[0].unit === null || after === before - 3000, message: '조우 유닛 파워 -3000 적용' },
            ];
        },
    },
    {
        testId: 'BT06-006',
        name: '루벤시아 체인3 전장 -5000',
        description: '체인3 조건에서 상대 전유닛 파워를 감소시킨다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-006');
            p2.unitZones[0].unit = getCard('ST01-011');
            p2.unitZones[1].unit = getCard('ST01-011');
            p2.unitZones[2].unit = getCard('ST01-011');
            engine.incrementTurnUnitAttackCount(p1.id);
            engine.incrementTurnUnitAttackCount(p1.id);
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            const before = [0, 1, 2].map(index => getZonePower(engine, p2, index));
            engine.attack(0);
            const after = [0, 1, 2].map(index => p2.unitZones[index].unit ? getZonePower(engine, p2, index) : 0);
            return [
                {
                    pass: [0, 1, 2].every(index => p2.unitZones[index].unit === null || after[index] === before[index] - 5000),
                    message: '상대 전유닛 파워 -5000 적용',
                },
            ];
        },
    },
    {
        testId: 'BT06-006-Trigger',
        name: '루벤시아 트리거 자기 트래시 + 상대 -5000',
        description: '대미지 트리거 시 자기 자신을 트래시하고 상대 유닛 1장을 약화시킨다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.deck = [getCard('BT06-006')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);
            engine.dealDamage(p1, 1);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p2.id && action.zoneIndex === 0
            );
            if (pick) engine.step(pick);
            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            return [
                { pass: !!pick, message: '트리거 대상 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT06-006')), message: '트리거 자기 트래시' },
                { pass: p2.unitZones[0].unit === null || after === before - 5000, message: '트리거 파워 -5000 적용' },
            ];
        },
    },
    {
        testId: 'BT06-007',
        name: '라피나 어태커 +1000',
        description: '어태커 시 전투 종료까지 파워가 증가한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-007');
            p2.unitZones[0].unit = getCard('ST10-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = getZonePower(engine, p1, 0);
            engine.attack(0);
            const during = getZonePower(engine, p1, 0);
            return [
                { pass: during === before + 1000, message: '어태커 +1000 적용' },
            ];
        },
    },
    {
        testId: 'BT06-008',
        name: '루비아 체인2 +4000',
        description: '체인2 조건에서 어태커 파워가 크게 증가한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-008');
            p2.unitZones[0].unit = getCard('ST10-005');
            engine.incrementTurnUnitAttackCount(p1.id);
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = getZonePower(engine, p1, 0);
            engine.attack(0);
            const during = getZonePower(engine, p1, 0);
            return [
                { pass: during === before + 4000, message: '체인2 +4000 적용' },
            ];
        },
    },
    {
        testId: 'BT06-009',
        name: '엘리제 체인2 관통+1000 및 아군 +2000',
        description: '체인2 관통/파워 상승과 별도 어태커 아군 버프를 함께 적용한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-009');
            p1.unitZones[1].unit = getCard('ST10-005');
            p2.unitZones[0].unit = getCard('ST10-004');
            engine.incrementTurnUnitAttackCount(p1.id);
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const beforeSelf = getZonePower(engine, p1, 0);
            const beforeAlly = getZonePower(engine, p1, 1);
            engine.attack(0);
            const pickAlly = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id && action.zoneIndex === 1
            );
            if (pickAlly) engine.step(pickAlly);
            const afterSelf = getZonePower(engine, p1, 0);
            const afterAlly = getZonePower(engine, p1, 1);
            return [
                { pass: !!pickAlly, message: '아군 대상 선택 가능' },
                { pass: afterSelf === beforeSelf + 1000, message: '체인2 파워 +1000' },
                { pass: afterAlly === beforeAlly + 2000, message: '별도 어태커 아군 +2000' },
            ];
        },
    },
    {
        testId: 'BT06-010',
        name: '허무의 별 그란힐트 엔트리 자동공격 후 전투 종료 자기 트래시',
        description: '엔트리 자동공격, 듀얼리스트, 전투 종료 자기 트래시를 수행한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-010')];
            p2.unitZones[0].unit = getCard('ST10-005');
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playUnit(0, 0);
            const forcedBlock = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) =>
                action.shouldBlock && action.blockerZoneIndex === 0
            );
            if (forcedBlock) engine.step(forcedBlock);
            return [
                { pass: !!forcedBlock, message: '조우 강제 방어 진입' },
                { pass: p1.unitZones[0].unit === null, message: '전투 종료 후 자기 트래시' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT06-010')), message: 'BT06-010 트래시 이동' },
            ];
        },
    },
    {
        testId: 'BT06-011',
        name: '에레니르 엔트리 선택 0코스트 + 드로우',
        description: '스킬존 스킬 선택 시 0코스트를 부여하고 1드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-011')];
            p1.skillZone = [getCard('ST10-015')];
            p1.deck = [getCard('ST01-002')];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const handBefore = p1.hand.length;
            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (pick) engine.step(pick);
            const selectedSkill = p1.skillZone[0] as any;
            return [
                { pass: !!confirm, message: '옵션 선택(확인) 가능' },
                { pass: !!pick, message: '스킬존 카드 선택 가능' },
                { pass: p1.hand.length === handBefore, message: '유닛 출격(-1) + 드로우(+1)로 손패 유지' },
                {
                    pass: selectedSkill?.turnCostOverride?.cost === 0 && selectedSkill?.turnCostOverride?.turnCount === engine.state.turnCount,
                    message: '턴 한정 0코스트 적용',
                },
            ];
        },
    },
    {
        testId: 'BT06-012',
        name: '테레제 체인2 상대 전유닛 -2000',
        description: '체인2 조건에서 상대 필드 전체를 약화시킨다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-012');
            p2.unitZones[0].unit = getCard('ST01-011');
            p2.unitZones[1].unit = getCard('ST01-011');
            engine.incrementTurnUnitAttackCount(p1.id);
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            const before0 = getZonePower(engine, p2, 0);
            const before1 = getZonePower(engine, p2, 1);
            engine.attack(0);
            const after0 = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            const after1 = p2.unitZones[1].unit ? getZonePower(engine, p2, 1) : 0;
            return [
                { pass: p2.unitZones[0].unit === null || after0 === before0 - 2000, message: '상대 0번 유닛 -2000' },
                { pass: p2.unitZones[1].unit === null || after1 === before1 - 2000, message: '상대 1번 유닛 -2000' },
            ];
        },
    },
    {
        testId: 'BT06-013',
        name: '리아트리스 체인2 침투+1000',
        description: '체인2 조건에서 침투와 파워 증가를 동시에 얻는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-013');
            p2.unitZones[0].unit = getCard('BT06-013');
            engine.incrementTurnUnitAttackCount(p1.id);
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = getZonePower(engine, p1, 0);
            engine.attack(0);
            const after = getZonePower(engine, p1, 0);
            const hasInfiltration = p1.unitZones[0].temporaryEffects.some((effect: any) => (effect.description || '').includes('침투'));
            return [
                { pass: after === before + 1000, message: '체인2 파워 +1000' },
                { pass: hasInfiltration, message: '침투 효과 부여' },
            ];
        },
    },
    {
        testId: 'BT06-014',
        name: '신성 유스티아 체인2 +4000',
        description: '체인2 조건에서 어태커 파워 +4000을 얻는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-014');
            p2.unitZones[0].unit = getCard('ST10-005');
            engine.incrementTurnUnitAttackCount(p1.id);
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = getZonePower(engine, p1, 0);
            engine.attack(0);
            const after = getZonePower(engine, p1, 0);
            return [
                { pass: after === before + 4000, message: '체인2 파워 +4000 적용' },
            ];
        },
    },

    {
        testId: 'BT06-015',
        name: '체인 유닛 패시브 +1500',
        description: '자신 필드의 체인 유닛에게 파워 +1500을 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT06-015');
            p1.unitZones[1].unit = getCard('BT06-014');
            p1.unitZones[2].unit = getCard('ST10-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const chainBase = p1.unitZones[1].unit?.power || 0;
            const nonChainBase = p1.unitZones[2].unit?.power || 0;
            const chainPower = getZonePower(engine, p1, 1);
            const nonChainPower = getZonePower(engine, p1, 2);
            return [
                { pass: chainPower === chainBase + 1500, message: '체인 유닛 +1500 적용' },
                { pass: nonChainPower === nonChainBase, message: '비체인 유닛은 변화 없음' },
            ];
        },
    },
    {
        testId: 'BT06-016',
        name: '엔트리 -2000 + 공격 시 아군 +2000',
        description: '엔트리 시 상대 유닛 -2000, 공격 시 아군 유닛 +2000을 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-016')];
            p1.unitZones[1].unit = getCard('ST10-005');
            p1.leaderLevel = 10;
            p2.unitZones[0].unit = getCard('ST10-004');
            p2.unitZones[1].unit = getCard('ST10-004');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforeEncounter = getZonePower(engine, p2, 0);
            const beforeAlly = getZonePower(engine, p1, 1);

            engine.playUnit(0, 0);
            const afterEntry = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            const afterAttacker = p1.unitZones[1].unit ? getZonePower(engine, p1, 1) : 0;

            return [
                { pass: p2.unitZones[0].unit === null || afterEntry === beforeEncounter - 2000, message: '엔트리 상대 -2000 적용' },
                { pass: p1.unitZones[1].unit === null || afterAttacker === beforeAlly + 2000, message: '공격 시 아군 +2000 적용' },
            ];
        },
    },
    {
        testId: 'BT06-017',
        name: '액티브:어택 상대 유닛 -2500',
        description: '액티브:어택으로 상대 유닛 1장을 선택해 -2500을 적용한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-017');
            p1.skillZone = [getCard('ST10-015')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);
            engine.activateEffect(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p2.id && a.zoneIndex === 0);
            if (pick) engine.step(pick);
            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            return [
                { pass: !!pick, message: '상대 대상 선택 가능' },
                { pass: p2.unitZones[0].unit === null || after === before - 2500, message: '상대 -2500 적용' },
            ];
        },
    },
    {
        testId: 'BT06-018',
        name: '엔트리 아군 유닛 +4000',
        description: '엔트리 시 아군 유닛 1장을 선택해 +4000을 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-018')];
            p1.unitZones[1].unit = getCard('ST10-005');
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = getZonePower(engine, p1, 1);
            engine.playUnit(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p1.id && a.zoneIndex === 1);
            if (pick) engine.step(pick);
            const after = p1.unitZones[1].unit ? getZonePower(engine, p1, 1) : 0;
            return [
                { pass: !!pick, message: '아군 대상 선택 가능' },
                { pass: p1.unitZones[1].unit === null || after === before + 4000, message: '아군 +4000 적용' },
            ];
        },
    },
    {
        testId: 'BT06-019',
        name: '체인3 약탈[2]',
        description: '체인3 조건에서 약탈[2]로 카드 2장을 획득한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-019');
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p1.hand = [];
            p2.unitZones[0].unit = getCard('ST10-005');
            engine.incrementTurnUnitAttackCount(p1.id);
            engine.incrementTurnUnitAttackCount(p1.id);
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const handBefore = p1.hand.length;
            engine.attack(0);
            const forceBlock = findAction(engine, p2.id, 'RESOLVE_BLOCK', (a: any) => a.shouldBlock && a.blockerZoneIndex === 0);
            if (forceBlock) engine.step(forceBlock);
            return [
                { pass: !!forceBlock, message: '강제 방어 진입' },
                { pass: p1.hand.length === handBefore + 2, message: '약탈[2] 2장 획득' },
            ];
        },
    },
    {
        testId: 'BT06-020',
        name: '체인2 상대 -3000 + 1드로우',
        description: '체인2 조건에서 상대 유닛 약화 후 카드 1장을 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-020');
            p1.deck = [getCard('ST01-002')];
            p1.hand = [];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.incrementTurnUnitAttackCount(p1.id);
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const handBefore = p1.hand.length;
            engine.attack(0);
            return [
                { pass: p1.hand.length === handBefore + 1, message: '카드 1장 드로우' },
            ];
        },
    },
    {
        testId: 'BT06-021',
        name: '액티브:어택 상대 유닛 -4000',
        description: '액티브:어택으로 상대 유닛 1장을 선택해 -4000을 적용한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-021');
            p1.skillZone = [getCard('ST10-015')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);
            engine.activateEffect(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p2.id && a.zoneIndex === 0);
            if (pick) engine.step(pick);
            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            return [
                { pass: !!pick, message: '상대 대상 선택 가능' },
                { pass: p2.unitZones[0].unit === null || after === before - 4000, message: '상대 -4000 적용' },
            ];
        },
    },
    {
        testId: 'BT06-022',
        name: '엔트리 상대 -2000 + 추가 드로우',
        description: '엔트리 시 상대 전유닛 -2000을 적용하고 효과 처리 후 카드를 추가로 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-022')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            p1.leaderLevel = 10;
            p2.unitZones[0].unit = getCard('ST01-002');
            p2.unitZones[1].unit = getCard('ST01-002');
            if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 2000;
            if (p2.unitZones[1].unit) p2.unitZones[1].unit.power = 2000;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const handBefore = p1.hand.length;
            engine.playUnit(0, 0);
            return [
                { pass: p1.hand.length === handBefore + 1, message: '2장 드로우로 손패 +1 (사용 1, 드로우 2)' },
                { pass: p1.deck.length === 0, message: '2장 드로우 후 덱 소진' },
            ];
        },
    },
    {
        testId: 'BT06-022-Active',
        name: '액티브:어택 코스트 2 이하 스킬 회수',
        description: '조건 충족 시 트래시의 코스트 2 이하 스킬 1장을 패로 회수한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT06-022');
            p1.skillZone = [getCard('BT06-026')];
            p1.trash = [getCard('BT06-028')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 1);
            const pick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (a: any) => p1.trash[a.trashIndex]?.id.startsWith('BT06-028'));
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '트래시 대상 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT06-028')), message: '선택 스킬 패 회수' },
            ];
        },
    },
    {
        testId: 'BT06-023',
        name: '엔트리 손패 전부 트래시 후 3드로우',
        description: '선택 시 손패를 모두 트래시하고 카드 3장을 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-023'), getCard('ST01-002'), getCard('ST01-002')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
            if (confirm) engine.step(confirm);
            return [
                { pass: !!confirm, message: '옵션 확인 선택 가능' },
                { pass: p1.hand.length === 3, message: '손패 3장 유지(사용 1 + 3드로우)' },
            ];
        },
    },
    {
        testId: 'BT06-023-Active',
        name: '액티브:어택 코스트 3 이하 상대 트래시',
        description: '조건 충족 시 코스트 3 이하 상대 유닛 1장을 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-023');
            p1.skillZone = [getCard('ST10-015')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.activateEffect(0, 1);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p2.id && a.zoneIndex === 0);
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '상대 대상 선택 가능' },
                { pass: p2.unitZones[0].unit === null, message: '코스트 3 이하 상대 트래시' },
            ];
        },
    },
    {
        testId: 'BT06-024',
        name: '액티브:어택 상대 전유닛 -3000',
        description: '스킬존 2장 조건에서 상대 전유닛 -3000을 적용한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-024');
            p1.skillZone = [getCard('ST10-015'), getCard('ST10-016')];
            p2.unitZones[0].unit = getCard('ST10-005');
            p2.unitZones[1].unit = getCard('ST10-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            const before0 = getZonePower(engine, p2, 0);
            const before1 = getZonePower(engine, p2, 1);
            engine.activateEffect(0, 0);
            const after0 = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            const after1 = p2.unitZones[1].unit ? getZonePower(engine, p2, 1) : 0;
            return [
                { pass: p2.unitZones[0].unit === null || after0 === before0 - 3000, message: '0번 유닛 -3000 적용' },
                { pass: p2.unitZones[1].unit === null || after1 === before1 - 3000, message: '1번 유닛 -3000 적용' },
            ];
        },
    },
    {
        testId: 'BT06-025',
        name: '액티브:어택 상대 유닛 -7000',
        description: '스킬존 2장 조건에서 상대 유닛 1장에 -7000을 적용한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-025');
            p1.skillZone = [getCard('ST10-015'), getCard('ST10-016')];
            p2.unitZones[0].unit = getCard('ST10-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);
            engine.activateEffect(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p2.id && a.zoneIndex === 0);
            if (pick) engine.step(pick);
            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            return [
                { pass: !!pick, message: '상대 대상 선택 가능' },
                { pass: p2.unitZones[0].unit === null || after === before - 7000, message: '상대 -7000 적용' },
            ];
        },
    },
    {
        testId: 'BT06-026',
        name: '스킬 상대 유닛 -1000',
        description: '상대 유닛 1장을 선택해 -1000을 적용한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-026')];
            p1.leaderLevel = 10;
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p2.id && a.zoneIndex === 0);
            if (pick) engine.step(pick);
            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            return [
                { pass: !!pick, message: '상대 대상 선택 가능' },
                { pass: p2.unitZones[0].unit === null || after === before - 1000, message: '상대 -1000 적용' },
            ];
        },
    },
    {
        testId: 'BT06-027',
        name: '스킬 상단 2장 공개 후 유닛 1장 획득',
        description: '덱 상단 2장을 공개해 유닛 1장을 패로 가져오고 나머지는 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-027')];
            p1.deck = [getCard('ST10-015'), getCard('ST01-002')];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) =>
                (engine.state.revealedCards[action.revealedIndex]?.id || '').startsWith('ST01-002')
            );
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '공개 카드 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '유닛 카드 패 획득' },
                { pass: p1.trash.length >= 1, message: '비선택 카드 트래시' },
            ];
        },
    },
    {
        testId: 'BT06-028',
        name: '스킬 상대 유닛 -2000',
        description: '상대 유닛 1장을 선택해 -2000을 적용한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-028')];
            p1.leaderLevel = 10;
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p2.id && a.zoneIndex === 0);
            if (pick) engine.step(pick);
            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            return [
                { pass: !!pick, message: '상대 대상 선택 가능' },
                { pass: p2.unitZones[0].unit === null || after === before - 2000, message: '상대 -2000 적용' },
            ];
        },
    },
    {
        testId: 'BT06-029',
        name: '눈의 꽃 패 유지 선택 후 3장까지 드로우',
        description: '패를 최대 2장 유지하고 나머지를 트래시한 뒤 패를 3장까지 보충한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-029'), getCard('ST10-015'), getCard('ST01-002'), getCard('ST01-002')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);

            const keep = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (a: any) =>
                p1.hand[a.handIndex]?.id.startsWith('ST10-015')
            );
            if (keep) engine.step(keep);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);

            return [
                { pass: !!keep, message: '유지할 패 선택 가능' },
                { pass: !!confirm, message: '부분 선택 확정 가능' },
                { pass: p1.hand.length === 3, message: '패 3장까지 보충' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST10-015')), message: '선택한 패 유지' },
            ];
        },
    },
    {
        testId: 'BT06-029-Trigger',
        name: '눈의 꽃 트리거 스킬 회수',
        description: '트리거 시 자기 자신 트래시 후 리더 레벨 이하 스킬을 회수한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 3;
            p1.deck = [getCard('BT06-029')];
            p1.trash = [getCard('ST10-013'), getCard('ST10-016')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            const pick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (a: any) =>
                p1.trash[a.trashIndex]?.id.startsWith('ST10-013')
            );
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '트래시 대상 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST10-013')), message: '리더 레벨 이하 스킬 회수' },
                { pass: p1.damage.every((card: Card) => !card.id.startsWith('BT06-029')), message: '트리거 카드 대미지존 이탈' },
            ];
        },
    },
    {
        testId: 'BT06-030',
        name: '도깨비님의 가호랍니다 아군 전유닛 +2000',
        description: '스킬 사용 시 아군 필드 전유닛에 +2000을 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-030')];
            p1.unitZones[0].unit = getCard('ST10-005');
            p1.unitZones[1].unit = getCard('ST10-005');
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before0 = getZonePower(engine, p1, 0);
            const before1 = getZonePower(engine, p1, 1);
            engine.playSkill(0);
            const after0 = p1.unitZones[0].unit ? getZonePower(engine, p1, 0) : 0;
            const after1 = p1.unitZones[1].unit ? getZonePower(engine, p1, 1) : 0;
            return [
                { pass: after0 === before0 + 2000, message: '0번 유닛 +2000' },
                { pass: after1 === before1 + 2000, message: '1번 유닛 +2000' },
            ];
        },
    },
    {
        testId: 'BT06-031',
        name: '온천은 정말 최고야 필터 회수',
        description: '비트리거/5000 이하 유닛만 회수 대상으로 노출한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-031')];
            p1.trash = [getCard('ST01-002'), getCard('BT06-006'), getCard('BT06-010')];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const legal = engine.getLegalActions(p1.id).filter((a: any) => a.type === 'SELECT_TRASH_TARGET') as any[];
            const selectableIds = legal.map((a: any) => p1.trash[a.trashIndex]?.id);
            const canLow = selectableIds.some((id: string) => id?.startsWith('ST01-002'));
            const canTrigger = selectableIds.some((id: string) => id?.startsWith('BT06-006'));
            const canHighPower = selectableIds.some((id: string) => id?.startsWith('BT06-010'));

            const pick = legal.find((a: any) => p1.trash[a.trashIndex]?.id.startsWith('ST01-002'));
            if (pick) engine.step(pick);
            return [
                { pass: canLow, message: '유효 대상 선택 가능' },
                { pass: !canTrigger, message: '트리거 카드 제외' },
                { pass: !canHighPower, message: '5000 초과 파워 카드 제외' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '선택 카드 패 회수' },
            ];
        },
    },
    {
        testId: 'BT06-032',
        name: '데스 엔딩 러브 듀얼리스트 부여',
        description: '대상 아군이 턴 종료까지 듀얼리스트를 얻어 조우 방어를 강제한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-032')];
            p1.unitZones[1].unit = getCard('ST10-005');
            p2.unitZones[1].unit = getCard('ST10-005');
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p1.id && a.zoneIndex === 1);
            if (pick) engine.step(pick);

            engine.state.phase = Phase.ATTACK;
            engine.attack(1);
            const forcedBlock = findAction(engine, p2.id, 'RESOLVE_BLOCK', (a: any) => a.shouldBlock && a.blockerZoneIndex === 1);
            return [
                { pass: !!pick, message: '대상 아군 선택 가능' },
                { pass: !!forcedBlock, message: '조우 강제 방어(듀얼리스트) 확인' },
            ];
        },
    },
    {
        testId: 'BT06-033',
        name: '비키니 블래스터 파워 감소 후 트래시 시 1드로우',
        description: '효과로 대상 트래시 시 1장을 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-033')];
            p1.deck = [getCard('ST01-002')];
            p1.leaderLevel = 10;
            p2.unitZones[0].unit = getCard('ST01-002');
            if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 2000;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p2.id && a.zoneIndex === 0);
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '상대 대상 선택 가능' },
                { pass: p2.unitZones[0].unit === null, message: '효과로 대상 트래시' },
                { pass: p1.hand.length === 1, message: '트래시 성공 시 1드로우' },
            ];
        },
    },
    {
        testId: 'BT06-034',
        name: '신실의 검 선택 유닛 자동 공격',
        description: '3코스트 이하 아군 선택 후 조우가 있으면 해당 유닛으로 공격한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-034')];
            p1.unitZones[1].unit = getCard('BT06-002');
            p2.unitZones[1].unit = getCard('ST10-005');
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p1.id && a.zoneIndex === 1);
            if (pick) engine.step(pick);
            const noBlock = findAction(engine, p2.id, 'RESOLVE_BLOCK', (a: any) => a.shouldBlock === false);
            const resolveBlock = noBlock || findAction(engine, p2.id, 'RESOLVE_BLOCK');
            if (resolveBlock) engine.step(resolveBlock);
            engine.state.phase = Phase.ATTACK;
            const attackAgain = findAction(engine, p1.id, 'ATTACK', (a: any) => a.attackerZoneIndex === 1);
            return [
                { pass: !!pick, message: '3코 이하 아군 선택 가능' },
                { pass: !!resolveBlock, message: '자동 공격 전투 종료 진행' },
                { pass: p1.unitZones[1].attackCountThisTurn === 0 && !p1.unitZones[1].hasAttacked, message: '효과 공격은 일반 공격권 미소모' },
                { pass: !!attackAgain, message: '어택 페이즈에서 다시 공격 가능' },
            ];
        },
    },
    {
        testId: 'BT06-035',
        name: '피니쉬 블래스터 손패 차이만큼 감소',
        description: '손패 장수 차이 1장당 -2000을 적용한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-035'), getCard('ST01-002'), getCard('ST01-002')];
            p2.hand = [getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-011');
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p2.id && a.zoneIndex === 0);
            if (pick) engine.step(pick);
            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            return [
                { pass: !!pick, message: '상대 대상 선택 가능' },
                { pass: p2.unitZones[0].unit === null || after === before - 2000, message: '손패 차이 1장분 -2000 적용' },
            ];
        },
    },
    {
        testId: 'BT06-036',
        name: '낙월일섬 EXIT 봉인 + 유닛 -2000',
        description: '상대 EXIT 발동을 턴 종료까지 봉인하고 유닛 파워를 감소시킨다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-036')];
            p1.leaderLevel = 10;
            p2.hand = [];
            p2.trash = [getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-011');
            p2.unitZones[1].unit = getCard('ST10-005');
            p2.unitZones[1].items = [getCard('BT06-042')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p2.id && a.zoneIndex === 0);
            if (pick) engine.step(pick);
            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;

            engine.destroyUnit(p2, p2.unitZones[1], undefined, 'EFFECT');

            return [
                { pass: !!pick, message: '상대 대상 선택 가능' },
                { pass: p2.unitZones[0].unit === null || after === before - 2000, message: '상대 유닛 -2000 적용' },
                { pass: !p2.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '상대 EXIT 효과 봉인 확인' },
            ];
        },
    },
    {
        testId: 'BT06-037',
        name: '얼어붙은 의지 추가 공격 부여',
        description: '선택한 3코 이하 아군이 어택 페이즈 중 1번 더 공격할 수 있다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-037')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p1.id && a.zoneIndex === 0);
            if (pick) engine.step(pick);

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            const secondAttack = findAction(engine, p1.id, 'ATTACK', (a: any) => a.attackerZoneIndex === 0);
            return [
                { pass: !!pick, message: '3코 이하 아군 선택 가능' },
                { pass: !!secondAttack, message: '추가 공격 가능' },
            ];
        },
    },
    {
        testId: 'BT06-038',
        name: '가만두지 않겠어 최대 2장 선택(부분선택)',
        description: '상대 유닛 2장까지 선택하며 1장만 선택해도 확정 가능하다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-038')];
            p1.leaderLevel = 10;
            p2.unitZones[0].unit = getCard('ST01-011');
            p2.unitZones[1].unit = getCard('ST01-011');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before0 = getZonePower(engine, p2, 0);
            const before1 = getZonePower(engine, p2, 1);
            engine.playSkill(0);
            const pick0 = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p2.id && a.zoneIndex === 0);
            if (pick0) engine.step(pick0);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);
            const after0 = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            const after1 = p2.unitZones[1].unit ? getZonePower(engine, p2, 1) : 0;
            return [
                { pass: !!pick0, message: '대상 1장 선택 가능' },
                { pass: !!confirm, message: '부분 선택 확정 가능' },
                { pass: p2.unitZones[0].unit === null || after0 === before0 - 3000, message: '선택 대상 -3000 적용' },
                { pass: p2.unitZones[1].unit === null || after1 === before1, message: '비선택 대상 변화 없음' },
            ];
        },
    },
    {
        testId: 'BT06-039',
        name: '잿빛 폭풍 트래시 수 비례 감소',
        description: '손패를 임의 개수 트래시하고 트래시 수 x 3000만큼 대상 파워를 감소시킨다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-039'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p1.leaderLevel = 10;
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);
            const handAfterPlay = 3;
            engine.playSkill(0);

            const pickTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p2.id && a.zoneIndex === 0);
            if (pickTarget) engine.step(pickTarget);

            for (let i = 0; i < 2; i++) {
                const handTargets = engine.getLegalActions(p1.id).filter((a: any) => a.type === 'SELECT_HAND_TARGET') as any[];
                if (!handTargets[i]) break;
                engine.step(handTargets[i]);
            }

            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);

            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            const discardedCount = Math.max(0, handAfterPlay - p1.hand.length);
            return [
                { pass: !!pickTarget, message: '상대 대상 선택 가능' },
                { pass: !!confirm || engine.state.interactionMode === 'NORMAL', message: '손패 트래시 선택 절차 진행' },
                { pass: p2.unitZones[0].unit === null || after === before - (discardedCount * 3000), message: '트래시 수 비례 감소 적용' },
            ];
        },
    },
    {
        testId: 'BT06-040',
        name: '으, 음매 상대 유닛 -6000',
        description: '상대 유닛 1장을 선택해 -6000을 적용한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-040')];
            p1.leaderLevel = 10;
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p2.id && a.zoneIndex === 0);
            if (pick) engine.step(pick);
            const after = p2.unitZones[0].unit ? getZonePower(engine, p2, 0) : 0;
            return [
                { pass: !!pick, message: '상대 대상 선택 가능' },
                { pass: p2.unitZones[0].unit === null || after === before - 6000, message: '상대 -6000 적용' },
            ];
        },
    },
    {
        testId: 'BT06-041',
        name: '천둥의 망치 추가 옵션 처리',
        description: '조우 트래시 성공 시 아이템 자가 트래시를 선택해 2드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-041')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('ST10-005');
            p1.leaderLevel = 10;

            p2.unitZones[0].unit = getCard('ST01-002');
            if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 1000;

            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playItem(0, 0);
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);

            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
            if (confirm) engine.step(confirm);
            const pickItem = findAction(engine, p1.id, 'SELECT_ITEM_TARGET');
            if (pickItem) engine.step(pickItem);

            return [
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 트래시' },
                { pass: !!confirm, message: '추가 효과 옵션 선택 가능' },
                { pass: !!pickItem, message: '장착 아이템 선택 가능' },
                { pass: p1.hand.length === 2, message: '아이템 트래시 후 2드로우' },
                { pass: p1.unitZones[0].items.length === 0, message: '장착 아이템 트래시됨' },
            ];
        },
    },
    {
        testId: 'BT06-042',
        name: '반역의 결의 엑시트 회수',
        description: '엑시트 시 자기 자신 제외 2코 이하 카드 1장을 회수한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-042')];
            p1.trash = [getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('ST10-005');
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playItem(0, 0);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

            const legal = engine.getLegalActions(p1.id).filter((a: any) => a.type === 'SELECT_TRASH_TARGET') as any[];
            const selectableIds = legal.map((a: any) => p1.trash[a.trashIndex]?.id);
            const hasSelf = selectableIds.some((id: string) => id?.startsWith('BT06-042'));
            const hasLow = selectableIds.some((id: string) => id?.startsWith('ST01-002'));

            const pick = legal.find((a: any) => p1.trash[a.trashIndex]?.id.startsWith('ST01-002'));
            if (pick) engine.step(pick);

            return [
                { pass: hasLow, message: '2코 이하 카드 선택 가능' },
                { pass: !hasSelf, message: '자기 자신 제외 필터 적용' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '카드 회수 성공' },
            ];
        },
    },
    {
        testId: 'BT06-043',
        name: '꿈속의 신부 이클립스 각성',
        description: '리더 레벨 5 이상에서 각성한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('BT06-043');
            p1.levelZone.isAwakened = false;
            p1.leaderLevel = 4;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel >= 5, message: '리더 레벨 5 달성' },
                { pass: p1.levelZone?.isAwakened === true, message: 'BT06-043 각성 성공' },
            ];
        },
    },
    {
        testId: 'BT06-043-Active',
        name: '꿈속의 신부 이클립스 트래시 스킬 발동',
        description: '덱 탑을 트래시하고 그중 스킬을 선택해 효과를 발동한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('BT06-043');
            if (p1.levelZone) p1.levelZone.isAwakened = true;
            p1.leaderLevel = 5;
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST11-014')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = p1.hand.length;
            engine.activateEffect(0, 1, 'LEADER');
            const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (a: any) => (engine.state.revealedCards[a.revealedIndex]?.id || '').startsWith('ST11-014'));
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '트래시 스킬 선택 가능' },
                { pass: p1.hand.length === before + 2, message: '선택 스킬 효과(2드로우) 발동' },
            ];
        },
    },
    {
        testId: 'BT06-044',
        name: '물놀이 요정 레피테아 드로우',
        description: '스킬 존에 스킬이 1장 이상이면 액티브 메인으로 1드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT06-044');
            p1.skillZone = [getCard('ST10-015')];
            p1.deck = [getCard('ST01-002')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = p1.hand.length;
            engine.activateEffect(0, 0);
            return [
                { pass: p1.hand.length === before + 1, message: '조건 충족 시 1드로우' },
            ];
        },
    },
    {
        testId: 'BT06-045',
        name: '학교의 여왕 엠마 패시브 광전사 디버프',
        description: '패시브로 상대 광전사 유닛만 파워를 -500 한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const oppBerserk = getCard('ST01-002');
            oppBerserk.id = 'BT06-TST-OPP-BERSERK';
            oppBerserk.keywords = [...(oppBerserk.keywords || []), '광전사'];

            const allyBerserk = getCard('ST01-002');
            allyBerserk.id = 'BT06-TST-ALLY-BERSERK';
            allyBerserk.keywords = [...(allyBerserk.keywords || []), '광전사'];

            const oppNonBerserk = getCard('ST10-005');
            oppNonBerserk.id = 'BT06-TST-OPP-NON-BERSERK';
            oppNonBerserk.keywords = (oppNonBerserk.keywords || []).filter((keyword: string) => keyword !== '광전사');

            p1.unitZones[0].unit = getCard('BT06-045');
            p1.unitZones[1].unit = allyBerserk;
            p2.unitZones[0].unit = oppBerserk;
            p2.unitZones[1].unit = oppNonBerserk;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const oppBerserkPower = getZonePower(engine, p2, 0);
            const oppNonBerserkPower = getZonePower(engine, p2, 1);
            const allyBerserkPower = getZonePower(engine, p1, 1);

            const oppBerserkBase = p2.unitZones[0].unit?.power || 0;
            const oppNonBerserkBase = p2.unitZones[1].unit?.power || 0;
            const allyBerserkBase = p1.unitZones[1].unit?.power || 0;

            return [
                { pass: oppBerserkPower === oppBerserkBase - 500, message: '상대 광전사 유닛 -500 적용' },
                { pass: oppNonBerserkPower === oppNonBerserkBase, message: '상대 비광전사 유닛은 변화 없음' },
                { pass: allyBerserkPower === allyBerserkBase, message: '아군 광전사 유닛은 변화 없음' },
            ];
        },
    },
    {
        testId: 'BT06-046',
        name: '미지의 탐구자 디아나 디펜더 부여',
        description: '아군 유닛 1장에 상대 턴 종료까지 디펜더(+2000)를 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT06-046');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p1.id && a.zoneIndex === 1);
            if (pick) engine.step(pick);
            const granted = p1.unitZones[1].temporaryEffects.some((effect: any) => effect.activation === 'DEFENDER' && effect.duration === 'OPP_TURN_END');
            return [
                { pass: !!pick, message: '아군 대상 선택 가능' },
                { pass: granted, message: '상대 턴 종료까지 디펜더 효과 부여' },
            ];
        },
    },
    {
        testId: 'BT06-047',
        name: '네온 세이비어 안젤리카 스킬 탐색',
        description: '덱 탑 3 공개 후 스킬 1장 패 획득, 나머지 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-047')];
            p1.deck = [getCard('ST01-002'), getCard('ST10-015'), getCard('ST01-002')];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (a: any) => (engine.state.revealedCards[a.revealedIndex]?.type) === 'SKILL');
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '공개 스킬 선택 가능' },
                { pass: p1.trash.length >= 2, message: '비선택 카드 트래시' },
            ];
        },
    },
    {
        testId: 'BT06-048',
        name: '신입 사원 세이르 공격 불가',
        description: '패시브로 공격 액션이 노출되지 않는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT06-048');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const canAttack = engine.getLegalActions(p1.id).some((a: any) => a.type === 'ATTACK' && a.attackerZoneIndex === 0);
            return [
                { pass: !canAttack, message: '공격 불가 패시브 적용' },
            ];
        },
    },
    {
        testId: 'BT06-049',
        name: '정화의 무녀 그라나데 트래시 회수',
        description: '트래시의 3코 이하 스킬 1장을 패로 회수한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-049')];
            p1.trash = [getCard('ST11-014')];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (a: any) => p1.trash[a.trashIndex]?.id.startsWith('ST11-014'));
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '3코 이하 스킬 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST11-014')), message: '스킬 회수 성공' },
            ];
        },
    },
    {
        testId: 'BT06-050',
        name: '선도부 글레이시아 디펜더',
        description: '디펜더로 방어 시 +2000을 받는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p2.unitZones[0].unit = getCard('BT06-050');
            if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 2500;
            p1.unitZones[0].unit = getCard('ST01-002');
            if (p1.unitZones[0].unit) p1.unitZones[0].unit.power = 4000;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            engine.attack(0);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (a: any) => a.shouldBlock === true && a.blockerZoneIndex === 0);
            if (block) engine.step(block);
            return [
                { pass: !!block, message: '조우 방어 선언 가능' },
                { pass: p2.unitZones[0].unit !== null, message: '디펜더 +2000으로 방어 유닛 생존' },
                { pass: engine.state.players[0].unitZones[0].unit === null, message: '공격 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'BT06-051',
        name: '호박팔이 소녀 소냐 상대 턴 종료까지 공격 봉인',
        description: '엔트리로 조우 유닛을 상대 턴 종료까지 공격 불가로 만든다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('BT06-051')];
            p1.leaderLevel = 10;
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playUnit(0, 0);
            const lockUntil = p2.unitZones[0].temporaryEffects.find((effect: any) => effect.action?.params?.cannotAttackUntilTurnCount !== undefined)?.action?.params?.cannotAttackUntilTurnCount;
            while (!(engine.currentPlayer.id === p2.id && engine.state.phase === Phase.ATTACK)) {
                engine.nextPhase();
                if (engine.state.winner) break;
            }
            const canAttackWhileLocked = engine.getLegalActions(p2.id).some((a: any) => a.type === 'ATTACK' && a.attackerZoneIndex === 0);
            return [
                { pass: typeof lockUntil === 'number', message: '턴 경계 공격 봉인 마커 부여' },
                { pass: !canAttackWhileLocked, message: '상대 턴 동안 공격 불가 유지' },
                { pass: p1.unitZones[0].unit?.id.startsWith('BT06-051') === true, message: '유닛 배치 성공' },
            ];
        },
    },
    {
        testId: 'BT06-052',
        name: 'B급 아이돌 헬레나 버프 유닛 강화',
        description: '버프 키워드 아군 유닛 전체에 +1500을 준다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('BT06-052');
            p1.unitZones[1].unit = getCard('BT06-044'); // 키워드: 버프
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const base = p1.unitZones[1].unit?.power || 0;
            const current = getZonePower(engine, p1, 1);
            return [
                { pass: current === base + 1500, message: '버프 키워드 아군 +1500 적용' },
            ];
        },
    },
    {
        testId: 'BT06-053',
        name: '대마녀의 후예 셀리아 3코 이하 0코스트화',
        description: '엔트리 선택으로 스킬 존의 3코 이하 스킬을 턴 한정 0코스트로 만든다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-053')];
            p1.skillZone = [getCard('ST11-014'), getCard('ST10-015')];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
            if (confirm) engine.step(confirm);
            const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (a: any) => (engine.state.revealedCards[a.revealedIndex]?.cost || 0) <= 3);
            if (pick) engine.step(pick);
            const lowCostSkill = p1.skillZone.find((card: any) => card.id.startsWith('ST11-014')) as any;
            return [
                { pass: !!confirm, message: '옵션 확인 선택 가능' },
                { pass: !!pick, message: '3코 이하 스킬 선택 가능' },
                { pass: lowCostSkill?.turnCostOverride?.cost === 0, message: '턴 한정 0코스트 적용' },
            ];
        },
    },
    {
        testId: 'BT06-054',
        name: '풀 파티 세헤라자드 엔트리 트래시 스킬 발동',
        description: '엔트리로 덱 상단 3장을 트래시하고 스킬 1장 효과를 발동할 수 있다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-054')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST11-014')];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
            if (confirm) engine.step(confirm);
            const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (pick) engine.step(pick);
            return [
                { pass: !!confirm, message: '엔트리 옵션 확인 가능' },
                { pass: !!pick, message: '트래시된 스킬 선택 가능' },
                { pass: p1.hand.length >= 2, message: '선택 스킬 효과 발동' },
            ];
        },
    },
    {
        testId: 'BT06-054',
        name: '풀 파티 세헤라자드 패시브 드로우 트리거',
        description: '상대의 비트리거 효과 드로우에만 턴당 1회 반응하고, 턴이 바뀌면 다시 발동한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-054');
            p1.deck = [
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
            ];
            p2.deck = [
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
            ];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const base = p1.hand.length;

            engine.drawCard(1, 1, { reason: 'RULE' });
            const afterRule = p1.hand.length;

            engine.drawCard(1, 1, { reason: 'EFFECT', sourceActivation: ActivationCondition.DAMAGE_TRIGGER });
            const afterTriggerEffectDraw = p1.hand.length;

            engine.drawCard(1, 1, { reason: 'EFFECT', sourceActivation: ActivationCondition.ACTIVE });
            const afterFirstNonTriggerEffectDraw = p1.hand.length;

            engine.drawCard(1, 1, { reason: 'EFFECT', sourceActivation: ActivationCondition.ACTIVE });
            const afterSecondNonTriggerEffectDraw = p1.hand.length;

            let guard = 0;
            while (!(engine.currentPlayer.id === p2.id && engine.state.phase === Phase.MAIN) && guard < 24) {
                engine.nextPhase();
                guard += 1;
            }

            engine.drawCard(1, 1, { reason: 'EFFECT', sourceActivation: ActivationCondition.DAMAGE_TRIGGER });
            const afterNextTurnTriggerEffectDraw = p1.hand.length;

            engine.drawCard(1, 1, { reason: 'EFFECT', sourceActivation: ActivationCondition.ACTIVE });
            const afterNextTurnNonTriggerEffectDraw = p1.hand.length;

            return [
                { pass: afterRule === base, message: '룰 드로우에는 패시브 미발동' },
                { pass: afterTriggerEffectDraw === base, message: '트리거 효과 드로우에는 패시브 미발동' },
                { pass: afterFirstNonTriggerEffectDraw === base + 1, message: '비트리거 효과 드로우에 패시브 발동' },
                { pass: afterSecondNonTriggerEffectDraw === base + 1, message: '같은 턴 추가 드로우에는 재발동 안 함' },
                { pass: guard < 24, message: '다음 턴 진행 성공' },
                { pass: afterNextTurnTriggerEffectDraw === base + 1, message: '다음 턴 트리거 효과 드로우에는 여전히 미발동' },
                { pass: afterNextTurnNonTriggerEffectDraw === base + 2, message: '턴 리셋 후 비트리거 효과 드로우에 재발동' },
            ];
        },
    },
    {
        testId: 'BT06-055',
        name: 'DJ 베나카 엔트리 트래시 스킬 발동',
        description: '엔트리로 덱 상단 3장을 트래시하고 스킬 1장 효과를 발동할 수 있다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('BT06-055')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST11-014')];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
            if (confirm) engine.step(confirm);
            const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (pick) engine.step(pick);
            return [
                { pass: !!confirm, message: '엔트리 옵션 확인 가능' },
                { pass: !!pick, message: '트래시된 스킬 선택 가능' },
                { pass: p1.hand.length >= 2, message: '선택 스킬 효과 발동' },
            ];
        },
    },
    {
        testId: 'BT06-056',
        name: '타락한 날개 올리비에 2디펜더 선택 + 1대미지',
        description: '디펜더 2장을 선택해 1대미지를 주고 해당 2장을 턴 종료까지 공격 불가로 만든다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('BT06-056');
            p1.skillZone = [getCard('ST10-015')];
            p1.unitZones[1].unit = getCard('BT06-050');
            p1.unitZones[2].unit = getCard('BT06-048');
            p2.damage = [];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.activateEffect(0, 0);
            const pick1 = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p1.id && a.zoneIndex === 1);
            if (pick1) engine.step(pick1);
            const pick2 = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) => a.targetPlayerId === p1.id && a.zoneIndex === 2);
            if (pick2) engine.step(pick2);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);

            engine.state.phase = Phase.ATTACK;
            const canAttack1 = engine.getLegalActions(p1.id).some((a: any) => a.type === 'ATTACK' && a.attackerZoneIndex === 1);
            const canAttack2 = engine.getLegalActions(p1.id).some((a: any) => a.type === 'ATTACK' && a.attackerZoneIndex === 2);
            return [
                { pass: !!pick1 && !!pick2, message: '디펜더 2장 선택 가능' },
                { pass: !!confirm, message: '2장 선택 확정 가능' },
                { pass: p2.damage.length === 1, message: '상대 1대미지 적용' },
                { pass: !canAttack1 && !canAttack2, message: '선택 유닛 2장 공격 불가 적용' },
            ];
        },
    },
];

export const BT06Module: UnifiedTestModule = {
    packId: 'BT06',
    displayName: 'BT06 화염 부스터',
    tests,
};
