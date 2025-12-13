# Technical Documentation

## Architecture

The Universe Browser Game uses a modular TypeScript architecture with Three.js for 3D rendering.

### File Structure

```
src/
├── app.ts           # Main game client, event handling, game loop
├── models.ts        # TypeScript interfaces and constants
├── physics.ts       # Physics simulation (gravity, movement, collisions)
├── skybox.ts        # Procedural starfield and space background
├── shaders.ts       # Custom GLSL shaders for atmospheres
├── rings.ts         # Saturn and Uranus ring generation
├── solarSystem.ts   # Planet data, creation logic, orbital mechanics
└── (future)
    ├── terrain.ts       # Procedural terrain generation
    ├── planetData.ts    # Extended planet information
    └── ui/
        └── InfoPanel.ts # Planet info panel component
```

### Module Responsibilities

| Module | Purpose |
|--------|---------|
| `app.ts` | Game initialization, render loop, input handling, camera controls |
| `models.ts` | Player, Vector3, Camera, Physics interfaces |
| `physics.ts` | Gravity simulation, player movement, collision detection |
| `skybox.ts` | Starfield generation, nebula effects, distant galaxies |
| `shaders.ts` | Fresnel atmosphere shaders, sun glow/corona effects |
| `rings.ts` | Procedural ring textures for Saturn and Uranus |
| `solarSystem.ts` | Planet/moon creation, orbital position updates |

---

## Algorithms

### Logarithmic Size Scaling

Planets use logarithmic scaling to ensure all bodies remain visible while preserving relative size differences.

```typescript
const REFERENCE_RADIUS = 6371; // Earth's radius (km)
const BASE_VISUAL_SIZE = 50;
const MIN_PLANET_SIZE = 20;
const MAX_PLANET_SIZE = 400;

function getLogarithmicSize(realRadius: number): number {
    const logSize = BASE_VISUAL_SIZE * Math.log(1 + realRadius / REFERENCE_RADIUS);
    return Math.max(MIN_PLANET_SIZE, Math.min(MAX_PLANET_SIZE, logSize));
}
```

**Benefits:**
- Jupiter (69,911 km) doesn't dominate the view
- Mercury (2,439 km) remains visible
- Preserves relative ordering (Jupiter > Saturn > Earth > Mars > Mercury)

### Orbital Mechanics

Planets orbit the sun using Keplerian motion with time-scaled angular velocity:

```typescript
const orbitalSpeed = (2 * Math.PI) / (orbitalPeriod * 24 * 60 * 60);
const angle = time * orbitalSpeed;
planet.position.x = Math.cos(angle) * scaledDistance;
planet.position.z = Math.sin(angle) * scaledDistance;
```

### Reference Frame System

When a planet is selected, all other bodies reposition relative to it:
- Selected planet stays at origin (0, 0, 0)
- Sun moves opposite to selected planet's theoretical position
- Other planets adjust positions accordingly

### Fresnel Atmosphere Shader

Atmospheric glow uses the Fresnel effect - light scatters more at grazing angles:

```glsl
// Fragment shader
float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), power);
gl_FragColor = vec4(atmosphereColor, fresnel * intensity);
```

**Parameters by planet:**
| Planet | Color | Intensity | Power | Scale |
|--------|-------|-----------|-------|-------|
| Earth | #4da6ff | 0.8 | 2.0 | 1.15 |
| Venus | #ffcc66 | 1.0 | 1.5 | 1.2 |
| Mars | #ffaa88 | 0.4 | 2.5 | 1.08 |
| Jupiter | #ffddaa | 0.6 | 2.0 | 1.1 |

### Procedural Starfield

Stars are distributed on a sphere using spherical coordinates:

```typescript
const theta = Math.random() * Math.PI * 2;
const phi = Math.acos(2 * Math.random() - 1);  // Uniform distribution
const radius = 500000 + Math.random() * 100000;

const x = radius * Math.sin(phi) * Math.cos(theta);
const y = radius * Math.sin(phi) * Math.sin(theta);
const z = radius * Math.cos(phi);
```

Star sizes follow a distribution: 70% small, 25% medium, 5% bright.

---

## UI Design

### Planet Information Panel (Planned)

```
┌─────────────────────────────────┐
│  🪐 JUPITER                     │
├─────────────────────────────────┤
│  Radius: 69,911 km              │
│  Mass: 1.898 × 10²⁷ kg          │
│  Distance: 778.5M km from Sun   │
│  Orbital Period: 11.86 years    │
│  Day Length: 9.9 hours          │
├─────────────────────────────────┤
│  The largest planet in our      │
│  solar system. Known for its    │
│  Great Red Spot storm.          │
├─────────────────────────────────┤
│  [ Explore Surface ]            │
└─────────────────────────────────┘
```

### HUD Elements

- **Top-right**: Selected planet info (name, radius, distance, orbital period)
- **Bottom-left**: Controls hint
- **Styling**: Glass-morphism with backdrop blur, gradient backgrounds

---

## Surface Features by Planet (Planned)

| Planet   | Terrain Type | Colors | Features |
|----------|-------------|--------|----------|
| Mercury  | Rocky       | Grey/brown | Heavy cratering |
| Venus    | Volcanic    | Yellow/orange | Volcanic plains, thick atmosphere |
| Earth    | Varied      | Green/blue/brown | Continents, oceans, mountains |
| Mars     | Desert      | Red/orange | Canyons, volcanoes, polar ice |
| Jupiter  | Gas clouds  | Orange/white bands | Storms, Great Red Spot |
| Saturn   | Gas clouds  | Yellow/gold bands | Hexagonal storm at pole |
| Uranus   | Ice clouds  | Cyan/teal | Uniform appearance |
| Neptune  | Ice clouds  | Deep blue | Dark spots, high winds |

---

## Resources

### Texture Sources (Public Domain)
- NASA Solar System Exploration: https://solarsystem.nasa.gov/
- Solar System Scope: https://www.solarsystemscope.com/textures/
- NASA Visible Earth: https://visibleearth.nasa.gov/

### Dependencies
- **three.js** (^0.159.0) - 3D rendering
- **simplex-noise** (^4.0.0) - Terrain generation (future)
