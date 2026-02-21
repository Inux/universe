import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { radialUp, tangentFrame } from './sphereFrame.js';
import {
    KIND_LAND,
    KIND_LAKE,
    KIND_NODATA,
    KIND_OCEAN,
    directionFromLatLon,
    metersToOffset,
    sampleDem,
    sampleLatLon,
    type ReliefField,
} from './reliefField.js';

/**
 * Real measured ground for the walkable worlds that have a global survey.
 * Fly-only bodies never come through here.
 *
 * A coarse displaced sphere draws the limb. Three clipmap rings follow the
 * camera so the triangles underfoot are a fraction of a unit, while the far
 * ground stays cheap. Collision uses the same sample as those vertices.
 * The ocean you can stand on is the sea-level sphere; the mesh under it is
 * the real bathymetry, which is why those two radii differ.
 */

export const RELIEF_CANDIDATES = new Set(['earth', 'mars', 'mercury', 'venus', 'pluto']);

export interface MappedSurface {
    mesh: THREE.Mesh;
    water: THREE.Mesh | null;
    scatter: THREE.Group | null;
    update: (cameraPosition: THREE.Vector3) => void;
    spawnDir: THREE.Vector3;
}

interface BodyTune {
    exagLand: number;
    exagSea: number;
    seaLevel: number;
    trees: boolean;
    rocks: boolean;
    /** 0 earth, 1 mars dust, 2 bare rock, 3 ice. */
    style: number;
    spawnLat: number;
    spawnLon: number;
    spawnMode: 'coast' | 'rim-north' | 'high' | 'data';
    base: [number, number, number];
    rock: number;
    /** How many rock instances to keep near the camera. */
    rockCount: number;
}

const TUNES: Record<string, BodyTune> = {
    earth: {
        exagLand: 14,
        exagSea: 7,
        seaLevel: 0,
        trees: true,
        rocks: true,
        style: 0,
        spawnLat: 36.35,
        spawnLon: -121.95,
        spawnMode: 'coast',
        base: [0.16, 0.18, 0.14],
        rock: 0x8a8178,
        rockCount: 70,
    },
    mars: {
        exagLand: 11,
        exagSea: 11,
        seaLevel: 0,
        trees: false,
        rocks: true,
        style: 1,
        spawnLat: -14.2,
        spawnLon: -67.5,
        spawnMode: 'rim-north',
        base: [0.45, 0.22, 0.12],
        rock: 0x8a4030,
        rockCount: 150,
    },
    mercury: {
        exagLand: 10,
        exagSea: 10,
        seaLevel: 0,
        trees: false,
        rocks: true,
        style: 2,
        spawnLat: 31,
        spawnLon: 163,
        spawnMode: 'high',
        base: [0.45, 0.44, 0.42],
        rock: 0x8d8a86,
        rockCount: 160,
    },
    venus: {
        exagLand: 12,
        exagSea: 12,
        seaLevel: 0,
        trees: false,
        rocks: true,
        style: 2,
        spawnLat: -4,
        spawnLon: 95,
        spawnMode: 'high',
        base: [0.55, 0.42, 0.28],
        rock: 0xb08968,
        rockCount: 120,
    },
    pluto: {
        exagLand: 6,
        exagSea: 6,
        seaLevel: 0,
        trees: false,
        rocks: true,
        style: 3,
        // This mosaic puts Sputnik Planitia near longitude 0, not 180.
        spawnLat: 15,
        spawnLon: 0,
        spawnMode: 'data',
        base: [0.72, 0.66, 0.58],
        rock: 0xc8c2b8,
        rockCount: 90,
    },
};

interface MapMeta {
    width: number;
    height: number;
    min: number;
    max: number;
    radiusKm: number;
    sources: string;
}

interface ClipLevel {
    segments: number;
    spacing: number;
    position: Float32Array;
    normal: Float32Array;
    elev: Float32Array;
    water: Float32Array;
    skirt: Uint8Array;
    positionAttr: THREE.BufferAttribute;
    normalAttr: THREE.BufferAttribute;
    elevAttr: THREE.BufferAttribute;
    waterAttr: THREE.BufferAttribute;
}

const GROUND_VERTEX = /* glsl */ `
attribute float aElev;
attribute float aWater;
varying float vElev;
varying float vWater;
varying vec3 vWorld;
`;

const GROUND_FRAGMENT_HEAD = /* glsl */ `
varying float vElev;
varying float vWater;
varying vec3 vWorld;
uniform sampler2D colorMap;
uniform vec3 uPlayerDir;
uniform vec3 uBase;
uniform float uCoverCos;
uniform float uDiscard;
uniform float uStyle;

float reliefHash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

float reliefNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(reliefHash(i), reliefHash(i + vec3(1.0, 0.0, 0.0)), f.x),
            mix(reliefHash(i + vec3(0.0, 1.0, 0.0)), reliefHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
        mix(mix(reliefHash(i + vec3(0.0, 0.0, 1.0)), reliefHash(i + vec3(1.0, 0.0, 1.0)), f.x),
            mix(reliefHash(i + vec3(0.0, 1.0, 1.0)), reliefHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
        f.z);
}
`;

