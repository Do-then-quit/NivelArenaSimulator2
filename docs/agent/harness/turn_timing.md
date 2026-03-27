# Turn Timing

## 메인 리본
- 항상 상단에 아래 순서가 보인다.
- `레벨업 -> 드로우 -> 메인 -> 어택 -> 엔드`

## 어택 하위 스텝
- 어택/블록 중에는 하위 스텝 바를 같이 보여준다.
- 기본 표기:
  - `공격 선언`
  - `방어 선언`
  - `전투/대미지`
  - `전투 종료`

## interaction mode 매핑
- `NORMAL`: 일반 진행
- `SELECT_MULLIGAN`: 멀리건 선택
- `SELECT_TARGET`: 대상 선택
- `SELECT_COST`: 비용 선택
- `SELECT_OPTIONAL`: 선택 효과 확인

## 강제 흐름
- `pendingEffect`가 있으면 타이밍보다 해결 대기열을 우선 노출한다.
- interaction owner가 있는 동안 다른 입력은 부차적이다.
- end phase hand adjustment도 일반 효과와 같은 pending contract로 본다.
