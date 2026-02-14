# NivelArenaSimulator2

니벨아레나 TCG 규칙을 기준으로 동작하는 시뮬레이터 프로젝트입니다.  
목표는 다음 3가지입니다.

- 룰/카드 효과를 엔진으로 재현
- 회귀 테스트로 동작 안정화
- 대전 AI 실험을 위한 self-play 기반 마련

기준 문서는 `NivelArena_Comprehensive_Rules_Ver.2.0.pdf`이며, 카드 텍스트를 최우선으로 해석합니다.

## 현재 구현 범위

### 엔진
- 턴/페이즈(Level Up, Draw, Main, Attack, End) 진행
- 전투 선언/방어 선언/전투 해결/종료 처리
- 효과 큐 및 지연 처리(대미지 처리 중 비트리거 효과 지연 등)
- 상호작용 입력권(`interactionOwnerPlayerId`) 분리
- 합법 액션 생성(`getLegalActions`) + 단일 실행 진입점(`step`)
- 시드 기반 RNG 주입 및 직렬화 가능한 상태 관측(`getObservation`, `getSerializableState`)
- 멀리건(초기 5장 후 1회 전체 교체 또는 유지)

### 카드/팩
- 카드 데이터: `packs/*.json`
- 효과 구현: `ST01`, `ST02`, `ST03`, `BT01` 중심
- 다른 팩은 데이터는 있으나 효과 구현은 진행 중

### AI
- `BaselineBot` 구현
- Bot vs Bot self-play 유틸 제공
- soak 회귀 테스트로 진행 불가/데드락 상황 점검

### UI
- Quick Play, Custom Simulation(PvP), Custom vs Baseline Bot
- 덱 빌더 및 셋업 화면
- 멀리건 UI
- 게임 종료 팝업(승패/대미지/기본 통계 표시)
- 봇전 시작 시 봇 핸드 공개/비공개 선택

## 실행 방법

요구 사항:
- Node.js 18+ (권장)
- npm

설치:

```bash
npm install
```

개발 서버:

```bash
npm run dev
```

빌드:

```bash
npm run build
```

## 테스트

전체 테스트:

```bash
npm test
```

특정 파일 테스트:

```bash
npx vitest run tests/rules_v2_regression/<파일명>.test.ts
```

Bot self-play quick soak:

```bash
npm run test:bot-soak
```

Bot self-play extended soak (PowerShell):

```powershell
$env:BOT_SOAK_ENABLE='1'
$env:BOT_SOAK_GAMES='120'
$env:BOT_SOAK_MAX_STEPS='2400'
npm run test:bot-soak
```

## 주요 폴더

```text
src/
  logic/
    GameEngine.ts
    effects.ts
    effectActions.ts
    RuleValidator.ts
    TargetSelector.ts
    ai/BaselineBot.ts
    cardEffects/
  main.ts
  SetupUI.ts
tests/
  rules_v2_regression/
packs/
AGENTS.md
docs/plans/AiReadyTask.md
```

## 현재 제한 사항

- 전 팩의 카드 효과가 완전히 구현된 상태는 아님
- 강화학습 파이프라인(PPO 등)은 아직 미연결
- 멀티플레이/서버 기반 대전은 현재 범위 밖

## 앞으로 할 일

- 카드 효과 커버리지 확장(ST/BT 추가 구현)
- self-play 로그를 학습용 데이터셋으로 적재하는 파이프라인 정리
- BaselineBot 개선(평가 지표, 휴리스틱 고도화)
- 학습 루프 연결(RL 실험 환경/리플레이 평가 자동화)

## 참고

- 운영/개발 가이드: `AGENTS.md`
- AI 준비 태스크 기록: `docs/plans/AiReadyTask.md`

본 프로젝트는 비공식 시뮬레이터이며, 원작 게임 및 카드 IP는 각 권리자에게 있습니다.
