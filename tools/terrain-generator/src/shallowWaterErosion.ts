import type { HeightmapData } from './types.js';

/**
 * Grid-based shallow water erosion using the Saint-Venant equations.
 * Simulates an entire water layer simultaneously (unlike particle-based
 * erosion which simulates individual droplets).
 *
 * Maintains four fields:
 * - b: terrain height (bedrock + sediment)
 * - d: water depth
 * - s: suspended sediment
 * - flux: water flow between cells (left, right, top, bottom)
 *
 * Naturally creates river networks from uniform rainfall without
 * needing separate flow accumulation analysis.
 *
 * Based on "Fast Hydraulic Erosion Simulation and Visualization on GPU"
 * (Mei, Decaudin, Hu 2007) and the pipe model for fluid simulation.
 */
export class ShallowWaterErosion {
    private width: number;
    private height: number;

    // Terrain and water fields
    private terrain: Float32Array;      // b: ground height
    private water: Float32Array;        // d: water depth
    private sediment: Float32Array;     // s: suspended sediment
    private fL: Float32Array;           // flux left
    private fR: Float32Array;           // flux right
    private fT: Float32Array;           // flux top
    private fB: Float32Array;           // flux bottom
    private sedimentBuffer: Float32Array; // pre-allocated double buffer for advection

    // Simulation parameters
    private gravity = 9.81;
    private pipeArea = 1.0;             // Cross-section area of virtual pipes
    private pipeLength = 1.0;           // Length of virtual pipes (cell distance)
    private rainfallRate: number;
    private evaporationRate: number;
    private sedimentCapacity = 0.05;    // Max sediment per unit of flow
    private erosionRate = 0.002;
    private depositionRate = 0.002;
    private dt = 0.02;                  // Time step

    private rngState: number;

    constructor(
        heightmapData: HeightmapData,
        options: {
            rainfallRate?: number;
            evaporationRate?: number;
            seed?: number;
        } = {}
    ) {
        this.width = heightmapData.width;
        this.height = heightmapData.height;
        this.rngState = options.seed ?? 256;
        this.rainfallRate = options.rainfallRate ?? 0.0001;
        this.evaporationRate = options.evaporationRate ?? 0.00005;

        const size = this.width * this.height;
        this.terrain = new Float32Array(heightmapData.data);
        this.water = new Float32Array(size);
        this.sediment = new Float32Array(size);
        this.fL = new Float32Array(size);
        this.fR = new Float32Array(size);
        this.fT = new Float32Array(size);
        this.fB = new Float32Array(size);
        this.sedimentBuffer = new Float32Array(size);
    }

    private nextRandom(): number {
        this.rngState = (this.rngState * 9301 + 49297) % 233280;
        return this.rngState / 233280;
    }

