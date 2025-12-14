/**
 * Terrain Loader - Loads pre-generated terrain heightmaps and metadata
 */

export interface TerrainMetadata {
    planet: string;
    type: string;
    generation: {
        resolution: number;
        terrainScale: number;
        roughness: number;
        erosionIntensity: number;
        generationTime: number;
    };
    heightmap: {
        min: number;
        max: number;
        avg: number;
    };
    config: {
        gravity: number;
        hasAtmosphere: boolean;
        hasWater: boolean;
        temperature: number;
        hasBiomes: boolean;
    };
    files: {
        heightmap: string;
        normalmap: string | null;
    };
}

export interface LoadedTerrain {
    heightmap: Float32Array;
    width: number;
    height: number;
    metadata: TerrainMetadata;
    normalmap: HTMLImageElement | null;
}

/**
 * Load pre-generated terrain for a planet
 */
export async function loadPreGeneratedTerrain(planetName: string): Promise<LoadedTerrain> {
    const basePath = `/terrains/${planetName}`;

    // Load metadata first
    const metadataResponse = await fetch(`${basePath}/metadata.json`);
    if (!metadataResponse.ok) {
        throw new Error(`Failed to load terrain metadata for ${planetName}`);
    }
    const metadata: TerrainMetadata = await metadataResponse.json();

    // Load heightmap PNG
    const heightmapResponse = await fetch(`${basePath}/heightmap.png`);
    if (!heightmapResponse.ok) {
        throw new Error(`Failed to load heightmap for ${planetName}`);
    }

    const blob = await heightmapResponse.blob();
    const heightmapData = await decodeHeightmapPNG(blob, metadata);

    // Load normalmap if available
    let normalmap: HTMLImageElement | null = null;
    if (metadata.files.normalmap) {
        try {
            normalmap = await loadImage(`${basePath}/normalmap.png`);
        } catch (e) {
            console.warn(`Failed to load normalmap for ${planetName}:`, e);
        }
    }

    return {
        heightmap: heightmapData,
        width: metadata.generation.resolution,
        height: metadata.generation.resolution,
        metadata,
        normalmap,
    };
}

/**
 * Load an image as HTMLImageElement
 */
function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
    });
}

/**
 * Decode 16-bit grayscale PNG heightmap to Float32Array
 *
 * Note: Browser Canvas API only supports 8-bit per channel. For true 16-bit support,
 * the terrain generator outputs 16-bit values encoded as R (high byte) + G (low byte).
 * This function reads both channels and reconstructs the 16-bit value.
 */
async function decodeHeightmapPNG(blob: Blob, metadata: TerrainMetadata): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const data = imageData.data;

                const heightmap = new Float32Array(img.width * img.height);
                const min = metadata.heightmap.min;
                const max = metadata.heightmap.max;
                const range = max - min;

                for (let i = 0; i < heightmap.length; i++) {
                    const pixelIdx = i * 4;
                    const r = data[pixelIdx];
                    const g = data[pixelIdx + 1];

                    // Check if R and G are different (16-bit encoded as R=high, G=low)
                    // If they're the same, it's a standard 8-bit grayscale
                    let normalized: number;
                    if (r === g) {
                        // 8-bit grayscale (fallback)
                        normalized = r / 255;
                    } else {
                        // 16-bit encoded: R = high byte, G = low byte
                        const value16 = (r << 8) | g;
                        normalized = value16 / 65535;
                    }

                    heightmap[i] = min + normalized * range;
                }

                // Clean up blob URL
                URL.revokeObjectURL(img.src);
                resolve(heightmap);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error('Failed to load heightmap image'));
        };

        img.src = URL.createObjectURL(blob);
    });
}

/**
 * Check if pre-generated terrain exists for a planet
 */
export async function hasPreGeneratedTerrain(planetName: string): Promise<boolean> {
    try {
        const response = await fetch(`/terrains/${planetName}/metadata.json`, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}
