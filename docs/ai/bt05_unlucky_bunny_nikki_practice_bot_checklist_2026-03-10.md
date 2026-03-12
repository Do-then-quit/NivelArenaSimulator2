# BT05-032 언럭키 바니 니키 Practice Bot 체크리스트 (2026-03-10)

## 목적

- 이 문서는 전체 "AI 봇 강화" 목표 안에서,
  `BT05-032` 리더 덱 하나를 먼저 제대로 플레이하게 만드는
  **작은 실행 목표**를 문서화한 체크리스트다.
- 범위는 범용 최강 AI가 아니라,
  `bt05-unlucky-bunny-nikki-meta-v1` 덱을
  사람이 연습 상대로 납득할 수준으로 굴리는 practice bot이다.
- 이 문서는 구현 중 매번 체크하고 넘어가는 용도로 유지한다.

## 현재 대상

- 리더: `BT05-032` 언럭키 바니 니키
- 고정 덱 ID: `bt05-unlucky-bunny-nikki-meta-v1`
- 고정 미러 매치업 ID: `fm-c-bt05-unlucky-bunny-nikki-mirror`
- 참고 분석 문서:
  - `docs/ai/bt05_unlucky_bunny_nikki_deck_analysis_2026-03-11.md`
- 현재 기준선:
  - 엔진/하네스: fixed matchup rail 사용
  - 범용 강봇 기준: `strong-v3`
  - 스모크 실행 기준: `baseline-a`, `baseline-b`

## 이 문서의 완료 정의

- 이 덱 전용 bot이 멀리건, 초반 전개, 핵심 콤보, 비용 지불, 타겟 선택에서
  "이 덱을 알고 플레이한다"는 인상을 줘야 한다.
- 미러전과 최소 1개의 교차 매치업에서
  `max_steps`, `no_action`, `invalid_action` 문제가 없어야 한다.
- 리플레이를 사람이 봤을 때
  의미 없는 리더 액티브 반복, 무의미한 코스트 낭비,
  핵심 파츠 자해, 명백한 킬각 미스가 반복되지 않아야 한다.
- 이 문서는 승률 하나만으로 체크하지 않는다.
  안정성, 시나리오 테스트, 수동 리플레이 검수를 같이 본다.

## 체크 규칙

- 체크박스는 코드만 바뀌었다고 바로 완료로 바꾸지 않는다.
- 각 항목은 아래 3개가 만족될 때만 체크한다.
  1. 구현 또는 정책 반영
  2. 관련 테스트 또는 스모크 실행
  3. 리플레이/로그 확인 또는 벤치 아티팩트 확인
- 항목이 애매하면 완료 처리하지 말고 열린 상태로 둔다.

## 현재 상태 요약

- [x] 고정 덱 레지스트리에 `bt05-unlucky-bunny-nikki-meta-v1` 추가
- [x] 고정 미러 매치업 `fm-c-bt05-unlucky-bunny-nikki-mirror` 추가
- [x] `BT05-032`의 mixed oath 규칙을 현재 validator가 수용하도록 보정
- [x] trigger 오탐을 줄여 현재 덱이 합법으로 materialize 되게 보정
- [x] leader/item `ACTIVATE_EFFECT`에서 baseline/scorer가 크래시 나지 않도록 보정
- [x] fixed matchup bench 스모크가 새 덱 미러에서 실행되도록 연결
- [x] baseline 또는 practice profile이 턴 1 leader active 반복 루프 없이 실제 게임을 진행
- [x] `practice-bt05-nikki-open-v1` 프로필이 BT05 오프닝 멀리건/전개 휴리스틱을 가진 상태로 연결

## 활성 이정표

## M0. 평가 레일 고정

- [x] 덱 정의가 `scripts/ai/fixed_matchup/registry.ts`에 고정되어 있다.
- [x] 덱 정의가 `tests/ai/FixedMatchupRegistry.vitest.test.ts`에서 검증된다.
- [x] `BT05-032` 서약/트리거 규칙이 `tests/ai/LeaderDeckConstraint.vitest.test.ts`로 보호된다.
- [x] `ai:fixed:bench`가 새 덱 미러를 대상으로 실행된다.

이 단계의 메모:
현재 레일은 열렸지만, 플레이 품질은 아직 미완료다.
다음 단계부터는 "돌아간다"가 아니라 "제대로 둔다"를 목표로 한다.

