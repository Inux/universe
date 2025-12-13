# Universe Browser Game

A browser-based 3D solar system explorer built with Three.js and TypeScript.

## Features

- **Complete Solar System** - All 8 planets with accurate relative sizes and orbital mechanics
- **Moons** - Major moons for each planet (Earth's Moon, Galilean moons, Titan, etc.)
- **Visual Effects** - Procedural starfield, planet atmospheres, Saturn's rings, sun glow
- **Physics Simulation** - Local gravity, walking, jumping mechanics
- **Camera Controls** - Orbit controls and player-following camera modes

## Quick Start

```bash
npm install
npm run dev
```

## Controls

| Key | Action |
|-----|--------|
| **Click** | Select planet to focus |
| **Mouse** | Orbit camera |
| **WASD** | Move player |
| **Space** | Jump |
| **L** | Locate player |
| **ESC** | Return to solar system view |

## Documentation

- **[docs.md](./docs.md)** - Technical documentation (architecture, algorithms, UI design)
- **[PLAN.md](./PLAN.md)** - Implementation roadmap and progress

## Project Structure

```
universe/
├── src/
│   ├── main.ts             # Vue app entry point
│   ├── App.vue             # Root Vue component
│   ├── style.css           # Global styles
│   ├── vite-env.d.ts       # Vite type declarations
│   └── lib/
│       ├── components/     # Vue components
│       │   ├── ThreeCanvas.vue
│       │   ├── InfoPanel.vue
│       │   └── ControlsHint.vue
│       ├── composables/    # Vue composables
│       │   └── useThreeScene.ts
│       ├── three/          # Three.js modules
│       │   ├── solarSystem.ts
│       │   ├── skybox.ts
│       │   ├── shaders.ts
│       │   └── rings.ts
│       │   └── CameraTransition.ts
│       ├── game/           # Game logic
│       │   ├── models.ts
│       │   └── physics.ts
│       └── data/           # Static data
│           └── planetData.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Tech Stack

- **Three.js** - 3D rendering
- **Vue.js** - Reactive UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server

## License

MIT
