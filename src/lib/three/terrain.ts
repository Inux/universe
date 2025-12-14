import * as THREE from 'three';
import { createNoise2D, createNoise3D } from 'simplex-noise';

/**
 * Biome types for Earth-like planets
 */
export enum BiomeType {
    OCEAN = 'ocean',
    BEACH = 'beach',
    PLAINS = 'plains',
    FOREST = 'forest',
    DESERT = 'desert',
    TUNDRA = 'tundra',
    MOUNTAIN = 'mountain',
}

/**
 * Biome configuration
 */
export interface BiomeConfig {
    name: BiomeType;
    color: THREE.Color;
    secondaryColor: THREE.Color;
    heightModifier: number;  // Multiplier for terrain height in this biome
    roughness: number;       // Material roughness
    metalness: number;       // Material metalness
}

/**
 * Terrain configuration for different planets
 */
export interface TerrainConfig {
    noiseFrequency: number;      // Base frequency for noise
    amplitude: number;           // Height multiplier
    octaves: number;             // Number of noise layers
    persistence: number;         // Amplitude reduction per octave
    lacunarity: number;          // Frequency increase per octave
    baseColor: THREE.Color;      // Primary terrain color
    secondaryColor: THREE.Color; // Secondary terrain color (valleys/peaks)
    waterLevel?: number;         // Optional water level (0-1)
    waterColor?: THREE.Color;    // Water color if applicable
    atmosphereColor?: THREE.Color;
    gravity: number;             // Surface gravity in m/s²
    hasBiomes?: boolean;         // Enable biome system (Earth only)
}

/**
 * Planet-specific terrain configurations
 */
export const TERRAIN_CONFIGS: { [key: string]: TerrainConfig } = {
    mercury: {
        noiseFrequency: 1.5,
        amplitude: 0.25,  // Dramatic craters and mountains
        octaves: 8,
        persistence: 0.5,
        lacunarity: 2.2,
        baseColor: new THREE.Color(0x8c8c8c),
        secondaryColor: new THREE.Color(0x5a5a5a),
        gravity: 3.7,
    },
    venus: {
        noiseFrequency: 0.8,
        amplitude: 0.2,  // Volcanic highlands
        octaves: 6,
        persistence: 0.55,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0xd4a574),
        secondaryColor: new THREE.Color(0xc98b4a),
        atmosphereColor: new THREE.Color(0xffcc66),
        gravity: 8.87,
    },
    earth: {
        noiseFrequency: 1.0,
        amplitude: 0.3,  // Mountains, valleys, varied terrain
        octaves: 8,
        persistence: 0.5,
        lacunarity: 2.2,
        baseColor: new THREE.Color(0x3d8c40),      // Green land
        secondaryColor: new THREE.Color(0x8b6914), // Brown mountains
        waterLevel: 0.35,
        waterColor: new THREE.Color(0x1a5f7a),
        atmosphereColor: new THREE.Color(0x87ceeb),
        gravity: 9.81,
        hasBiomes: true,
    },
    mars: {
        noiseFrequency: 0.9,
        amplitude: 0.35,  // Olympus Mons-style dramatic terrain
        octaves: 7,
        persistence: 0.55,
        lacunarity: 2.1,
        baseColor: new THREE.Color(0xc1440e),
        secondaryColor: new THREE.Color(0x8b4513),
        atmosphereColor: new THREE.Color(0xffaa88),
        gravity: 3.71,
    },
    moon: {
        noiseFrequency: 1.8,
        amplitude: 0.2,  // Craters and maria
        octaves: 6,
        persistence: 0.5,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0xa0a0a0),
        secondaryColor: new THREE.Color(0x707070),
        gravity: 1.62,
    },
    jupiter: {
        noiseFrequency: 0.8,
        amplitude: 0.02,
        octaves: 3,
        persistence: 0.7,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0xd4a574),
        secondaryColor: new THREE.Color(0xc98b4a),
        atmosphereColor: new THREE.Color(0xffddaa),
        gravity: 24.79,
    },
    saturn: {
        noiseFrequency: 0.7,
        amplitude: 0.02,
        octaves: 3,
        persistence: 0.7,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0xe8d5a3),
        secondaryColor: new THREE.Color(0xc9b896),
        atmosphereColor: new THREE.Color(0xffeebb),
        gravity: 10.44,
    },
    uranus: {
        noiseFrequency: 0.6,
        amplitude: 0.015,
        octaves: 3,
        persistence: 0.6,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0x88ddff),
        secondaryColor: new THREE.Color(0x66bbdd),
        atmosphereColor: new THREE.Color(0x88ddff),
        gravity: 8.69,
    },
    neptune: {
        noiseFrequency: 0.6,
        amplitude: 0.015,
        octaves: 3,
        persistence: 0.6,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0x4466ff),
        secondaryColor: new THREE.Color(0x3355dd),
        atmosphereColor: new THREE.Color(0x6688ff),
        gravity: 11.15,
    },
    // Dwarf planets
    pluto: {
        noiseFrequency: 1.8,
        amplitude: 0.09,
        octaves: 5,
        persistence: 0.5,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0xc9b896),
        secondaryColor: new THREE.Color(0xe8dcc8),
        gravity: 0.62,
    },
    eris: {
        noiseFrequency: 1.5,
        amplitude: 0.06,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0xe8e8e8),
        secondaryColor: new THREE.Color(0xffffff),
        gravity: 0.82,
    },
    makemake: {
        noiseFrequency: 1.6,
        amplitude: 0.07,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0xd4a574),
        secondaryColor: new THREE.Color(0xb8956a),
        gravity: 0.5,
    },
    haumea: {
        noiseFrequency: 2.0,
        amplitude: 0.05,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0xf5f5dc),
        secondaryColor: new THREE.Color(0xdcdcdc),
        gravity: 0.44,
    },
};