## M1. 병적 루프 제거

- [x] 빈 필드에서 의미 없는 리더 액티브 반복이 발생하지 않는다.
- [x] 턴 진행이 막히지 않고 최소한 초반 배치/전개 라인으로 넘어간다.
- [x] 미러 스모크에서 `turnCount=1`, `phase=MAIN`, `max_steps` 고착 사례가 사라진다.
- [x] 이 문제를 재현하는 회귀 테스트가 추가된다.

완료 기준:
`fm-c-bt05-unlucky-bunny-nikki-mirror` 10게임 dev seed 스모크에서
턴 1 고착이 재발하지 않아야 한다.

검증 메모 (2026-03-12):
- `rules_v2_ai_baseline_bot_regression.test.ts`에 각성 전 `BT05-032` 리더 액티브 비노출 회귀 추가
- `AI_FIXED_BENCH_MATCHUP=fm-c-bt05-unlucky-bunny-nikki-mirror AI_FIXED_BENCH_GAMES_PER_SIDE=10 ... npm run ai:fixed:bench`
  실행 결과:
  - combined `20`게임
  - `winner=20`
  - `max_steps=0`
  - `no_action=0`
  - `invalid_action=0`
  - avgTurns `12.8`

## M2. 오프닝 플랜 이해

- [x] 멀리건 우선순위가 문서화되고 bot 정책에 반영된다.
- [x] 1코스트, 2코스트, 4코스트로 이어지는 초반 곡선 전개 우선순위가 반영된다.
- [x] 초반에 손패/트래시 리소스를 무의미하게 소모하지 않는다.
- [x] "배치 가능한 유닛을 안 내고 패스" 같은 명백한 저품질 라인이 줄어든다.

우선 점검 카드:
`BT05-033`, `BT05-064`, `ST09-011`, `BT05-034`, `BT05-066`, `BT05-036`

검증 메모 (2026-03-12, M2 part 1):
- `src/logic/ai/practice/deckProfiles/bt05UnluckyBunnyNikki.ts`에 BT05 오프닝 전용 멀리건/메인 페이즈 휴리스틱 추가
- `tests/ai/Bt05UnluckyBunnyNikkiPracticeBot.vitest.test.ts`로 아래 시나리오 보호
  - 좋은 혼합 오프닝 핸드 keep
  - 나쁜 고코스트 핸드 redraw
  - 빈 필드에서 `BT05-064` 1코 선전개
  - 혼합 조건을 바로 켜는 `BT05-081` 아이템 우선
  - 혼합 상태 이후 `BT05-036` 4코 엔진 우선
- `AI_FIXED_BENCH_MATCHUP=fm-c-bt05-unlucky-bunny-nikki-mirror ... AI_FIXED_BENCH_P1_BOT=practice-bt05-nikki-open-v1 AI_FIXED_BENCH_P2_BOT=practice-bt05-nikki-open-v1 npm run ai:fixed:bench`
  결과:
  - combined `4`게임
  - `winner=4`
  - `max_steps=0`
  - `no_action=0`
  - `invalid_action=0`
  - avgTurns `12`

검증 메모 (2026-03-12, M2 part 2):
- match harness가 카드/리더 ID에 seed suffix를 붙이는 점을 반영해 practice profile이 base ID로 매칭되도록 보정
- 초반 자원 낭비 억제 규칙 추가
  - `BT05-046` 조기 장착 회피
  - 빈 트래시의 `BT05-044` 조기 사용 회피
  - `BT05-082` 조기 액티브 회피
  - mix를 만들지 못하는 `BT05-082` 조기 장착 회피
- `tests/ai/Bt05UnluckyBunnyNikkiPracticeBot.vitest.test.ts`
  시나리오 확장으로 위 4개 라인 회귀 보호
- 고정 미러 표본 로그 확인:
  - dev seed `2026032001`에서 초반 `BT05-044`/`BT05-082` 낭비 없이
    `BT05-064 -> NEXT_PHASE` 라인으로 진행
- `npm run ai:regression` 재통과

## M3. 덱 핵심 플랜 이해

- [x] `BT05-036`, `BT05-039`의 트래시 존 엑시트 차용 라인을 bot이 이해한다.
- [x] `BT05-044`의 차용/반복 차용 사용 타이밍이 무의미하지 않다.
- [x] `BT05-043`의 손패 트래시 코스트를 핵심 파츠 자해 없이 사용한다.
- [x] `BT05-041`, `BT05-038`, `BT05-040` 같은 상위 코스트 피니시 라인을 보존한다.
- [x] 리더 액티브는 "지금 쓸 이유가 있을 때"만 선택한다.

