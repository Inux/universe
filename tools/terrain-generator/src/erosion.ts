import type { HeightmapData } from './types.js';

/**
 * Hydraulic erosion simulation - simulates water droplets eroding terrain
 * Based on the paper "Fast Hydraulic Erosion Simulation and Visualization on GPU"
 */
export class HydraulicErosion {
    private width: number;
    private height: number;
    private heightmap: Float32Array;

    // Erosion parameters
    private erosionRadius = 3;
    private inertia = 0.05; // Lower = more agile droplets
    private sedimentCapacityFactor = 4;
    private minSedimentCapacity = 0.01;
    private erodeSpeed = 0.3;
    private depositSpeed = 0.3;
    private evaporateSpeed = 0.01;
    private gravity = 4;
    private maxDropletLifetime = 30;
    private initialWaterVolume = 1;
    private initialSpeed = 1;

    // Precomputed erosion kernel (offsets and normalized weights)
    private kernelOffsets: Array<{ dx: number; dy: number }> = [];
    private kernelWeights: Float32Array = new Float32Array(0);

    // Seeded PRNG state
    private rngState: number;

    constructor(heightmapData: HeightmapData, seed: number = 42) {
        this.width = heightmapData.width;
        this.height = heightmapData.height;
        this.heightmap = new Float32Array(heightmapData.data);
        this.rngState = seed;
        this.precomputeKernel();
    }

    /**
     * Seeded pseudo-random number generator (0-1 range)
     */
    private nextRandom(): number {
        this.rngState = (this.rngState * 9301 + 49297) % 233280;
        return this.rngState / 233280;
    }

    /**
     * Precompute erosion/deposition kernel weights for the configured radius.
     * Weights are normalized so they sum to 1.0.
     */
    private precomputeKernel(): void {
        const offsets: Array<{ dx: number; dy: number }> = [];
        const rawWeights: number[] = [];
        let totalWeight = 0;

        for (let dy = -this.erosionRadius; dy <= this.erosionRadius; dy++) {
            for (let dx = -this.erosionRadius; dx <= this.erosionRadius; dx++) {
                const distSq = dx * dx + dy * dy;
                const radiusSq = this.erosionRadius * this.erosionRadius;
                if (distSq > radiusSq) continue;

                const dist = Math.sqrt(distSq);
                const weight = 1 - dist / this.erosionRadius;
                offsets.push({ dx, dy });
                rawWeights.push(weight);
                totalWeight += weight;
            }
        }

        this.kernelOffsets = offsets;
        this.kernelWeights = new Float32Array(rawWeights.length);
        for (let i = 0; i < rawWeights.length; i++) {
            this.kernelWeights[i] = rawWeights[i] / totalWeight;
        }
    }

    /**
     * Run erosion simulation
     */
    public erode(numIterations: number = 50000): HeightmapData {
        console.log(`Running hydraulic erosion with ${numIterations} droplets...`);

        for (let iteration = 0; iteration < numIterations; iteration++) {
            if (iteration % 10000 === 0) {
                console.log(`  Progress: ${((iteration / numIterations) * 100).toFixed(1)}%`);
            }

            this.simulateDroplet();
        }

        return {
            width: this.width,
            height: this.height,
            data: this.heightmap,
        };
    }

