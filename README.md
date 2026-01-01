# 🎮 니벨아레나 시뮬레이터 (NivelArena Simulator)

[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> [!NOTE]
> **니벨아레나 시뮬레이터**는 니벨아레나 TCG를 위한 고성능 웹 기반 시뮬레이터입니다. 플레이 테스트, 덱 검증, 그리고 게임 엔진 개발을 위해 설계되었습니다.

> [!IMPORTANT]
> **저작권 고지**: '니벨아레나(NivelArena)' 게임 시스템 및 모든 카드 데이터, 이미지 자산의 저작권은 **젬블로컴퍼니(Gemblo Company)**에 있습니다. 본 프로젝트는 비영리 목적으로 개발된 팬 메이드 시뮬레이터입니다.

---

## ✨ 핵심 기능

- **🚀 현대적인 엔진**: 모듈화된 데이터 기반 카드 효과 시스템 ("Trigger-Cost-Action")으로 구축되었습니다.
- **🃏 덱 빌더**: 멀티 덱 저장 및 관리를 지원하는 완전한 덱 빌딩 인터페이스를 제공합니다.
- **🛠️ 디버그 시스템**: 시나리오 테스트 및 상태 주입을 위한 강력한 `DebugManager`를 포함합니다.
- **🎨 프리미엄 UI**: 글래스모피즘, 다이내믹 애니메이션, 반응형 좌우 배치 보드 레이아웃을 갖춘 세련된 디자인입니다.
- **⚡ 빠른 피드백**: 실시간 게임 상태 업데이트 및 즉각적인 흐름 제어가 가능합니다.

---

## 🛠️ 기술 스택

- **Core**: TypeScript (정적 타이핑 및 확장성 확보)
- **Bundler**: Vite (초고속 개발 서버)
- **Styling**: Vanilla CSS (정밀한 디자인 제어 및 성능 최적화)
- **Testing**: Vitest (신뢰성 있는 로직 검증)

---

## 🚀 시작하기

### 설치 요구 사항

- [Node.js](https://nodejs.org/) (v18 이상 권장)
- [npm](https://www.npmjs.com/)

### 실행 방법

1. 저장소 클론:
   ```bash
   git clone https://github.com/yourusername/nivel-arena-simulator.git
   cd nivel-arena-simulator
   ```

2. 종속성 설치:
   ```bash
   npm install
   ```

3. 개발 서버 실행:
   ```bash
   npm run dev
   ```

4. 브라우저에서 `http://localhost:5173` 접속.

---

## 📂 프로젝트 구조

```text
├── src/
│   ├── logic/          # 핵심 게임 로직 및 엔진
│   │   ├── cardEffects/# 카드별 개별 효과 정의
│   │   ├── GameEngine.ts
│   │   └── types.ts    # 통합 타입 정의
│   ├── main.ts         # 엔트리 포인트 및 UI 조율
│   ├── style.css       # 글로벌 스타일 및 디자인 시스템
│   └── tests/          # 유닛 및 통합 테스트
├── public/assets/      # 카드 이미지 및 정적 자산
└── package.json        # 프로젝트 메타데이터 및 스크립트
```

---

## 🗺️ 로드맵

- [ ] SB01 카드 세트 전체 지원
- [ ] 온라인 1v1 매칭 (WebSockets)
- [ ] 고급 AI 상대 구현
- [ ] 모바일 반응형 UI 최적화

---

## 🤝 기여하기

기여는 언제나 환영합니다! 풀 리퀘스트(PR)를 자유롭게 제출해 주세요.

1. 프로젝트 포크 (Fork)
2. 기능 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경 사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치 푸시 (`git push origin feature/AmazingFeature`)
5. 풀 리퀘스트 열기

---

## 📄 라이선스

본 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

---

<p align="center">
  니벨아레나 커뮤니티를 위해 ❤️로 제작되었습니다.
</p>
