/**
 * SB01 Unified Tests
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

function prepare(engine: any, phase: Phase = Phase.MAIN, turnPlayerIndex = 0) {
    engine.state.players[0].leaderLevel = 10;
    engine.state.players[1].leaderLevel = 10;
    engine.state.turnPlayerIndex = turnPlayerIndex;
    engine.state.phase = phase;
    engine.state.winner = null;
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

function getZonePower(engine: any, player: any, zoneIndex: number): number {
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return 0;
    return engine.getUnitPower(zone, player);
}

function getZoneHit(engine: any, player: any, zoneIndex: number): number {
    const zone = player.unitZones[zoneIndex];
    if (!zone?.unit) return 0;
    return engine.getUnitHit(zone, player);
}

function advanceUntil(engine: any, predicate: () => boolean, maxSteps = 30): boolean {
    let guard = 0;
    while (!predicate() && guard < maxSteps) {
        engine.nextPhase();
        guard += 1;
    }
    return predicate();
}

const tests: UnifiedTestCase[] = [
    {
        testId: 'SB01-001',
        name: '엔트리 스킬 트래시 비례 디버프',
        description: '엔트리로 스킬을 트래시한 뒤 상대 유닛 파워를 코스트 비례로 낮춘다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('SB01-001')];
            p1.skillZone = [getCard('SB01-004')]; // 2코스트 스킬
            p2.unitZones[0].unit = getCard('ST11-006');
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = getZonePower(engine, p2, 0);

            engine.playUnit(0, 0);

            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
            if (confirm) engine.step(confirm);
            const pickSkill = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET');
            if (pickSkill) engine.step(pickSkill);
            const pickOpp = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) =>
                a.targetPlayerId === p2.id && a.zoneIndex === 0
            );
            if (pickOpp) engine.step(pickOpp);

            const trashedSkill = p1.trash.find((card: any) => card.id.startsWith('SB01-004'));
            const expected = Math.max(0, before - Math.max(0, Number(trashedSkill?.cost || 0)) * 2000);
            const after = getZonePower(engine, p2, 0);

            return [
                { pass: !!confirm, message: '엔트리 선택 발동 가능' },
                { pass: !!pickSkill, message: '스킬존 카드 선택 가능' },
                { pass: !!pickOpp, message: '상대 유닛 선택 가능' },
                { pass: after === expected, message: `코스트 비례 디버프 적용 (${before} -> ${after})` },
            ];
        },
    },
    {
        testId: 'SB01-002',
        name: '액티브 메인 트래시 코스트 비례 버프',
        description: '패 1장 코스트 지불 후 코스트 이하 어태커 유닛이 파워/히트 버프를 받는다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('SB01-002');
            p1.unitZones[1].unit = getCard('ST10-005');
            p1.unitZones[2].unit = getCard('ST10-005');
            p1.hand = [getCard('SB01-003')]; // 5코스트
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const beforePower = getZonePower(engine, p1, 1);
            const beforeHit = getZoneHit(engine, p1, 1);

            engine.activateEffect(0, 1);
            const pay = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (pay) engine.step(pay);

            const afterPower = getZonePower(engine, p1, 1);
            const afterHit = getZoneHit(engine, p1, 1);

            return [
                { pass: !!pay, message: '코스트 지불 가능' },
                { pass: afterPower === beforePower + 5000, message: '코스트 x1000 파워 버프 적용' },
                { pass: afterHit === beforeHit + 1, message: '히트 +1 적용' },
            ];
        },
    },
    {
        testId: 'SB01-003',
        name: '온킬 선택 패트래시 대미지',
        description: '전투 처치 후 패를 선택 트래시하고 트래시 수만큼 대미지를 준다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.ATTACK, 0);
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('SB01-003');
            p1.hand = [getCard('ST01-002'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST11-006');
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforeDamage = p2.damage.length;

            engine.attack(0);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (a: any) => a.shouldBlock && a.blockerZoneIndex === 0);
            if (block) engine.step(block);

            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
            if (confirm) engine.step(confirm);
            const pick = findAction(engine, p1.id, 'SELECT_HAND_TARGET');
            if (pick) engine.step(pick);

            return [
                { pass: !!block, message: '조우 방어 진행' },
                { pass: !!pick, message: '패 트래시 선택 가능' },
                { pass: p2.damage.length === beforeDamage + 1, message: '선택 트래시 수만큼 대미지 적용' },
                { pass: p1.trash.some((card: any) => card.id.startsWith('ST01-002')), message: '패 트래시 반영' },
            ];
        },
    },
    {
        testId: 'SB01-004',
        name: '액티브 드로우 + 상대 효과드로우 징벌',
        description: '자신 어태커 수만큼 드로우하고 상대가 효과로 드로우하면 1대미지를 준다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('SB01-004')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('SB01-002');
            p1.unitZones[1].unit = getCard('ST10-005');

            p2.hand = [getCard('ST11-006')];
            p2.deck = [getCard('ST01-002'), getCard('ST01-002')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforeHand = p1.hand.length;
            const beforeDamage = p2.damage.length;

            engine.playSkill(0);
            const handAfterSkill = p1.hand.length;

            engine.state.turnPlayerIndex = 1;
            engine.state.phase = Phase.MAIN;
            engine.playUnit(0, 0); // ST11-006 entry draw

            return [
                { pass: handAfterSkill === beforeHand - 1 + 2, message: '어태커 수만큼 드로우' },
                { pass: p2.damage.length === beforeDamage + 1, message: '상대 효과 드로우 1회당 1대미지' },
            ];
        },
    },
    {
        testId: 'SB01-005',
        name: '액티브 드로우/표식/조건부 자가트래시',
        description: '1드로우 후 상대 유닛 표식 부여, 어태커 2장 이상이면 스킬을 트래시할 수 있다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('SB01-005')];
            p1.deck = [getCard('ST01-002')];
            p1.unitZones[1].unit = getCard('ST10-005');
            p1.unitZones[2].unit = getCard('SB01-002');
            p2.unitZones[0].unit = getCard('ST11-006');
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforeHand = p1.hand.length;

            engine.playSkill(0);
            const selectOpp = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) =>
                a.targetPlayerId === p2.id && a.zoneIndex === 0
            );
            if (selectOpp) engine.step(selectOpp);

            const confirmTrashSelf = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
            if (confirmTrashSelf) engine.step(confirmTrashSelf);

            const marked = p2.unitZones[0].temporaryEffects.some(
                (effect: any) => effect?.action?.params?.mode === 'SB01_005_EXIT_MOVE_SKILL_FROM_TRASH_TO_DAMAGE',
            );
            engine.destroyUnit(p2, p2.unitZones[0], undefined, 'BATTLE');

            return [
                { pass: !!selectOpp, message: '표식 대상 선택 가능' },
                { pass: !!confirmTrashSelf, message: '조건부 자가 트래시 선택 가능' },
                { pass: marked, message: '상대 유닛 EXIT 표식 부여' },
                { pass: p1.hand.length === beforeHand, message: '드로우 1장 반영' },
                { pass: p2.damage.some((card: any) => card.id.startsWith('ST11-006')), message: '표식 유닛 EXIT 시 해당 유닛이 대미지 존으로 이동' },
            ];
        },
    },
    {
        testId: 'SB01-006',
        name: '액티브 어택 돌파 부여',
        description: '조건 충족 시 패 코스트를 지불하고 3코 이하 아군에게 어태커 돌파를 부여한다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.ATTACK, 0);
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('SB01-006');
            p1.unitZones[1].unit = getCard('ST11-006');
            p1.hand = [getCard('ST01-002')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 0);
            const pay = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (pay) engine.step(pay);

            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) =>
                a.targetPlayerId === p1.id && a.zoneIndex === 1
            );
            if (pick) engine.step(pick);

            const granted = p1.unitZones[1].temporaryEffects.some(
                (effect: any) => effect.activation === 'ATTACKER' && effect.action?.type === 'BREAKTHROUGH',
            );

            return [
                { pass: !!pay, message: '패 코스트 지불 가능' },
                { pass: !!pick, message: '대상 아군 선택 가능' },
                { pass: granted, message: '어태커 돌파 부여 성공' },
            ];
        },
    },
    {
        testId: 'SB01-007',
        name: '엑시트 공개 후 패트래시 배치',
        description: '엑시트로 공개한 카드를 배치할지 선택하고, 배치 시 패 트래시 후 빈 라인을 지정한다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('SB01-007');
            p1.hand = [getCard('ST01-002'), getCard('SB01-004')];
            p1.deck = [getCard('ST11-006')];
            p1.unitZones[2].unit = getCard('ST11-006'); // 빈 라인 선택 검증용
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

            const chooseDeploy = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
            if (chooseDeploy) engine.step(chooseDeploy);

            const chooseRevealedCard = findAction(engine, p1.id, 'SELECT_REVEALED_TARGET', (a: any) =>
                engine.state.revealedCards[a.revealedIndex]?.id === 'ST11-006'
            );
            if (chooseRevealedCard) engine.step(chooseRevealedCard);

            const confirmRevealChoice = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirmRevealChoice) engine.step(confirmRevealChoice);

            const discard = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (a: any) =>
                p1.hand[a.handIndex]?.id.startsWith('ST01-002')
            );
            if (discard) engine.step(discard);

            const zoneChoices = engine
                .getLegalActions(p1.id)
                .filter((action: any) => action.type === 'SELECT_ZONE_TARGET') as any[];
            const selfZoneChoices = zoneChoices.filter((action: any) => action.targetPlayerId === p1.id);
            const onlyEmptyZones = selfZoneChoices.length > 0 && selfZoneChoices.every(action => !p1.unitZones[action.zoneIndex].unit);
            const chooseLane1 = selfZoneChoices.find((action: any) => action.zoneIndex === 1);
            if (chooseLane1) engine.step(chooseLane1);

            const deployedZoneIndex = p1.unitZones.findIndex((zone: any) =>
                zone.unit?.id.startsWith('ST11-006') && zone !== p1.unitZones[2]
            );
            const deployed = p1.unitZones[1].unit;
            const zeroCost =
                !!deployed &&
                (deployed as any).turnCostOverride?.cost === 0 &&
                (deployed as any).turnCostOverride?.turnCount === engine.state.turnCount;

            return [
                { pass: !!chooseDeploy, message: '공개 카드 배치 선택 가능' },
                { pass: !!chooseRevealedCard, message: 'REVEALED CARDS에서 공개 카드 선택 가능' },
                { pass: !!confirmRevealChoice, message: '카드 선택 후 확인으로 배치 진행 가능' },
                { pass: !!discard, message: '트래시할 패 선택 가능' },
                { pass: onlyEmptyZones, message: '빈 라인만 선택지로 노출' },
                { pass: !!chooseLane1, message: '원하는 빈 라인 지정 가능' },
                { pass: deployedZoneIndex === 1, message: '지정한 라인에 공개 유닛 배치 성공' },
                { pass: p1.trash.some((card: any) => card.id.startsWith('ST01-002')), message: '패 1장 트래시 코스트 처리' },
                { pass: zeroCost, message: '턴 한정 0코스트 부여' },
            ];
        },
    },
    {
        testId: 'SB01-008',
        name: '전선구축 버프 및 부여 엑시트 재배치',
        description: '전선구축 +2000과 3코 이하 아군의 효과 트래시 시 부여 엑시트 재배치를 함께 검증한다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('SB01-008');
            p1.unitZones[1].unit = getCard('ST11-006');
            p1.unitZones[2].unit = getCard('ST01-002');
            p1.hand = [getCard('ST01-002')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const base = p1.unitZones[0].unit?.power || 0;
            const buffed = getZonePower(engine, p1, 0);
            engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');

            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
            if (confirm) engine.step(confirm);
            const pay = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (pay) engine.step(pay);

            return [
                { pass: buffed === base + 2000, message: '전선구축 +2000 적용' },
                { pass: !!confirm, message: '부여 엑시트 선택 발동 가능' },
                { pass: !!pay, message: '재배치 코스트(패 1장 트래시) 지불 가능' },
                { pass: p1.unitZones[1].unit?.id.startsWith('ST11-006') === true, message: '효과 트래시된 유닛 재배치 성공' },
            ];
        },
    },
    {
        testId: 'SB01-009',
        name: '레인 4코 이하 배치 제한',
        description: '레벨링크 충족 시 해당 레인에 상대 4코 이하 유닛 배치를 막는다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p2.unitZones[1].unit = getCard('SB01-009');
            p2.leaderLevel = 6;
            p1.hand = [getCard('SB01-021'), getCard('SB01-003')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const legal = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'PLAY_UNIT');
            const canPlayLowInLockedLane = legal.some((action: any) => action.handIndex === 0 && action.zoneIndex === 1);
            const canPlayHighInLockedLane = legal.some((action: any) => action.handIndex === 1 && action.zoneIndex === 1);
            return [
                { pass: !canPlayLowInLockedLane, message: '4코 이하 배치 금지 적용' },
                { pass: canPlayHighInLockedLane, message: '5코 이상 배치 허용' },
            ];
        },
    },
    {
        testId: 'SB01-010',
        name: '어태커 히트차 방어 코스트 강제',
        description: '블로커 히트가 낮으면 차이만큼 패를 트래시해야 방어할 수 있다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.ATTACK, 0);
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 8; // 레벨링크 활성
            p1.unitZones[0].unit = getCard('SB01-010');
            p2.unitZones[0].unit = getCard('ST11-005');
            p2.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];

            engine.attack(0);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (a: any) => a.shouldBlock && a.blockerZoneIndex === 0);
            if (block) engine.step(block);

            let safety = 0;
            while (engine.state.interactionMode === 'SELECT_COST' && safety < 5) {
                const pay = findAction(engine, p2.id, 'SELECT_COST_HAND');
                if (!pay) break;
                engine.step(pay);
                safety += 1;
            }

            return [
                { pass: !!block, message: '방어 선언 가능' },
                { pass: p2.trash.length >= 2, message: '히트 차이 기반 패 트래시 지불' },
            ];
        },
    },
    {
        testId: 'SB01-011',
        name: '엑시트 효과트래시 카운트 드로우/추가대미지',
        description: '자신 턴 EXIT 시 효과 트래시 아군 수만큼 드로우하고 3장 이상이면 1대미지를 준다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('SB01-011');
            p1.unitZones[1].unit = getCard('ST11-006');
            p1.unitZones[2].unit = getCard('ST11-006');
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforeHand = p1.hand.length;
            const beforeDamage = p2.damage.length;

            engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');
            engine.destroyUnit(p1, p1.unitZones[2], undefined, 'EFFECT');
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');

            return [
                { pass: p1.hand.length === beforeHand + 3, message: '효과 트래시 수만큼 드로우' },
                { pass: p2.damage.length === beforeDamage + 1, message: '3장 이상 추가 1대미지' },
            ];
        },
    },
    {
        testId: 'SB01-011_콤보테스트',
        name: '콤보: SB01-011~015 + BT02-022 연계',
        description: '013 증폭 + 014/015 효과트래시 누적 + 012/011/022 연계 대미지와 드로우를 검증한다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];

            p1.leaderLevel = 20;
            p2.leaderLevel = 20;

            p1.hand = [
                getCard('SB01-014'),
                getCard('SB01-015'),
                getCard('SB01-013'),
                getCard('BT02-022'),
            ];
            p1.skillZone = [];
            p1.trash = [getCard('ST11-006'), getCard('ST11-006')];
            p1.deck = [
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
                getCard('ST01-002'),
            ];
            p1.unitZones.forEach((zone: any) => {
                zone.unit = null;
                zone.items = [];
                zone.buffs = [];
                zone.temporaryEffects = [];
                zone.hasAttacked = false;
                zone.attackCountThisTurn = 0;
                zone.extraAttackAllowance = 0;
                zone.isExhausted = false;
                zone.hasPlacedUnitThisTurn = false;
                zone.hasActivatedEffectThisTurn = false;
                zone.activatedEffectKeys = {};
            });
            p1.unitZones[0].unit = getCard('SB01-011');
            p1.unitZones[1].unit = getCard('SB01-012');
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforeDamage = p2.damage.length;

            const play014 = findAction(engine, p1.id, 'PLAY_SKILL', (a: any) =>
                p1.hand[a.handIndex]?.id.startsWith('SB01-014')
            );
            if (play014) engine.step(play014);

            const pickTrashFor014 = findAction(engine, p1.id, 'SELECT_TRASH_TARGET', (a: any) =>
                p1.trash[a.trashIndex]?.id.startsWith('ST11-006')
            );
            if (pickTrashFor014) engine.step(pickTrashFor014);
            const pickZoneFor014 = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) =>
                a.targetPlayerId === p1.id && a.zoneIndex === 2
            );
            if (pickZoneFor014) engine.step(pickZoneFor014);
            const deployedBy014 = p1.unitZones[2].unit?.id.startsWith('ST11-006') === true;

            const play015 = findAction(engine, p1.id, 'PLAY_SKILL', (a: any) =>
                p1.hand[a.handIndex]?.id.startsWith('SB01-015')
            );
            if (play015) engine.step(play015);

            const pickZoneFor015 = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) =>
                a.targetPlayerId === p1.id && a.zoneIndex === 2
            );
            if (pickZoneFor015) engine.step(pickZoneFor015);

            const trashedAfter015 = engine.getEffectTrashedFriendlyUnitCount(p1.id);

            engine.activateEffect(1, 0);

            const damageAfter012 = p2.damage.length;
            const trashedAfter012 = engine.getEffectTrashedFriendlyUnitCount(p1.id);

            const play013 = findAction(engine, p1.id, 'PLAY_UNIT', (a: any) =>
                p1.hand[a.handIndex]?.id.startsWith('SB01-013') && a.zoneIndex === 1
            );
            if (play013) engine.step(play013);
            const decline013Swap = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === false);
            if (decline013Swap) engine.step(decline013Swap);
            const activeDamageBonusState = (p1 as any).sb01ActiveDamageBonusUntilTurnEnd;

            engine.destroyUnit(p1, p1.unitZones[2], undefined, 'EFFECT');
            const trashedAfterManualDestroy = engine.getEffectTrashedFriendlyUnitCount(p1.id);

            const play022 = findAction(engine, p1.id, 'PLAY_UNIT', (a: any) =>
                p1.hand[a.handIndex]?.id.startsWith('BT02-022') && a.zoneIndex === 2
            );
            if (play022) engine.step(play022);
            engine.activateEffect(2, 0);
            const damageAfter022 = p2.damage.length;

            const handBefore011Exit = p1.hand.length;
            engine.destroyUnit(p1, p1.unitZones[0], undefined, 'EFFECT');
            const handAfter011Exit = p1.hand.length;
            const damageAfter011 = p2.damage.length;
            const trashedAfter011 = engine.getEffectTrashedFriendlyUnitCount(p1.id);

            return [
                { pass: !!play014 && !!pickTrashFor014 && !!pickZoneFor014, message: 'SB01-014로 대상/빈 라인 선택 배치 성공' },
                { pass: deployedBy014, message: 'SB01-014 배치 유닛 필드 정착' },
                { pass: !!play015 && !!pickZoneFor015, message: 'SB01-015 대상 선택 및 처리 성공' },
                { pass: trashedAfter015 >= 1, message: 'SB01-015 처리로 효과 트래시 카운트 1 이상' },
                { pass: damageAfter012 === beforeDamage + 1, message: 'SB01-012 액티브 대미지 1 적용' },
                { pass: trashedAfter012 >= 2, message: 'SB01-012 자가 트래시 포함 카운트 2 이상 충족' },
                { pass: !!play013, message: 'SB01-013 배치 성공' },
                { pass: !!decline013Swap, message: 'SB01-013 교체 선택을 비활성(미사용)으로 처리' },
                {
                    pass: activeDamageBonusState?.bonus === 1 && activeDamageBonusState?.untilTurnCount === engine.state.turnCount,
                    message: 'SB01-013 액티브 대미지 +1 증폭 상태 활성',
                },
                { pass: trashedAfterManualDestroy >= 3, message: '연계 파괴 포함 효과 트래시 카운트 3 이상' },
                { pass: !!play022, message: 'BT02-022 배치 성공' },
                { pass: damageAfter022 === beforeDamage + 3, message: 'BT02-022 액티브 대미지 2(013 증폭) 적용' },
                { pass: handAfter011Exit === handBefore011Exit + 4, message: 'SB01-011 EXIT로 4드로우 적용' },
                { pass: damageAfter011 === beforeDamage + 4, message: 'SB01-011 EXIT 추가 1대미지 적용' },
                { pass: trashedAfter011 >= 4, message: 'SB01-011 EXIT 시점 카운트 4 이상 유지' },
            ];
        },
    },
    {
        testId: 'SB01-012',
        name: '액티브 메인 자가트래시 + 1대미지',
        description: '이번 턴 효과로 아군 유닛이 트래시된 상태에서 발동하면 자신을 트래시하고 1대미지를 준다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('SB01-012');
            p1.unitZones[1].unit = getCard('ST11-006');
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforeDamage = p2.damage.length;

            engine.destroyUnit(p1, p1.unitZones[1], undefined, 'EFFECT');
            engine.activateEffect(0, 0);

            return [
                { pass: p1.unitZones[0].unit === null, message: '자가 트래시 처리' },
                { pass: p2.damage.length === beforeDamage + 1, message: '상대 1대미지 적용' },
            ];
        },
    },
    {
        testId: 'SB01-013',
        name: '엔트리 선택 교체 배치',
        description: '엔트리 선택 시 자신을 트래시하고 패의 5코 유닛으로 교체 배치한다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            p1.hand = [getCard('SB01-013'), getCard('SB01-003')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];

            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
            if (confirm) engine.step(confirm);
            const pick = findAction(engine, p1.id, 'SELECT_HAND_TARGET');
            if (pick) engine.step(pick);

            const zoneUnit = p1.unitZones[0].unit;
            const override = (zoneUnit as any)?.turnCostOverride;

            return [
                { pass: !!confirm, message: '교체 선택 가능' },
                { pass: !!pick, message: '5코 유닛 선택 가능' },
                { pass: zoneUnit?.id.startsWith('SB01-003') === true, message: '5코 유닛 교체 배치 성공' },
                { pass: override?.cost === 3 && override?.turnCount === engine.state.turnCount, message: '턴 코스트 조정 적용' },
            ];
        },
    },
    {
        testId: 'SB01-014',
        name: '트래시 2코 이하 배치 + EXIT 스킬 트래시',
        description: '트래시의 2코 이하 유닛을 선택한 빈 존에 배치하고 EXIT로 스킬존 페인 이터를 트래시한다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            p1.hand = [getCard('SB01-014')];
            p1.trash = [getCard('ST11-006')];
            p1.unitZones[0].unit = getCard('ST01-002');
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);

            const pick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET');
            if (pick) engine.step(pick);
            const zoneChoices = engine
                .getLegalActions(p1.id)
                .filter((action: any) => action.type === 'SELECT_ZONE_TARGET' && action.targetPlayerId === p1.id) as any[];
            const onlyEmptyZones = zoneChoices.length > 0 && zoneChoices.every((action: any) => !p1.unitZones[action.zoneIndex].unit);
            const pickZone = zoneChoices.find((action: any) => action.zoneIndex === 2);
            if (pickZone) engine.step(pickZone);

            const deployedZoneIndex = p1.unitZones.findIndex((zone: any) => zone.unit?.id.startsWith('ST11-006'));
            if (deployedZoneIndex >= 0) {
                engine.destroyUnit(p1, p1.unitZones[deployedZoneIndex], undefined, 'EFFECT');
            }

            return [
                { pass: !!pick, message: '트래시 배치 대상 선택 가능' },
                { pass: onlyEmptyZones, message: '빈 유닛 존만 선택지로 노출' },
                { pass: !!pickZone, message: '배치할 빈 존 직접 선택 가능' },
                { pass: deployedZoneIndex === 2, message: '선택한 존에 2코 이하 유닛 배치 성공' },
                { pass: p1.skillZone.every((card: any) => !card.id.startsWith('SB01-014')), message: 'EXIT 연계 스킬존 페인 이터 트래시' },
            ];
        },
    },
    {
        testId: 'SB01-015',
        name: '동명/동원래코스트 재배치',
        description: '아군 유닛 트래시 후 같은 이름/코스트 유닛을 같은 칸에 재배치한다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            p1.hand = [getCard('SB01-015')];
            p1.unitZones[1].unit = getCard('ST11-006');
            p1.trash = [getCard('ST11-006')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (a: any) =>
                a.targetPlayerId === p1.id && a.zoneIndex === 1
            );
            if (pick) engine.step(pick);

            const trashCount = p1.trash.filter((card: any) => card.id.startsWith('ST11-006')).length;
            return [
                { pass: !!pick, message: '트래시할 아군 유닛 선택 가능' },
                { pass: p1.unitZones[1].unit?.id.startsWith('ST11-006') === true, message: '같은 칸 재배치 성공' },
                { pass: trashCount >= 1, message: '원본 유닛은 트래시에 남음' },
            ];
        },
    },
    {
        testId: 'SB01-016',
        name: '디펜더 수 비례 전역 파워 버프',
        description: '필드 디펜더 수만큼 아군 전유닛에 파워 버프를 준다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('SB01-016');
            p1.unitZones[1].unit = getCard('ST11-005'); // Defender
            p1.unitZones[2].unit = getCard('ST01-002');
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const base = p1.unitZones[2].unit?.power || 0;
            const buffed = getZonePower(engine, p1, 2);
            return [
                { pass: buffed === base + 2000, message: '디펜더 2장 기준 전역 +2000 적용' },
            ];
        },
    },
    {
        testId: 'SB01-017',
        name: '디펜더 선택 코스트로 공격 잠금',
        description: '디펜더 시 코스트를 지불하면 공격 유닛이 다음 상대 턴 종료까지 공격할 수 없다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.ATTACK, 0);
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST10-005');
            p2.unitZones[1].unit = getCard('SB01-017');
            p2.hand = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];

            engine.attack(0);

            const guardianBlock = findAction(engine, p2.id, 'RESOLVE_BLOCK', (a: any) => a.shouldBlock && a.blockerZoneIndex === 1);
            if (guardianBlock) engine.step(guardianBlock);
            const payBarrier = findAction(engine, p2.id, 'SELECT_COST_HAND');
            if (payBarrier) engine.step(payBarrier);

            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                const confirm =
                    findAction(engine, p2.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true) ||
                    findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
                if (confirm) engine.step(confirm);
            }
            if (engine.state.interactionMode === 'SELECT_COST') {
                const payOptional = findAction(engine, p2.id, 'SELECT_COST_HAND') || findAction(engine, p1.id, 'SELECT_COST_HAND');
                if (payOptional) engine.step(payOptional);
            }

            const reached = advanceUntil(engine, () => engine.currentPlayer.id === p1.id && engine.state.phase === Phase.ATTACK, 40);
            const canAttack = engine
                .getLegalActions(p1.id)
                .some((action: any) => action.type === 'ATTACK' && action.attackerZoneIndex === 0);

            return [
                { pass: !!guardianBlock, message: '가디언 블록 선언 성공' },
                { pass: reached, message: '다음 자신의 공격 페이즈 도달' },
                { pass: !canAttack, message: '장기 공격 잠금 적용' },
            ];
        },
    },
    {
        testId: 'SB01-018',
        name: '엔트리 조건부 조우 유닛+아이템 바운스',
        description: '조우 유닛 코스트가 4 이상이면 코스트 지불 후 조우 유닛과 장착 아이템을 패로 되돌린다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('SB01-018'), getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('SB01-003'); // 5코스트
            p2.unitZones[0].items = [getCard('ST10-017')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];

            engine.playUnit(0, 0);
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
            if (confirm) engine.step(confirm);
            const pay = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (pay) engine.step(pay);

            const returnedUnit = p2.hand.some((card: any) => card.id.startsWith('SB01-003'));
            const returnedItem = p2.hand.some((card: any) => card.id.startsWith('ST10-017'));
            return [
                { pass: !!confirm, message: '엔트리 선택 발동 가능' },
                { pass: !!pay, message: '패 트래시 코스트 지불 가능' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛이 필드에서 제거됨' },
                { pass: returnedUnit && returnedItem, message: '조우 유닛 + 장착 아이템 패 복귀' },
            ];
        },
    },
    {
        testId: 'SB01-019',
        name: '디펜더 오라 대미지/드로우',
        description: '디펜더 유닛에 부여된 오라가 방어 시 대미지와 드로우를 발생시킨다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.ATTACK, 1);
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('SB01-019');
            p1.unitZones[0].buffs.push({
                id: 'sb01-019-power-buff',
                type: 'POWER',
                value: 1000,
                duration: 'PERMANENT',
            } as any);
            p1.unitZones[1].unit = getCard('ST11-005');
            p1.deck = [getCard('ST01-002')];
            p2.unitZones[1].unit = getCard('ST10-005');
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforeDamage = p2.damage.length;
            const beforeHand = p1.hand.length;

            engine.attack(1);
            const block = findAction(engine, p1.id, 'RESOLVE_BLOCK', (a: any) => a.shouldBlock && a.blockerZoneIndex === 1);
            if (block) engine.step(block);

            return [
                { pass: !!block, message: '디펜더 방어 성공' },
                { pass: p2.damage.length === beforeDamage + 1, message: '오라 1대미지 적용' },
                { pass: p1.hand.length === beforeHand + 1, message: '오라 1드로우 적용' },
            ];
        },
    },
    {
        testId: 'SB01-020',
        name: '상대 효과 파괴 대체',
        description: '조건 충족 시 패 1장을 트래시해 상대 효과 파괴를 대체한다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('SB01-020');
            p1.unitZones[0].buffs.push({
                id: 'sb01-020-power-buff',
                type: 'POWER',
                value: 1000,
                duration: 'PERMANENT',
            } as any);
            p1.hand = [getCard('ST01-002')];
            p2.unitZones[0].unit = getCard('ST10-005');
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];

            engine.destroyUnit(p1, p1.unitZones[0], p2.unitZones[0].unit, 'EFFECT');
            const confirm = findAction(engine, p1.id, 'RESOLVE_OPTIONAL', (a: any) => a.confirm === true);
            if (confirm) engine.step(confirm);
            const pay = findAction(engine, p1.id, 'SELECT_COST_HAND');
            if (pay) engine.step(pay);

            return [
                { pass: !!confirm, message: '파괴 대체 선택 가능' },
                { pass: !!pay, message: '대체 코스트 지불 가능' },
                { pass: p1.unitZones[0].unit?.id.startsWith('SB01-020') === true, message: '파괴 대체 성공(필드 생존)' },
            ];
        },
    },
    {
        testId: 'SB01-021',
        name: '엔트리 다중 아이템 장착 + 암드 버프',
        description: '손/트래시 아이템을 선택 장착하고 장착 유닛 3장 조건에서 파워/히트 버프를 받는다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            p1.hand = [getCard('SB01-021'), getCard('ST10-017'), getCard('ST10-017')];
            p1.trash = [getCard('ST10-017')];
            p1.unitZones[1].unit = getCard('ST11-006');
            p1.unitZones[2].unit = getCard('ST11-006');
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);

            const selected = new Set<number>();
            for (let i = 0; i < 3; i++) {
                const pick = engine
                    .getLegalActions(p1.id)
                    .find((action: any) => action.type === 'SELECT_REVEALED_TARGET' && !selected.has(action.revealedIndex));
                if (!pick) break;
                selected.add((pick as any).revealedIndex);
                engine.step(pick);
            }
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);

            const allEquipped = [0, 1, 2].every(index => (p1.unitZones[index].items || []).length >= 1);
            const selfPower = getZonePower(engine, p1, 0);
            const selfHit = getZoneHit(engine, p1, 0);
            const basePower = p1.unitZones[0].unit?.power || 0;
            const baseHit = p1.unitZones[0].unit?.hit || 0;

            return [
                { pass: selected.size === 3, message: '아이템 다중 선택 성공' },
                { pass: !!confirm, message: '선택 확정 가능' },
                { pass: allEquipped, message: '3개 레인에 1장씩 장착' },
                { pass: selfPower === basePower + 2000, message: '암드 파워 +2000 적용' },
                { pass: selfHit === baseHit + 1, message: '암드 히트 +1 적용' },
            ];
        },
    },
    {
        testId: 'SB01-022',
        name: '아군 전유닛 암드 ON_KILL 오라',
        description: '암드 유닛이 처치 시 상대는 패를 1장 트래시한다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.ATTACK, 0);
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('SB01-022');
            p1.unitZones[1].unit = getCard('ST10-011');
            p1.unitZones[1].items = [getCard('ST10-017')];
            p2.unitZones[1].unit = getCard('ST11-006');
            p2.hand = [getCard('ST01-002'), getCard('ST01-002')];
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            const beforeHand = p2.hand.length;

            engine.attack(1);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (a: any) => a.shouldBlock && a.blockerZoneIndex === 1);
            if (block) engine.step(block);

            const pick = findAction(engine, p2.id, 'SELECT_HAND_TARGET');
            if (pick) engine.step(pick);

            return [
                { pass: !!block, message: '조우 전투 성립' },
                { pass: !!pick, message: '상대 패 트래시 대상 선택 가능' },
                { pass: p2.hand.length === beforeHand - 1, message: 'ON_KILL 오라 패 트래시 적용' },
            ];
        },
    },
    {
        testId: 'SB01-023',
        name: '엔트리 최대2장 패트래시 후 드로우',
        description: '패를 최대 2장 트래시하고 같은 수만큼 드로우, 아이템 2장 이상이면 추가 1드로우.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            p1.hand = [getCard('SB01-023'), getCard('ST10-017'), getCard('ST10-017')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002'), getCard('ST01-002')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);

            const selected = new Set<number>();
            for (let i = 0; i < 2; i++) {
                const pick = engine
                    .getLegalActions(p1.id)
                    .find((action: any) =>
                        action.type === 'SELECT_HAND_TARGET' &&
                        p1.hand[action.handIndex]?.type === 'ITEM' &&
                        !selected.has(action.handIndex),
                    );
                if (!pick) break;
                selected.add((pick as any).handIndex);
                engine.step(pick);
            }
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);

            const trashedItems = p1.trash.filter((card: any) => card.id.startsWith('ST10-017')).length;
            return [
                { pass: selected.size === 2, message: '최대 2장 선택 트래시 성공' },
                { pass: !!confirm, message: '선택 확정 가능' },
                { pass: p1.hand.length === 3, message: '2트래시 3드로우 결과 손패 3장' },
                { pass: trashedItems >= 2, message: '아이템 2장 이상 트래시 반영' },
            ];
        },
    },
    {
        testId: 'SB01-024',
        name: '암드 액티브 회수 + 패시브 +3000',
        description: '아이템 장착 상태에서 트래시의 장착수 이하 코스트 카드 1장을 패로 회수한다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('SB01-024');
            p1.unitZones[0].items = [getCard('ST10-017')];
            p1.trash = [getCard('SB01-021')]; // cost 1
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const basePower = p1.unitZones[0].unit?.power || 0;

            engine.activateEffect(0, 0);
            const pick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET');
            if (pick) engine.step(pick);

            const power = getZonePower(engine, p1, 0);
            return [
                { pass: !!pick, message: '트래시 회수 대상 선택 가능' },
                { pass: p1.hand.some((card: any) => card.id.startsWith('SB01-021')), message: '장착수 이하 코스트 카드 회수 성공' },
                { pass: power === basePower + 3000, message: '암드 패시브 +3000 적용' },
            ];
        },
    },
    {
        testId: 'SB01-025',
        name: '아이템 1장 이상 선택 트래시 후 드로우',
        description: '아이템 최소 1장 선택 규칙을 지키고 선택 수만큼 드로우한다.',
        setup: (engine, getCard) => {
            prepare(engine, Phase.MAIN, 0);
            const p1 = engine.state.players[0];
            p1.hand = [getCard('SB01-025'), getCard('ST10-017'), getCard('ST10-017')];
            p1.deck = [getCard('ST01-002'), getCard('ST01-002')];
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);

            const canConfirmWithoutSelection = engine
                .getLegalActions(p1.id)
                .some((action: any) => action.type === 'CONFIRM_TARGETS');

            const pick = findAction(engine, p1.id, 'SELECT_HAND_TARGET', (action: any) => p1.hand[action.handIndex]?.type === 'ITEM');
            if (pick) engine.step(pick);

            const canConfirmAfterSelection = engine
                .getLegalActions(p1.id)
                .some((action: any) => action.type === 'CONFIRM_TARGETS');
            const confirm = findAction(engine, p1.id, 'CONFIRM_TARGETS');
            if (confirm) engine.step(confirm);

            return [
                { pass: !canConfirmWithoutSelection, message: '최소 선택(1+) 강제' },
                { pass: !!pick, message: '아이템 선택 가능' },
                { pass: canConfirmAfterSelection, message: '선택 후 확정 가능' },
                { pass: p1.hand.length === 2, message: '1장 트래시 + 1드로우 반영' },
            ];
        },
    },
];

export const SB01Module: UnifiedTestModule = {
    packId: 'SB01',
    displayName: 'SB01 스페셜 부스터',
    tests,
};

export default tests;
