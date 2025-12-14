# Universe Browser Game

A browser-based 3D solar system explorer built with Vue.js, Three.js, and TypeScript.

## Features

### Solar System
- **Complete Solar System** - All 8 planets plus 4 dwarf planets (Pluto, Eris, Makemake, Haumea)
- **Moons** - Major moons for each planet (Earth's Moon, Galilean moons, Titan, etc.)
- **Visual Effects** - Procedural starfield, planet atmospheres, Saturn's rings, sun glow
- **Camera Controls** - Smooth orbit controls with planet focus transitions

### Surface Exploration
- **Advanced Terrain Generation**
  - Procedural terrain with noise-based generation (500x500 units, 256 resolution)
  - Dramatic height variations (30 unit scale)
- **Biome System (Earth)**
  - 7 distinct biomes: Plains, Forest, Desert, Tundra, Mountain, Beach, Ocean
  - Temperature and moisture-based biome distribution
  - Smooth biome transitions with gradient blending
  - Biome-specific colors, heights, and 200+ props
- **GTA5-style Controls**
  - WASD movement with sprint and jump
  - Mouse look camera control
  - Realistic physics with terrain collision
- **Visual Features**
  - Day/night cycle with dynamic lighting
  - Atmospheric fog and Mars dust particles
  - Shadow mapping and advanced lighting
- **UI/UX**
  - Real-time HUD (coordinates, heading, time, gravity)
  - Minimap with terrain heightmap
  - Auto-fading controls hint
- **Performance**
  - LOD system foundation
  - Distance-based prop culling

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
