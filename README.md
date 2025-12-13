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
│   ├── app.ts           # Main game client, render loop, input handling
│   ├── models.ts        # TypeScript interfaces (Player, Vector3, etc.)
│   ├── physics.ts       # Physics simulation (gravity, movement)
│   ├── skybox.ts        # Procedural starfield and space background
│   ├── shaders.ts       # GLSL shaders for atmospheres
│   ├── rings.ts         # Saturn and Uranus ring generation
│   └── solarSystem.ts   # Planet data and creation logic
├── index.html           # Entry point
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Tech Stack

- **Three.js** - 3D rendering
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server

## License

MIT
