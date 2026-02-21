# Universe Browser Game

A browser-based 3D solar system explorer built with Vue.js, Three.js, and TypeScript.

## Features

### Solar System
- **Complete Solar System** - All 8 planets plus 4 dwarf planets (Pluto, Eris, Makemake, Haumea)
- **Moons** - Major moons for each planet (Earth's Moon, Galilean moons, Titan, etc.)
- **Visual Effects** - Procedural starfield, planet atmospheres, Saturn's rings, sun glow
- **Camera Controls** - Smooth orbit controls with planet focus transitions

### Surface Exploration
- **Closed planets** you can walk around. Gravity pulls toward the center. There is no square edge and no teleport to the other side.
- **Measured ground** on Mercury, Venus, Earth, Mars, and Pluto: published elevation grids and mosaics on the sphere. Heights are exaggerated so mountains stand above the camera; a lap of the planet is still a few minutes. Haumea, Makemake, and Eris stay procedural noise, because no global survey exists. The Sun and the gas giants stay noise too.
- **Walk or fly** on solid worlds. The Sun and the gas giants are fly-only.
- **WASD**, sprint, jump, and mouse look. On the sphere, up is radial.
- **Day/night** as you walk around a lit planet. The photosphere stays bright.
- **HUD** with latitude, longitude, heading, altitude, local time, and a north-up minimap of the ground around you.

## Quick Start

```bash
npm install
npm run dev
```

## Optional: Generate Pre-Generated Terrains

The surface view does not load these square maps. The tool still writes them under `public/terrains/` if you want to regenerate the old assets:

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
