/**
 * ST10 Fire Starter Unified Tests
 */

import { UnifiedTestCase, UnifiedTestModule, Phase } from './types';

const tests: UnifiedTestCase[] = [
    {
        testId: 'ST10-001',
        name: '빌헬미나 리더 각성',
        description: '리더 레벨 5 이상에서 각성한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('ST10-001');
            p1.levelZone.isAwakened = false;
            p1.leaderLevel = 4;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.LEVEL_UP;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.nextPhase();
            return [
                { pass: p1.leaderLevel >= 5, message: `리더 레벨 증가 (${p1.leaderLevel})` },
                { pass: p1.levelZone?.isAwakened === true, message: '리더 각성 성공' }
            ];
        }
    },
    {
        testId: 'ST10-001-Active',
        name: '빌헬미나 리더 액티브 추가 공격',
        description: '공격 페이즈에 패 1장 코스트 후 3코 이하 유닛 1회 추가 공격.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.levelZone = getCard('ST10-001');
            p1.levelZone.isAwakened = true;
            p1.leaderLevel = 5;
            p1.hand = [getCard('ST01-002')];
            p1.unitZones[0].unit = getCard('ST10-005');
            p1.unitZones[1].unit = getCard('ST10-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.activateEffect(0, 1, 'LEADER');
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCostForPlayerId(0, p1.id);
            }
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p1.id);
            }

            engine.attack(0);
            const canAttackAgain = engine
                .getLegalActions(p1.id)
                .some(action => action.type === 'ATTACK' && action.attackerZoneIndex === 0);
            engine.attack(0);
            const canAttackThird = engine
                .getLegalActions(p1.id)
                .some(action => action.type === 'ATTACK' && action.attackerZoneIndex === 0);

            return [
                { pass: canAttackAgain, message: '추가 공격 가능' },
                { pass: !canAttackThird, message: '2회 공격 후 추가 불가' }
            ];
        }
    },
    {
        testId: 'ST10-002',
        name: '로빈 후드 제니스 엔트리 선택 버림+드로우',
        description: '엔트리 선택 시 패 1장 트래시 후 1드로우.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('ST10-002'), getCard('ST01-002')];
            p1.deck = [getCard('ST10-005')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                const confirm = engine
                    .getLegalActions(p1.id)
                    .find(action => action.type === 'RESOLVE_OPTIONAL' && action.confirm) as any;
                if (confirm) engine.step(confirm);
            }
            if (engine.state.interactionMode === 'SELECT_COST') {
                engine.selectCostForPlayerId(0, p1.id);
            }
            return [
                { pass: p1.hand.some(card => card.id.startsWith('ST10-005')), message: '드로우 성공' },
                { pass: p1.trash.some(card => card.id.startsWith('ST01-002')), message: '패 트래시 성공' }
            ];
        }
    },
    {
        testId: 'ST10-003',
        name: '사막의 꽃 실비아 전투 종료 자해',
        description: '공격/방어 전투 종료 시 자신을 트래시한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST10-003');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.attack(0);
            return [
                { pass: p1.unitZones[0].unit === null, message: '전투 종료 후 자기 트래시' },
                { pass: p1.trash.some(card => card.id.startsWith('ST10-003')), message: '트래시에 이동' }
            ];
        }
    },
    {
        testId: 'ST10-003-Entry',
        name: '사막의 꽃 실비아 엔트리 조우 시 즉시 공격',
        description: '엔트리 시 조우 유닛이 있으면 즉시 공격 선언.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('ST10-003')];
            p2.unitZones[0].unit = getCard('ST10-005');
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playUnit(0, 0);
            const blockAction = engine
                .getLegalActions(p2.id)
                .find(action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock && action.blockerZoneIndex === 0) as any;
            if (blockAction) engine.step(blockAction);
            return [
                { pass: !!blockAction, message: '듀얼리스트로 조우 방어 진행' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 전투 트래시' },
                { pass: p1.unitZones[0].unit === null && p1.trash.some(card => card.id.startsWith('ST10-003')), message: '전투 종료 패시브로 자기 트래시' },
                { pass: engine.state.combatStep === 'NONE', message: '전투 단계 정상 종료' },
                { pass: engine.state.phase === Phase.MAIN, message: `자동 공격 후 원래 페이즈 복귀 (${engine.state.phase})` }
            ];
        }
    },
    {
        testId: 'ST10-004',
        name: '암흑 성녀 리베르타 체인 유닛 탐색',
        description: '덱 위 3장 공개 후 체인 유닛 1장 패, 나머지 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('ST10-004')];
            p1.deck = [getCard('ST01-002'), getCard('ST10-005'), getCard('ST10-006')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playUnit(0, 0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const pick = engine.state.revealedCards.findIndex(card => card.id.startsWith('ST10-006'));
                if (pick >= 0) engine.selectRevealedTarget(pick);
            }
            return [
                { pass: p1.hand.some(card => card.id.startsWith('ST10-006')), message: '체인 유닛 패 획득' },
                { pass: p1.trash.some(card => card.id.startsWith('ST10-005')), message: '비선택 카드 트래시' }
            ];
        }
    },
    {
        testId: 'ST10-005',
        name: '창조의 모루 레일라 어태커 +2000',
        description: '어태커 시 +2000으로 3000 조우를 이긴다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST10-005');
            p2.unitZones[0].unit = getCard('ST10-008'); // 3000
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.attack(0);
            const block = engine
                .getLegalActions(p2.id)
                .find(action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock && action.blockerZoneIndex === 0) as any;
            if (block) engine.step(block);
            return [
                { pass: p1.unitZones[0].unit !== null, message: '공격 유닛 생존' },
                { pass: p2.unitZones[0].unit === null, message: '조우 유닛 트래시' }
            ];
        }
    },
    {
        testId: 'ST10-006',
        name: '사도 블레이드 어태커 아군 버프',
        description: '공격 시 다른 아군 유닛 1장 +2000.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST10-006');
            p1.unitZones[1].unit = getCard('ST10-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const before = engine.getUnitPower(p1.unitZones[1], p1);
            engine.attack(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(1, p1.id);
            }
            const after = engine.getUnitPower(p1.unitZones[1], p1);
            return [
                { pass: after === before + 2000, message: `다른 아군 +2000 (${after})` }
            ];
        }
    },
    {
        testId: 'ST10-007',
        name: '사막의 가시 루비아 액티브 조건부 부여',
        description: '부여 효과는 상대 턴 종료까지 유지, 공격 중 파워 버프는 전투 종료 시 해제.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST10-007');
            p1.skillZone = [getCard('ST10-015')];
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.activateEffect(0, 0);
            const hasGranted = p1.unitZones[0].temporaryEffects.some(
                effect => effect.description.includes('파워+2000') && effect.duration === 'OPP_TURN_END'
            );

            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            const passBlock = engine
                .getLegalActions(p2.id)
                .find(action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock === false) as any;
            if (passBlock) engine.step(passBlock);

            const buffAfterBattle = p1.unitZones[0].buffs.find(buff => buff.type === 'POWER' && buff.value === 2000);
            const grantedAfterBattle = p1.unitZones[0].temporaryEffects.some(effect => effect.description.includes('파워+2000'));
            const isLevelUpPhase = () => (engine.state.phase as Phase) === Phase.LEVEL_UP;

            let guard = 0;
            while (!(engine.currentPlayer.id === p2.id && isLevelUpPhase()) && guard < 12) {
                engine.nextPhase();
                guard += 1;
            }
            const grantedAfterOwnTurnEnd = p1.unitZones[0].temporaryEffects.some(effect => effect.description.includes('파워+2000'));

            guard = 0;
            while (!(engine.currentPlayer.id === p1.id && isLevelUpPhase()) && guard < 12) {
                engine.nextPhase();
                guard += 1;
            }
            const grantedAfterOppTurnEnd = p1.unitZones[0].temporaryEffects.some(effect => effect.description.includes('파워+2000'));

            return [
                { pass: hasGranted, message: '조건 충족 시 OPP_TURN_END 어태커 효과 부여' },
                { pass: !buffAfterBattle, message: '전투 종료 시 +2000 버프 해제' },
                { pass: grantedAfterBattle, message: '전투 종료 후에도 부여 효과 유지' },
                { pass: grantedAfterOwnTurnEnd, message: '자신 턴 종료 후에도 부여 효과 유지' },
                { pass: !grantedAfterOppTurnEnd, message: '상대 턴 종료 후 부여 효과 해제' }
            ];
        }
    },
    {
        testId: 'ST10-008',
        name: '하얀 사신 유스티아 체인 조우 -3000',
        description: '턴 중 2번째 공격부터 조우 유닛 -3000.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST10-005');
            p1.unitZones[1].unit = getCard('ST10-008');
            p2.unitZones[1].unit = getCard('ST10-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            engine.attack(0);
            const before = engine.getUnitPower(p2.unitZones[1], p2);
            engine.attack(1);
            const zone = p2.unitZones[1];
            const after = engine.getUnitPower(zone, p2);
            return [
                { pass: zone.unit === null || after === before - 3000, message: '체인 -3000 반영' }
            ];
        }
    },
    {
        testId: 'ST10-009',
        name: '로데브의 별 리아트리스 엔트리 전원 어태커 +1000',
        description: '아군 전 유닛에 어태커 +1000을 부여한다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('ST10-009')];
            p1.unitZones[1].unit = getCard('ST10-006'); // 2500
            p2.unitZones[1].unit = getCard('ST10-008'); // 3000
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playUnit(0, 0);
            engine.state.phase = Phase.ATTACK;
            engine.attack(1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p1.id);
            }
            const block = engine
                .getLegalActions(p2.id)
                .find(action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock && action.blockerZoneIndex === 1) as any;
            if (block) engine.step(block);
            return [
                { pass: p1.unitZones[1].unit !== null, message: '버프 적용 공격 유닛 생존' },
                { pass: p2.unitZones[1].unit === null, message: '3000 조우 유닛 트래시' }
            ];
        }
    },
    {
        testId: 'ST10-010',
        name: '해변의 천사 테레제 체인 히트+1',
        description: '2번째 공격 조건 충족 시 해당 공격 히트 +1.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.unitZones[0].unit = getCard('ST10-005');
            p1.unitZones[1].unit = getCard('ST10-010');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            engine.attack(0); // 첫 공격
            const beforeSecond = p2.damage.length;
            engine.attack(1); // 두 번째 공격 (히트+1)
            const secondDamage = p2.damage.length - beforeSecond;
            return [
                { pass: secondDamage === 2, message: `2번째 공격 대미지 2 (${secondDamage})` }
            ];
        }
    },
    {
        testId: 'ST10-011',
        name: '강철의 군주 빌헬미나(유닛) 체인3 돌파',
        description: '3번째 공격 조건에서 돌파를 얻어 조우를 무시하고 직접 대미지.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST10-005');
            p1.unitZones[1].unit = getCard('ST10-005');
            p1.unitZones[2].unit = getCard('ST10-011');
            p2.unitZones[2].unit = getCard('ST10-012');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            engine.attack(0);
            engine.attack(1);
            const beforeThird = p2.damage.length;
            engine.attack(2);
            const thirdDamage = p2.damage.length - beforeThird;
            return [
                { pass: thirdDamage === 2, message: `3번째 공격 직접 대미지 2 (${thirdDamage})` },
                { pass: p2.unitZones[2].unit !== null, message: '조우 유닛 비전투 유지(돌파)' }
            ];
        }
    },
    {
        testId: 'ST10-011-Trigger',
        name: '강철의 군주 빌헬미나(유닛) 트리거 패 복귀',
        description: '대미지 트리거 시 패로 복귀.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST10-011')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(card => card.id.startsWith('ST10-011')), message: '트리거 패 복귀' }
            ];
        }
    },
    {
        testId: 'ST10-012',
        name: '미궁의 문지기 네브리스 듀얼리스트 강제 조우 방어',
        description: '듀얼리스트 공격 시 조우 레인 방어만 허용.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST10-012');
            p2.unitZones[0].unit = getCard('ST10-005');
            p2.unitZones[1].unit = getCard('ST04-003'); // 가디언
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p2 = engine.state.players[1];
            engine.attack(0);
            const blockActions = engine
                .getLegalActions(p2.id)
                .filter(action => action.type === 'RESOLVE_BLOCK' && action.shouldBlock) as any[];
            const onlyEncounter = blockActions.every(action => action.blockerZoneIndex === 0);
            return [
                { pass: onlyEncounter, message: '듀얼리스트로 조우 방어 강제' }
            ];
        }
    },
    {
        testId: 'ST10-013',
        name: '짐이 곧 베이룬이다 메인 효과',
        description: '상대 -1000 후 선택적으로 자신 유닛 트래시.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('ST10-013')];
            p1.unitZones[0].unit = getCard('ST10-005');
            p2.unitZones[0].unit = getCard('ST10-005');
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            const before = engine.getUnitPower(p2.unitZones[0], p2);
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p2.id);
            }
            if (engine.state.interactionMode === 'SELECT_OPTIONAL') {
                const confirm = engine
                    .getLegalActions(p1.id)
                    .find(action => action.type === 'RESOLVE_OPTIONAL' && action.confirm) as any;
                if (confirm) engine.step(confirm);
            }
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p1.id);
            }
            return [
                { pass: p1.unitZones[0].unit === null, message: '선택적 자신 유닛 트래시' },
                { pass: engine.getUnitPower(p2.unitZones[0], p2) === before - 1000, message: '상대 파워 -1000' }
            ];
        }
    },
    {
        testId: 'ST10-013-Trigger',
        name: '짐이 곧 베이룬이다 트리거 패 복귀',
        description: '대미지 트리거 시 패로 복귀.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST10-013')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(card => card.id.startsWith('ST10-013')), message: '트리거 패 복귀' }
            ];
        }
    },
    {
        testId: 'ST10-014',
        name: '다, 당당하게 노출을! 메인 회수 제한',
        description: '손패 장수 기반 코스트 합 제한 + 자기 카드 ID 제외.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            p1.hand = [getCard('ST10-014'), getCard('ST01-002')]; // 사용 후 손패 1장
            p1.trash = [getCard('ST10-014'), getCard('ST01-002'), getCard('ST10-006')];
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.playSkill(0);
            const legal = engine
                .getLegalActions(p1.id)
                .filter(action => action.type === 'SELECT_TRASH_TARGET') as any[];
            const selectableIds = legal.map(action => p1.trash[action.trashIndex]?.id);
            const hasSelf = selectableIds.some((id: string) => id?.startsWith('ST10-014'));
            const hasLow = selectableIds.some((id: string) => id?.startsWith('ST01-002'));
            const hasHigh = selectableIds.some((id: string) => id?.startsWith('ST10-006'));
            if (legal.length > 0) {
                const pickLow = legal.find(action => p1.trash[action.trashIndex]?.id.startsWith('ST01-002'));
                if (pickLow) engine.step(pickLow);
            }
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const confirm = engine.getLegalActions(p1.id).find(action => action.type === 'CONFIRM_TARGETS') as any;
                if (confirm) engine.step(confirm);
            }
            return [
                { pass: hasLow, message: '저코 카드 선택 가능' },
                { pass: !hasSelf, message: '동명 카드 선택 불가' },
                { pass: !hasHigh, message: '코스트 합 제한 초과 카드 제외' }
            ];
        }
    },
    {
        testId: 'ST10-014-Trigger',
        name: '다, 당당하게 노출을! 트리거 스킬 회수',
        description: '자기 자신 트래시 후 리더 레벨 이하 스킬 1장 회수.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.leaderLevel = 3;
            p1.deck = [getCard('ST10-014')];
            p1.trash = [getCard('ST10-013'), getCard('ST10-015')]; // 0,4
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                const pick = engine
                    .getLegalActions(p1.id)
                    .find(action => action.type === 'SELECT_TRASH_TARGET' && p1.trash[(action as any).trashIndex]?.id.startsWith('ST10-013')) as any;
                if (pick) engine.step(pick);
            }
            return [
                { pass: p1.hand.some(card => card.id.startsWith('ST10-013')), message: '리더 레벨 이하 스킬 회수' },
                { pass: p1.damage.every(card => !card.id.startsWith('ST10-014')), message: '트리거 카드 대미지존 이탈' }
            ];
        }
    },
    {
        testId: 'ST10-015',
        name: '심연의 응시 유닛 회수',
        description: '트래시의 유닛 1장을 패로 회수.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.hand = [getCard('ST10-015')];
            p1.trash = [getCard('ST10-005')];
            p1.leaderLevel = 10;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectTrashTarget(0);
            }
            return [
                { pass: p1.hand.some(card => card.id.startsWith('ST10-005')), message: '유닛 회수 성공' }
            ];
        }
    },
    {
        testId: 'ST10-016',
        name: '피의 기사 메인 잠금 + 조우 트래시 부여',
        description: '동명 스킬 턴중 재발동 금지 + 대상 유닛에 조우 트래시 부여.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.hand = [getCard('ST10-016'), getCard('ST10-016')];
            p1.unitZones[0].unit = getCard('ST10-005');
            p2.unitZones[0].unit = getCard('ST10-005');
            p1.leaderLevel = 10;
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            engine.playSkill(0);
            if (engine.state.interactionMode === 'SELECT_TARGET') {
                engine.selectZoneTargetByPlayerId(0, p1.id);
            }
            const canPlaySecond = engine
                .getLegalActions(p1.id)
                .some(action => action.type === 'PLAY_SKILL' && p1.hand[(action as any).handIndex]?.id.startsWith('ST10-016'));
            engine.state.phase = Phase.ATTACK;
            engine.attack(0);
            return [
                { pass: !canPlaySecond, message: '동명 스킬 재발동 잠금' },
                { pass: p2.unitZones[0].unit === null, message: '부여 효과로 조우 유닛 트래시' }
            ];
        }
    },
    {
        testId: 'ST10-016-Trigger',
        name: '피의 기사 트리거 패 복귀',
        description: '대미지 트리거 시 패로 복귀.',
        setup: (engine, getCard) => {
            const p1 = engine.currentPlayer;
            p1.deck = [getCard('ST10-016')];
            engine.state.phase = Phase.MAIN;
        },
        verify: (engine) => {
            const p1 = engine.currentPlayer;
            engine.dealDamage(p1, 1);
            return [
                { pass: p1.hand.some(card => card.id.startsWith('ST10-016')), message: '트리거 패 복귀' }
            ];
        }
    },
    {
        testId: 'ST10-017',
        name: '악룡의 마검 공격 횟수 참조 +1',
        description: '공격 횟수 참조 효과가 1회 더 공격한 것으로 계산된다.',
        setup: (engine, getCard) => {
            const p1 = engine.state.players[0];
            const p2 = engine.state.players[1];
            p1.unitZones[0].unit = getCard('ST10-006');
            p1.unitZones[0].items = [getCard('ST10-017')];
            p2.unitZones[0].unit = getCard('ST10-005');
            engine.state.turnPlayerIndex = 0;
            engine.state.phase = Phase.ATTACK;
        },
        verify: (engine) => {
            const p1 = engine.state.players[0];
            engine.attack(0);
            const plunder = p1.unitZones[0].buffs.find(buff => buff.type === 'PLUNDER');
            return [
                { pass: plunder?.value === 1, message: '공격 횟수 보정으로 체인 충족' }
            ];
        }
    },
];

export const ST10Module: UnifiedTestModule = {
    packId: 'ST10',
    displayName: 'ST10 화염 스타터',
    tests
};

export default tests;
