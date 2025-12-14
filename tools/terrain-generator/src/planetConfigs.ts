import type { PlanetConfig } from './types.js';

/**
 * Planet configurations for terrain generation
 * Based on src/lib/data/planetData.ts but optimized for terrain generation
 */
export const PLANET_CONFIGS: Record<string, PlanetConfig> = {
    mercury: {
        name: 'mercury',
        type: 'terrestrial',
        gravity: 3.7,
        hasAtmosphere: false,
        hasWater: false,
        temperature: 440,
        terrainScale: 0.5, // Relatively smooth due to lack of erosion
        roughness: 0.4,
        erosionIntensity: 0.0, // No atmosphere = no erosion
        hasBiomes: false,
        baseColor: [169, 169, 169], // Gray
    },

    venus: {
        name: 'venus',
        type: 'terrestrial',
        gravity: 8.87,
        hasAtmosphere: true,
        hasWater: false,
        temperature: 737,
        terrainScale: 0.8,
        roughness: 0.5,
        erosionIntensity: 0.3, // Some atmospheric erosion
        hasBiomes: false,
        baseColor: [218, 165, 32], // Golden yellow
    },

    earth: {
        name: 'earth',
        type: 'terrestrial',
        gravity: 9.81,
        hasAtmosphere: true,
        hasWater: true,
        temperature: 288,
        terrainScale: 1.5, // Dramatic mountains and valleys
        roughness: 0.7,
        erosionIntensity: 0.8, // High erosion from water and weather
        hasBiomes: true,
        baseColor: [76, 153, 0], // Green
        secondaryColor: [64, 164, 223], // Blue (water)
    },

    mars: {
        name: 'mars',
        type: 'terrestrial',
        gravity: 3.71,
        hasAtmosphere: true, // Thin atmosphere
        hasWater: false, // No liquid water currently
        temperature: 210,
        terrainScale: 2.0, // Olympus Mons!
        roughness: 0.6,
        erosionIntensity: 0.2, // Ancient water erosion
        hasBiomes: false,
        baseColor: [193, 68, 14], // Red
    },

    moon: {
        name: 'moon',
        type: 'terrestrial',
        gravity: 1.62,
        hasAtmosphere: false,
        hasWater: false,
        temperature: 250,
        terrainScale: 0.6,
        roughness: 0.5,
        erosionIntensity: 0.0, // No erosion, just impact craters
        hasBiomes: false,
        baseColor: [192, 192, 192], // Light gray
    },

    pluto: {
        name: 'pluto',
        type: 'dwarf',
        gravity: 0.62,
        hasAtmosphere: true, // Very thin
        hasWater: true, // Water ice
        temperature: 44,
        terrainScale: 0.7,
        roughness: 0.4,
        erosionIntensity: 0.1,
        hasBiomes: false,
        baseColor: [200, 180, 160], // Beige
    },

    eris: {
        name: 'eris',
        type: 'dwarf',
        gravity: 0.82,
        hasAtmosphere: false,
        hasWater: true, // Ice
        temperature: 42,
        terrainScale: 0.5,
        roughness: 0.3,
        erosionIntensity: 0.0,
        hasBiomes: false,
        baseColor: [230, 230, 230], // Very light gray
    },

    makemake: {
        name: 'makemake',
        type: 'dwarf',
        gravity: 0.5,
        hasAtmosphere: false,
        hasWater: true, // Ice
        temperature: 40,
        terrainScale: 0.4,
        roughness: 0.3,
        erosionIntensity: 0.0,
        hasBiomes: false,
        baseColor: [139, 69, 19], // Reddish-brown
    },

    haumea: {
        name: 'haumea',
        type: 'dwarf',
        gravity: 0.44,
        hasAtmosphere: false,
        hasWater: true, // Ice
        temperature: 32,
        terrainScale: 0.3, // Very smooth due to rapid rotation
        roughness: 0.2,
        erosionIntensity: 0.0,
        hasBiomes: false,
        baseColor: [240, 240, 240], // Nearly white
    },
};

/**
 * Get all planet names that should have terrain generated
 */
export function getAllPlanetNames(): string[] {
    return Object.keys(PLANET_CONFIGS);
}
