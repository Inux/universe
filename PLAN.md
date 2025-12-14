# Implementation Plan

* For all tasks keep the README.md, docs.md, features.md and PLAN.md updated accordingly
* Application is running in the browser at http://localhost:5173 (use playwright MCP if needed)

---

## Phase 0: Engine Hardening (Highest Priority)
*Complexity: Medium | Impact: Critical*

- [ ] **Pre-generated terrain correctness**
  - [ ] Fix 16-bit heightmap loading (current canvas decode is effectively 8-bit)
  - [ ] Store heights as typed arrays (avoid `Array.from` on 1M+ samples)
  - [ ] Ensure `userData.heights` matches rendered displacement (collision/minimap correctness)
  - [ ] Use normalmap in terrain material (lighting realism) and add optional detail normal tiling

- [ ] **Surface performance**
  - [ ] Stop rendering the solar system while in surface view (currently `ThreeCanvas` is `v-show` hidden but still animates/renders)
  - [ ] Replace per-frame terrain raycasting with heightmap sampling (`getTerrainHeight`) for ground collision
  - [ ] Decouple heightmap resolution from mesh resolution
    - [ ] Pre-generated heightmaps may be 1024×1024+, but render mesh should be ~256–512 segments (or shader displacement)
    - [ ] Keep high-res heightmap only for collision/minimap sampling
  - [ ] Reduce terrain render geometry (shader displacement / LOD) to keep triangles < ~200k
  - [ ] Remove debug logs and expensive spread ops (e.g. `Math.min(...heights)`)
  - [ ] Minimap: throttle redraw (5-10Hz) and precompute low-res height tiles
  - [ ] Ensure all GPU resources are disposed on surface exit (starfield, dust, props geometries/materials)

 - [ ] **Acceptance criteria (Phase 0)**
   - [ ] Surface view enters in < 2s after assets cached (Earth on a typical laptop)
   - [ ] Average FPS ≥ 60 while walking (no hitches when turning)
   - [ ] Collision height, prop placement, and minimap all agree within ±0.25m of rendered terrain
   - [ ] Memory: no 1M-element JS arrays created on load (use typed arrays + avoid `Array.from`)

- [ ] **Rendering realism quick wins**
  - [ ] Enable ACES tonemapping + sRGB output + physically correct lights (both scenes)
  - [ ] Switch planet materials to PBR (`MeshStandardMaterial`) with roughness/normal maps where available
  - [ ] Re-enable star fading at night (remove forced `opacity = 1.0`)
  - [ ] Replace current fog approach with subtle atmospheric scattering / horizon haze (must not hide sun/sky/stars)

- [ ] **Data/architecture unification**
  - [ ] Single source of truth for planet constants (solar system, info panel, terrain configs, generator configs)
  - [ ] Add a small perf HUD (FPS, draw calls, triangles) for regression tracking

## Phase 7: First-Person Surface Experience (GTA5-style)
*Complexity: High | Impact: Very High*

### 7.3: Terrain Generation Overhaul
- [x] **Interesting terrain features**
  - Increased terrain amplitude for dramatic mountains/valleys
  - Height scale of 30 units variation
  - Larger terrain (500x500) with 256 resolution
- [x] **Biome system for Earth**
  - Multiple biomes: Plains, Forest, Desert, Tundra, Mountain, Beach, Ocean
  - Noise-based biome generation using temperature and moisture
  - Smooth biome transitions with gradient blending
  - Biome-specific colors and textures
  - Biome-specific terrain height modifiers
- [x] **Performance optimizations**
  - LOD system foundation (createTerrainLOD function)
  - Prop culling based on distance from player
  - Distance-based prop visibility (150 unit cull distance)

### 7.4: Visual Polish 🔄 IN PROGRESS
- [ ] **Atmospheric effects**
  - [ ] Fog based on atmosphere density (currently disabled; rework to avoid banding artifacts)
  - [x] Dust particles on Mars
- [x] **Improved lighting**
  - Directional sun light with day/night cycle
  - Rim lighting on terrain edges
  - Shadow mapping enabled
  - Hemisphere lighting for sky/ground color
- [x] **Props and details**
  - Biome-specific props (200+ props on Earth)
  - Forest biome: Dense trees with varied sizes
  - Plains biome: Sparse bushes and grass
  - Desert biome: Cacti and desert rocks
  - Tundra biome: Ice formations and snow patches
  - Mountain biome: Rocky outcrops with snow peaks
  - Beach biome: Palm trees
  - Rocks on other planets
  - Ice formations on cold planets (Pluto, Eris, etc.)

