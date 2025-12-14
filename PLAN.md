# Implementation Plan

* For all tasks keep the README.md, docs.md, features.md and PLAN.md updated accordingly
* Application is running in the browser at http://localhost:5173 (use playwright MCP if needed)

---

## Phase 0: Engine Hardening (Highest Priority)
*Complexity: Medium | Impact: Critical*

### 0.1: Pre-generated Terrain Correctness
- [ ] **Fix 16-bit heightmap loading**
  - Current browser Canvas `ImageData` decode is effectively 8-bit; cannot recover true 16-bit from a 16-bit grayscale PNG via `drawImage()`
  - Touchpoints: `src/lib/three/terrainLoader.ts`, `tools/terrain-generator/src/exporter.ts`
  - Decide on an encoding/decoder approach:
    - Export RG-encoded 16-bit height (R=high byte, G=low byte) from the generator and reconstruct in the loader, or
    - Parse PNG bytes in the browser to read 16-bit grayscale without Canvas
- [ ] **Store heights as typed arrays**
  - Ensure `terrainMesh.userData.heights` is always a `Float32Array` (runtime + pre-generated)
  - Update consumers: `src/lib/three/terrain.ts` (`getTerrainHeight`), `src/lib/components/Minimap.vue`
- [ ] **Ensure collision/minimap height accuracy**
  - `userData.heights` must match rendered displacement within ±0.25m
  - Test: Compare raycast hit Y vs `getTerrainHeight()` at same XZ

### 0.2: Surface Performance
- [ ] **Replace per-frame terrain raycasting**
  - Current: per-frame `Raycaster.intersectObject()` in `src/lib/composables/useSurfaceView.ts`
  - Target: use `getTerrainHeight(terrainMesh, x, z)` for ground collision and landing height (O(1) lookup)
  - Acceptance: no raycasts in the main loop; no “fall through terrain” at high sprint speeds
- [ ] **Decouple heightmap resolution from mesh resolution**
  - Current: pre-generated path builds a 1024×1024-segment mesh (>2M triangles)
  - Target: render mesh 256–512 segments max (or shader displacement), but keep 1024×1024 heightmap for collision/minimap
  - Touchpoint: `src/lib/three/terrain.ts` (`createTerrainFromPreGenerated`)
- [ ] **Reduce terrain geometry**
  - Target: < 200k triangles
  - Options: shader displacement, LOD system, or lower segment count
- [ ] **Remove debug logs and expensive spread ops**
  - Remove remaining `console.log` hot-paths and large-array operations
  - Touchpoint: `src/lib/three/terrain.ts`

### 0.3: Acceptance Criteria (Phase 0)
- [ ] Surface view enters in < 2s after assets cached (Earth on typical laptop)
- [ ] Average FPS ≥ 60 while walking (no hitches when turning)
- [ ] Collision height, prop placement, and minimap agree within ±0.25m
- [ ] Memory: no 1M-element JS arrays created on load

### 0.4: Rendering Realism Quick Wins
- [ ] **Switch planet materials to PBR**
  - Use `MeshStandardMaterial` with roughness/normal maps
  - Current: `src/lib/three/solarSystem.ts` uses `MeshPhongMaterial` (planets) and `MeshBasicMaterial` (sun)
- [ ] **Re-enable star fading at night**
  - Use computed `starOpacity` in `src/lib/composables/useSurfaceView.ts` (`updateDayNightCycle`)
- [ ] **Replace fog with atmospheric scattering**
  - Current surface view disables fog (`scene.fog = null`) due to banding artifacts
  - Implement subtle horizon haze/atmospheric perspective without color banding

### 0.5: Data/Architecture Unification
- [ ] **Single source of truth for planet constants**
  - Consolidate: `src/lib/three/solarSystem.ts`, `src/lib/data/planetData.ts`, `src/lib/three/terrain.ts`, `tools/terrain-generator/src/planetConfigs.ts`
  - Goal: one shared planet config model for rendering + info panel + terrain generation
- [ ] **Performance HUD correctness**
  - Ensure draw calls / triangles / memory populate (not stuck at 0) in both solar system and surface view
  - Touchpoints: `src/lib/components/PerformanceHUD.vue`, `src/App.vue`, renderer selection via props or `window.__THREE_RENDERER__`

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
