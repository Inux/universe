import type { HeightmapData } from './types.js';

/**
 * Aeolian (wind) erosion simulation.
 * Simulates sand transport by wind to create dunes, deflation hollows,
 * and wind-sculpted bedrock formations.
 *
 * Key processes:
 * - Saltation: sand grains bounce along surface, picked up by wind
 * - Abrasion: sand particles grind exposed bedrock
 * - Wind shadow: terrain shelters lee side from wind, causing deposition
 * - Cascading: loose sand maintains angle of repose
 *
 * Based on "Desertscape Simulation" (CGF 2019) and Nick McDonald's
 * particle-based wind erosion approach.
 */
export class AeolianErosion {
    private width: number;
    private height: number;
    private bedrock: Float32Array;   // Hard rock layer (erodes slowly)
    private sand: Float32Array;      // Loose sand layer (moves freely)

    // Wind parameters
    private windDirX: number;
    private windDirY: number;
    private windSpeed: number;

    // Erosion parameters
    private pickupRate = 0.002;       // How fast sand is picked up
    private depositRate = 0.4;        // How fast sand is deposited
    private abrasionRate = 0.0001;    // How fast bedrock is worn down
    private suspensionRate = 0.15;    // Fraction of capacity carried as suspended load
    private shadowAngle = 0.4;        // Angle threshold for wind shadow
    private shadowRange = 20;         // How far wind shadow extends (cells)
    private sandAngleOfRepose = 0.6;  // Max stable slope for loose sand

    // Seeded PRNG
    private rngState: number;

    constructor(
        heightmapData: HeightmapData,
        options: {
            windAngle?: number;      // Wind direction in radians (0 = +X)
            windSpeed?: number;      // Wind intensity multiplier
            sandFraction?: number;   // Initial fraction of terrain that is loose sand (0-1)
            seed?: number;
        } = {}
    ) {
        this.width = heightmapData.width;
        this.height = heightmapData.height;
        this.rngState = options.seed ?? 73;

        const windAngle = options.windAngle ?? 0.3; // Default slight angle
        this.windDirX = Math.cos(windAngle);
        this.windDirY = Math.sin(windAngle);
        this.windSpeed = options.windSpeed ?? 1.0;

        // Split terrain into bedrock and sand layers
        const sandFraction = options.sandFraction ?? 0.15;
        this.bedrock = new Float32Array(heightmapData.data.length);
        this.sand = new Float32Array(heightmapData.data.length);

        for (let i = 0; i < heightmapData.data.length; i++) {
            const totalHeight = heightmapData.data[i];
            // Sand is a fraction of the surface — more sand at lower elevations
            const elevationFactor = 1.0 - totalHeight * 0.5;
            const sandDepth = totalHeight * sandFraction * elevationFactor;
            this.sand[i] = sandDepth;
            this.bedrock[i] = totalHeight - sandDepth;
        }
    }

    private nextRandom(): number {
        this.rngState = (this.rngState * 9301 + 49297) % 233280;
        return this.rngState / 233280;
    }

    /**
     * Get total height (bedrock + sand) at a position with bounds checking
     */
    private getTotalHeight(x: number, y: number): number {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
        const idx = y * this.width + x;
        return this.bedrock[idx] + this.sand[idx];
    }

    /**
     * Calculate wind shadow factor at a position.
     * Traces a ray upwind to check if terrain blocks the wind.
     * Returns 0 = fully exposed, 1 = fully sheltered.
     */
    private getWindShadow(x: number, y: number): number {
        const baseHeight = this.getTotalHeight(x, y);
        let maxAngle = 0;

        // Trace upwind
        for (let d = 1; d <= this.shadowRange; d++) {
            const sx = Math.round(x - this.windDirX * d);
            const sy = Math.round(y - this.windDirY * d);

            if (sx < 0 || sx >= this.width || sy < 0 || sy >= this.height) break;

            const upwindHeight = this.getTotalHeight(sx, sy);
            const heightDiff = upwindHeight - baseHeight;
            const angle = heightDiff / d;

            if (angle > maxAngle) {
                maxAngle = angle;
            }
        }

        return Math.min(1.0, Math.max(0, maxAngle / this.shadowAngle));
    }

