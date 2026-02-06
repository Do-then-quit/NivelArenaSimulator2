import { CardTestModule } from '../types';
import { Phase } from '../../types';

export const BT01EarthTests: CardTestModule = {
    setupScenarios: {
        'BT01-028': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 4;
            p1.levelZone = ctx.getCard('BT01-028');
            if (p1.levelZone) p1.levelZone.isAwakened = false;
            p1.unitZones[0].unit = ctx.getCard('BT01-034'); // 베이스 유닛
            p1.unitZones[0].unit!.traits = '베이스';
            ctx.engine.state.phase = Phase.LEVEL_UP;
            return "시나리오: 홍련 리더 (레벨 4). 지시사항: 레벨업 → 리더 각성 → 베이스 유닛 +1000 확인.";
        },
        'BT01-030': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.unitZones[0].unit = ctx.getCard('BT01-030');
            p1.unitZones[1].unit = ctx.getCard('ST01-002');
            p1.unitZones[2].unit = ctx.getCard('ST01-002');
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 미카 (전선구축 +3000). 지시사항: 3개 유닛 존 모두 유닛 배치. 미카 파워 +3000 확인.";
        },
        'BT01-032': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            // 베이스 유닛 2장 배치
            p1.unitZones[0].unit = ctx.getCard('BT01-032');
            const u1 = ctx.getCard('ST01-002');
            u1.traits = '베이스';
            p1.unitZones[1].unit = u1;
            const u2 = ctx.getCard('ST01-002');
            u2.traits = '베이스';
            p1.unitZones[2].unit = u2;
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 신 (베이스 수 × 500). 지시사항: 베이스 유닛 2장 배치. 신 파워 +1000 (500×2) 확인.";
        },
        'BT01-035': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.unitZones[0].unit = ctx.getCard('BT01-035');
            p2.unitZones[0].unit = ctx.getCard('ST01-002');
            p2.unitZones[0].unit!.cost = 1;
            ctx.engine.state.phase = Phase.ATTACK;
            return "시나리오: 솔린 (어태커 돌파[1코스트 이하]). 지시사항: 공격 → 상대 1코스트 유닛은 방어 불가.";
        },
        'BT01-040': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = ctx.getCard('BT01-040');
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 루피:윈터 쇼퍼 (레벨×500, 레벨링크[10:히트+1]). 지시사항: 리더 레벨 10 → 파워 +5000, 히트 +1 확인.";
        },
        'BT01-044': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 7;
            p1.hand = [ctx.getCard('BT01-044')];
            // 덱에 베이스 유닛 넣기
            const u1 = ctx.getCard('ST01-002');
            u1.traits = '베이스';
            const u2 = ctx.getCard('ST01-002');
            const u3 = ctx.getCard('ST01-002');
            u3.traits = '베이스';
            p1.deck = [u1, u2, u3];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 라푼젤 (엔트리: 덱 3장 공개 → 베이스 1장 패로). 지시사항: 라푼젤 배치 → 공개 카드 중 베이스 선택.";
        },
        'BT01-047': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 10;
            const u = ctx.getCard('ST01-002');
            u.traits = '베이스';
            u.cost = 1;
            p1.unitZones[0].unit = u;
            p1.hand = [ctx.getCard('BT01-047')];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 순백의 의지 (스킬: 베이스 1코스트 유닛 히트=2). 지시사항: 스킬 사용 → 베이스 1코스트 선택 → 히트 2 확인.";
        },
        'BT01-048': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            p1.unitZones[1].unit = ctx.getCard('ST01-002');
            p1.hand = [ctx.getCard('BT01-048')];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 파란 나비의 꿈 (스킬: 전체 +500). 지시사항: 스킬 사용 → 모든 자신 유닛 +500 확인.";
        },
        'BT01-049': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 10;
            const u1 = ctx.getCard('ST01-002');
            u1.traits = '베이스';
            p1.unitZones[0].unit = u1;
            const u2 = ctx.getCard('ST01-002');
            u2.traits = '베이스';
            p1.unitZones[1].unit = u2;
            p1.hand = [ctx.getCard('BT01-049')];
            p1.deck = [ctx.getCard('ST01-002'), ctx.getCard('ST01-002'), ctx.getCard('ST01-002')];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 디저트 타임 (스킬: 베이스 수만큼 드로우). 지시사항: 스킬 사용 → 베이스 2장 → 드로우 2 확인.";
        },
        'BT01-050': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            p1.unitZones[1].unit = ctx.getCard('ST01-002');
            p1.unitZones[2].unit = ctx.getCard('ST01-002');
            p1.hand = [ctx.getCard('BT01-050')];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 설온제 (스킬: 전선구축 시 전체 +1500). 지시사항: 3존 유닛 모두 있음 → 스킬 사용 → 전체 +1500.";
        },
        'BT01-053': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.leaderLevel = 5;
            const u = ctx.getCard('ST01-002');
            u.cost = 3;
            p1.unitZones[0].unit = u;
            p1.unitZones[0].items = [ctx.getCard('BT01-053')];
            p2.unitZones[0].unit = ctx.getCard('ST01-002');
            p2.unitZones[0].unit!.cost = 2;
            ctx.engine.state.phase = Phase.ATTACK;
            return "시나리오: 갓데시움 프로텍터 (아이템: 돌파[2코스트 이하]). 지시사항: 공격 → 2코스트 이하 방어 불가.";
        },
    },
    runTests: {
        'BT01-028': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const baseZone = p1.unitZones[0];
            const basePower = ctx.engine.getUnitPower(baseZone, p1);
            ctx.engine.nextPhase(); // Level up triggers awakening
            ctx.assert(!!p1.levelZone?.isAwakened, "리더가 레벨 5에서 각성");
            ctx.assert(ctx.engine.getUnitPower(baseZone, p1) === basePower + 1000, "베이스 유닛 +1000");
        },
        'BT01-030': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const power = ctx.engine.getUnitPower(p1.unitZones[0], p1);
            // 전선구축 조건 충족 (3존 모두 유닛)
            ctx.assert(power >= 5000, "전선구축 +3000 적용");
        },
        'BT01-032': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const power = ctx.engine.getUnitPower(p1.unitZones[0], p1);
            const basePower = p1.unitZones[0].unit!.power || 0;
            ctx.assert(power === basePower + 1000, "베이스 2개 × 500 = +1000");
        },
        'BT01-040': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const basePower = p1.unitZones[0].unit!.power || 0;
            const power = ctx.engine.getUnitPower(p1.unitZones[0], p1);
            ctx.assert(power === basePower + 5000, "레벨 10 × 500 = +5000");
            const hit = ctx.engine.getUnitHit(p1.unitZones[0], p1);
            ctx.assert(hit >= 3, "레벨링크[10:히트+1] 적용");
        },
        'BT01-048': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const basePower0 = ctx.engine.getUnitPower(p1.unitZones[0], p1);
            const basePower1 = ctx.engine.getUnitPower(p1.unitZones[1], p1);
            ctx.engine.playSkill(0);
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[0], p1) === basePower0 + 500, "유닛 0 +500");
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[1], p1) === basePower1 + 500, "유닛 1 +500");
        },
        'BT01-049': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const initialHand = p1.hand.length;
            ctx.engine.playSkill(0);
            ctx.assert(p1.hand.length === initialHand + 1, "베이스 2개 → 드로우 2 (스킬카드 제외)");
        },
        'BT01-050': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const basePower = ctx.engine.getUnitPower(p1.unitZones[0], p1);
            ctx.engine.playSkill(0);
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[0], p1) === basePower + 1500, "전선구축 전체 +1500");
        },
    }
};
