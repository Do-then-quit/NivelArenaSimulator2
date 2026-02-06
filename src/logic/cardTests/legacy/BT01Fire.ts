import { CardTestModule } from '../types';
import { Phase } from '../../types';

export const BT01FireTests: CardTestModule = {
    setupScenarios: {
        'BT01-001': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.levelZone = ctx.getCard('BT01-001');
            if (p1.levelZone) p1.levelZone.isAwakened = false;
            p1.unitZones[0].unit = ctx.getCard('BT01-002'); // Attacker unit
            ctx.engine.state.phase = Phase.LEVEL_UP;
            return "시나리오: 레드 후드 리더 (레벨 5). 지시사항: 'Next Phase'를 클릭하여 레벨업. 리더가 각성하고 어태커 유닛이 +2000 파워를 받는지 확인.";
        },
        'BT01-002': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.unitZones[0].unit = ctx.getCard('BT01-002');
            ctx.engine.state.phase = Phase.ATTACK;
            return "시나리오: 네온-블링 불렛 (어태커 +2000). 지시사항: 유닛으로 공격. 파워가 +2000인지 확인.";
        },
        'BT01-004': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.unitZones[0].unit = ctx.getCard('BT01-004');
            p1.unitZones[0].unit!.power = 5000;
            p2.unitZones[0].unit = ctx.getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            ctx.engine.state.phase = Phase.ATTACK;
            return "시나리오: 노이즈 (어태커 관통[1]). 지시사항: 공격 후 방어를 선택. 관통 대미지 1이 들어가는지 확인.";
        },
        'BT01-005': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.unitZones[0].unit = ctx.getCard('BT01-005');
            ctx.engine.state.phase = Phase.ATTACK;
            return "시나리오: 라피-클래식 바캉스 (광전사). 지시사항: 이 유닛은 반드시 공격해야 함. 턴 종료를 시도할 수 없는지 확인.";
        },
        'BT01-006': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.unitZones[0].unit = ctx.getCard('BT01-006');
            p2.unitZones[0].unit = ctx.getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            ctx.engine.state.phase = Phase.ATTACK;
            return "시나리오: 아니스 (어태커 +2000, 약탈[1]). 지시사항: 공격하여 상대 유닛 트래시. 카드 1장 드로우 확인.";
        },
        'BT01-011': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = ctx.getCard('BT01-011');
            p2.unitZones[0].unit = ctx.getCard('ST01-002');
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 네온:블루 오션 (액티브메인 -1500). 지시사항: 유닛 클릭 → Activate 버튼 → 상대 유닛 선택. 파워 -1500 확인.";
        },
        'BT01-012': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 5;
            p1.hand = [ctx.getCard('BT01-012')];
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 엠마-달링 레드 (엔트리: 어태커 효과 부여). 지시사항: 엠마를 배치. 모든 자신 유닛에 어태커 +1000 효과 확인.";
        },
        'BT01-017': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.leaderLevel = 7;
            p1.hand = [ctx.getCard('BT01-017')];
            p2.unitZones[0].unit = ctx.getCard('ST01-009');
            p2.unitZones[0].unit!.power = 7000;
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 바이퍼-샤인 오브 러브 (엔트리: 조우 유닛 파워 1000). 지시사항: 바이퍼 배치 → 조우 유닛 파워가 1000으로 변하는지 확인.";
        },
        'BT01-020': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            p1.leaderLevel = 10;
            p1.unitZones[0].unit = ctx.getCard('BT01-002');
            p1.hand = [ctx.getCard('BT01-020')];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 와일드 투스 (스킬: 어태커 유닛에 관통[1] 부여). 지시사항: 스킬 사용 → 유닛 선택 → 공격 시 관통 확인.";
        },
        'BT01-021': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.leaderLevel = 10;
            p2.unitZones[0].unit = ctx.getCard('ST01-002');
            p2.unitZones[1].unit = ctx.getCard('ST01-002');
            p1.hand = [ctx.getCard('BT01-021')];
            ctx.engine.state.phase = Phase.MAIN;
            return "시나리오: 포메이션 F.F (스킬: 상대 전체 -1000). 지시사항: 스킬 사용 → 모든 상대 유닛 파워 -1000 확인.";
        },
        'BT01-026': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            p1.unitZones[0].unit!.power = 5000;
            p1.unitZones[0].items = [ctx.getCard('BT01-026')];
            p2.unitZones[0].unit = ctx.getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            ctx.engine.state.phase = Phase.ATTACK;
            return "시나리오: 갓데시움 글러브 (아이템: 관통[1]). 지시사항: 공격 → 방어 → 관통 대미지 1 확인.";
        },
        'BT01-027': (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const p2 = ctx.engine.opponentPlayer;
            p1.leaderLevel = 5;
            p1.unitZones[0].unit = ctx.getCard('ST01-002');
            p1.unitZones[0].unit!.power = 5000;
            p1.unitZones[0].items = [ctx.getCard('BT01-027')];
            p2.unitZones[0].unit = ctx.getCard('ST01-002');
            p2.unitZones[0].unit!.power = 3000;
            ctx.engine.state.phase = Phase.ATTACK;
            return "시나리오: 노른 코드 고글 (아이템: +2000, 약탈[1]). 지시사항: 공격 → 방어 → 파워+2000, 드로우 1 확인.";
        },
    },
    runTests: {
        'BT01-001': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const baseZone = p1.unitZones[0];
            const basePower = ctx.engine.getUnitPower(baseZone, p1);
            ctx.engine.nextPhase(); // Level up triggers awakening
            ctx.assert(!!p1.levelZone?.isAwakened, "리더가 레벨 6에서 각성해야 함");
            ctx.assert(ctx.engine.getUnitPower(baseZone, p1) === basePower + 2000, "어태커 유닛 +2000");
        },
        'BT01-002': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const baseP = p1.unitZones[0].unit!.power || 0;
            ctx.engine.attack(0);
            ctx.assert(ctx.engine.getUnitPower(p1.unitZones[0], p1) === baseP + 2000, "어태커 +2000");
        },
        'BT01-004': async (ctx) => {
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.attack(0);
            ctx.engine.resolveBlock(true);
            ctx.assert(p2.damage.length === 1, "관통 대미지 1");
        },
        'BT01-006': async (ctx) => {
            const p1 = ctx.engine.currentPlayer;
            const initialHand = p1.hand.length;
            ctx.engine.attack(0);
            ctx.engine.resolveBlock(true);
            ctx.assert(p1.hand.length === initialHand + 1, "약탈로 드로우 +1");
        },
        'BT01-011': async (ctx) => {
            const p2 = ctx.engine.opponentPlayer;
            const basePower = ctx.engine.getUnitPower(p2.unitZones[0], p2);
            ctx.engine.activateEffect(0, 0);
            ctx.engine.selectTarget(0, true);
            ctx.assert(ctx.engine.getUnitPower(p2.unitZones[0], p2) === basePower - 1500, "상대 유닛 -1500");
        },
        'BT01-021': async (ctx) => {
            const p2 = ctx.engine.opponentPlayer;
            const basePower0 = ctx.engine.getUnitPower(p2.unitZones[0], p2);
            const basePower1 = ctx.engine.getUnitPower(p2.unitZones[1], p2);
            ctx.engine.playSkill(0);
            ctx.assert(ctx.engine.getUnitPower(p2.unitZones[0], p2) === basePower0 - 1000, "상대 유닛 0 -1000");
            ctx.assert(ctx.engine.getUnitPower(p2.unitZones[1], p2) === basePower1 - 1000, "상대 유닛 1 -1000");
        },
        'BT01-026': async (ctx) => {
            const p2 = ctx.engine.opponentPlayer;
            ctx.engine.attack(0);
            ctx.engine.resolveBlock(true);
            ctx.assert(p2.damage.length === 1, "관통 대미지 1 (아이템)");
        },
    }
};