### 7.5: UI/UX for Surface View
- [x] **HUD elements**
  - Compass/direction indicator (heading in degrees)
  - Coordinates display (X, Y, Z position)
  - Time of day indicator (24-hour clock)
  - Planet name display
  - Gravity information
  - Styled HUD with backdrop blur and modern design
- [x] **Controls hint overlay**
  - Show WASD, mouse, sprint, jump controls
  - Fade out after 5 seconds
- [x] **Minimap**
  - Top-down view of nearby terrain (50 unit radius)
  - Real-time terrain heightmap rendering
  - Player position indicator (red dot)
  - Player direction indicator (arrow)
  - Grid overlay for reference
  - Height-based terrain coloring

---

## Phase 7.6: Critical Surface View Fixes
*Complexity: Medium | Impact: Very High*

### 7.6.1: Camera System Overhaul
- [x] **Fix camera rotation issues**
  - Fixed Euler angle gimbal lock by setting rotation order to 'YXZ'
  - Yaw rotation now always rotates around world Y axis (no more weird tilting)
  - Proper pitch clamping to prevent camera flipping (±72 degrees)
  - Roll auto-correction with damping

- [x] **Enhanced camera controls**
  - Implemented proper mouse look with mousemove events
  - Pointer lock integration for FPS-style camera
  - Added camera smoothing for landing (smooth vertical interpolation)
  - Proper event cleanup on exit

### 7.6.2: Terrain Edge Visual Fixes
- [x] **Fix star density at terrain edges**
  - Increased sky dome radius from 800 to 3500 units
  - Fixed render order: sky dome (-2), starfield (-1), terrain (0)
  - Starfield now smaller than sky dome (0.7x instead of 1.1x)
  - Fog was extended for horizon blending, but is currently disabled due to banding artifacts (see Phase 0)

- [x] **Horizon improvements**
  - Horizon blending relies on sky dome gradient (fog currently disabled)
  - Proper depth sorting ensures correct rendering

### 7.6.3: Seamless Terrain Wrapping
- [x] **Terrain chunking implementation**
  - Implemented 3x3 chunk grid system (terrain.ts:600-685)
  - Tileable noise using torus mapping (terrain.ts:335-367)
  - Dynamic chunk repositioning
  - PERFORMANCE ISSUE: Tileable noise too slow (sin/cos per vertex × 9 chunks)
  - TEMPORARILY DISABLED: Reverted to single 1000×1000 terrain for Phase 7.6

- [ ] **Deferred to Phase 7.7**
  - Proper chunking requires pre-generated terrain (not runtime generation)
  - Will implement with advanced terrain generation tool
  - Tileable noise feasible offline, not in browser

---

## Phase 7.7: Advanced Terrain Generation System
*Complexity: Very High | Impact: Very High*

**Goal**: Create dramatically better terrain (1000x improvement) using pre-generation with complex algorithms

### 7.7.1: Terrain Generator Tool (Separate Project)
- [x] **New standalone terrain generation tool**
  - Created `tools/terrain-generator/` - TypeScript/Node.js project
  - Completely separate from browser runtime (can use expensive algorithms)
  - Export high-quality heightmaps and metadata
  - Added npm scripts: `npm run generate:terrains` and `npm run generate:terrain`

- [x] **Advanced generation algorithms**
  - Multi-octave noise: FBM, Ridged multifractal, Billow noise, Cellular/Voronoi
  - Domain warping: Organic terrain distortion for natural patterns
  - Turbulence: Chaotic noise patterns for varied features
  - Hydraulic erosion simulation: 50k+ droplet iterations with sediment transport
  - Thermal erosion: Rock weathering and talus slope enforcement
  - Tectonic simulation: Deferred to future phase (not needed for current quality)
  - Sediment deposition: Deferred (covered by erosion systems)
  - Glacial erosion: Deferred to future phase

- [x] **High-resolution output**
  - 1024×1024 heightmaps by default (1.0M pixels; optional 2048×2048 = 4.2M pixels)
  - 16-bit PNG depth for precise height data (65,535 values vs 256)
  - Full normalization to 0-65535 range with original min/max stored in metadata
  - Export formats: 16-bit PNG heightmaps + RGB PNG normalmaps + JSON metadata

