import * as THREE from 'three';
import { createAtmosphere, createSunGlow, createSunCorona, ATMOSPHERE_CONFIGS } from './shaders';
import { createPlanetRings, createUranusRings, RING_CONFIGS } from './rings';

export interface MoonData {
    name: string;
    radius: number;  // km
    distance: number;  // km from planet center
    orbitalPeriod: number;  // days
    color: number;  // hex color
}

export interface PlanetData {
    name: string;
    radius: number;  // km
    distanceFromSun: number;  // km
    orbitalPeriod: number;  // days
    rotationPeriod: number;  // hours, negative = retrograde
    texture: string;
    color: number;  // hex color as fallback
    axialTilt?: number;  // degrees, obliquity to the ecliptic
    moons?: MoonData[];
    hasAtmosphere?: boolean;
    hasRings?: boolean;
}

export const SCALE = {
    DISTANCE: 1/100000,
    TIME: 1000000,
    MAX_HEIGHT: 5e8,
};

// Logarithmic size scaling constants.
// The floor stays below Makemake's natural size so dwarf planets stay smaller than Mercury.
const REFERENCE_RADIUS = 6371;
const BASE_VISUAL_SIZE = 50;
const MIN_PLANET_SIZE = 4;
const MAX_PLANET_SIZE = 400;

// Simulated rotation-hours per real second at the tour clock.
// Earth turns about once per 3 minutes. Slower clocks use a smaller scale (see viewScale.ts).
export const SPIN_VISUAL_CAP = 0.12;

/** Discrete distance stops. 0 is true spacing, the last stop is the packed tour. */
export const DISTANCE_STEP_COUNT = 6;

export function getLogarithmicSize(realRadius: number): number {
    const logSize = BASE_VISUAL_SIZE * Math.log(1 + realRadius / REFERENCE_RADIUS);
    return Math.max(MIN_PLANET_SIZE, Math.min(MAX_PLANET_SIZE, logSize));
}

/**
 * Moon radius as a fraction of the parent visual radius.
 * A small floor keeps Phobos and Deimos visible without making them planet-sized.
 */
export function getMoonVisualRadius(moonRadiusKm: number, parentRadiusKm: number, parentVisual: number): number {
    return Math.max(parentVisual * (moonRadiusKm / parentRadiusKm), 0.6);
}

/**
 * Moon orbit in scene units.
 * Real orbits are tiny next to the logarithmic planet sizes, so distances are
 * compressed with log2 of (orbit / parent radius) and clamped outside the parent.
 */
export function getMoonOrbitDistance(
    moonDistanceKm: number,
    parentRadiusKm: number,
    parentVisual: number,
    moonVisual: number,
    distanceScale: number
): number {
    const radii = Math.max(moonDistanceKm / parentRadiusKm, 1.01);
    const compressed = parentVisual * (1.25 + 0.28 * Math.log2(radii)) * distanceScale;
    return Math.max(compressed, parentVisual + moonVisual + parentVisual * 0.15);
}

export const DISTANCE_SCALE_FACTOR = 0.8;

function distanceStepUnit(step: number): number {
    const last = DISTANCE_STEP_COUNT - 1;
    const index = Math.min(last, Math.max(0, Math.round(Number.isFinite(step) ? step : last)));
    return index / last;
}

/** Geometric blend. The ends are exact: u=0 is `real`, u=1 is `current`. */
function blendLog(real: number, current: number, unit: number): number {
    if (unit <= 0) return real;
    if (unit >= 1) return current;
    if (real === current) return real;
    if (real <= 0 || current <= 0) return real + (current - real) * unit;
    return Math.exp(Math.log(real) * (1 - unit) + Math.log(current) * unit);
}

/**
 * Planet–Sun distance in scene units.
 * Real distances keep the Sun's on-screen size as the ruler, so a planet's
 * logarithmic size is unchanged while its orbit grows out to true proportion.
 */
export function planetOrbitRadius(distanceKm: number, step: number): number {
    if (distanceKm <= 0) return 0;
    const unit = distanceStepUnit(step);
    const sunVisual = getLogarithmicSize(SOLAR_SYSTEM.sun.radius);
    const real = distanceKm * (sunVisual / SOLAR_SYSTEM.sun.radius);
    const current = distanceKm * SCALE.DISTANCE * DISTANCE_SCALE_FACTOR;
    return blendLog(real, current, unit);
}

/**
 * Moon orbit in scene units. Real stops use parent radii times the parent's
 * visual size. The tour stop is the existing log-compressed orbit.
 */
