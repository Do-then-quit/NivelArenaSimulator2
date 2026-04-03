# UX Harness Artifacts

이 폴더는 UX 하네스의 브라우저 산출물을 저장한다.

## 생성 파일
- `raw/*.json`: 시나리오별 DOM 관측값과 assertion 결과
- `screenshots/*.png`: Quick Play/Checkpoint 캡처 이미지
- `scorecard.json`: 점수 요약, threshold, category average
- `scorecard.md`: 사람이 읽기 쉬운 요약본

## 실행 순서
1. `npm run test:ux-harness`
2. `npm run test:ux-harness:e2e`
3. `npm run test:ux-harness:report`

## 최소 보존 규칙
- 최신 scorecard 한 벌은 항상 덮어쓴다.
- screenshot과 raw artifact는 scenario id 기준 파일명으로 저장한다.
- scorecard에서 gate가 fail이면 findings를 비워 두지 않는다.
