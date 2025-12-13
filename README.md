# Universe Browser Game

A browser-only version of the Universe game, ported from the original Go backend + frontend architecture.

## Features

- **Complete Solar System**: All 8 planets with accurate relative sizes and distances
- **Moons**: Major moons for each planet (Earth's Moon, Galilean moons, etc.)
- **Physics Simulation**: Local gravity, walking, jumping mechanics on Earth's surface
- **Distance Scaling**: Interactive slider to adjust orbital distances (0.1x to 10x)
- **Camera Controls**: Orbit controls and player-following camera modes
- **Real-time Updates**: Smooth 60fps rendering with physics updates

## Controls

- **WASD**: Move player (forward/backward/strafe)
- **Space**: Jump
- **Mouse**: Orbit camera around selected planet
- **Click**: Select planets or moons to focus on them
- **L**: Locate and follow player
- **ESC**: Return to solar system overview
- **Distance Slider**: Adjust orbital distances in real-time

## Solar System Data

### Planets
- **Sun**: 696,340 km radius
- **Mercury**: 2,439.7 km radius, 57.9M km from Sun
- **Venus**: 6,051.8 km radius, 108.2M km from Sun
- **Earth**: 6,371 km radius, 149.6M km from Sun
- **Mars**: 3,389.5 km radius, 227.9M km from Sun
- **Jupiter**: 69,911 km radius, 778.5M km from Sun
- **Saturn**: 58,232 km radius, 1,432M km from Sun
- **Uranus**: 25,362 km radius, 2,867M km from Sun
- **Neptune**: 24,622 km radius, 4,515M km from Sun

### Major Moons
- **Earth**: Moon
- **Mars**: Phobos, Deimos
- **Jupiter**: Io, Europa, Ganymede, Callisto
- **Saturn**: Titan, Rhea, Iapetus, Dione
- **Uranus**: Titania, Oberon, Umbriel, Ariel
- **Neptune**: Triton, Nereid

## Technical Details

- **Local Physics**: All calculations run client-side using TypeScript
- **Three.js Rendering**: WebGL-based 3D graphics
- **Orbital Mechanics**: Accurate relative positioning and orbital periods
- **Scalable Distances**: Dynamic distance scaling for better visualization
- **Reference Frame System**: Planets reposition relative to selected body

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run serve
```

## Architecture

```
src/
├── models.ts      # TypeScript interfaces and constants
├── physics.ts     # Physics simulation functions
└── app.ts         # Main game client with Three.js rendering
```

Key changes from multiplayer version:
- ✅ Removed WebSocket dependency
- ✅ Added complete solar system data
- ✅ Implemented moon rendering and physics
- ✅ Added distance scaling controls
- ✅ Maintained all visual features and controls

---

## 🚀 Upcoming Improvements (Implementation Plan)

Based on user feedback, the following enhancements are planned:

### 1. Planet Scaling Improvements
**Problem**: Current scaling requires manual slider adjustment; some planets too small/big.

**Solution**:
- Remove the distance scaling slider
- Implement automatic distance scaling so all planets are visible in the default view
- Use **logarithmic size scaling** for planet radii:
  - Preserves relative size differences (Jupiter > Earth > Mercury)
  - Ensures small planets (Mercury, Mars) remain visible
  - Ensures large planets (Jupiter, Saturn) don't dominate the view
  - Formula: `visualRadius = baseSize * log(1 + realRadius / referenceRadius)`

**Files to modify**: `src/app.ts` (SCALE constants, initSolarSystem, remove slider)

---

### 2. Space Background with Galaxies
**Problem**: Game is too dark, lacks visual appeal.

**Solution**:
- Add a **space skybox** with:
  - Distant galaxies (Milky Way band, Andromeda, etc.)
  - Star field with varying brightness and colors
  - Nebula effects for visual depth
- Use a high-quality equirectangular or cubemap texture
- Options:
  - NASA/ESA public domain space imagery
  - Procedurally generated starfield with Three.js

**Implementation**:
```typescript
// Add skybox to scene
const loader = new THREE.CubeTextureLoader();
const skybox = loader.load([px, nx, py, ny, pz, nz]);
scene.background = skybox;
```

**Files to modify**: `src/app.ts` (initThree)

---

### 3. Realistic Planet Visuals
**Problem**: Planets don't look realistic.

**Solution**:
- **High-resolution textures** (2K-4K from NASA/solar system scope)
- **Normal/bump maps** for surface detail (craters, mountains)
- **Atmosphere effects**:
  - Earth: blue haze with Fresnel shader
  - Venus: thick yellow atmosphere
  - Gas giants: atmospheric bands, storm effects
- **Ring systems** for Saturn (and Uranus)
- **Emissive sun** with bloom/glow effect
- **Cloud layers** for Earth, Venus, Jupiter

**Implementation approach**:
```typescript
// Planet with atmosphere
const atmosphereMaterial = new THREE.ShaderMaterial({
  // Fresnel-based atmospheric scattering
  uniforms: { ... },
  vertexShader: atmosphereVert,
  fragmentShader: atmosphereFrag,
  blending: THREE.AdditiveBlending,
  side: THREE.BackSide
});
```

**Files to modify**: `src/app.ts` (planet creation), new file `src/shaders.ts`

---

### 4. Planet Information Panel (First Click)
**Problem**: No way to learn about planets.

**Solution**:
- First click on a planet → Show **info panel** with:
  - Planet name (large header)
  - Physical data: radius, mass, gravity, temperature
  - Orbital data: distance from Sun, orbital period, day length
  - Interesting facts (atmosphere composition, number of moons)
  - Image/icon of the planet
- Panel appears as **overlay** on the right side
- Camera smoothly zooms to focus on the planet
- Panel includes "Explore Surface" button

**UI Design**:
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

**Files to modify**: `src/app.ts` (handleClick, new UI component), `index.html` (info panel container)

---

### 5. Planet Surface Exploration (Second Click)
**Problem**: Users want to explore planet surfaces.

**Solution**:
- Second click (or "Explore Surface" button) → **Transport to planet surface**
- Generate **procedural terrain** based on planet type:
  - **Rocky planets** (Mercury, Venus, Earth, Mars): Height-mapped terrain with craters, mountains
  - **Gas giants** (Jupiter, Saturn, Uranus, Neptune): Cloud layer surface with storms, bands
  - **Moon surfaces**: Cratered, low-gravity environment

**Terrain Generation**:
- Use **Perlin noise** / **Simplex noise** for height maps
- Planet-specific parameters:
  - Earth: continents, oceans, mountains (green/blue/brown)
  - Mars: red desert, Olympus Mons-style mountains, canyons
  - Moon: grey craters, maria (dark basalt plains)
  - Venus: volcanic plains, yellow haze
  - Gas giants: swirling cloud layers, no solid surface

**Implementation**:
```typescript
// Procedural terrain generation
class TerrainGenerator {
  generate(planetType: string, size: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(size, size, 256, 256);
    const noise = new SimplexNoise();

    // Modify vertices based on noise
    for (vertex of geometry.vertices) {
      vertex.z = noise.noise2D(vertex.x * freq, vertex.y * freq) * amplitude;
    }

    return new THREE.Mesh(geometry, planetMaterial);
  }
}
```

**Surface Features by Planet**:
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

**Navigation on Surface**:
- WASD movement (existing)
- Gravity adjusted per planet
- Press ESC to return to orbital view

**Files to modify**: `src/app.ts`, new file `src/terrain.ts`, `src/physics.ts` (planet-specific gravity)

---

## Implementation Order

1. **Phase 1 - Visual Polish** (Immediate impact)
   - [ ] Add space skybox background
   - [ ] Improve planet textures and add atmosphere effects
   - [ ] Add Saturn's rings

2. **Phase 2 - Scaling Fixes**
   - [ ] Remove distance slider
   - [ ] Implement logarithmic size scaling
   - [ ] Set optimal default camera position

3. **Phase 3 - Planet Exploration**
   - [ ] Add planet info panel (first click)
   - [ ] Add planet data to SOLAR_SYSTEM object
   - [ ] Smooth camera transitions

4. **Phase 4 - Surface Exploration**
   - [ ] Create terrain generator
   - [ ] Implement planet surface view mode
   - [ ] Add planet-specific terrain parameters
   - [ ] Adjust physics for each planet's gravity

---

## Technical Notes

### Dependencies to Add
```json
{
  "simplex-noise": "^4.0.0"  // For terrain generation
}
```

### New Files Structure
```
src/
├── app.ts           # Main game client (modified)
├── models.ts        # TypeScript interfaces
├── physics.ts       # Physics simulation
├── terrain.ts       # NEW: Procedural terrain generation
├── shaders.ts       # NEW: Custom shaders for atmospheres
├── planetData.ts    # NEW: Extended planet information
└── ui/
    └── InfoPanel.ts # NEW: Planet info panel component
```

### Texture Sources (Public Domain)
- NASA Solar System Exploration: https://solarsystem.nasa.gov/
- Solar System Scope: https://www.solarsystemscope.com/textures/
- NASA Visible Earth: https://visibleearth.nasa.gov/