export function moonOrbitRadius(
    moonDistanceKm: number,
    parentRadiusKm: number,
    parentVisual: number,
    moonVisual: number,
    step: number
): number {
    const unit = distanceStepUnit(step);
    const real = (moonDistanceKm / parentRadiusKm) * parentVisual;
    const current = getMoonOrbitDistance(
        moonDistanceKm,
        parentRadiusKm,
        parentVisual,
        moonVisual,
        DISTANCE_SCALE_FACTOR
    );
    return blendLog(real, current, unit);
}

export function farthestOrbitRadius(step: number): number {
    let farthest = 0;
    for (const data of Object.values(SOLAR_SYSTEM)) {
        farthest = Math.max(farthest, planetOrbitRadius(data.distanceFromSun, step));
    }
    return farthest;
}

export const SOLAR_SYSTEM: { [key: string]: PlanetData } = {
    sun: {
        name: "Sun",
        radius: 696340,
        distanceFromSun: 0,
        orbitalPeriod: 0,
        rotationPeriod: 609.6,
        axialTilt: 7.25,
        texture: '/textures/2k_sun.jpg',
        color: 0xffdd44
    },
    mercury: {
        name: "Mercury",
        radius: 2439.7,
        distanceFromSun: 57.9e6,
        orbitalPeriod: 88,
        rotationPeriod: 1407.6,
        axialTilt: 0.03,
        texture: '/textures/2k_mercury.jpg',
        color: 0x888888,
        hasAtmosphere: false
    },
    venus: {
        name: "Venus",
        radius: 6051.8,
        distanceFromSun: 108.2e6,
        orbitalPeriod: 224.7,
        rotationPeriod: -5832.5,
        axialTilt: 177.4,
        texture: '/textures/2k_venus_atmosphere.jpg',
        color: 0xffd700,
        hasAtmosphere: true
    },
    earth: {
        name: "Earth",
        radius: 6371,
        distanceFromSun: 149.6e6,
        orbitalPeriod: 365.25,
        rotationPeriod: 23.93,
        axialTilt: 23.44,
        texture: '/textures/2k_earth_daymap.jpg',
        color: 0x2233ff,
        hasAtmosphere: true,
        moons: [
            { name: "Moon", radius: 1737.4, distance: 384400, orbitalPeriod: 27.3, color: 0xc0c0c0 }
        ]
    },
    mars: {
        name: "Mars",
        radius: 3389.5,
        distanceFromSun: 227.9e6,
        orbitalPeriod: 687,
        rotationPeriod: 24.62,
        axialTilt: 25.19,
        texture: '/textures/2k_mars.jpg',
        color: 0xcd5c5c,
        hasAtmosphere: true,
        moons: [
            { name: "Phobos", radius: 11.1, distance: 9376, orbitalPeriod: 0.32, color: 0x8b7d6b },
            { name: "Deimos", radius: 6.2, distance: 23458, orbitalPeriod: 1.26, color: 0x696969 }
        ]
    },
    jupiter: {
        name: "Jupiter",
        radius: 69911,
        distanceFromSun: 778.5e6,
        orbitalPeriod: 4333,
        rotationPeriod: 9.93,
        axialTilt: 3.13,
        texture: '/textures/2k_jupiter.jpg',
        color: 0xd8ca9d,
        hasAtmosphere: true,
        moons: [
            { name: "Io", radius: 1818.1, distance: 421700, orbitalPeriod: 1.77, color: 0xffff99 },
            { name: "Europa", radius: 1560.8, distance: 670900, orbitalPeriod: 3.55, color: 0xffffff },
            { name: "Ganymede", radius: 2631.2, distance: 1070400, orbitalPeriod: 7.15, color: 0x8b7d6b },
            { name: "Callisto", radius: 2410.3, distance: 1882700, orbitalPeriod: 16.69, color: 0x696969 }
        ]
    },
    saturn: {
        name: "Saturn",
        radius: 58232,
        distanceFromSun: 1432e6,
        orbitalPeriod: 10759,
        rotationPeriod: 10.66,
        axialTilt: 26.73,
        texture: '/textures/2k_saturn.jpg',
        color: 0xfad5a5,
        hasAtmosphere: true,
        hasRings: true,
        moons: [
            { name: "Titan", radius: 2574.7, distance: 1221870, orbitalPeriod: 15.95, color: 0xffd700 },
            { name: "Rhea", radius: 764.3, distance: 527108, orbitalPeriod: 4.52, color: 0xc0c0c0 },
            { name: "Iapetus", radius: 734.5, distance: 3560820, orbitalPeriod: 79.33, color: 0x8b7d6b },
            { name: "Dione", radius: 561.4, distance: 377396, orbitalPeriod: 2.74, color: 0xffffff }
        ]
    },
    uranus: {
        name: "Uranus",
        radius: 25362,
        distanceFromSun: 2867e6,
        orbitalPeriod: 30687,
        rotationPeriod: -17.24,
        axialTilt: 97.77,
        texture: '/textures/2k_uranus.jpg',
        color: 0x4fd0e7,
        hasAtmosphere: true,
        hasRings: true,
        moons: [
            { name: "Titania", radius: 788.9, distance: 435910, orbitalPeriod: 8.71, color: 0xc0c0c0 },
            { name: "Oberon", radius: 761.4, distance: 583520, orbitalPeriod: 13.46, color: 0x8b7d6b },
            { name: "Umbriel", radius: 584.7, distance: 266300, orbitalPeriod: 4.14, color: 0x696969 },
            { name: "Ariel", radius: 578.9, distance: 191020, orbitalPeriod: 2.52, color: 0xffffff }
        ]
    },
    neptune: {
        name: "Neptune",
        radius: 24622,
        distanceFromSun: 4515e6,
        orbitalPeriod: 60190,
        rotationPeriod: 16.11,
        axialTilt: 28.32,
        texture: '/textures/2k_neptune.jpg',
        color: 0x4169e1,
        hasAtmosphere: true,
        moons: [
            { name: "Triton", radius: 1353.4, distance: 354759, orbitalPeriod: 5.88, color: 0x87ceeb },
            { name: "Nereid", radius: 178.5, distance: 5513818, orbitalPeriod: 360.14, color: 0x696969 }
        ]
    },
    // Kuiper Belt Dwarf Planets
    pluto: {
        name: "Pluto",
        radius: 1188.3,
        distanceFromSun: 5906.4e6,
        orbitalPeriod: 90560,  // ~248 years
        rotationPeriod: -153.3,  // Retrograde rotation
        axialTilt: 122.53,
        texture: '',  // No full global mosaic is shipped; New Horizons mapped one face
        color: 0xc9b896,
        moons: [
            { name: "Charon", radius: 606, distance: 19591, orbitalPeriod: 6.39, color: 0x808080 }
        ]
    },
    eris: {
        name: "Eris",
        radius: 1163,
        distanceFromSun: 10125e6,  // Average, highly elliptical
        orbitalPeriod: 203830,  // ~558 years
        rotationPeriod: 25.9,
        texture: '',  // No texture, use color
        color: 0xe8e8e8,  // Very bright/white
        moons: [
            { name: "Dysnomia", radius: 350, distance: 37350, orbitalPeriod: 15.77, color: 0x696969 }
        ]
    },
    makemake: {
        name: "Makemake",
        radius: 715,
        distanceFromSun: 6850e6,
        orbitalPeriod: 111845,  // ~306 years
        rotationPeriod: 22.5,
        texture: '',
        color: 0xd4a574  // Reddish-brown
    },
    haumea: {
        name: "Haumea",
        radius: 816,  // Mean radius (elongated shape)
        distanceFromSun: 6452e6,
        orbitalPeriod: 103774,  // ~284 years
        rotationPeriod: 3.9,  // Very fast rotation
        texture: '',
        color: 0xf5f5dc,  // Beige/white
        moons: [
            { name: "Hi'iaka", radius: 160, distance: 49880, orbitalPeriod: 49.12, color: 0xc0c0c0 },
            { name: "Namaka", radius: 85, distance: 25657, orbitalPeriod: 18.28, color: 0xa0a0a0 }
        ]
    }
};

