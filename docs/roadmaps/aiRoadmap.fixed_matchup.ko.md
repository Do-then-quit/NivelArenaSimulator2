# AI 로드맵 개정안: 고정 매치업 플레이 봇 우선

## 상태 (2026-02-19)

- 이 문서는 단기/중기 실행용 **활성 로드맵**이다.
- 기존 `docs/roadmaps/aiRoadmap.ko.md`의 광범위 목표는 유지하되, 당분간 실행 우선순위는 본 문서를 따른다.
- 핵심 전환:
  - 덱 탐색/메타 생성은 장기 백로그로 분리
  - 단기 목표는 고정 매치업에서 플레이 봇 강화
  - 최종 후보는 순수 RL 단일 경로가 아니라 **탐색+RL 하이브리드 포함 비교**로 승격

## 1) 목표 재정의

- 목표 A (단기): 고정 매치업(A 미러, A vs B)에서 안정적으로 강한 플레이 봇 확보
- 목표 B (중기): 고정 매치업 범위를 점진 확장(A/B/C 등)
- 목표 C (장기): 덱 탐색/공진화/RL 통합을 메타 단위로 확장

## 2) 비목표 (단기)

- 단기 주기에서 전 카드풀 기반 덱 탐색 성과를 KPI로 두지 않는다.
- 단기 주기에서 PSRO/alpha-rank 풀 파이프라인을 완성 목표로 두지 않는다.
- 단기 주기에서 순수 RL만을 유일 승격 경로로 고정하지 않는다.

## 3) 스코프

- 카드풀: 현재 구현된 `ST01`, `ST02`, `ST03`, `BT01`
- 고정 매치업:
  - `FM-A`: A 덱 미러전
  - `FM-B`: A 덱 vs B 덱 (진영 스왑 포함)
- 관측 모델:
  - 승격 대상은 `getObservation(actorPlayerId)` 기반 의사결정만 허용
  - 상대 비공개 정보 직접 참조 금지

## 4) 공통 가드레일

- AI 엔진 진입점 고정:
  - `getLegalActions(actorPlayerId?)`
  - `step(action)`
  - `getObservation(actorPlayerId)`
  - `getSerializableState()`
- 결정론:
  - seed 고정 시 동일 결과 재현
  - seed suite 분리: `tuning`, `dev`, `promotion-holdout`
- 안정성:
  - `max_steps=0`, `no_action=0`, `invalid_action=0` 유지
- 회귀:
  - `npm run ai:regression`
  - `npm run test:bot-soak`
  - AI 필수 룰 회귀 세트 유지

## 5) 단계 로드맵 (Fixed Matchup Track)

## FM0: 평가 프로토콜 고정

- 목표:
  - 고정 매치업 평가 규약을 먼저 동결해 실험 노이즈를 줄인다.
- 산출물:
  - 매치업별 고정 seed suite
  - side-swapped bench preset (200+200 기본)
  - 통계 스키마(승률, CI, 안정성, runtime, 전술 KPI)
- 완료 기준:
  - 동일 config 재실행 시 동일 리포트 재현
  - 산출물 경로/이름 규약 고정

## FM1: 탐색/휴리스틱 기준선 강화

- 목표:
  - 현재 StrongBot 계열을 고정 매치업에서 우선 상향
- 구현 우선순위:
  1. 상호작용 분기(`SELECT_TARGET`, `SELECT_COST`, `SELECT_OPTIONAL`) 품질 개선
  2. 상대 1-ply 응답 예측/Top-K 응답 집계 보정
  3. 탐색 커버리지 기반 폴백 안정화
- 완료 기준:
  - `strong-candidate`가 `strong-v3` 대비 holdout에서 유의미 개선
  - 안정성/런타임 비열화 없음

## FM2: BC(모방학습) 워밍업

- 목표:
  - 강한 정책 트레이스를 이용해 RL 초기 분산을 줄인다.
- 구현 우선순위:
  1. A 미러 + A/B 로그 추출 파이프라인
  2. legal-action masking 기반 behavior cloning
  3. BC 정책을 후보 봇 프로파일로 등록
- 완료 기준:
  - BC 정책이 baseline 대비 우세
  - holdout에서 strong-v3 대비 최소 기준 성능 확보(비열화 방지)

## FM3: RL 파인튜닝

- 목표:
  - 콤보/연쇄 효과 의사결정 품질을 RL로 보강