    /**
     * Simulate a single water droplet
     */
    private simulateDroplet(): void {
        // Seeded random starting position for reproducible results
        let posX = this.nextRandom() * (this.width - 1);
        let posY = this.nextRandom() * (this.height - 1);

        let dirX = 0;
        let dirY = 0;
        let speed = this.initialSpeed;
        let water = this.initialWaterVolume;
        let sediment = 0;

        for (let lifetime = 0; lifetime < this.maxDropletLifetime; lifetime++) {
            const nodeX = Math.floor(posX);
            const nodeY = Math.floor(posY);
            const cellOffsetX = posX - nodeX;
            const cellOffsetY = posY - nodeY;

            // Calculate droplet's height and direction of flow using bilinear interpolation
            const heightAndGradient = this.calculateHeightAndGradient(posX, posY);
            const height = heightAndGradient.height;

            // Update direction and speed
            dirX = (dirX * this.inertia - heightAndGradient.gradientX * (1 - this.inertia));
            dirY = (dirY * this.inertia - heightAndGradient.gradientY * (1 - this.inertia));

            // Normalize direction
            const len = Math.sqrt(dirX * dirX + dirY * dirY);
            if (len !== 0) {
                dirX /= len;
                dirY /= len;
            }

            // Move droplet
            posX += dirX;
            posY += dirY;

            // Stop at map edge
            if (posX < 0 || posX >= this.width - 1 || posY < 0 || posY >= this.height - 1) {
                break;
            }

            // Find new height
            const newHeight = this.calculateHeightAndGradient(posX, posY).height;
            const deltaHeight = newHeight - height;

            // Calculate sediment capacity
            const sedimentCapacity = Math.max(
                -deltaHeight * speed * water * this.sedimentCapacityFactor,
                this.minSedimentCapacity
            );

            // If carrying more sediment than capacity, deposit
            // If carrying less, erode
            if (sediment > sedimentCapacity || deltaHeight > 0) {
                const amountToDeposit = (deltaHeight > 0)
                    ? Math.min(deltaHeight, sediment)
                    : (sediment - sedimentCapacity) * this.depositSpeed;

                sediment -= amountToDeposit;
                this.depositSediment(posX, posY, amountToDeposit);
            } else {
                const amountToErode = Math.min(
                    (sedimentCapacity - sediment) * this.erodeSpeed,
                    -deltaHeight
                );

                sediment += this.erodeSediment(posX, posY, amountToErode);
            }

            // Update speed and evaporate water
            // Prevent NaN from sqrt of negative number
            speed = Math.sqrt(Math.max(0, speed * speed + deltaHeight * this.gravity));
            water *= (1 - this.evaporateSpeed);
        }
    }

    /**
     * Calculate height and gradient at a position using bilinear interpolation
     */
    private calculateHeightAndGradient(posX: number, posY: number): {
        height: number;
        gradientX: number;
        gradientY: number;
    } {
        const coordX = Math.floor(posX);
        const coordY = Math.floor(posY);
        const x = posX - coordX;
        const y = posY - coordY;

        // Heights of the four nodes of the droplet's cell
        const heightNW = this.getHeight(coordX, coordY);
        const heightNE = this.getHeight(coordX + 1, coordY);
        const heightSW = this.getHeight(coordX, coordY + 1);
        const heightSE = this.getHeight(coordX + 1, coordY + 1);

        // Calculate droplet's height with bilinear interpolation
        const height =
            heightNW * (1 - x) * (1 - y) +
            heightNE * x * (1 - y) +
            heightSW * (1 - x) * y +
            heightSE * x * y;

        // Calculate gradient
        const gradientX = (heightNE - heightNW) * (1 - y) + (heightSE - heightSW) * y;
        const gradientY = (heightSW - heightNW) * (1 - x) + (heightSE - heightNE) * x;

        return { height, gradientX, gradientY };
    }

    /**
     * Erode at a position using precomputed kernel and return amount eroded
     */
    private erodeSediment(posX: number, posY: number, amount: number): number {
        const coordX = Math.floor(posX);
        const coordY = Math.floor(posY);
        let totalEroded = 0;

        for (let i = 0; i < this.kernelOffsets.length; i++) {
            const x = coordX + this.kernelOffsets[i].dx;
            const y = coordY + this.kernelOffsets[i].dy;

            if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;

            const erodeAmount = amount * this.kernelWeights[i];
            const idx = y * this.width + x;
            const newHeight = this.heightmap[idx] - erodeAmount;
            this.heightmap[idx] = isNaN(newHeight) ? this.heightmap[idx] : Math.max(0, newHeight);
            totalEroded += erodeAmount;
        }

        return totalEroded;
    }

    /**
     * Deposit sediment at a position using precomputed kernel
     */
    private depositSediment(posX: number, posY: number, amount: number): void {
        const coordX = Math.floor(posX);
        const coordY = Math.floor(posY);

        for (let i = 0; i < this.kernelOffsets.length; i++) {
            const x = coordX + this.kernelOffsets[i].dx;
            const y = coordY + this.kernelOffsets[i].dy;

            if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;

            const depositAmount = amount * this.kernelWeights[i];
            const idx = y * this.width + x;
            const newHeight = this.heightmap[idx] + depositAmount;
            this.heightmap[idx] = isNaN(newHeight) ? this.heightmap[idx] : newHeight;
        }
    }

    /**
     * Get height at coordinates (with bounds checking)
     */
    private getHeight(x: number, y: number): number {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return 0;
        }
        return this.heightmap[y * this.width + x];
    }
}

