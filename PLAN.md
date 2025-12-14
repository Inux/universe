# Implementation Plan

* For all tasks keep the README.md, docs.md and PLAN.md updated accordingly

---

## Phase 7: First-Person Surface Experience (GTA5-style)
*Complexity: High | Impact: Very High*

### 7.1: Fix Critical Bugs ✅ DONE
- [x] **Sky dome visibility**
  - ✅ Fixed camera far plane (increased to 5000)
  - ✅ Removed scene background to show sky dome
  - ✅ Starfield renders behind everything
- [x] **Day/night lighting**
  - ✅ Sun light animation working
  - ✅ Hemisphere light updates with time
  - ✅ Shadows follow sun position

### 7.2: Camera & Movement System ✅ MOSTLY DONE
- [x] **Auto-adjusting camera orientation**
  - ✅ Camera pitch limited (no looping) - 60° up, 45° down
  - ✅ Slope-based camera adjustment (look up on hills)
  - ✅ Smooth interpolation for natural feel
- [x] **Proper first-person controls**
  - ✅ Arrow keys for looking (pitch/yaw)
  - ✅ PointerLockControls for mouse look
  - ✅ Sprint with Shift key (2x speed)
- [x] **Ground following**
  - ✅ getTerrainHeight() function with comprehensive debugging
  - ✅ Camera follows terrain height + eye height
  - ✅ Infinite wrapping terrain (walk around planet)
  - ✅ Hardened collision detection (pre/post movement checks)
- [ ] **Pending - Debug terrain coordinate mapping**
  - Console logging added to understand height calculation issues

### 7.3: Terrain Generation Overhaul 🔄 IN PROGRESS
- [x] **Interesting terrain features**
  - ✅ Increased terrain amplitude for dramatic mountains/valleys
  - ✅ Height scale of 30 units variation
  - ✅ Larger terrain (500x500) with 256 resolution
- [ ] **Biome system for Earth**
  - Grass plains, forests (tree placement), deserts, snow
  - Smooth biome transitions
  - Biome-specific colors and textures
- [ ] **Higher resolution terrain**
  - LOD system (more detail near player)
  - Larger terrain chunks that load as you move
  - Seamless chunk boundaries

### 7.4: Visual Polish
- [ ] **Atmospheric effects**
  - Fog based on atmosphere density
  - Dust particles on Mars
  - Rain/weather on Earth (future)
- [ ] **Improved lighting**
  - Ambient occlusion in valleys
  - Rim lighting on terrain edges
  - Better shadow quality near player
- [ ] **Props and details**
  - Rocks scattered on terrain
  - Vegetation on Earth (grass, trees)
  - Ice formations on cold planets

### 7.5: UI/UX for Surface View
- [ ] **HUD elements**
  - Compass/direction indicator
  - Coordinates display
  - Time of day indicator
- [ ] **Controls hint overlay**
  - Show WASD, mouse, sprint, jump controls
  - Fade out after a few seconds
- [ ] **Minimap** (optional)
  - Top-down view of nearby terrain
  - Player position and direction

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

## Priority Order
1. **Phase 7.1** - Fix bugs (sky, lighting) - CRITICAL
2. **Phase 7.2** - Camera/movement - Makes it playable
3. **Phase 7.3** - Terrain - Makes it interesting
4. **Phase 7.4** - Visual polish - Makes it beautiful
5. **Phase 7.5** - UI/UX - Quality of life
6. **Phase 8** - Audio - Final polish