const GROUND_MAP = /* glsl */ `
{
    vec3 dir = normalize(vWorld);
    if (uDiscard > 0.5 && dot(dir, uPlayerDir) > uCoverCos) discard;

    float lat = asin(clamp(dir.y, -1.0, 1.0));
    float lon = atan(dir.x, dir.z);
    // colorMap and the mask use flipY, so north is texture v = 1.
    vec2 tuv = vec2(lon * 0.15915494309189535 + 0.5, lat * 0.3183098861837907 + 0.5);
    vec3 sat = texture2D(colorMap, tuv).rgb;
    if (vWater < -0.5) sat = uBase;

    vec3 color = sat;
    float dist = distance(cameraPosition, vWorld);
    float close = smoothstep(42.0, 6.0, dist);
    // vNormal is view space. Slope and fresnel need the outward world normal.
    vec3 worldN = inverseTransformDirection(normalize(vNormal), viewMatrix);
    float slope = 1.0 - abs(dot(worldN, dir));
    float grain = reliefNoise(dir * 190.0);

    // A coast triangle blends land (0) into ocean (1) and passes through 0.5,
    // which is also the lake value. Lakes are flat 0.5, so a changing value is a shore.
    float waterSpan = abs(dFdx(vWater)) + abs(dFdy(vWater));
    if (vWater > 0.85) {
        float depthN = clamp(-vElev / 2800.0, 0.0, 1.0);
        color = mix(vec3(0.46, 0.40, 0.28), vec3(0.035, 0.07, 0.10), depthN);
    } else if (vWater > 0.42 && vWater < 0.62 && waterSpan < 0.02) {
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(viewDir, worldN), 0.0), 3.0);
        color = mix(vec3(0.04, 0.20, 0.26), vec3(0.62, 0.78, 0.84), fres * 0.7);
        color = mix(color, sat, 0.12);
    } else {
        vec3 detail = sat * (0.78 + 0.28 * grain);
        if (uStyle < 0.5) {
            float latDeg = degrees(lat);
            float snowLine = mix(5000.0, 150.0, abs(latDeg) / 90.0);
            float snow = smoothstep(snowLine, snowLine + 380.0, vElev);
            float beach = (1.0 - smoothstep(0.0, 55.0, max(vElev, 0.0))) * (1.0 - smoothstep(0.04, 0.30, slope));
            float rock = smoothstep(0.16, 0.55, slope);
            detail = mix(detail, vec3(0.76, 0.68, 0.46), beach * 0.92);
            detail = mix(detail, detail * vec3(0.75, 0.68, 0.60), rock);
            detail = mix(detail, vec3(0.94, 0.96, 0.98), snow);
        } else if (uStyle < 1.5) {
            float rock = smoothstep(0.10, 0.45, slope);
            detail = mix(detail, vec3(0.50, 0.24, 0.13), 0.22 + rock * 0.5);
            detail *= 0.90 + 0.22 * grain;
        } else if (uStyle < 2.5) {
            float rock = smoothstep(0.12, 0.50, slope);
            detail = mix(detail, detail * vec3(0.68, 0.66, 0.62), rock * 0.65);
        } else {
            detail = mix(detail, vec3(0.88, 0.90, 0.93), 0.18);
            detail *= 0.92 + 0.16 * grain;
        }
        // Keep the satellite color in charge. The near tint is only a hint of grain, sand, and snow.
        color = mix(sat, detail, close * 0.28);
    }
    diffuseColor.rgb = color;
}
`;