/**
 * Biome definitions for Earth
 */
export const BIOMES: { [key in BiomeType]: BiomeConfig } = {
    [BiomeType.OCEAN]: {
        name: BiomeType.OCEAN,
        color: new THREE.Color(0x1a5f7a),
        secondaryColor: new THREE.Color(0x144a5a),
        heightModifier: 0.0,
        roughness: 0.1,
        metalness: 0.3,
    },
    [BiomeType.BEACH]: {
        name: BiomeType.BEACH,
        color: new THREE.Color(0xe8d5a3),
        secondaryColor: new THREE.Color(0xc9b88a),
        heightModifier: 0.3,
        roughness: 0.95,
        metalness: 0.0,
    },
    [BiomeType.PLAINS]: {
        name: BiomeType.PLAINS,
        color: new THREE.Color(0x5a9c3d),
        secondaryColor: new THREE.Color(0x4a8c2d),
        heightModifier: 0.5,
        roughness: 0.9,
        metalness: 0.0,
    },
    [BiomeType.FOREST]: {
        name: BiomeType.FOREST,
        color: new THREE.Color(0x2d5c1e),
        secondaryColor: new THREE.Color(0x1d4c0e),
        heightModifier: 0.7,
        roughness: 0.95,
        metalness: 0.0,
    },
    [BiomeType.DESERT]: {
        name: BiomeType.DESERT,
        color: new THREE.Color(0xddb874),
        secondaryColor: new THREE.Color(0xc9a864),
        heightModifier: 0.4,
        roughness: 0.9,
        metalness: 0.05,
    },
    [BiomeType.TUNDRA]: {
        name: BiomeType.TUNDRA,
        color: new THREE.Color(0xd4e4e8),
        secondaryColor: new THREE.Color(0xf0f8ff),
        heightModifier: 0.6,
        roughness: 0.8,
        metalness: 0.1,
    },
    [BiomeType.MOUNTAIN]: {
        name: BiomeType.MOUNTAIN,
        color: new THREE.Color(0x7d6d5c),
        secondaryColor: new THREE.Color(0xe0e0e0),
        heightModifier: 1.5,
        roughness: 0.95,
        metalness: 0.05,
    },
};

/**
 * Procedural terrain generator using simplex noise
 */
