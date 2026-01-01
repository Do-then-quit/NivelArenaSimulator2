# 🎮 NivelArena Simulator

[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> [!NOTE]
> **NivelArena Simulator** is a high-performance, web-based simulator for the NivelArena TCG, designed for playtesting, deck verification, and engine development.

---

## ✨ Key Features

- **🚀 Modern Engine**: Built with a modular, data-driven card effect system ("Trigger-Cost-Action").
- **🃏 Deck Builder**: Full deck building interface with multi-deck save support.
- **🛠️ Debug System**: Comprehensive `DebugManager` for scenario testing and state injection.
- **🎨 Premium UI**: Visual-heavy design with glassmorphism, dynamic animations, and responsive side-by-side board layout.
- **⚡ Fast Feedback**: Instant state updates and real-time game flow control.

---

## 🛠️ Tech Stack

- **Core**: TypeScript (Static Typing & Scalability)
- **Bundler**: Vite (Ultra-fast Dev Server)
- **Styling**: Modern Vanilla CSS (Aesthetic Precision & Performance)
- **Testing**: Vitest (Reliable Logic Verification)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/nivel-arena-simulator.git
   cd nivel-arena-simulator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:5173`.

---

## 📂 Project Structure

```text
├── src/
│   ├── logic/          # Core Game Logic & Engine
│   │   ├── cardEffects/# Specific Card Logic Definitions
│   │   ├── GameEngine.ts
│   │   └── types.ts    # Central Type Definitions
│   ├── main.ts         # Entry Point & UI Orchestration
│   ├── style.css       # Global Styles & Design System
│   └── tests/          # Unit & Integration Tests
├── public/assets/      # Card Images & Static Assets
└── package.json        # Project Metadata & Scripts
```

---

## 🗺️ Roadmap

- [ ] Full SB01 Card Set Support
- [ ] Online 1v1 Matchmaking (WebSockets)
- [ ] Advanced AI Opponent
- [ ] Mobile-Responsive UI Optimization

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ for the NivelArena Community.
</p>
