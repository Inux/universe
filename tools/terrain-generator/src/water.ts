import type { HeightmapData } from './types.js';

/**
 * Min-heap priority queue for efficient O(log n) operations
 */
class MinHeap {
    private data: Array<{ height: number; x: number; y: number }> = [];

    push(height: number, x: number, y: number): void {
        this.data.push({ height, x, y });
        this.bubbleUp(this.data.length - 1);
    }

    pop(): { height: number; x: number; y: number } | undefined {
        if (this.data.length === 0) return undefined;
        const result = this.data[0];
        const last = this.data.pop()!;
        if (this.data.length > 0) {
            this.data[0] = last;
            this.bubbleDown(0);
        }
        return result;
    }

    size(): number {
        return this.data.length;
    }

    private bubbleUp(idx: number): void {
        while (idx > 0) {
            const parentIdx = Math.floor((idx - 1) / 2);
            if (this.data[parentIdx].height <= this.data[idx].height) break;
            [this.data[parentIdx], this.data[idx]] = [this.data[idx], this.data[parentIdx]];
            idx = parentIdx;
        }
    }

    private bubbleDown(idx: number): void {
        const length = this.data.length;
        while (true) {
            const leftIdx = 2 * idx + 1;
            const rightIdx = 2 * idx + 2;
            let smallest = idx;

            if (leftIdx < length && this.data[leftIdx].height < this.data[smallest].height) {
                smallest = leftIdx;
            }
            if (rightIdx < length && this.data[rightIdx].height < this.data[smallest].height) {
                smallest = rightIdx;
            }
            if (smallest === idx) break;

            [this.data[idx], this.data[smallest]] = [this.data[smallest], this.data[idx]];
            idx = smallest;
        }
    }
}

/**
 * River path point with position and flow data
 */
export interface RiverPoint {
    x: number;
    y: number;
    flow: number; // Flow accumulation value
    width: number; // River width based on flow
}

/**
 * River path from source to mouth
 */
export interface RiverPath {
    id: number;
    points: RiverPoint[];
    sourceX: number;
    sourceY: number;
    mouthX: number;
    mouthY: number;
    totalLength: number;
    maxFlow: number;
}

/**
 * Lake/ocean body data
 */
export interface WaterBody {
    id: number;
    type: 'lake' | 'ocean';
    waterLevel: number;
    area: number; // Number of cells
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    coastlinePoints: Array<{ x: number; y: number }>;
}

/**
 * Complete water system data for a terrain
 */
export interface WaterSystemData {
    rivers: RiverPath[];
    waterBodies: WaterBody[];
    waterMask: Uint8Array; // 0 = land, 1 = river, 2 = lake, 3 = ocean
    flowAccumulation: Float32Array;
    seaLevel: number;
}

/**
 * Water system generator using watershed analysis and flow accumulation
 */
export class WaterSystemGenerator {
    private width: number;
    private height: number;
    private heightmap: Float32Array;
    private flowDirection: Int8Array;
    private flowAccumulation: Float32Array;
    private waterMask: Uint8Array;

    // D8 flow direction encoding (8 directions)
    private static readonly DX = [1, 1, 0, -1, -1, -1, 0, 1];
    private static readonly DY = [0, 1, 1, 1, 0, -1, -1, -1];

    // Parameters
    private riverThreshold: number;
    private seaLevel: number;
    private minRiverLength: number;
    private valleyCarveDepth: number;
    private valleyCarveWidth: number;

