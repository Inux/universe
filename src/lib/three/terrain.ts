import * as THREE from 'three';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import { loadPreGeneratedTerrain, type LoadedTerrain } from './terrainLoader.js';

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

    // Pre-allocated Color objects to avoid creating 130K+ during mesh generation
    private _blendedColor = new THREE.Color();
    private _biomeColor = new THREE.Color();
    private _snowColor = new THREE.Color(0.95, 0.97, 1.0);
    private _tempColor = new THREE.Color();

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
     * Supports tileable noise for seamless terrain wrapping
     */
    public getHeight(x: number, y: number, tileable = false, tileSize = 1.0): number {
        let amplitude = 1;
        let frequency = this.config.noiseFrequency;
        let height = 0;
        let maxValue = 0;

        for (let i = 0; i < this.config.octaves; i++) {
            let sampleX = x * frequency;
            let sampleY = y * frequency;

            // Make noise tileable by mapping to a torus
            if (tileable) {
                const nx = Math.cos(sampleX * 2 * Math.PI / tileSize) * tileSize / (2 * Math.PI);
                const ny = Math.sin(sampleX * 2 * Math.PI / tileSize) * tileSize / (2 * Math.PI);
                const nz = Math.cos(sampleY * 2 * Math.PI / tileSize) * tileSize / (2 * Math.PI);
                const nw = Math.sin(sampleY * 2 * Math.PI / tileSize) * tileSize / (2 * Math.PI);

                // Use 3D noise to sample the torus
                height += amplitude * (this.noise3D(nx, ny, nz) + this.noise3D(nz, nw, nx)) / 2;
            } else {
                height += amplitude * this.noise2D(sampleX, sampleY);
            }

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
     * Calculate terrain slope at a noise-space position using finite differences.
     * Returns gradient magnitude (0 = flat, higher = steeper).
     */
    private getSlopeAtNoise(x: number, y: number): number {
        const epsilon = 0.02;
        const hR = this.getHeight(x + epsilon, y);
        const hL = this.getHeight(x - epsilon, y);
        const hU = this.getHeight(x, y - epsilon);
        const hD = this.getHeight(x, y + epsilon);
        const dx = (hR - hL) / (2 * epsilon);
        const dy = (hD - hU) / (2 * epsilon);
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate snow coverage based on slope and altitude.
     * Snow accumulates on gentle slopes above the snow line,
     * slides off steep faces. Creates realistic snow patterns.
     */
    private getSnowCoverage(normalizedHeight: number, slope: number): number {
        const snowLine = 0.6; // Altitude above which snow starts accumulating

        if (normalizedHeight < snowLine) return 0;

        // More snow at higher altitude
        const altitudeFactor = (normalizedHeight - snowLine) / (1 - snowLine);

        // Less snow on steep slopes (slides off)
        const slopeFactor = Math.max(0, 1 - slope * 3.0);

        // Combine factors
        const coverage = altitudeFactor * slopeFactor;

        return Math.min(1, Math.max(0, coverage));
    }

    /**
     * Get terrain color based on height and biome with smooth transitions.
     * Includes slope-based snow accumulation for realistic mountain coloring.
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
            const blendRadius = 0.15;
            const samples = [
                { x: x, y: y, weight: 1.0 },
                { x: x + blendRadius, y: y, weight: 0.5 },
                { x: x - blendRadius, y: y, weight: 0.5 },
                { x: x, y: y + blendRadius, weight: 0.5 },
                { x: x, y: y - blendRadius, weight: 0.5 },
            ];

            const biomeWeights = new Map<BiomeType, number>();
            let totalWeight = 0;

            for (const sample of samples) {
                const sampleHeight = this.getHeight(sample.x, sample.y) / this.config.amplitude;
                const biome = this.getBiome(sample.x, sample.y, sampleHeight);

                const currentWeight = biomeWeights.get(biome) || 0;
                biomeWeights.set(biome, currentWeight + sample.weight);
                totalWeight += sample.weight;
            }

            // Blend colors based on biome weights
            this._blendedColor.setRGB(0, 0, 0);
            for (const [biome, weight] of biomeWeights) {
                const biomeConfig = BIOMES[biome];
                const biomeFactor = weight / totalWeight;

                this._biomeColor.lerpColors(biomeConfig.color, biomeConfig.secondaryColor, normalizedHeight);

                this._blendedColor.r += this._biomeColor.r * biomeFactor;
                this._blendedColor.g += this._biomeColor.g * biomeFactor;
                this._blendedColor.b += this._biomeColor.b * biomeFactor;
            }

            // Slope-based snow accumulation for mountain/tundra areas
            const slope = this.getSlopeAtNoise(x, y);
            const snowCoverage = this.getSnowCoverage(normalizedHeight, slope);

            if (snowCoverage > 0.05) {
                this._blendedColor.lerp(this._snowColor, snowCoverage);
            }

            return this._blendedColor;
        }

        // Non-biome planets: interpolate between base and secondary color
        this._tempColor.lerpColors(
            this.config.baseColor,
            this.config.secondaryColor,
            normalizedHeight
        );

        return this._tempColor;
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
    resolution: number = 128,
    tileable: boolean = true,
    offsetX: number = 0,
    offsetZ: number = 0
): THREE.Mesh {
    const config = TERRAIN_CONFIGS[planetName] || TERRAIN_CONFIGS.earth;
    const generator = new TerrainGenerator(config, planetName.length * 1000);

    const geometry = new THREE.PlaneGeometry(size, size, resolution - 1, resolution - 1);
    const positions = geometry.attributes.position;
    const colors: number[] = [];
    const heights = new Float32Array(positions.count); // Store heights as typed array

    // Height scaling - make terrain more dramatic
    const heightScale = 30; // Max height variation in units

    // Tile size for seamless wrapping (in noise coordinates)
    const tileSize = 3.0;

    // Generate terrain heights and colors
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getY(i);

        // Scale coordinates for noise with offset support for chunking
        const nx = ((x + offsetX) / size + 0.5) * tileSize;
        const nz = ((z + offsetZ) / size + 0.5) * tileSize;

        // Get base height with tileable option
        let baseHeight = generator.getHeight(nx, nz, tileable, tileSize);

        // Apply biome height modifier if biomes are enabled
        if (config.hasBiomes) {
            const normalizedHeight = baseHeight / config.amplitude;
            const biome = generator.getBiome(nx, nz, normalizedHeight);
            const biomeConfig = BIOMES[biome];
            baseHeight *= biomeConfig.heightModifier;
        }

        const height = (baseHeight / config.amplitude) * heightScale;

        positions.setZ(i, height);
        heights[i] = height;

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

    // Calculate height range for consistent API with pre-generated terrain
    let minH = Infinity;
    let maxH = -Infinity;
    for (let i = 0; i < heights.length; i++) {
        if (heights[i] < minH) minH = heights[i];
        if (heights[i] > maxH) maxH = heights[i];
    }

    // Store terrain data for height queries
    mesh.userData.terrainSize = size;
    mesh.userData.terrainResolution = resolution;
    mesh.userData.heights = heights;
    mesh.userData.heightScale = heightScale;
    mesh.userData.heightMin = minH;
    mesh.userData.heightMax = maxH;

    return mesh;
}

/**
 * Creates terrain mesh from pre-generated heightmap data
 */
export async function createTerrainFromPreGenerated(
    planetName: string,
    size: number = 1000,
    meshResolution: number = 256 // Mesh segments (256x256 = ~130k triangles)
): Promise<THREE.Mesh> {
    // Load terrain data
    const terrainData = await loadPreGeneratedTerrain(planetName);
    const { heightmap, width, height, metadata, normalmap } = terrainData;

    // Create geometry with lower resolution for rendering performance
    // Heightmap stays high-res for collision detection
    const geometry = new THREE.PlaneGeometry(size, size, meshResolution, meshResolution);
    const positions = geometry.attributes.position;
    const colors: number[] = [];

    // Get config for this planet
    const config = TERRAIN_CONFIGS[planetName] || TERRAIN_CONFIGS.earth;
    const generator = new TerrainGenerator(config, planetName.length * 1000);

    // Height scaling
    const heightScale = 30; // Match the generator scale

    // Apply heights from pre-generated heightmap
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getY(i);

        // Map position to heightmap coordinates
        const nx = ((x / size) + 0.5) * (width - 1);
        const nz = ((z / size) + 0.5) * (height - 1);

        // Bilinear interpolation for smooth height lookup
        const ix = Math.floor(nx);
        const iz = Math.floor(nz);
        const fx = nx - ix;
        const fz = nz - iz;

        const ix1 = Math.min(ix + 1, width - 1);
        const iz1 = Math.min(iz + 1, height - 1);

        const h00 = heightmap[iz * width + ix];
        const h10 = heightmap[iz * width + ix1];
        const h01 = heightmap[iz1 * width + ix];
        const h11 = heightmap[iz1 * width + ix1];

        const h0 = h00 * (1 - fx) + h10 * fx;
        const h1 = h01 * (1 - fx) + h11 * fx;
        const baseHeight = h0 * (1 - fz) + h1 * fz;

        // Normalize height to 0-1 range using metadata min/max
        const normalizedHeight = (baseHeight - metadata.heightmap.min) / (metadata.heightmap.max - metadata.heightmap.min);

        // Scale to match amplitude range for getColor compatibility
        const scaledHeight = normalizedHeight * config.amplitude;

        // Apply height scale for display
        const finalHeight = normalizedHeight * heightScale;

        positions.setZ(i, finalHeight);

        // Generate color based on height (reuse existing color logic)
        const noiseX = ((x / size) + 0.5) * 3;
        const noiseZ = ((z / size) + 0.5) * 3;
        const color = generator.getColor(scaledHeight, noiseX, noiseZ);

        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    // Triplanar texture splatting shader for realistic terrain rendering.
    // Uses procedural hash-based noise to generate grass, rock, sand, and snow
    // patterns. Blends based on world-space slope and altitude.
    // Falls back to vertex-colored MeshStandardMaterial for non-biome planets.
    let material: THREE.Material;

    if (config.hasBiomes) {
        // Build normalmap texture if available
        let normalmapTexture: THREE.Texture | null = null;
        if (normalmap) {
            normalmapTexture = new THREE.Texture(normalmap);
            normalmapTexture.needsUpdate = true;
            normalmapTexture.wrapS = THREE.RepeatWrapping;
            normalmapTexture.wrapT = THREE.RepeatWrapping;
            normalmapTexture.repeat.set(4, 4);
        }

        material = new THREE.ShaderMaterial({
            uniforms: {
                ...THREE.UniformsLib.lights,
                ...THREE.UniformsLib.fog,
                uNormalMap: { value: normalmapTexture },
                uHasNormalMap: { value: normalmap ? 1.0 : 0.0 },
                uHeightScale: { value: heightScale },
                uPomScale: { value: 0.15 },       // Parallax depth scale
                uPomSteps: { value: 4.0 },         // Ray march steps
                uTerrainSize: { value: size },      // Terrain world size for UV mapping
            },
            vertexShader: `
                #include <fog_pars_vertex>

                varying vec3 vWorldPos;
                varying vec3 vWorldNormal;
                varying vec3 vColor;
                varying float vHeight;
                varying vec3 vViewDir;

                void main() {
                    vColor = color;
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldPos = worldPos.xyz;
                    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                    vHeight = position.z; // Z is height before rotation
                    vViewDir = cameraPosition - worldPos.xyz;

                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;

                    #include <fog_vertex>
                }
            `,
            fragmentShader: `
                // Three.js lighting includes
                #include <common>
                #include <lights_pars_begin>
                #include <fog_pars_fragment>

                uniform float uHeightScale;
                uniform sampler2D uNormalMap;
                uniform float uHasNormalMap;
                uniform float uPomScale;
                uniform float uPomSteps;
                uniform float uTerrainSize;

                varying vec3 vWorldPos;
                varying vec3 vWorldNormal;
                varying vec3 vColor;
                varying float vHeight;
                varying vec3 vViewDir;

                // Procedural hash for texture patterns (avoids external textures)
                float hash(vec2 p) {
                    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
                    p3 += dot(p3, p3.yzx + 33.33);
                    return fract((p3.x + p3.y) * p3.z);
                }

                // Value noise for procedural textures
                float valueNoise(vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    f = f * f * (3.0 - 2.0 * f); // smoothstep

                    float a = hash(i);
                    float b = hash(i + vec2(1.0, 0.0));
                    float c = hash(i + vec2(0.0, 1.0));
                    float d = hash(i + vec2(1.0, 1.0));

                    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                }

                // Multi-octave noise
                float fbmNoise(vec2 p, int octaves) {
                    float val = 0.0;
                    float amp = 0.5;
                    float freq = 1.0;
                    for (int i = 0; i < 4; i++) {
                        if (i >= octaves) break;
                        val += amp * valueNoise(p * freq);
                        amp *= 0.5;
                        freq *= 2.0;
                    }
                    return val;
                }

                // Triplanar sample: project noise onto all 3 axes, blend by normal
                float triplanarNoise(vec3 worldPos, vec3 normal, float scale, int octaves) {
                    vec3 blend = abs(normal);
                    blend = pow(blend, vec3(4.0));
                    blend /= (blend.x + blend.y + blend.z);

                    float xProj = fbmNoise(worldPos.yz * scale, octaves);
                    float yProj = fbmNoise(worldPos.xz * scale, octaves);
                    float zProj = fbmNoise(worldPos.xy * scale, octaves);

                    return xProj * blend.x + yProj * blend.y + zProj * blend.z;
                }

                // Procedural height field for parallax (rocky detail)
                float pomHeightField(vec3 pos, vec3 normal) {
                    return triplanarNoise(pos, normal, 0.8, 2);
                }

                // Parallax Occlusion Mapping: ray march through procedural height field.
                // Offsets the world-space sample position to create apparent surface depth.
                // Uses linear search followed by one secant refinement step.
                vec3 parallaxOcclusionMap(vec3 worldPos, vec3 normal, vec3 viewDir, float scale, float numSteps) {
                    // Project view direction onto surface plane for offset direction.
                    // Remove the component along the surface normal.
                    float NdotV = dot(normal, viewDir);

                    // Skip POM for near-perpendicular views or back faces
                    if (NdotV < 0.15) return worldPos;

                    // Tangent-plane component of the view direction
                    vec3 viewTangent = viewDir - normal * NdotV;
                    // Scale offset: deeper at grazing angles
                    float depthScale = scale / NdotV;

                    // Step through the height field along the view tangent direction
                    vec3 stepOffset = -viewTangent * depthScale / numSteps;
                    vec3 currentPos = worldPos;
                    float currentDepth = 0.0;
                    float stepSize = 1.0 / numSteps;

                    float prevHeight = 0.0;
                    float prevDepth = 0.0;
                    vec3 prevPos = currentPos;

                    for (float i = 0.0; i < 12.0; i++) {
                        if (i >= numSteps) break;
                        currentDepth += stepSize;
                        currentPos += stepOffset;
                        float sampleHeight = pomHeightField(currentPos, normal);

                        // Ray has gone below the surface
                        if (currentDepth > sampleHeight) {
                            // Secant interpolation for sub-step accuracy
                            float d1 = prevHeight - prevDepth;
                            float d2 = sampleHeight - currentDepth;
                            float t = d1 / (d1 - d2);
                            return mix(prevPos, currentPos, t);
                        }

                        prevHeight = sampleHeight;
                        prevDepth = currentDepth;
                        prevPos = currentPos;
                    }
                    return currentPos;
                }

                void main() {
                    vec3 normal = normalize(vWorldNormal);
                    float normalizedHeight = vHeight / uHeightScale;
                    vec3 viewDir = normalize(vViewDir);

                    // Distance-based POM fade: full effect close, fades at distance
                    float viewDist = length(vViewDir);
                    float pomFade = 1.0 - smoothstep(20.0, 50.0, viewDist);

                    // Apply parallax occlusion mapping for close-up depth detail
                    vec3 samplePos = vWorldPos;
                    if (pomFade > 0.01) {
                        float effectiveScale = uPomScale * pomFade;
                        vec3 pomPos = parallaxOcclusionMap(vWorldPos, normal, viewDir, effectiveScale, uPomSteps);
                        samplePos = pomPos;
                    }

                    // --- Normal perturbation from normalmap and POM micro-normals ---

                    // 1) Sample the pre-generated normalmap if available.
                    //    UV is derived from world XZ mapped to [0,1] over the terrain,
                    //    multiplied by 4 for tiling (repeat 4,4 is set on the CPU side).
                    if (uHasNormalMap > 0.5) {
                        vec2 nmUV = (vWorldPos.xz / uTerrainSize + 0.5) * 4.0;
                        vec3 mapNormal = texture2D(uNormalMap, nmUV).xyz * 2.0 - 1.0;

                        // Blend using Reoriented Normal Mapping (RNM) technique:
                        // Treats geometry normal as the base and adds detail from the map.
                        // This works without an explicit TBN matrix by assuming the
                        // normalmap is authored in tangent space with Y-up.
                        vec3 t = normal * vec3( 1.0,  1.0,  1.0) + vec3(0.0, 0.0, 1.0);
                        vec3 u = mapNormal * vec3(-1.0, -1.0, 1.0);
                        normal = normalize(t * dot(t, u) - u * t.z);
                    }

                    // 2) Compute POM micro-normals from the procedural height field
                    //    using central finite differences on pomHeightField().
                    //    Only computed when POM is active (close enough to camera).
                    if (pomFade > 0.01) {
                        float eps = 0.1;

                        // Sample height field at offset positions along world X and Z
                        float hC  = pomHeightField(samplePos, normal);
                        float hPx = pomHeightField(samplePos + vec3(eps, 0.0, 0.0), normal);
                        float hNx = pomHeightField(samplePos - vec3(eps, 0.0, 0.0), normal);
                        float hPz = pomHeightField(samplePos + vec3(0.0, 0.0, eps), normal);
                        float hNz = pomHeightField(samplePos - vec3(0.0, 0.0, eps), normal);

                        // Central differences give the surface gradient
                        float dhdx = (hPx - hNx) / (2.0 * eps);
                        float dhdz = (hPz - hNz) / (2.0 * eps);

                        // Construct the perturbed normal from the gradient.
                        // The height field is "on top of" the geometry surface,
                        // so the micro-normal tilts away from the gradient direction.
                        vec3 pomMicroNormal = normalize(vec3(-dhdx, 1.0, -dhdz));

                        // Blend the POM micro-normal into the current normal,
                        // weighted by pomFade so it fades out with distance.
                        // Use a strength factor to keep the effect subtle.
                        float pomNormalStrength = 0.6 * pomFade;
                        normal = normalize(mix(normal, pomMicroNormal, pomNormalStrength));
                    }

                    // Slope: 0 = flat (pointing up), 1 = vertical cliff
                    float slope = 1.0 - abs(normal.y);

                    // --- Procedural texture patterns (sampled at POM-offset position) ---
                    // Distance-based texture LOD: skip all texture noise for distant fragments
                    float grassPattern = 1.0;
                    float rockPattern = 1.0;
                    float sandPattern = 1.0;
                    float snowPattern = 1.0;

                    if (viewDist < 100.0) {
                        float texBlend = 1.0 - smoothstep(60.0, 100.0, viewDist);
                        grassPattern = mix(1.0, triplanarNoise(samplePos, normal, 0.3, 3), texBlend);
                        grassPattern = mix(1.0, mix(0.85, 1.15, grassPattern), texBlend);

                        rockPattern = mix(1.0, triplanarNoise(samplePos, normal, 0.15, 3), texBlend);
                        rockPattern = mix(1.0, mix(0.7, 1.3, rockPattern), texBlend);

                        sandPattern = mix(1.0, triplanarNoise(samplePos, normal, 0.5, 2), texBlend);
                        sandPattern = mix(1.0, mix(0.9, 1.1, sandPattern), texBlend);

                        snowPattern = mix(1.0, triplanarNoise(samplePos, normal, 0.4, 2), texBlend);
                        snowPattern = mix(1.0, mix(0.95, 1.05, snowPattern), texBlend);
                    }

                    // --- Splatting weights based on slope and altitude ---
                    float rockWeight = smoothstep(0.25, 0.5, slope); // More rock on steep
                    float snowWeight = smoothstep(0.6, 0.8, normalizedHeight) *
                                       (1.0 - smoothstep(0.3, 0.6, slope)); // Snow on high gentle slopes
                    float sandWeight = step(normalizedHeight, 0.15) * (1.0 - slope);
                    float grassWeight = max(0.0, 1.0 - rockWeight - snowWeight - sandWeight);

                    // Apply patterns to vertex colors
                    vec3 grassColor = vColor * grassPattern;
                    vec3 rockColor = vColor * rockPattern * vec3(0.85, 0.82, 0.8); // Desaturate rock
                    vec3 sandColor = vColor * sandPattern;
                    vec3 snowColor = mix(vColor, vec3(0.95, 0.97, 1.0), 0.7) * snowPattern;

                    vec3 texturedColor = grassColor * grassWeight +
                                         rockColor * rockWeight +
                                         snowColor * snowWeight +
                                         sandColor * sandWeight;

                    // --- Lighting (simplified PBR-like) ---
                    vec3 lightDir = vec3(0.0);
                    vec3 lightColor = vec3(0.0);

                    // Use first directional light
                    #if NUM_DIR_LIGHTS > 0
                        lightDir = normalize(directionalLights[0].direction);
                        lightColor = directionalLights[0].color;
                    #endif

                    // Diffuse (Lambertian)
                    float NdotL = max(dot(normal, lightDir), 0.0);
                    vec3 diffuse = texturedColor * lightColor * NdotL;

                    // Ambient (hemisphere-like)
                    float ambientFactor = 0.15 + 0.1 * (normal.y * 0.5 + 0.5);
                    vec3 ambient = texturedColor * ambientFactor;

                    // Roughness variation: rock is rougher, snow is smoother
                    float roughness = 0.8 * grassWeight + 0.95 * rockWeight +
                                      0.3 * snowWeight + 0.9 * sandWeight;

                    // Simple specular for snow/wet surfaces
                    vec3 halfDir = normalize(lightDir + viewDir);
                    float spec = pow(max(dot(normal, halfDir), 0.0), mix(8.0, 64.0, 1.0 - roughness));
                    vec3 specular = lightColor * spec * 0.15 * (1.0 - roughness);

                    vec3 finalColor = ambient + diffuse + specular;

                    gl_FragColor = vec4(finalColor, 1.0);

                    #include <fog_fragment>
                }
            `,
            vertexColors: true,
            lights: true,
            fog: true,
        });
    } else {
        // Non-biome planets: standard vertex-colored material
        const materialOptions: THREE.MeshStandardMaterialParameters = {
            vertexColors: true,
            flatShading: false,
            roughness: 0.8,
            metalness: 0.1,
        };

        if (normalmap) {
            const normalmapTexture = new THREE.Texture(normalmap);
            normalmapTexture.needsUpdate = true;
            normalmapTexture.wrapS = THREE.RepeatWrapping;
            normalmapTexture.wrapT = THREE.RepeatWrapping;
            normalmapTexture.repeat.set(4, 4);
            materialOptions.normalMap = normalmapTexture;
            materialOptions.normalScale = new THREE.Vector2(0.8, 0.8);
        }

        material = new THREE.MeshStandardMaterial(materialOptions);
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.PI;
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    // Create scaled heights array for collision/minimap (matches rendered mesh)
    // Heights are normalized to [0,1] then scaled by heightScale
    const scaledHeights = new Float32Array(heightmap.length);
    const heightRange = metadata.heightmap.max - metadata.heightmap.min;
    for (let i = 0; i < heightmap.length; i++) {
        const normalized = (heightmap[i] - metadata.heightmap.min) / heightRange;
        scaledHeights[i] = normalized * heightScale;
    }

    // Create downsampled color map for minimap (256x256 is sufficient)
    const minimapRes = 256;
    const minimapColors = new Uint8Array(minimapRes * minimapRes * 3);
    for (let mz = 0; mz < minimapRes; mz++) {
        for (let mx = 0; mx < minimapRes; mx++) {
            // Map minimap coords to heightmap coords
            const hx = Math.floor((mx / (minimapRes - 1)) * (width - 1));
            const hz = Math.floor((mz / (minimapRes - 1)) * (height - 1));
            const hIdx = hz * width + hx;

            // Get normalized height and generate color
            // Use same noise coordinates as terrain rendering: ((pos / size) + 0.5) * 3
            const normalized = (heightmap[hIdx] - metadata.heightmap.min) / heightRange;
            const scaledHeight = normalized * config.amplitude;
            const noiseX = (mx / (minimapRes - 1)) * 3;
            const noiseZ = (mz / (minimapRes - 1)) * 3;
            const color = generator.getColor(scaledHeight, noiseX, noiseZ);

            const mIdx = (mz * minimapRes + mx) * 3;
            minimapColors[mIdx] = Math.floor(color.r * 255);
            minimapColors[mIdx + 1] = Math.floor(color.g * 255);
            minimapColors[mIdx + 2] = Math.floor(color.b * 255);
        }
    }

    // Store terrain data - heights are scaled to match rendered mesh
    mesh.userData.terrainSize = size;
    mesh.userData.terrainResolution = width;
    mesh.userData.heights = scaledHeights; // Scaled heights for collision
    mesh.userData.heightScale = heightScale;
    mesh.userData.heightMin = 0;
    mesh.userData.heightMax = heightScale;
    mesh.userData.minimapColors = minimapColors; // RGB colors for minimap
    mesh.userData.minimapResolution = minimapRes;

    return mesh;
}

/**
 * Creates a grid of terrain chunks for seamless infinite terrain
 * Returns a Group containing all chunks positioned in a 3x3 grid
 */
export function createTerrainChunkGrid(
    planetName: string,
    chunkSize: number = 500,
    resolution: number = 256,
    gridSize: number = 3
): THREE.Group {
    const group = new THREE.Group();
    const halfGrid = Math.floor(gridSize / 2);

    // Create chunks in a grid
    for (let x = -halfGrid; x <= halfGrid; x++) {
        for (let z = -halfGrid; z <= halfGrid; z++) {
            const chunk = createTerrainMesh(
                planetName,
                chunkSize,
                resolution,
                true, // tileable
                x * chunkSize,
                z * chunkSize
            );

            chunk.position.set(x * chunkSize, 0, z * chunkSize);
            chunk.userData.chunkX = x;
            chunk.userData.chunkZ = z;
            chunk.userData.offsetX = x * chunkSize;
            chunk.userData.offsetZ = z * chunkSize;

            group.add(chunk);
        }
    }

    group.userData.chunkSize = chunkSize;
    group.userData.gridSize = gridSize;
    group.userData.planetName = planetName;
    group.userData.resolution = resolution;

    return group;
}

/**
 * Updates terrain chunk positions for infinite terrain
 * Repositions chunks as player moves beyond the center chunk
 */
export function updateTerrainChunks(
    chunkGroup: THREE.Group,
    playerX: number,
    playerZ: number
): void {
    const chunkSize = chunkGroup.userData.chunkSize as number;
    const gridSize = chunkGroup.userData.gridSize as number;
    const halfGrid = Math.floor(gridSize / 2);

    // Determine which chunk the player is in
    const playerChunkX = Math.floor(playerX / chunkSize);
    const playerChunkZ = Math.floor(playerZ / chunkSize);

    // Update each chunk position to maintain grid around player
    chunkGroup.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        const currentChunkX = mesh.userData.chunkX as number;
        const currentChunkZ = mesh.userData.chunkZ as number;

        // Calculate grid offset
        const offsetX = currentChunkX - halfGrid;
        const offsetZ = currentChunkZ - halfGrid;

        const newChunkX = playerChunkX + offsetX;
        const newChunkZ = playerChunkZ + offsetZ;

        // Update position if changed
        const newPosX = newChunkX * chunkSize;
        const newPosZ = newChunkZ * chunkSize;

        if (mesh.position.x !== newPosX || mesh.position.z !== newPosZ) {
            mesh.position.set(newPosX, 0, newPosZ);
            mesh.userData.chunkX = newChunkX;
            mesh.userData.chunkZ = newChunkZ;
        }
    });
}

/**
 * Get terrain height at a given world position
 * Uses direct geometry lookup for performance (no raycasting)
 * Terrain is rotated -90° X then 180° Z, centered at origin
 */
export function getTerrainHeight(terrain: THREE.Mesh, worldX: number, worldZ: number): number {
    const size = terrain.userData.terrainSize as number;
    const resolution = terrain.userData.terrainResolution as number;
    const heights = terrain.userData.heights as Float32Array;

    if (!size || !resolution || !heights) {
        console.error('Terrain data missing');
        return 0;
    }

    const halfSize = size / 2;

    // The terrain mesh is centered at origin, spanning from -halfSize to +halfSize
    // Account for 180° Z rotation which flips X axis
    // Wrap to terrain bounds for infinite terrain effect

    // First, wrap world coordinates to terrain range [-halfSize, halfSize]
    let localX = worldX;
    let localZ = worldZ;

    // Wrap X and Z using modular arithmetic
    localX = ((localX % size) + size + halfSize) % size - halfSize;
    localZ = ((localZ % size) + size + halfSize) % size - halfSize;

    // The terrain mesh is rotated:
    // 1. -90° on X axis: plane goes from XY to XZ plane
    // 2. 180° on Z axis: flips the orientation

    // To find which geometry vertex corresponds to world position (localX, localZ):
    // World X corresponds to geometry X (but flipped by 180° rotation)
    // World Z corresponds to geometry Y (after -90° X rotation)

    // Since the mesh is rotated 180° on Z, X is flipped
    const geoX = -localX; // Flip X due to 180° Z rotation
    const geoY = localZ;  // Z becomes Y after -90° X rotation

    // Convert from geometry coords [-halfSize, halfSize] to normalized [0, 1]
    const normX = (geoX + halfSize) / size;
    const normY = (geoY + halfSize) / size;

    // Clamp to valid range
    const clampedNormX = Math.max(0, Math.min(1, normX));
    const clampedNormY = Math.max(0, Math.min(1, normY));

    // Convert to grid indices
    const gridX = clampedNormX * (resolution - 1);
    const gridY = clampedNormY * (resolution - 1);

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

    const geometry = new THREE.PlaneGeometry(size * 1.2, size * 1.2, 32, 32);

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
            varying float vWaveHeight;

            void main() {
                vUv = uv;
                vec3 pos = position;

                // Wave parameters: steepness, wavelength, direction, timeScale
                // Compute displacement and analytical derivatives in one pass
                float totalHeight = 0.0;
                vec3 tangentX = vec3(1.0, 0.0, 0.0);
                vec3 tangentZ = vec3(0.0, 0.0, 1.0);

                // Wave 1
                {
                    float Q = 0.15; float L = 12.0; vec2 d = normalize(vec2(1.0, 0.6)); float ts = 0.8;
                    float k = 6.28318 / L;
                    float c = sqrt(9.81 / k);
                    float f = k * (dot(d, pos.xy) - c * time * ts);
                    float a = Q / k;
                    float sf = sin(f); float cf = cos(f);
                    pos.x += d.x * a * cf;
                    pos.z += d.y * a * cf;
                    totalHeight += a * sf;
                    tangentX += vec3(-Q * d.x * d.x * sf, Q * d.x * cf, -Q * d.x * d.y * sf);
                    tangentZ += vec3(-Q * d.x * d.y * sf, Q * d.y * cf, -Q * d.y * d.y * sf);
                }

                // Wave 2
                {
                    float Q = 0.1; float L = 8.0; vec2 d = normalize(vec2(-0.4, 1.0)); float ts = 1.1;
                    float k = 6.28318 / L;
                    float c = sqrt(9.81 / k);
                    float f = k * (dot(d, pos.xy) - c * time * ts);
                    float a = Q / k;
                    float sf = sin(f); float cf = cos(f);
                    pos.x += d.x * a * cf;
                    pos.z += d.y * a * cf;
                    totalHeight += a * sf;
                    tangentX += vec3(-Q * d.x * d.x * sf, Q * d.x * cf, -Q * d.x * d.y * sf);
                    tangentZ += vec3(-Q * d.x * d.y * sf, Q * d.y * cf, -Q * d.y * d.y * sf);
                }

                // Wave 3
                {
                    float Q = 0.08; float L = 5.0; vec2 d = normalize(vec2(0.7, -0.5)); float ts = 1.4;
                    float k = 6.28318 / L;
                    float c = sqrt(9.81 / k);
                    float f = k * (dot(d, pos.xy) - c * time * ts);
                    float a = Q / k;
                    float sf = sin(f); float cf = cos(f);
                    pos.x += d.x * a * cf;
                    pos.z += d.y * a * cf;
                    totalHeight += a * sf;
                    tangentX += vec3(-Q * d.x * d.x * sf, Q * d.x * cf, -Q * d.x * d.y * sf);
                    tangentZ += vec3(-Q * d.x * d.y * sf, Q * d.y * cf, -Q * d.y * d.y * sf);
                }

                // Wave 4
                {
                    float Q = 0.04; float L = 3.0; vec2 d = normalize(vec2(-1.0, 0.3)); float ts = 1.8;
                    float k = 6.28318 / L;
                    float c = sqrt(9.81 / k);
                    float f = k * (dot(d, pos.xy) - c * time * ts);
                    float a = Q / k;
                    float sf = sin(f); float cf = cos(f);
                    pos.x += d.x * a * cf;
                    pos.z += d.y * a * cf;
                    totalHeight += a * sf;
                    tangentX += vec3(-Q * d.x * d.x * sf, Q * d.x * cf, -Q * d.x * d.y * sf);
                    tangentZ += vec3(-Q * d.x * d.y * sf, Q * d.y * cf, -Q * d.y * d.y * sf);
                }

                pos.z += totalHeight; // Y displacement mapped to Z (plane is XY)
                vWaveHeight = totalHeight;

                // Analytical normal from tangent cross product
                vNormal = normalize(cross(tangentZ, tangentX));

                vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
                vWorldPosition = worldPosition.xyz;

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
            varying float vWaveHeight;

            // Simple noise for foam and caustics
            float hash2D(vec2 p) {
                vec3 p3 = fract(vec3(p.xyx) * 0.1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }

            float noise2D(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float a = hash2D(i);
                float b = hash2D(i + vec2(1.0, 0.0));
                float c = hash2D(i + vec2(0.0, 1.0));
                float d = hash2D(i + vec2(1.0, 1.0));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }

            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

                // Fresnel with wave-perturbed normal
                float fresnel = pow(1.0 - max(dot(viewDirection, normal), 0.0), 4.0);
                fresnel = clamp(fresnel, 0.02, 0.98);

                // Sun specular reflection on waves
                vec3 reflectDir = reflect(-sunDirection, normal);
                float spec = pow(max(dot(viewDirection, reflectDir), 0.0), 128.0);
                // Secondary broader specular
                float spec2 = pow(max(dot(viewDirection, reflectDir), 0.0), 16.0);

                // Depth-based color: deeper = darker blue
                vec3 shallowColor = waterColor * 1.4 + vec3(0.05, 0.1, 0.1);
                vec3 deepColor = waterColor * 0.5;
                // Use world Y as depth proxy (lower = deeper)
                float depthFactor = smoothstep(-2.0, 1.0, vWorldPosition.y);
                vec3 baseWaterColor = mix(deepColor, shallowColor, depthFactor);

                // Shore foam: white streaks at wave crests
                float foamNoise = noise2D(vWorldPosition.xz * 0.5 + time * 0.3);
                float foamNoise2 = noise2D(vWorldPosition.xz * 1.5 - time * 0.2);
                float foamMask = smoothstep(0.15, 0.35, vWaveHeight) * foamNoise;
                foamMask += smoothstep(0.1, 0.2, vWaveHeight) * foamNoise2 * 0.5;
                foamMask = clamp(foamMask, 0.0, 1.0);

                // Caustic pattern (animated Voronoi-like)
                vec2 causticUV = vWorldPosition.xz * 0.3 + time * 0.15;
                float c1 = noise2D(causticUV);
                float c2 = noise2D(causticUV * 1.7 + 3.7);
                float caustic = pow(c1 * c2, 0.8) * 0.3 * depthFactor;

                // Mix water color with sky reflection
                vec3 skyColor = vec3(0.6, 0.8, 1.0);
                vec3 color = mix(baseWaterColor + caustic, skyColor, fresnel * 0.5);

                // Add foam
                color = mix(color, vec3(0.9, 0.95, 1.0), foamMask * 0.6);

                // Add sun specular
                color += vec3(1.0) * spec * 0.8;
                color += vec3(1.0, 0.95, 0.9) * spec2 * 0.15;

                // Depth-based opacity: shallower = more transparent
                float alpha = mix(0.7, 0.92, 1.0 - depthFactor);
                alpha = max(alpha, foamMask * 0.5 + 0.5);

                gl_FragColor = vec4(color, alpha);
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
    const geometry = new THREE.SphereGeometry(radius, 32, 32);

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
            exponent: { value: 0.6 },
        },
        // CRITICAL: Sky dome must render as background, never occlude terrain
        depthWrite: false, // Don't write to depth buffer
        depthTest: false,  // Always render (background)
        side: THREE.BackSide,
        vertexShader: `
            varying vec3 vDirection;
            void main() {
                // Pass object-space position as the sky direction.
                // This is independent of camera rotation, so the horizon
                // stays fixed when the player looks up or down.
                vDirection = normalize(position);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform vec3 nightColor;
            uniform vec3 sunDirection;
            uniform float dayNightMix;
            uniform float exponent;
            varying vec3 vDirection;

            void main() {
                // Object-space Y gives a stable sky direction:
                // +Y = zenith, 0 = horizon, -Y = below horizon
                float h = vDirection.y;

                // Sky gradient: horizon color at h=0, top color at h=1
                float skyFactor = max(h, 0.0);
                vec3 dayColor = mix(bottomColor, topColor, pow(skyFactor, exponent));

                // Atmospheric scattering - haze concentrated near horizon
                float horizonFactor = 1.0 - abs(h);
                horizonFactor = pow(horizonFactor, 3.0);
                vec3 scatterColor = mix(bottomColor, vec3(1.0, 0.95, 0.9), 0.3);
                dayColor = mix(dayColor, scatterColor, horizonFactor * 0.4 * dayNightMix);

                // Night sky
                vec3 nightSky = nightColor;

                // Mix day and night
                vec3 finalColor = mix(nightSky, dayColor, dayNightMix);

                // Below horizon - dark ground color with atmospheric fade
                if (h < 0.0) {
                    vec3 groundColor = bottomColor * 0.2;
                    finalColor = mix(groundColor, finalColor, smoothstep(-0.2, 0.0, h));
                }

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.isSkyDome = true;
    // Re-enable sky dome rendering
    mesh.visible = true;
    return mesh;
}

/**
 * Creates a realistic starfield for the night sky with twinkling,
 * varied stellar colors, a Milky Way density band, and proper
 * hemisphere coverage.
 */
export function createStarfield(radius: number = 900): THREE.Points {
    const starCount = 6000;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const twinklePhases = new Float32Array(starCount);

    // Realistic stellar classification colors (spectral types)
    const starColors = [
        [0.62, 0.71, 1.0],   // O/B — hot blue-white
        [0.72, 0.80, 1.0],   // B/A — blue-white
        [0.85, 0.90, 1.0],   // A — white with blue tint
        [1.0, 1.0, 1.0],     // A/F — pure white
        [1.0, 0.98, 0.95],   // F — warm white
        [1.0, 0.95, 0.85],   // G — yellow-white (Sun-like)
        [1.0, 0.88, 0.70],   // K — orange
        [1.0, 0.75, 0.55],   // M — red-orange
    ];

    // Milky Way band: tilted great circle across the sky
    // Stars near this band are denser
    const milkyWayTilt = 0.4; // radians tilt from vertical
    const milkyWayPhase = 1.2; // rotation around Y

    for (let i = 0; i < starCount; i++) {
        // Uniform distribution on the upper hemisphere
        const azimuth = Math.random() * Math.PI * 2;
        // Use sqrt for uniform area distribution, minimum 1° above horizon
        const elevationMin = 0.02;
        const elevation = elevationMin + (Math.PI / 2 - elevationMin) * Math.sqrt(Math.random());

        // Milky Way density boost: calculate angular distance from the MW band
        const x0 = Math.cos(azimuth) * Math.cos(elevation);
        const y0 = Math.sin(elevation);
        const z0 = Math.sin(azimuth) * Math.cos(elevation);
        // Rotate point to MW frame
        const cosT = Math.cos(milkyWayTilt);
        const sinT = Math.sin(milkyWayTilt);
        const cosP = Math.cos(milkyWayPhase);
        const sinP = Math.sin(milkyWayPhase);
        const rx = x0 * cosP + z0 * sinP;
        const ry = y0;
        const rz = -x0 * sinP + z0 * cosP;
        const ry2 = ry * cosT - rz * sinT;
        // Distance from MW plane (ry2 ≈ 0 means on the MW band)
        const mwDist = Math.abs(ry2);
        // Probability of keeping this star (higher near MW band)
        const mwDensity = 1.0 + 2.5 * Math.exp(-mwDist * mwDist * 25);
        // Reject some stars far from MW to create density contrast
        if (Math.random() > mwDensity / 3.5) {
            // Redistribute rejected star closer to MW band
            const jitter = (Math.random() - 0.5) * 0.3;
            const newAz = azimuth + jitter;
            const newEl = Math.max(elevationMin, elevation * 0.7 + 0.3);
            const dist = radius * 0.65 + Math.random() * radius * 0.3;
            positions[i * 3] = Math.cos(newAz) * Math.cos(newEl) * dist;
            positions[i * 3 + 1] = Math.sin(newEl) * dist;
            positions[i * 3 + 2] = Math.sin(newAz) * Math.cos(newEl) * dist;
        } else {
            const dist = radius * 0.65 + Math.random() * radius * 0.3;
            positions[i * 3] = Math.cos(azimuth) * Math.cos(elevation) * dist;
            positions[i * 3 + 1] = Math.sin(elevation) * dist;
            positions[i * 3 + 2] = Math.sin(azimuth) * Math.cos(elevation) * dist;
        }

        // Star color — weighted toward white/blue-white (most common visible stars)
        const colorRoll = Math.random();
        let c: number[];
        if (colorRoll < 0.05) c = starColors[0];       // rare hot blue
        else if (colorRoll < 0.15) c = starColors[1];   // blue-white
        else if (colorRoll < 0.30) c = starColors[2];   // white-blue
        else if (colorRoll < 0.50) c = starColors[3];   // pure white
        else if (colorRoll < 0.65) c = starColors[4];   // warm white
        else if (colorRoll < 0.80) c = starColors[5];   // yellow-white
        else if (colorRoll < 0.92) c = starColors[6];   // orange
        else c = starColors[7];                          // red-orange

        // Slight per-star color variation
        const v = 0.04;
        colors[i * 3]     = Math.min(1, c[0] + (Math.random() - 0.5) * v);
        colors[i * 3 + 1] = Math.min(1, c[1] + (Math.random() - 0.5) * v);
        colors[i * 3 + 2] = Math.min(1, c[2] + (Math.random() - 0.5) * v);

        // Star magnitude distribution: many faint, few bright
        const magRoll = Math.random();
        if (magRoll < 0.55) {
            sizes[i] = 0.8 + Math.random() * 1.0;       // Faint (mag 5-6)
        } else if (magRoll < 0.80) {
            sizes[i] = 1.8 + Math.random() * 1.2;       // Moderate (mag 3-4)
        } else if (magRoll < 0.93) {
            sizes[i] = 3.0 + Math.random() * 1.5;       // Bright (mag 1-2)
        } else if (magRoll < 0.985) {
            sizes[i] = 4.5 + Math.random() * 2.0;       // Very bright (mag 0-1)
        } else {
            sizes[i] = 6.5 + Math.random() * 2.5;       // Brilliant (like Sirius/Vega)
        }

        // Stars near Milky Way band tend to be fainter (distant background stars)
        if (mwDist < 0.15) {
            sizes[i] *= 0.6 + Math.random() * 0.4;
        }

        twinklePhases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(twinklePhases, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uOpacity: { value: 1.0 },
        },
        vertexShader: `
            attribute float aSize;
            attribute float aPhase;
            uniform float uTime;
            varying vec3 vColor;
            varying float vTwinkle;
            varying float vBrightness;

            void main() {
                vColor = color;
                // Twinkle: gentle scintillation, brighter stars twinkle less
                float twinkleAmt = 0.15 / (1.0 + aSize * 0.3);
                vTwinkle = 1.0 - twinkleAmt + twinkleAmt * sin(uTime * 2.0 + aPhase * 6.2831);
                vBrightness = aSize / 6.0; // Normalized brightness for glow
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                // Bright stars get a slight size boost
                gl_PointSize = aSize * (0.9 + 0.1 * vTwinkle);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform float uOpacity;
            varying vec3 vColor;
            varying float vTwinkle;
            varying float vBrightness;

            void main() {
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard;

                // Core: bright center with soft glow falloff
                float core = smoothstep(0.5, 0.05, dist);
                // Glow: extended halo for brighter stars
                float glow = exp(-dist * dist * 12.0) * vBrightness * 0.6;

                float alpha = (core + glow) * vTwinkle * uOpacity;
                // Brighter stars get a whiter core (color desaturation at center)
                vec3 coreColor = mix(vColor, vec3(1.0), core * vBrightness * 0.4);

                gl_FragColor = vec4(coreColor, alpha);
            }
        `,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        vertexColors: true,
    });

    const stars = new THREE.Points(geometry, material);
    stars.renderOrder = -1;
    stars.userData.isStarfield = true;
    return stars;
}

/**
 * Update starfield twinkling and opacity
 */
export function updateStarfield(starfield: THREE.Points, time: number, sunHeight: number): void {
    const material = starfield.material as THREE.ShaderMaterial;
    if (!material.uniforms) return;
    material.uniforms.uTime.value = time;
    // Fade stars out during daytime
    material.uniforms.uOpacity.value = 1 - THREE.MathUtils.smoothstep(sunHeight, -0.1, 0.2);
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
}
