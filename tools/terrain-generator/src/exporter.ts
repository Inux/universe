import { PNG } from 'pngjs';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { HeightmapData, GenerationResult, PlanetConfig } from './types.js';

/**
 * Export terrain data to files
 */
export class TerrainExporter {
    private outputDir: string;

    constructor(outputDir: string = '../../public/terrains') {
        this.outputDir = outputDir;
    }

    /**
     * Export all terrain data for a planet
     */
    public async export(planetName: string, result: GenerationResult, config: PlanetConfig): Promise<void> {
        console.log(`\nExporting terrain for ${planetName}...`);

        // Create output directory
        const planetDir = path.join(this.outputDir, planetName);
        await fs.mkdir(planetDir, { recursive: true });

        // Export heightmap
        await this.exportHeightmap(
            path.join(planetDir, 'heightmap.png'),
            result.heightmap
        );

        // Export normal map
        if (result.normalmap) {
            await this.exportNormalmap(
                path.join(planetDir, 'normalmap.png'),
                result.normalmap
            );
        }

        // Export metadata
        await this.exportMetadata(
            path.join(planetDir, 'metadata.json'),
            result,
            config
        );

        console.log(`✓ Exported to ${planetDir}/`);
    }

    /**
     * Export heightmap as RG-encoded PNG (16-bit precision via R=high byte, G=low byte)
     *
     * Browser Canvas API only supports 8-bit per channel, so true 16-bit grayscale
     * cannot be decoded. This format encodes 16-bit values as:
     *   R channel = high byte (bits 8-15)
     *   G channel = low byte (bits 0-7)
     *   B channel = 0 (unused)
     */
    private async exportHeightmap(filepath: string, heightmap: HeightmapData): Promise<void> {
        // Find min/max for normalization
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < heightmap.data.length; i++) {
            min = Math.min(min, heightmap.data[i]);
            max = Math.max(max, heightmap.data[i]);
        }

        const range = max - min;
        console.log(`  Normalizing heightmap: ${min.toFixed(3)} - ${max.toFixed(3)} → 0.0 - 1.0`);
        console.log(`  Encoding as RG (R=high byte, G=low byte) for browser compatibility`);

        const png = new PNG({
            width: heightmap.width,
            height: heightmap.height,
            colorType: 2, // RGB (not grayscale - browsers can't decode 16-bit grayscale)
            bitDepth: 8,  // 8-bit per channel, but we use RG for 16-bit precision
        });

        // Convert float32 to uint16 encoded as R (high) + G (low)
        for (let y = 0; y < heightmap.height; y++) {
            for (let x = 0; x < heightmap.width; x++) {
                const idx = y * heightmap.width + x;

                // Normalize to full 0-1 range
                const normalized = (heightmap.data[idx] - min) / range;
                const value = Math.floor(normalized * 65535);

                const pngIdx = idx * 4; // 4 bytes per pixel for RGBA (pngjs uses RGBA internally)
                png.data[pngIdx + 0] = (value >> 8) & 0xff; // R = high byte
                png.data[pngIdx + 1] = value & 0xff;        // G = low byte
                png.data[pngIdx + 2] = 0;                   // B = unused
                png.data[pngIdx + 3] = 255;                 // A = full opacity
            }
        }

        const buffer = PNG.sync.write(png);
        await fs.writeFile(filepath, buffer);
        console.log(`  ✓ Heightmap saved: ${path.basename(filepath)} (RG-encoded 16-bit)`);
    }

    /**
     * Export normal map as RGB PNG
     */
    private async exportNormalmap(filepath: string, normalmap: HeightmapData): Promise<void> {
        const png = new PNG({
            width: normalmap.width,
            height: normalmap.height,
            colorType: 2, // RGB
            bitDepth: 8,
        });

        // Convert normalized vectors to RGB
        for (let y = 0; y < normalmap.height; y++) {
            for (let x = 0; x < normalmap.width; x++) {
                const idx = y * normalmap.width + x;
                const pngIdx = idx * 4; // RGBA (we'll skip A)

                // Normal map data is already in 0-1 range from generator
                png.data[pngIdx + 0] = Math.floor(normalmap.data[idx * 3 + 0] * 255); // R
                png.data[pngIdx + 1] = Math.floor(normalmap.data[idx * 3 + 1] * 255); // G
                png.data[pngIdx + 2] = Math.floor(normalmap.data[idx * 3 + 2] * 255); // B
                png.data[pngIdx + 3] = 255; // A (full opacity)
            }
        }

        const buffer = PNG.sync.write(png);
        await fs.writeFile(filepath, buffer);
        console.log(`  ✓ Normal map saved: ${path.basename(filepath)}`);
    }

    /**
     * Export metadata as JSON
     */
    private async exportMetadata(
        filepath: string,
        result: GenerationResult,
        config: PlanetConfig
    ): Promise<void> {
        const metadata = {
            planet: config.name,
            type: config.type,
            generation: {
                resolution: result.heightmap.width,
                terrainScale: config.terrainScale,
                roughness: config.roughness,
                erosionIntensity: config.erosionIntensity,
                generationTime: result.metadata.generationTime,
            },
            heightmap: {
                // Original height range (before normalization)
                min: result.metadata.minHeight,
                max: result.metadata.maxHeight,
                avg: result.metadata.avgHeight,
                // Note: PNG is normalized to 0-1, use min/max to denormalize when loading
            },
            config: {
                gravity: config.gravity,
                hasAtmosphere: config.hasAtmosphere,
                hasWater: config.hasWater,
                temperature: config.temperature,
                hasBiomes: config.hasBiomes,
            },
            files: {
                heightmap: 'heightmap.png',
                normalmap: result.normalmap ? 'normalmap.png' : null,
            },
        };

        await fs.writeFile(filepath, JSON.stringify(metadata, null, 2));
        console.log(`  ✓ Metadata saved: ${path.basename(filepath)}`);
    }
}
