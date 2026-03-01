/**
 * SB01 Unified Tests
 */

import { UnifiedTestCase, UnifiedTestModule } from './types';
import { ActivationCondition } from '../../types';

function hasComplexMode(card: any, mode: string): boolean {
    return (card.effects || []).some((effect: any) =>
        effect?.action?.type === 'COMPLEX_ACTION' && effect?.action?.params?.mode === mode
    );
}

const tests: UnifiedTestCase[] = [
    {
        testId: 'SB01-001',
        name: '엔트리 스킬 트래시 디버프 모드 등록',
        description: 'SB01-001의 엔트리 복합 선택 모드가 등록되어 있다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-001');
            return [{ pass: hasComplexMode(card, 'SB01_001_ENTRY_PROMPT_SKILL_COST_DEBUFF'), message: 'SB01-001 복합 모드 존재' }];
        },
    },
    {
        testId: 'SB01-002',
        name: '어태커 관통 + 액티브 메인 버프 구성',
        description: 'SB01-002는 어태커 관통과 액티브 메인 버프 효과를 모두 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-002');
            const hasPen = card.effects?.some((e: any) => e.activation === ActivationCondition.ATTACKER && e.action?.type === 'PENETRATION');
            const hasActive = hasComplexMode(card, 'SB01_002_ACTIVE_MAIN_BUFF_ATTACKERS_BY_DISCARDED_COST');
            return [
                { pass: !!hasPen, message: '어태커 관통 효과 존재' },
                { pass: !!hasActive, message: '액티브 메인 버프 모드 존재' },
            ];
        },
    },
    {
        testId: 'SB01-003',
        name: '온킬 + 트리거 패 복귀 구성',
        description: 'SB01-003는 ON_KILL 복합 효과와 트리거 패 복귀를 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-003');
            const hasOnKill = hasComplexMode(card, 'SB01_003_ON_KILL_PROMPT_DISCARD_FOR_DAMAGE');
            const hasTrigger = card.effects?.some((e: any) => e.activation === ActivationCondition.DAMAGE_TRIGGER && e.action?.type === 'RETURN_TO_HAND');
            return [
                { pass: !!hasOnKill, message: 'ON_KILL 복합 모드 존재' },
                { pass: !!hasTrigger, message: '트리거 패 복귀 존재' },
            ];
        },
    },
    {
        testId: 'SB01-004',
        name: '효과 드로우 감시 대미지 모드 등록',
        description: 'SB01-004 드로우 감시 모드가 등록되어 있다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-004');
            return [{ pass: hasComplexMode(card, 'SB01_004_ACTIVE_DRAW_AND_PUNISH'), message: 'SB01-004 복합 모드 존재' }];
        },
    },
    {
        testId: 'SB01-005',
        name: '표식/자가트래시/트래시->대미지 모드 등록',
        description: 'SB01-005 핵심 복합 모드가 모두 등록되어 있다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-005');
            return [
                { pass: hasComplexMode(card, 'SB01_005_ACTIVE_DRAW_MARK_AND_OPTIONAL_TRASH'), message: '메인 복합 모드 존재' },
            ];
        },
    },
    {
        testId: 'SB01-006',
        name: '사이즈 마진 조건 돌파 부여 구성',
        description: 'SB01-006은 SIZE_MARGIN_MIN 조건과 돌파 부여 모드를 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-006');
            const hasCondition = card.effects?.some((e: any) => JSON.stringify(e.condition || {}).includes('SIZE_MARGIN_MIN'));
            const hasMode = hasComplexMode(card, 'SB01_006_ACTIVE_ATTACK_GRANT_BREAKTHROUGH_TO_LOW_COST');
            return [
                { pass: !!hasCondition, message: 'SIZE_MARGIN_MIN 조건 존재' },
                { pass: !!hasMode, message: '돌파 부여 모드 존재' },
            ];
        },
    },
    {
        testId: 'SB01-007',
        name: '엑시트 공개/배치 모드 등록',
        description: 'SB01-007 엑시트 복합 모드가 등록되어 있다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-007');
            return [{ pass: hasComplexMode(card, 'SB01_007_EXIT_REVEAL_AND_DISCARD_TO_DEPLOY'), message: 'SB01-007 복합 모드 존재' }];
        },
    },
    {
        testId: 'SB01-008',
        name: '전선구축 + 엑시트 재배치 오라 구성',
        description: 'SB01-008 전선구축 패시브와 EXIT 재배치 부여 효과가 존재한다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-008');
            const hasFrontline = card.effects?.some((e: any) => e.condition?.type === 'FRONTLINE' && e.action?.type === 'BUFF_POWER');
            const hasAura = card.effects?.some((e: any) => e.action?.type === 'GRANT_EFFECT' && e.action?.params?.effect?.activation === ActivationCondition.EXIT);
            return [
                { pass: !!hasFrontline, message: '전선구축 파워 패시브 존재' },
                { pass: !!hasAura, message: 'EXIT 재배치 오라 부여 존재' },
            ];
        },
    },
    {
        testId: 'SB01-009',
        name: '레인 배치 제한 구성',
        description: 'SB01-009는 4코 이하 배치 금지 파라미터를 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-009');
            const hasLock = card.effects?.some((e: any) => e.action?.type === 'NONE' && e.action?.params?.preventOpponentPlayUnitCostMax === 4);
            return [{ pass: !!hasLock, message: 'preventOpponentPlayUnitCostMax=4 존재' }];
        },
    },
    {
        testId: 'SB01-010',
        name: '히트차 블록 코스트 강제 구성',
        description: 'SB01-010은 히트차 패 트래시 블록 코스트 강제 파라미터를 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-010');
            const hasCostRule = card.effects?.some((e: any) => e.action?.params?.requireBlockHandDiscardByHitDiff === true);
            const hasTrigger = card.effects?.some((e: any) => e.activation === ActivationCondition.DAMAGE_TRIGGER && e.action?.type === 'RETURN_TO_HAND');
            return [
                { pass: !!hasCostRule, message: '방어 코스트 강제 파라미터 존재' },
                { pass: !!hasTrigger, message: '트리거 패 복귀 존재' },
            ];
        },
    },
    {
        testId: 'SB01-011',
        name: '엑시트 드로우/추가대미지 모드 등록',
        description: 'SB01-011 복합 모드가 등록되어 있다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-011');
            return [{ pass: hasComplexMode(card, 'SB01_011_EXIT_DRAW_BY_EFFECT_TRASHED_COUNT'), message: 'SB01-011 복합 모드 존재' }];
        },
    },
    {
        testId: 'SB01-012',
        name: '액티브 자가트래시+대미지 및 트리거 구성',
        description: 'SB01-012는 액티브 자가 트래시/대미지와 트리거 패 복귀를 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-012');
            const hasActive = card.effects?.some((e: any) => e.activation === ActivationCondition.ACTIVE_MAIN && e.action?.type === 'COMPLEX_ACTION');
            const hasTrigger = card.effects?.some((e: any) => e.activation === ActivationCondition.DAMAGE_TRIGGER && e.action?.type === 'RETURN_TO_HAND');
            return [
                { pass: !!hasActive, message: '액티브 메인 복합 효과 존재' },
                { pass: !!hasTrigger, message: '트리거 패 복귀 존재' },
            ];
        },
    },
    {
        testId: 'SB01-013',
        name: '액티브 대미지 증폭/교체 배치 모드 등록',
        description: 'SB01-013 엔트리 복합 모드가 등록되어 있다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-013');
            return [{ pass: hasComplexMode(card, 'SB01_013_ENTRY_ENABLE_ACTIVE_DAMAGE_BONUS'), message: 'SB01-013 복합 모드 존재' }];
        },
    },
    {
        testId: 'SB01-014',
        name: '트래시 2코 이하 배치 모드 등록',
        description: 'SB01-014 활성 복합 모드가 등록되어 있다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-014');
            return [{ pass: hasComplexMode(card, 'SB01_014_ACTIVE_DEPLOY_LOW_COST_FROM_TRASH'), message: 'SB01-014 복합 모드 존재' }];
        },
    },
    {
        testId: 'SB01-015',
        name: '동명/동코스트 재배치 모드 등록',
        description: 'SB01-015 활성 복합 모드가 등록되어 있다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-015');
            return [{ pass: hasComplexMode(card, 'SB01_015_ACTIVE_TRASH_AND_REDEPLOY_SAME_NAME'), message: 'SB01-015 복합 모드 존재' }];
        },
    },
    {
        testId: 'SB01-016',
        name: '디펜더 수 비례 전역 버프 구성',
        description: 'SB01-016은 DEFENDER_UNIT_COUNT_MULTIPLIER 파워 버프를 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-016');
            const hasDynamic = card.effects?.some((e: any) => e.action?.params?.dynamic === 'DEFENDER_UNIT_COUNT_MULTIPLIER');
            return [{ pass: !!hasDynamic, message: '디펜더 수 비례 버프 존재' }];
        },
    },
    {
        testId: 'SB01-017',
        name: '가디언 방벽 및 장기 공격잠금 모드 등록',
        description: 'SB01-017은 가디언 방벽[1]과 장기 공격잠금 복합 모드를 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-017');
            const hasBarrier = card.effects?.some((e: any) => e.action?.params?.guardianBarrierCost === 1);
            const hasLock = hasComplexMode(card, 'SB01_017_DEFENDER_DISCARD_LOCK_ATTACKER_UNTIL_NEXT_OPP_TURN_END');
            return [
                { pass: !!hasBarrier, message: '방벽[1] 파라미터 존재' },
                { pass: !!hasLock, message: '장기 공격잠금 모드 존재' },
            ];
        },
    },
    {
        testId: 'SB01-018',
        name: '엔트리 조건 바운스 + 디펜더 버프 구성',
        description: 'SB01-018은 ENCOUNTER_COST_MIN 조건 바운스와 디펜더 +3000을 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-018');
            const hasEntryBounce = card.effects?.some((e: any) => e.activation === ActivationCondition.ENTRY && e.action?.type === 'RETURN_UNIT_AND_ITEMS_TO_HAND');
            const hasDefBuff = card.effects?.some((e: any) => e.activation === ActivationCondition.DEFENDER && e.action?.type === 'BUFF_POWER' && e.action?.params?.value === 3000);
            return [
                { pass: !!hasEntryBounce, message: '엔트리 바운스 존재' },
                { pass: !!hasDefBuff, message: '디펜더 +3000 존재' },
            ];
        },
    },
    {
        testId: 'SB01-019',
        name: '디펜더 오라 + 트리거 바운스 구성',
        description: 'SB01-019은 디펜더 오라 부여와 트리거 최저코스트 바운스를 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-019');
            const auraCount = card.effects?.filter((e: any) => e.activation === ActivationCondition.PASSIVE && e.action?.type === 'GRANT_EFFECT').length || 0;
            const hasTriggerBounce = card.effects?.some((e: any) => e.activation === ActivationCondition.DAMAGE_TRIGGER && e.action?.type === 'RETURN_UNIT_AND_ITEMS_TO_HAND');
            return [
                { pass: auraCount >= 2, message: '디펜더 오라 2종 존재' },
                { pass: !!hasTriggerBounce, message: '트리거 바운스 존재' },
            ];
        },
    },
    {
        testId: 'SB01-020',
        name: '디펜더 광전사 오라 + 파괴대체 구성',
        description: 'SB01-020은 디펜더 광전사 오라와 패 1장 파괴대체를 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-020');
            const hasAura = card.effects?.some((e: any) => e.activation === ActivationCondition.PASSIVE && e.action?.type === 'GRANT_EFFECT');
            const hasReplace = card.effects?.some((e: any) => e.action?.params?.destroyReplacement === 'SB01_020_DISCARD_HAND_PREVENT_DESTROY');
            return [
                { pass: !!hasAura, message: '디펜더 광전사 오라 존재' },
                { pass: !!hasReplace, message: '파괴 대체 파라미터 존재' },
            ];
        },
    },
    {
        testId: 'SB01-021',
        name: '다중 장착 엔트리 + 암드 버프/트리거 구성',
        description: 'SB01-021은 장착 복합 모드, 암드 버프, 트리거 패 복귀를 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-021');
            const hasEntry = hasComplexMode(card, 'SB01_021_ENTRY_PROMPT_SELECT_ITEMS_AND_EQUIP');
            const hasPowerBuff = card.effects?.some((e: any) => e.action?.type === 'BUFF_POWER' && e.action?.params?.value === 2000);
            const hasHitBuff = card.effects?.some((e: any) => e.action?.type === 'BUFF_HIT' && e.action?.params?.value === 1);
            const hasTrigger = card.effects?.some((e: any) => e.activation === ActivationCondition.DAMAGE_TRIGGER && e.action?.type === 'RETURN_TO_HAND');
            return [
                { pass: !!hasEntry, message: '엔트리 장착 모드 존재' },
                { pass: !!hasPowerBuff, message: '암드 파워 버프 존재' },
                { pass: !!hasHitBuff, message: '암드 히트 버프 존재' },
                { pass: !!hasTrigger, message: '트리거 패 복귀 존재' },
            ];
        },
    },
    {
        testId: 'SB01-022',
        name: '전유닛 암드 ON_KILL 오라 구성',
        description: 'SB01-022는 전유닛 대상 ON_KILL 핸드트래시 오라를 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-022');
            const hasAura = card.effects?.some((e: any) =>
                e.activation === ActivationCondition.PASSIVE &&
                e.action?.type === 'GRANT_EFFECT' &&
                e.action?.params?.effect?.activation === ActivationCondition.ON_KILL
            );
            return [{ pass: !!hasAura, message: 'ON_KILL 오라 부여 존재' }];
        },
    },
    {
        testId: 'SB01-023',
        name: '최대2장 패트래시 드로우 모드 등록',
        description: 'SB01-023 엔트리 복합 모드가 등록되어 있다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-023');
            return [{ pass: hasComplexMode(card, 'SB01_023_ENTRY_DISCARD_UP_TO_TWO_THEN_DRAW'), message: 'SB01-023 복합 모드 존재' }];
        },
    },
    {
        testId: 'SB01-024',
        name: '암드 회수 액티브 + 파워 버프 구성',
        description: 'SB01-024은 암드 액티브 회수 모드와 +3000 패시브를 가진다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-024');
            const hasRecover = hasComplexMode(card, 'SB01_024_ACTIVE_MAIN_RECOVER_FROM_TRASH_BY_EQUIPPED_COUNT');
            const hasPower = card.effects?.some((e: any) => e.action?.type === 'BUFF_POWER' && e.action?.params?.value === 3000);
            return [
                { pass: !!hasRecover, message: '암드 회수 복합 모드 존재' },
                { pass: !!hasPower, message: '암드 +3000 존재' },
            ];
        },
    },
    {
        testId: 'SB01-025',
        name: '아이템 1+ 선택 드로우 모드 등록',
        description: 'SB01-025 활성 복합 모드가 등록되어 있다.',
        setup: () => {},
        verify: (_engine, getCard) => {
            const card = getCard('SB01-025');
            return [{ pass: hasComplexMode(card, 'SB01_025_ACTIVE_DISCARD_ITEMS_AND_DRAW'), message: 'SB01-025 복합 모드 존재' }];
        },
    },
];

export const SB01Module: UnifiedTestModule = {
    packId: 'SB01',
    displayName: 'SB01 스페셜 부스터',
    tests,
};

export default tests;
