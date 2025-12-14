/**
 * Planet configuration for terrain generation
 */
export interface PlanetConfig {
    name: string;
    type: 'terrestrial' | 'gas-giant' | 'ice-giant' | 'dwarf';
    gravity: number;
    hasAtmosphere: boolean;
    hasWater: boolean;
    temperature: number; // Kelvin

    // Terrain generation parameters
    terrainScale: number; // Vertical scale multiplier
    roughness: number; // 0-1, how rough/smooth the terrain
    erosionIntensity: number; // 0-1, how much erosion to apply

    // Biome parameters (for Earth-like planets)
    hasBiomes: boolean;

    // Color scheme
    baseColor: [number, number, number]; // RGB 0-255
    secondaryColor?: [number, number, number];
}

export interface HeightmapData {
    width: number;
    height: number;
    data: Float32Array; // Height values 0-1
}

export interface GenerationResult {
    heightmap: HeightmapData;
    normalmap?: HeightmapData;
    metadata: {
        minHeight: number;
        maxHeight: number;
        avgHeight: number;
        generationTime: number;
    };
}
