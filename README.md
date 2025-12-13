# Universe Browser Game

A browser-based 3D solar system explorer built with Vue.js, Three.js, and TypeScript.

## Features

- **Complete Solar System** - All 8 planets with accurate relative sizes and orbital mechanics
- **Moons** - Major moons for each planet (Earth's Moon, Galilean moons, Titan, etc.)
- **Visual Effects** - Procedural starfield, planet atmospheres, Saturn's rings, sun glow, asteroid belt, comets
- **Surface Exploration** - Procedural terrain generation with planet-specific gravity
- **Camera Controls** - Smooth orbit controls with planet focus transitions

## Quick Start

```bash
npm install
npm run dev
```

## Controls

### Solar System View
| Key | Action |
|-----|--------|
| **Click** | Select planet to focus |
| **Enter** | Open info panel / Enter surface |
| **← →** | Navigate between planets (in info view) |
| **I** | Toggle planet name labels |
| **Mouse Drag** | Orbit camera |
| **Scroll** | Zoom in/out |
| **ESC** | Close panel / Return to overview |

### Surface View
| Key | Action |
|-----|--------|
| **WASD** | Move around |
| **Space** | Jump |
| **Mouse** | Look around |
| **ESC** | Exit to orbit view |

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
│   └── lib/
│       ├── components/     # Vue components
│       │   ├── ThreeCanvas.vue
│       │   ├── InfoPanel.vue
│       │   ├── SurfaceView.vue
│       │   └── ControlsHint.vue
│       ├── composables/    # Vue composables
│       │   ├── useThreeScene.ts
│       │   └── useSurfaceView.ts
│       ├── three/          # Three.js modules
│       │   ├── solarSystem.ts
│       │   ├── terrain.ts
│       │   ├── skybox.ts
│       │   ├── shaders.ts
│       │   ├── rings.ts
│       │   └── CameraTransition.ts
│       └── data/           # Static data
│           └── planetData.ts
├── public/
│   └── textures/           # Planet textures
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Tech Stack

- **Vue.js 3** - Reactive UI framework
- **Three.js** - 3D rendering
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **simplex-noise** - Procedural terrain generation

## License

MIT