- 구현 우선순위:
  1. PPO + legal-action masking
  2. 부분관측 대응(권장: LSTM/RNN 정책)
  3. 커리큘럼: A 미러 -> A/B -> 혼합 배치
  4. 상대 체크포인트 샘플링 self-play
- 완료 기준:
  - RL 후보가 BC 및 strong-v3 기준선을 holdout에서 상회
  - deadlock/invalid 회귀 없음

## FM4: 하이브리드 비교 및 승격

- 목표:
  - 순수 RL vs 탐색+RL 하이브리드를 같은 경기장에서 비교해 최종 승격
- 구현 우선순위:
  1. 정책 prior를 탐색 평가에 결합(또는 정책-가치 보조 점수화)
  2. 순수 RL/하이브리드 동시 벤치
  3. 승격 게이트 통과 후보 1개 동결
- 완료 기준:
  - 고정 매치업 전 구간에서 승격 기준 충족
  - 재현 가능한 아티팩트와 함께 bot registry 승격 반영

## FM5: 매치업 확장

- 목표:
  - A/B 고정에서 벗어나 C 포함 다중 고정 매치업으로 확대
- 완료 기준:
  - 확장 매치업에서도 성능 하락 폭이 관리 가능한 수준

## 6) 승격 게이트 (고정)

- 성능 게이트:
  - 기본: side-swapped 200+200, 95% CI 포함
  - 승격 후보는 `FM-A`, `FM-B` 모두 통과해야 함
- 안정성 게이트:
  - `max_steps=0`, `no_action=0`, `invalid_action=0`
- 런타임 게이트:
  - 기준선 대비 비열화 제한(p50/p95/avgMsPerGame)
- 전술 KPI 게이트:
  - `lethal_miss_rate`
  - `self_lethal_open_rate`
  - `wasteful_upgrade_rate`

## 7) 산출물 규약

- 고정 매치업 벤치:
  - `artifacts/ai/fixed_matchup/bench/`
- 승격 게이트:
  - `artifacts/ai/fixed_matchup/promotion/`
- 체크포인트 메타:
  - seed suite 버전, commit hash, bot profile id 포함

## 8) 커맨드 초안

- `npm run ai:fixed:bench`
  - 고정 매치업 side-swapped 벤치 실행
- `npm run ai:fixed:bc-train`
  - BC 워밍업 학습 실행
- `npm run ai:fixed:rl-train`
  - PPO 파인튜닝 실행
- `npm run ai:fixed:promote`
  - 고정 승격 게이트 실행

참고: 위 커맨드는 로드맵 기준 이름이며, 실제 스크립트 구현 전까지는 placeholder로 운영할 수 있다.

## 9) 장기 백로그 (분리 유지)

- 덱 탐색 MVP (GA/ES)
- 공진화/메타 견고화(리그 기반)
- PSRO/alpha-rank 기반 메타 평가 확장
- QD(MAP-Elites)/서로게이트 결합 덱 생성

위 항목은 삭제가 아니라 **단기 트랙 종료(FM4/FM5) 이후 재개**를 원칙으로 한다.

## 10) 현재 착수 가이드 (2026-03-10)

- 2026-03-10 기준 저장소 재점검 결과, 단기 착수 우선순위는 여전히 FM0/FM1이다.
- 현재 목표가 "고정 메타덱 기반의 연습 상대용 봇"이라면,
  첫 작업은 RL이 아니라 아래 3가지다:
  1. 메타덱 레지스트리 고정
  2. 고정 매치업 벤치/승격 스크립트 추가
  3. `strong-v3` 기반의 deck-aware practice bot 프로필 추가
- 현재 AI 회귀/soak 게이트는 통과 가능한 상태이므로, 엔진 안정화보다 평가 레일 정리가 우선이다.
- 자세한 실행 순서와 문서화된 권장 구조는 아래 문서를 따른다:
  - `docs/ai/fixed_matchup_practice_bot_start_2026-03-10.md`
- 특정 덱 하나를 먼저 제대로 굴리는 소목표는 별도 체크리스트 문서로 관리한다.
  - 현재 활성 소목표:
    - `docs/ai/bt05_unlucky_bunny_nikki_practice_bot_checklist_2026-03-10.md`
    - 수용 검토:
      - `docs/ai/bt05_unlucky_bunny_nikki_acceptance_review_2026-03-12.md`
