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

    return {
        heightmap: heightmapData,
        width: metadata.generation.resolution,
        height: metadata.generation.resolution,
        metadata,
    };
}

/**
 * Decode 16-bit grayscale PNG heightmap to Float32Array
 */
async function decodeHeightmapPNG(blob: Blob, metadata: TerrainMetadata): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                // Create canvas to read pixel data
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // Draw image to canvas
                ctx.drawImage(img, 0, 0);

                // Read pixel data
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const data = imageData.data;

                // Convert RGBA to heights
                const heightmap = new Float32Array(img.width * img.height);
                const min = metadata.heightmap.min;
                const max = metadata.heightmap.max;
                const range = max - min;

                for (let i = 0; i < heightmap.length; i++) {
                    const pixelIdx = i * 4;
                    // PNG is 8-bit per channel in canvas, so we need to combine R and G for 16-bit
                    // For grayscale PNG loaded via canvas, all RGB channels are the same
                    const normalized = data[pixelIdx] / 255;

                    // Denormalize using original min/max from metadata
                    heightmap[i] = min + normalized * range;
                }

                resolve(heightmap);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => {
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