    constructor(
        heightmapData: HeightmapData,
        options: {
            riverThreshold?: number;
            seaLevel?: number;
            minRiverLength?: number;
            valleyCarveDepth?: number;
            valleyCarveWidth?: number;
        } = {}
    ) {
        this.width = heightmapData.width;
        this.height = heightmapData.height;
        this.heightmap = new Float32Array(heightmapData.data);

        // Initialize arrays
        this.flowDirection = new Int8Array(this.width * this.height).fill(-1);
        this.flowAccumulation = new Float32Array(this.width * this.height).fill(1);
        this.waterMask = new Uint8Array(this.width * this.height).fill(0);

        // Parameters with defaults
        this.riverThreshold = options.riverThreshold ?? 500; // Min flow for river
        this.seaLevel = options.seaLevel ?? 0.3; // Sea level as fraction of height range
        this.minRiverLength = options.minRiverLength ?? 50; // Min river length in cells
        this.valleyCarveDepth = options.valleyCarveDepth ?? 0.02; // How deep to carve valleys
        this.valleyCarveWidth = options.valleyCarveWidth ?? 8; // Valley width in cells
    }

    /**
     * Generate complete water system
     */
    public generate(): { heightmap: HeightmapData; waterData: WaterSystemData } {
        console.log('  Generating water systems...');

        // Step 1: Fill depressions (pit removal) for proper flow
        console.log('    Step 1: Filling terrain depressions...');
        this.fillDepressions();

        // Step 2: Calculate flow directions (D8 algorithm)
        console.log('    Step 2: Calculating flow directions...');
        this.calculateFlowDirections();

        // Step 3: Calculate flow accumulation
        console.log('    Step 3: Calculating flow accumulation...');
        this.calculateFlowAccumulation();

        // Step 4: Extract river paths
        console.log('    Step 4: Extracting river paths...');
        const rivers = this.extractRivers();

        // Step 5: Carve river valleys into heightmap
        console.log('    Step 5: Carving river valleys...');
        this.carveRiverValleys(rivers);

        // Step 6: Detect water bodies (lakes and oceans)
        console.log('    Step 6: Detecting water bodies...');
        const waterBodies = this.detectWaterBodies();

        // Step 7: Detect coastlines
        console.log('    Step 7: Detecting coastlines...');
        this.detectCoastlines(waterBodies);

        console.log(`    ✓ Water systems complete: ${rivers.length} rivers, ${waterBodies.length} water bodies`);

        return {
            heightmap: {
                width: this.width,
                height: this.height,
                data: this.heightmap,
            },
            waterData: {
                rivers,
                waterBodies,
                waterMask: this.waterMask,
                flowAccumulation: this.flowAccumulation,
                seaLevel: this.seaLevel,
            },
        };
    }

    /**
     * Fill depressions using priority-flood algorithm
     * This ensures water can flow to edges without getting stuck in pits
     */
    private fillDepressions(): void {
        const filled = new Float32Array(this.heightmap);
        const visited = new Uint8Array(this.width * this.height);

        // Min-heap priority queue for O(log n) insertion
        const heap = new MinHeap();

        // Initialize with edge cells
        for (let x = 0; x < this.width; x++) {
            const topIdx = x;
            const bottomIdx = (this.height - 1) * this.width + x;
            heap.push(this.heightmap[topIdx], x, 0);
            heap.push(this.heightmap[bottomIdx], x, this.height - 1);
            visited[topIdx] = 1;
            visited[bottomIdx] = 1;
        }
        for (let y = 1; y < this.height - 1; y++) {
            const leftIdx = y * this.width;
            const rightIdx = y * this.width + this.width - 1;
            heap.push(this.heightmap[leftIdx], 0, y);
            heap.push(this.heightmap[rightIdx], this.width - 1, y);
            visited[leftIdx] = 1;
            visited[rightIdx] = 1;
        }

        // Process cells in order of increasing height
        while (heap.size() > 0) {
            const { height, x, y } = heap.pop()!;

            // Process neighbors
            for (let d = 0; d < 8; d++) {
                const nx = x + WaterSystemGenerator.DX[d];
                const ny = y + WaterSystemGenerator.DY[d];

                if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

                const nIdx = ny * this.width + nx;
                if (visited[nIdx]) continue;

                visited[nIdx] = 1;

                // Fill if neighbor is lower than current cell
                const neighborHeight = this.heightmap[nIdx];
                if (neighborHeight < height) {
                    filled[nIdx] = height;
                } else {
                    filled[nIdx] = neighborHeight;
                }

                heap.push(filled[nIdx], nx, ny);
            }
        }

        this.heightmap = filled;
    }

