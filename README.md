# Universe Browser Game

A browser-based 3D solar system explorer built with Vue.js, Three.js, and TypeScript.

## Features

### Solar System
- **Complete Solar System** - All 8 planets plus 4 dwarf planets (Pluto, Eris, Makemake, Haumea)
- **Moons** - Major moons for each planet (Earth's Moon, Galilean moons, Titan, etc.)
- **Visual Effects** - Procedural starfield, planet atmospheres, Saturn's rings, sun glow
- **Camera Controls** - Smooth orbit controls with planet focus transitions

### Surface Exploration
- **Advanced Terrain Generation (Offline + Runtime)**
  - Pre-generated 16-bit heightmaps (default: 1024×1024) generated via `tools/terrain-generator`
  - Runtime integration loads `/public/terrains/{planet}/heightmap.png` + `metadata.json`
  - Fallback to runtime simplex-noise terrain generation if pre-generated assets are missing
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
  - Mars dust particles
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

## Optional: Generate Pre-Generated Terrains

Terrain heightmaps are already expected in `public/terrains/`. To regenerate them:

```bash
npm run generate:terrains
```

Or generate a single planet:

```bash
npm run generate:terrain -- earth
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
│       │   ├── Minimap.vue
│       │   ├── SurfaceView.vue
│       │   └── ControlsHint.vue
│       ├── composables/    # Vue composables
│       │   ├── useThreeScene.ts
│       │   └── useSurfaceView.ts
│       ├── three/          # Three.js modules
│       │   ├── solarSystem.ts
│       │   ├── terrain.ts
│       │   ├── terrainLoader.ts
│       │   ├── skybox.ts
│       │   ├── shaders.ts
│       │   ├── rings.ts
│       │   └── CameraTransition.ts
│       └── data/           # Static data
│           └── planetData.ts
├── public/
│   ├── terrains/            # Pre-generated terrain assets (heightmap/normalmap/metadata)
│   └── textures/           # Planet textures
├── tools/
│   └── terrain-generator/   # Offline terrain generation tool (Node/TS)
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
