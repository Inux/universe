# Universe Terrain Generator

Advanced procedural terrain generation tool for the Universe Browser Game.

## Features

- **Multi-octave noise generation**: FBM, ridged multifractal, billow, cellular, domain warping
- **Hydraulic erosion simulation**: Realistic water flow and sediment transport (50,000+ iterations)
- **Thermal erosion**: Rock weathering and talus slopes
- **Water systems**: Rivers, lakes, and oceans with watershed analysis
- **High-resolution output**: 2048x2048 16-bit heightmaps + RGB normal maps
- **Planet-specific generation**: Customized terrain for each celestial body

## Usage

### Generate all terrains

```bash
npm run generate:terrains
```

### Generate specific planet(s)

```bash
cd tools/terrain-generator
npm run dev earth mars
```

### Development mode

```bash
npm run generate:terrain -- earth
```

## Output

Terrain files are saved to `public/terrains/[planet-name]/`:

- `heightmap.png` - RG-encoded 16-bit PNG (65,536 height levels)
- `normalmap.png` - RGB normal map for lighting
- `metadata.json` - Generation parameters, statistics, and water system data

### Water Data in Metadata

For planets with water (Earth, Pluto, etc.), `metadata.json` includes:

```json
{
  "water": {
    "seaLevel": 0.25,
    "rivers": [
      {
        "id": 0,
        "sourceX": 512, "sourceY": 128,
        "mouthX": 1024, "mouthY": 1800,
        "totalLength": 1500,
        "maxFlow": 25000,
        "points": [{"x": 512, "y": 128, "width": 2.5}, ...]
      }
    ],
    "waterBodies": [
      {
        "id": 0,
        "type": "lake",
        "waterLevel": 0.25,
        "area": 50000,
        "bounds": {"minX": 100, "minY": 200, "maxX": 400, "maxY": 500},
        "coastlinePoints": [{"x": 100, "y": 200}, ...]
      }
    ]
  }
}
```

## Configuration

Planet configurations are in `src/planetConfigs.ts`. Each planet has:

- `terrainScale`: Vertical height multiplier (0.3 - 2.0)
- `roughness`: How rough/smooth the terrain is (0-1)
- `erosionIntensity`: Erosion strength (0-1)
- `hasBiomes`: Whether to generate multiple biomes
- Physical parameters: gravity, atmosphere, water, temperature

## Algorithms

### Noise Generation

- **FBM (Fractal Brownian Motion)**: Base terrain with multiple octaves
- **Ridged Multifractal**: Sharp mountain ridges
- **Billow**: Puffy cloud-like formations
- **Domain Warping**: Organic distortion for natural look
- **Cellular**: Voronoi-like patterns for craters

### Erosion

- **Hydraulic**: Simulates water droplets (50k iterations for Earth)
  - Sediment transport
  - Deposition in valleys
  - Erosion on slopes

- **Thermal**: Simulates rock weathering (10-20 iterations)
  - Talus slope angle enforcement
  - Material transfer to neighbors
  - Smoothing of steep cliffs

### Water Systems

- **Watershed analysis**: D8 flow direction algorithm
- **Flow accumulation**: Calculates water flow at each cell
- **River extraction**: Identifies river paths above flow threshold
- **Valley carving**: Carves V-shaped valleys along river paths
- **Depression filling**: Priority-flood algorithm for proper drainage
- **Lake detection**: Flood-fill for connected water bodies below sea level
- **Coastline detection**: Identifies land-water boundaries for beach placement

## Performance

- 2048x2048 terrain: ~30-60 seconds per planet
- 4096x4096 terrain: ~2-5 minutes per planet
- Memory usage: ~100MB per terrain

## Examples

### Earth
- High erosion intensity (0.8)
- Hydraulic + thermal erosion
- Biomes enabled
- Dramatic mountains and valleys

### Mars
- Medium erosion (0.2) - ancient water
- Massive terrain scale (2.0) for Olympus Mons
- Red coloration

### Mercury
- No erosion (0.0)
- Crater-like cellular noise
- Smooth base terrain

## Future Improvements

- Tectonic plate simulation
- Biome-specific erosion parameters
- Vegetation/prop placement data
- Real-world heightmap integration (SRTM, etc.)
- GPU acceleration for faster generation
- Runtime water rendering (animated shaders, reflections)
- Wind erosion for Mars/Venus