- [x] **Additional terrain data**
  - Normal maps for enhanced lighting (8-bit RGB PNG)
  - Planet-specific configurations (9 planets with unique parameters)
  - Generation metadata (resolution, scale, roughness, erosion intensity, timing)
  - Heightmap statistics (min, max, avg heights)
  - Planet config data (gravity, atmosphere, water, temperature, biomes)
  - ✅ Heightmap statistics (min, max, avg heights)
  - ✅ Planet config data (gravity, atmosphere, water, temperature, biomes)
  - 🔜 **Texture splatmaps**: Deferred to future phase
  - 🔜 **Moisture/temperature maps**: Deferred (handled by biome system)
  - 🔜 **Flow maps**: Deferred to future phase
  - 🔜 **Prop placement data**: Deferred (runtime generation still used)

**Generated Terrains**:
- ✅ Mercury: Heavily cratered (cellular noise)
- ✅ Venus: Moderate erosion (30k hydraulic iterations)
- ✅ Earth: Heavy erosion (80k hydraulic + 16 thermal iterations)
- ✅ Mars: Ancient erosion (20k hydraulic + 4 thermal iterations)
- ✅ Moon: Heavily cratered (cellular noise)
- ✅ Pluto: Light erosion (10k hydraulic + 2 thermal iterations)
- ✅ Eris: Icy dwarf planet (ridged multifractal)
- ✅ Makemake: Icy dwarf planet (ridged multifractal)
- ✅ Haumea: Icy dwarf planet (ridged multifractal)

**Performance**: All 9 planets generated in ~56 seconds (avg 5.96s per planet), total 103MB

### 7.7.2: Integration with Main Application ✅ COMPLETED
- [x] **Terrain asset loading**
  - ✅ Created `terrainLoader.ts` for loading pre-generated heightmaps
  - ✅ PNG decoding using Canvas ImageData API
  - ✅ Bilinear interpolation for smooth height lookup
  - ✅ Denormalization using metadata min/max values
  - ✅ Async loading with proper error handling
  - 🔜 **Progressive loading/LOD**: Deferred to future phase

- [x] **Planet-specific terrain sets**
  - ✅ Each planet has pre-generated terrain in `/public/terrains/{planet}/`
  - ✅ Fallback to runtime generation if pre-generated terrain fails to load
  - 🔜 **Multiple terrain variants**: Deferred (single high-quality terrain per planet for now)
  - 🔜 **Seed-based selection**: Deferred to future phase

- [x] **Terrain caching**
  - ✅ Browser caches loaded PNG assets automatically
  - ✅ Lazy loading (only load when visiting planet surface)
  - 🔜 **Advanced memory management**: Deferred to future phase

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

## Phase 7.8: Advanced Terrain Realism & Fun Factor
*Complexity: Very High | Impact: Very High | Priority: CRITICAL*

**Goal**: Transform terrain from "technically good" to "incredibly fun and realistic" - the kind of terrain players want to explore for hours

### 7.8.1: Geological Realism ⭐ HIGH PRIORITY
- [ ] **River systems**
  - Procedural river generation following terrain slopes
  - River valleys carved into terrain (extend hydraulic erosion)
  - River deltas, braided streams, meandering rivers
  - Water flow simulation and animation
  - River erosion patterns (V-shaped valleys)
  - Tributaries branching based on watershed analysis

- [ ] **Lake and ocean systems**
  - Water bodies filling terrain depressions
  - Coastlines with beaches, cliffs, fjords
  - Wave erosion patterns on coastlines
  - Tidal pools and sea stacks
  - Underwater terrain (continental shelf, trenches)

- [ ] **Mountain range realism**
  - Tectonic simulation for realistic mountain chains
  - Rain shadow effects (wet vs dry sides of mountains)
  - Glacial valleys (U-shaped from ice erosion)
  - Alpine lakes and tarns
  - Snowline elevation based on latitude/temperature
  - Avalanche chutes and debris fields

- [ ] **Volcanic features**
  - Shield volcanoes (like Olympus Mons on Mars)
  - Stratovolcanoes with calderas
  - Lava flows and lava tubes
  - Volcanic cones and cinder fields
  - Geysers and hot springs (for planets with water)
  - Volcanic rock textures (basalt, obsidian)

