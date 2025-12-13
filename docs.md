# Technical Documentation

## Architecture

The Universe Browser Game uses a Vue-first architecture with composables managing Three.js scenes.

### File Structure

```
src/
├── main.ts              # Vue app entry point
├── App.vue              # Root component, view switching
├── lib/
│   ├── components/      # Vue components
│   │   ├── ThreeCanvas.vue   # Solar system 3D canvas
│   │   ├── SurfaceView.vue   # Planet surface exploration
│   │   ├── InfoPanel.vue     # Planet info panel
│   │   └── ControlsHint.vue  # Keyboard controls overlay
│   ├── composables/     # Vue composables
│   │   ├── useThreeScene.ts  # Solar system scene management
│   │   └── useSurfaceView.ts # Surface exploration scene
│   ├── three/           # Three.js modules
│   │   ├── solarSystem.ts    # Planet data, orbital mechanics
│   │   ├── terrain.ts        # Procedural terrain (simplex noise)
│   │   ├── skybox.ts         # Starfield, nebulae, galaxies
│   │   ├── shaders.ts        # Atmosphere, sun glow shaders
│   │   ├── rings.ts          # Saturn/Uranus rings
│   │   └── CameraTransition.ts # Smooth camera animations
│   └── data/
│       └── planetData.ts     # Extended planet information
```

### Module Responsibilities

| Module | Purpose |
|--------|---------|
| `useThreeScene.ts` | Solar system scene, camera, controls, raycasting |
| `useSurfaceView.ts` | Surface exploration scene, movement, physics |
| `terrain.ts` | Procedural terrain with fBm noise, planet-specific configs |
| `skybox.ts` | Starfield generation, nebula effects, distant galaxies |
| `shaders.ts` | Fresnel atmosphere shaders, sun glow/corona effects |
| `rings.ts` | Procedural ring textures for Saturn and Uranus |
| `asteroids.ts` | Asteroid belt (instanced meshes), comet trails (particles) |
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

### Planet Information Panel

Glass-morphism styled panel with:
- Planet emoji and name header
- Physical properties (radius, mass, temperature, gravity)
- Orbital data (distance, year length, day length, moon count)
- Atmosphere composition
- Description and discovery info
- **Explore Surface** button (for all planets except Sun)

### HUD Elements

- **Right side**: Planet info panel (click planet to show)
- **Bottom-left**: Controls hint
- **Styling**: Glass-morphism with backdrop blur, gradient backgrounds

---

## Surface Exploration

### Terrain Generation

Uses fractal Brownian motion (fBm) with simplex noise:

```typescript
for (let i = 0; i < octaves; i++) {
    height += amplitude * noise2D(x * frequency, y * frequency);
    amplitude *= persistence;  // Reduce amplitude each octave
    frequency *= lacunarity;   // Increase frequency each octave
}
```

### Planet-Specific Terrain Configs

| Planet   | Gravity | Terrain Style | Colors |
|----------|---------|---------------|--------|
| Mercury  | 3.7 m/s² | Rocky, cratered | Grey |
| Venus    | 8.87 m/s² | Volcanic plains | Orange/yellow |
| Earth    | 9.81 m/s² | Mountains + water | Green/blue |
| Mars     | 3.71 m/s² | Desert canyons | Red/brown |
| Jupiter  | 24.79 m/s² | Gas clouds | Orange bands |
| Saturn   | 10.44 m/s² | Gas clouds | Yellow/gold |
| Uranus   | 8.69 m/s² | Ice clouds | Cyan |
| Neptune  | 11.15 m/s² | Ice clouds | Deep blue |

---

## Resources

### Texture Sources
- Local textures in `/public/textures/` (from Solar System Scope)

### Dependencies
- **vue** (^3.x) - UI framework
- **three** (^0.159.0) - 3D rendering
- **simplex-noise** (^4.0.0) - Procedural terrain generation
