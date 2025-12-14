# Universe - Current Features

*User-facing features for QA test case development*

---

## 1. Solar System View

### 1.1 Planet Navigation
- **Orbital motion**: Planets (and some moons) move in orbits over time
- **Planet selection**: Click on a planet to select it and open its info panel
- **Camera controls**: Zoom, pan, and rotate around the solar system view
- **Planet info panel**: Displays physical/orbital facts and an `Explore Surface` action (not available for the Sun)
- **Keyboard shortcuts**:
  - `Enter`: Open info panel (or enter surface view if a non-Sun planet is already selected)
  - `ArrowLeft` / `ArrowRight`: Cycle planets while the info panel is open
  - `I`: Toggle planet name labels
  - `ESC`: Close info panel and reset view

### 1.2 Supported Celestial Bodies
- **Star**: Sun
- **Planets**: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune
- **Dwarf planets**: Pluto, Eris, Makemake, Haumea
- **Moons**: Moon, Phobos, Deimos, Io, Europa, Ganymede, Callisto, Titan, Rhea, Iapetus, Dione, Titania, Oberon, Umbriel, Ariel, Triton, Nereid, Charon, Dysnomia, Hi'iaka, Namaka

---

## 2. Surface Exploration (First-Person View)

### 2.1 Landing on Planets
- **Surface entry**: Use `Explore Surface` from a planet’s info panel (or press `Enter` when the info panel is open)
- **Return to orbit**: Press `ESC` or click `← Return to Orbit`
- **Supported surfaces**: All non-Sun bodies (planets + dwarf planets)
  - **Pre-generated terrain assets**: Mercury, Venus, Earth, Mars, Moon, Pluto, Eris, Makemake, Haumea
  - **Procedural fallback terrain**: Bodies without pre-generated assets (e.g., gas giants)

### 2.2 Movement Controls
- **WASD**: Move forward, left, backward, right
- **Mouse**: Look around (first-person camera)
- **Shift**: Sprint (faster movement)
- **Space**: Jump
- **Arrow keys**: Look around (keyboard alternative)
- **Pointer lock**: Click in the 3D view to capture the mouse for FPS-style controls

### 2.3 Terrain
- **Pre-generated terrains (where available)**: 1024×1024 heightmaps loaded from `/public/terrains/{planet}/`
- **Terrain size**: Large explorable area (1000×1000 units)
- **Height variation**: Mountains, valleys, and varied elevation
- **Planet-specific terrain**:
  - Mercury/Moon: Heavily cratered surfaces
  - Venus: Moderate erosion patterns
  - Earth: Heavy erosion with realistic features
  - Mars: Ancient erosion patterns
  - Dwarf planets: Icy terrain with ridged features

### 2.4 Biome System (Earth)
- **Biome types**: Plains, Forest, Desert, Tundra, Mountain, Beach, Ocean
- **Biome generation**: Based on temperature and moisture noise
- **Biome transitions**: Smooth gradient blending between biomes
- **Biome-specific colors**: Each biome has distinct terrain coloring

### 2.5 Props and Vegetation
- **Earth props**:
  - Forest: Dense trees with varied sizes
  - Plains: Sparse bushes and grass
  - Desert: Cacti and desert rocks
  - Tundra: Ice formations and snow patches
  - Mountain: Rocky outcrops with snow peaks
  - Beach: Palm trees
- **Other planets**: Rocks, ice formations appropriate to planet type
- **Prop count**: 200+ props on Earth
- **Distance culling**: Props hidden beyond 150 units for performance

### 2.6 Lighting and Atmosphere
- **Day/night cycle**: Sun position changes over time
- **Directional sunlight**: Realistic sun lighting with shadows
- **Shadow mapping**: Objects cast shadows on terrain
- **Hemisphere lighting**: Sky and ground ambient colors
- **Dust particles**: Visible on Mars surface

---

## 3. HUD (Heads-Up Display)

### 3.1 Information Display
- **Compass**: Heading in degrees (0-360°)
- **Coordinates**: Current X, Y, Z position
- **Time of day**: 24-hour clock display
- **Planet name**: Current planet displayed
- **Gravity info**: Planet's gravity value

### 3.2 Visual Style
- **Backdrop blur**: Modern translucent design
- **Positioned**: Non-intrusive screen placement

### 3.3 Controls Hint Overlay
- **Initial display**: Shows control instructions on surface entry
- **Auto-hide**: Fades out after 5 seconds
- **Controls shown**: WASD, mouse look, sprint, jump

---

## 4. Minimap

### 4.1 Display
- **Position**: Corner of screen
- **View radius**: 50 units around player
- **Refresh rate**: Updates ~10 times per second as the player moves

### 4.2 Features
- **Terrain heightmap**: Top-down height visualization
- **Height coloring**: Colors indicate terrain elevation
- **Player marker**: Red dot showing current position
- **Direction indicator**: Arrow showing facing direction
- **Grid overlay**: Reference grid for orientation

---

## 5. Camera System

### 5.1 First-Person Camera
- **Rotation order**: YXZ (prevents gimbal lock)
- **Pitch limits**: ±72 degrees (prevents flipping)
- **Yaw rotation**: Always around world Y axis
- **Roll correction**: Auto-corrects with damping

### 5.2 Mouse Look
- **Pointer lock**: Full mouse capture for smooth control
- **Sensitivity**: Responsive mouse movement
- **Event cleanup**: Proper cleanup when exiting surface view

### 5.3 Landing Transition
- **Smooth interpolation**: Camera smoothly descends to surface
- **Vertical smoothing**: Gradual height adjustment

---

## 6. Sky and Environment

### 6.1 Sky Dome
- **Radius**: 3500 units (large sky sphere)
- **Gradient**: Horizon to zenith color transition
- **Render order**: Renders behind all other objects

### 6.2 Starfield
- **Star rendering**: Background stars visible
- **Proper layering**: Stars render between sky dome and terrain
- **Scale**: 0.7x sky dome radius

---

## 7. Physics and Collision

### 7.1 Gravity
- **Planet-specific**: Each planet has unique gravity value
- **Jump height**: Affected by planet gravity
- **Fall speed**: Realistic gravity-based falling

### 7.2 Ground Collision
- **Terrain following**: Player stays on terrain surface
- **Height detection**: Collision with terrain heightmap

---

## 8. Performance Features

### 8.1 Terrain Optimization
- **Prop culling**: Distance-based prop visibility (150 units)
- **Solar system pause**: Solar system rendering is paused while in surface view
- **Minimap throttling**: Minimap rendering is throttled for performance
- **Pre-generated assets**: Terrain loaded from cached heightmaps

### 8.2 Asset Loading
- **Lazy loading**: Terrain only loads when visiting planet
- **Browser caching**: PNG assets cached automatically
- **Fallback**: Runtime generation if pre-generated terrain fails

---

## Test Environment

- **URL**: http://localhost:5173
- **Browser**: Modern browser with WebGL support required
- **Controls**: Keyboard + Mouse

---

## Known Limitations (for test awareness)

- Fog is currently disabled (banding artifacts)
- Stars do not fade at night (opacity currently forced)
- Performance HUD is present (F3) but may show 0 draw calls/triangles due to renderer wiring
- Single terrain variant per planet
- No audio currently implemented

---
