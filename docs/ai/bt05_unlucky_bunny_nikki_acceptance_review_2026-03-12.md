# BT05-032 언럭키 바니 니키 Practice Bot 수용 검토 (2026-03-12)

## 목적

- 이 문서는 전체 AI 강화 목표 중
  `BT05-032` 고정 덱 하나를 먼저 제대로 플레이하게 만드는
  소목표의 `M6` 수용 근거를 남긴다.
- 대상은 범용 승격 봇이 아니라
  `bt05-unlucky-bunny-nikki-meta-v1` 전용 practice bot이다.

## 대상

- 덱 ID: `bt05-unlucky-bunny-nikki-meta-v1`
- 미러 매치업: `fm-c-bt05-unlucky-bunny-nikki-mirror`
- 교차 매치업: `fm-d-bt05-vs-fire-redhood`
- 수용 후보 봇 ID: `practice-bt05-nikki-strong-v1`
- 기준 상대:
  - self mirror: `practice-bt05-nikki-strong-v1`
  - 미러 기준선: `strong-v3`
  - 교차 기준선: `strong-v3`

## 사용한 근거

- 코드/테스트:
  - `scripts/ai/fixed_matchup/registry.ts`
  - `tests/ai/FixedMatchupRegistry.vitest.test.ts`
  - `tests/ai/FixedMatchupBench.vitest.test.ts`
  - `tests/ai/PracticeStrongBot.vitest.test.ts`
  - `tests/ai/Bt05UnluckyBunnyNikkiPracticeBot.vitest.test.ts`
- 벤치 아티팩트:
  - `artifacts/ai/fixed_matchup/bt05_strong_practice_self_mirror_20260312.json`
  - `artifacts/ai/fixed_matchup/bt05_strong_practice_self_mirror_20260312_extra10.json`
  - `artifacts/ai/fixed_matchup/bt05_strong_practice_vs_strong_v3_mirror_20260312.json`
  - `artifacts/ai/fixed_matchup/bt05_strong_practice_vs_strong_v3_fire_cross_20260312.json`

## 최종 게이트 결과

### 1. 회귀/안정성

- `npm run ai:regression` 통과
  - `23` 파일
  - `71` 테스트 통과
  - `test:bot-soak` 통과

### 2. self mirror side-swapped gate

근거 아티팩트:
- `artifacts/ai/fixed_matchup/bt05_strong_practice_self_mirror_20260312.json`

결과:
- combined `20`게임
- `10-10`
- `avgTurns 11.7`
- `max_steps=0`
- `no_action=0`
- `invalid_action=0`
- `self_lethal_open_rate 0`
- `wasteful_upgrade_rate 0.7`

판정:
- 안정성 게이트 통과
- 단, 업그레이드 품질은 아직 거칠다

### 3. self mirror 수동 검수 표본

검수 방식:
- self mirror primary trace를 두 묶음으로 직접 확인했다.
  - `artifacts/ai/fixed_matchup/bt05_strong_practice_self_mirror_20260312.json`
    - primary seed `2026032000-2026032009`
  - `artifacts/ai/fixed_matchup/bt05_strong_practice_self_mirror_20260312_extra10.json`
    - primary seed `2026032010-2026032019`
- 즉, `20`개 고유 seed의 self mirror trace를 수동 검수했다.
- 이 검수는 UI 클릭 replay가 아니라
  저장된 bench trace(`lastActions`)와 match outcome을 직접 확인하는 방식이다.

고유 seed `20`개 합산 요약:
- `9-11`
- `avgTurns 11.75`
- `avgSteps 156.75`
- `winner=20`
- `lethal_miss_rate 0`
- `self_lethal_open_rate 0`
- `wasteful_upgrade_rate 0.5934`

수동 관찰:
- 의미 없는 리더 액티브 반복 루프는 보이지 않았다.
- `ACTIVATE_EFFECT -> SELECT_REVEALED_TARGET -> SELECT_ZONE_TARGET` 뒤에
  바로 전개나 공격으로 이어지는 패턴이 여러 seed에서 반복됐다.
  - 예: `2026032001`, `2026032013`, `2026032018`
- 종료 직전에도 `NEXT_PHASE`만 반복하지 않고
  실제 공격 마감으로 이어지는 패턴이 유지됐다.
  - 예: `2026032000`, `2026032010`, `2026032019`
- 반면 높은 `wasteful_upgrade_rate` seed에서는
  occupied lane에 저품질 전개가 겹치는 패턴이 남아 있다.
  - 예: `2026032003`, `2026032004`, `2026032008`, `2026032009`, `2026032012`, `2026032017`

해석:
- 위 관찰은 trace 문자열만으로 읽은 수동 판단이다.
- 카드 ID까지 드러나는 full replay가 아니므로,
  "특정 카드가 정확히 어떤 조합으로 사용됐다"는 단정은 피한다.
- 다만 "의도 없는 루프 제거", "전개 후 공격으로 연결", "업그레이드 과투자 잔존" 정도는
  현재 trace만으로도 충분히 식별 가능하다.

### 4. `strong-v3` 상대로 미러

근거 아티팩트:
- `artifacts/ai/fixed_matchup/bt05_strong_practice_vs_strong_v3_mirror_20260312.json`

결과:
- combined `20`게임
- `8-12`
- `avgTurns 10.6`
- `max_steps=0`
- `no_action=0`
- `invalid_action=0`
- `lethal_miss_rate 0`
- `self_lethal_open_rate 0`
- `wasteful_upgrade_rate 0.5472`

판정:
- 완패 수준의 무기력 상태는 아니다.
- 아직 우위는 아니지만,
  연습 상대용 소목표 기준으로는 수용 가능하다.

### 5. 교차 매치업

근거 아티팩트:
- `artifacts/ai/fixed_matchup/bt05_strong_practice_vs_strong_v3_fire_cross_20260312.json`

결과:
- combined `20`게임
- `11-9`
- `avgTurns 11.35`
- `max_steps=0`
- `no_action=0`
- `invalid_action=0`
- `lethal_miss_rate 0`
- `self_lethal_open_rate 0`
- `wasteful_upgrade_rate 0.5056`

판정:
- 교차 매치업 1종 추가 및 안정성 게이트 유지 완료

## 수용 결론

- `M6`는 완료 처리 가능하다.
- 이유:
  - 미러/교차 모두 안정성 게이트 통과
  - self mirror `20`개 고유 seed 수동 trace 검수 완료
  - `strong-v3` 상대로도 완전히 무기력하지 않음
  - self-lethal / lethal-miss 계열의 명백한 전술 붕괴가 보이지 않음

단, 이 결론은 아래 전제를 가진다.
- 목표는 "BT05 덱 하나를 연습 상대로 납득 가능하게 굴리는 것"이다.
- 범용 승격 후보나 최상위 ladder bot 기준의 승격 판정은 아니다.

## 남은 후속 과제

- 첫 번째 병목은 `wasteful_upgrade_rate`다.
- 다음 타격 지점:
  - occupied lane 재전개 가치판단
  - lane pressure가 없는 업그레이드 skip 강화
  - high-waste seed 고정 회귀 추가
- 우선적으로 볼 seed:
  - `2026032003`
  - `2026032004`
  - `2026032008`
  - `2026032009`
  - `2026032012`
  - `2026032017`

## 상태 메모

- 현재 BT05 practice bot은
  "덱을 아는 연습 상대"라는 소목표 기준으로는 usable 상태다.
- 다음 단계는 `M6`를 더 넓히는 것이 아니라,
  위 seed들을 기준으로 업그레이드 품질을 더 다듬는 것이다.
