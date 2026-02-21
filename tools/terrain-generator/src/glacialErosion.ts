import type { HeightmapData } from './types.js';

/**
 * Glacial erosion simulation.
 * Simulates ice accumulation, flow, and erosion to create:
 * - U-shaped valleys (glacial carving is width-dependent unlike fluvial)
 * - Cirques (bowl-shaped depressions at glacier heads)
 * - Hanging valleys (tributary glaciers meeting main glacier)
 * - Moraines (sediment deposited at glacier terminus)
 *
 * Based on the Shallow Ice Approximation (SIA) and Glen's flow law.
 * Inspired by "Forming Terrains by Glacial Erosion" (SIGGRAPH 2023).
 */
export class GlacialErosion {
    private width: number;
    private height: number;
    private bedrock: Float32Array;
    private ice: Float32Array;
    private moraine: Float32Array; // Deposited sediment

    // Physical parameters
    private equilibriumLine: number;  // Altitude above which snow accumulates (0-1)
    private accumulationRate: number; // Ice gain per step above equilibrium
    private ablationRate: number;     // Ice loss per step below equilibrium
    private flowCoeff: number;        // Ice flow speed coefficient
    private abrasionCoeff: number;    // Bedrock erosion rate
    private quarryCoeff: number;      // Rock plucking rate
    private glenExponent: number;     // Glen's flow law exponent (typically 3)

    private numSteps: number;

    // Seeded PRNG
    private rngState: number;

    constructor(
        heightmapData: HeightmapData,
        options: {
            equilibriumLine?: number;
            intensity?: number;
            seed?: number;
        } = {}
    ) {
        this.width = heightmapData.width;
        this.height = heightmapData.height;
        this.rngState = options.seed ?? 199;

        const intensity = options.intensity ?? 0.5;
        this.equilibriumLine = options.equilibriumLine ?? 0.6;
        this.accumulationRate = 0.002 * intensity;
        this.ablationRate = 0.003 * intensity;
        this.flowCoeff = 0.01 * intensity;
        this.abrasionCoeff = 0.0005 * intensity;
        this.quarryCoeff = 0.0002 * intensity;
        this.glenExponent = 3;
        this.numSteps = Math.floor(20 + intensity * 40);

        // Initialize layers
        this.bedrock = new Float32Array(heightmapData.data);
        this.ice = new Float32Array(this.width * this.height);
        this.moraine = new Float32Array(this.width * this.height);

        // Seed initial ice above equilibrium line
        for (let i = 0; i < this.bedrock.length; i++) {
            if (this.bedrock[i] > this.equilibriumLine) {
                this.ice[i] = (this.bedrock[i] - this.equilibriumLine) * 0.3;
            }
        }
    }

    private nextRandom(): number {
        this.rngState = (this.rngState * 9301 + 49297) % 233280;
        return this.rngState / 233280;
    }

    /**
     * Get surface height (bedrock + ice + moraine)
     */
    private getSurface(idx: number): number {
        return this.bedrock[idx] + this.ice[idx] + this.moraine[idx];
    }

