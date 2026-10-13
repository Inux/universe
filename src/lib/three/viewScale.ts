import {
    DISTANCE_STEP_COUNT,
    SCALE,
    SPIN_VISUAL_CAP,
    SOLAR_SYSTEM,
    planetOrbitRadius,
} from './solarSystem';

/**
 * Six stops from real time to the packed tour clock.
 * The last stop is SCALE.TIME, so the default reproduces the previous orbit speed.
 * Spin stays physically tied to that rate until it would exceed SPIN_VISUAL_CAP
 * (Earth's day at the tour stop is about 3.3 minutes, not one turn per tour year).
 */
export const TIME_RATES = [1, 16, 250, 4_000, 60_000, SCALE.TIME] as const;

export const DEFAULT_STEP = DISTANCE_STEP_COUNT - 1;

if (TIME_RATES.length !== DISTANCE_STEP_COUNT) {
    throw new Error('Time and distance sliders must have the same number of steps');
}

const LAST_STEP = DISTANCE_STEP_COUNT - 1;

export function clampStep(step: number): number {
    if (!Number.isFinite(step)) return DEFAULT_STEP;
    return Math.min(LAST_STEP, Math.max(0, Math.round(step)));
}

export function timeRate(step: number): number {
    return TIME_RATES[clampStep(step)];
}

/** Simulated rotation-hours advanced per real second. */
export function spinScaleForRate(rate: number): number {
    return Math.min(Math.max(rate, 0) / 3600, SPIN_VISUAL_CAP);
}

const TIME_LABELS = ['Real', '16×', '250×', '4,000×', '60,000×', 'Tour'] as const;

export function timeLabel(step: number): string {
    return TIME_LABELS[clampStep(step)];
}

export function distanceLabel(step: number): string {
    const index = clampStep(step);
    if (index <= 0) return 'Real';
    if (index >= LAST_STEP) return 'Tour';
    const pct = distanceFraction(index) * 100;
    return pct >= 10 ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
}

/** Share of true Sun–planet spacing at this stop. 1 at Real, about 0.024 at Tour. */
export function distanceFraction(step: number): number {
    const km = SOLAR_SYSTEM.earth.distanceFromSun;
    const real = planetOrbitRadius(km, 0);
    const here = planetOrbitRadius(km, clampStep(step));
    return real > 0 ? here / real : 1;
}

function formatDuration(seconds: number): string {
    const abs = Math.abs(seconds);
    if (abs >= 86400) {
        const days = abs / 86400;
        return `${days >= 10 ? Math.round(days) : trim(days)} days`;
    }
    if (abs >= 3600) {
        const hours = abs / 3600;
        return `${hours >= 10 ? Math.round(hours) : trim(hours)} h`;
    }
    if (abs >= 60) {
        const minutes = abs / 60;
        return `${minutes >= 10 ? Math.round(minutes) : trim(minutes)} min`;
    }
    return `${Math.round(abs)} s`;
}

function trim(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function timeDetail(step: number): string {
    const rate = timeRate(step);
    const year = (SOLAR_SYSTEM.earth.orbitalPeriod * 86400) / rate;
    const spin = spinScaleForRate(rate);
    const day = Math.abs(SOLAR_SYSTEM.earth.rotationPeriod) / spin;
    return `Earth day ${formatDuration(day)} · year ${formatDuration(year)}`;
}

export function distanceDetail(step: number): string {
    const index = clampStep(step);
    if (index <= 0) {
        return "True spacing, measured against the Sun's size. Zoom out for the outer planets.";
    }
    if (index >= LAST_STEP) {
        return 'Packed tour — the distances used until now. Planet sizes stay the same.';
    }
    const pct = distanceFraction(index) * 100;
    const shown = pct >= 10 ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`;
    return `${shown} of true spacing. Planet sizes stay the same.`;
}

/** Floor matches the previous OrbitControls maxDistance, so the tour stop does not zoom out. */
export function orbitMaxDistance(farthestOrbit: number): number {
    return Math.max(120_000, farthestOrbit * 1.15);
}

/**
 * Star shell is built at `shellRadius`. Scale it past the outermost orbit
 * once true distances would otherwise put planets outside the stars.
 */
export function skyScaleForFarthest(farthestOrbit: number, shellRadius = 600_000): number {
    if (shellRadius <= 0) return 1;
    return Math.max(1, (farthestOrbit * 2.2) / shellRadius);
}

export function cameraClipPlanes(
    cameraDistance: number,
    farthestOrbit: number,
    skyOuter: number
): { near: number; far: number } {
    const dist = Math.max(cameraDistance, 0);
    const near = Math.max(0.1, dist / 500);
    let far = Math.max(dist * 20, farthestOrbit * 4, skyOuter * 1.15);
    if (near >= far * 0.5) far = near * 1000;
    return { near, far };
}
