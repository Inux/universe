# Universe Browser Game

A browser-only version of the Universe game, ported from the original Go backend + frontend architecture.

## Features

- **Complete Solar System**: All 8 planets with accurate relative sizes and distances
- **Moons**: Major moons for each planet (Earth's Moon, Galilean moons, etc.)
- **Physics Simulation**: Local gravity, walking, jumping mechanics on Earth's surface
- **Distance Scaling**: Interactive slider to adjust orbital distances (0.1x to 10x)
- **Camera Controls**: Orbit controls and player-following camera modes
- **Real-time Updates**: Smooth 60fps rendering with physics updates

## Controls

- **WASD**: Move player (forward/backward/strafe)
- **Space**: Jump
- **Mouse**: Orbit camera around selected planet
- **Click**: Select planets or moons to focus on them
- **L**: Locate and follow player
- **ESC**: Return to solar system overview
- **Distance Slider**: Adjust orbital distances in real-time

## Solar System Data

### Planets
- **Sun**: 696,340 km radius
- **Mercury**: 2,439.7 km radius, 57.9M km from Sun
- **Venus**: 6,051.8 km radius, 108.2M km from Sun
- **Earth**: 6,371 km radius, 149.6M km from Sun
- **Mars**: 3,389.5 km radius, 227.9M km from Sun
- **Jupiter**: 69,911 km radius, 778.5M km from Sun
- **Saturn**: 58,232 km radius, 1,432M km from Sun
- **Uranus**: 25,362 km radius, 2,867M km from Sun
- **Neptune**: 24,622 km radius, 4,515M km from Sun

### Major Moons
- **Earth**: Moon
- **Mars**: Phobos, Deimos
- **Jupiter**: Io, Europa, Ganymede, Callisto
- **Saturn**: Titan, Rhea, Iapetus, Dione
- **Uranus**: Titania, Oberon, Umbriel, Ariel
- **Neptune**: Triton, Nereid

## Technical Details

- **Local Physics**: All calculations run client-side using TypeScript
- **Three.js Rendering**: WebGL-based 3D graphics
- **Orbital Mechanics**: Accurate relative positioning and orbital periods
- **Scalable Distances**: Dynamic distance scaling for better visualization
- **Reference Frame System**: Planets reposition relative to selected body

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run serve
```

## Architecture

```
src/
├── models.ts      # TypeScript interfaces and constants
├── physics.ts     # Physics simulation functions
└── app.ts         # Main game client with Three.js rendering
```

Key changes from multiplayer version:
- ✅ Removed WebSocket dependency
- ✅ Added complete solar system data
- ✅ Implemented moon rendering and physics
- ✅ Added distance scaling controls
- ✅ Maintained all visual features and controls
