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

## Phase 8: Audio Experience
*Complexity: Low | Impact: Medium*

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

