# Fixed Matchup Bot Subagents (2026-03-18)

## 목적

- 이 문서는 `Codex subagents`를 현재 저장소의 AI 강화 루프에 맞게 재구성한 제안서다.
- 기본 제공 `explorer`, `worker`만으로도 작업은 가능하지만, 플레이 봇 강화는
  "실패 분석 -> 가설 수립 -> 구현 -> 벤치 -> 승격 판정" 루프가 반복되므로
  역할을 더 세분화하는 편이 효율적이다.
- 특히 이번 저장소는 활성 로드맵이
  `docs/roadmaps/aiRoadmap.fixed_matchup.ko.md`
  기준의 `fixed matchup` 우선 전략을 따르므로, 그에 맞는 agent 분리가 필요하다.

## 왜 기본 agent 둘만으로는 부족한가

- `explorer`는 어디를 봐야 하는지 찾는 데 강하지만,
  "지금 어떤 실험을 다음으로 해야 하는가"까지 우선순위화해주지는 않는다.
- `worker`는 구현에는 강하지만,
  패배 원인을 리플레이와 KPI로 해석하거나 승격 여부를 엄격히 판정하는 역할과는 다르다.
- 봇 강화 작업은 코드 변경보다도
  "어떤 실패를 어떤 실험으로 바꿀지"가 성패를 크게 좌우한다.
- 그래서 이 프로젝트에는 최소한 아래 6개 역할이 있으면 루프가 더 잘 돈다.

## 추천 subagent 구성

### 1. `bot_explorer`

- 역할:
  - 코드 경로 탐색
  - 어떤 파일과 심볼이 실제 의사결정을 소유하는지 매핑
- 주 용도:
  - 새 실험 전에 touch point 파악
  - `StrongBotV3`와 practice profile 경계 확인
  - 테스트/스크립트/아티팩트 연동 지점 파악

### 2. `replay_auditor`

- 역할:
  - 리플레이/로그/아티팩트 기반 실패 분석
  - "왜 졌는가"를 seed, 턴, 패턴 기준으로 분류
- 주 용도:
  - `lethal_miss_rate`, `wasteful_upgrade_rate`, `self_lethal_open_rate`
    같은 KPI와 실제 플레이 라인을 연결
  - 새 회귀 테스트 아이디어 도출

### 3. `learning_strategist`

- 역할:
  - 연구 방향과 실험 우선순위 제시
  - 휴리스틱, 탐색, BC, RL, 하이브리드 중 무엇을 언제 할지 판단
- 주 용도:
  - "다음으로 무엇을 시도해야 승률이 오를 가능성이 높은가" 정리
  - FM1에 머물러야 하는지, FM2/FM3로 넘어갈 준비가 되었는지 판단

이 agent가 특히 중요하다.
기본 `explorer`에는 없는 "연구 디렉터" 역할이라,
사용자님이 말한 "더 나은 봇을 만들기 위한 연구 방향을 제시하는 봇"에 해당한다.

### 4. `bot_implementer`

- 역할:
  - 하나의 가설을 코드로 구현
  - 가능한 한 테스트를 먼저 고정
- 주 용도:
  - `StrongBotV3` 파라미터/탐색 수정
  - `PracticeStrongBot` / deck profile 규칙 추가
  - 관련 회귀 테스트 보강

### 5. `bench_runner`

- 역할:
  - 회귀/벤치/소크 실행과 결과 요약
- 주 용도:
  - 타깃 테스트
  - `npm run ai:regression`
  - `npm run test:bot-soak`
  - `npm run ai:fixed:bench`
  - 필요 시 `npm run ai:phase4:matrix`

### 6. `promotion_gatekeeper`

- 역할:
  - 후보 봇 승격 여부 판정
  - 승격 보류 시 가장 ROI가 큰 다음 액션 제안
- 주 용도:
  - 일반 strong bot 후보는 `ai:phase4.1:promote` 기준으로 판정
  - deck-aware practice bot은 fixed matchup 벤치와 필수 회귀 기준으로 판정

## 권장 루프

### 루프 A: deck-aware practice bot 강화

1. `replay_auditor`
2. `learning_strategist`
3. `bot_explorer`
4. `bot_implementer`
5. `bench_runner`
6. `promotion_gatekeeper`

설명:
- 먼저 실제 패배 패턴을 보고,
- 그 패턴을 실험 가능한 가설로 바꾼 뒤,
- 코드 touch point를 좁히고,
- 작은 수정과 테스트를 넣고,
- fixed matchup 벤치로 확인한 다음,
- promote/hold 결정을 내리는 순서다.

