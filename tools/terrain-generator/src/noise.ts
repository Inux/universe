import { createNoise2D, createNoise3D, type NoiseFunction2D, type NoiseFunction3D } from 'simplex-noise';

/**
 * Noise generator with multiple octaves (Fractal Brownian Motion)
 */
export class NoiseGenerator {
    private noise2D: NoiseFunction2D;
    private noise3D: NoiseFunction3D;

    constructor(seed: number = Math.random()) {
        const alea = this.createSeededRandom(seed);
        this.noise2D = createNoise2D(alea);
        this.noise3D = createNoise3D(alea);
    }

    /**
     * Seeded random number generator
     */
    private createSeededRandom(seed: number): () => number {
        return () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    /**
     * Fractal Brownian Motion - combines multiple octaves of noise
     */
    public fbm(x: number, y: number, octaves: number = 8, persistence: number = 0.5, lacunarity: number = 2.0): number {
        let total = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += amplitude * this.noise2D(x * frequency, y * frequency);
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return total / maxValue;
    }

    /**
     * Ridged multifractal noise - creates sharp ridges (good for mountains)
     */
    public ridgedMultifractal(x: number, y: number, octaves: number = 8, persistence: number = 0.5): number {
        let total = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            let signal = this.noise2D(x * frequency, y * frequency);
            signal = 1.0 - Math.abs(signal); // Create ridges
            signal = signal * signal; // Square for sharper ridges
            total += signal * amplitude;
            maxValue += amplitude; // Track max possible value for normalization
            amplitude *= persistence;
            frequency *= 2.0;
        }

        return total / maxValue;
    }

    /**
     * Billow noise - creates puffy, cloud-like formations
     */
    public billow(x: number, y: number, octaves: number = 6, persistence: number = 0.5): number {
        let total = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            let signal = this.noise2D(x * frequency, y * frequency);
            signal = Math.abs(signal); // Take absolute value for billow effect
            total += signal * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2.0;
        }

        return total / maxValue;
    }

    /**
     * Domain warping - distorts the noise using itself for more organic patterns
     */
    public domainWarped(x: number, y: number, warpStrength: number = 0.5): number {
        const warpX = this.fbm(x, y, 4);
        const warpY = this.fbm(x + 5.2, y + 1.3, 4);

        return this.fbm(
            x + warpX * warpStrength,
            y + warpY * warpStrength,
            8
        );
    }

    /**
     * Voronoi-like cellular noise (for crater-like formations)
     */
    public cellular(x: number, y: number, cellSize: number = 10): number {
        const ix = Math.floor(x / cellSize);
        const iy = Math.floor(y / cellSize);

        let minDistSq = Infinity;
        const maxDistSq = (cellSize * 1.5) * (cellSize * 1.5);

        // Check 3x3 grid of cells
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const cellX = (ix + dx) * cellSize;
                const cellY = (iy + dy) * cellSize;

                // Random point within cell (hash returns 0-1, multiply by cellSize for offset)
                const seed = (cellX * 73856093) ^ (cellY * 19349663);
                const pointX = cellX + this.hash(seed) * cellSize;
                const pointY = cellY + this.hash(seed + 1) * cellSize;

                const ddx = x - pointX;
                const ddy = y - pointY;
                const distSq = ddx * ddx + ddy * ddy;
                if (distSq < minDistSq) minDistSq = distSq;
            }
        }

        return 1.0 - Math.min(Math.sqrt(minDistSq / maxDistSq), 1.0);
    }

    /**
     * Simple hash function for cellular noise
     */
    private hash(n: number): number {
        n = (n << 13) ^ n;
        return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 2147483648.0;
    }

    /**
     * Turbulence - absolute value for chaotic patterns
     */
    public turbulence(x: number, y: number, octaves: number = 6): number {
        let total = 0;
        let amplitude = 1;
        let frequency = 1;

        for (let i = 0; i < octaves; i++) {
            total += Math.abs(this.noise2D(x * frequency, y * frequency)) * amplitude;
            amplitude *= 0.5;
            frequency *= 2.0;
        }

        return total;
    }

    /**
     * Swiss Turbulence noise - derivative-based erosion-like terrain.
     * Suppresses fine detail in valleys (where derivatives are large) while
     * preserving crisp ridgelines on peaks. Produces naturally rounded peaks
     * instead of the knife-edge artifacts from ridgedMultifractal.
     * Based on Giliam de Carpentier's Scape procedural extensions.
     */
    public swissTurbulence(
        x: number, y: number,
        octaves: number = 8,
        lacunarity: number = 2.0,
        gain: number = 0.5,
        warp: number = 0.15
    ): number {
        let sum = 0;
        let freq = 1.0;
        let amp = 1.0;
        let maxAmp = 0;
        let dsumX = 0;
        let dsumY = 0;

        const epsilon = 0.001;

        for (let i = 0; i < octaves; i++) {
            // Warp input coordinates by accumulated derivatives
            const nx = (x + dsumX * warp) * freq;
            const ny = (y + dsumY * warp) * freq;

            // Get noise value
            const n = this.noise2D(nx, ny);

            // Compute pseudo-derivatives via central differences
            const dx = this.noise2D(nx + epsilon, ny) - this.noise2D(nx - epsilon, ny);
            const dy = this.noise2D(nx, ny + epsilon) - this.noise2D(nx, ny - epsilon);

            // Accumulate derivatives
            dsumX += dx * amp;
            dsumY += dy * amp;

            // Key insight: divide by (1 + dot(dsum, dsum))
            // Suppresses detail on slopes, preserves on peaks/ridges
            sum += amp * n / (1 + dsumX * dsumX + dsumY * dsumY);
            maxAmp += amp;

            freq *= lacunarity;
            amp *= gain;
        }

        return sum / maxAmp;
    }

    /**
     * Hybrid Multifractal noise - smoothly transitions between fBm (smooth) at
     * low elevations and ridged multifractal (rough) at high elevations.
     * Creates realistic terrain where lowlands are gentle and highlands are rugged.
     * Based on Musgrave's foundational fractal terrain work.
     */
    public hybridMultifractal(
        x: number, y: number,
        octaves: number = 8,
        persistence: number = 0.25,
        lacunarity: number = 2.0,
        offset: number = 0.7
    ): number {
        let freq = 1.0;
        let amp = 1.0;

        // First octave - unweighted
        let result = (this.noise2D(x * freq, y * freq) + offset) * amp;
        let weight = result;
        freq *= lacunarity;

        for (let i = 1; i < octaves; i++) {
            // Clamp weight to [0, 1]
            weight = Math.min(weight, 1.0);

            const signal = (this.noise2D(x * freq, y * freq) + offset) * amp;

            // Weight controls how much this octave contributes
            // High areas (weight > 1) get full detail
            // Low areas (weight < 1) get smoothed
            result += weight * signal;
            weight *= signal;

            freq *= lacunarity;
            amp *= persistence;
        }

        // Normalize to roughly -1 to 1 range, clamped to guarantee bounds
        return Math.max(-1, Math.min(1, result * 0.5 - 0.5));
    }
}