    /**
     * Cascade sand to maintain angle of repose.
     * When sand piles too steeply, it avalanches to neighbors.
     */
    private cascade(cx: number, cy: number): void {
        const idx = cy * this.width + cx;
        const centerHeight = this.bedrock[idx] + this.sand[idx];

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;

                const nx = cx + dx;
                const ny = cy + dy;
                if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

                const nIdx = ny * this.width + nx;
                const neighborHeight = this.bedrock[nIdx] + this.sand[nIdx];
                const dist = Math.sqrt(dx * dx + dy * dy);
                const diff = centerHeight - neighborHeight;
                const slope = diff / dist;

                if (slope > this.sandAngleOfRepose && this.sand[idx] > 0) {
                    // Transfer sand downhill to reach angle of repose
                    const excess = (slope - this.sandAngleOfRepose) * dist * 0.5;
                    const transfer = Math.min(excess, this.sand[idx] * 0.5);
                    this.sand[idx] -= transfer;
                    this.sand[nIdx] += transfer;
                }
            }
        }
    }

    /**
     * Simulate a single wind particle traversing the terrain.
     */
    private simulateWindParticle(): void {
        // Start at windward edge with some randomness
        let x: number, y: number;
        if (Math.abs(this.windDirX) > Math.abs(this.windDirY)) {
            // Wind mostly horizontal
            x = this.windDirX > 0 ? 0 : this.width - 1;
            y = Math.floor(this.nextRandom() * this.height);
        } else {
            // Wind mostly vertical
            x = Math.floor(this.nextRandom() * this.width);
            y = this.windDirY > 0 ? 0 : this.height - 1;
        }

        let sediment = 0;
        let speed = this.windSpeed;
        const maxSteps = Math.max(this.width, this.height) * 1.5;

        for (let step = 0; step < maxSteps; step++) {
            const ix = Math.round(x);
            const iy = Math.round(y);

            if (ix < 1 || ix >= this.width - 1 || iy < 1 || iy >= this.height - 1) break;

            const idx = iy * this.width + ix;
            const shelter = this.getWindShadow(ix, iy);

            // Pickup: exposed areas lose sand
            if (shelter < 0.3 && this.sand[idx] > 0.001) {
                const pickup = Math.min(
                    this.sand[idx] * 0.5,
                    this.pickupRate * speed * (1 - shelter)
                );
                this.sand[idx] -= pickup;
                sediment += pickup;
            }

            // Deposition: sheltered areas receive sand
            if (shelter > 0.3 || sediment > this.suspensionRate * speed) {
                const deposit = sediment * this.depositRate * shelter;
                this.sand[idx] += deposit;
                sediment -= deposit;
            }

            // Abrasion: sand-laden wind grinds exposed bedrock
            if (sediment > 0.001 && this.sand[idx] < 0.005 && speed > 0.3) {
                const abrasion = this.abrasionRate * sediment * speed;
                this.bedrock[idx] -= abrasion;
                this.sand[idx] += abrasion * 0.5; // Some abraded material becomes sand
            }

            // Cascade at this point to maintain angle of repose
            this.cascade(ix, iy);

            // Advance particle downwind with slight turbulence
            const turbulence = (this.nextRandom() - 0.5) * 0.3;
            x += this.windDirX + turbulence * this.windDirY;
            y += this.windDirY - turbulence * this.windDirX;

            // Speed varies with terrain slope
            const aheadX = Math.round(x + this.windDirX);
            const aheadY = Math.round(y + this.windDirY);
            if (aheadX >= 0 && aheadX < this.width && aheadY >= 0 && aheadY < this.height) {
                const heightDiff = this.getTotalHeight(aheadX, aheadY) - this.getTotalHeight(ix, iy);
                speed = Math.max(0.2, speed - heightDiff * 2); // Slows going uphill
            }
        }
    }

    /**
     * Run aeolian erosion simulation.
     * @param numParticles Number of wind particles to simulate
     * @param cascadeIterations Extra global cascade passes for sand settling
     */
    public erode(numParticles: number = 30000, cascadeIterations: number = 3): HeightmapData {
        console.log(`Running aeolian erosion with ${numParticles} wind particles...`);

        for (let i = 0; i < numParticles; i++) {
            if (i % 5000 === 0) {
                console.log(`  Progress: ${((i / numParticles) * 100).toFixed(1)}%`);
            }
            this.simulateWindParticle();
        }

        // Global cascade passes to settle remaining unstable sand
        console.log(`  Running ${cascadeIterations} cascade passes...`);
        for (let pass = 0; pass < cascadeIterations; pass++) {
            for (let y = 1; y < this.height - 1; y++) {
                for (let x = 1; x < this.width - 1; x++) {
                    this.cascade(x, y);
                }
            }
        }

        // Recombine bedrock + sand into final heightmap
        const data = new Float32Array(this.width * this.height);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.max(0, this.bedrock[i] + this.sand[i]);
        }

        return {
            width: this.width,
            height: this.height,
            data,
        };
    }
}
