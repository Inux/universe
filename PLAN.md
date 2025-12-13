# Implementation Plan

## Overview

This document tracks the implementation progress of the Universe Browser Game enhancements.

## Phase 4 - Surface Exploration 📋 PLANNED

**Goal**: Let users explore planet surfaces with procedural terrain after clicking on a planet when hud is open (so user has to click on a planet to open the hud, then again to open the surface).

- [ ] Create terrain generator using Simplex noise
- [ ] Implement planet surface view mode
- [ ] Add planet-specific terrain parameters
- [ ] Adjust physics for each planet's gravity
- [ ] Add transition animation from orbit to surface

**Files to create**: `src/lib/three/terrain.ts`

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