    /**
     * Single simulation step implementing the pipe model.
     */
    private step(): void {
        const w = this.width;
        const h = this.height;
        const dt = this.dt;
        const g = this.gravity;
        const A = this.pipeArea;
        const l = this.pipeLength;

        // --- 1. Add water (rainfall) ---
        for (let i = 0; i < this.water.length; i++) {
            this.water[i] += this.rainfallRate;
        }

        // --- 2. Calculate flux based on water height differences ---
        // Flux represents water flow through virtual pipes between cells
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                const totalH = this.terrain[idx] + this.water[idx];

                // Flux to each neighbor based on height difference
                // flux = max(0, old_flux + dt * A * g * deltaH / l)
                if (x > 0) {
                    const nIdx = y * w + (x - 1);
                    const nH = this.terrain[nIdx] + this.water[nIdx];
                    this.fL[idx] = Math.max(0, this.fL[idx] + dt * A * g * (totalH - nH) / l);
                } else {
                    this.fL[idx] = 0;
                }

                if (x < w - 1) {
                    const nIdx = y * w + (x + 1);
                    const nH = this.terrain[nIdx] + this.water[nIdx];
                    this.fR[idx] = Math.max(0, this.fR[idx] + dt * A * g * (totalH - nH) / l);
                } else {
                    this.fR[idx] = 0;
                }

                if (y > 0) {
                    const nIdx = (y - 1) * w + x;
                    const nH = this.terrain[nIdx] + this.water[nIdx];
                    this.fT[idx] = Math.max(0, this.fT[idx] + dt * A * g * (totalH - nH) / l);
                } else {
                    this.fT[idx] = 0;
                }

                if (y < h - 1) {
                    const nIdx = (y + 1) * w + x;
                    const nH = this.terrain[nIdx] + this.water[nIdx];
                    this.fB[idx] = Math.max(0, this.fB[idx] + dt * A * g * (totalH - nH) / l);
                } else {
                    this.fB[idx] = 0;
                }

                // Scale flux to prevent more water leaving than available
                const totalOutflow = this.fL[idx] + this.fR[idx] + this.fT[idx] + this.fB[idx];
                if (totalOutflow > 0) {
                    const availableWater = this.water[idx] * l * l / dt;
                    if (totalOutflow > availableWater) {
                        const scale = availableWater / totalOutflow;
                        this.fL[idx] *= scale;
                        this.fR[idx] *= scale;
                        this.fT[idx] *= scale;
                        this.fB[idx] *= scale;
                    }
                }
            }
        }

        // --- 3. Update water surface from flux divergence ---
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;

                // Net flux = inflow - outflow
                const outflow = this.fL[idx] + this.fR[idx] + this.fT[idx] + this.fB[idx];

                let inflow = 0;
                if (x > 0) inflow += this.fR[y * w + (x - 1)];       // Right flux of left neighbor
                if (x < w - 1) inflow += this.fL[y * w + (x + 1)];   // Left flux of right neighbor
                if (y > 0) inflow += this.fB[(y - 1) * w + x];       // Bottom flux of top neighbor
                if (y < h - 1) inflow += this.fT[(y + 1) * w + x];   // Top flux of bottom neighbor

                const deltaVolume = dt * (inflow - outflow);
                this.water[idx] = Math.max(0, this.water[idx] + deltaVolume / (l * l));
            }
        }

        // --- 4. Calculate velocity field and erode/deposit ---
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = y * w + x;

                if (this.water[idx] < 0.00001) continue;

                // Velocity from flux differences (normalized by water depth)
                const avgDepth = Math.max(0.001, this.water[idx]);
                const vx = (this.fR[idx] - this.fL[idx] +
                           this.fR[y * w + (x - 1)] - this.fL[y * w + (x + 1)]) * 0.5 / avgDepth;
                const vy = (this.fB[idx] - this.fT[idx] +
                           this.fB[(y - 1) * w + x] - this.fT[(y + 1) * w + x]) * 0.5 / avgDepth;

                const speed = Math.sqrt(vx * vx + vy * vy);

                // Local slope
                const dh_dx = (this.terrain[y * w + (x + 1)] - this.terrain[y * w + (x - 1)]) * 0.5;
                const dh_dy = (this.terrain[(y + 1) * w + x] - this.terrain[(y - 1) * w + x]) * 0.5;
                const slope = Math.sqrt(dh_dx * dh_dx + dh_dy * dh_dy);

                // Sediment transport capacity
                const capacity = this.sedimentCapacity * speed * slope * this.water[idx];

                if (this.sediment[idx] < capacity) {
                    // Erode: pick up sediment
                    const erodeAmount = this.erosionRate * (capacity - this.sediment[idx]);
                    const actualErode = Math.min(erodeAmount, this.terrain[idx] * 0.1);
                    this.terrain[idx] -= actualErode;
                    this.sediment[idx] += actualErode;
                } else {
                    // Deposit: drop sediment
                    const depositAmount = this.depositionRate * (this.sediment[idx] - capacity);
                    this.terrain[idx] += depositAmount;
                    this.sediment[idx] -= depositAmount;
                }
            }
        }

        // --- 5. Transport sediment with velocity field (simple advection) ---
        this.sedimentBuffer.set(this.sediment);
        const newSediment = this.sedimentBuffer;
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = y * w + x;
                if (this.water[idx] < 0.00001) continue;

                // Semi-Lagrangian advection: trace back along velocity (normalized by water depth)
                const avgD = Math.max(0.001, this.water[idx]);
                const vx = (this.fR[idx] - this.fL[idx]) * 0.5 / avgD;
                const vy = (this.fB[idx] - this.fT[idx]) * 0.5 / avgD;

                const srcX = Math.max(1, Math.min(w - 2, x - vx * dt));
                const srcY = Math.max(1, Math.min(h - 2, y - vy * dt));

                // Bilinear interpolation at source
                const ix = Math.floor(srcX);
                const iy = Math.floor(srcY);
                const fx = srcX - ix;
                const fy = srcY - iy;

                newSediment[idx] =
                    this.sediment[iy * w + ix] * (1 - fx) * (1 - fy) +
                    this.sediment[iy * w + (ix + 1)] * fx * (1 - fy) +
                    this.sediment[(iy + 1) * w + ix] * (1 - fx) * fy +
                    this.sediment[(iy + 1) * w + (ix + 1)] * fx * fy;
            }
        }
        this.sediment.set(newSediment);

        // --- 6. Evaporate water ---
        for (let i = 0; i < this.water.length; i++) {
            this.water[i] = Math.max(0, this.water[i] - this.evaporationRate);
        }
    }

    /**
     * Run shallow water erosion simulation.
     */
    public erode(numIterations: number = 20): HeightmapData {
        console.log(`Running shallow water erosion for ${numIterations} iterations...`);

        for (let i = 0; i < numIterations; i++) {
            if (i % 5 === 0) {
                console.log(`  Progress: ${((i / numIterations) * 100).toFixed(0)}%`);
            }
            this.step();
        }

        // Deposit remaining suspended sediment
        for (let i = 0; i < this.terrain.length; i++) {
            this.terrain[i] += this.sediment[i] * 0.5;
            this.terrain[i] = Math.max(0, this.terrain[i]);
        }

        console.log('  Shallow water erosion complete.');

        return {
            width: this.width,
            height: this.height,
            data: this.terrain,
        };
    }
}
