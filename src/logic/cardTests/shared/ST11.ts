/**
 * ST11 Water Starter Unified Tests
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';
import { Card } from '../../types';

function advanceUntil(engine: any, predicate: () => boolean, maxSteps = 20): boolean {
    let guard = 0;
    while (!predicate() && guard < maxSteps) {
        engine.nextPhase();
        guard += 1;
    }
    return predicate();
}

function findAction(engine: any, actorPlayerId: string, type: string, predicate?: (action: any) => boolean) {
    return engine
        .getLegalActions(actorPlayerId)
        .find((action: any) => action.type === type && (!predicate || predicate(action)));
}

const tests: UnifiedTestCase[] = [
    {
        testId: 'ST11-001',
        name: '모르페아 각성 및 스킬 회수',
        description: '레벨 5 각성 후 스킬존 수보다 코스트가 낮은 스킬만 트래시에서 회수한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('ST11-001');
            p1.levelZone.isAwakened = false;
            p1.leaderLevel = 4;
            p1.skillZone = [getCard('ST11-013'), getCard('ST11-014')];
            p1.trash = [getCard('ST11-013'), getCard('ST11-014')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase(); // LEVEL_UP -> DRAW (leader level up and awaken check)

            engine.state.phase = Phase.MAIN;
            engine.activateEffect(0, 1, 'LEADER');

            const legal = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_TRASH_TARGET') as Array<any>;
            const selectableIds = legal.map(action => p1.trash[action.trashIndex]?.id);
            const canPickLow = selectableIds.some(id => id?.startsWith('ST11-013'));
            const canPickHigh = selectableIds.some(id => id?.startsWith('ST11-014'));

            const pickLow = legal.find(action => p1.trash[action.trashIndex]?.id.startsWith('ST11-013'));
            if (pickLow) engine.step(pickLow);

            return [
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성 성공' },
                { pass: canPickLow, message: '낮은 코스트 스킬 선택 가능' },
                { pass: !canPickHigh, message: '스킬존 수 이상 코스트 스킬 선택 불가' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST11-013')), message: '스킬 회수 성공' },
            ];
        }
    },
    {
        testId: 'ST11-002',
        name: '셀리아 공격 불가 및 디펜더 +1000',
        description: '자신 턴에는 공격할 수 없고, 방어 시 +1000으로 생존한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST11-002');
            p2.unitZones[0].unit = getCard('ST01-002');
            if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 4500;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];

            const canAttack = engine
                .getLegalActions(p1.id)
                .some((action: any) => action.type === 'ATTACK' && action.attackerZoneIndex === 0);

            engine.state.turnPlayerIndex = 1;
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            const block = findAction(engine, p1.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
            if (block) engine.step(block);

            return [
                { pass: !canAttack, message: '공격 불가 적용' },
                { pass: p1.unitZones[0].unit !== null, message: '디펜더 +1000으로 방어 유닛 생존' },
                { pass: p2.unitZones[0].unit === null, message: '공격 유닛 트래시' },
            ];
        }
    },
    {
        testId: 'ST11-003',
        name: '레피테아 엔트리 드로우 후 1장 트래시',
        description: '엔트리로 1드로우한 뒤 손패 1장을 선택해 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST11-003'), getCard('ST01-002')];
            p1.deck = [getCard('ST11-006')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            const discard = findAction(engine, p1.id, 'SELECT_HAND_TARGET');
            if (discard) engine.step(discard);

            return [
                { pass: p1.hand.length === 1, message: '드로우 후 1장 트래시로 손패 1장 유지' },
                { pass: p1.trash.length >= 1, message: '손패 트래시 처리' },
            ];
        }
    },
    {
        testId: 'ST11-004',
        name: '헬레나 엔트리 공개 후 버프 유닛 선택',
        description: '덱 상위 3장 공개 후 버프 유닛 1장을 패에 넣고 나머지를 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST11-004')];
            p1.deck = [getCard('ST01-002'), getCard('ST11-005'), getCard('ST11-009')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);

            const pickBuff = findAction(
                engine,
                p1.id,
                'SELECT_REVEALED_TARGET',
                (action: any) => engine.state.revealedCards[action.revealedIndex]?.id.startsWith('ST11-009'),
            );
            if (pickBuff) engine.step(pickBuff);

            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST11-009')), message: '버프 유닛 패 획득' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST11-005')), message: '비선택 카드 트래시 1' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST01-002')), message: '비선택 카드 트래시 2' },
            ];
        }
    },
    {
        testId: 'ST11-005',
        name: '안젤리카 디펜더 +3000',
        description: '방어 시 +3000으로 높은 공격력을 막아낸다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST11-005');
            p2.unitZones[0].unit = getCard('ST01-002');
            if (p2.unitZones[0].unit) p2.unitZones[0].unit.power = 4500;
            engine.state.turnPlayerIndex = 1;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.attack(0);
            const block = findAction(engine, p1.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
            if (block) engine.step(block);

            return [
                { pass: p1.unitZones[0].unit !== null, message: '디펜더 +3000으로 생존' },
                { pass: p2.unitZones[0].unit === null, message: '공격 유닛 트래시' },
            ];
        }
    },
    {
        testId: 'ST11-006',
        name: '세헤라자드 엔트리 1드로우',
        description: '엔트리로 카드를 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST11-006')];
            p1.deck = [getCard('ST01-002')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playUnit(0, 0);
            return [
                { pass: p1.hand.length === 1, message: '엔트리 1드로우 반영' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST01-002')), message: '드로우 카드 확인' },
            ];
        }
    },
    {
        testId: 'ST11-007',
        name: '로엔 패시브 디펜더 아군 +1500',
        description: '디펜더를 가진 자신 유닛만 +1500 버프를 받는다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST11-007');
            p1.unitZones[1].unit = getCard('ST11-005'); // Defender
            p1.unitZones[2].unit = getCard('ST11-006'); // Non-defender
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const defenderBase = p1.unitZones[1].unit?.power || 0;
            const normalBase = p1.unitZones[2].unit?.power || 0;
            const defenderPower = engine.getUnitPower(p1.unitZones[1], p1);
            const normalPower = engine.getUnitPower(p1.unitZones[2], p1);
            return [
                { pass: defenderPower === defenderBase + 1500, message: '디펜더 유닛 +1500' },
                { pass: normalPower === normalBase, message: '비디펜더 유닛은 무버프' },
            ];
        }
    },
    {
        testId: 'ST11-008',
        name: '세이르 가디언 방벽[1]',
        description: '인접 레인 방어 시 손패 1장을 트래시해 가디언 블록을 수행한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[1].unit = getCard('ST11-006');
            p2.unitZones[0].unit = getCard('ST11-008');
            p2.hand = [getCard('ST01-002')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            engine.attack(1);
            const block = findAction(engine, p2.id, 'RESOLVE_BLOCK', (action: any) => action.shouldBlock && action.blockerZoneIndex === 0);
            if (block) engine.step(block);
            if (engine.state.interactionMode === 'SELECT_COST') {
                const pay = findAction(engine, p2.id, 'SELECT_COST_HAND');
                if (pay) engine.step(pay);
            }

            return [
                { pass: !!block, message: '가디언 인접 블록 가능' },
                { pass: p2.trash.length >= 1, message: '방벽 코스트 1장 지불' },
            ];
        }
    },
    {
        testId: 'ST11-009',
        name: '달비 액티브 디펜더 효과 부여 유지/해제',
        description: '조건 충족 시 아군 전체에 디펜더 +2000 부여 후 상대 턴 종료에 해제된다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST11-009');
            p1.unitZones[1].unit = getCard('ST11-006');
            p1.skillZone = [getCard('ST11-013')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 1);

            const granted = p1.unitZones[1].temporaryEffects.some(effect => effect.activation === 'DEFENDER' && effect.duration === 'OPP_TURN_END');
            const afterOwnTurn = advanceUntil(
                engine,
                () => engine.currentPlayer.id === engine.state.players[1].id && engine.state.phase === Phase.LEVEL_UP,
                14
            );
            const stillGranted = p1.unitZones[1].temporaryEffects.some(effect => effect.activation === 'DEFENDER');
            const afterOppTurn = advanceUntil(
                engine,
                () => engine.currentPlayer.id === p1.id && engine.state.phase === Phase.LEVEL_UP,
                14
            );
            const removed = p1.unitZones[1].temporaryEffects.some(effect => effect.activation === 'DEFENDER');

            return [
                { pass: granted, message: '디펜더 +2000 부여 성공' },
                { pass: afterOwnTurn && stillGranted, message: '자신 턴 종료 후에도 유지' },
                { pass: afterOppTurn && !removed, message: '상대 턴 종료 후 해제' },
            ];
        }
    },
    {
        testId: 'ST11-009-Trigger',
        name: '달비 트리거 패 복귀',
        description: '대미지 트리거 시 카드가 자신의 패로 복귀한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.deck = [getCard('ST11-009')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST11-009')), message: '트리거 패 복귀' },
                { pass: p1.damage.every((card: Card) => !card.id.startsWith('ST11-009')), message: '트리거 카드 대미지존 이탈' },
            ];
        }
    },
    {
        testId: 'ST11-010',
        name: '미카엘라 히트 제한 타깃 및 공격 봉쇄',
        description: '히트 1 이하 적만 선택 가능하고 대상은 상대 턴 동안 공격할 수 없다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST11-010');
            p1.skillZone = [getCard('ST11-013')];
            p2.unitZones[0].unit = getCard('ST11-006'); // hit 1
            p2.unitZones[1].unit = getCard('ST11-012'); // hit 2
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];

            engine.activateEffect(0, 0);
            const legal = engine.getLegalActions(p1.id).filter((action: any) => action.type === 'SELECT_ZONE_TARGET') as Array<any>;
            const lanes = legal.filter(action => action.targetPlayerId === p2.id).map(action => action.zoneIndex).sort((a, b) => a - b);
            const onlyHitOne = lanes.length === 1 && lanes[0] === 0;

            const pick0 = legal.find(action => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (pick0) engine.step(pick0);

            const reachedOppAttack = advanceUntil(
                engine,
                () => engine.currentPlayer.id === p2.id && engine.state.phase === Phase.ATTACK,
                20
            );
            const canLockedUnitAttack = engine
                .getLegalActions(p2.id)
                .some((action: any) => action.type === 'ATTACK' && action.attackerZoneIndex === 0);

            return [
                { pass: onlyHitOne, message: '히트 1 이하 타깃만 선택 가능' },
                { pass: reachedOppAttack, message: '상대 공격 페이즈 도달' },
                { pass: !canLockedUnitAttack, message: '대상 유닛 공격 봉쇄' },
            ];
        }
    },
    {
        testId: 'ST11-011',
        name: '이클립스 아군 전체 +2000 유지/해제',
        description: '스킬존 조건 시 아군 전체 +2000이 상대 턴 종료까지 유지된다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST11-011');
            p1.unitZones[1].unit = getCard('ST11-006');
            p1.skillZone = [getCard('ST11-013')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const base = p1.unitZones[1].unit?.power || 0;
            engine.activateEffect(0, 1);
            const buffed = engine.getUnitPower(p1.unitZones[1], p1);

            const afterOwnTurn = advanceUntil(
                engine,
                () => engine.currentPlayer.id === engine.state.players[1].id && engine.state.phase === Phase.LEVEL_UP,
                14
            );
            const stillBuffed = p1.unitZones[1].unit ? engine.getUnitPower(p1.unitZones[1], p1) : 0;

            const afterOppTurn = advanceUntil(
                engine,
                () => engine.currentPlayer.id === p1.id && engine.state.phase === Phase.LEVEL_UP,
                14
            );
            const removed = p1.unitZones[1].unit ? engine.getUnitPower(p1.unitZones[1], p1) : 0;

            return [
                { pass: buffed === base + 2000, message: '아군 전체 +2000 적용' },
                { pass: afterOwnTurn && stillBuffed === base + 2000, message: '자신 턴 종료 후에도 유지' },
                { pass: afterOppTurn && removed === base, message: '상대 턴 종료 후 해제' },
            ];
        }
    },
    {
        testId: 'ST11-012',
        name: '모르페아 돌파 부여 + 침투 드로우',
        description: '돌파[4코 이하]로 방어를 무시하고 침투 드로우를 발동한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = getCard('ST11-012');
            p1.skillZone = [getCard('ST11-013')];
            p1.deck = [getCard('ST01-002')];

            p2.unitZones[0].unit = getCard('ST11-010'); // cost 4 (encounter blocker should fail)
            p2.unitZones[1].unit = getCard('ST11-008'); // cost 3 guardian (adjacent blocker should fail)
            p2.hand = [getCard('ST01-002')];

            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];

            engine.activateEffect(0, 0);
            engine.state.phase = Phase.ATTACK;
            const beforeHand = p1.hand.length;
            const beforeDamage = p2.damage.length;
            engine.attack(0);
            const damageDelta = p2.damage.length - beforeDamage;

            return [
                { pass: damageDelta === 2, message: '돌파로 방어 무시 후 직접 데미지 2' },
                { pass: p1.hand.length === beforeHand + 1, message: '침투 드로우 1장 발동' },
                { pass: p2.unitZones[0].unit !== null, message: '조우 유닛과 전투 미발생(방어 불가)' },
            ];
        }
    },
    {
        testId: 'ST11-012-Trigger',
        name: '모르페아 트리거 최저코스트 바운스',
        description: '대미지 트리거 시 자신은 트래시되고 최저코스트 상대 유닛과 장착 아이템을 패로 되돌린다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.deck = [getCard('ST11-012')];
            p2.hand = [];
            p2.unitZones[0].unit = getCard('ST11-006'); // low cost
            p2.unitZones[0].items = [getCard('ST11-017')];
            p2.unitZones[1].unit = getCard('ST11-011'); // high cost
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.dealDamage(p1, 1);
            const pickLow = findAction(
                engine,
                p1.id,
                'SELECT_ZONE_TARGET',
                (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0
            );
            if (pickLow) engine.step(pickLow);

            return [
                { pass: !!pickLow, message: '최저코스트 대상 선택' },
                { pass: p1.damage.every((card: Card) => !card.id.startsWith('ST11-012')), message: '트리거 카드 대미지존 이탈' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST11-012')), message: '트리거 카드 트래시 이동' },
                { pass: p2.unitZones[0].unit === null, message: '최저코스트 상대 유닛 패 복귀' },
                { pass: p2.hand.some((card: Card) => card.id.startsWith('ST11-006')), message: '대상 유닛 패 복귀 확인' },
                { pass: p2.hand.some((card: Card) => card.id.startsWith('ST11-017')), message: '장착 아이템 패 복귀 확인' },
                { pass: p2.unitZones[1].unit?.id.startsWith('ST11-011') === true, message: '비최저코스트 유닛 유지' },
            ];
        }
    },
    {
        testId: 'ST11-013',
        name: '테라 드레인 +1000 유지/해제',
        description: '자신 유닛 1장을 +1000하고 상대 턴 종료에 해제된다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST11-013')];
            p1.unitZones[0].unit = getCard('ST11-006');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const base = p1.unitZones[0].unit?.power || 0;
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p1.id && action.zoneIndex === 0);
            if (pick) engine.step(pick);
            const buffed = engine.getUnitPower(p1.unitZones[0], p1);

            const afterOwnTurn = advanceUntil(
                engine,
                () => engine.currentPlayer.id === engine.state.players[1].id && engine.state.phase === Phase.LEVEL_UP,
                14
            );
            const stillBuffed = engine.getUnitPower(p1.unitZones[0], p1);

            const afterOppTurn = advanceUntil(
                engine,
                () => engine.currentPlayer.id === p1.id && engine.state.phase === Phase.LEVEL_UP,
                14
            );
            const removed = engine.getUnitPower(p1.unitZones[0], p1);

            return [
                { pass: buffed === base + 1000, message: '+1000 적용' },
                { pass: afterOwnTurn && stillBuffed === base + 1000, message: '자신 턴 종료 후 유지' },
                { pass: afterOppTurn && removed === base, message: '상대 턴 종료 후 해제' },
            ];
        }
    },
    {
        testId: 'ST11-014',
        name: '아쿠아 브레이크 2드로우',
        description: '스킬 사용 시 카드를 2장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST11-014')];
            p1.deck = [getCard('ST01-002'), getCard('ST11-006')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            return [
                { pass: p1.hand.length === 2, message: '2드로우 완료' },
            ];
        }
    },
    {
        testId: 'ST11-015',
        name: '월야호담 트래시 유닛 회수',
        description: '트래시 존의 유닛 1장을 패로 회수한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST11-015')];
            p1.trash = [getCard('ST11-006')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_TRASH_TARGET');
            if (pick) engine.step(pick);
            return [
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST11-006')), message: '유닛 회수 성공' },
            ];
        }
    },
    {
        testId: 'ST11-016',
        name: '블랙 오더 대상 방어 불가',
        description: '지정한 상대 유닛은 이 턴 동안 공격을 방어할 수 없다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST11-016')];
            p1.unitZones[0].unit = getCard('ST11-006');
            p2.unitZones[0].unit = getCard('ST11-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const beforeDamage = p2.damage.length;

            engine.playSkill(0);
            const pick = findAction(engine, p1.id, 'SELECT_ZONE_TARGET', (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0);
            if (pick) engine.step(pick);

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);

            return [
                { pass: p2.damage.length === beforeDamage + 1, message: '방어 불가로 직접 피해 1' },
                { pass: p2.unitZones[0].unit !== null, message: '방어 전투 미발생으로 대상 유닛 잔존' },
            ];
        }
    },
    {
        testId: 'ST11-016-Trigger',
        name: '블랙 오더 트리거 리더 레벨 이하 유닛 회수',
        description: '대미지 트리거 시 자신은 트래시되고 리더 레벨 이하 유닛 1장을 트래시에서 패로 회수한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.leaderLevel = 3;
            p1.deck = [getCard('ST11-016')];
            p1.trash = [getCard('ST11-006'), getCard('ST11-012')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.dealDamage(p1, 1);
            const pickLow = findAction(
                engine,
                p1.id,
                'SELECT_TRASH_TARGET',
                (action: any) => p1.trash[action.trashIndex]?.id.startsWith('ST11-006')
            );
            if (pickLow) engine.step(pickLow);

            return [
                { pass: !!pickLow, message: '리더 레벨 이하 대상 선택' },
                { pass: p1.hand.some((card: Card) => card.id.startsWith('ST11-006')), message: '리더 레벨 이하 유닛 회수' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST11-016')), message: '트리거 카드 트래시 이동' },
                { pass: p1.damage.every((card: Card) => !card.id.startsWith('ST11-016')), message: '트리거 카드 대미지존 이탈' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST11-012')), message: '리더 레벨 초과 유닛 미회수' },
            ];
        }
    },
    {
        testId: 'ST11-017',
        name: '독사의 손길 양측 1드로우',
        description: '아이템 액티브 메인으로 자신과 상대가 각각 1장 드로우한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.leaderLevel = 10;
            p1.hand = [getCard('ST11-017')];
            p1.unitZones[0].unit = getCard('ST11-006');
            p1.deck = [getCard('ST01-002')];

            p2.hand = [];
            p2.deck = [getCard('ST01-002')];

            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playItem(0, 0);
            engine.activateEffect(0, 0, 'ITEM', 0);
            return [
                { pass: p1.hand.length === 1, message: '자신 1드로우' },
                { pass: p2.hand.length === 1, message: '상대 1드로우' },
            ];
        }
    },
    {
        testId: 'ST11-017-Trigger',
        name: '독사의 손길 트리거 최저코스트 바운스',
        description: '대미지 트리거 시 자신은 트래시되고 최저코스트 상대 유닛과 장착 아이템을 패로 되돌린다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.deck = [getCard('ST11-017')];
            p2.hand = [];
            p2.unitZones[0].unit = getCard('ST11-006'); // low cost
            p2.unitZones[0].items = [getCard('ST11-017')];
            p2.unitZones[1].unit = getCard('ST11-011'); // high cost
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.dealDamage(p1, 1);
            const pickLow = findAction(
                engine,
                p1.id,
                'SELECT_ZONE_TARGET',
                (action: any) => action.targetPlayerId === p2.id && action.zoneIndex === 0
            );
            if (pickLow) engine.step(pickLow);

            return [
                { pass: !!pickLow, message: '최저코스트 대상 선택' },
                { pass: p1.damage.every((card: Card) => !card.id.startsWith('ST11-017')), message: '트리거 카드 대미지존 이탈' },
                { pass: p1.trash.some((card: Card) => card.id.startsWith('ST11-017')), message: '트리거 카드 트래시 이동' },
                { pass: p2.unitZones[0].unit === null, message: '최저코스트 상대 유닛 패 복귀' },
                { pass: p2.hand.some((card: Card) => card.id.startsWith('ST11-006')), message: '대상 유닛 패 복귀 확인' },
                { pass: p2.hand.some((card: Card) => card.id.startsWith('ST11-017')), message: '장착 아이템 패 복귀 확인' },
                { pass: p2.unitZones[1].unit?.id.startsWith('ST11-011') === true, message: '비최저코스트 유닛 유지' },
            ];
        }
    },
];

export const ST11Module: UnifiedTestModule = {
    packId: 'ST11',
    displayName: 'ST11 파도 스타터',
    tests,
};

export default tests;
