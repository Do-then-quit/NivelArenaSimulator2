import { Card } from '../../types';
import { RuleValidator } from '../../RuleValidator';
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
    {
        testId: 'BT03-035',
        name: '각성면 액티브: 코스트 트래시 후 상대 1디스카드',
        description: '상대 패 3장 이상일 때 코스트를 지불하면 상대가 패 1장을 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.levelZone = getCard('BT03-035');
            p1.levelZone.isAwakened = true;
            p1.hand = [getCard('ST01-002')];
            p2.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.activateEffect(0, 1, 'LEADER');
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCost) engine.step(payCost);
            const oppDiscard = findAction(engine, p2.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p2.id);
            if (oppDiscard) engine.step(oppDiscard);
            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!payCost, message: '코스트 지불 가능' },
                { pass: !!oppDiscard, message: '상대 패 선택 트래시 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-002')), message: '자신 코스트 트래시 반영' },
                { pass: p2.hand.length === 2, message: '상대 패 1장 감소' },
            ];
        },
    },
    {
        testId: 'BT03-036',
        name: '엑시트 수만큼 드로우',
        description: 'EXIT 해결 시 현재 필드의 [엑시트] 아군 유닛 수만큼 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT03-036');
            p1.unitZones[1].unit = getCard('BT03-038');
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '드로우 1 반영' },
            ];
        },
    },
    {
        testId: 'BT03-037',
        name: '엑시트 수 스케일 파워 디버프',
        description: 'EXIT 시 상대 유닛 1장에게 [엑시트] 수 ×2500 디버프를 적용한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT03-037');
            p1.unitZones[1].unit = getCard('BT03-038');
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p2, 0);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (pick) engine.step(pick);
            const after = p2.unitZones[0].unit ? zonePower(engine, p2, 0) : 0;
            return [
                { pass: !!pick, message: '상대 유닛 선택 가능' },
                { pass: p2.unitZones[0].unit === null || after === before - 2500, message: '파워 -2500 적용' },
            ];
        },
    },
    {
        testId: 'BT03-038',
        name: '엑시트 코스트 트래시 후 상대 1디스카드',
        description: 'EXIT 옵션 수락 시 패 1장 코스트로 상대 패 1장을 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT03-038');
            p1.hand = [getCard('ST01-002')];
            p2.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCost) engine.step(payCost);
            const oppDiscard = findAction(engine, p2.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p2.id);
            if (oppDiscard) engine.step(oppDiscard);
            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!payCost, message: '코스트 지불 가능' },
                { pass: !!oppDiscard, message: '상대 패 선택 가능' },
                { pass: p2.hand.length === 2, message: '상대 패 1장 감소' },
            ];
        },
    },
    {
        testId: 'BT03-039',
        name: '엑시트: 트래시 4코 유닛 회수',
        description: 'EXIT 시 자신의 트래시에서 4코 유닛 1장을 패로 회수한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.unitZones[0].unit = getCard('BT03-039');
            p1.trash = [getCard('BT03-024')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET');
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '트래시 대상 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT03-024')), message: '4코 유닛 회수 성공' },
            ];
        },
    },
    {
        testId: 'BT03-040',
        name: '비트리거 드로우 시 상대 패 4장 정리',
        description: '상대가 실제 드로우 스킬(효과) 발동으로 드로우하면 상대가 4장만 남기고 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p2.unitZones[0].unit = getCard('BT03-040');
            p1.hand = [
                getCard('BT06-065'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
            ];
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0); // BT06-065: 액티브로 1드로우
            const discardOptions = engine.getLegalActions(p1.id).filter((action: any) =>
                action.type === 'SELECT_HAND_TARGET' && action.targetPlayerId === p1.id
            );
            const discardPick1 = discardOptions[0];
            const discardPick2 = discardOptions[1];
            if (discardPick1) engine.step(discardPick1);
            if (discardPick2) engine.step(discardPick2);

            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);
            return [
                { pass: p1.skillZone.some((card: Card) => card.id.startsWith('BT06-065')), message: '현재 플레이어가 드로우 스킬 발동' },
                { pass: !!discardPick1 && !!discardPick2, message: '버릴 카드 선택 2회 가능' },
                { pass: !!confirm, message: '선택 확정 가능' },
                { pass: p1.hand.length === 4, message: '패 4장 유지 성공' },
            ];
        },
    },
    {
        testId: 'BT03-041',
        name: '상대 턴 엑시트 부활 +2500',
        description: '상대 턴 EXIT 옵션으로 손패 [엑시트]를 트래시하고 빈 존에 부활한 뒤 +2500을 얻는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.state.phase = Phase.ATTACK;
            // 현재 플레이어가 즉시 공격 버튼을 볼 수 있도록 공격 유닛을 배치한다.
            p1.unitZones[1].unit = getCard('ST01-011');
            // BT03-041은 상대 필드에 배치하여 "상대 턴" 조건을 충족시킨다.
            p2.unitZones[0].unit = getCard('BT03-041');
            p2.unitZones[2].unit = getCard('ST01-002');
            p2.hand = [getCard('BT03-038')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const attackAction = findAction(engine, p1.id, 'ATTACK', (action: any) => action.attackerZoneIndex === 1);
            engine.destroyUnit(p2, p2.unitZones[0], undefined, 'EFFECT');
            const confirm = findAction(engine, p2.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const pickHandExit = findAction(engine, p2.id, 'SELECT_REVEALED_TARGET');
            if (pickHandExit) engine.step(pickHandExit);
            const pickEmptyZone = findAction(engine, p2.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 1);
            if (pickEmptyZone) engine.step(pickEmptyZone);
            const afterPower = p2.unitZones[1].unit ? zonePower(engine, p2, 1) : 0;
            const revivedBasePower = p2.unitZones[1].unit?.power || 0;
            return [
                { pass: !!attackAction, message: 'setup 상태에서 현재 플레이어 공격 가능' },
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!pickHandExit, message: '손패 [엑시트] 선택 가능' },
                { pass: !!pickEmptyZone, message: '빈 유닛존 선택 가능' },
                { pass: p2.unitZones[1].unit?.id.startsWith('BT03-041') === true, message: 'BT03-041 부활 배치 성공' },
                { pass: p2.unitZones[1].unit ? afterPower === revivedBasePower + 2500 : false, message: '부활 후 +2500 적용' },
            ];
        },
    },
    {
        testId: 'BT03-042',
        name: '상대 손패 효과 트래시 턴 조건 +2500',
        description: '리더 효과로 상대 손패를 실제로 트래시하면 BT03-042의 파워+2500이 적용된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT03-042');
            p1.levelZone = getCard('BT03-035');
            if (p1.levelZone) p1.levelZone.isAwakened = true;
            p1.hand = [getCard('ST01-002')]; // BT03-035 코스트 지불용
            p2.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const before = zonePower(engine, p1, 0);
            engine.activateEffect(0, 1, 'LEADER');
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCost) engine.step(payCost);
            const oppDiscard = findAction(engine, p2.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p2.id);
            if (oppDiscard) engine.step(oppDiscard);
            const after = zonePower(engine, p1, 0);
            return [
                { pass: !!confirm, message: '리더 효과 옵션 수락 가능' },
                { pass: !!payCost, message: '리더 효과 코스트 지불 가능' },
                { pass: !!oppDiscard, message: '상대 손패 트래시 선택 가능' },
                { pass: after === before + 2500, message: '조건 충족 시 파워 +2500' },
            ];
        },
    },
    {
        testId: 'BT03-043',
        name: '엔트리 조우<=4에 디펜더 종결 부여',
        description: '조우 유닛이 4코 이하라면 해당 유닛에 디펜더 종결을 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-043')];
            p2.unitZones[0].unit = getCard('BT03-024');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            const granted = p2.unitZones[0].temporaryEffects.some((effect: any) =>
                effect.activation === 'DEFENDER' && effect.action?.type === 'TERMINATE_ATTACK'
            );
            return [
                { pass: granted, message: '디펜더 종결 부여 성공' },
            ];
        },
    },
    {
        testId: 'BT03-044',
        name: '엔트리 파괴 + 액티브 파워 증가',
        description: '상대 패 조건에서 엔트리로 조우를 트래시하고 액티브로 +3000을 얻는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-044')];
            p2.hand = [getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            const afterEntryDestroyed = p2.unitZones[0].unit === null;
            const beforePower = zonePower(engine, p1, 0);
            engine.activateEffect(0, 1);
            const afterPower = zonePower(engine, p1, 0);
            return [
                { pass: afterEntryDestroyed, message: '엔트리 조건 조우 트래시 성공' },
                { pass: afterPower === beforePower + 3000, message: '액티브 +3000 적용' },
            ];
        },
    },
    {
        testId: 'BT03-044-Trigger',
        name: '트리거: 자기 트래시 후 [엑시트] 유닛 회수',
        description: '대미지 트리거 발동 시 자기 자신을 트래시하고 트래시의 [엑시트] 유닛 1장을 회수한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT03-044')];
            p1.trash = [getCard('BT03-038')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            const pick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET');
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '회수 대상 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT03-038')), message: '[엑시트] 유닛 회수 성공' },
            ];
        },
    },
    {
        testId: 'BT03-045',
        name: '엔트리: 아군 1장 트래시 후 남은 아군에 귀환 EXIT 부여',
        description: '아군 1장을 트래시한 뒤 남은 모든 아군 유닛에게 귀환 EXIT 효과를 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-045')];
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('BT03-038');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 1);
            if (pick) engine.step(pick);
            const zone0Granted = p1.unitZones[0].temporaryEffects.some((effect: any) => effect.activation === 'EXIT' && effect.action?.type === 'RETURN_FROM_TRASH_AT_TURN_END');
            const zone2Granted = p1.unitZones[2].temporaryEffects.some((effect: any) => effect.activation === 'EXIT' && effect.action?.type === 'RETURN_FROM_TRASH_AT_TURN_END');
            return [
                { pass: !!pick, message: '트래시 대상 선택 가능' },
                { pass: p1.unitZones[1].unit === null, message: '선택 유닛 트래시 성공' },
                { pass: zone0Granted && zone2Granted, message: '남은 아군에게 귀환 EXIT 부여' },
            ];
        },
    },
    {
        testId: 'BT03-046',
        name: '2코 이하 아군 트래시 후 1드로우',
        description: '2코 이하 아군 유닛 1장을 트래시하고 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-046')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '대상 선택 가능' },
                { pass: p1.unitZones[0].unit === null, message: '2코 이하 유닛 트래시 성공' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '1드로우 반영' },
            ];
        },
    },
    {
        testId: 'BT03-047',
        name: '[엑시트] 아군 전원 +2000',
        description: '필드의 [엑시트]를 가진 아군 유닛 전부에 +2000을 적용한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-047')];
            p1.unitZones[0].unit = getCard('BT03-038');
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeExit = zonePower(engine, p1, 0);
            const beforeNormal = zonePower(engine, p1, 1);
            engine.playSkill(0);
            return [
                { pass: zonePower(engine, p1, 0) === beforeExit + 2000, message: '[엑시트] 유닛 +2000' },
                { pass: zonePower(engine, p1, 1) === beforeNormal, message: '비[엑시트] 유닛 변화 없음' },
            ];
        },
    },
    {
        testId: 'BT03-048',
        name: '메인: 4~6코 유닛 회수',
        description: '메인 효과로 트래시의 4~6코 유닛 1장을 패에 넣는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-048')];
            p1.trash = [getCard('BT03-024')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET');
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '회수 대상 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT03-024')), message: '4~6코 유닛 회수 성공' },
            ];
        },
    },
    {
        testId: 'BT03-048-Trigger',
        name: '트리거: 자기 트래시 + 조건부 상대 1디스카드',
        description: '상대 패 3장 이상일 때 트리거로 상대 패 1장을 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.deck = [getCard('BT03-048')];
            p2.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.dealDamage(p1, 1);
            const pick = findAction(engine, p2.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p2.id);
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '상대 패 트래시 대상 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT03-048')), message: '자기 자신 트래시' },
                { pass: p2.hand.length === 2, message: '상대 패 1장 감소' },
            ];
        },
    },
    {
        testId: 'BT03-049',
        name: '선택 유닛 파워만큼 다른 아군 버프 후 선택 유닛 트래시',
        description: '선택 유닛의 현재 유효 파워만큼 다른 아군 전원에 버프를 주고 선택 유닛을 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-049')];
            p1.unitZones[0].unit = getCard('BT03-024');
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[2].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before1 = zonePower(engine, p1, 1);
            const before2 = zonePower(engine, p1, 2);
            const selectedPower = zonePower(engine, p1, 0);
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '아군 유닛 선택 가능' },
                { pass: p1.unitZones[0].unit === null, message: '선택 유닛 트래시' },
                { pass: zonePower(engine, p1, 1) === before1 + selectedPower, message: '다른 아군1 버프 적용' },
                { pass: zonePower(engine, p1, 2) === before2 + selectedPower, message: '다른 아군2 버프 적용' },
            ];
        },
    },
    {
        testId: 'BT03-050',
        name: '아이템 EXIT 조건부 상대 저코스트 트래시',
        description: '상대 패 3장 이하일 때 EXIT로 상대 3코 이하 유닛 1장을 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-050')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p2.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playItem(0, 0);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '상대 3코 이하 유닛 선택 가능' },
                { pass: p2.unitZones[0].unit === null, message: '상대 유닛 트래시 성공' },
            ];
        },
    },
    {
        testId: 'BT03-051',
        name: '다른 아군 EXIT 효과 획득',
        description: '다른 아군 [엑시트] 유닛을 선택해 장착 유닛이 EXIT 효과를 획득한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-051')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[1].unit = getCard('BT03-036');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playItem(0, 0);
            engine.activateEffect(0, 0, 'ITEM', 0);
            const pickTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id && action.zoneIndex === 1
            );
            if (pickTarget) engine.step(pickTarget);
            const gained = p1.unitZones[0].temporaryEffects.some((effect: any) =>
                effect.activation === 'EXIT' && String(effect.description || '').includes('드로우')
            );
            return [
                { pass: !!pickTarget, message: '대상 [엑시트] 유닛 선택 가능' },
                { pass: gained, message: '장착 유닛 EXIT 효과 획득 성공' },
            ];
        },
    },
    {
        testId: 'BT03-052',
        name: '각성면 액티브: 3코 스킬 트래시 후 엔트리 효과 선택 발동',
        description: '스킬존 3코 스킬을 트래시하고 [엔트리] 유닛의 [엔트리] 효과를 선택해 발동한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.levelZone = getCard('BT03-052');
            p1.levelZone.isAwakened = true;
            p1.skillZone = [getCard('BT03-063')];
            p1.unitZones[0].unit = getCard('BT03-053');
            p1.deck = [getCard('ST01-002')];
            p2.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.activateEffect(0, 1, 'LEADER');
            const pickSkill = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (pickSkill) engine.step(pickSkill);
            const pickEntryUnit = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id && action.zoneIndex === 0
            );
            if (pickEntryUnit) engine.step(pickEntryUnit);
            const pickEntryEffect = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (pickEntryEffect) engine.step(pickEntryEffect);
            return [
                { pass: !!pickSkill, message: '3코 스킬 선택 가능' },
                { pass: !!pickEntryUnit, message: '[엔트리] 유닛 선택 가능' },
                { pass: !!pickEntryEffect, message: '[엔트리] 효과 선택 가능' },
                { pass: p1.skillZone.length === 0 && p1.trash.some((card: Card) => card.id.startsWith('BT03-063')), message: '선택 스킬 트래시 성공' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')) && p2.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '선택된 엔트리 효과(양측 드로우) 발동' },
            ];
        },
    },
    {
        testId: 'BT03-053',
        name: '엔트리: 자신 1드로우 후 상대 1드로우',
        description: '엔트리 해결 순서대로 자신과 상대가 각각 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-053')];
            p1.deck = [getCard('ST01-002')];
            p2.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '자신 1드로우' },
                { pass: p2.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '상대 1드로우' },
            ];
        },
    },
    {
        testId: 'BT03-054-SkillBranch',
        name: '엔트리 분기(스킬): 상단 트래시 스킬 선택 발동',
        description: '덱 맨 위 카드가 스킬일 때 옵션 수락 시 해당 스킬 효과를 발동한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-054')];
            p1.deck = [getCard('BT03-063')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            const pickSkill = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            const revealedSkillId = pickSkill && pickSkill.type === 'SELECT_REVEALED_TARGET'
                ? (engine.state.revealedCards[pickSkill.revealedIndex]?.id || '')
                : '';
            if (pickSkill) engine.step(pickSkill);
            const pickTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p2.id && action.zoneIndex === 0
            );
            if (pickTarget) engine.step(pickTarget);
            const locked = p2.unitZones[0].temporaryEffects.some((effect: any) =>
                typeof effect?.action?.params?.cannotAttackUntilTurnCount === 'number'
            );
            return [
                { pass: !!pickSkill, message: '트래시된 스킬 카드 선택 화면 노출' },
                { pass: revealedSkillId.startsWith('BT03-063'), message: '선택 화면에 트래시된 스킬 카드 정보 표시' },
                { pass: !!pickTarget, message: '발동된 스킬 대상 선택 가능' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT03-063')), message: '상단 스킬 트래시 처리' },
                { pass: locked, message: '트래시한 스킬 효과 발동 성공' },
            ];
        },
    },
    {
        testId: 'BT03-054-NonSkillBranch',
        name: '엔트리 분기(비스킬): 양측 1드로우',
        description: '덱 맨 위 카드가 스킬이 아니면 자신과 상대가 각각 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-054')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            p2.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '자신 1드로우' },
                { pass: p2.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '상대 1드로우' },
            ];
        },
    },
    {
        testId: 'BT03-055',
        name: '엔트리: 상단 3장 공개 후 스킬 1장 회수',
        description: '공개 카드 중 스킬 1장을 패에 넣고 나머지는 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-055')];
            p1.deck = [getCard('ST01-002'), getCard('BT03-063'), getCard('BT03-064')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            const pickSkill = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (pickSkill) engine.step(pickSkill);
            const gotSkill = p1.hand.some((card: Card) => card.id.startsWith('BT03-063') || card.id.startsWith('BT03-064'));
            return [
                { pass: !!pickSkill, message: '공개된 스킬 카드 선택 가능' },
                { pass: gotSkill, message: '스킬 1장 회수 성공' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-002')), message: '나머지 카드 트래시' },
            ];
        },
    },
    {
        testId: 'BT03-056',
        name: '엔트리: 조우 공격 불가 부여',
        description: '조우 유닛에게 상대 턴 종료까지 공격 불가를 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-056')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            const locked = p2.unitZones[0].temporaryEffects.some((effect: any) =>
                typeof effect?.action?.params?.cannotAttackUntilTurnCount === 'number'
            );
            return [
                { pass: locked, message: '조우 유닛 공격 불가 부여 성공' },
            ];
        },
    },
    {
        testId: 'BT03-057',
        name: '액티브:메인 - 동일 코스트 미트래시 시 히트 대미지',
        description: '자신 유닛 1장 트래시 후 상대가 동일 코스트를 트래시하지 않으면 히트만큼 대미지를 준다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            p1.unitZones[0].unit = getCard('BT03-057');
            p1.hand = [getCard('BT03-060')];
            p2.hand = [getCard('BT03-053')];
            p2.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('BT03-053')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const beforeDamage = p2.damage.length;
            engine.activateEffect(0, 0);
            const selectDiscard = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) =>
                action.targetPlayerId === p1.id
            );
            if (selectDiscard) engine.step(selectDiscard);
            const trashedUnit = p1.trash.find((card: Card) => card.id.startsWith('BT03-060'));
            const expectedDamage = Math.max(0, trashedUnit?.hit || 0);
            return [
                { pass: !!selectDiscard, message: '자신 유닛 트래시 선택 가능' },
                { pass: p2.hand.length === 2, message: '상대 1드로우 반영' },
                { pass: !!trashedUnit, message: '자신 유닛 트래시 성공' },
                { pass: p2.damage.length === beforeDamage + expectedDamage, message: `동일 코스트 미트래시 시 히트 대미지(${expectedDamage})` },
            ];
        },
    },
    {
        testId: 'BT03-057-Trigger',
        name: '트리거: 자기 트래시 후 1드로우',
        description: '대미지 트리거 시 BT03-057을 트래시하고 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT03-057')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT03-057')), message: '자기 트래시 성공' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '1드로우 성공' },
            ];
        },
    },
    {
        testId: 'BT03-058',
        name: '상대 공격 선언마다 1드로우',
        description: '상대 유닛의 공격 선언 시마다 BT03-058 컨트롤러가 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.state.phase = Phase.ATTACK;
            p1.unitZones[0].unit = getCard('ST01-011'); // 공격 선언 주체(상대 입장)
            p2.unitZones[0].unit = getCard('BT03-058'); // 공격 반응 드로우 컨트롤러
            p2.deck = [getCard('ST01-002')];
        },
        verify: (engine) => {
            const p2 = engine.opponentPlayer;
            const before = p2.hand.length;
            engine.attack(0);
            return [
                { pass: p2.hand.length === before + 1, message: '상대 공격 선언 반응 드로우 1' },
            ];
        },
    },
    {
        testId: 'BT03-059',
        name: '엔트리 코스트 후 글로벌 5코 이상 배치 제한',
        description: '옵션 수락 및 코스트 지불 시 상대 턴 종료까지 상대 5코 이상 유닛 배치를 모든 레인에서 제한한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-059'), getCard('ST01-002'), getCard('ST01-002')];
            p2.hand = [getCard('BT03-060'), getCard('BT03-053')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const payCostA = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCostA) engine.step(payCostA);
            const payCostB = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCostB) engine.step(payCostB);

            const lockAppliedAllLanes = [0, 1, 2].every((zoneIndex: number) =>
                RuleValidator.canPlayUnit(engine as any, p2 as any, 0, zoneIndex).valid === false
            );
            const lowCostPlayable = RuleValidator.canPlayUnit(engine as any, p2 as any, 1, 1).valid;
            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!payCostA && !!payCostB, message: '패 2장 코스트 지불 가능' },
                { pass: lockAppliedAllLanes, message: '모든 레인에서 5코 이상 배치 제한' },
                { pass: lowCostPlayable, message: '저코스트 유닛 배치 가능 유지' },
            ];
        },
    },
    {
        testId: 'BT03-060',
        name: '엔트리: 자기 공격 불가 + 상대 패차 대미지',
        description: '엔트리 시 자기 공격 불가를 얻고 max(0, 상대패-5)만큼 상대에게 대미지를 준다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-060')];
            p2.hand = [
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
            ];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const beforeDamage = p2.damage.length;
            engine.playUnit(0, 0);
            engine.state.phase = Phase.ATTACK;
            const canAttack = RuleValidator.canAttack(engine as any, p1 as any, 0).valid;
            return [
                { pass: p2.damage.length === beforeDamage + 2, message: '상대 패차(7-5=2) 대미지 적용' },
                { pass: canAttack === false, message: '이 턴 공격 불가 적용' },
            ];
        },
    },
    {
        testId: 'BT03-061',
        name: '트리거: 패 복귀',
        description: '대미지 트리거 시 BT03-061이 패로 복귀한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('BT03-061')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT03-061')), message: '패 복귀 성공' },
            ];
        },
    },
    {
        testId: 'BT03-062',
        name: '엔트리 코스트 후 스킬존 스킬 발동(존 유지)',
        description: '옵션 수락 후 패 1장 코스트를 지불하면 스킬존 스킬 1장을 선택해 발동하고 스킬은 스킬존에 남는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-062'), getCard('ST01-002')];
            p1.skillZone = [getCard('BT03-063')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCost) engine.step(payCost);
            const pickSkill = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (pickSkill) engine.step(pickSkill);
            const pickTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p2.id && action.zoneIndex === 0
            );
            if (pickTarget) engine.step(pickTarget);
            const locked = p2.unitZones[0].temporaryEffects.some((effect: any) =>
                typeof effect?.action?.params?.cannotAttackUntilTurnCount === 'number'
            );
            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!payCost, message: '패 1장 코스트 지불 가능' },
                { pass: !!pickSkill, message: '스킬존 스킬 선택 가능' },
                { pass: !!pickTarget, message: '발동 스킬 대상 선택 가능' },
                { pass: p1.skillZone.some((card: Card) => card.id.startsWith('BT03-063')), message: '선택 스킬 스킬존 유지' },
                { pass: locked, message: '선택 스킬 효과 발동 성공' },
            ];
        },
    },
    {
        testId: 'BT03-063',
        name: '상대 유닛 1장 상대 턴 종료까지 공격 불가',
        description: '대상 상대 유닛 1장에 공격 불가를 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-063')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            const pickTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p2.id && action.zoneIndex === 0
            );
            if (pickTarget) engine.step(pickTarget);
            const locked = p2.unitZones[0].temporaryEffects.some((effect: any) =>
                typeof effect?.action?.params?.cannotAttackUntilTurnCount === 'number'
            );
            return [
                { pass: !!pickTarget, message: '상대 유닛 대상 선택 가능' },
                { pass: locked, message: '공격 불가 부여 성공' },
            ];
        },
    },
    {
        testId: 'BT03-064',
        name: '디펜더 히트 수만큼 정확히 트래시 시 조우 패복귀',
        description: '선택 디펜더 유닛의 현재 히트 수와 같은 장수를 트래시하면 조우 유닛을 주인 패로 되돌린다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-064'), getCard('ST01-002'), getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('BT03-061');
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            const pickDefender = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id && action.zoneIndex === 0
            );
            if (pickDefender) engine.step(pickDefender);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const handTargets = engine.getLegalActions(p1.id).filter((action: any) =>
                action.type === 'SELECT_HAND_TARGET' && action.targetPlayerId === p1.id
            );
            if (handTargets[0]) engine.step(handTargets[0]);
            if (handTargets[1]) engine.step(handTargets[1]);
            const confirmDiscard = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirmDiscard) engine.step(confirmDiscard);
            return [
                { pass: !!pickDefender, message: '[디펜더] 아군 선택 가능' },
                { pass: !!confirm, message: '트래시 코스트 지불 옵션 수락 가능' },
                { pass: !!confirmDiscard, message: '정확 장수 트래시 확정 가능' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 패복귀로 필드 이탈' },
                { pass: p2.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: '조우 유닛 주인 패 복귀 성공' },
            ];
        },
    },
    {
        testId: 'BT03-064-Trigger',
        name: '트리거: 자기 트래시 후 1드로우',
        description: '대미지 트리거 시 BT03-064를 트래시하고 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('BT03-064')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT03-064')), message: '자기 트래시 성공' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '1드로우 성공' },
            ];
        },
    },
    {
        testId: 'BT03-065',
        name: '엔트리 수만큼 드로우 + 상대 ENTRY 잠금',
        description: '필드의 [엔트리] 아군 수만큼 드로우하고 상대의 [엔트리] 발동을 상대 턴 종료까지 잠근다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-065')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('BT03-053');
            p1.unitZones[1].unit = getCard('BT03-055');
            p1.unitZones[2].unit = getCard('ST01-002');
            p2.hand = [getCard('BT03-053')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playSkill(0);
            const lockUntil = (p2.lockedActivationsUntilTurnCount as any)?.ENTRY;
            return [
                { pass: p1.hand.filter((card: Card) => card.id.startsWith('ST01-002')).length >= 2, message: '[엔트리] 유닛 수(2)만큼 드로우' },
                { pass: typeof lockUntil === 'number' && lockUntil >= engine.state.turnCount + 1, message: '상대 ENTRY 발동 잠금 적용' },
            ];
        },
    },
    {
        testId: 'BT03-066',
        name: '패 6장까지 트래시 후 트래시 수만큼 대미지',
        description: '패가 7장 이상이면 6장이 되도록 트래시하고 트래시한 장수만큼 상대에게 대미지를 준다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [
                getCard('BT03-066'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
            ];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const beforeDamage = p2.damage.length;
            engine.playSkill(0);
            const selectDiscard = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) =>
                action.targetPlayerId === p1.id
            );
            if (selectDiscard) engine.step(selectDiscard);
            return [
                { pass: !!selectDiscard, message: '트래시할 패 선택 가능' },
                { pass: p1.hand.length === 6, message: '패 6장 정리 완료' },
                { pass: p2.damage.length === beforeDamage + 1, message: '트래시 수만큼 대미지 적용(1)' },
            ];
        },
    },
    {
        testId: 'BT03-067',
        name: '아이템 EXIT: 코스트 후 장착 유닛 부활',
        description: '아이템 EXIT 시 코스트를 지불하면 트래시된 장착 유닛을 빈 아군 유닛존에 부활 배치한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-067'), getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playItem(0, 0);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const payCost = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (payCost) engine.step(payCost);
            const pickZone = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id && action.zoneIndex === 1
            ) || findAction(engine, p1.id, 'SELECT_ZONE_TARGET');
            if (pickZone) engine.step(pickZone);
            const revived = p1.unitZones.some((zone: any) => zone.unit?.id.startsWith('ST01-011'));
            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!payCost, message: '패 1장 코스트 지불 가능' },
                { pass: !!pickZone, message: '부활 배치 빈 존 선택 가능' },
                { pass: revived, message: '장착 유닛 부활 배치 성공' },
            ];
        },
    },
    {
        testId: 'BT03-068',
        name: '장착 조건(디펜더) + 파워+3000',
        description: '[디펜더] 유닛에 장착 가능하며 장착 유닛 파워가 +3000 된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-068')];
            p1.unitZones[0].unit = getCard('BT03-056');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforePower = zonePower(engine, p1, 0);
            engine.playItem(0, 0);
            const afterPower = zonePower(engine, p1, 0);
            return [
                { pass: afterPower === beforePower + 3000, message: '장착 유닛 파워 +3000 적용' },
            ];
        },
    },
    {
        testId: 'BT03-069',
        name: '각성면: 상단 3장 트래시 후 ITEM 포함 시 1드로우',
        description: '덱 상단 3장 트래시에 아이템이 포함되면 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.levelZone = getCard('BT03-069');
            if (p1.levelZone) p1.levelZone.isAwakened = true;
            p1.deck = [getCard('ST01-002'), getCard('BT03-083'), getCard('ST01-002'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeHand = p1.hand.length;
            engine.activateEffect(0, 1, 'LEADER');
            return [
                { pass: p1.trash.length >= 3, message: '덱 상단 3장 트래시' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT03-083')), message: '아이템 트래시 포함' },
                { pass: p1.hand.length === beforeHand + 1, message: '조건부 1드로우' },
            ];
        },
    },
    {
        testId: 'BT03-070',
        name: '암드: 아이템 장착 시 파워+2000',
        description: '장착 아이템이 있으면 BT03-070의 파워가 +2000 된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-067')];
            p1.unitZones[0].unit = getCard('BT03-070');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const before = zonePower(engine, p1, 0);
            engine.playItem(0, 0);
            const after = zonePower(engine, p1, 0);
            return [
                { pass: after === before + 2000, message: '아이템 장착 조건 파워+2000 적용' },
            ];
        },
    },
    {
        testId: 'BT03-071',
        name: '엔트리: 장착 유닛 존재 시 상단3 공개 ITEM 1회수',
        description: '장착 유닛이 있을 때 상단 3장 공개 후 아이템 1장을 패로 넣고 나머지를 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.leaderLevel = 20;
            p1.hand = [getCard('BT03-071')];
            p1.unitZones[1].unit = getCard('ST01-002');
            p1.unitZones[1].items = [getCard('BT03-067')];
            p1.deck = [getCard('ST01-002'), getCard('BT03-084'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            const pickItem = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (pickItem) engine.step(pickItem);
            const recovered = p1.hand.some((card: Card) => card.id.startsWith('BT03-084'));
            return [
                { pass: !!pickItem || recovered, message: '공개 아이템 선택(또는 자동 선택) 처리 가능' },
                { pass: recovered, message: '아이템 패 회수 성공' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-002')), message: '나머지 카드 트래시' },
            ];
        },
    },
    {
        testId: 'BT03-072',
        name: '엑시트: 트래시의 2코 아이템 회수',
        description: '엑시트 발동 시 트래시의 2코스트 아이템 1장을 패에 넣는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.unitZones[0].unit = getCard('BT03-072');
            p1.trash = [getCard('BT03-083')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) =>
                p1.trash[action.trashIndex]?.id?.startsWith('BT03-083')
            );
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '회수할 2코 아이템 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT03-083')), message: '2코 아이템 패 회수 성공' },
            ];
        },
    },
    {
        testId: 'BT03-073',
        name: '암드 액티브: 장착수x3 트래시 후 ITEM 수만큼 히트+',
        description: '장착 아이템 수에 비례해 덱을 트래시하고, 트래시된 아이템 수만큼 히트가 증가한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.unitZones[0].unit = getCard('BT03-073');
            p1.unitZones[0].items = [getCard('BT03-067')];
            p1.deck = [getCard('ST01-002'), getCard('BT03-083'), getCard('BT03-084')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const beforeHit = zoneHit(engine, p1, 0);
            engine.activateEffect(0, 0);
            const afterHit = zoneHit(engine, p1, 0);
            return [
                { pass: p1.trash.length >= 3, message: '장착수x3 덱 트래시' },
                { pass: afterHit === beforeHit + 2, message: '트래시된 아이템 수만큼 히트+ 적용' },
            ];
        },
    },
    {
        testId: 'BT03-073-Trigger',
        name: '트리거: 자기 트래시 후 2드로우-2디스카드',
        description: '대미지 트리거 발동 시 자기 트래시, 2드로우 후 드로우한 카드 2장을 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('BT03-073')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            const first = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p1.id);
            if (first) engine.step(first);
            const second = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) =>
                action.targetPlayerId === p1.id && action.handIndex !== (first as any)?.handIndex
            ) || findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p1.id);
            if (second) engine.step(second);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);
            return [
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT03-073')), message: '트리거 자기 트래시' },
                { pass: !!first && !!second, message: '패에서 2장 선택 가능' },
                { pass: !!confirm || engine.state.interactionMode === 'NORMAL', message: '2장 선택 후 확정 진행 가능' },
                { pass: p1.hand.length === 5, message: '2드로우 후 패 2장 트래시 처리(패 장수 유지)' },
            ];
        },
    },
    {
        testId: 'BT03-074',
        name: '암드: 장착수 파워 보정 + 조건부 EXIT 트래시',
        description: '장착 아이템 수만큼 파워가 증가하며, 2장 이상이면 EXIT 선택 트래시를 수행한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.unitZones[0].unit = getCard('BT03-074');
            p1.unitZones[0].items = [getCard('ST01-016'), getCard('ST01-017')];
            p2.unitZones[0].unit = getCard('ST01-011');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            const basePower = p1.unitZones[0].unit?.power || 0;
            const buffed = zonePower(engine, p1, 0);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p2.id && action.zoneIndex === 0
            );
            if (pick) engine.step(pick);
            return [
                { pass: buffed === basePower + 2000, message: '장착수(2) 파워+2000' },
                { pass: !!confirm || p2.unitZones[0].unit === null, message: '조건부 EXIT 옵션(또는 즉시 해결) 처리 가능' },
                { pass: !!pick || p2.unitZones[0].unit === null, message: '아이템 미장착 유닛 선택 가능' },
                { pass: p2.unitZones[0].unit === null, message: '조건부 EXIT 트래시 성공' },
            ];
        },
    },
    {
        testId: 'BT03-075',
        name: '엔트리: 트래시 아이템 덱바닥 후 코스트합 비교 조우 트래시',
        description: '트래시 아이템을 덱 하단으로 보낸 뒤 코스트 합이 조우 유닛 코스트 이상이면 조우 유닛을 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-075')];
            p1.trash = [getCard('BT03-083'), getCard('BT03-084')];
            p2.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const pick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET');
            if (pick) engine.step(pick);
            const finalize = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (finalize) engine.step(finalize);
            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!pick, message: '덱 하단으로 보낼 아이템 선택 가능' },
                { pass: !!finalize || p2.unitZones[0].unit === null, message: '선택 확정(또는 즉시 해결) 가능' },
                { pass: p2.unitZones[0].unit === null, message: '코스트합 비교로 조우 유닛 트래시' },
            ];
        },
    },
    {
        testId: 'BT03-076',
        name: '엑시트: 대미지 유닛 회수 후 자기 대미지 이동',
        description: '대미지존 유닛을 패로 회수하고 이 카드를 대미지존으로 이동한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.unitZones[0].unit = getCard('BT03-076');
            p1.damage = [getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const pick = findAction(engine, p1.id, 'SELECT_DAMAGE_TARGET');
            if (pick) engine.step(pick);
            return [
                { pass: !!pick, message: '대미지 유닛 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: '대미지 유닛 패 회수' },
                { pass: p1.damage.some((card: Card) => card.id.startsWith('BT03-076')), message: '자기 카드 대미지존 이동' },
            ];
        },
    },
    {
        testId: 'BT03-077',
        name: '패시브 장착 제한 + 액티브 장착 후 장착조건 재검증',
        description: '일반 장착 제한이 적용되며, 액티브 처리 후 장착조건 미충족 아이템은 트래시되고 남은 장착 아이템은 0코스트가 된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('ST01-016')];
            p1.unitZones[0].unit = getCard('BT03-077');
            p1.trash = [getCard('BT03-068'), getCard('BT03-084')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playItem(0, 0);
            const blockedExternalEquip = p1.unitZones[0].items.length === 0;

            engine.activateEffect(0, 1);
            const firstPick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) => action.revealedIndex === 0)
                || findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (firstPick) engine.step(firstPick);
            const secondPick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) => action.revealedIndex === 1)
                || findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) => action.revealedIndex !== (firstPick as any)?.revealedIndex);
            if (secondPick) engine.step(secondPick);
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);

            const equippedIds = p1.unitZones[0].items.map((item: any) => item.id);
            const unmetConditionTrashed = p1.trash.some((card: Card) => card.id.startsWith('BT03-068'));
            const zeroed = p1.unitZones[0].items.length === 1 && p1.unitZones[0].items.every((item: any) =>
                item.turnCostOverride?.cost === 0 && item.turnCostOverride?.turnCount === engine.state.turnCount
            );
            return [
                { pass: blockedExternalEquip, message: '외부 방법 장착 제한 동작' },
                { pass: !!confirm, message: '트래시 아이템 선택 확정 가능' },
                { pass: equippedIds.some((id: string) => id.startsWith('BT03-084')), message: '장착조건 충족 아이템 유지' },
                { pass: unmetConditionTrashed, message: '장착조건 미충족 아이템 처리 후 트래시' },
                { pass: zeroed, message: '장착 아이템 0코스트화 적용' },
            ];
        },
    },
    {
        testId: 'BT03-078',
        name: '파괴 대체: 트래시 ITEM 바닥 배치 후 유닛/아이템 패복귀',
        description: '전투/효과 트래시 시 대체로 트래시 아이템을 덱 바닥으로 보내고 유닛과 장착 아이템을 패로 되돌린다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.unitZones[0].unit = getCard('BT03-078');
            p1.unitZones[0].items = [getCard('BT03-067')];
            p1.trash = [getCard('BT03-083')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const pickTrashItem = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) =>
                p1.trash[action.trashIndex]?.type === 'ITEM'
            );
            if (pickTrashItem) engine.step(pickTrashItem);
            return [
                { pass: !!confirm, message: '파괴 대체 옵션 수락 가능' },
                { pass: !!pickTrashItem, message: '덱 바닥으로 보낼 트래시 아이템 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT03-078')), message: '유닛 패 복귀 성공' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('BT03-067')), message: '장착 아이템 패 복귀 성공' },
            ];
        },
    },
    {
        testId: 'BT03-079',
        name: '엔트리: 정확히 8아이템 지불 후 총코스트<=8 상대 유닛 트래시 + 드로우',
        description: '손/트래시 아이템 정확히 8장을 덱바닥으로 보내고 총코스트 8 이하 상대 유닛을 트래시한 수만큼 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.leaderLevel = 20;
            p1.hand = [getCard('BT03-079'), getCard('BT03-067'), getCard('BT03-083'), getCard('BT03-084'), getCard('BT03-068')];
            p1.trash = [getCard('BT03-067'), getCard('BT03-083'), getCard('BT03-084'), getCard('BT03-068')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('BT03-073'); // cost 3
            p2.unitZones[1].unit = getCard('BT03-075'); // cost 4
            p2.unitZones[2].unit = getCard('ST01-011'); // cost 2
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playUnit(0, 0);

            const selectedIndexes = new Set<number>();
            for (let i = 0; i < 8; i++) {
                const pick = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (action: any) => !selectedIndexes.has(action.revealedIndex));
                if (!pick) break;
                selectedIndexes.add((pick as any).revealedIndex);
                engine.step(pick);
            }
            const confirmCost = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirmCost) engine.step(confirmCost);

            const pickZone0 = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (pickZone0) engine.step(pickZone0);
            const pickZone1 = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 1);
            if (pickZone1) engine.step(pickZone1);
            const confirmDestroy = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirmDestroy) engine.step(confirmDestroy);

            const destroyedCount = [0, 1, 2].filter(idx => p2.unitZones[idx].unit === null).length;
            const drawnCount = p1.hand.filter((card: Card) => card.id.startsWith('ST01-002')).length;
            return [
                { pass: !!confirmCost, message: '정확히 8장 선택 확정 가능' },
                { pass: !!confirmDestroy, message: '상대 유닛 선택 확정 가능' },
                { pass: destroyedCount >= 2, message: '총코스트 8 이하 선택 유닛 트래시' },
                { pass: drawnCount >= destroyedCount, message: '트래시 수만큼 드로우 적용' },
            ];
        },
    },
    {
        testId: 'BT03-080',
        name: '부여 패시브: 장착 이벤트당 1드로우',
        description: '부여된 유닛에 아이템을 장착할 때마다 이벤트당 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.leaderLevel = 20;
            p1.hand = [getCard('BT03-080'), getCard('BT03-067'), getCard('BT03-067')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            const pickTarget = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id && action.zoneIndex === 0
            );
            if (pickTarget) engine.step(pickTarget);

            const firstItemIndex = p1.hand.findIndex((card: Card) => card.id.startsWith('BT03-067'));
            if (firstItemIndex >= 0) engine.playItem(firstItemIndex, 0);
            const secondItemIndex = p1.hand.findIndex((card: Card) => card.id.startsWith('BT03-067'));
            if (secondItemIndex >= 0) engine.playItem(secondItemIndex, 0);
            const drawnCount = p1.hand.filter((card: Card) => card.id.startsWith('ST01-002')).length;
            return [
                { pass: !!pickTarget, message: '부여 대상 유닛 선택 가능' },
                { pass: drawnCount === 2, message: '장착 이벤트 2회에 대해 1드로우씩 적용' },
            ];
        },
    },
    {
        testId: 'BT03-081',
        name: '메인: 상단5 트래시 후 트래시 유닛 1회수',
        description: '덱 상단 5장을 트래시한 뒤 트래시 유닛 카드 1장을 패에 넣는다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-081')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            const pickUnit = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (action: any) =>
                p1.trash[action.trashIndex]?.type === 'UNIT'
            );
            if (pickUnit) engine.step(pickUnit);
            return [
                { pass: !!pickUnit, message: '트래시 유닛 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-011')), message: '트래시 유닛 패 회수 성공' },
            ];
        },
    },
    {
        testId: 'BT03-082',
        name: '선택 장착 아이템 효과를 다른 아군 전체에 복사',
        description: '선택 유닛의 장착 아이템 효과를 다른 모든 자신 유닛에게 턴 종료까지 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.leaderLevel = 20;
            p1.hand = [getCard('BT03-082')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('BT03-067')];
            p1.unitZones[1].unit = getCard('ST01-002');
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            const pickUnit = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) =>
                action.targetPlayerId === p1.id && action.zoneIndex === 0
            );
            if (pickUnit) engine.step(pickUnit);
            const pickItem = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (pickItem) engine.step(pickItem);
            const copied = p1.unitZones[1].temporaryEffects.some((effect: any) => effect.activation === 'EXIT');
            return [
                { pass: !!pickUnit, message: '원본 유닛 선택 가능' },
                { pass: !!pickItem, message: '복사할 장착 아이템 선택 가능' },
                { pass: copied, message: '다른 아군 유닛에 아이템 효과 복사 성공' },
            ];
        },
    },
    {
        testId: 'BT03-083',
        name: '파괴 대체: 고글 1장 트래시 후 유닛/아이템 패복귀',
        description: '전투/효과 트래시 시 장착한 고글 1장을 트래시하면 유닛과 남은 장착 아이템을 패로 되돌린다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.leaderLevel = 20;
            p1.hand = [getCard('BT03-083')];
            p1.unitZones[0].unit = getCard('ST01-002');
            p1.unitZones[0].items = [getCard('ST01-016')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playItem(0, 0);
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'BATTLE');
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const pickGoggle = findAction(engine, p1.id, 'SELECT_ITEM_TARGET', (action: any) =>
                action.targetPlayerId === p1.id
                && action.zoneIndex === 0
                && p1.unitZones[0].items[action.itemIndex]?.id?.startsWith('BT03-083')
            );
            if (pickGoggle) engine.step(pickGoggle);
            return [
                { pass: !!confirm, message: '파괴 대체 옵션 수락 가능' },
                { pass: !!pickGoggle, message: '트래시할 고글 선택 가능' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '유닛 패 복귀 성공' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-016')), message: '남은 장착 아이템 패 복귀 성공' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('BT03-083')), message: '선택한 고글 트래시' },
            ];
        },
    },
    {
        testId: 'BT03-084',
        name: '액티브:메인 - 상단3 트래시 ITEM 포함 시 OPP_TURN_END +3000',
        description: '상단 3장 트래시에 아이템이 있으면 장착 유닛 파워가 상대 턴 종료까지 +3000 된다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-084')];
            p1.unitZones[0].unit = getCard('ST01-011');
            p1.deck = [getCard('ST01-002'), getCard('BT03-083'), getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playItem(0, 0);
            const before = zonePower(engine, p1, 0);
            engine.activateEffect(0, 1, 'ITEM', 0);
            const after = zonePower(engine, p1, 0);
            return [
                { pass: after === before + 3000, message: '조건부 OPP_TURN_END 파워 +3000 적용' },
            ];
        },
    },
    {
        testId: 'BT03-085',
        name: '어태커 옵션: 상대 미트래시 시 조우 유닛 트래시',
        description: '자신 패 1장 트래시 후 상대가 히트 수만큼 패를 트래시하지 않으면 조우 유닛을 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            setHighSize(engine);
            p1.hand = [getCard('BT03-085'), getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('BT03-005');
            p2.unitZones[0].unit = getCard('ST01-011');
            p2.hand = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            const p2 = engine.opponentPlayer;
            engine.playItem(0, 0);
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (action: any) => action.confirm === true);
            if (confirm) engine.step(confirm);
            const pickSelf = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => action.targetPlayerId === p1.id);
            if (pickSelf) engine.step(pickSelf);
            const oppSkip = findAction(engine, p2.id, 'CONFIRM_TARGETS');
            if (oppSkip) engine.step(oppSkip);
            return [
                { pass: !!confirm, message: '옵션 수락 가능' },
                { pass: !!pickSelf, message: '자신 패 1장 트래시 선택 가능' },
                { pass: !!oppSkip, message: '상대 패 트래시 미선택 확정 가능' },
                { pass: p2.unitZones[0].unit === null, message: '상대 미트래시 시 조우 유닛 트래시' },
            ];
        },
    },
];

export const BT03Module: UnifiedTestModule = {
    packId: 'BT03',
    displayName: 'BT03 화염 부스터',
    tests,
};