- [ ] **Desert geology**
  - Sand dunes (barchan, longitudinal, star dunes)
  - Rock formations (mesas, buttes, hoodoos)
  - Dry riverbeds (wadis)
  - Desert varnish and weathering patterns
  - Sandstone layers and erosion
  - Oasis around water sources

- [ ] **Cave systems**
  - Procedural cave generation
  - Cave entrances in cliffs and hillsides
  - Stalactites and stalagmites
  - Underground rivers and lakes
  - Crystal caves (for special planets)
  - Lava tubes

### 7.8.2: Enhanced Erosion & Weathering ⭐ HIGH PRIORITY
- [ ] **Advanced hydraulic erosion**
  - Multi-pass erosion with varying water amounts
  - Seasonal erosion simulation (wet/dry cycles)
  - Flash flood erosion in desert areas
  - Erosion strength based on slope and water accumulation
  - Sediment transport distance (longer for gentler slopes)
  - Erosion hardness variation (some rocks erode slower)

- [ ] **Wind erosion**
  - Aeolian erosion for airless/desert planets
  - Sand abrasion on rock formations
  - Yardang formation (wind-sculpted ridges)
  - Prevailing wind direction simulation

- [ ] **Freeze-thaw weathering**
  - Frost shattering on cold planets
  - Solifluction (soil creep from freeze-thaw)
  - Patterned ground (stone circles, polygons)

- [ ] **Chemical weathering**
  - Solution weathering (karst landscapes, sinkholes)
  - Oxidation effects (rust colors on iron-rich terrain)
  - Acid rain effects on planets with harsh atmospheres

### 7.8.3: Biome & Ecosystem Diversity ⭐ HIGH PRIORITY
- [ ] **Expanded Earth biomes**
  - **Tropical rainforest**: Dense vegetation, emergent trees, jungle floor
  - **Temperate forest**: Deciduous trees, forest floor vegetation
  - **Boreal forest/Taiga**: Coniferous trees, sparse undergrowth
  - **Grassland/Savanna**: Tall grasses, scattered trees
  - **Desert**: Cacti, succulents, sparse shrubs, rock formations
  - **Tundra**: Moss, lichen, dwarf shrubs, permafrost patterns
  - **Wetlands**: Marshes, swamps, mangroves, reeds
  - **Alpine**: Above tree-line, rocky with alpine flowers
  - **Coastal**: Beach vegetation, dunes, sea cliffs

- [ ] **Biome transitions**
  - Ecotones (gradual transitions between biomes)
  - Elevation-based biome layers (foothills → subalpine → alpine)
  - Moisture gradients (wet forests → dry grasslands)
  - Temperature gradients (tropical → temperate → arctic)

- [ ] **Vegetation distribution**
  - Realistic tree density (forests vs scattered)
  - Vegetation follows moisture patterns
  - Different species at different elevations
  - Vegetation avoids steep slopes
  - River/lake edge vegetation (riparian zones)
  - No vegetation on bare rock, ice, or water

- [ ] **Alien biomes for other planets**
  - Mars: Ancient riverbeds, ice caps, dust plains
  - Venus: Volcanic plains, highland plateaus
  - Moon: Craters, maria (dark plains), rays
  - Icy moons: Cryovolcanism, ice plains, subsurface ocean cracks

### 7.8.4: Visual & Texture Quality ⭐ HIGH PRIORITY
- [ ] **Advanced material system**
  - Rock textures (granite, basalt, sandstone, limestone)
  - Soil textures (clay, sand, silt, gravel)
  - Grass textures with color variation
  - Snow and ice with sparkle/shimmer
  - Wet surfaces (darker color near water)
  - Triplanar texture mapping for cliffs

- [ ] **Normal map improvements**
  - Detail normal maps for rock surface
  - Procedural micro-detail (bumps, cracks)
  - Blended normal maps per material
  - Higher resolution normal maps (2048×2048)

- [ ] **PBR material properties**
  - Realistic roughness values per terrain type
  - Metalness for certain rocks (mica, obsidian)
  - Ambient occlusion in crevices and valleys
  - Subsurface scattering for ice and snow

- [ ] **Color variation**
  - Color noise for terrain patches (avoid uniform colors)
  - Altitude-based color gradients (greens → browns → grays → white)
  - Moisture-based color (darker in wet areas)
  - Weathering colors (rust, lichen, moss on rocks)
  - Seasonal color variation (optional)

