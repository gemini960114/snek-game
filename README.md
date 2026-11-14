# 🐍 SNEK — Christmas & Holiday Edition 🎄🎅

A modern, polished retro Snake game with festive Christmas vibes, built with vanilla HTML5 Canvas, CSS3, and JavaScript — no frameworks, no dependencies, works completely offline.

🎮 **[Play Live on GitHub Pages](https://gemini960114.github.io/snek-game/)**

---

## ✨ Features

- **Smooth Canvas Rendering**: Crisp grid and snake animations powered by HTML5 2D Canvas.
- **Multiple Control Schemes**:
  - Keyboard: Arrow Keys or `W` / `A` / `S` / `D`
  - Mobile: On-screen responsive D-Pad & touch swipe support
  - Shortcuts: `SPACE` to pause, `R` to restart
- **Gameplay & Mechanics**:
  - **Red Apples**: Regular food (+10 points).
  - **Golden Apples**: 10% spawn chance, bonus food (+50 points).
  - **Dynamic Leveling**: Speed increases as your score grows.
  - **Local Persistence**: High score automatically saved in `localStorage`.
- **Customizable Settings**:
  - Speed levels: Turbo (80ms), Normal (110ms), Chill (160ms), Slow (220ms)
  - Grid sizes: 15×15, 20×20, 25×25, 30×30
  - Wall Mode: Solid walls (classic) or Wrap-around walls (chaos mode)
  - Web Audio sound effects toggle

---

## 🚀 Getting Started

Simply open `index.html` in any modern web browser or serve it with any static server:

```bash
# Using python
python -m http.server 8000

# Or using npx serve
npx serve .
```

---

## 🛠️ Tech Stack

- **HTML5** (Canvas API, Semantic Elements, Dialog Modal)
- **CSS3** (CSS Variables, Flexbox/Grid, Glassmorphism, Responsive Design)
- **JavaScript (ES6+)** (Web Audio API, Touch Events, LocalStorage)

---

## 📄 License

MIT