export class TerrainGenerator {
    private noise2D: ReturnType<typeof createNoise2D>;
    private noise3D: ReturnType<typeof createNoise3D>;
    private biomeNoise: ReturnType<typeof createNoise2D>; // Separate noise for biomes
    private moistureNoise: ReturnType<typeof createNoise2D>; // For biome variation
    private config: TerrainConfig;

    constructor(config: TerrainConfig, seed?: number) {
        // Create seeded random function if seed provided
        const random = seed !== undefined ? this.seededRandom(seed) : Math.random;
        this.noise2D = createNoise2D(random);
        this.noise3D = createNoise3D(random);
        this.biomeNoise = createNoise2D(this.seededRandom((seed || 0) + 1000));
        this.moistureNoise = createNoise2D(this.seededRandom((seed || 0) + 2000));
        this.config = config;
    }

    private seededRandom(seed: number): () => number {
        return () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    /**
     * Determine biome type based on height and moisture
     */
    public getBiome(x: number, y: number, height: number): BiomeType {
        if (!this.config.hasBiomes) {
            return BiomeType.PLAINS; // Default biome for non-Earth planets
        }

        const waterLevel = this.config.waterLevel || 0.35;

        // Ocean
        if (height < waterLevel * 0.9) {
            return BiomeType.OCEAN;
        }

        // Beach (near water)
        if (height < waterLevel * 1.1) {
            return BiomeType.BEACH;
        }

        // Get temperature (latitude-like) and moisture values
        const temperature = (this.biomeNoise(x * 0.3, y * 0.3) + 1) / 2; // 0-1
        const moisture = (this.moistureNoise(x * 0.5, y * 0.5) + 1) / 2;  // 0-1

        // Mountain (high elevation)
        if (height > 0.75) {
            return BiomeType.MOUNTAIN;
        }

        // Tundra (cold, high latitude)
        if (temperature < 0.25) {
            return BiomeType.TUNDRA;
        }

        // Desert (hot and dry)
        if (temperature > 0.7 && moisture < 0.4) {
            return BiomeType.DESERT;
        }

        // Forest (moderate temp, high moisture)
        if (moisture > 0.5) {
            return BiomeType.FOREST;
        }

        // Plains (default)
        return BiomeType.PLAINS;
    }

    /**
     * Generate height value using fractal brownian motion (fBm)
     */
    public getHeight(x: number, y: number): number {
        let amplitude = 1;
        let frequency = this.config.noiseFrequency;
        let height = 0;
        let maxValue = 0;

        for (let i = 0; i < this.config.octaves; i++) {
            height += amplitude * this.noise2D(x * frequency, y * frequency);
            maxValue += amplitude;
            amplitude *= this.config.persistence;
            frequency *= this.config.lacunarity;
        }

        // Normalize to 0-1 range
        height = (height / maxValue + 1) / 2;

        return height * this.config.amplitude;
    }

    /**
     * Generate height for spherical coordinates (for planet surfaces)
     */
    public getSphericalHeight(theta: number, phi: number): number {
        // Convert spherical to 3D noise coordinates
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.sin(phi) * Math.sin(theta);
        const z = Math.cos(phi);

        let amplitude = 1;
        let frequency = this.config.noiseFrequency;
        let height = 0;
        let maxValue = 0;

        for (let i = 0; i < this.config.octaves; i++) {
            height += amplitude * this.noise3D(
                x * frequency,
                y * frequency,
                z * frequency
            );
            maxValue += amplitude;
            amplitude *= this.config.persistence;
            frequency *= this.config.lacunarity;
        }

        // Normalize to 0-1 range
        height = (height / maxValue + 1) / 2;

        return height * this.config.amplitude;
    }

    /**
     * Get terrain color based on height and biome with smooth transitions
     */
    public getColor(height: number, x?: number, y?: number): THREE.Color {
        const normalizedHeight = height / this.config.amplitude;

        // Check for water
        if (this.config.waterLevel && normalizedHeight < this.config.waterLevel) {
            return this.config.waterColor || new THREE.Color(0x1a5f7a);
        }

        // If biomes are enabled and coordinates provided, use biome-based coloring
        if (this.config.hasBiomes && x !== undefined && y !== undefined) {
            // Sample biomes in a small radius for smooth blending
            const blendRadius = 0.15; // Noise space radius for blending
            const samples = [
                { x: x, y: y, weight: 1.0 },
                { x: x + blendRadius, y: y, weight: 0.5 },
                { x: x - blendRadius, y: y, weight: 0.5 },
                { x: x, y: y + blendRadius, weight: 0.5 },
                { x: x, y: y - blendRadius, weight: 0.5 },
            ];

            const biomeWeights = new Map<BiomeType, number>();
            let totalWeight = 0;

            // Sample biomes at different points
            for (const sample of samples) {
                const sampleHeight = this.getHeight(sample.x, sample.y) / this.config.amplitude;
                const biome = this.getBiome(sample.x, sample.y, sampleHeight);

                const currentWeight = biomeWeights.get(biome) || 0;
                biomeWeights.set(biome, currentWeight + sample.weight);
                totalWeight += sample.weight;
            }

            // Blend colors based on biome weights
            const blendedColor = new THREE.Color(0, 0, 0);
            for (const [biome, weight] of biomeWeights) {
                const biomeConfig = BIOMES[biome];
                const biomeFactor = weight / totalWeight;

                // Mix between biome colors based on height
                const biomeColor = new THREE.Color();
                biomeColor.lerpColors(biomeConfig.color, biomeConfig.secondaryColor, normalizedHeight);

                // Add weighted contribution
                blendedColor.r += biomeColor.r * biomeFactor;
                blendedColor.g += biomeColor.g * biomeFactor;
                blendedColor.b += biomeColor.b * biomeFactor;
            }

            return blendedColor;
        }

        // Fallback: interpolate between base and secondary color based on height
        const color = new THREE.Color();
        color.lerpColors(
            this.config.baseColor,
            this.config.secondaryColor,
            normalizedHeight
        );

        return color;
    }

    /**
     * Get biome-modified height
     */
    public getBiomeHeight(x: number, y: number, baseHeight: number): number {
        if (!this.config.hasBiomes) {
            return baseHeight;
        }

        const normalizedHeight = baseHeight / this.config.amplitude;
        const biome = this.getBiome(x, y, normalizedHeight);
        const biomeConfig = BIOMES[biome];

        // Apply biome height modifier
        return baseHeight * biomeConfig.heightModifier;
    }
}

/**
 * Create multiple LOD levels for terrain
 */
export function createTerrainLOD(
    planetName: string,
    size: number = 100,
    baseResolution: number = 256
): THREE.LOD {
    const lod = new THREE.LOD();

    // High detail (near player)
    const highDetail = createTerrainMesh(planetName, size, baseResolution);
    lod.addLevel(highDetail, 0);

    // Medium detail
    const mediumDetail = createTerrainMesh(planetName, size, Math.floor(baseResolution / 2));
    lod.addLevel(mediumDetail, 100);

    // Low detail (far from player)
    const lowDetail = createTerrainMesh(planetName, size, Math.floor(baseResolution / 4));
    lod.addLevel(lowDetail, 200);

    lod.userData.terrainSize = size;
    lod.userData.baseResolution = baseResolution;

    return lod;
}

/**
 * Creates a terrain mesh for a planet surface
 */
export function createTerrainMesh(
    planetName: string,
    size: number = 100,
    resolution: number = 128
): THREE.Mesh {
    const config = TERRAIN_CONFIGS[planetName] || TERRAIN_CONFIGS.earth;
    const generator = new TerrainGenerator(config, planetName.length * 1000);

    const geometry = new THREE.PlaneGeometry(size, size, resolution - 1, resolution - 1);
    const positions = geometry.attributes.position;
    const colors: number[] = [];
    const heights: number[] = []; // Store heights for later use

    // Height scaling - make terrain more dramatic
    const heightScale = 30; // Max height variation in units

    // Generate terrain heights and colors
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getY(i);

        // Scale coordinates for noise - use tiling-friendly coordinates
        const nx = (x / size + 0.5) * 3;
        const nz = (z / size + 0.5) * 3;

        // Get base height
        let baseHeight = generator.getHeight(nx, nz);

        // Apply biome height modifier if biomes are enabled
        if (config.hasBiomes) {
            const normalizedHeight = baseHeight / config.amplitude;
            const biome = generator.getBiome(nx, nz, normalizedHeight);
            const biomeConfig = BIOMES[biome];
            baseHeight *= biomeConfig.heightModifier;
        }

        const height = (baseHeight / config.amplitude) * heightScale;

        positions.setZ(i, height);
        heights.push(height);

        // Get color for this height with biome support
        const color = generator.getColor(baseHeight, nx, nz);
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: false, // Smooth shading for better look
        roughness: 0.8,
        metalness: 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.PI; // Flip 180° to correct orientation
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    // Store terrain data for height queries
    mesh.userData.terrainSize = size;
    mesh.userData.terrainResolution = resolution;
    mesh.userData.heights = heights;
    mesh.userData.heightScale = heightScale;

    // Debug: log height range
    const minH = Math.min(...heights);
    const maxH = Math.max(...heights);
    console.log(`Terrain heights: min=${minH.toFixed(2)}, max=${maxH.toFixed(2)}`);

    return mesh;
}

/**
 * Get terrain height at a given world position
 * Uses direct geometry lookup for performance (no raycasting)
 * Terrain is rotated -90° X then 180° Z, centered at origin
 */
export function getTerrainHeight(terrain: THREE.Mesh, worldX: number, worldZ: number): number {
    const size = terrain.userData.terrainSize as number;
    const resolution = terrain.userData.terrainResolution as number;
    const heights = terrain.userData.heights as number[];

    if (!size || !resolution || !heights) {
        console.error('Terrain data missing');
        return 0;
    }

    const halfSize = size / 2;

    // Debug: log input
    if (Math.random() < 0.001) {
        console.log(`getTerrainHeight: world(${worldX.toFixed(1)}, ${worldZ.toFixed(1)}), size=${size}`);
    }

    // The terrain mesh is centered at origin, spanning from -halfSize to +halfSize
    // Account for 180° Z rotation which flips X axis
    // Wrap to terrain bounds for infinite terrain effect

    // First, wrap world coordinates to terrain range [-halfSize, halfSize]
    let localX = worldX;
    let localZ = worldZ;

    // Wrap X
    while (localX > halfSize) localX -= size;
    while (localX < -halfSize) localX += size;

    // Wrap Z
    while (localZ > halfSize) localZ -= size;
    while (localZ < -halfSize) localZ += size;

    // Debug: wrapped coords
    if (Math.random() < 0.001) {
        console.log(`Wrapped: local(${localX.toFixed(1)}, ${localZ.toFixed(1)})`);
    }

    // The terrain mesh is rotated:
    // 1. -90° on X axis: plane goes from XY to XZ plane
    // 2. 180° on Z axis: flips the orientation

    // To find which geometry vertex corresponds to world position (localX, localZ):
    // World X corresponds to geometry X (but flipped by 180° rotation)
    // World Z corresponds to geometry Y (after -90° X rotation)

    // Since the mesh is rotated 180° on Z, X is flipped
    const geoX = -localX; // Flip X due to 180° Z rotation
    const geoY = localZ;  // Z becomes Y after -90° X rotation

    // Debug: geometry coords
    if (Math.random() < 0.001) {
        console.log(`Geometry: geo(${geoX.toFixed(1)}, ${geoY.toFixed(1)})`);
    }

    // Convert from geometry coords [-halfSize, halfSize] to normalized [0, 1]
    const normX = (geoX + halfSize) / size;
    const normY = (geoY + halfSize) / size;

    // Debug: normalized coords
    if (Math.random() < 0.001) {
        console.log(`Normalized: norm(${normX.toFixed(3)}, ${normY.toFixed(3)})`);
    }

    // Clamp to valid range
    const clampedNormX = Math.max(0, Math.min(1, normX));
    const clampedNormY = Math.max(0, Math.min(1, normY));

    // Convert to grid indices
    const gridX = clampedNormX * (resolution - 1);
    const gridY = clampedNormY * (resolution - 1);

    // Debug: grid indices
    if (Math.random() < 0.001) {
        console.log(`Grid: grid(${gridX.toFixed(1)}, ${gridY.toFixed(1)}), res=${resolution}`);
    }

    // Get integer indices
    const x0 = Math.floor(gridX);
    const y0 = Math.floor(gridY);
    const x1 = Math.min(x0 + 1, resolution - 1);
    const y1 = Math.min(y0 + 1, resolution - 1);

    // Get fractional parts for interpolation
    const fx = gridX - x0;
    const fy = gridY - y0;

    // Get heights at four corners (row-major order: y * width + x)
    const h00 = heights[y0 * resolution + x0] ?? 0;
    const h10 = heights[y0 * resolution + x1] ?? 0;
    const h01 = heights[y1 * resolution + x0] ?? 0;
    const h11 = heights[y1 * resolution + x1] ?? 0;

    // Bilinear interpolation
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    const height = h0 * (1 - fy) + h1 * fy;

    // Debug: final height
    if (Math.random() < 0.001) {
        console.log(`Heights: h00=${h00.toFixed(2)}, h10=${h10.toFixed(2)}, h01=${h01.toFixed(2)}, h11=${h11.toFixed(2)}`);
        console.log(`Interpolated: ${height.toFixed(2)}`);
    }

    return height;
}

/**
 * Creates a spherical terrain mesh for walking around a planet
 * Uses higher resolution and proper height displacement
 */
export function createSphericalTerrain(
    planetName: string,
    radius: number = 100,
    resolution: number = 128
): THREE.Mesh {
    const config = TERRAIN_CONFIGS[planetName] || TERRAIN_CONFIGS.earth;
    const generator = new TerrainGenerator(config, planetName.length * 1000);

    const geometry = new THREE.SphereGeometry(radius, resolution, resolution);
    const positions = geometry.attributes.position;
    const colors: number[] = [];

    // Displace vertices based on noise
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);

