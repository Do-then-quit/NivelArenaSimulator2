# AI Ready Task Checklist

이 문서는 대전 AI 구현 전 준비 상태를 점검하기 위한 체크리스트다.

## Core Gaps

- [x] 입력권(누가 지금 응답/선택해야 하는지) 상태를 엔진에 명시한다.
- [x] AI용 액션 스키마와 합법 액션 생성기(`getLegalActions`)를 제공한다.
- [x] 단일 진입점(`step`)으로 엔진 액션 실행 경로를 제공한다.
- [x] RNG를 seed 기반으로 주입 가능하게 바꿔 결정론을 보장한다.
- [x] 상태 직렬화/복원(관측/리플레이)을 위한 엔진 상태 경계를 정리한다.
- [x] baseline 봇(휴리스틱 기반)과 self-play 실행기를 추가한다.

## Stage Plan

### Stage 1 (Done)
- [x] 입력권 상태 필드 추가 (`interactionOwnerPlayerId` / `controllerPlayerId`)
- [x] `getLegalActions(actorPlayerId?)` 추가
- [x] `step(action)` 추가
- [x] 플레이어 ID 기반 선택 API 추가(존/핸드/코스트)
- [x] Stage 1 회귀 테스트 추가

### Stage 2 (Done)
- [x] RNG 추상화(`RandomProvider`) + seed 주입
- [x] 기존 `Math.random`/`Date.now` 의존 제거(엔진 핵심 로직)
- [x] 결정론 회귀 테스트 추가

### Stage 3 (Done)
- [x] 직렬화 가능한 `PendingEffect` 구조로 정리(비직렬 런타임 참조 제거)
- [x] 관측/액션 추출 인터페이스 분리 (`getObservation`, `getSerializableState`)
- [x] Stage 3 회귀 테스트 추가

### Stage 4 (Done)
- [x] `BaselineBot` 추가 (`chooseAction`, `step`)
- [x] 상호작용 모드(타겟/코스트/옵셔널/블록) 대응 휴리스틱 선택 로직 추가
- [x] `runBaselineSelfPlay` 추가 (bot vs bot 루프, 종료 사유 리포트)
- [x] Stage 4 회귀 테스트 추가
