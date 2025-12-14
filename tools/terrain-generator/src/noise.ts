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

        for (let i = 0; i < octaves; i++) {
            let signal = this.noise2D(x * frequency, y * frequency);
            signal = 1.0 - Math.abs(signal); // Create ridges
            signal = signal * signal; // Square for sharper ridges
            total += signal * amplitude;
            amplitude *= persistence;
            frequency *= 2.0;
        }

        return total;
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

        let minDist = Infinity;

        // Check 3x3 grid of cells
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const cellX = (ix + dx) * cellSize;
                const cellY = (iy + dy) * cellSize;

                // Random point within cell
                const seed = (cellX * 73856093) ^ (cellY * 19349663);
                const pointX = cellX + (this.hash(seed) % cellSize);
                const pointY = cellY + (this.hash(seed + 1) % cellSize);

                const dist = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);
                minDist = Math.min(minDist, dist);
            }
        }

        return 1.0 - Math.min(minDist / (cellSize * 1.5), 1.0);
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
}