        // Convert to spherical coordinates
        const r = Math.sqrt(x * x + y * y + z * z);
        const theta = Math.atan2(z, x);
        const phi = Math.acos(y / r);

        const height = generator.getSphericalHeight(theta, phi);
        const displacement = 1 + height * 0.5; // Scale down height for walkable terrain

        // Apply displacement along the normal (radial direction)
        const nx = x / r;
        const ny = y / r;
        const nz = z / r;

        positions.setX(i, nx * radius * displacement);
        positions.setY(i, ny * radius * displacement);
        positions.setZ(i, nz * radius * displacement);

        // Get color for this height
        const color = generator.getColor(height);
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: false,
        roughness: 0.9,
        metalness: 0.05,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.isSphericalTerrain = true;
    mesh.userData.radius = radius;

    return mesh;
}

/**
 * Creates a spherical water shell for planets with water
 */
export function createSphericalWater(
    radius: number,
    config: TerrainConfig
): THREE.Mesh | null {
    if (!config.waterLevel || !config.waterColor) return null;

    const waterRadius = radius * (1 + config.waterLevel * config.amplitude * 0.25);
    const geometry = new THREE.SphereGeometry(waterRadius, 64, 64);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            waterColor: { value: config.waterColor },
            time: { value: 0 },
            sunDirection: { value: new THREE.Vector3(0.5, 0.5, 0.3).normalize() },
        },
        vertexShader: `
            uniform float time;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;

            void main() {
                vNormal = normalize(normalMatrix * normal);

                // Subtle wave displacement
                vec3 pos = position;
                float wave = sin(pos.x * 0.05 + time) * sin(pos.z * 0.05 + time * 0.8) * 0.2;
                pos += normal * wave;

                vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
                vWorldPosition = worldPosition.xyz;

                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 waterColor;
            uniform vec3 sunDirection;
            uniform float time;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;

            void main() {
                vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

                // Fresnel effect
                float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);

                // Sun reflection
                vec3 reflectDir = reflect(-sunDirection, vNormal);
                float spec = pow(max(dot(viewDirection, reflectDir), 0.0), 64.0);

                vec3 skyColor = vec3(0.6, 0.8, 1.0);
                vec3 color = mix(waterColor, skyColor, fresnel * 0.4);
                color += vec3(1.0) * spec * 0.3;

                gl_FragColor = vec4(color, 0.8);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const water = new THREE.Mesh(geometry, material);
    water.userData.isSphericalWater = true;

    return water;
}

/**
 * Creates water plane for planets with water - with animated waves
 */
export function createWaterPlane(size: number, config: TerrainConfig): THREE.Mesh | null {
    if (!config.waterLevel || !config.waterColor) return null;

    const geometry = new THREE.PlaneGeometry(size * 1.2, size * 1.2, 64, 64);

    // Create shader material for animated water with reflections
    const material = new THREE.ShaderMaterial({
        uniforms: {
            waterColor: { value: config.waterColor },
            time: { value: 0 },
            sunDirection: { value: new THREE.Vector3(0.5, 0.5, 0.3).normalize() },
        },
        vertexShader: `
            uniform float time;
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;

            void main() {
                vUv = uv;

                // Animated wave displacement
                vec3 pos = position;
                float wave1 = sin(pos.x * 0.1 + time) * 0.3;
                float wave2 = sin(pos.y * 0.15 + time * 0.8) * 0.2;
                pos.z += wave1 + wave2;

                vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
                vWorldPosition = worldPosition.xyz;
                vNormal = normalize(normalMatrix * normal);

                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 waterColor;
            uniform vec3 sunDirection;
            uniform float time;
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vWorldPosition;

            void main() {
                // Fresnel effect for reflections
                vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
                float fresnel = pow(1.0 - max(dot(viewDirection, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);

                // Sun reflection (specular)
                vec3 reflectDir = reflect(-sunDirection, vec3(0.0, 1.0, 0.0));
                float spec = pow(max(dot(viewDirection, reflectDir), 0.0), 64.0);

                // Mix water color with sky reflection
                vec3 skyColor = vec3(0.6, 0.8, 1.0);
                vec3 color = mix(waterColor, skyColor, fresnel * 0.5);
                color += vec3(1.0) * spec * 0.5;

                // Add subtle wave pattern
                float pattern = sin(vUv.x * 50.0 + time) * sin(vUv.y * 50.0 + time * 0.7) * 0.02;
                color += vec3(pattern);

                gl_FragColor = vec4(color, 0.85);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide,
    });

    const water = new THREE.Mesh(geometry, material);
    water.rotation.x = -Math.PI / 2;
    water.position.y = config.waterLevel * config.amplitude * size * 0.5;
    water.userData.isWater = true;

    return water;
}

/**
 * Update water animation
 */
export function updateWater(water: THREE.Mesh, time: number, sunDirection?: THREE.Vector3): void {
    const material = water.material as THREE.ShaderMaterial;
    if (!material.uniforms) return;

    material.uniforms.time.value = time;
    if (sunDirection) {
        material.uniforms.sunDirection.value.copy(sunDirection);
    }
}

/**
 * Creates a sky dome for surface view with day/night cycle support
 */
export function createSkyDome(config: TerrainConfig, radius: number = 500): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(radius, 64, 64);

    const skyColor = config.atmosphereColor || new THREE.Color(0x000011);
    const horizonColor = skyColor.clone().multiplyScalar(0.5);
    const nightColor = new THREE.Color(0x000011);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: skyColor },
            bottomColor: { value: horizonColor },
            nightColor: { value: nightColor },
            sunDirection: { value: new THREE.Vector3(0.5, 0.3, 0.5).normalize() },
            dayNightMix: { value: 1.0 }, // 1 = day, 0 = night
            offset: { value: 20 },
            exponent: { value: 0.6 },
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            varying vec3 vNormal;
            varying vec2 vUv;
            void main() {
                vUv = uv;
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform vec3 nightColor;
            uniform vec3 sunDirection;
            uniform float dayNightMix;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            varying vec3 vNormal;
            varying vec2 vUv;

            // Simple star field
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
            }

            void main() {
                // Use normal direction (which is inverted for BackSide rendering)
                // For BackSide, positive normal Y means looking down toward ground
                float h = -vNormal.y;

                // Sky gradient based on inverted normal Y
                float skyFactor = max(h, 0.0);
                vec3 dayColor = mix(bottomColor, topColor, pow(skyFactor, exponent));

                // Add stars at night - only when looking up (inverted h > 0.1)
                vec3 nightSky = nightColor;
                if (h > 0.0) {
                    float starIntensity = random(vUv * 100.0);
                    if (starIntensity > 0.95) {
                        nightSky += vec3(1.0, 1.0, 1.0) * (starIntensity - 0.95) * 100.0;
                    }
                }

                // Mix day and night based on sun position
                vec3 finalColor = mix(nightSky, dayColor, 0.0); // 0.0 = full night

                // Below horizon (inverted h < 0) - dark ground color
                if (h < 0.0) {
                    vec3 groundColor = bottomColor * 0.2;
                    finalColor = mix(groundColor, finalColor, smoothstep(-0.2, 0.0, h));
                }

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `,
        side: THREE.BackSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.isSkyDome = true;
    // Re-enable sky dome rendering
    mesh.visible = true;
    return mesh;
}

/**
 * Creates a starfield background for night sky
 */
export function createStarfield(radius: number = 900): THREE.Points {
    const starCount = 1000; // Fewer stars for simplicity
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        // Create stars in a dome directly above the camera
        // Random angle around camera
        const angle = Math.random() * Math.PI * 2;
        // Distance from camera (always above)
        const distance = 50 + Math.random() * 100; // 50-150 units above
        // Height above camera
        const height = 10 + Math.random() * 50; // 10-60 units up

        // Position relative to camera (will be offset when starfield follows camera)
        positions[i * 3] = Math.cos(angle) * distance;     // X
        positions[i * 3 + 1] = height;                     // Y (always positive = above)
        positions[i * 3 + 2] = Math.sin(angle) * distance; // Z

        // Debug first few
        if (i < 3) {
            console.log(`Star ${i}: (${positions[i * 3].toFixed(1)}, ${positions[i * 3 + 1].toFixed(1)}, ${positions[i * 3 + 2].toFixed(1)})`);
        }

        // White stars
        colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1;
        sizes[i] = Math.random() * 2 + 1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
        size: 3,
        vertexColors: true,
        transparent: true,
        opacity: 1.0,
        sizeAttenuation: false,
        depthTest: true,   // allow mountains/terrain to occlude stars
        depthWrite: false, // but don't write depth so sky/atmosphere unaffected
    });

    const stars = new THREE.Points(geometry, material);
    stars.renderOrder = -1; // render behind sky/terrain
    stars.userData.isStarfield = true;
    return stars;
}

/**
 * Update sky dome for day/night cycle
 */
export function updateSkyDome(
    skyDome: THREE.Mesh,
    sunDirection: THREE.Vector3,
    hasAtmosphere: boolean = true
): void {
    const material = skyDome.material as THREE.ShaderMaterial;
    if (!material.uniforms) return;

    material.uniforms.sunDirection.value.copy(sunDirection);

    // Calculate day/night mix based on sun height
    const sunHeight = sunDirection.y;
    let dayNightMix = THREE.MathUtils.smoothstep(sunHeight, -0.2, 0.3);

    // Planets without atmosphere have no twilight
    if (!hasAtmosphere) {
        dayNightMix = sunHeight > 0 ? 1.0 : 0.0;
    }

    material.uniforms.dayNightMix.value = dayNightMix;

    // Also fade stars based on sun height (stars brighter at night)
    // Expect starfield material to be PointsMaterial
    if ((skyDome as any).parent) {
        const parent = (skyDome as any).parent as THREE.Scene;
        parent.traverse((obj) => {
            if ((obj as any).userData?.isStarfield) {
                const starMat = (obj as THREE.Points).material as THREE.PointsMaterial;
                // Stars fully visible at sunHeight <= -0.1, fade out by sunHeight 0.2
                const opacity = 1 - THREE.MathUtils.smoothstep(sunHeight, -0.1, 0.2);
                starMat.opacity = opacity;
                starMat.needsUpdate = true;
            }
        });
    }
}