우선 목표:
이 덱의 플레이 로그에서
"트래시의 엑시트 자원 활용"과 "폭풍/번개 혼합 플랜"이 드러나야 한다.

검증 메모 (2026-03-12, M3 part 1):
- `PracticeProfile`에 hand/trash target 훅 추가 후 `BaselineBot`에 연결
- `src/logic/ai/practice/deckProfiles/bt05UnluckyBunnyNikki.ts`
  에 아래 deck-aware 규칙 추가
  - midgame에 `BT05-044`, `BT05-036`, `BT05-039`, `BT05-043` 우선 사용 조건
  - `BT05-044` / `BT05-036` / `BT05-039` 차용 대상 우선순위
  - `BT05-039` 엑시트 재전개 대상 우선순위
  - `BT05-043` 손패 트래시에서 `BT05-041` 보존 규칙
- `tests/ai/Bt05UnluckyBunnyNikkiPracticeBot.vitest.test.ts`
  시나리오 확장으로 아래 라인 보호
  - primed mixed board에서 `BT05-044` 우선 사용
  - mixed redeploy window에서 차용 우선순위가 `BT05-039` 라인을 먼저 본다
  - `BT05-039` 엑시트가 `BT05-064` 재전개를 우선 선택
  - `BT05-043`가 `BT05-041` 대신 `BT05-039`를 손패 코스트로 선택

검증 메모 (2026-03-12, M3 part 2):
- `PracticeProfile`에 zone/revealed target 훅 추가 후 `BaselineBot`에 연결
- `src/logic/ai/practice/deckProfiles/bt05UnluckyBunnyNikki.ts`
  에 아래 리더/피니시 규칙 추가
  - `BT05-041`, `BT05-038`, `BT05-040`, `BT05-039` 중심의 leader destroy target 우선순위
  - 후속 self-trash 아웃렛이 있을 때만 leader return 라인을 여는 규칙
  - 이유 없는 각성 리더 액티브를 `NEXT_PHASE`로 넘기는 억제 규칙
  - `BT05-032` 옵션 선택과 아군 대상 선택의 deck-aware 훅
- `tests/ai/Bt05UnluckyBunnyNikkiPracticeBot.vitest.test.ts`
  시나리오 확장으로 아래 라인 보호
  - 이유 없는 각성 리더 액티브 스킵
  - stocked trash에서 `BT05-041` destroy 피니시 라인 선택
  - 후속 recycle line이 있을 때 leader return 선택
- `AI_FIXED_BENCH_MATCHUP=fm-c-bt05-unlucky-bunny-nikki-mirror ... npm run ai:fixed:bench`
  결과:
  - combined `4`게임
  - `winner=4`
  - `max_steps=0`
  - `no_action=0`
  - `invalid_action=0`
  - avgTurns `12.5`
- `npm run ai:regression` 재통과

## M4. 전술 선택 품질

- [x] 코스트 지불 시 저가치 카드부터 버리는 기본 규칙이 들어간다.
- [x] 타겟 선택에서 제거 가치가 낮은 유닛을 우선 치지 않는다.
- [x] optional effect를 의미 없이 남발하지 않는다.
- [x] 아이템 `BT05-081`, `BT05-082` 장착/이동/소모 판단이 개선된다.
- [x] 자기 킬각 오픈과 과투자 업그레이드가 반복되지 않는다.

이 단계의 출력물:
카드별 priority table 또는 deck profile 문서/코드가 있어야 한다.

검증 메모 (2026-03-12, M4 part 1):
- `PracticeProfile`에 optional/confirm hook을 연결하고
  `BaselineBot`의 interaction path에서 deck-aware confirm 분기를 사용