    /**
     * Calculate D8 flow directions
     * Each cell flows to its steepest downhill neighbor
     */
    private calculateFlowDirections(): void {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                const currentHeight = this.heightmap[idx];

                let steepestDir = -1;
                let steepestSlope = 0;

                for (let d = 0; d < 8; d++) {
                    const nx = x + WaterSystemGenerator.DX[d];
                    const ny = y + WaterSystemGenerator.DY[d];

                    if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

                    const nIdx = ny * this.width + nx;
                    const neighborHeight = this.heightmap[nIdx];

                    // Calculate slope (diagonal cells are further away)
                    const distance = (d % 2 === 0) ? 1 : Math.SQRT2;
                    const slope = (currentHeight - neighborHeight) / distance;

                    if (slope > steepestSlope) {
                        steepestSlope = slope;
                        steepestDir = d;
                    }
                }

                this.flowDirection[idx] = steepestDir;
            }
        }
    }

    /**
     * Calculate flow accumulation using topological sort
     * Optimized: uses typed arrays and avoids dynamic array allocation
     */
    private calculateFlowAccumulation(): void {
        const totalCells = this.width * this.height;

        // Count how many cells flow into each cell (in-degree)
        const inDegree = new Uint8Array(totalCells);

        for (let i = 0; i < totalCells; i++) {
            const dir = this.flowDirection[i];
            if (dir >= 0) {
                const x = i % this.width;
                const y = Math.floor(i / this.width);
                const nx = x + WaterSystemGenerator.DX[dir];
                const ny = y + WaterSystemGenerator.DY[dir];

                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    inDegree[ny * this.width + nx]++;
                }
            }
        }

        // Queue cells with no upstream (sources) - pre-allocate max size
        const queue = new Uint32Array(totalCells);
        let queueHead = 0;
        let queueTail = 0;

        for (let i = 0; i < totalCells; i++) {
            if (inDegree[i] === 0) {
                queue[queueTail++] = i;
            }
        }

        // Process in topological order
        while (queueHead < queueTail) {
            const idx = queue[queueHead++];
            const dir = this.flowDirection[idx];

            if (dir >= 0) {
                const x = idx % this.width;
                const y = Math.floor(idx / this.width);
                const nx = x + WaterSystemGenerator.DX[dir];
                const ny = y + WaterSystemGenerator.DY[dir];

                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    const nIdx = ny * this.width + nx;
                    this.flowAccumulation[nIdx] += this.flowAccumulation[idx];

                    if (--inDegree[nIdx] === 0) {
                        queue[queueTail++] = nIdx;
                    }
                }
            }
        }
    }

    /**
     * Extract river paths from flow accumulation
     */
    private extractRivers(): RiverPath[] {
        const rivers: RiverPath[] = [];
        const visited = new Uint8Array(this.width * this.height);

        // Find river starting points (high flow cells not already part of a river)
        const candidates: Array<{ idx: number; flow: number }> = [];

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                if (this.flowAccumulation[idx] >= this.riverThreshold) {
                    candidates.push({ idx, flow: this.flowAccumulation[idx] });
                }
            }
        }

        // Sort by flow (descending) to start with major rivers
        candidates.sort((a, b) => b.flow - a.flow);

        let riverId = 0;

        for (const candidate of candidates) {
            const startIdx = candidate.idx;
            if (visited[startIdx]) continue;

            // Trace river path downstream
            const points: RiverPoint[] = [];
            let currentIdx = startIdx;
            let maxFlow = 0;

            while (currentIdx >= 0 && !visited[currentIdx]) {
                const x = currentIdx % this.width;
                const y = Math.floor(currentIdx / this.width);
                const flow = this.flowAccumulation[currentIdx];

                // Only include cells above river threshold
                if (flow < this.riverThreshold) break;

                visited[currentIdx] = 1;
                this.waterMask[currentIdx] = 1; // Mark as river

                // Calculate river width based on flow
                const width = Math.min(20, 1 + Math.log2(flow / this.riverThreshold) * 2);

                points.push({ x, y, flow, width });
                maxFlow = Math.max(maxFlow, flow);

                // Move to next cell
                const dir = this.flowDirection[currentIdx];
                if (dir < 0) break;

                const nx = x + WaterSystemGenerator.DX[dir];
                const ny = y + WaterSystemGenerator.DY[dir];

                if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) break;

                currentIdx = ny * this.width + nx;
            }

            // Only keep rivers above minimum length
            if (points.length >= this.minRiverLength) {
                // Calculate total length
                let totalLength = 0;
                for (let i = 1; i < points.length; i++) {
                    const dx = points[i].x - points[i - 1].x;
                    const dy = points[i].y - points[i - 1].y;
                    totalLength += Math.sqrt(dx * dx + dy * dy);
                }

                rivers.push({
                    id: riverId++,
                    points,
                    sourceX: points[0].x,
                    sourceY: points[0].y,
                    mouthX: points[points.length - 1].x,
                    mouthY: points[points.length - 1].y,
                    totalLength,
                    maxFlow,
                });
            }
        }

        return rivers;
    }

    /**
     * Carve river valleys into the heightmap
     */
    private carveRiverValleys(rivers: RiverPath[]): void {
        for (const river of rivers) {
            for (const point of river.points) {
                const carveRadius = Math.ceil(point.width * this.valleyCarveWidth / 4);
                const centerIdx = point.y * this.width + point.x;
                const centerHeight = this.heightmap[centerIdx];

                // Carve a V-shaped valley
                for (let dy = -carveRadius; dy <= carveRadius; dy++) {
                    for (let dx = -carveRadius; dx <= carveRadius; dx++) {
                        const nx = point.x + dx;
                        const ny = point.y + dy;

                        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > carveRadius) continue;

                        const nIdx = ny * this.width + nx;

                        // V-shaped profile: deeper in center, shallower at edges
                        const depthFactor = 1 - (dist / carveRadius);
                        const carveAmount = this.valleyCarveDepth * depthFactor * (point.flow / river.maxFlow);

                        this.heightmap[nIdx] = Math.max(0, this.heightmap[nIdx] - carveAmount);
                    }
                }
            }
        }
    }

    /**
     * Detect water bodies (lakes and oceans) based on sea level
     */
    private detectWaterBodies(): WaterBody[] {
        const waterBodies: WaterBody[] = [];
        const visited = new Uint8Array(this.width * this.height);

        let bodyId = 0;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;

                // Skip if already visited or above sea level
                if (visited[idx] || this.heightmap[idx] > this.seaLevel) continue;

                // Flood fill to find connected water body
                const body = this.floodFillWaterBody(x, y, visited, bodyId);
                if (body) {
                    waterBodies.push(body);
                    bodyId++;
                }
            }
        }

        return waterBodies;
    }

    /**
     * Flood fill to find a connected water body
     * Optimized: uses index-based queue iteration instead of shift()
     */
    private floodFillWaterBody(
        startX: number,
        startY: number,
        visited: Uint8Array,
        bodyId: number
    ): WaterBody | null {
        // Use typed array for queue with index-based iteration
        const maxQueueSize = this.width * this.height;
        const queueX = new Uint16Array(maxQueueSize);
        const queueY = new Uint16Array(maxQueueSize);
        let queueHead = 0;
        let queueTail = 0;

        queueX[queueTail] = startX;
        queueY[queueTail] = startY;
        queueTail++;

        // Track cells as indices for efficiency
        const cellIndices: number[] = [];

        let minX = startX, maxX = startX;
        let minY = startY, maxY = startY;
        let touchesEdge = false;

        while (queueHead < queueTail) {
            const x = queueX[queueHead];
            const y = queueY[queueHead];
            queueHead++;

            const idx = y * this.width + x;

            if (visited[idx]) continue;
            if (this.heightmap[idx] > this.seaLevel) continue;

            visited[idx] = 1;
            cellIndices.push(idx);

            // Update bounds
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            // Check if touches edge (ocean)
            if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
                touchesEdge = true;
            }

            // Mark as lake or ocean in water mask (will update later if needed)
            this.waterMask[idx] = 2;

            // Add neighbors
            for (let d = 0; d < 8; d++) {
                const nx = x + WaterSystemGenerator.DX[d];
                const ny = y + WaterSystemGenerator.DY[d];

                if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

                const nIdx = ny * this.width + nx;
                if (!visited[nIdx] && this.heightmap[nIdx] <= this.seaLevel) {
                    queueX[queueTail] = nx;
                    queueY[queueTail] = ny;
                    queueTail++;
                }
            }
        }

        // Minimum size for water bodies
        if (cellIndices.length < 100) return null;

        // Update water mask type based on final determination
        const waterType = touchesEdge ? 3 : 2;
        for (const idx of cellIndices) {
            this.waterMask[idx] = waterType;
        }

        return {
            id: bodyId,
            type: touchesEdge ? 'ocean' : 'lake',
            waterLevel: this.seaLevel,
            area: cellIndices.length,
            minX,
            minY,
            maxX,
            maxY,
            coastlinePoints: [], // Will be filled by detectCoastlines
        };
    }

    /**
     * Detect coastline points for each water body
     * Optimized: uses direct array indexing instead of find()
     */
    private detectCoastlines(waterBodies: WaterBody[]): void {
        if (waterBodies.length === 0) return;

        // Create lookup array for O(1) body access by ID
        const bodyById: WaterBody[] = [];
        for (const body of waterBodies) {
            bodyById[body.id] = body;
        }

        // Create a map of water body ID by cell using flood fill results
        // We'll assign body IDs during a single pass
        const bodyMap = new Int16Array(this.width * this.height).fill(-1);

        // Assign body IDs based on bounds check (simplified - assumes non-overlapping)
        for (let i = 0; i < waterBodies.length; i++) {
            const body = waterBodies[i];
            for (let y = body.minY; y <= body.maxY; y++) {
                for (let x = body.minX; x <= body.maxX; x++) {
                    const idx = y * this.width + x;
                    if (this.waterMask[idx] >= 2 && this.heightmap[idx] <= body.waterLevel) {
                        bodyMap[idx] = body.id;
                    }
                }
            }
        }

        // Find coastline points (water cells adjacent to land)
        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                const idx = y * this.width + x;
                const bodyId = bodyMap[idx];

                if (bodyId < 0) continue;

                // Check if adjacent to land (unrolled for performance)
                const rowAbove = (y - 1) * this.width;
                const rowCurrent = y * this.width;
                const rowBelow = (y + 1) * this.width;

                if (this.waterMask[rowAbove + x - 1] === 0 ||
                    this.waterMask[rowAbove + x] === 0 ||
                    this.waterMask[rowAbove + x + 1] === 0 ||
                    this.waterMask[rowCurrent + x - 1] === 0 ||
                    this.waterMask[rowCurrent + x + 1] === 0 ||
                    this.waterMask[rowBelow + x - 1] === 0 ||
                    this.waterMask[rowBelow + x] === 0 ||
                    this.waterMask[rowBelow + x + 1] === 0) {
                    bodyById[bodyId].coastlinePoints.push({ x, y });
                }
            }
        }
    }

    /**
     * Get the water mask for runtime rendering
     */
    public getWaterMask(): Uint8Array {
        return this.waterMask;
    }

    /**
     * Get flow accumulation data
     */
    public getFlowAccumulation(): Float32Array {
        return this.flowAccumulation;
    }
}