- [ ] **Atmospheric scattering**
  - Realistic horizon haze
  - Sun glow and god rays
  - Atmospheric color variation by time of day
  - Distance-based color shifting (atmospheric perspective)

### 7.8.5: Procedural Detail & Props ⭐ HIGH PRIORITY
- [ ] **Rock formations**
  - Boulder fields on mountain slopes
  - Rock outcrops on ridges
  - Talus slopes (broken rock at cliff bases)
  - Balanced rocks and hoodoos
  - Size variation (pebbles to massive boulders)
  - Weathering patterns (rounded in water, sharp in desert)

- [ ] **Vegetation variety**
  - Multiple tree species per biome (3-5 types)
  - Tree size variation (saplings to giants)
  - Dead/fallen trees for realism
  - Bushes, shrubs, and undergrowth
  - Flowers and ground cover
  - Grass blade instances (GPU instancing for millions)

- [ ] **Terrain details**
  - Pebbles and small rocks scattered naturally
  - Dirt patches and bare ground
  - Leaf litter in forests
  - Driftwood on beaches
  - Ice chunks in arctic areas
  - Volcanic bombs near volcanoes

- [ ] **Prop placement intelligence**
  - Slope-based placement (no trees on steep cliffs)
  - Moisture-based (lush areas have more vegetation)
  - Clustering (trees tend to group)
  - Exclusion zones (no props in water, on paths)
  - Rotation variation for natural look
  - Scale variation (avoid uniform sizes)

### 7.8.6: Dynamic & Interactive Elements
- [ ] **Weather effects**
  - Rain showers with puddle formation
  - Snow accumulation over time
  - Wind direction affecting vegetation
  - Cloud shadows moving across terrain
  - Fog in valleys and low areas

- [ ] **Water simulation**
  - Animated water surfaces (waves, ripples)
  - Foam at shorelines and rapids
  - Reflections and refractions
  - Transparency and depth
  - Waterfalls from cliff edges

- [ ] **Dynamic lighting**
  - Time-of-day sun position
  - Shadows from terrain and props
  - Moonlight and starlight at night
  - Bioluminescence (for alien planets)
  - Lava glow from volcanic features

- [ ] **Footprints and trails**
  - Player footprints in sand/snow/mud
  - Trails from repeated walking
  - Footprints fade over time
  - Different footprint patterns per surface

- [ ] **Destructible terrain (optional)**
  - Digging and mining
  - Terrain deformation from explosions
  - Building and construction

### 7.8.7: Performance Optimization for Rich Terrain
- [ ] **Level-of-detail (LOD) system**
  - Multiple terrain resolutions (1024 close, 256 mid, 64 far)
  - Seamless LOD transitions
  - LOD for props (detailed close, simple far)
  - Billboard sprites for distant vegetation
  - Terrain LOD based on distance to camera

- [ ] **Culling and streaming**
  - Frustum culling (only render visible terrain)
  - Occlusion culling (don't render behind hills)
  - Prop distance culling (hide distant props)
  - Terrain chunk streaming (load/unload as player moves)
  - Async loading for smooth experience

- [ ] **GPU optimization**
  - Instanced rendering for vegetation
  - Mesh merging for static props
  - Texture atlases to reduce draw calls
  - Compute shaders for terrain deformation
  - GPU-based LOD selection

- [ ] **Memory management**
  - Compressed textures
  - Terrain data pooling
  - Prop object pooling
  - Unload distant terrain chunks
  - Streaming texture system

### 7.8.8: Exploration & Gameplay Features
- [ ] **Points of interest**
  - Landmarks (unique formations, peaks, craters)
  - Discoverable locations (caves, ruins, crash sites)
  - Scenic viewpoints
  - Photo mode with filters
  - Achievement system for discoveries

- [ ] **Terrain challenges**
  - Climbing mechanics for steep terrain
  - Parkour elements (jumping gaps, scaling cliffs)
  - Hazardous terrain (lava, quicksand, thin ice)
  - Stamina system for climbing
  - Equipment (rope, climbing gear)

- [ ] **Navigation aids**
  - Waypoint system
  - Trail markers
  - Minimap improvements (3D height, biome colors)
  - Compass with landmark indicators
  - Distance indicators

- [ ] **Environmental storytelling**
  - Ancient ruins and structures
  - Evidence of past civilizations
  - Crash sites and debris
  - Geological history visible in layers
  - Environmental hazards (radiation, temperature)

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

