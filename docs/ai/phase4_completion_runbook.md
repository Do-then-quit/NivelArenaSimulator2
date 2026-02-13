# Phase 4 완료 런북

## 목표 매핑
Phase 4 완료 기준(회귀 확장 / 스트레스-소크 / 런타임 정량 게이트)을 자동화 가능한 커맨드로 고정한다.

## 1) 회귀 게이트
- `npm run ai:regression`
- 포함 테스트는 `phase0.manifest.json`의 `regression.vitestFiles`를 기준으로 동작한다.

## 2) 스트레스 매트릭스
- 기본 실행:
  - `npm run ai:phase4:matrix`
- 출력 산출물(기본):
  - `artifacts/ai/phase4/stress_matrix_latest.json`

### 환경변수 오버라이드
- `AI_PHASE4_MATRIX_START_SEED`
- `AI_PHASE4_MATRIX_MAX_STEPS`
- `AI_PHASE4_MATRIX_ENABLE_MULLIGAN`
- `AI_PHASE4_MATRIX_MEASURE_RUNTIME`
- `AI_PHASE4_MATRIX_PAIRINGS`
  - 형식: `p1:p2[:games],p1:p2[:games]`
  - 예: `strong-v3:strong-v2:40,strong-v2:strong-v3:40`
- `AI_PHASE4_MATRIX_OUTPUT`

## 3) 런타임/품질 게이트
`npm run ai:phase4:matrix`는 아래를 함께 검증한다.
- 안정성: `max_steps=0`, `no_action=0`, `invalid_action=0`
- 런타임 게이트:
  - `p50 ms/action <= baseline * 1.25`
  - `p95 ms/action <= baseline * 1.60`
  - `avgMsPerGame <= baseline * 1.40`

기준선과 배수는 `phase0.manifest.json > phase4`에서 조정한다.
