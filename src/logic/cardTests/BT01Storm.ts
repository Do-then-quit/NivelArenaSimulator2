import { CardTestModule } from './types';
import { Phase } from '../types';

export const BT01StormTests: CardTestModule = {
    setupScenarios: {
        'BT01-055': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 4;
            p1.levelZone = ctx.getCard('BT01-055');
            if (p1.levelZone) p1.levelZone.isAwakened = false;
            const u = ctx.getCard('ST01-002');
            u.cost = 5;
            p1.unitZones[0].unit = u;
            p1.deck = [ctx.getCard('ST01-002'), ctx.getCard('ST01-002')];
            ctx.engine.state.phase = Phase.LEVEL_UP;
            return "시나리오: 신데렐라 리더 (각성 후 5코스트 이상 트래시 시 드로우). 지시사항: 레벨업 → 5코스트 유닛 트래시 → 드로우 1 확인.";
        },
        'BT01-056': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.unitZones[0].unit = ctx.getCard('BT01-056');
            p2.unitZones[0].unit = ctx.getCard('ST01-002');
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 에테르 (엑시트: 상대 유닛 -2000). 지시사항: 이 유닛 트래시 → 상대 유닛 -2000.";
        },
        'BT01-058': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            p1.unitZones[0].unit!.power = 10000;
            p2.unitZones[0].unit = ctx.getCard('BT01-058');
            ctx.engine.state.phase = Phase.ATTACK;
            return "시나리오: 메이든 (디펜더 종결). 지시사항: 공격 → 방어 선언 → 전투 종료, 방어 유닛 트래시.";
        },
        'BT01-067': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            p1.unitZones[0].unit!.power = 10000;
            p1.unitZones[0].unit!.cost = 3;
            p2.unitZones[0].unit = ctx.getCard('BT01-067');
            p2.unitZones[0].unit!.cost = 4;
            p2.unitZones[0].unit!.power = 1000;
            ctx.engine.state.phase = Phase.ATTACK;
            return "시나리오: 목단 (엑시트 공멸). 지시사항: 공격 → 방어 → 목단 트래시 → 공격자(코스트 3 ≤ 4) 도 트래시.";
        },
        'BT01-068': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.unitZones[0].unit = ctx.getCard('BT01-068');
            p1.deck = [ctx.getCard('ST01-002'), ctx.getCard('ST01-002'), ctx.getCard('ST01-002')];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: D:킬러 와이프 (엑시트: 2드로우, 1버림). 지시사항: 유닛 트래시 → 2드로우 → 1장 선택 버림.";
        },
        'BT01-070': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            p1.unitZones[0].unit!.power = 10000;
            p2.unitZones[0].unit = ctx.getCard('BT01-070');
            ctx.engine.state.phase = Phase.ATTACK;
            return "시나리오: 길로틴 (디펜더 종결). 지시사항: 공격 → 방어 → 전투 종료, 방어 유닛 트래시.";
        },
        'BT01-071': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 7;
            p1.hand = [ctx.getCard('BT01-071')];
            p1.unitZones[1].unit = ctx.getCard('ST01-002');
            p1.deck = [ctx.getCard('ST01-002'), ctx.getCard('ST01-002')];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 로산나:시크 오션 (엔트리: 아군 트래시 + 드로우). 지시사항: 로산나 배치 → 아군 유닛 선택 트래시 → 드로우 1.";
        },
        'BT01-072': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.unitZones[0].unit = ctx.getCard('BT01-072');
            p1.unitZones[1].unit = ctx.getCard('ST01-002');
            p1.deck = [ctx.getCard('ST01-002'), ctx.getCard('ST01-002')];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 모더니아 (패시브: 다른 유닛에 엑시트 드로우 부여). 지시사항: 다른 유닛 트래시 → 드로우 1 확인.";
        },
        'BT01-076': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 10;
            const u = ctx.getCard('BT01-067');
            u.keywords = ['엑시트'];
            p1.unitZones[0].unit = u;
            p1.hand = [ctx.getCard('BT01-076')];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 마계흑룡파 (스킬: 공멸 유닛 +4500). 지시사항: 스킬 → 공멸 유닛 선택 → +4500.";
        },
        'BT01-079': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 10;
            const u1 = ctx.getCard('ST01-002');
            u1.keywords = ['엑시트'];
            u1.cost = 2;
            const u2 = ctx.getCard('ST01-002');
            u2.keywords = ['엑시트'];
            u2.cost = 1;
            p1.trash = [u1, u2];
            p1.hand = [ctx.getCard('BT01-079')];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: EX 매거진 (스킬: 엑시트 2코스트 이하 2장 회수). 지시사항: 스킬 → 트래시에서 2장 선택 → 패로.";
        },
        'BT01-080': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            p1.unitZones[0].items = [ctx.getCard('BT01-080')];
            p1.deck = [ctx.getCard('ST01-002'), ctx.getCard('ST01-002'), ctx.getCard('ST01-002')];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 갓데시움 바이저 (아이템: 엑시트 드로우 2). 지시사항: 유닛 트래시 → 드로우 2.";
        },
        'BT01-081': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const u = ctx.getCard('ST01-002');
            u.keywords = ['엑시트'];
            p1.unitZones[0].unit = u;
            p1.unitZones[0].items = [ctx.getCard('BT01-081')];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 티탄 매터 부츠 (아이템: 엑시트 귀환). 지시사항: 유닛 트래시 → 턴 종료 시 패로 복귀.";
        },
    },
    runTests: {
        'BT01-055': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            ctx.engine.nextPhase(); // Level up triggers awakening
            ctx.assert(!!p1.levelZone?.isAwakened, "리더 각성");
            const initHand = p1.hand.length;
            ctx.engine.destroyUnit(p1, p1.unitZones[0]);
            ctx.assert(p1.hand.length === initHand + 1, "5코스트 트래시 시 드로우");
        },
        'BT01-056': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            const basePower = ctx.engine.getUnitPower(p2.unitZones[0], p2);
            ctx.engine.destroyUnit(p1, p1.unitZones[0]);
            if (ctx.engine.state.interactionMode === 'SELECT_TARGET') {
                ctx.engine.selectTarget(0, true);
            }
            ctx.assert(ctx.engine.getUnitPower(p2.unitZones[0], p2) === basePower - 2000, "상대 유닛 -2000");
        },
        'BT01-058': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.attack(0);
            ctx.engine.resolveBlock(true);
            ctx.assert(p2.unitZones[0].unit === null, "방어 유닛 종결로 트래시");
            ctx.assert(p1.unitZones[0].unit !== null, "공격 유닛 생존");
        },
        'BT01-067': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.attack(0);
            ctx.engine.resolveBlock(true);
            ctx.assert(p2.unitZones[0].unit === null, "방어 유닛 트래시");
            ctx.assert(p1.unitZones[0].unit === null, "공멸: 공격 유닛도 트래시");
        },
        'BT01-068': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const initHand = p1.hand.length;
            ctx.engine.destroyUnit(p1, p1.unitZones[0]);
            ctx.assert(p1.hand.length >= initHand + 1, "최소 1장 드로우 (2드로 - 1버림)");
        },
        'BT01-070': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.attack(0);
            ctx.engine.resolveBlock(true);
            ctx.assert(p2.unitZones[0].unit === null, "방어 유닛 종결로 트래시");
            ctx.assert(p1.unitZones[0].unit !== null, "공격 유닛 생존");
        },
        'BT01-080': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const initHand = p1.hand.length;
            ctx.engine.destroyUnit(p1, p1.unitZones[0]);
            ctx.assert(p1.hand.length === initHand + 2, "아이템 엑시트: 드로우 2");
        },
    }
};
