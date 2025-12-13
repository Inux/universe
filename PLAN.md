# Implementation Plan

## Overview

This document tracks the implementation progress of the Universe Browser Game enhancements.

---

## Phase 1 - Visual Polish ✅ COMPLETED

**Goal**: Improve visual appeal with space background and planet effects.

- [x] Add space skybox background (procedural starfield with 15,000 stars)
- [x] Add distant galaxies and nebula effects
- [x] Improve planet textures and add atmosphere effects (Fresnel shaders)
- [x] Add Saturn's rings (with Cassini Division)
- [x] Add Uranus rings (tilted at 97°)
- [x] Add sun glow and corona effects
- [x] Add Titan atmosphere

**Files created**: `skybox.ts`, `shaders.ts`, `rings.ts`, `solarSystem.ts`

---

## Phase 2 - Scaling Fixes ✅ COMPLETED

**Goal**: Make all planets visible without manual adjustment.

- [x] Remove distance scaling slider
- [x] Implement logarithmic size scaling
- [x] Set optimal default camera position

**Algorithm**: `visualRadius = baseSize * log(1 + realRadius / referenceRadius)`

---

## Phase 3 - Planet Exploration 🔄 IN PROGRESS

**Goal**: Allow users to learn about planets through an info panel.

- [ ] Add planet info panel (first click)
- [ ] Add extended planet data to SOLAR_SYSTEM object
- [ ] Smooth camera transitions with GSAP or Tween.js
- [ ] Add "Explore Surface" button

**Files to create**: `src/ui/InfoPanel.ts`, `src/planetData.ts`

### Planet Data to Add
```typescript
interface ExtendedPlanetData {
    mass: number;           // kg
    gravity: number;        // m/s²
    temperature: number;    // K (average)
    atmosphere: string;     // composition
    description: string;    // interesting facts
    moons: number;          // count
}
```

---

## Phase 4 - Surface Exploration 📋 PLANNED

**Goal**: Let users explore planet surfaces with procedural terrain.

- [ ] Create terrain generator using Simplex noise
- [ ] Implement planet surface view mode
- [ ] Add planet-specific terrain parameters
- [ ] Adjust physics for each planet's gravity
- [ ] Add transition animation from orbit to surface

**Files to create**: `src/terrain.ts`

**Dependencies to add**: `simplex-noise ^4.0.0`

### Terrain Parameters
| Planet | Noise Frequency | Amplitude | Color Palette |
|--------|----------------|-----------|---------------|
| Mercury | High | Low | Grey, brown |
| Venus | Medium | Medium | Yellow, orange |
| Earth | Variable | High | Green, blue, brown |
| Mars | Medium | High | Red, orange |
| Moon | High | Medium | Grey |

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
