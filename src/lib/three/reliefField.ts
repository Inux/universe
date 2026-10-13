/**
 * Measured relief on a sphere.
 *
 * The height grid is equirectangular, row 0 at the north pole, column 0 at
 * longitude −180°. That is the same direction the surface camera already uses:
 *   x = sin(lon) cos(lat), y = sin(lat), z = cos(lon) cos(lat)
 *   lon = atan2(x, z), lat = asin(y)
 *
 * Vertical scale is exaggerated. A true Earth shrunk to radius 480 would make
 * Everest shorter than the camera, so mountains are multiplied up. The
 * circumference stays a few minutes' walk. Horizontal geography is real.
 */

export const KIND_LAND = 0;
export const KIND_LAKE = 1;
export const KIND_OCEAN = 2;
export const KIND_NODATA = 3;

export interface ReliefField {
    name: string;
    width: number;
    height: number;
    /** Little-endian int16 meters. Length width * height. −32768 is no data. */
    meters: Int16Array;
    /** 0 land, 1 lake, 2 ocean, 3 no data. Same shape as `meters`. */
    kind: Uint8Array;
    /** 0 at a shore, 255 in deep ocean. Same shape. */
    depth: Uint8Array;
    radiusKm: number;
    gameRadius: number;
    /** Multiplier on topographic relief above sea level. */
    exagLand: number;
    /** Multiplier on bathymetry. */
    exagSea: number;
    seaLevel: number;
}

const NODATA = -32768;

/** Game-unit offset from the reference sphere. Sea level is 0. */
export function metersToOffset(meters: number, field: ReliefField): number {
    const km = meters / 1000;
    const sign = km < 0 ? -1 : 1;
    const mag = Math.abs(km);
    // Above 9 km the tail is compressed so Olympus Mons stays a mountain, not a spike.
    const compressed = mag <= 9 ? mag : 9 + (mag - 9) * 0.5;
    const exag = sign < 0 ? field.exagSea : field.exagLand;
    return (field.gameRadius * (sign * compressed) / field.radiusKm) * exag;
}

export interface DemSample {
    meters: number;
    kind: number;
    depth: number;
}

function wrap(i: number, n: number): number {
    const m = i % n;
    return m < 0 ? m + n : m;
}

/** Bilinear meters, nearest kind. `lat` and `lon` are degrees. */
export function sampleLatLon(field: ReliefField, latDeg: number, lonDeg: number): DemSample {
    const { width, height, meters, kind, depth } = field;
    let u = lonDeg / 360 + 0.5;
    u -= Math.floor(u);
    const v = Math.min(1, Math.max(0, (90 - latDeg) / 180));

    const fx = u * width - 0.5;
    let x0 = Math.floor(fx);
    const tx = fx - x0;
    x0 = wrap(x0, width);
    const x1 = wrap(x0 + 1, width);

    const fyRaw = v * height - 0.5;
    const fy = Math.min(height - 1.000001, Math.max(0, fyRaw));
    const y0 = Math.floor(fy);
    const ty = fy - y0;
    const y1 = Math.min(height - 1, y0 + 1);

    const i00 = y0 * width + x0;
    const i10 = y0 * width + x1;
    const i01 = y1 * width + x0;
    const i11 = y1 * width + x1;

    const m00 = meters[i00] === NODATA ? 0 : meters[i00];
    const m10 = meters[i10] === NODATA ? 0 : meters[i10];
    const m01 = meters[i01] === NODATA ? 0 : meters[i01];
    const m11 = meters[i11] === NODATA ? 0 : meters[i11];
    let m = (m00 * (1 - tx) + m10 * tx) * (1 - ty) + (m01 * (1 - tx) + m11 * tx) * ty;

    const nx = tx < 0.5 ? x0 : x1;
    const ny = ty < 0.5 ? y0 : y1;
    const ni = ny * width + nx;
    let k = kind[ni] ?? KIND_LAND;
    const d = depth[ni] ?? 0;

    if (k === KIND_LAND && m < field.seaLevel) m = field.seaLevel;
    if (meters[ni] === NODATA) k = KIND_NODATA;
    return { meters: m, kind: k, depth: d };
}

/** Sample by a direction from the planet center. The vector need not be a unit. */
export function sampleDem(field: ReliefField, x: number, y: number, z: number): DemSample {
    const len = Math.hypot(x, y, z) || 1;
    const ny = Math.max(-1, Math.min(1, y / len));
    const lat = Math.asin(ny) * (180 / Math.PI);
    const lon = Math.atan2(x / len, z / len) * (180 / Math.PI);
    return sampleLatLon(field, lat, lon);
}

/** Unit direction for a geographic point. Matches the surface camera. */
export function directionFromLatLon(latDeg: number, lonDeg: number): [number, number, number] {
    const lat = latDeg * (Math.PI / 180);
    const lon = lonDeg * (Math.PI / 180);
    const cosLat = Math.cos(lat);
    return [Math.sin(lon) * cosLat, Math.sin(lat), Math.cos(lon) * cosLat];
}

/**
 * Round-trip and bilinear checks. Throws if the grid orientation helper drifts.
 * This does not read a real DEM.
 */
export function selfTestRelief(): void {
    const width = 4;
    const height = 2;
    const meters = new Int16Array(width * height);
    const kind = new Uint8Array(width * height);
    const depth = new Uint8Array(width * height);
    // Row 0 is north. Put a spike at lon 0 (column 2 of 4: u=0.5 → pixel center).
    meters[2] = 1000;
    kind[2] = KIND_LAND;
    const field: ReliefField = {
        name: 'test',
        width,
        height,
        meters,
        kind,
        depth,
        radiusKm: 1000,
        gameRadius: 100,
        exagLand: 10,
        exagSea: 10,
        seaLevel: 0,
    };
    const north = sampleLatLon(field, 90, 0);
    if (north.meters < 400) throw new Error(`north sample ${north.meters}`);
    const [x, y, z] = directionFromLatLon(0, 90);
    // lon 90 → +X. lat 0 → y 0.
    if (Math.abs(x - 1) > 1e-6 || Math.abs(y) > 1e-6 || Math.abs(z) > 1e-6) {
        throw new Error(`lon 90 direction ${x} ${y} ${z}`);
    }
    const back = sampleDem(field, 0, 1, 0);
    if (back.meters < 400) throw new Error(`pole via direction ${back.meters}`);
    const everest = metersToOffset(8849, field);
    const trench = metersToOffset(-11000, field);
    if (!(everest > 0) || !(trench < 0) || !(Math.abs(everest) > Math.abs(trench) * 0.4)) {
        throw new Error(`offset everest ${everest} trench ${trench}`);
    }
}