export interface CelestialBody {
    mesh: THREE.Mesh;
    root: THREE.Group;  // orbital position and axial tilt; the mesh spins inside it
    atmosphere?: THREE.Mesh;
    glow?: THREE.Mesh;
    corona?: THREE.Mesh;
    rings?: THREE.Mesh;
    data: PlanetData;
}

export interface SolarSystemObjects {
    planets: Map<string, CelestialBody>;
    moons: Map<string, THREE.Mesh>;
}

/**
 * Creates the complete solar system with all visual enhancements
 */
export async function createSolarSystem(
    scene: THREE.Scene,
    textureLoader: THREE.TextureLoader,
    distanceStep: number
): Promise<SolarSystemObjects> {
    const planets = new Map<string, CelestialBody>();
    const moons = new Map<string, THREE.Mesh>();

    // Create sun
    const sunBody = await createSun(scene, textureLoader);
    planets.set('sun', sunBody);

    // Create planets
    for (const [name, data] of Object.entries(SOLAR_SYSTEM)) {
        if (name === 'sun') continue;

        const planetBody = await createPlanet(scene, textureLoader, name, data, distanceStep);
        planets.set(name, planetBody);

        // Create moons
        if (data.moons) {
            for (const moonData of data.moons) {
                const moon = createMoon(scene, planetBody.root, moonData, data.radius, distanceStep);
                moons.set(`${name}-${moonData.name}`, moon);
            }
        }
    }

    return { planets, moons };
}

