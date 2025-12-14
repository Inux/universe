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

    constructor(heightmapData: HeightmapData) {
        this.width = heightmapData.width;
        this.height = heightmapData.height;
        this.heightmap = new Float32Array(heightmapData.data);
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
        // Random starting position
        let posX = Math.random() * (this.width - 1);
        let posY = Math.random() * (this.height - 1);

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
     * Erode at a position and return amount eroded
     */
    private erodeSediment(posX: number, posY: number, amount: number): number {
        const coordX = Math.floor(posX);
        const coordY = Math.floor(posY);

        // Distribute erosion in a circle around the point
        let totalEroded = 0;

        for (let dy = -this.erosionRadius; dy <= this.erosionRadius; dy++) {
            for (let dx = -this.erosionRadius; dx <= this.erosionRadius; dx++) {
                const x = coordX + dx;
                const y = coordY + dy;

                if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;

                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > this.erosionRadius) continue;

                const weight = 1 - dist / this.erosionRadius;
                const erodeAmount = amount * weight;

                const idx = y * this.width + x;
                const newHeight = this.heightmap[idx] - erodeAmount;
                // Prevent NaN corruption
                this.heightmap[idx] = isNaN(newHeight) ? this.heightmap[idx] : Math.max(0, newHeight);
                totalEroded += erodeAmount;
            }
        }

        return totalEroded;
    }

    /**
     * Deposit sediment at a position
     */
    private depositSediment(posX: number, posY: number, amount: number): void {
        const coordX = Math.floor(posX);
        const coordY = Math.floor(posY);

        for (let dy = -this.erosionRadius; dy <= this.erosionRadius; dy++) {
            for (let dx = -this.erosionRadius; dx <= this.erosionRadius; dx++) {
                const x = coordX + dx;
                const y = coordY + dy;

                if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;

                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > this.erosionRadius) continue;

                const weight = 1 - dist / this.erosionRadius;
                const depositAmount = amount * weight;

                const idx = y * this.width + x;
                const newHeight = this.heightmap[idx] + depositAmount;
                // Prevent NaN corruption
                this.heightmap[idx] = isNaN(newHeight) ? this.heightmap[idx] : newHeight;
            }
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
 */
export class ThermalErosion {
    private width: number;
    private height: number;
    private heightmap: Float32Array;
    private talusAngle: number = 0.7; // Maximum stable slope angle (in height/distance)

    constructor(heightmapData: HeightmapData) {
        this.width = heightmapData.width;
        this.height = heightmapData.height;
        this.heightmap = new Float32Array(heightmapData.data);
    }

    /**
     * Run thermal erosion simulation
     */
    public erode(numIterations: number = 10): HeightmapData {
        console.log(`Running thermal erosion for ${numIterations} iterations...`);

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
     * Single iteration of thermal erosion
     */
    private thermalStep(): void {
        const newHeightmap = new Float32Array(this.heightmap);

        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                const idx = y * this.width + x;
                const currentHeight = this.heightmap[idx];

                let totalDiff = 0;
                let count = 0;

                // Check 8 neighbors
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;

                        const nx = x + dx;
                        const ny = y + dy;
                        const nIdx = ny * this.width + nx;

                        const neighborHeight = this.heightmap[nIdx];
                        const diff = currentHeight - neighborHeight;

                        // If slope is too steep, erode
                        if (diff > this.talusAngle) {
                            totalDiff += diff;
                            count++;
                        }
                    }
                }

                if (count > 0) {
                    const avgDiff = totalDiff / count;
                    const transferAmount = avgDiff * 0.5; // Transfer half the excess

                    newHeightmap[idx] -= transferAmount;

                    // Distribute to lower neighbors
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;

                            const nx = x + dx;
                            const ny = y + dy;
                            const nIdx = ny * this.width + nx;

                            if (this.heightmap[nIdx] < currentHeight) {
                                newHeightmap[nIdx] += transferAmount / count;
                            }
                        }
                    }
                }
            }
        }

        this.heightmap = newHeightmap;
    }
}
