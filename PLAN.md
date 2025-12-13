# Implementation Plan

## Overview

This document tracks the implementation progress of the Universe Browser Game enhancements.

## Phase 4 - Surface Exploration ✅ COMPLETED

**Goal**: Let users explore planet surfaces with procedural terrain after clicking on a planet when hud is open (so user has to click on a planet to open the hud, then again to open the surface).

- [x] Create terrain generator using Simplex noise
- [x] Implement planet surface view mode
- [x] Add planet-specific terrain parameters
- [x] Adjust physics for each planet's gravity
- [x] Add transition animation from orbit to surface

**Files created**:
- `src/lib/three/terrain.ts` - Procedural terrain generator with fBm noise
- `src/lib/composables/useSurfaceView.ts` - Surface exploration composable
- `src/lib/components/SurfaceView.vue` - Surface view UI component

**Dependencies added**: `simplex-noise ^4.0.0`

### Features Implemented
- Procedural terrain using fractal Brownian motion (fBm) with simplex noise
- Planet-specific terrain configs (frequency, amplitude, octaves, colors)
- Per-planet gravity affecting jump physics
- Water planes for Earth-like planets
- Dynamic sky domes with atmosphere colors
- Smooth transition animations between orbit and surface views
- Surface HUD showing planet name and gravity
- WASD movement + Space to jump + ESC to exit

### Terrain Parameters
| Planet | Noise Frequency | Amplitude | Color Palette |
|--------|----------------|-----------|---------------|
| Mercury | 2.0 (High) | 0.08 (Low) | Grey |
| Venus | 1.2 (Medium) | 0.06 (Medium) | Yellow, orange |
| Earth | 1.5 (Variable) | 0.1 (High) | Green, blue, brown |
| Mars | 1.3 (Medium) | 0.12 (High) | Red, orange |
| Moon | 2.5 (High) | 0.07 (Medium) | Grey |
| Jupiter | 0.8 (Low) | 0.02 (Low) | Tan, orange |
| Saturn | 0.7 (Low) | 0.02 (Low) | Cream, tan |
| Uranus | 0.6 (Low) | 0.015 (Low) | Cyan, blue |
| Neptune | 0.6 (Low) | 0.015 (Low) | Blue, indigo |

---

## Future Ideas

- [ ] Asteroid belt between Mars and Jupiter
- [ ] Kuiper belt objects (Pluto, Eris)
- [ ] Comet trails
- [ ] Spacecraft/satellite models
- [ ] Day/night cycle on planet surfaces
- [ ] Multiplayer support (WebSocket reconnection)
- [ ] VR support with WebXR
- [ ] Sound effects and ambient music
