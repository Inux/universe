# Implementation Plan

* For all tasks keep the README.md, docs.md and PLAN.md updated accordingly

---

## Phase 7: First-Person Surface Experience (GTA5-style)
*Complexity: High | Impact: Very High*

### 7.3: Terrain Generation Overhaul ✅ COMPLETED
- [x] **Interesting terrain features**
  - ✅ Increased terrain amplitude for dramatic mountains/valleys
  - ✅ Height scale of 30 units variation
  - ✅ Larger terrain (500x500) with 256 resolution
- [x] **Biome system for Earth**
  - ✅ Multiple biomes: Plains, Forest, Desert, Tundra, Mountain, Beach, Ocean
  - ✅ Noise-based biome generation using temperature and moisture
  - ✅ Smooth biome transitions with gradient blending
  - ✅ Biome-specific colors and textures
  - ✅ Biome-specific terrain height modifiers
- [x] **Performance optimizations**
  - ✅ LOD system foundation (createTerrainLOD function)
  - ✅ Prop culling based on distance from player
  - ✅ Distance-based prop visibility (150 unit cull distance)

### 7.4: Visual Polish ✅ COMPLETED
- [x] **Atmospheric effects**
  - ✅ Fog based on atmosphere density
  - ✅ Dust particles on Mars
- [x] **Improved lighting**
  - ✅ Directional sun light with day/night cycle
  - ✅ Rim lighting on terrain edges
  - ✅ Shadow mapping enabled
  - ✅ Hemisphere lighting for sky/ground color
- [x] **Props and details**
  - ✅ Biome-specific props (200+ props on Earth)
  - ✅ Forest biome: Dense trees with varied sizes
  - ✅ Plains biome: Sparse bushes and grass
  - ✅ Desert biome: Cacti and desert rocks
  - ✅ Tundra biome: Ice formations and snow patches
  - ✅ Mountain biome: Rocky outcrops with snow peaks
  - ✅ Beach biome: Palm trees
  - ✅ Rocks on other planets
  - ✅ Ice formations on cold planets (Pluto, Eris, etc.)

### 7.5: UI/UX for Surface View ✅ COMPLETED
- [x] **HUD elements**
  - ✅ Compass/direction indicator (heading in degrees)
  - ✅ Coordinates display (X, Y, Z position)
  - ✅ Time of day indicator (24-hour clock)
  - ✅ Planet name display
  - ✅ Gravity information
  - ✅ Styled HUD with backdrop blur and modern design
- [x] **Controls hint overlay**
  - ✅ Show WASD, mouse, sprint, jump controls
  - ✅ Fade out after 5 seconds
- [x] **Minimap**
  - ✅ Top-down view of nearby terrain (50 unit radius)
  - ✅ Real-time terrain heightmap rendering
  - ✅ Player position indicator (red dot)
  - ✅ Player direction indicator (arrow)
  - ✅ Grid overlay for reference
  - ✅ Height-based terrain coloring

---

## Phase 7.6: Critical Surface View Fixes ✅ COMPLETED
*Complexity: Medium | Impact: Very High*

### 7.6.1: Camera System Overhaul ✅ COMPLETED
- [x] **Fix camera rotation issues**
  - ✅ Fixed Euler angle gimbal lock by setting rotation order to 'YXZ'
  - ✅ Yaw rotation now always rotates around world Y axis (no more weird tilting)
  - ✅ Proper pitch clamping to prevent camera flipping (±72 degrees)
  - ✅ Roll auto-correction with damping

- [x] **Enhanced camera controls**
  - ✅ Implemented proper mouse look with mousemove events
  - ✅ Pointer lock integration for FPS-style camera
  - ✅ Added camera smoothing for landing (smooth vertical interpolation)
  - ✅ Proper event cleanup on exit

### 7.6.2: Terrain Edge Visual Fixes ✅ COMPLETED
- [x] **Fix star density at terrain edges**
  - ✅ Increased sky dome radius from 800 to 3500 units
  - ✅ Fixed render order: sky dome (-2), starfield (-1), terrain (0)
  - ✅ Starfield now smaller than sky dome (0.7x instead of 1.1x)
  - ✅ Fog distance extended from 450 to 2000 units for horizon blending