async function loadTextureWithFallback(
    loader: THREE.TextureLoader,
    url: string
): Promise<THREE.Texture | null> {
    if (!url) return null;
    try {
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
        });
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        return texture;
    } catch (error) {
        console.warn(`Failed to load texture ${url}`);
        return null;
    }
}

async function createSun(
    scene: THREE.Scene,
    textureLoader: THREE.TextureLoader
): Promise<CelestialBody> {
    const data = SOLAR_SYSTEM.sun;
    const visualSize = getLogarithmicSize(data.radius);

    const geometry = new THREE.SphereGeometry(visualSize, 64, 64);
    const texture = await loadTextureWithFallback(textureLoader, data.texture);

    const material = new THREE.MeshBasicMaterial({
        color: data.color,
        map: texture || undefined,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'sun';

    const root = new THREE.Group();
    root.name = 'sunRoot';
    root.rotation.z = THREE.MathUtils.degToRad(data.axialTilt ?? 0);
    root.add(mesh);
    scene.add(root);

    // No distance falloff: planet distances are compressed, and a physical
    // inverse-square sun would leave Neptune black. Direction still comes from the sun.
    const sunLight = new THREE.PointLight(0xfff4dd, 2.4, 0, 0);
    mesh.add(sunLight);

    // Add glow effect
    const glow = createSunGlow(visualSize);
    glow.name = 'sunGlow';
    mesh.add(glow);

    // Add corona
    const corona = createSunCorona(visualSize);
    corona.name = 'sunCorona';
    mesh.add(corona);

    return { mesh, root, glow, corona, data };
}

async function createPlanet(
    scene: THREE.Scene,
    textureLoader: THREE.TextureLoader,
    name: string,
    data: PlanetData,
    distanceStep: number
): Promise<CelestialBody> {
    const visualSize = getLogarithmicSize(data.radius);

    const geometry = new THREE.SphereGeometry(visualSize, 32, 32);
    const texture = await loadTextureWithFallback(textureLoader, data.texture);

    const material = new THREE.MeshStandardMaterial({
        color: texture ? 0xffffff : data.color,
        map: texture || undefined,
        roughness: 0.7,
        metalness: 0.0,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;

    const root = new THREE.Group();
    root.name = `${name}Root`;
    // Tilt the spin axis (local Y) away from ecliptic north. Orbits stay in the XZ plane.
    root.rotation.z = THREE.MathUtils.degToRad(data.axialTilt ?? 0);
    root.add(mesh);

    // Initial position. The animation loop replaces this from `time` on the first frame.
    const angle = Math.random() * Math.PI * 2;
    const scaledDistance = planetOrbitRadius(data.distanceFromSun, distanceStep);
    root.position.x = Math.cos(angle) * scaledDistance;
    root.position.z = Math.sin(angle) * scaledDistance;

    scene.add(root);

    const body: CelestialBody = { mesh, root, data };

    // Atmosphere and rings share the tilt, and stay off the spinning mesh so rings do not rotate daily.
    if (data.hasAtmosphere && ATMOSPHERE_CONFIGS[name]) {
        const atmosphere = createAtmosphere(visualSize, ATMOSPHERE_CONFIGS[name]);
        atmosphere.name = `${name}Atmosphere`;
        root.add(atmosphere);
        body.atmosphere = atmosphere;
    }

    if (data.hasRings) {
        const rings = name === 'uranus'
            ? createUranusRings(visualSize)
            : createPlanetRings(visualSize, RING_CONFIGS.saturn);
        rings.name = `${name}Rings`;
        root.add(rings);
        body.rings = rings;
    }

    return body;
}

function createMoon(
    scene: THREE.Scene,
    parentRoot: THREE.Object3D,
    moonData: MoonData,
    parentRadiusKm: number,
    distanceStep: number
): THREE.Mesh {
    const parentVisual = getLogarithmicSize(parentRadiusKm);
    const moonVisualSize = getMoonVisualRadius(moonData.radius, parentRadiusKm, parentVisual);

    const geometry = new THREE.SphereGeometry(moonVisualSize, 16, 16);
    const material = new THREE.MeshStandardMaterial({
        color: moonData.color,
        roughness: 0.8,
        metalness: 0.0,
        emissive: moonData.color,
        emissiveIntensity: 0.1
    });

    const moon = new THREE.Mesh(geometry, material);
    moon.name = moonData.name;

    // Position relative to planet
    const moonAngle = Math.random() * Math.PI * 2;
    const moonDistance = moonOrbitRadius(
        moonData.distance,
        parentRadiusKm,
        parentVisual,
        moonVisualSize,
        distanceStep
    );
    moon.position.x = parentRoot.position.x + Math.cos(moonAngle) * moonDistance;
    moon.position.z = parentRoot.position.z + Math.sin(moonAngle) * moonDistance;
    moon.position.y = parentRoot.position.y;

    scene.add(moon);

    // Add atmosphere for Titan
    if (moonData.name === 'Titan' && ATMOSPHERE_CONFIGS.titan) {
        const atmosphere = createAtmosphere(moonVisualSize, ATMOSPHERE_CONFIGS.titan);
        moon.add(atmosphere);
    }

    return moon;
}

/**
 * Updates orbital positions for all celestial bodies
 */
export function updateOrbitalPositions(
    planets: Map<string, CelestialBody>,
    moons: Map<string, THREE.Mesh>,
    time: number,
    selectedPlanet: string,
    distanceStep: number,
    delta: number,
    spinScale: number = SPIN_VISUAL_CAP
): void {
    // Get selected planet's theoretical position
    const selectedData = SOLAR_SYSTEM[selectedPlanet];
    let selectedPosition = new THREE.Vector3(0, 0, 0);

    if (selectedPlanet !== 'sun') {
        const selectedDistance = planetOrbitRadius(selectedData.distanceFromSun, distanceStep);
        const selectedOrbitalSpeed = (2 * Math.PI) / (selectedData.orbitalPeriod * 24 * 60 * 60);
        const selectedAngle = time * selectedOrbitalSpeed;
        selectedPosition.x = Math.cos(selectedAngle) * selectedDistance;
        selectedPosition.z = Math.sin(selectedAngle) * selectedDistance;
    }

    // Update all planets
    for (const [name, body] of planets) {
        const data = body.data;

        if (name === 'sun') {
            body.root.position.copy(selectedPosition).multiplyScalar(-1);
        } else {
            const scaledDistance = planetOrbitRadius(data.distanceFromSun, distanceStep);
            const orbitalSpeed = (2 * Math.PI) / (data.orbitalPeriod * 24 * 60 * 60);
            const angle = time * orbitalSpeed;

            if (name === selectedPlanet) {
                body.root.position.set(0, 0, 0);
            } else {
                body.root.position.x = Math.cos(angle) * scaledDistance - selectedPosition.x;
                body.root.position.z = Math.sin(angle) * scaledDistance - selectedPosition.z;
            }
        }

        // Spin around the tilted local axis. Negative periods (Venus, Uranus, Pluto) spin backwards.
        // `delta` is real seconds. Pass 0 to freeze spin without stopping the render loop.
        if (data.rotationPeriod !== 0) {
            const rotationSpeed = (2 * Math.PI) / data.rotationPeriod;
            body.mesh.rotation.y += rotationSpeed * spinScale * delta;
        }

        if (!data.moons) continue;
        const parentVisual = getLogarithmicSize(data.radius);
        for (const moonData of data.moons) {
            const moon = moons.get(`${name}-${moonData.name}`);
            if (!moon) continue;

            const moonOrbitalSpeed = (2 * Math.PI) / (moonData.orbitalPeriod * 24 * 60 * 60);
            const moonAngle = time * moonOrbitalSpeed;
            const moonVisual = getMoonVisualRadius(moonData.radius, data.radius, parentVisual);
            const moonDistance = moonOrbitRadius(
                moonData.distance,
                data.radius,
                parentVisual,
                moonVisual,
                distanceStep
            );

            moon.position.x = body.root.position.x + Math.cos(moonAngle) * moonDistance;
            moon.position.z = body.root.position.z + Math.sin(moonAngle) * moonDistance;
            moon.position.y = body.root.position.y;

            // Tour stop keeps the previous 0.6 rad/s. Slower clocks scale it down with the spin cap.
            moon.rotation.y += 0.6 * (spinScale / SPIN_VISUAL_CAP) * delta;
        }
    }
}
