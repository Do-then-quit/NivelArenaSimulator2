# UX Clarity Contract

## 평가 비중
- 룰 정확성 `40`
- 페이즈/스텝 가시성 `20`
- 행동 가능성 명확성 `20`
- 타이밍/원인 설명력 `15`
- 시각적 안정성 `5`

## 통과 조건
- `npm run test:ux-harness` green
- `npm run test:ux-harness:e2e` green
- `npm run test:ux-harness:report` green
- 총점 `>= 92`
- `룰 정확성 >= 38`
- `행동 가능성 명확성 >= 18`
- `타이밍/원인 설명력 >= 13`
- `mandatoryHiddenCount = 0`

## 비기능 원칙
- UI는 legality를 추측하지 않는다.
- `preview`가 신뢰되지 않으면 생략한다.
- 플레이어용 문구는 한국어 우선이다.
- 비활성 행동은 숨기지 않고 reason과 함께 보여준다.
- 강제 효과는 queue 우선, interaction banner는 입력 힌트와 confirm CTA만 맡는다.
- 상단 5단계 리본은 `레벨업 -> 드로우 -> 메인 -> 어택 -> 엔드`를 유지하고, `BLOCK`는 `어택` 축 + `방어 선언` 서브 스텝 바로 설명한다.
- phase-change toast는 상단 chrome이 아니라 우측 control column에서 관리한다.

## 현재 스프린트 계약
- 범위: 데스크톱 `Quick Play` + dev checkpoint loader
- 완료 정의:
  - 액션 패널은 카드/주체 기준으로 그룹화된다.
  - disabled action은 summary와 상세 reason을 함께 제공한다.
  - mandatory queue는 progress를 단일 source로 제공한다.
  - interaction banner는 진행률을 중복 노출하지 않는다.
  - phase ribbon / attack step / queue / action rows / CTA / toast에 안정적인 selector가 있다.
  - shell copy는 한국어 우선으로 정리된다.