/**
 * Thermal erosion - simulates rock weathering and talus slopes
 * Supports variable rock hardness for realistic cliff/slope formation
 */
export class ThermalErosion {
    private width: number;
    private height: number;
    private heightmap: Float32Array;
    private hardnessMap: Float32Array;
    private baseTalus: number = 0.4; // Minimum talus angle (soft rock)
    private hardnessTalusRange: number = 0.8; // Additional talus for hard rock

    // Seeded PRNG for hardness map generation
    private rngState: number;

    private heightmapBuffer: Float32Array;

    constructor(heightmapData: HeightmapData, seed: number = 137) {
        this.width = heightmapData.width;
        this.height = heightmapData.height;
        this.heightmap = new Float32Array(heightmapData.data);
        this.heightmapBuffer = new Float32Array(this.width * this.height);
        this.rngState = seed;
        this.hardnessMap = this.generateHardnessMap();
    }

    private nextRandom(): number {
        this.rngState = (this.rngState * 9301 + 49297) % 233280;
        return this.rngState / 233280;
    }

    /**
     * Generate a noise-based rock hardness map.
     * Hardness varies with depth (higher elevation = softer sedimentary layers)
     * and spatially (noise-driven geological variation).
     * Values range from 0 (soft sandstone) to 1 (hard granite).
     */
    private generateHardnessMap(): Float32Array {
        const map = new Float32Array(this.width * this.height);

        // Simple multi-octave noise for hardness variation
        // Uses a different frequency than terrain for geological realism
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                const h = this.heightmap[idx];

                // Spatial variation: pseudo-noise using hash
                const hash1 = Math.sin(x * 0.037 + y * 0.071) * 43758.5453;
                const noise1 = hash1 - Math.floor(hash1);
                const hash2 = Math.sin(x * 0.013 + y * 0.029) * 23421.631;
                const noise2 = hash2 - Math.floor(hash2);

                // Combine spatial noise at two scales
                const spatialHardness = noise1 * 0.6 + noise2 * 0.4;

                // Depth factor: harder rock at lower elevations (bedrock),
                // softer at higher elevations (sedimentary/weathered)
                const depthFactor = 1.0 - h * 0.4;

                map[idx] = Math.max(0, Math.min(1, spatialHardness * depthFactor));
            }
        }

        return map;
    }

    /**
     * Run thermal erosion simulation
     */
    public erode(numIterations: number = 10): HeightmapData {
        console.log(`Running thermal erosion for ${numIterations} iterations (with rock hardness)...`);

        for (let iteration = 0; iteration < numIterations; iteration++) {
            this.thermalStep();
        }

        return {
            width: this.width,
            height: this.height,
            data: this.heightmap,
        };
    }

    /**
     * Single iteration of thermal erosion with variable hardness
     */
    private thermalStep(): void {
        this.heightmapBuffer.set(this.heightmap);
        const newHeightmap = this.heightmapBuffer;

        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                const idx = y * this.width + x;
                const currentHeight = this.heightmap[idx];
                const currentHardness = this.hardnessMap[idx];

                // Talus angle varies with rock hardness:
                // Hard rock (hardness=1): steep stable slopes (cliffs)
                // Soft rock (hardness=0): gentle slopes (rounded hills)
                const talusAngle = this.baseTalus + currentHardness * this.hardnessTalusRange;

                // Transfer rate also varies: hard rock erodes slower
                const transferRate = 0.5 * (1 - currentHardness * 0.7);

                let totalDiff = 0;
                let steepCount = 0;
                const steepIndices: number[] = [];
                const steepDiffs: number[] = [];

                // Check 8 neighbors
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;

                        const nx = x + dx;
                        const ny = y + dy;
                        const nIdx = ny * this.width + nx;

                        const diff = currentHeight - this.heightmap[nIdx];

                        if (diff > talusAngle) {
                            totalDiff += diff;
                            steepIndices[steepCount] = nIdx;
                            steepDiffs[steepCount] = diff;
                            steepCount++;
                        }
                    }
                }

                if (steepCount > 0) {
                    const avgDiff = totalDiff / steepCount;
                    const transferAmount = avgDiff * transferRate;

                    newHeightmap[idx] -= transferAmount;

                    for (let i = 0; i < steepCount; i++) {
                        newHeightmap[steepIndices[i]] += transferAmount * (steepDiffs[i] / totalDiff);
                    }
                }
            }
        }

        this.heightmap = newHeightmap;
    }
}