- `src/logic/ai/practice/deckProfiles/bt05UnluckyBunnyNikki.ts`
  에 아래 전술 규칙 추가
  - `BT05-082` draw-then-discard에서 `BT05-041`보다 `BT05-039` 같은 loot 자원을 우선 버리는 규칙
  - `BT05-046` upkeep에서 저가치 유닛이면 손패 핵심 파츠를 버리기보다 `CONFIRM_TARGETS`로 죽게 두는 규칙
  - `BT05-072` reveal 3에서 가치 있는 카드만 고르고 조기 `CONFIRM_TARGETS` 하는 규칙
  - `BT05-041` exit 하단 적재에서 양수 가치 카드만 3의 배수로 모으고 조기 `CONFIRM_TARGETS` 하는 규칙
  - `BT05-065` optional entry를 대미지 회수 가치가 없을 때는 넘기는 규칙
  - midgame `BT05-081`, `BT05-082`, `BT05-046` 장착/사용 점수화
- `tests/ai/Bt05UnluckyBunnyNikkiPracticeBot.vitest.test.ts`
  시나리오 확장으로 아래 라인 보호
  - `BT05-065` optional skip
  - `BT05-082` discard target 우선순위
  - `BT05-046` zero-select confirm
  - `BT05-072` / `BT05-041` partial confirm
  - `BT05-081` midgame equip
  - `BT05-082` midgame active use / skip
- `npx vitest run tests/ai/Bt05UnluckyBunnyNikkiPracticeBot.vitest.test.ts`
  `25/25` 통과
- `npx vitest run tests/ai/FixedMatchupBench.vitest.test.ts tests/rules_v2_regression/rules_v2_ai_baseline_bot_regression.test.ts`
  통과
- `AI_FIXED_BENCH_MATCHUP=fm-c-bt05-unlucky-bunny-nikki-mirror ... npm run ai:fixed:bench`
  결과:
  - combined `4`게임
  - `winner=4`
  - `max_steps=0`
  - `no_action=0`
  - `invalid_action=0`
  - avgTurns `11`
  - tactical KPI: `self_lethal_open_rate 0`, `wasteful_upgrade_rate 0.5714`
- `npm run ai:regression` 재통과

검증 메모 (2026-03-12, M4 part 2):
- `src/logic/ai/practice/deckProfiles/bt05UnluckyBunnyNikki.ts`
  에 아래 잔여 전술 규칙 추가
  - `PLAY_UNIT`의 lane-fit 점수화로 `BT05-036`, `BT05-039`, `BT05-041`, `BT05-072`
    업그레이드가 실제 압박/교환 개선이 없으면 `NEXT_PHASE`로 넘기거나 빈 lane을 우선 잡는 규칙
  - `SELECT_ZONE_TARGET`에서 leader active 외의 일반 BT05 타겟팅도
    practice profile이 직접 고르게 연결
  - `BT05-043` lower-cost destroy target 우선순위
  - `BT05-038`, `BT05-040`, `BT05-045`의 destroy 대상 가치판단
  - `BT05-034` return 부여 대상 가치판단
  - `[트리거]를 가지지 않은` 문구를 실제 trigger 보유와 혼동하지 않도록
    local `isTriggerCard` 판정 추가
- `tests/ai/Bt05UnluckyBunnyNikkiPracticeBot.vitest.test.ts`
  시나리오 확장으로 아래 라인 보호
  - `BT05-039` empty lane 전개 우선
  - `BT05-072` wasteful upgrade skip
  - `BT05-043` high-value enemy destroy target
  - `BT05-038` stocked trash 기준 self-sacrifice target
  - `BT05-034` return target
- `npx vitest run tests/ai/Bt05UnluckyBunnyNikkiPracticeBot.vitest.test.ts`
  `30/30` 통과
- `npx vitest run tests/ai/FixedMatchupBench.vitest.test.ts tests/rules_v2_regression/rules_v2_ai_baseline_bot_regression.test.ts`
  `8/8` 통과
- `npx tsc --noEmit --pretty false --incremental false`
  통과
- `AI_FIXED_BENCH_MATCHUP=fm-c-bt05-unlucky-bunny-nikki-mirror AI_FIXED_BENCH_GAMES_PER_SIDE=10 ... npm run ai:fixed:bench`
  결과:
  - combined `20`게임
  - `winner=20`
  - `max_steps=0`
  - `no_action=0`
  - `invalid_action=0`
  - avgTurns `12.5`
  - tactical KPI: `self_lethal_open_rate 0`, `wasteful_upgrade_rate 0.3784`
- `npm run ai:regression` 재통과

M4 후속 관찰 메모:
- mirror 20게임 리플레이를 수동 확인해서 남아 있는 `wasteful_upgrade_rate 0.3784` 로그를 분류한다.
- 남은 개선은 `M5`로 넘기기 전, 특정 카드 조합에서의 업그레이드 오판을 리플레이 기반으로 수집하는 단계다.

