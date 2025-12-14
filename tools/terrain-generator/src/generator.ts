import { NoiseGenerator } from './noise.js';
import { HydraulicErosion, ThermalErosion } from './erosion.js';
import type { PlanetConfig, HeightmapData, GenerationResult } from './types.js';

/**
 * Main terrain generator class
 */
export class TerrainGenerator {
    private noise: NoiseGenerator;
    private config: PlanetConfig;
    private resolution: number;

    constructor(config: PlanetConfig, resolution: number = 2048) {
        this.config = config;
        this.resolution = resolution;
        // Use planet name as seed for consistent generation
        const seed = this.stringToSeed(config.name);
        this.noise = new NoiseGenerator(seed);
    }

    /**
     * Convert string to numeric seed
     */
    private stringToSeed(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Generate terrain for this planet
     */
    public async generate(): Promise<GenerationResult> {
        const startTime = Date.now();
        console.log(`\nGenerating terrain for ${this.config.name}...`);
        console.log(`  Resolution: ${this.resolution}x${this.resolution}`);
        console.log(`  Type: ${this.config.type}`);

        // Step 1: Generate base heightmap
        const heightmap = this.generateBaseHeightmap();

        // Step 2: Apply erosion if applicable
        let erodedHeightmap = heightmap;
        if (this.config.erosionIntensity > 0) {
            if (this.config.hasWater || this.config.hasAtmosphere) {
                // Hydraulic erosion for planets with water/atmosphere
                const hydraulic = new HydraulicErosion(heightmap);
                const iterations = Math.floor(this.config.erosionIntensity * 100000);
                erodedHeightmap = hydraulic.erode(iterations);
            }

            // Thermal erosion for all eroding planets
            const thermal = new ThermalErosion(erodedHeightmap);
            const thermalIterations = Math.floor(this.config.erosionIntensity * 20);
            erodedHeightmap = thermal.erode(thermalIterations);
        }

        // Step 3: Generate normal map
        const normalmap = this.generateNormalMap(erodedHeightmap);

        // Step 4: Calculate metadata
        const metadata = this.calculateMetadata(erodedHeightmap, startTime);

        console.log(`✓ Generation complete in ${metadata.generationTime.toFixed(2)}s`);
        console.log(`  Height range: ${metadata.minHeight.toFixed(3)} - ${metadata.maxHeight.toFixed(3)}`);

        return {
            heightmap: erodedHeightmap,
            normalmap,
            metadata,
        };
    }

    /**
     * Generate base heightmap using noise
     */
    private generateBaseHeightmap(): HeightmapData {
        console.log('  Step 1/4: Generating base heightmap...');

        const data = new Float32Array(this.resolution * this.resolution);
        const scale = 0.003; // Noise frequency

        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                const idx = y * this.resolution + x;

                // Combine different noise types based on planet characteristics
                let height = 0;

                // Base terrain
                if (this.config.type === 'terrestrial' || this.config.type === 'dwarf') {
                    // Combination of different noise types
                    const baseNoise = this.noise.fbm(x * scale, y * scale, 8, 0.5, 2.0);
                    const ridges = this.noise.ridgedMultifractal(x * scale * 2, y * scale * 2, 6, 0.5);
                    const warped = this.noise.domainWarped(x * scale * 0.5, y * scale * 0.5, 0.5);

                    // Mix based on roughness
                    height = baseNoise * (1 - this.config.roughness) +
                             ridges * this.config.roughness * 0.5 +
                             warped * 0.3;

                    // Add some small-scale detail
                    const detail = this.noise.fbm(x * scale * 8, y * scale * 8, 4, 0.3, 2.5);
                    height += detail * 0.1;

                    // Craters for airless bodies
                    if (!this.config.hasAtmosphere && this.config.name !== 'earth') {
                        const craters = this.noise.cellular(x * 0.5, y * 0.5, 100);
                        height -= craters * 0.2;
                    }
                }

                // Normalize to 0-1 range
                height = (height + 1) / 2;

                // Apply terrain scale
                height *= this.config.terrainScale;

                // Clamp
                height = Math.max(0, Math.min(1, height));

                data[idx] = height;
            }

            // Progress indicator
            if (y % 256 === 0) {
                process.stdout.write(`\r    Progress: ${((y / this.resolution) * 100).toFixed(0)}%`);
            }
        }

        console.log('\r    Progress: 100%');

        return {
            width: this.resolution,
            height: this.resolution,
            data,
        };
    }

    /**
     * Generate normal map from heightmap
     */
    private generateNormalMap(heightmap: HeightmapData): HeightmapData {
        console.log('  Step 2/4: Generating normal map...');

        const data = new Float32Array(this.resolution * this.resolution * 3);
        const strength = 8.0; // Normal map strength

        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                const idx = y * this.resolution + x;

                // Sample surrounding heights (with wrapping)
                const heightL = heightmap.data[y * this.resolution + ((x - 1 + this.resolution) % this.resolution)];
                const heightR = heightmap.data[y * this.resolution + ((x + 1) % this.resolution)];
                const heightD = heightmap.data[((y + 1) % this.resolution) * this.resolution + x];
                const heightU = heightmap.data[((y - 1 + this.resolution) % this.resolution) * this.resolution + x];

                // Calculate gradients
                const dx = (heightR - heightL) * strength;
                const dy = (heightD - heightU) * strength;

                // Normal vector
                const nx = -dx;
                const ny = -dy;
                const nz = 1;

                // Normalize
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

                // Store as 0-1 range (will be converted to RGB when exporting)
                data[idx * 3 + 0] = (nx / len + 1) / 2;
                data[idx * 3 + 1] = (ny / len + 1) / 2;
                data[idx * 3 + 2] = (nz / len + 1) / 2;
            }
        }

        return {
            width: this.resolution,
            height: this.resolution,
            data,
        };
    }

    /**
     * Calculate terrain metadata
     */
    private calculateMetadata(heightmap: HeightmapData, startTime: number): GenerationResult['metadata'] {
        console.log('  Step 4/4: Calculating metadata...');

        let min = Infinity;
        let max = -Infinity;
        let sum = 0;

        for (let i = 0; i < heightmap.data.length; i++) {
            const h = heightmap.data[i];
            min = Math.min(min, h);
            max = Math.max(max, h);
            sum += h;
        }

        return {
            minHeight: min,
            maxHeight: max,
            avgHeight: sum / heightmap.data.length,
            generationTime: (Date.now() - startTime) / 1000,
        };
    }
}