- [x] **Horizon improvements**
  - ✅ Distance fog properly blends with sky at horizon
  - ✅ Fog near distance adjusted to 200 units (doesn't cover nearby terrain)
  - ✅ Proper depth sorting ensures correct rendering

### 7.6.3: Seamless Terrain Wrapping ⚠️ PARTIALLY REVERTED
- [x] **Terrain chunking implementation**
  - ✅ Implemented 3x3 chunk grid system (terrain.ts:600-685)
  - ✅ Tileable noise using torus mapping (terrain.ts:335-367)
  - ✅ Dynamic chunk repositioning
  - ⚠️ **PERFORMANCE ISSUE**: Tileable noise too slow (sin/cos per vertex × 9 chunks)
  - ⚠️ **TEMPORARILY DISABLED**: Reverted to single 1000×1000 terrain for Phase 7.6

- [ ] **Deferred to Phase 7.7**
  - Proper chunking requires pre-generated terrain (not runtime generation)
  - Will implement with advanced terrain generation tool
  - Tileable noise feasible offline, not in browser

---

## Phase 7.7: Advanced Terrain Generation System
*Complexity: Very High | Impact: Very High*

**Goal**: Create dramatically better terrain (1000x improvement) using pre-generation with complex algorithms

### 7.7.1: Terrain Generator Tool (Separate Project)
- [ ] **New standalone terrain generation tool**
  - Separate Node.js/TypeScript project for offline terrain generation (or any other language which is suitable)
  - Not browser-based (can use complex algorithms without performance concerns)
  - Export high-quality heightmaps and associated data

- [ ] **Advanced generation algorithms**
  - **Multi-octave noise**: Ridged multifractal, Billow noise, Voronoi cells
  - **Hydraulic erosion simulation**: Realistic water flow and sediment transport
  - **Thermal erosion**: Rock weathering and talus slopes
  - **Tectonic simulation**: Fault lines, mountain ranges, continental drift
  - **Sediment deposition**: River deltas, alluvial fans
  - **Glacial erosion**: U-shaped valleys, cirques, moraines

- [ ] **High-resolution output**
  - 2048x2048 or 4096x4096 heightmaps (vs current 256x256)
  - 16-bit or 32-bit depth for precise height data
  - Export formats: PNG heightmaps, JSON metadata, binary formats

- [ ] **Additional terrain data**
  - Normal maps for enhanced lighting
  - Texture splatmaps for biome blending
  - Moisture maps, temperature maps
  - Flow maps for water/wind direction
  - Prop placement data (trees, rocks, etc.)

### 7.7.2: Integration with Main Application
- [ ] **Terrain asset loading**
  - Load pre-generated heightmaps at runtime
  - Efficient texture streaming for large terrains
  - Progressive loading (LOD) for better performance

- [ ] **Planet-specific terrain sets**
  - Each planet has pre-generated terrain variants
  - Multiple terrain tiles per planet for variety
  - Seed-based selection for consistency

- [ ] **Terrain caching**
  - Cache loaded terrain data
  - Lazy loading for planets not yet visited
  - Memory management for multiple planet terrains

### 7.7.3: Real-World Data Integration (Optional)
- [ ] **Earth terrain from real data**
  - SRTM elevation data
  - USGS/NASA heightmaps
  - Specific real-world locations (Grand Canyon, Himalayas, etc.)

- [ ] **Other planets/moons**
  - Mars: NASA HiRISE data
  - Moon: LRO elevation data
  - Procedural generation for planets without data

---

## Phase 8: Audio Experience (Deferred)
*Complexity: Low | Impact: Medium*

**Note**: Audio is lower priority than terrain quality and camera fixes

- [ ] **Sound effects**
  - UI feedback sounds (clicks, transitions)
  - Footstep sounds while walking
  - Jump/land sounds
- [ ] **Ambient sounds**
  - Wind on planets with atmosphere
  - Silence in space/airless worlds
  - Planet-specific ambient loops
- [ ] **Background music**
  - Ambient space soundtrack
  - Volume controls
  - Mute option

---

