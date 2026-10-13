export type ExploreMode = 'walk' | 'fly';

/**
 * No solid surface a craft can land on.
 * Gas giants are a cloud deck. The Sun is the photosphere.
 */
const FLY_ONLY = new Set(['sun', 'jupiter', 'saturn', 'uranus', 'neptune']);

export function canWalkSurface(planet: string): boolean {
    return !FLY_ONLY.has(planet);
}

export function defaultExploreMode(planet: string): ExploreMode {
    return canWalkSurface(planet) ? 'walk' : 'fly';
}

export type SurfaceKind = 'ground' | 'cloud' | 'photosphere';

export function surfaceKind(planet: string): SurfaceKind {
    if (planet === 'sun') return 'photosphere';
    if (FLY_ONLY.has(planet)) return 'cloud';
    return 'ground';
}

/** Planets that ship a heightmap under public/terrains. */
export const PREGENERATED_TERRAINS = new Set([
    'mercury',
    'venus',
    'earth',
    'mars',
    'moon',
    'pluto',
    'eris',
    'makemake',
    'haumea',
]);
