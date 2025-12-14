#!/usr/bin/env node

import { TerrainGenerator } from './generator.js';
import { TerrainExporter } from './exporter.js';
import { PLANET_CONFIGS, getAllPlanetNames } from './planetConfigs.js';

/**
 * Main entry point for terrain generation
 */
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║       Universe Terrain Generator v1.0.0                  ║');
    console.log('║       Advanced Procedural Terrain Generation             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log();

    const startTime = Date.now();
    const exporter = new TerrainExporter();

    // Get planet names to generate (from command line args or all planets)
    const args = process.argv.slice(2);
    const planetNames = args.length > 0 ? args : getAllPlanetNames();

    console.log(`Generating terrains for ${planetNames.length} planet(s):`);
    console.log(`  ${planetNames.join(', ')}`);
    console.log();

    // Generation settings
    const resolution = 1024; // Balanced resolution for quality and performance
    console.log(`Settings:`);
    console.log(`  Resolution: ${resolution}x${resolution} (${(resolution * resolution / 1000000).toFixed(1)}M pixels)`);
    console.log(`  Format: 16-bit PNG heightmaps + 8-bit RGB normalmaps`);
    console.log();

    let successCount = 0;
    let errorCount = 0;

    // Generate terrain for each planet
    for (const planetName of planetNames) {
        try {
            const config = PLANET_CONFIGS[planetName];
            if (!config) {
                console.error(`✗ Unknown planet: ${planetName}`);
                errorCount++;
                continue;
            }

            // Generate terrain
            const generator = new TerrainGenerator(config, resolution);
            const result = await generator.generate();

            // Export files
            await exporter.export(planetName, result, config);

            successCount++;
        } catch (error) {
            console.error(`✗ Error generating ${planetName}:`, error);
            errorCount++;
        }

        console.log();
    }

    // Summary
    const totalTime = (Date.now() - startTime) / 1000;
    console.log('═══════════════════════════════════════════════════════════');
    console.log('GENERATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Successful: ${successCount}/${planetNames.length}`);
    console.log(`  Failed: ${errorCount}/${planetNames.length}`);
    console.log(`  Total time: ${totalTime.toFixed(2)}s (avg ${(totalTime / planetNames.length).toFixed(2)}s per planet)`);
    console.log();
    console.log(`Output directory: public/terrains/`);
    console.log();

    if (errorCount > 0) {
        process.exit(1);
    }
}

// Run
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