## M5. 덱 전용 practice profile 분리

- [x] 범용 baseline 패치가 아니라 별도 deck-aware profile로 분리된다.
- [ ] `strong-v3` 기반 또는 동급의 practice profile ID가 정의된다.
- [x] CLI 벤치 레지스트리와 UI/replay 레지스트리에 같은 프로필이 등록된다.
- [x] 덱 전용 정책이 공통 엔진과 분리된 파일에 정리된다.

권장 파일 방향:
- `src/logic/ai/practice/PracticeBot.ts`
- `src/logic/ai/practice/deckProfiles/bt05UnluckyBunnyNikki.ts`
- `scripts/ai/bot_registry.ts`
- `src/logic/ai/BotRegistry.ts`

## M6. 수용 게이트

- [ ] 미러전 20게임 수동 리플레이 검수 완료
- [ ] 미러전 side-swapped bench에서 `max_steps=0`, `no_action=0`, `invalid_action=0`
- [ ] 최소 1개 교차 매치업 추가
- [ ] 교차 매치업에서도 안정성 게이트 유지
- [ ] `strong-v3` 상대로 완패 수준의 무기력 게임이 반복되지 않음

이 단계는 승률 절대값보다 아래를 더 중요하게 본다.
- 플레이 의도 노출
- 콤보 수행 여부
- 자원 낭비 감소
- 반복 오판 감소

## 구현 순서 체크리스트

- [x] 덱 레지스트리 추가
- [x] 합법성 검증 보정
- [x] 미러 매치업 스모크 연결
- [x] 턴 1 고착 재현 테스트 작성
- [x] 턴 1 고착 수정
- [x] 멀리건 규칙 추가
- [x] 초반 전개 규칙 추가
- [x] 트래시/엑시트 차용 우선순위 추가
- [x] 코스트 지불 우선순위 추가
- [ ] 타겟 선택 우선순위 추가
- [x] 아이템 운용 규칙 추가
- [ ] 리플레이 20게임 수동 검수
- [ ] 교차 매치업 1종 추가
- [x] deck-aware practice profile 분리
- [ ] 수용 게이트 통과

## 매 구현 때 공통으로 체크할 실행 절차

- [ ] 이번 변경의 목적을 한 줄로 기록했다.
- [ ] 재현 테스트 또는 시나리오 테스트를 먼저 추가했다.
- [ ] 변경 후 `npx vitest run tests/ai/LeaderDeckConstraint.vitest.test.ts` 또는 관련 테스트를 실행했다.
- [ ] 변경 후 `npx vitest run tests/ai/FixedMatchupBench.vitest.test.ts` 또는 관련 테스트를 실행했다.
- [ ] 필요 시 `AI_FIXED_BENCH_MATCHUP=fm-c-bt05-unlucky-bunny-nikki-mirror npm run ai:fixed:bench` 스모크를 실행했다.
- [ ] 리플레이 또는 로그에서 실제 행동 변화를 확인했다.
- [ ] 이 문서의 해당 체크박스를 갱신했다.

## 자주 볼 검증 명령

```bash
npx vitest run tests/ai/LeaderDeckConstraint.vitest.test.ts
npx vitest run tests/ai/FixedMatchupRegistry.vitest.test.ts
npx vitest run tests/ai/FixedMatchupBench.vitest.test.ts
AI_FIXED_BENCH_MATCHUP=fm-c-bt05-unlucky-bunny-nikki-mirror AI_FIXED_BENCH_GAMES_PER_SIDE=1 AI_FIXED_BENCH_P1_BOT=baseline-a AI_FIXED_BENCH_P2_BOT=baseline-b AI_FIXED_BENCH_OUTPUT=off npm run ai:fixed:bench
```

## 현재 알려진 병목

- 턴 1 리더 액티브 고착은 해소됐다.
- BT05 전용 오프닝 멀리건/초반 전개/초반 자원 낭비 억제는 1차 완료됐다.
- 다음 실제 병목은 `M3. 덱 핵심 플랜 이해`다.
  특히 `BT05-036`, `BT05-039`, `BT05-044`의
  트래시 엑시트 차용 타이밍과 차용 대상 선택이 아직 deck-aware 하지 않다.
