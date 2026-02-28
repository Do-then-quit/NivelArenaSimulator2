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

function setHighSize(engine: any): void {
    engine.state.players.forEach((player: any) => {
        player.leaderLevel = 10;
    });
}

const tests: UnifiedTestCase[] = [
    {
        testId: 'BT03-001-Awaken',
        name: '리더 각성 (레벨 5)',
        description: '리더 레벨 5 이상에서 BT03-001이 각성한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.levelZone = getCard('BT03-001');
            p1.levelZone.isAwakened = false;
            p1.leaderLevel = 4;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel >= 5, message: `리더 레벨 증가 (${p1.leaderLevel})` },
                { pass: p1.levelZone?.isAwakened === true, message: 'BT03-001 각성 성공' },
            ];
        },
    },
    {
        testId: 'BT03-001',
        name: '각성면 액티브:메인 -2000',
        description: '스킬존 조건 충족 시 상대 유닛 파워 -2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.levelZone = getCard('BT03-001');
            p1.levelZone.isAwakened = true;
            p1.skillZone = [getCard('ST10-015')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p2, 0);
            engine.activateEffect(0, 1, 'LEADER');
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p2.id && action.zoneIndex === 0
            );
            if (pick) engine.step(pick);
            const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
            return [
                { pass: !!pick, message: '상대 유닛 선택 가능' },
                { pass: p2.unitZones[0].unit === null || after === before - 2000, message: '파워 -2000 적용' },
            ];
        },
    },
    {
        testId: 'BT03-002',
        name: '어태커 조우 -1500',
        description: '공격 시 조우 유닛 파워가 전투 종료까지 -1500 된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT03-002');
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p2, 0);
            engine.attack(0);
            const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
            return [
                { pass: p2.unitZones[0].unit === null || after === before - 1500, message: '조우 -1500 적용' },
            ];
        },
    },
    {
        testId: 'BT03-003',
        name: '어태커 조우 -2000',
        description: '공격 시 조우 유닛 파워가 전투 종료까지 -2000 된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT03-003');
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p2, 0);
            engine.attack(0);
            const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
            return [
                { pass: p2.unitZones[0].unit === null || after === before - 2000, message: '조우 -2000 적용' },
            ];
        },
    },
    {
        testId: 'BT03-004',
        name: '엔트리 관통 강화 +1000',
        description: '어태커+관통 유닛을 선택하면 관통[2] 부여 및 파워+1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-004')];
            p1.unitZones[1].unit = getCard('BT01-004');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 1);
            engine.playUnit(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id && action.zoneIndex === 1
            );
            if (pick) engine.step(pick);
            const after = p1.unitZones[1].unit ? zonePower(engine, p1, 1) : 0;
            const grantedPenetration2 = p1.unitZones[1].temporaryEffects.some((effect: any) =>
                effect.activation === 'ATTACKER' && String(effect.description || '').includes('관통[2]')
            );
            return [
                { pass: !!pick, message: '대상 유닛 선택 가능' },
                { pass: after === before + 1000, message: '파워 +1000 적용' },
                { pass: grantedPenetration2, message: '관통[2] 부여됨' },
            ];
        },
    },
    {
        testId: 'BT03-005',
        name: '어태커 +3000',
        description: '공격 시 파워+3000을 얻는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT03-005');
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 0);
            engine.attack(0);
            const after = p1.unitZones[0].unit ? zonePower(engine, p1, 0) : 0;
            return [
                { pass: after === before + 3000, message: '파워 +3000 적용' },
            ];
        },
    },
    {
        testId: 'BT03-006',
        name: '엔트리 스킬존 스킬 트래시 후 1드로우',
        description: '옵션 수락 시 스킬존 스킬 1장을 트래시하고 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-006')];
            p1.skillZone = [getCard('ST10-015')];
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const selectSkill = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (selectSkill) engine.step(selectSkill);
            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!selectSkill, message: '스킬 선택 가능' },
                { pass: p1.skillZone.length === 0, message: '스킬존 카드 트래시' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '1드로우 반영' },
            ];
        },
    },
    {
        testId: 'BT03-007',
        name: '패 3장 이하 조건 회수 + 자기 +2000',
        description: '공격 시 트래시 스킬 회수 후 자기 파워+2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT03-007');
            p1.hand = [];
            p1.trash = [getCard('BT03-012')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 0);
            engine.attack(0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const selectTrash = findAction(engine, p1.id, 'SELECT_TRASH_TARGET');
            if (selectTrash) engine.step(selectTrash);
            const after = p1.unitZones[0].unit ? zonePower(engine, p1, 0) : 0;
            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!selectTrash, message: '트래시 스킬 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT03-012')), message: '스킬 회수 성공' },
                { pass: after === before + 2000, message: '자기 파워 +2000 적용' },
            ];
        },
    },
    {
        testId: 'BT03-008',
        name: '액티브:메인 스킬 트래시 후 관통[1] 부여',
        description: '2코 이하 스킬을 트래시하면 자기에게 어태커 관통[1]을 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT03-008');
            p1.skillZone = [getCard('BT03-012')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.activateEffect(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const selectSkill = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (selectSkill) engine.step(selectSkill);
            const granted = p1.unitZones[0].temporaryEffects.some((effect: any) =>
                effect.activation === 'ATTACKER' && String(effect.description || '').includes('관통[1]')
            );
            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!selectSkill, message: '스킬 선택 가능' },
                { pass: p1.skillZone.length === 0, message: '스킬 트래시 성공' },
                { pass: granted, message: '관통[1] 부여 성공' },
            ];
        },
    },
    {
        testId: 'BT03-009',
        name: '어태커 패 임의수 트래시 스케일 디버프',
        description: '트래시한 카드 수만큼 조우 유닛 파워를 -2500씩 감소시킨다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT03-009');
            p1.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-011');
            if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 12000;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p2, 0);
            engine.attack(0);

            const handTargets = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_HAND_TARGET');
            if (handTargets[0]) engine.step(handTargets[0]);
            if (handTargets[1]) engine.step(handTargets[1]);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);

            const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
            return [
                { pass: handTargets.length >= 2, message: '패 대상 2장 이상 선택 가능' },
                { pass: !!confirm, message: '선택 확정 가능' },
                { pass: p1.hand.length === 1, message: '패 2장 트래시 반영' },
                { pass: p2.unitZones[0].unit === null || after === before - 5000, message: '스케일 디버프(-5000) 적용' },
            ];
        },
    },
    {
        testId: 'BT03-009-Trigger',
        name: '트리거: 자기 트래시 + 상대 -5000',
        description: '대미지 트리거 발동 시 자기 자신 트래시 후 상대 유닛 1장 -5000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('BT03-009')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p2, 0);
            engine.dealDamage(p1, 1);
            const selectTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (selectTarget) engine.step(selectTarget);
            const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
            return [
                { pass: !!selectTarget, message: '상대 유닛 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT03-009')), message: '자기 자신 트래시' },
                { pass: p2.unitZones[0].unit === null || after === before - 5000, message: '상대 -5000 적용' },
            ];
        },
    },
    {
        testId: 'BT03-010',
        name: '엔트리 조우 -4000 후 트래시 시 1드로우',
        description: '엔트리 효과로 조우를 트래시하면 카드를 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-010')];
            p1.deck = [getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-002');
            if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 3500;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            return [
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 효과 트래시' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '1드로우 반영' },
            ];
        },
    },
    {
        testId: 'BT03-011',
        name: '액티브:메인 스킬 트래시 후 저코스트 트래시 회수',
        description: '스킬존 스킬을 트래시하고 그 카드보다 저코스트 카드를 트래시에서 회수한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT03-011');
            p1.skillZone = [getCard('ST10-016')];
            p1.trash = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.activateEffect(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);

            const selectSkill = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (selectSkill) engine.step(selectSkill);

            const selectTrash = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (selectTrash) engine.step(selectTrash);

            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!selectSkill, message: '스킬존 카드 선택 가능' },
                { pass: !!selectTrash, message: '저코스트 트래시 카드 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '트래시 카드 회수 성공' },
            ];
        },
    },
    {
        testId: 'BT03-011-Trigger',
        name: '트리거: 패 복귀',
        description: '대미지 트리거 시 BT03-011이 패로 복귀한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT03-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT03-011')), message: '패 복귀 성공' },
                { pass: p1.damage.every((card: Card) => !card.id.startsWith('BT03-011')), message: '대미지존에서 제거됨' },
            ];
        },
    },
    {
        testId: 'BT03-012',
        name: '패 2장 유지 + 패 3장까지 드로우',
        description: '메인 효과로 패를 2장까지 유지하고 나머지 트래시 후 3장까지 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-012'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);

            const handTargets = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_HAND_TARGET');
            if (handTargets[0]) engine.step(handTargets[0]);
            if (handTargets[1]) engine.step(handTargets[1]);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);

            return [
                { pass: handTargets.length >= 2, message: '유지할 패 2장 선택 가능' },
                { pass: !!confirm, message: '선택 확정 가능' },
                { pass: p1.hand.length === 3, message: `최종 패 3장 (${p1.hand.length})` },
            ];
        },
    },
    {
        testId: 'BT03-012-Trigger',
        name: '트리거: 자기 트래시 + 2코 이하 유닛 회수',
        description: '대미지 트리거 시 자기 트래시 후 2코 이하 유닛을 회수한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT03-012')];
            p1.trash = [getCard('ST01-002'), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            const legalTrash = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_TRASH_TARGET');
            const low = legalTrash.find((action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST01-002'));
            const high = legalTrash.find((action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST01-011'));
            if (low) engine.step(low);
            return [
                { pass: !!low, message: '2코 이하 유닛 선택 가능' },
                { pass: !high, message: '고코스트 유닛 선택 불가' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT03-012')), message: '자기 트래시 처리' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '2코 이하 유닛 회수 성공' },
            ];
        },
    },
    {
        testId: 'BT03-013',
        name: '패 장수 차이 스케일 디버프(-1000)',
        description: '패 장수 차이만큼 상대 유닛 파워를 감소시킨다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-013')];
            p2.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            const before = zonePower(engine, p2, 0);
            const selectTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (selectTarget) engine.step(selectTarget);
            const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
            return [
                { pass: !!selectTarget, message: '상대 유닛 선택 가능' },
                { pass: p2.unitZones[0].unit === null || after === before - 3000, message: '차이 3장 기준 -3000 적용' },
            ];
        },
    },
    {
        testId: 'BT03-014',
        name: '4코 이하 어태커에 듀얼리스트 부여',
        description: '조건을 만족하는 아군 유닛 1장에 듀얼리스트를 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-014')];
            p1.unitZones[0].unit = getCard('BT03-002');
            p1.unitZones[1].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            const selectTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
            if (selectTarget) engine.step(selectTarget);
            const granted = p1.unitZones[0].temporaryEffects.some((effect: any) => String(effect.description || '').includes('듀얼리스트'));
            return [
                { pass: !!selectTarget, message: '조건 만족 유닛 선택 가능' },
                { pass: granted, message: '듀얼리스트 부여 성공' },
            ];
        },
    },
    {
        testId: 'BT03-015',
        name: '패 유닛 트래시 후 해당 파워만큼 디버프',
        description: '옵션 수락 후 패 유닛 1장을 트래시하면 대상 유닛 파워를 그 파워만큼 감소시킨다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-015'), getCard('ST01-011')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p2, 0);
            engine.playSkill(0);

            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const selectTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (selectTarget) engine.step(selectTarget);
            const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCost) engine.step(payCost);

            const discardedUnit = p1.trash.find((card: Card) => card.id.startsWith('ST01-011'));
            const expectedDebuff = discardedUnit?.power || 0;
            const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!selectTarget, message: '대상 유닛 선택 가능' },
                { pass: !!payCost, message: '패 유닛 코스트 지불 가능' },
                {
                    pass: p2.unitZones[0].unit === null || after === before - expectedDebuff,
                    message: `버린 유닛 파워만큼 감소 (${expectedDebuff})`,
                },
            ];
        },
    },
    {
        testId: 'BT03-016',
        name: '아이템 후속 선택: 장착본 트래시 후 2드로우',
        description: '첫 효과로 조우를 트래시한 경우 후속 선택으로 장착본을 트래시하고 2장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-016')];
            p1.unitZones[0].unit = getCard('BT03-005');
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-002');
            if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 1000;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playItem(0, 0);
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);

            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const selectItem = findAction(engine, p1.id, 'SELECT_ITEM_TARGET', (action: any) =>
                action.targetPlayerId === p1.id && action.zoneIndex === 0
            );
            if (selectItem) engine.step(selectItem);

            return [
                { pass: !!confirm, message: '후속 효과 옵션 수락 가능' },
                { pass: !!selectItem, message: '장착 아이템 선택 가능' },
                { pass: p1.unitZones[0].items.length === 0, message: '장착 아이템 트래시 완료' },
                { pass: p1.hand.length >= 2, message: '2드로우 적용' },
            ];
        },
    },
    {
        testId: 'BT03-017',
        name: '아이템 액티브:메인 코스트 지불 후 파워 3000 설정',
        description: '패 1장 코스트를 지불하면 상대 유닛 파워를 3000으로 설정한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-017'), getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('BT03-005');
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playItem(0, 0);
            engine.activateEffect(0, 1, 'ITEM', 0);

            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);

            const selectTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (selectTarget) engine.step(selectTarget);

            const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCost) engine.step(payCost);

            const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!selectTarget, message: '대상 선택 가능' },
                { pass: !!payCost, message: '패 코스트 지불 가능' },
                { pass: p2.unitZones[0].unit !== null && after === 3000, message: `파워 3000 설정 (${after})` },
            ];
        },
    },
    {
        testId: 'BT03-018-Awaken',
        name: '리더 각성 (레벨 5)',
        description: 'BT03-018 리더는 레벨 5 이상에서 각성한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.levelZone = getCard('BT03-018');
            p1.levelZone.isAwakened = false;
            p1.leaderLevel = 4;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel >= 5, message: `리더 레벨 증가 (${p1.leaderLevel})` },
                { pass: p1.levelZone?.isAwakened === true, message: 'BT03-018 각성 성공' },
            ];
        },
    },
    {
        testId: 'BT03-018',
        name: '각성면 전선구축 버프 +1000',
        description: '각성면에서 전선구축 조건을 만족하면 모든 아군 유닛 파워+1000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.levelZone = getCard('BT03-018');
            p1.levelZone.isAwakened = true;
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base0 = p1.unitZones[0].unit?.power || 0;
            const base1 = p1.unitZones[1].unit?.power || 0;
            const base2 = p1.unitZones[2].unit?.power || 0;
            return [
                { pass: zonePower(engine, p1, 0) === base0 + 1000, message: '0번 유닛 +1000' },
                { pass: zonePower(engine, p1, 1) === base1 + 1000, message: '1번 유닛 +1000' },
                { pass: zonePower(engine, p1, 2) === base2 + 1000, message: '2번 유닛 +1000' },
            ];
        },
    },
    {
        testId: 'BT03-019',
        name: '레벨링크 6에서 자기 +2000',
        description: '리더 레벨 6 이상이면 자기 파워+2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 6;
            p1.unitZones[0].unit = getCard('BT03-019');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base = p1.unitZones[0].unit?.power || 0;
            return [
                { pass: zonePower(engine, p1, 0) === base + 2000, message: '파워 +2000 적용' },
            ];
        },
    },
    {
        testId: 'BT03-020',
        name: '레벨링크+전선구축 스탯 상승',
        description: '레벨 6 + 전선구축 조건에서 자기 파워+3000, 히트+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 6;
            p1.unitZones[0].unit = getCard('BT03-020');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = p1.unitZones[0].unit?.power || 0;
            const baseHit = p1.unitZones[0].unit?.hit || 0;
            return [
                { pass: zonePower(engine, p1, 0) === basePower + 3000, message: '파워 +3000' },
                { pass: zoneHit(engine, p1, 0) === baseHit + 1, message: '히트 +1' },
            ];
        },
    },
    {
        testId: 'BT03-020-Trigger',
        name: '트리거: 자기 트래시 + 3코 이하 상대 파괴',
        description: '대미지 트리거로 자기 자신을 트래시하고 3코 이하 상대 유닛 1장을 파괴한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('BT03-020')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.dealDamage(p1, 1);
            const selectTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p2.id && action.zoneIndex === 0
            );
            if (selectTarget) engine.step(selectTarget);
            return [
                { pass: !!selectTarget, message: '상대 3코 이하 유닛 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT03-020')), message: '자기 자신 트래시' },
                { pass: p2.unitZones[0].unit === null, message: '상대 유닛 파괴 성공' },
            ];
        },
    },
    {
        testId: 'BT03-021',
        name: '전선구축 엔트리 레벨+1',
        description: '전선구축 조건에서 엔트리 시 리더 레벨+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.leaderLevel = 6;
            p1.hand = [getCard('BT03-021')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeLevel = p1.leaderLevel;
            engine.playUnit(0, 2);
            return [
                { pass: p1.leaderLevel === beforeLevel + 1, message: '리더 레벨 +1 적용' },
            ];
        },
    },
    {
        testId: 'BT03-022',
        name: '다른 3코 이하 아군만 +2000',
        description: '레벨링크+전선구축 조건에서 다른 3코 이하 아군에게만 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 6;
            p1.unitZones[0].unit = getCard('BT03-022');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const selfBase = p1.unitZones[0].unit?.power || 0;
            const lowBase = p1.unitZones[1].unit?.power || 0;
            const highBase = p1.unitZones[2].unit?.power || 0;
            return [
                { pass: zonePower(engine, p1, 0) === selfBase, message: '자기 자신 제외' },
                { pass: zonePower(engine, p1, 1) === lowBase + 2000, message: '3코 이하 아군 +2000' },
                { pass: zonePower(engine, p1, 2) === highBase, message: '3코 초과 아군 버프 제외' },
            ];
        },
    },
    {
        testId: 'BT03-023',
        name: '상단 2장 공개, 4코 이하 유닛 1장 회수',
        description: '공개한 카드 중 4코 이하 유닛 1장을 패에 넣고 나머지는 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-023')];
            p1.deck = [getCard('BT03-027'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '공개 카드 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '4코 이하 유닛 회수 성공' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT03-027')), message: '나머지 카드 트래시' },
            ];
        },
    },
    {
        testId: 'BT03-024',
        name: '다른 아군 유효 히트 합 비례 파워 증가',
        description: '다른 아군 유닛의 현재 유효 히트 총합만큼 파워가 증가한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT03-024');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('ST01-002');
            p1.unitZones[1].buffs.push({
                id: 'BT03_024_HIT_BUFF',
                type: 'HIT',
                value: 2,
                duration: 'TURN_END',
            } as any);
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const base = p1.unitZones[0].unit?.power || 0;
            const hitTotal = zoneHit(engine, p1, 1) + zoneHit(engine, p1, 2);
            return [
                { pass: zonePower(engine, p1, 0) === base + hitTotal * 1000, message: `유효 히트 합(${hitTotal}) x1000 반영` },
            ];
        },
    },
    {
        testId: 'BT03-025',
        name: '엔트리 분기(레벨<10이면 +1)',
        description: '리더 레벨이 10 미만이면 엔트리에서 드로우 대신 레벨+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.leaderLevel = 9;
            p1.hand = [getCard('BT03-025')];
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            return [
                { pass: p1.leaderLevel === 10, message: '리더 레벨 +1 분기 적용' },
                { pass: !p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '드로우 분기 미발동' },
            ];
        },
    },
    {
        testId: 'BT03-026',
        name: '바닐라 카드 무효과',
        description: 'BT03-026은 플레이 시 추가 상호작용 없이 배치된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-026')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            return [
                { pass: !!p1.unitZones[0].unit && p1.unitZones[0].unit.id.startsWith('BT03-026'), message: '유닛 배치 성공' },
                { pass: engine.state.interactionMode === 'NORMAL', message: '추가 선택 상호작용 없음' },
            ];
        },
    },
    {
        testId: 'BT03-027',
        name: '파워차 3500 이상일 때 관통[1] 부여',
        description: '액티브:메인 사용 시 조건 충족이면 자기에게 관통[1]을 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT03-027');
            p2.unitZones[0].unit = getCard('ST01-011');
            if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 3000;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.activateEffect(0, 0);
            const granted = p1.unitZones[0].temporaryEffects.some((effect: any) =>
                effect.activation === 'ATTACKER' && String(effect.description || '').includes('관통[1]')
            );
            return [
                { pass: granted, message: '관통[1] 부여 성공' },
            ];
        },
    },
    {
        testId: 'BT03-028',
        name: '트리거: 패 복귀',
        description: '대미지 트리거 시 BT03-028은 패로 복귀한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT03-028')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT03-028')), message: '패 복귀 성공' },
            ];
        },
    },
    {
        testId: 'BT03-029',
        name: '5코 이상 아군 1장 히트+1',
        description: '5코스트 이상 아군 유닛 1장을 골라 히트+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-029')];
            p1.unitZones[0].unit = getCard('BT03-025');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeHit = zoneHit(engine, p1, 0);
            engine.playSkill(0);
            const picks = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_ZONE_TARGET');
            const pick = picks.find((action: any) => action.zoneIndex === 0);
            if (pick) engine.step(pick);
            return [
                { pass: picks.length === 1, message: '5코 이상 대상만 선택 가능' },
                { pass: !!pick, message: '대상 선택 가능' },
                { pass: zoneHit(engine, p1, 0) === beforeHit + 1, message: '히트 +1 적용' },
            ];
        },
    },
    {
        testId: 'BT03-030',
        name: '3코 이하 전원 히트+1 + 3장 이상이면 1드로우',
        description: '3코 이하 아군 3장 구성에서 전원 히트+1 후 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-030')];
            p1.deck = [getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('BT03-019');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('BT03-020');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeHit0 = zoneHit(engine, p1, 0);
            const beforeHit1 = zoneHit(engine, p1, 1);
            const beforeHit2 = zoneHit(engine, p1, 2);
            engine.playSkill(0);
            return [
                { pass: zoneHit(engine, p1, 0) === beforeHit0 + 1, message: '0번 유닛 히트 +1' },
                { pass: zoneHit(engine, p1, 1) === beforeHit1 + 1, message: '1번 유닛 히트 +1' },
                { pass: zoneHit(engine, p1, 2) === beforeHit2 + 1, message: '2번 유닛 히트 +1' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '3장 이상 조건 드로우 1 반영' },
            ];
        },
    },
    {
        testId: 'BT03-031',
        name: '선택 유닛 파워가 높으면 조우 파괴',
        description: '선택한 3코 이하 아군 유닛 파워가 조우보다 높을 때 조우를 파괴한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-031')];
            p1.unitZones[0].unit = getCard('ST01-002');
            if (p1.unitZones[0].unit) p1.unitZones[0].unit.power = 6000;
            p2.unitZones[0].unit = getCard('ST01-002');
            if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 5000;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id && action.zoneIndex === 0
            );
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '아군 유닛 선택 가능' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 파괴 성공' },
            ];
        },
    },
    {
        testId: 'BT03-032',
        name: '3코 이하 전원 +5000 + 조건부 히트+1',
        description: '대상이 3장 이상이면 전원 파워+5000과 히트+1을 적용한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-032')];
            p1.unitZones[0].unit = getCard('BT03-019');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('BT03-020');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower0 = zonePower(engine, p1, 0);
            const basePower1 = zonePower(engine, p1, 1);
            const basePower2 = zonePower(engine, p1, 2);
            const baseHit0 = zoneHit(engine, p1, 0);
            const baseHit1 = zoneHit(engine, p1, 1);
            const baseHit2 = zoneHit(engine, p1, 2);
            engine.playSkill(0);
            return [
                { pass: zonePower(engine, p1, 0) === basePower0 + 5000, message: '0번 유닛 파워 +5000' },
                { pass: zonePower(engine, p1, 1) === basePower1 + 5000, message: '1번 유닛 파워 +5000' },
                { pass: zonePower(engine, p1, 2) === basePower2 + 5000, message: '2번 유닛 파워 +5000' },
                { pass: zoneHit(engine, p1, 0) === baseHit0 + 1, message: '0번 유닛 히트 +1' },
                { pass: zoneHit(engine, p1, 1) === baseHit1 + 1, message: '1번 유닛 히트 +1' },
                { pass: zoneHit(engine, p1, 2) === baseHit2 + 1, message: '2번 유닛 히트 +1' },
            ];
        },
    },
    {
        testId: 'BT03-032-Trigger',
        name: '트리거: 자기 트래시 + 리더 레벨+1',
        description: '대미지 트리거 시 자기 자신을 트래시하고 리더 레벨+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.deck = [getCard('BT03-032')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT03-032')), message: '자기 자신 트래시' },
                { pass: p1.leaderLevel === 6, message: '리더 레벨 +1' },
            ];
        },
    },
    {
        testId: 'BT03-033',
        name: '사이즈 +1 누적',
        description: 'BT03-033 장착 수만큼 자신의 사이즈가 누적 증가한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-033'), getCard('BT03-033')];
            p1.unitZones[0].unit = getCard('BT03-025');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = engine.getPlayerSize(p1);
            engine.playItem(0, 0);
            const afterOne = engine.getPlayerSize(p1);
            engine.playItem(0, 0);
            const afterTwo = engine.getPlayerSize(p1);
            return [
                { pass: afterOne === before + 1, message: '첫 장착 후 사이즈 +1' },
                { pass: afterTwo === before + 2, message: '두 번째 장착 후 누적 +2' },
            ];
        },
    },
    {
        testId: 'BT03-034',
        name: '장착 조건 및 장착 유닛 스탯 증가',
        description: '3코 이하 유닛에 장착 시 파워+2500, 히트+1.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-034')];
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const basePower = zonePower(engine, p1, 0);
            const baseHit = zoneHit(engine, p1, 0);
            engine.playItem(0, 0);
            return [
                { pass: zonePower(engine, p1, 0) === basePower + 2500, message: '파워 +2500 적용' },
                { pass: zoneHit(engine, p1, 0) === baseHit + 1, message: '히트 +1 적용' },
            ];
        },
    },
];

export const BT03Module: UnifiedTestModule = {
    packId: 'BT03',
    displayName: 'BT03 화염 부스터',
    tests,
};
