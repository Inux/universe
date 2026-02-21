import { NoiseGenerator } from './noise.js';
import { HydraulicErosion, ThermalErosion } from './erosion.js';
import { AeolianErosion } from './aeolianErosion.js';
import { GlacialErosion } from './glacialErosion.js';
import { ShallowWaterErosion } from './shallowWaterErosion.js';
import { WaterSystemGenerator } from './water.js';
import type { PlanetConfig, HeightmapData, GenerationResult, WaterSystemData } from './types.js';

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

        // Step 1.2: Apply tectonic features (fault lines + folding)
        // Creates linear mountain ranges and rift valleys instead of
        // purely random noise mountains — geologically plausible layouts.
        if (this.config.type === 'terrestrial') {
            this.applyTectonics(heightmap);
        }

        // Step 1.5: Apply terrace/plateau formation for planets with
        // layered geological features (Mars canyons, Earth mesas)
        if (this.config.roughness >= 0.4) {
            this.applyTerraces(heightmap);
        }

        // Step 2: Apply multi-scale erosion if applicable
        // Runs hydraulic erosion at multiple resolutions to create nested
        // drainage patterns (macro valleys → medium channels → fine gullies)
        let erodedHeightmap = heightmap;
        if (this.config.erosionIntensity > 0) {
            if (this.config.hasWater || this.config.hasAtmosphere) {
                erodedHeightmap = this.multiScaleErosion(heightmap);
            }

            // Thermal erosion with rock hardness for all eroding planets
            const thermal = new ThermalErosion(erodedHeightmap);
            const thermalIterations = Math.floor(this.config.erosionIntensity * 20);
            erodedHeightmap = thermal.erode(thermalIterations);
        }

        // Step 2.5: Aeolian (wind) erosion for planets with atmosphere
        // Creates dunes, wind-sculpted bedrock, and deflation hollows
        if (this.config.hasAtmosphere && this.config.erosionIntensity > 0) {
            const windParticles = Math.floor(this.config.erosionIntensity * 40000);
            if (windParticles > 0) {
                // Wind angle varies by planet for variety
                const windAngle = this.stringToSeed(this.config.name + '_wind') % 628 / 100;
                const windSpeed = this.config.hasWater ? 0.6 : 1.2; // Less wind effect on wet planets
                const sandFraction = this.config.hasWater ? 0.05 : 0.2; // Less loose sand on wet planets

                const aeolian = new AeolianErosion(erodedHeightmap, {
                    windAngle,
                    windSpeed,
                    sandFraction,
                    seed: this.stringToSeed(this.config.name + '_aeolian'),
                });
                erodedHeightmap = aeolian.erode(windParticles);
            }
        }

        // Step 2.7: Glacial erosion for cold planets and high-altitude zones
        // Creates U-shaped valleys, cirques, hanging valleys, and moraines
        if (this.config.temperature < 260 || this.config.name === 'earth') {
            const equilibriumLine = this.config.temperature < 100 ? 0.2 : 0.65;
            const glacialIntensity = this.config.temperature < 100 ? 0.8 : 0.3;
            if (glacialIntensity > 0.1) {
                const glacial = new GlacialErosion(erodedHeightmap, {
                    equilibriumLine,
                    intensity: glacialIntensity,
                    seed: this.stringToSeed(this.config.name + '_glacial'),
                });
                erodedHeightmap = glacial.erode();
            }
        }

        // Step 2.8: Shallow water erosion pass for planets with water
        // Grid-based simulation that creates natural river networks from rainfall
        if (this.config.hasWater && this.config.erosionIntensity > 0.3) {
            const swIterations = Math.floor(this.config.erosionIntensity * 30);
            if (swIterations > 0) {
                const shallowWater = new ShallowWaterErosion(erodedHeightmap, {
                    rainfallRate: 0.0001,
                    evaporationRate: 0.00005,
                    seed: this.stringToSeed(this.config.name + '_sw'),
                });
                erodedHeightmap = shallowWater.erode(swIterations);
            }
        }

        // Step 3: Generate water systems (for planets with water)
        let waterData: WaterSystemData | undefined;
        let finalHeightmap = erodedHeightmap;

        if (this.config.hasWater) {
            const waterGenerator = new WaterSystemGenerator(erodedHeightmap, {
                riverThreshold: 300, // Lower threshold for more rivers
                seaLevel: 0.25, // 25% of terrain is below sea level
                minRiverLength: 30,
                valleyCarveDepth: 0.015,
                valleyCarveWidth: 6,
            });

            const waterResult = waterGenerator.generate();
            finalHeightmap = waterResult.heightmap;
            waterData = {
                rivers: waterResult.waterData.rivers,
                waterBodies: waterResult.waterData.waterBodies,
                seaLevel: waterResult.waterData.seaLevel,
            };
        }

        // Step 3.5: Gradient-domain smoothing pass
        // Operates on slopes instead of heights to smooth extreme transitions
        // without losing overall terrain structure. Ensures no unrealistically
        // steep cliffs remain after all erosion passes.
        if (this.config.erosionIntensity > 0) {
            console.log('  Step 3.5/5: Gradient-domain smoothing...');
            this.gradientDomainSmooth(finalHeightmap, 80);
        }

        // Step 4: Generate normal map
        const normalmap = this.generateNormalMap(finalHeightmap);

        // Step 5: Calculate metadata
        const metadata = this.calculateMetadata(finalHeightmap, startTime);

        console.log(`✓ Generation complete in ${metadata.generationTime.toFixed(2)}s`);
        console.log(`  Height range: ${metadata.minHeight.toFixed(3)} - ${metadata.maxHeight.toFixed(3)}`);

        return {
            heightmap: finalHeightmap,
            normalmap,
            waterData,
            metadata,
        };
    }

    /**
     * Generate base heightmap using noise
     */
    private generateBaseHeightmap(): HeightmapData {
        console.log('  Step 1/5: Generating base heightmap...');

        const data = new Float32Array(this.resolution * this.resolution);
        const scale = 0.003; // Noise frequency

        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                const idx = y * this.resolution + x;

                // Combine different noise types based on planet characteristics
                let height = 0;

                // Base terrain
                if (this.config.type === 'terrestrial' || this.config.type === 'dwarf') {
                    // Base shape: smooth fBm for broad landforms
                    const baseNoise = this.noise.fbm(x * scale, y * scale, 8, 0.5, 2.0);

                    // Swiss Turbulence: derivative-based erosion-like mountains
                    // Replaces ridgedMultifractal to avoid knife-edge peaks
                    const swiss = this.noise.swissTurbulence(x * scale * 2, y * scale * 2, 6, 2.0, 0.5, 0.15);

                    // Hybrid Multifractal: smooth valleys with rough peaks
                    const hybrid = this.noise.hybridMultifractal(x * scale * 1.5, y * scale * 1.5, 6, 0.3, 2.0, 0.7);

                    // Domain warping for organic, flowing distortions
                    const warped = this.noise.domainWarped(x * scale * 0.5, y * scale * 0.5, 0.5);

                    // Mix based on roughness:
                    // - Low roughness planets get mostly smooth fBm + warping
                    // - High roughness planets get more swiss turbulence + hybrid detail
                    const smoothWeight = 1 - this.config.roughness;
                    const roughWeight = this.config.roughness;

                    height = baseNoise * smoothWeight * 0.6 +
                             swiss * roughWeight * 0.4 +
                             hybrid * roughWeight * 0.3 +
                             warped * 0.25;

                    // Add some small-scale detail using swiss turbulence for erosion-like micro features
                    const detail = this.noise.swissTurbulence(x * scale * 8, y * scale * 8, 4, 2.5, 0.3, 0.1);
                    height += detail * 0.08;

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
     * Multi-scale erosion: runs hydraulic erosion at 3 scales to create
     * nested drainage patterns visible in real terrain.
     *
     * Scale 1 (coarse): Downsampled 4x — creates major valleys and basins
     * Scale 2 (medium): Downsampled 2x — adds medium river channels
     * Scale 3 (fine):   Full resolution — adds gullies and micro-detail
     *
     * Each scale pass uses fewer iterations since it operates on smaller data.
     */
    private multiScaleErosion(heightmap: HeightmapData): HeightmapData {
        const totalIterations = Math.floor(this.config.erosionIntensity * 100000);

        // Only do multi-scale if resolution is large enough and erosion is significant
        if (this.resolution < 512 || totalIterations < 10000) {
            // Fall back to single-scale erosion
            console.log('  Step 2/5: Running single-scale hydraulic erosion...');
            const hydraulic = new HydraulicErosion(heightmap);
            return hydraulic.erode(totalIterations);
        }

        console.log('  Step 2/5: Running multi-scale hydraulic erosion...');

        // --- Scale 1: Coarse pass (1/4 resolution) ---
        console.log('    Scale 1/3: Coarse erosion (major valleys)...');
        const coarse = this.downsample(heightmap, 4);
        const coarseErosion = new HydraulicErosion(coarse, 42);
        const coarseEroded = coarseErosion.erode(Math.floor(totalIterations * 0.3));

        // Upsample coarse result back to full resolution
        const coarseUp = this.upsample(coarseEroded, 4, this.resolution);

        // Blend erosion deltas (differences) rather than replacing heights.
        // This preserves original fine detail while applying large-scale erosion patterns.
        for (let i = 0; i < heightmap.data.length; i++) {
            const coarseDelta = coarseUp.data[i] - heightmap.data[i]; // Change from coarse erosion
            heightmap.data[i] += coarseDelta * 0.5; // Apply 50% of coarse erosion effect
        }

        // --- Scale 2: Medium pass (1/2 resolution) ---
        console.log('    Scale 2/3: Medium erosion (river channels)...');
        const medium = this.downsample(heightmap, 2);
        const mediumErosion = new HydraulicErosion(medium, 84);
        const mediumEroded = mediumErosion.erode(Math.floor(totalIterations * 0.35));

        const mediumUp = this.upsample(mediumEroded, 2, this.resolution);
        for (let i = 0; i < heightmap.data.length; i++) {
            const mediumDelta = mediumUp.data[i] - heightmap.data[i];
            heightmap.data[i] += mediumDelta * 0.5;
        }

        // --- Scale 3: Fine pass (full resolution) ---
        console.log('    Scale 3/3: Fine erosion (gullies and detail)...');
        const fineErosion = new HydraulicErosion(heightmap, 126);
        return fineErosion.erode(Math.floor(totalIterations * 0.35));
    }

    /**
     * Downsample a heightmap by a given factor using area averaging.
     */
    private downsample(heightmap: HeightmapData, factor: number): HeightmapData {
        const newW = Math.floor(heightmap.width / factor);
        const newH = Math.floor(heightmap.height / factor);
        const data = new Float32Array(newW * newH);

        for (let y = 0; y < newH; y++) {
            for (let x = 0; x < newW; x++) {
                let sum = 0;
                let count = 0;
                for (let dy = 0; dy < factor; dy++) {
                    for (let dx = 0; dx < factor; dx++) {
                        const sx = x * factor + dx;
                        const sy = y * factor + dy;
                        if (sx < heightmap.width && sy < heightmap.height) {
                            sum += heightmap.data[sy * heightmap.width + sx];
                            count++;
                        }
                    }
                }
                data[y * newW + x] = sum / count;
            }
        }

        return { width: newW, height: newH, data };
    }

    /**
     * Upsample a heightmap back to target resolution using bilinear interpolation.
     */
    private upsample(heightmap: HeightmapData, factor: number, targetRes: number): HeightmapData {
        const data = new Float32Array(targetRes * targetRes);

        for (let y = 0; y < targetRes; y++) {
            for (let x = 0; x < targetRes; x++) {
                // Map target position to source
                const sx = (x / targetRes) * (heightmap.width - 1);
                const sy = (y / targetRes) * (heightmap.height - 1);

                const ix = Math.floor(sx);
                const iy = Math.floor(sy);
                const fx = sx - ix;
                const fy = sy - iy;

                const ix1 = Math.min(ix + 1, heightmap.width - 1);
                const iy1 = Math.min(iy + 1, heightmap.height - 1);

                const h00 = heightmap.data[iy * heightmap.width + ix];
                const h10 = heightmap.data[iy * heightmap.width + ix1];
                const h01 = heightmap.data[iy1 * heightmap.width + ix];
                const h11 = heightmap.data[iy1 * heightmap.width + ix1];

                const h0 = h00 * (1 - fx) + h10 * fx;
                const h1 = h01 * (1 - fx) + h11 * fx;
                data[y * targetRes + x] = h0 * (1 - fy) + h1 * fy;
            }
        }

        return { width: targetRes, height: targetRes, data };
    }

    /**
     * Apply tectonic features: fault lines and folding.
     * Fault lines create sharp elevation discontinuities (one side uplifted).
     * Folding creates sinusoidal mountain ranges along compression axes.
     * The number and parameters are noise-driven for per-planet variety.
     */
    private applyTectonics(heightmap: HeightmapData): void {
        console.log('  Step 1.2/5: Applying tectonic features...');

        const w = heightmap.width;
        const h = heightmap.height;
        const seed = this.stringToSeed(this.config.name + '_tectonic');

        // Seeded pseudo-random for reproducible tectonic features
        let rng = seed;
        const nextRng = () => {
            rng = (rng * 9301 + 49297) % 233280;
            return rng / 233280;
        };

        // --- Fault lines ---
        // Number of faults scales with roughness (rougher = more tectonically active)
        const numFaults = 2 + Math.floor(this.config.roughness * 4);
        const faultStrength = 0.04 * this.config.terrainScale;

        for (let f = 0; f < numFaults; f++) {
            // Random fault line across the terrain
            const x1 = nextRng() * w;
            const y1 = nextRng() * h;
            const x2 = nextRng() * w;
            const y2 = nextRng() * h;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 10) continue;

            // Normal to fault line
            const nx = -dy / len;
            const ny = dx / len;

            // Uplift amount and falloff distance
            const uplift = (nextRng() * 0.5 + 0.5) * faultStrength;
            const falloff = w * (0.05 + nextRng() * 0.15);

            for (let gy = 0; gy < h; gy++) {
                for (let gx = 0; gx < w; gx++) {
                    const px = gx - x1;
                    const py = gy - y1;
                    const dist = px * nx + py * ny; // Signed distance from fault

                    if (dist > 0) {
                        // Uplift on one side with exponential falloff
                        const factor = Math.exp(-dist / falloff);
                        heightmap.data[gy * w + gx] += uplift * factor;
                    }
                }
            }
        }

        // --- Folding (sinusoidal compression) ---
        // Creates linear mountain range patterns
        const numFolds = 1 + Math.floor(this.config.roughness * 2);
        const foldStrength = 0.03 * this.config.terrainScale;

        for (let f = 0; f < numFolds; f++) {
            const angle = nextRng() * Math.PI; // Compression direction
            const wavelength = w * (0.1 + nextRng() * 0.2); // Range spacing
            const amplitude = (nextRng() * 0.5 + 0.5) * foldStrength;

            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            for (let gy = 0; gy < h; gy++) {
                for (let gx = 0; gx < w; gx++) {
                    const projected = gx * cosA + gy * sinA;
                    const fold = Math.sin(projected * 2 * Math.PI / wavelength) * amplitude;
                    heightmap.data[gy * w + gx] += fold;
                }
            }
        }

        // Re-clamp after tectonic modifications
        for (let i = 0; i < heightmap.data.length; i++) {
            heightmap.data[i] = Math.max(0, Math.min(1, heightmap.data[i]));
        }
    }

    /**
     * Apply gradient-domain blending to smooth transitions between
     * different terrain features. Operates on the gradient (slope) field
     * instead of absolute heights, then reconstructs via Poisson solving.
     * This produces seamless blending without the elevation discontinuities
     * that direct height blending can create.
     */
    private gradientDomainSmooth(heightmap: HeightmapData, iterations: number = 50): void {
        const w = heightmap.width;
        const h = heightmap.height;
        const data = heightmap.data;

        // Compute target gradient field (dx, dy at each point)
        const gradX = new Float32Array(w * h);
        const gradY = new Float32Array(w * h);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                const xp = Math.min(x + 1, w - 1);
                const yp = Math.min(y + 1, h - 1);
                gradX[idx] = data[y * w + xp] - data[idx];
                gradY[idx] = data[yp * w + x] - data[idx];
            }
        }

        // Attenuate extreme gradients for smoother terrain
        // This is the key operation: we edit the gradient field
        const maxGrad = 0.02 * this.config.terrainScale;
        for (let i = 0; i < gradX.length; i++) {
            const mag = Math.sqrt(gradX[i] * gradX[i] + gradY[i] * gradY[i]);
            if (mag > maxGrad) {
                const scale = maxGrad / mag;
                gradX[i] *= scale;
                gradY[i] *= scale;
            }
        }

        // Poisson reconstruction via Gauss-Seidel iteration
        // Solves: laplacian(h) = divergence(gradient)
        // Compute divergence of the modified gradient field
        const divergence = new Float32Array(w * h);
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = y * w + x;
                divergence[idx] =
                    (gradX[idx] - gradX[y * w + (x - 1)]) +
                    (gradY[idx] - gradY[(y - 1) * w + x]);
            }
        }

        // Iterative solve (Gauss-Seidel with SOR)
        const omega = 1.5; // Over-relaxation factor
        const result = new Float32Array(data); // Initialize with original heights

        for (let iter = 0; iter < iterations; iter++) {
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = y * w + x;
                    const avg = (
                        result[y * w + (x - 1)] +
                        result[y * w + (x + 1)] +
                        result[(y - 1) * w + x] +
                        result[(y + 1) * w + x] -
                        divergence[idx]
                    ) / 4.0;

                    result[idx] = result[idx] + omega * (avg - result[idx]);
                }
            }
        }

        // Copy back
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.max(0, Math.min(1, result[i]));
        }
    }

    /**
     * Apply terrace/plateau formation to create layered geological features.
     * Uses noise-varied terrace levels and sharpness for natural-looking
     * mesas, stepped canyons, and plateau formations.
     * Blended subtly with the original terrain to avoid over-terracing.
     */
    private applyTerraces(heightmap: HeightmapData): void {
        console.log('  Step 1.5/5: Applying terrace formation...');

        const scale = 0.002;
        // Terrace intensity varies by planet roughness
        // Higher roughness = more prominent terraces
        const terraceBlend = Math.min(0.3, this.config.roughness * 0.25);

        for (let y = 0; y < this.resolution; y++) {
            for (let x = 0; x < this.resolution; x++) {
                const idx = y * this.resolution + x;
                const originalHeight = heightmap.data[idx];

                // Vary terrace levels spatially using noise
                const noiseVal = this.noise.fbm(x * scale * 0.5, y * scale * 0.5, 3);
                const levels = 5 + Math.floor((noiseVal + 1) * 2); // 3-9 levels
                const sharpness = 0.3 + (noiseVal + 1) * 0.15; // 0.3-0.6

                // Only apply terraces to mid-high elevations (not valleys/oceans)
                const elevationMask = Math.max(0, Math.min(1, (originalHeight - 0.3) * 3));

                // Quantize height to discrete terrace levels
                const k = originalHeight * levels;
                const step = Math.floor(k);
                const frac = k - step;

                // Smooth step with adjustable sharpness
                const smoothFrac = Math.pow(frac, 1.0 / (1.0 - sharpness * 0.95));
                const terracedHeight = (step + smoothFrac) / levels;

                // Blend between original and terraced based on elevation mask
                const blendFactor = terraceBlend * elevationMask;
                heightmap.data[idx] = originalHeight * (1 - blendFactor) + terracedHeight * blendFactor;
            }
        }
    }

    /**
     * Generate normal map from heightmap
     */
    private generateNormalMap(heightmap: HeightmapData): HeightmapData {
        console.log('  Step 4/5: Generating normal map...');

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
        console.log('  Step 5/5: Calculating metadata...');

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
