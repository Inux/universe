# Universe - Current Features

*User-facing features for QA test case development*

---

## 1. Solar System View

### 1.1 Planet Navigation
- **Orbital motion**: Planets (and some moons) move in orbits over time
- **Planet selection**: Click on a planet to select it and open its info panel
- **Camera controls**: Zoom, pan, and rotate around the solar system view
- **Planet info panel**: Displays physical/orbital facts. Solid worlds offer `Walk the surface` and `Fly over`. The Sun and the gas giants offer `Fly over` only.
- **Keyboard shortcuts**:
  - `Enter`: Open info panel (or enter the surface view if a body is already selected)
  - `ArrowLeft` / `ArrowRight`: Cycle planets while the info panel is open
  - `I`: Toggle planet name labels
  - `Space`: Pause or resume orbits and rotation. In the surface view, Space still jumps or rises.
  - `ESC`: Close info panel and reset view
- **Time slider**: Six steps, from real time (1 second = 1 second) to the tour clock (an Earth year in about 32 seconds). The tour step is the default.
- **Distance slider**: Six steps, from true orbital distances to the packed tour layout. The tour step is the default. Planet sizes stay logarithmic.

### 1.2 Supported Celestial Bodies
- **Star**: Sun
- **Planets**: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune
- **Dwarf planets**: Pluto, Eris, Makemake, Haumea
- **Moons**: Moon, Phobos, Deimos, Io, Europa, Ganymede, Callisto, Titan, Rhea, Iapetus, Dione, Titania, Oberon, Umbriel, Ariel, Triton, Nereid, Charon, Dysnomia, Hi'iaka, Namaka

---

## 2. Surface Exploration (First-Person View)

### 2.1 Landing on Planets
- **Surface entry**: `Walk the surface` or `Fly over` from the info panel. `Enter` while the panel is open uses the default: walk on solid worlds, fly on the Sun and the gas giants.
- **Return to orbit**: Press `ESC` or click `← Return to Orbit`
- **Supported surfaces**: Every body in the system, including the Sun
  - **Walk and fly**: Mercury, Venus, Earth, Mars, Pluto, Eris, Makemake, Haumea. `F` switches mode.
  - **Fly only**: Sun (photosphere), Jupiter, Saturn, Uranus, Neptune (cloud deck)
  - **Pre-generated terrain assets**: Mercury, Venus, Earth, Mars, Moon, Pluto, Eris, Makemake, Haumea
  - **Procedural heightfield**: Sun and the gas giants

### 2.2 Movement Controls
- **Walk — WASD**: Move forward, left, backward, right along the ground
- **Fly — WASD**: Fly along the view. `Space` rises, `Ctrl` descends, and the craft stays above the surface
- **Mouse**: Look around (first-person camera)
- **Shift**: Sprint, or fly faster
- **Space** (walk): Jump
- **F**: Switch between walk and fly on solid worlds
- **Arrow keys**: Look around (keyboard alternative)
- **Pointer lock**: Click in the 3D view to capture the mouse for FPS-style controls

### 2.3 Terrain
- **Planet**: A closed sphere of radius 480. Walk in one direction and you return by going around. There is no square edge and no teleport to the opposite side.
- **Height**: Mercury, Venus, Earth, Mars, and Pluto use measured elevation. The grid has no seam. Haumea, Makemake, and Eris stay procedural noise: there is no published global survey, and fictional maps are not used. The Sun and the gas giants stay noise as well.
- **Relief**: Vertical scale is exaggerated. A true Earth shrunk to this radius would hide Everest under the camera, so mountains are lifted until they read as terrain. Sea level is the reference sphere. A walk around the planet is still a few minutes. Above about 9 km the extra height is compressed, so Olympus Mons stays a mountain.
- **Mesh**: A coarse sphere draws the limb. Three clipmap rings follow the camera, so the triangles underfoot are a fraction of a unit. The collider uses the same height function as those vertices.
- **Planet-specific look**:
  - Mercury, Venus, Mars, Pluto: the measured mosaic, with rock or ice detail up close. Venus is Magellan radar, not a color photograph. Pluto's far side and much of the south were never measured, and those faces stay smooth and plain.
  - Earth: satellite color, real sea level, large lakes, sand and snow up close
  - Haumea, Makemake, Eris: height-colored procedural ice
  - Jupiter, Saturn, Uranus, Neptune: latitude cloud bands, fly only
  - Sun: glowing photosphere, fly only

