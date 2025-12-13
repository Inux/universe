# Implementation Plan

* For all tasks keep the README.md, docs.md and PLAN.md updated accordingly

---

## Phase 7: First-Person Surface Experience (GTA5-style)
*Complexity: High | Impact: Very High*

### 7.1: Fix Critical Bugs
- [ ] **Sky dome visibility**
  - Fix sky dome not rendering (check camera far plane, render order)
  - Ensure starfield renders behind everything
  - Verify shader compilation
- [ ] **Day/night lighting**
  - Restore sun light animation in first-person mode
  - Fix hemisphere light updates
  - Ensure shadows follow sun position

### 7.2: Camera & Movement System
- [ ] **Auto-adjusting camera orientation**
  - Camera "up" always perpendicular to ground (gravity direction)
  - Smooth camera rotation when walking on curved surface
  - Prevent looking into sky when walking forward
- [ ] **Proper first-person controls**
  - Mouse look (pitch/yaw) with limits
  - Head bob while walking (subtle)
  - Sprint with Shift key (2x speed)
- [ ] **Ground following**
  - Raycast to terrain for accurate ground height
  - Smooth height transitions over hills
  - Slope detection (can't walk up steep slopes)

### 7.3: Terrain Generation Overhaul
- [ ] **Interesting terrain features**
  - Mountains and valleys with dramatic height variation
  - Cliffs and rock formations
  - Craters on rocky planets (Mercury, Moon, Mars)
  - Canyons and ridges
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

