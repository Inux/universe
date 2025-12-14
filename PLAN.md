# Implementation Plan

* For all tasks keep the README.md, docs.md, features.md and PLAN.md updated accordingly
* Application is running in the browser at http://localhost:5173 (use playwright MCP if needed)

---

## Phase 7.8: Advanced Terrain Realism & Fun Factor
*Complexity: Very High | Impact: Very High*

**Goal**: Transform terrain from "technically good" to "incredibly fun and realistic". Pack as much as possible into pre-generated terrains to keep performance high.

### 7.8.1: Water Systems
- [x] **River generation**
  - Extend `tools/terrain-generator/` with watershed analysis
  - Increase sizes of Terrains to 2048x2048
  - Carve river valleys using flow accumulation algorithm
  - Output: river path data in terrain metadata JSON
  - Runtime: render water plane along river paths (pending)
- [x] **Lakes and oceans**
  - Fill terrain depressions below water level threshold
  - Coastline detection for beach biome placement
  - Water plane with animated shader (waves, reflections) (pending runtime implementation)

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
