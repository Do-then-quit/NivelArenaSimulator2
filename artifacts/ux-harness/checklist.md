# Live Browser Checklist

## 기본 경로
1. 메뉴에서 `빠른 대전 (ST01 미러전)` 선택
2. `패 유지` 클릭
3. `패 유지` 클릭
4. `P1 MAIN` 화면에서 phase ribbon / action panel / next-phase CTA 확인

## Dev Checkpoint 경로
- `/?uxCheckpoint=P1_MAIN_AFTER_MULLIGAN`
- `/?uxCheckpoint=ATTACK_DECLARE_WINDOW`
- `/?uxCheckpoint=BLOCK_DECISION_WINDOW`
- `/?uxCheckpoint=MANDATORY_TARGET_SELECTION`
- `/?uxCheckpoint=END_PHASE_HAND_ADJUST`

## 체크 항목
- phase ribbon이 현재 타이밍을 즉시 설명하는가
- combat window에서는 attack step bar가 함께 보이는가
- action panel이 카드/주체 기준으로 읽히는가
- disabled action summary와 reason chip이 보이는가
- mandatory queue가 confirm CTA보다 앞에서 읽히는가
- selection progress가 queue에만 단일 source로 존재하는가
- phase-change toast가 top chrome을 밀어내지 않는가
- audit trail 또는 effect log에서 마지막 원인과 타이밍을 읽을 수 있는가

## Scorecard Template
- 룰 정확성:
- 페이즈/스텝 가시성:
- 행동 가능성 명확성:
- 타이밍/원인 설명력:
- 시각적 안정성:
- 총점:
- mandatoryHiddenCount:

## Next Findings Template
- Finding:
- 재현 scenario:
- checkpoint / 실제 경로:
- 예상 수정 축:
