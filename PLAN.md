# Implementation Plan

* For all tasks keep the README.md, docs.md, features.md and PLAN.md updated accordingly
* Application is running in the browser at http://localhost:5173 (use playwright MCP if needed)

---

## Phase 0: Engine Hardening (Highest Priority)
*Complexity: Medium | Impact: Critical*

### 0.1: Pre-generated Terrain Correctness
- [ ] **Fix 16-bit heightmap loading**
  - Current canvas decode is effectively 8-bit; need proper 16-bit PNG parsing
  - Location: `src/terrainLoader.ts` - Canvas ImageData API limitation
  - Solution: Use `pngjs` or manual PNG chunk parsing for 16-bit grayscale
- [ ] **Store heights as typed arrays**
  - Avoid `Array.from` on 1M+ samples
  - Use `Float32Array` for height data throughout
  - Locations to fix: `terrain.ts`, `terrainLoader.ts`
- [ ] **Ensure collision/minimap height accuracy**
  - `userData.heights` must match rendered displacement within ±0.25m
  - Test: Compare raycast hit Y vs `getTerrainHeight()` at same XZ
- [ ] **Use normalmap in terrain material**
  - Load pre-generated normalmap from `/public/terrains/{planet}/normalmap.png`
  - Apply to `MeshStandardMaterial` with optional detail normal tiling (4x-8x)

### 0.2: Surface Performance
- [ ] **Stop solar system rendering during surface view**
  - `ThreeCanvas` is `v-show` hidden but still animates/renders
  - Solution: Set `renderer.setAnimationLoop(null)` or pause scene when hidden
  - Location: `src/app.ts` or relevant Vue component
- [ ] **Replace per-frame terrain raycasting**
  - Use heightmap sampling via `getTerrainHeight(x, z)` for ground collision
  - Raycasting is O(triangles), heightmap lookup is O(1)
- [ ] **Decouple heightmap resolution from mesh resolution**
  - Heightmaps: 1024×1024 (for collision/minimap)
  - Render mesh: 256–512 segments max (or use shader displacement)
  - Keep high-res heightmap only for sampling, not geometry
- [ ] **Reduce terrain geometry**
  - Target: < 200k triangles
  - Options: shader displacement, LOD system, or lower segment count
- [ ] **Remove debug logs and expensive spread ops**
  - Find and remove: `Math.min(...heights)`, `Math.max(...heights)`
  - Use loop-based min/max for large arrays
- [ ] **Minimap optimization**
  - Throttle redraw to 5-10Hz (currently every frame)
  - Precompute low-res height tiles for faster rendering
- [ ] **GPU resource disposal on surface exit**
  - Dispose: starfield, dust particles, props geometries/materials
  - Location: surface view cleanup function

### 0.3: Acceptance Criteria (Phase 0)
- [ ] Surface view enters in < 2s after assets cached (Earth on typical laptop)
- [ ] Average FPS ≥ 60 while walking (no hitches when turning)
- [ ] Collision height, prop placement, and minimap agree within ±0.25m
- [ ] Memory: no 1M-element JS arrays created on load

### 0.4: Rendering Realism Quick Wins
- [ ] **Enable ACES tonemapping + sRGB output**
  - `renderer.toneMapping = THREE.ACESFilmicToneMapping`
  - `renderer.outputColorSpace = THREE.SRGBColorSpace`
  - Apply to both solar system and surface scenes
- [ ] **Switch planet materials to PBR**
  - Use `MeshStandardMaterial` with roughness/normal maps
  - Current: likely `MeshBasicMaterial` or `MeshLambertMaterial`
- [ ] **Re-enable star fading at night**
  - Remove forced `opacity = 1.0` in starfield shader/material
  - Stars should fade based on sun position
- [ ] **Replace fog with atmospheric scattering**
  - Current fog causes banding artifacts
  - Implement subtle horizon haze that doesn't hide sun/sky/stars
  - Consider shader-based atmospheric perspective

### 0.5: Data/Architecture Unification
- [ ] **Single source of truth for planet constants**
  - Consolidate: solar system data, info panel, terrain configs, generator configs
  - Create `src/planetData.ts` with all planet properties
- [ ] **Add performance HUD**
  - Display: FPS, draw calls, triangles
  - Toggle with keyboard shortcut (e.g., F3)
  - For regression tracking during development

---

## Phase 7.4: Visual Polish (Remaining)
*Complexity: Medium | Impact: High*

- [ ] **Atmospheric fog rework**
  - Current fog disabled due to banding artifacts
  - Implement density-based fog that varies with atmosphere
  - Must not cause color banding at distance
  - Consider exponential fog or shader-based solution

---

## Phase 7.7.3: Real-World Data Integration (Optional)
*Complexity: High | Impact: Medium*

- [ ] **Earth terrain from real data**
  - Data sources: SRTM elevation, USGS/NASA heightmaps
  - Target locations: Grand Canyon, Himalayas, Alps
  - Format: Convert to 16-bit PNG matching current pipeline
  - Tool: Extend `tools/terrain-generator/` with import capability

- [ ] **Mars/Moon real data**
  - Mars: NASA HiRISE DTM data
  - Moon: LRO LOLA elevation data
  - Fallback: Keep procedural generation for planets without data

