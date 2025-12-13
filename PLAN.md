# Implementation Plan

* For all tasks keep the README.md, docs.md and PLAN.md updated accordingly

## Phase 1: ✅ COMPLETED

* Code cleanup
  * ✅ Removed dead code (`app.ts`, `lib/game/` folder)
  * ✅ Removed unused SCALE properties
  * ✅ Checked for obvious bugs - none found
  * ✅ Checked for code smells - minor duplication acceptable
  * ✅ Checked for code complexity - acceptable
* UI Cleanup
  * ✅ Fixed Explore button visibility (flexbox layout)

## Phase 2:

* UI Optimization
  * Make limit so the user cannot zoom out infinite
  * Make limit so the user cannot zoom in infinite
  * Initial view should be closer (sun is very tiny after reload)
* UX Optimization
  * Make it easier to click on planets (bigger hitbox)
  * Make enter key to enter last planet in information view (not surface)
    * Second enter will go to surface view
    * Add to Controls Hint
  * If in information view we can jump to other planets with arrow left, right
    * So we can navigate between planets in information view
    * Add to Controls Hint
  * Show names of planets and moons when pressing i (for info)
    * Add to Controls Hint

## Phase 3:
* Make plan for Future Ideas (see below)

### Future Ideas

- [ ] Asteroid belt between Mars and Jupiter
- [ ] Kuiper belt objects (Pluto, Eris)
- [ ] Comet trails
- [ ] Spacecraft/satellite models
- [ ] Day/night cycle on planet surfaces
- [ ] Multiplayer support (WebSocket reconnection)
- [ ] VR support with WebXR
- [ ] Sound effects and ambient music