### 루프 B: `StrongBotV3` 계열 범용 강화

1. `replay_auditor`
2. `learning_strategist`
3. `bot_explorer`
4. `bot_implementer`
5. `bench_runner`
6. `promotion_gatekeeper`

설명:
- 구조는 같지만 검증 단계에서
  `ai:phase4:matrix`, `ai:phase4.1:promote` 비중이 더 커진다.

## 빠르게 써먹는 조합

### 조합 1. "왜 졌는지 먼저 알고 싶다"

- `replay_auditor` + `learning_strategist`

예시 프롬프트:

```text
Latest BT05 Nikki mirror artifacts and related tests를 보고,
현재 패배 혹은 저품질 플레이 패턴 TOP 3를 분류해줘.
그 다음 각 패턴을 줄이기 위한 실험 3개를 우선순위와 함께 제안해줘.
지금 단계에서는 RL로 점프하지 말고 FM1 범위의 휴리스틱/탐색 개선을 우선 검토해줘.
```

### 조합 2. "어디를 고쳐야 할지 모르겠다"

- `bot_explorer` + `bot_implementer`

예시 프롬프트:

```text
BT05 Nikki practice bot가 optional effect를 과하게 쓰는 문제를 고치고 싶다.
먼저 bot_explorer가 실제 의사결정 경로와 관련 테스트 파일을 맵핑해주고,
그 결과를 바탕으로 bot_implementer가 가장 작은 수정과 회귀 테스트를 추가해줘.
```

### 조합 3. "후보 봇을 승격할 수 있는지 판단하고 싶다"

- `bench_runner` + `promotion_gatekeeper`

예시 프롬프트:

```text
practice-bt05-nikki-strong-v2 후보를 fixed matchup 기준으로 평가해줘.
필요한 테스트와 bench를 실행하고,
성능, 안정성, 전술 KPI, 재현 가능성 기준으로 promote / hold / reject 중 하나를 내려줘.
```

### 조합 4. "중장기 연구 방향까지 같이 보고 싶다"

- `replay_auditor` + `learning_strategist`

예시 프롬프트:

```text
현재 fixed matchup 루프에서 어떤 개선이 아직 휴리스틱/탐색으로 해결 가능하고,
어디서부터 BC 혹은 RL 준비가 필요해지는지 정리해줘.
필요하다면 dataset, KPI, 계측, seed suite 측면의 선행 조건도 같이 제안해줘.
```

## 이 저장소에서 특히 잘 맞는 이유

- 이미 아래 요소들이 갖춰져 있다.
  - `src/logic/ai/StrongBotV3.ts`
  - `src/logic/ai/practice/PracticeStrongBot.ts`
  - `scripts/ai/run_fixed_matchup_batch.ts`
  - `scripts/ai/run_phase41_promotion_gate.ts`
  - `tests/ai/`
  - `tests/rules_v2_regression/`
  - `artifacts/ai/`
- 즉 "agent가 분석할 재료"와 "검증 레일"이 이미 있어서,
  단순 구현 agent보다 분석/연구/판정 agent를 추가할 효율이 높다.

## 지금 추가한 예시 파일

- `.codex/agents/bot-explorer.toml`
- `.codex/agents/replay-auditor.toml`
- `.codex/agents/learning-strategist.toml`
- `.codex/agents/bot-implementer.toml`
- `.codex/agents/bench-runner.toml`
- `.codex/agents/promotion-gatekeeper.toml`

## 추천 운영 원칙

- 한 agent에게 "원인 분석, 구현, 벤치, 승격 판정"을 한 번에 몰아주지 않는다.
- `learning_strategist`는 코드 수정보다
  "다음 실험의 품질"을 높이는 데 집중시킨다.
- `bot_implementer`는 한 번에 하나의 가설만 구현하게 한다.
- `bench_runner`와 `promotion_gatekeeper`는 구현 agent와 분리해서
  자기합리화를 줄인다.
- FM0/FM1이 끝나기 전에는
  덱 탐색이나 대규모 RL을 기본 선택지로 두지 않는다.

## 선택적 설정 예시

프로젝트 차원에서 병렬 agent 수를 제한하고 싶다면
`.codex/config.toml`에 아래처럼 둘 수 있다.

```toml
[agents]
max_threads = 6
max_depth = 1
```

이 설정은 예시일 뿐이며, 현재 커밋에는 포함하지 않았다.
