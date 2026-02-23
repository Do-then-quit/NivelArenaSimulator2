import { Card } from '../../types';
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
            p2.unitZones[0].unit = getCard('ST01-011');
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
            p2.unitZones[0].unit = getCard('ST01-011');
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
];

export const BT06Module: UnifiedTestModule = {
    packId: 'BT06',
    displayName: 'BT06 화염 부스터',
    tests,
};