    /**
     * Single simulation step
     */
    private step(): void {
        const w = this.width;
        const h = this.height;

        // --- 1. Accumulation / Ablation ---
        for (let i = 0; i < this.bedrock.length; i++) {
            const surface = this.getSurface(i);
            if (surface > this.equilibriumLine) {
                // Above snowline: accumulate
                this.ice[i] += this.accumulationRate;
            } else if (this.ice[i] > 0) {
                // Below snowline: melt
                this.ice[i] = Math.max(0, this.ice[i] - this.ablationRate);

                // Deposit moraine where ice melts (glacier terminus)
                if (this.ice[i] <= 0.001) {
                    this.moraine[i] += 0.0005;
                }
            }
        }

        // --- 2. Ice flow (Shallow Ice Approximation) ---
        // velocity ∝ thickness^n * surface_slope^(n-1)
        // where n = Glen's exponent (~3)
        const newIce = new Float32Array(this.ice);

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = y * w + x;
                if (this.ice[idx] < 0.001) continue;

                const thickness = this.ice[idx];
                const surface = this.getSurface(idx);

                // Compute flow to all downhill neighbors proportionally
                const neighbors = [
                    { nx: x - 1, ny: y },
                    { nx: x + 1, ny: y },
                    { nx: x, ny: y - 1 },
                    { nx: x, ny: y + 1 },
                ];

                let totalFlow = 0;
                const flows: { idx: number; flow: number; slope: number }[] = [];

                for (const n of neighbors) {
                    if (n.nx < 0 || n.nx >= w || n.ny < 0 || n.ny >= h) continue;
                    const nIdx = n.ny * w + n.nx;
                    const nSurface = this.getSurface(nIdx);
                    const slope = surface - nSurface;

                    if (slope > 0.001) {
                        // Glen's flow law: speed ∝ H^n * slope^(n-1)
                        const flow = this.flowCoeff *
                            Math.pow(thickness, this.glenExponent) *
                            Math.pow(slope, this.glenExponent - 1);
                        flows.push({ idx: nIdx, flow, slope });
                        totalFlow += flow;
                    }
                }

                if (totalFlow < 0.0001) continue;

                // Cap total transfer to 30% of thickness
                const maxTransfer = thickness * 0.3;
                const scale = totalFlow > maxTransfer ? maxTransfer / totalFlow : 1.0;

                // Distribute ice proportionally
                for (const f of flows) {
                    const transfer = f.flow * scale;
                    newIce[idx] -= transfer;
                    newIce[f.idx] += transfer;
                }

                // Erosion: use average flow speed for this cell
                const avgSpeed = totalFlow * scale / Math.max(flows.length, 1);

                // --- 3. Erosion proportional to ice velocity × pressure ---
                if (avgSpeed > 0.0001 && flows.length > 0) {
                    const pressure = thickness * 0.917;
                    const abrasion = this.abrasionCoeff * avgSpeed * pressure;
                    const quarrying = this.quarryCoeff * avgSpeed * avgSpeed;
                    const totalErosion = abrasion + quarrying;

                    // Erode the current cell
                    this.bedrock[idx] = Math.max(0, this.bedrock[idx] - totalErosion);

                    // Determine dominant flow direction for perpendicular lateral erosion
                    let bestFlow = flows[0];
                    for (const f of flows) {
                        if (f.flow > bestFlow.flow) bestFlow = f;
                    }

                    // Compute flow direction vector
                    const flowDx = (bestFlow.idx % w) - x;
                    const flowDy = Math.floor(bestFlow.idx / w) - y;

                    // Perpendicular directions (rotate 90 degrees)
                    const laterals = [
                        { nx: x - flowDy, ny: y + flowDx },
                        { nx: x + flowDy, ny: y - flowDx },
                    ];

                    const lateralFactor = 0.3;
                    for (const lat of laterals) {
                        if (lat.nx < 0 || lat.nx >= w || lat.ny < 0 || lat.ny >= h) continue;
                        const latIdx = lat.ny * w + lat.nx;
                        if (this.bedrock[latIdx] > surface && this.ice[latIdx] < 0.001) {
                            this.bedrock[latIdx] -= totalErosion * lateralFactor;
                            this.bedrock[latIdx] = Math.max(0, this.bedrock[latIdx]);
                        }
                    }
                }
            }
        }

        // Apply ice changes
        for (let i = 0; i < this.ice.length; i++) {
            this.ice[i] = Math.max(0, newIce[i]);
        }
    }

    /**
     * Run glacial erosion simulation.
     */
    public erode(): HeightmapData {
        console.log(`Running glacial erosion for ${this.numSteps} steps (ELA=${this.equilibriumLine.toFixed(2)})...`);

        for (let i = 0; i < this.numSteps; i++) {
            if (i % 10 === 0) {
                console.log(`  Progress: ${((i / this.numSteps) * 100).toFixed(0)}%`);
            }
            this.step();
        }

        // Final heightmap = bedrock + moraine (ice has melted)
        const data = new Float32Array(this.width * this.height);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.max(0, this.bedrock[i] + this.moraine[i]);
        }

        console.log('  Glacial erosion complete.');

        return {
            width: this.width,
            height: this.height,
            data,
        };
    }
}