### 2.3.1 Water (Earth)
- **Ocean**: A transparent shell at real sea level. The mesh under it is the measured seafloor, so coasts are the shoreline, not a fraction of the noise amplitude. Basins that do not connect to the ocean, such as Death Valley, stay dry.
- **Lakes**: Large lakes (the Great Lakes, Victoria, the Caspian, Baikal) come from a water mask. You can walk on them. Rivers are thinner than the global grid.
- **Waves**: A small shader displacement on the ocean shell, with foam in the shallows
- **Spawn**: A coast, so the camera does not start in the water

### 2.4 Surface color
- **Mapped worlds**: Published mosaics. Up close, Earth adds beach, rock, and a latitude snow line on top of the satellite color. Farther away you see the mosaic.
- **Unmapped worlds and gas giants**: Procedural color. Cloud bands follow latitude.
- The square biome map (forest, desert, plains) is not sampled on the sphere, because it would put a seam on the planet

### 2.5 Props and Vegetation
- Earth scatters a few trees and rocks near the camera, on land, at human scale. The other mapped worlds scatter rocks. They are rebuilt as you move. The planet is not filled with a forest.
- The old square-patch props and the Mars dust disk are not used on the sphere, so nothing floats at the planet's center

### 2.6 Lighting and Atmosphere
- **Day/night cycle**: The sun is a fixed world direction. Walking around the planet changes the local time of day
- **Directional sunlight**: Offset from the player along that direction
- **Shadows**: The ground receives them. The planet mesh does not cast them
- **Photosphere**: The Sun's surface is emissive, so the night side does not go black

---

## 3. HUD (Heads-Up Display)

### 3.1 Information Display
- **Compass**: Heading in degrees (0° is north, clockwise)
- **Coordinates**: Latitude and longitude
- **Altitude**: Height above the local ground
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
- **Local ground**: Colors of the surface around you, north at the top, from a baked map of the planet
- **Player marker**: Red dot showing current position
- **Direction indicator**: Arrow showing facing direction
- **Grid overlay**: Reference grid for orientation

---

## 5. Camera System

### 5.1 First-Person Camera
- **Up**: Radial, away from the planet center, so the horizon stays level as you walk
- **Pitch limits**: ±72 degrees
- **Heading**: 0° is north and increases clockwise. The heading is carried along the ground, so a pole does not spin the view

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
- **Radius**: 2880 units on the planet (six times the surface radius), inside the camera far plane
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
- **Terrain following**: Walk snaps to the ground. Fly stays between 8 and 160 units above it
- **Height detection**: The same radial height function that builds the mesh. Gravity pulls toward the center

---

## 8. Performance Features

### 8.1 Performance HUD
- **Toggle**: Press `F3` to show/hide performance overlay
- **Metrics displayed**: FPS, draw calls, triangles, memory usage
- **Color coding**: FPS indicator changes color (green/yellow/red) based on performance

### 8.2 Terrain Optimization
- **Solar system pause**: Solar system rendering is paused while in surface view
- **Minimap throttling**: Minimap rendering is throttled for performance
- **Surface mesh**: Coarse sphere for the limb, plus a clipmap near the camera on mapped worlds. The ground does not cast shadows. Fly-only bodies and the unmapped dwarf planets stay a 256×128 noise sphere.

### 8.3 Asset Loading
- **Lazy loading**: The sphere is built when you enter a planet
- **Surface**: Mapped worlds load `public/maps/{planet}` (elevation, color, metadata) when you enter. The Sun, the gas giants, and the unmapped dwarf planets are built from noise in the browser. The offline square heightmaps are not the planet you walk on.

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