function mulberry32(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Failed to load ${url}`));
        image.src = url;
    });
}

function imageDataOf(image: HTMLImageElement, width = image.naturalWidth, height = image.naturalHeight): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2d canvas unavailable');
    ctx.drawImage(image, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
}

async function loadField(name: string, gameRadius: number): Promise<ReliefField> {
    const tune = TUNES[name];
    if (!tune) throw new Error(`No relief tune for ${name}`);
    const meta = (await (await fetch(`/maps/${name}/meta.json`)).json()) as MapMeta;
    const reliefImage = await loadImage(`/maps/${name}/relief.png`);
    if (reliefImage.naturalWidth !== meta.width || reliefImage.naturalHeight !== meta.height) {
        throw new Error(`${name} relief is ${reliefImage.naturalWidth}x${reliefImage.naturalHeight}, meta says ${meta.width}x${meta.height}`);
    }
    const pixels = imageDataOf(reliefImage).data;
    const n = meta.width * meta.height;
    const meters = new Int16Array(n);
    const kind = new Uint8Array(n);
    const depth = new Uint8Array(n);
    const span = meta.max - meta.min;
    const scale = span / 65534;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
        const q = pixels[p] * 256 + pixels[p + 1];
        const k = pixels[p + 2];
        if (q >= 65535 || k === KIND_NODATA) {
            meters[i] = 0;
            kind[i] = KIND_NODATA;
            continue;
        }
        const m = meta.min + q * scale;
        meters[i] = m < 0 ? Math.round(m) : Math.round(m);
        kind[i] = k;
        if (k === KIND_OCEAN) {
            depth[i] = Math.max(0, Math.min(255, Math.round((-m / 5000) * 255)));
        }
    }
    console.info(`Measured surface ${name}: ${meta.sources}`);
    return {
        name,
        width: meta.width,
        height: meta.height,
        meters,
        kind,
        depth,
        radiusKm: meta.radiusKm,
        gameRadius,
        exagLand: tune.exagLand,
        exagSea: tune.exagSea,
        seaLevel: tune.seaLevel,
    };
}

function validateEarth(field: ReliefField): void {
    const everest = sampleLatLon(field, 27.99, 86.93);
    if (everest.meters < 5500) {
        throw new Error(`Everest sampled ${everest.meters.toFixed(0)} m — the height grid is flipped or the wrong file`);
    }
    const pacific = sampleLatLon(field, 0, -160);
    if (pacific.kind !== KIND_OCEAN || pacific.meters > -2000) {
        throw new Error(`Pacific sampled ${pacific.meters.toFixed(0)} m kind ${pacific.kind}`);
    }
    const michigan = sampleLatLon(field, 44.0, -87.0);
    const victoria = sampleLatLon(field, -1.0, 33.0);
    if (michigan.kind !== KIND_LAKE || victoria.kind !== KIND_LAKE) {
        console.warn(
            `Large lakes are not both masked (Michigan ${michigan.kind}, Victoria ${victoria.kind}). Coasts still use sea level.`,
        );
    }
}

interface Radii {
    walk: number;
    mesh: number;
    meters: number;
    waterAttr: number;
}

function makeRadiusFn(field: ReliefField, noise: (x: number, y: number, z: number) => number) {
    return function radii(x: number, y: number, z: number): Radii {
        const len = Math.hypot(x, y, z) || 1;
        const dx = x / len;
        const dy = y / len;
        const dz = z / len;
        const sample = sampleDem(field, dx, dy, dz);
        const meters = sample.kind === KIND_NODATA ? 0 : sample.meters;
        let bump = 0;
        if (sample.kind === KIND_LAND && meters > 180) {
            const fade = Math.min(1, (meters - 180) / 420);
            bump = fade * (noise(dx * 260, dy * 260, dz * 260) * 0.18 + noise(dx * 90 + 20, dy * 90, dz * 90) * 0.1);
        }
        const mesh = field.gameRadius + metersToOffset(meters, field) + bump;
        const walk = sample.kind === KIND_OCEAN ? field.gameRadius : mesh;
        let waterAttr = 0;
        if (sample.kind === KIND_LAKE) waterAttr = 0.5;
        else if (sample.kind === KIND_OCEAN) waterAttr = 1;
        else if (sample.kind === KIND_NODATA) waterAttr = -1;
        return { walk, mesh, meters, waterAttr };
    };
}

function findSpawn(field: ReliefField, tune: BodyTune): [number, number, number] {
    let bestScore = -Infinity;
    let best: [number, number, number] | null = null;
    const cosPref = Math.max(0.25, Math.cos((tune.spawnLat * Math.PI) / 180));
    for (let ring = 0; ring <= 28; ring++) {
        const radiusDeg = ring * 0.35;
        const steps = ring === 0 ? 1 : 18;
        for (let s = 0; s < steps; s++) {
            const angle = (s / steps) * Math.PI * 2;
            const lat = tune.spawnLat + Math.sin(angle) * radiusDeg;
            const lon = tune.spawnLon + (Math.cos(angle) * radiusDeg) / cosPref;
            if (Math.abs(lat) > 78) continue;
            const sample = sampleLatLon(field, lat, lon);
            if (sample.kind === KIND_OCEAN || sample.kind === KIND_LAKE) continue;
            if (tune.spawnMode !== 'data' && sample.kind === KIND_NODATA) continue;
            let score = -Infinity;
            if (tune.spawnMode === 'coast') {
                if (sample.kind !== KIND_LAND || sample.meters < 2 || sample.meters > 380) continue;
                let ocean = false;
                const deltas: Array<[number, number]> = [[0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]];
                for (const [dLat, dLon] of deltas) {
                    if (sampleLatLon(field, lat + dLat, lon + dLon).kind === KIND_OCEAN) ocean = true;
                }
                if (!ocean) continue;
                score = 3000 - Math.abs(sample.meters - 35) - ring * 4;
            } else if (tune.spawnMode === 'rim-north') {
                if (sample.kind !== KIND_LAND) continue;
                const north = sampleLatLon(field, lat + 0.4, lon);
                const drop = sample.meters - north.meters;
                if (drop < 700) continue;
                score = drop - ring * 25;
            } else if (tune.spawnMode === 'data') {
                if (sample.kind === KIND_NODATA) continue;
                score = 500 + Math.min(sample.meters, 2000) * 0.01 - ring;
            } else if (sample.meters > 150) {
                score = Math.min(sample.meters, 5000) - ring * 40;
            }
            if (score > bestScore) {
                bestScore = score;
                best = directionFromLatLon(lat, lon);
            }
        }
        if (best && ring > 8 && tune.spawnMode === 'coast') break;
    }
    if (!best) {
        const fallback = sampleLatLon(field, tune.spawnLat, tune.spawnLon);
        console.warn(`Spawn search for ${field.name} found nothing near the preference`, fallback);
        best = directionFromLatLon(0, 20);
    }
    return best;
}

function buildGrid(segments: number, hole: number): { geometry: THREE.BufferGeometry; level: ClipLevel } {
    const n = segments + 1;
    const count = n * n;
    const position = new Float32Array(count * 3);
    const normal = new Float32Array(count * 3);
    const elev = new Float32Array(count);
    const water = new Float32Array(count);
    const skirt = new Uint8Array(count);
    const half = segments / 2;
    const index: number[] = [];
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            const cheb = Math.max(Math.abs(i - half), Math.abs(j - half));
            const edge = i === 0 || j === 0 || i === segments || j === segments;
            skirt[j * n + i] = edge || (hole > 0 && cheb === hole) ? 1 : 0;
        }
    }
    for (let j = 0; j < segments; j++) {
        for (let i = 0; i < segments; i++) {
            if (hole > 0) {
                const c0 = Math.max(Math.abs(i - half), Math.abs(j - half));
                const c1 = Math.max(Math.abs(i + 1 - half), Math.abs(j + 1 - half));
                if (Math.max(c0, c1) <= hole) continue;
            }
            const a = j * n + i;
            const b = a + 1;
            const c = a + n;
            const d = c + 1;
            // +i is east, +j is north. a→b→c is CCW when seen from outside
            // (east × north points away from the planet). The opposite order is culled.
            index.push(a, b, c, b, d, c);
        }
    }
    const geometry = new THREE.BufferGeometry();
    const positionAttr = new THREE.BufferAttribute(position, 3);
    const normalAttr = new THREE.BufferAttribute(normal, 3);
    const elevAttr = new THREE.BufferAttribute(elev, 1);
    const waterAttr = new THREE.BufferAttribute(water, 1);
    positionAttr.setUsage(THREE.DynamicDrawUsage);
    normalAttr.setUsage(THREE.DynamicDrawUsage);
    elevAttr.setUsage(THREE.DynamicDrawUsage);
    waterAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positionAttr);
    geometry.setAttribute('normal', normalAttr);
    geometry.setAttribute('aElev', elevAttr);
    geometry.setAttribute('aWater', waterAttr);
    geometry.setIndex(index);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
    const level: ClipLevel = {
        segments,
        spacing: 1,
        position,
        normal,
        elev,
        water,
        skirt,
        positionAttr,
        normalAttr,
        elevAttr,
        waterAttr,
    };
    return { geometry, level };
}

function fillLevel(
    level: ClipLevel,
    up: THREE.Vector3,
    east: THREE.Vector3,
    north: THREE.Vector3,
    radii: (x: number, y: number, z: number) => Radii,
    gameRadius: number,
): void {
    const n = level.segments + 1;
    const half = level.segments / 2;
    const { position, normal, elev, water, skirt, spacing } = level;
    const ux = up.x;
    const uy = up.y;
    const uz = up.z;
    const ex = east.x;
    const ey = east.y;
    const ez = east.z;
    const nx = north.x;
    const ny = north.y;
    const nz = north.z;
    for (let j = 0; j < n; j++) {
        const northOff = (j - half) * spacing;
        for (let i = 0; i < n; i++) {
            const eastOff = (i - half) * spacing;
            const idx = j * n + i;
            let dx = ux * gameRadius + ex * eastOff + nx * northOff;
            let dy = uy * gameRadius + ey * eastOff + ny * northOff;
            let dz = uz * gameRadius + ez * eastOff + nz * northOff;
            const inv = 1 / (Math.hypot(dx, dy, dz) || 1);
            dx *= inv;
            dy *= inv;
            dz *= inv;
            const sample = radii(dx, dy, dz);
            // A short skirt hides LOD cracks. Deeper than the local relief, it reads as a canyon.
            const radial = skirt[idx] ? sample.mesh - 0.45 : sample.mesh;
            const o = idx * 3;
            position[o] = dx * radial;
            position[o + 1] = dy * radial;
            position[o + 2] = dz * radial;
            elev[idx] = sample.meters;
            water[idx] = sample.waterAttr;
        }
    }
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            const idx = j * n + i;
            const o = idx * 3;
            if (skirt[idx] || i === n - 1 || j === n - 1) {
                const sl = Math.hypot(position[o], position[o + 1], position[o + 2]) || 1;
                normal[o] = position[o] / sl;
                normal[o + 1] = position[o + 1] / sl;
                normal[o + 2] = position[o + 2] / sl;
                continue;
            }
            const e = (idx + 1) * 3;
            const nn = (idx + n) * 3;
            const ax = position[e] - position[o];
            const ay = position[e + 1] - position[o + 1];
            const az = position[e + 2] - position[o + 2];
            const bx = position[nn] - position[o];
            const by = position[nn + 1] - position[o + 1];
            const bz = position[nn + 2] - position[o + 2];
            const cx = ay * bz - az * by;
            const cy = az * bx - ax * bz;
            const cz = ax * by - ay * bx;
            const cl = Math.hypot(cx, cy, cz) || 1;
            normal[o] = cx / cl;
            normal[o + 1] = cy / cl;
            normal[o + 2] = cz / cl;
        }
    }
    level.positionAttr.needsUpdate = true;
    level.normalAttr.needsUpdate = true;
    level.elevAttr.needsUpdate = true;
    level.waterAttr.needsUpdate = true;
}

function displaceSphere(
    geometry: THREE.SphereGeometry,
    radii: (x: number, y: number, z: number) => Radii,
): void {
    const position = geometry.attributes.position;
    const elev = new Float32Array(position.count);
    const water = new Float32Array(position.count);
    const srcX = geometry.userData.srcX as Float32Array;
    const srcY = geometry.userData.srcY as Float32Array;
    const srcZ = geometry.userData.srcZ as Float32Array;
    let maxR = 0;
    for (let i = 0; i < position.count; i++) {
        const x = srcX[i];
        const y = srcY[i];
        const z = srcZ[i];
        const len = Math.hypot(x, y, z) || 1;
        const sample = radii(x / len, y / len, z / len);
        position.setXYZ(i, (x / len) * sample.mesh, (y / len) * sample.mesh, (z / len) * sample.mesh);
        elev[i] = sample.meters;
        water[i] = sample.waterAttr;
        if (sample.mesh > maxR) maxR = sample.mesh;
    }
    geometry.setAttribute('aElev', new THREE.BufferAttribute(elev, 1));
    geometry.setAttribute('aWater', new THREE.BufferAttribute(water, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    if (geometry.boundingSphere) geometry.boundingSphere.radius = maxR + 2;
    position.needsUpdate = true;
}

function compileGround(material: THREE.MeshStandardMaterial, uniforms: Record<string, THREE.IUniform>): void {
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>\n${GROUND_VERTEX}`)
            .replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
                vElev = aElev;
                vWater = aWater;
                vWorld = worldPosition.xyz;`,
            );
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${GROUND_FRAGMENT_HEAD}`)
            .replace('#include <map_fragment>', GROUND_MAP)
            .replace(
                '#include <roughness_fragment>',
                `float roughnessFactor = roughness;
                float waterSpanR = abs(dFdx(vWater)) + abs(dFdy(vWater));
                if (vWater > 0.85) roughnessFactor = 0.96;
                else if (vWater > 0.42 && vWater < 0.62 && waterSpanR < 0.02) roughnessFactor = 0.14;`,
            );
    };
    material.customProgramCacheKey = () => 'measured-ground-v1';
}

