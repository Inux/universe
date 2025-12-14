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

/**
 * River path point with position and flow data
 */
export interface RiverPoint {
    x: number;
    y: number;
    flow: number;
    width: number;
}

/**
 * River path from source to mouth
 */
export interface RiverPath {
    id: number;
    points: RiverPoint[];
    sourceX: number;
    sourceY: number;
    mouthX: number;
    mouthY: number;
    totalLength: number;
    maxFlow: number;
}

/**
 * Lake/ocean body data
 */
export interface WaterBody {
    id: number;
    type: 'lake' | 'ocean';
    waterLevel: number;
    area: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    coastlinePoints: Array<{ x: number; y: number }>;
}

/**
 * Complete water system data for a terrain
 */
export interface WaterSystemData {
    rivers: RiverPath[];
    waterBodies: WaterBody[];
    seaLevel: number;
}

export interface GenerationResult {
    heightmap: HeightmapData;
    normalmap?: HeightmapData;
    waterData?: WaterSystemData;
    metadata: {
        minHeight: number;
        maxHeight: number;
        avgHeight: number;
        generationTime: number;
    };
}