---

## Phase 7.8: Advanced Terrain Realism & Fun Factor
*Complexity: Very High | Impact: Very High*

**Goal**: Transform terrain from "technically good" to "incredibly fun and realistic"

### 7.8.1: Water Systems
- [ ] **River generation**
  - Extend `tools/terrain-generator/` with watershed analysis
  - Carve river valleys using flow accumulation algorithm
  - Output: river path data in terrain metadata JSON
  - Runtime: render water plane along river paths
- [ ] **Lakes and oceans**
  - Fill terrain depressions below water level threshold
  - Coastline detection for beach biome placement
  - Water plane with animated shader (waves, reflections)

### 7.8.2: Geological Features
- [ ] **Volcanic terrain** (Mars, Venus, Moon)
  - Add volcanic noise profile to terrain generator
  - Caldera detection and lava texture placement
- [ ] **Desert features** (Mars, Venus)
  - Dune generation using wind simulation in generator
  - Rock formations: mesas, buttes via erosion masking
- [ ] **Cave entrances**
  - Mark cave locations in terrain metadata
  - Runtime: place cave entrance props at marked locations

### 7.8.3: Enhanced Erosion (Generator Tool)
- [ ] **Wind erosion pass**
  - Add to `tools/terrain-generator/src/erosion.ts`
  - Parameters: wind direction, strength, iterations
  - Apply to: Mars, Venus, airless bodies
- [ ] **Multi-pass hydraulic erosion**
  - Seasonal variation (wet/dry cycles)
  - Variable rock hardness map

### 7.8.4: Biome Expansion
- [ ] **New Earth biomes**
  - Tropical rainforest, Temperate forest, Boreal/Taiga
  - Wetlands, Alpine, Coastal
  - Add to biome system in `src/terrain.ts`
- [ ] **Biome transitions**
  - Elevation-based layers (foothills → alpine)
  - Moisture/temperature gradients
- [ ] **Alien planet biomes**
  - Mars: ancient riverbeds, polar ice
  - Venus: volcanic plains, highland plateaus
  - Icy bodies: cryovolcanism, ice cracks

### 7.8.5: Visual Quality
- [ ] **Terrain texturing**
  - Generate splatmaps in terrain generator (deferred item)
  - Runtime: multi-texture blending based on splatmap
  - Triplanar mapping for cliff faces
- [ ] **PBR materials per terrain type**
  - Rock, soil, grass, snow, ice materials
  - Roughness/metalness variation
- [ ] **Atmospheric scattering shader**
  - Replace fog with proper scattering
  - God rays, horizon haze, time-of-day color

### 7.8.6: Props & Vegetation
- [ ] **Vegetation variety**
  - 3-5 tree species per biome
  - Size variation, dead/fallen trees
  - GPU instancing for grass blades
- [ ] **Intelligent prop placement**
  - Slope-based (no trees on cliffs)
  - Moisture-based density
  - Clustering algorithm
  - Exclusion zones (water, paths)

### 7.8.7: Dynamic Elements
- [ ] **Weather system**
  - Rain particles, snow accumulation
  - Cloud shadows, valley fog
- [ ] **Water animation**
  - Wave shader, foam at shores
  - Reflections, transparency
- [ ] **Player interaction**
  - Footprints in sand/snow (decal system)
  - Footprint fade over time

### 7.8.8: Performance (for Rich Terrain)
- [ ] **LOD system**
  - Terrain: 1024/256/64 resolution tiers
  - Props: detailed → simple → billboard
  - Seamless transitions
- [ ] **Culling**
  - Frustum culling for terrain chunks
  - Occlusion culling behind hills
  - Distance-based prop culling (already 150 units)
- [ ] **GPU optimization**
  - Instanced vegetation rendering
  - Texture atlases for props
  - Mesh merging for static objects

### 7.8.9: Exploration Features
- [ ] **Points of interest**
  - Landmark generation in terrain tool
  - Runtime: discoverable locations, viewpoints
- [ ] **Navigation**
  - Waypoint system
  - Minimap: 3D height visualization, biome colors
  - Compass with landmark indicators

---

## Phase 8: Audio Experience (Deferred)
*Complexity: Low | Impact: Medium*

- [ ] **Sound effects**
  - UI: clicks, transitions (use Web Audio API or Howler.js)
  - Footsteps: surface-type detection (grass, rock, sand, metal)
  - Jump/land sounds with velocity-based volume
- [ ] **Ambient sounds**
  - Wind: volume based on `planet.atmosphere` value
  - Silence: fade to silence for airless worlds
  - Planet loops: unique ambient per planet type
- [ ] **Background music**
  - Ambient space soundtrack (royalty-free or generated)
  - Volume slider in settings UI
  - Mute toggle (persist in localStorage)

---

## Deferred Items (Future Phases)
*Collected from completed phases for future consideration*

- Texture splatmaps generation
- Moisture/temperature maps (currently handled by biome system)
- Flow maps for water direction
- Prop placement data in terrain generator
- Progressive terrain loading/LOD
- Multiple terrain variants per planet
- Seed-based terrain selection
- Advanced memory management
- Terrain chunking with tileable noise (requires pre-generation)
- Tectonic simulation
- Glacial erosion
- Destructible terrain

---