function createOcean(gameRadius: number, mask: THREE.DataTexture, waterColor: THREE.Color): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(gameRadius - 0.03, 128, 64);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            waterColor: { value: waterColor },
            time: { value: 0 },
            sunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
            maskMap: { value: mask },
            fogColor: { value: new THREE.Color(0.45, 0.58, 0.75) },
        },
        vertexShader: /* glsl */ `
            uniform float time;
            varying vec3 vNormal;
            varying vec3 vWorld;
            void main() {
                vNormal = normalize(mat3(modelMatrix) * normal);
                vec3 pos = position;
                float wave = sin(pos.x * 0.065 + time * 1.3) * sin(pos.z * 0.055 + time * 0.9) * 0.045;
                pos += normal * wave;
                vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
                vWorld = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 waterColor;
            uniform vec3 sunDirection;
            uniform vec3 fogColor;
            uniform float time;
            uniform sampler2D maskMap;
            varying vec3 vNormal;
            varying vec3 vWorld;
            void main() {
                vec3 dir = normalize(vWorld);
                float lat = asin(clamp(dir.y, -1.0, 1.0));
                float lon = atan(dir.x, dir.z);
                vec2 tuv = vec2(lon * 0.15915494309189535 + 0.5, lat * 0.3183098861837907 + 0.5);
                vec2 mask = texture2D(maskMap, tuv).rg;
                if (mask.r < 0.62) discard;
                float depth = mask.g;
                vec3 shallow = vec3(0.20, 0.62, 0.66);
                vec3 deep = waterColor;
                vec3 color = mix(shallow, deep, smoothstep(0.02, 0.45, depth));
                float foamBand = (1.0 - smoothstep(0.72, 0.92, mask.r)) * (1.0 - smoothstep(0.0, 0.12, depth));
                float foam = foamBand * (0.55 + 0.45 * sin(time * 2.2 + dir.x * 40.0 + dir.z * 36.0));
                color = mix(color, vec3(0.86, 0.93, 0.95), clamp(foam, 0.0, 1.0));
                vec3 viewDir = normalize(cameraPosition - vWorld);
                float fres = pow(1.0 - max(dot(viewDir, normalize(vNormal)), 0.0), 3.0);
                vec3 reflectDir = reflect(-sunDirection, normalize(vNormal));
                float spec = pow(max(dot(viewDir, reflectDir), 0.0), 64.0);
                color = mix(color, vec3(0.65, 0.82, 0.95), fres * 0.35);
                color += vec3(1.0) * spec * 0.35;
                float dist = distance(cameraPosition, vWorld);
                float fog = 1.0 - exp(-0.0016 * 0.0016 * dist * dist);
                color = mix(color, fogColor, clamp(fog, 0.0, 1.0));
                float alpha = mix(0.62, 0.90, smoothstep(0.0, 0.4, depth));
                alpha = mix(alpha, 0.96, clamp(foam, 0.0, 1.0));
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 2;
    mesh.userData.isSphericalWater = true;
    return mesh;
}

interface PropSlot {
    x: number;
    y: number;
    z: number;
    scale: number;
    yaw: number;
    tree: boolean;
}

function createScatter(tune: BodyTune): {
    group: THREE.Group;
    sync: (
        up: THREE.Vector3,
        east: THREE.Vector3,
        north: THREE.Vector3,
        radii: (x: number, y: number, z: number) => Radii,
        colorAt: (lat: number, lon: number) => [number, number, number],
        gameRadius: number,
    ) => void;
} {
    const group = new THREE.Group();
    group.name = 'surface-scatter';
    const treeCap = tune.trees ? 110 : 0;
    const rockCap = tune.rocks ? tune.rockCount : 0;
    const trunkGeom = new THREE.CylinderGeometry(0.045, 0.075, 0.55, 5);
    trunkGeom.translate(0, 0.275, 0);
    const crownGeom = new THREE.ConeGeometry(0.36, 1.15, 6);
    crownGeom.translate(0, 1.05, 0);
    const rockGeom = new THREE.DodecahedronGeometry(0.32, 0);
    rockGeom.translate(0, 0.22, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 0.92 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f6d34, roughness: 0.88 });
    const rockMat = new THREE.MeshStandardMaterial({ color: tune.rock, roughness: 0.94 });
    const trunks = new THREE.InstancedMesh(trunkGeom, trunkMat, Math.max(1, treeCap));
    const crowns = new THREE.InstancedMesh(crownGeom, crownMat, Math.max(1, treeCap));
    const rocks = new THREE.InstancedMesh(rockGeom, rockMat, Math.max(1, rockCap));
    for (const mesh of [trunks, crowns, rocks]) {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.count = 0;
    }
    if (tune.trees) group.add(trunks, crowns);
    if (tune.rocks) group.add(rocks);
    const slots: PropSlot[] = [];
    const rng = mulberry32(1000 + tune.style * 17 + tune.spawnLat * 100);
    const dummy = new THREE.Object3D();
    const align = new THREE.Quaternion();
    const yawQ = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const radial = new THREE.Vector3();
    let anchorX = 0;
    let anchorY = 0;
    let anchorZ = 1;

    const sync = (
        up: THREE.Vector3,
        east: THREE.Vector3,
        north: THREE.Vector3,
        radii: (x: number, y: number, z: number) => Radii,
        colorAt: (lat: number, lon: number) => [number, number, number],
        gameRadius: number,
    ) => {
        const moved = Math.hypot(up.x - anchorX, up.y - anchorY, up.z - anchorZ);
        if (slots.length > 0 && moved < 5 / gameRadius) return;
        anchorX = up.x;
        anchorY = up.y;
        anchorZ = up.z;
        const keep = slots.filter((slot) => slot.x * up.x + slot.y * up.y + slot.z * up.z > Math.cos(20 / gameRadius));
        slots.length = 0;
        slots.push(...keep);
        let treesPlaced = 0;
        let rocksPlaced = 0;
        for (const slot of slots) {
            if (slot.tree) treesPlaced += 1;
            else rocksPlaced += 1;
        }
        let guard = 0;
        while ((tune.trees && treesPlaced < treeCap) || (tune.rocks && rocksPlaced < rockCap)) {
            if (++guard > 5000) break;
            const wantTree = tune.trees && treesPlaced < treeCap;
            const wantRock = tune.rocks && rocksPlaced < rockCap;
            if (!wantTree && !wantRock) break;
            const disk = wantTree && (guard & 1) === 0 ? 15 : 22;
            const angle = rng() * Math.PI * 2;
            const radius = Math.sqrt(rng()) * disk;
            const eastOff = Math.cos(angle) * radius;
            const northOff = Math.sin(angle) * radius;
            let dx = up.x * gameRadius + east.x * eastOff + north.x * northOff;
            let dy = up.y * gameRadius + east.y * eastOff + north.y * northOff;
            let dz = up.z * gameRadius + east.z * eastOff + north.z * northOff;
            const inv = 1 / (Math.hypot(dx, dy, dz) || 1);
            dx *= inv;
            dy *= inv;
            dz *= inv;
            let crowded = false;
            for (const slot of slots) {
                if (slot.x * dx + slot.y * dy + slot.z * dz > Math.cos(1.1 / gameRadius)) {
                    crowded = true;
                    break;
                }
            }
            if (crowded) continue;
            const sample = radii(dx, dy, dz);
            if (sample.waterAttr !== 0) continue;
            const lat = Math.asin(Math.max(-1, Math.min(1, dy))) * (180 / Math.PI);
            const lon = Math.atan2(dx, dz) * (180 / Math.PI);
            const eastSample = radii(dx + east.x * 1.1, dy + east.y * 1.1, dz + east.z * 1.1);
            const northSample = radii(dx + north.x * 1.1, dy + north.y * 1.1, dz + north.z * 1.1);
            const slope = Math.hypot(eastSample.mesh - sample.mesh, northSample.mesh - sample.mesh) / 1.1;
            const [r, g, b] = colorAt(lat, lon);
            const green = g > 42 && g + 12 > r && g > b - 8;
            const treeOk = wantTree && slope < 0.42 && sample.meters > 25 && sample.meters < 2300 && Math.abs(lat) < 62 && (green || guard > 2200);
            const rockOk = wantRock && slope < 1.4 && (slope > 0.12 || rng() < 0.3);
            if (!treeOk && !rockOk) continue;
            const asTree = treeOk && (!rockOk || rng() < 0.72);
            slots.push({
                x: dx,
                y: dy,
                z: dz,
                scale: asTree ? 0.75 + rng() * 0.7 : 0.35 + rng() * (slope > 0.3 ? 1.1 : 0.55),
                yaw: rng() * Math.PI * 2,
                tree: asTree,
            });
            if (asTree) treesPlaced += 1;
            else rocksPlaced += 1;
        }
        const treeSlots = slots.filter((slot) => slot.tree).slice(0, treeCap);
        const rockSlots = slots.filter((slot) => !slot.tree).slice(0, rockCap);
        const write = (mesh: THREE.InstancedMesh, list: PropSlot[], sizer: (slot: PropSlot) => [number, number, number]) => {
            list.forEach((slot, index) => {
                radial.set(slot.x, slot.y, slot.z);
                const placed = radii(slot.x, slot.y, slot.z);
                dummy.position.copy(radial).multiplyScalar(placed.walk);
                align.setFromUnitVectors(yAxis, radial);
                yawQ.setFromAxisAngle(radial, slot.yaw);
                dummy.quaternion.copy(yawQ).multiply(align);
                const [sx, sy, sz] = sizer(slot);
                dummy.scale.set(sx, sy, sz);
                dummy.updateMatrix();
                mesh.setMatrixAt(index, dummy.matrix);
            });
            mesh.count = list.length;
            mesh.instanceMatrix.needsUpdate = true;
        };
        write(trunks, treeSlots, (slot) => [slot.scale, slot.scale, slot.scale]);
        write(crowns, treeSlots, (slot) => [slot.scale, slot.scale, slot.scale]);
        write(rocks, rockSlots, (slot) => {
            const s = slot.scale;
            return [s * 1.3, s * 0.8, s];
        });
    };
    return { group, sync };
}

function bakeMinimap(image: HTMLImageElement): Uint8Array {
    const data = imageDataOf(image, 360, 180).data;
    const out = new Uint8Array(360 * 180 * 3);
    for (let i = 0; i < 360 * 180; i++) {
        out[i * 3] = data[i * 4];
        out[i * 3 + 1] = data[i * 4 + 1];
        out[i * 3 + 2] = data[i * 4 + 2];
    }
    return out;
}

function buildMaskTexture(field: ReliefField): THREE.DataTexture {
    const n = field.width * field.height;
    const data = new Uint8Array(n * 2);
    for (let i = 0; i < n; i++) {
        const k = field.kind[i];
        data[i * 2] = k === KIND_OCEAN ? 255 : k === KIND_LAKE ? 128 : 0;
        data[i * 2 + 1] = field.depth[i];
    }
    const texture = new THREE.DataTexture(data, field.width, field.height, THREE.RGFormat, THREE.UnsignedByteType);
    texture.flipY = true;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
    return texture;
}

export async function createMappedSurface(name: string, gameRadius: number): Promise<MappedSurface | null> {
    const tune = TUNES[name];
    if (!tune) return null;
    try {
        const field = await loadField(name, gameRadius);
        if (name === 'earth') validateEarth(field);
        const colorImage = await loadImage(`/maps/${name}/color.jpg`);
        const colorTex = new THREE.Texture(colorImage);
        colorTex.colorSpace = THREE.SRGBColorSpace;
        colorTex.wrapS = THREE.RepeatWrapping;
        colorTex.wrapT = THREE.ClampToEdgeWrapping;
        colorTex.anisotropy = 8;
        colorTex.needsUpdate = true;
        const colorPixels = imageDataOf(colorImage, 1024, 512).data;
        const colorAt = (lat: number, lon: number): [number, number, number] => {
            let u = lon / 360 + 0.5;
            u -= Math.floor(u);
            const v = Math.min(0.999, Math.max(0, (90 - lat) / 180));
            const ix = Math.min(1023, Math.floor(u * 1024));
            const iy = Math.min(511, Math.floor(v * 512));
            const p = (iy * 1024 + ix) * 4;
            return [colorPixels[p], colorPixels[p + 1], colorPixels[p + 2]];
        };

        const noise = createNoise3D(mulberry32(name.length * 1000 + 7));
        const radii = makeRadiusFn(field, noise);
        const spawn = findSpawn(field, tune);
        const spawnDir = new THREE.Vector3(spawn[0], spawn[1], spawn[2]);

        const base = new THREE.Color(tune.base[0], tune.base[1], tune.base[2]);
        const coarseUniforms = {
            colorMap: { value: colorTex },
            uPlayerDir: { value: spawnDir.clone() },
            uBase: { value: base },
            uCoverCos: { value: 0.97 },
            uDiscard: { value: 1 },
            uStyle: { value: tune.style },
        };
        const clipUniforms = {
            colorMap: { value: colorTex },
            uPlayerDir: { value: new THREE.Vector3(0, 1, 0) },
            uBase: { value: base },
            uCoverCos: { value: 2 },
            uDiscard: { value: 0 },
            uStyle: { value: tune.style },
        };
        const coarseMat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.02 });
        const clipMat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.02 });
        compileGround(coarseMat, coarseUniforms);
        compileGround(clipMat, clipUniforms);
        clipMat.polygonOffset = true;
        clipMat.polygonOffsetFactor = -1;
        clipMat.polygonOffsetUnits = -2;

        const sphere = new THREE.SphereGeometry(gameRadius, 192, 96);
        const src = sphere.attributes.position;
        const srcX = new Float32Array(src.count);
        const srcY = new Float32Array(src.count);
        const srcZ = new Float32Array(src.count);
        for (let i = 0; i < src.count; i++) {
            srcX[i] = src.getX(i);
            srcY[i] = src.getY(i);
            srcZ[i] = src.getZ(i);
        }
        sphere.userData.srcX = srcX;
        sphere.userData.srcY = srcY;
        sphere.userData.srcZ = srcZ;
        displaceSphere(sphere, radii);
        const mesh = new THREE.Mesh(sphere, coarseMat);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.userData.spherical = true;
        mesh.userData.mapped = true;
        mesh.userData.planetRadius = gameRadius;
        mesh.userData.radius = gameRadius;
        mesh.userData.relief = metersToOffset(8000, field);
        mesh.userData.waterRadius = name === 'earth' ? gameRadius : -1;
        mesh.userData.radiusAt = (dir: THREE.Vector3) => radii(dir.x, dir.y, dir.z).walk;
        mesh.userData.minimapColors = bakeMinimap(colorImage);
        mesh.userData.minimapWidth = 360;
        mesh.userData.minimapHeight = 180;
        mesh.userData.spawnDir = spawnDir;

        const levelSpecs = [
            { segments: 96, spacing: 0.34, hole: 0 },
            { segments: 80, spacing: 1.15, hole: 12 },
            { segments: 64, spacing: 4.0, hole: 10 },
        ];
        const levels: ClipLevel[] = [];
        const clipMeshes: THREE.Mesh[] = [];
        for (const spec of levelSpecs) {
            const built = buildGrid(spec.segments, spec.hole);
            built.level.spacing = spec.spacing;
            const clip = new THREE.Mesh(built.geometry, clipMat);
            clip.castShadow = false;
            clip.receiveShadow = true;
            clip.frustumCulled = false;
            mesh.add(clip);
            levels.push(built.level);
            clipMeshes.push(clip);
        }

        const up = new THREE.Vector3();
        const east = new THREE.Vector3();
        const north = new THREE.Vector3();
        const outer = levelSpecs[levelSpecs.length - 1];
        const flatHalf = (outer.segments / 2 - 1) * outer.spacing;
        const scatter = tune.trees || tune.rocks ? createScatter(tune) : null;

        const update = (cameraPosition: THREE.Vector3) => {
            radialUp(up, cameraPosition);
            tangentFrame(up, east, north);
            for (const level of levels) fillLevel(level, up, east, north, radii, gameRadius);
            const theta = (flatHalf * 0.9) / gameRadius;
            coarseUniforms.uCoverCos.value = Math.cos(theta);
            coarseUniforms.uPlayerDir.value.copy(up);
            scatter?.sync(up, east, north, radii, colorAt, gameRadius);
        };
        update(spawnDir.clone().multiplyScalar(gameRadius));

        let water: THREE.Mesh | null = null;
        let mask: THREE.DataTexture | null = null;
        if (name === 'earth') {
            mask = buildMaskTexture(field);
            water = createOcean(gameRadius, mask, new THREE.Color(0x0c3a52));
        }

        const disposables: Array<{ dispose: () => void }> = [colorTex, clipMat];
        if (mask) disposables.push(mask);
        mesh.userData.disposeMapped = () => {
            for (const clip of clipMeshes) {
                clip.geometry.dispose();
                mesh.remove(clip);
            }
            for (const item of disposables) item.dispose();
        };

        const lat = Math.asin(Math.max(-1, Math.min(1, spawnDir.y))) * (180 / Math.PI);
        const lon = Math.atan2(spawnDir.x, spawnDir.z) * (180 / Math.PI);
        console.info(`Spawn ${name} at ${lat.toFixed(2)}°, ${lon.toFixed(2)}°`);
        return { mesh, water, scatter: scatter?.group ?? null, update, spawnDir };
    } catch (error) {
        console.warn(`Measured surface unavailable for ${name}`, error);
        return null;
    }
}
