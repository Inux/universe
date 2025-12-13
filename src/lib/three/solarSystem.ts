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
    rotationPeriod: number;  // hours
    texture: string;
    color: number;  // hex color as fallback
    moons?: MoonData[];
    hasAtmosphere?: boolean;
    hasRings?: boolean;
}

export const SCALE = {
    DISTANCE: 1/100000,
    TIME: 1000000,
    MIN_HEIGHT: 0.005,
    MAX_HEIGHT: 5e8,
    PLAYER: 0.5,
    GRAVITY: 0.5,
    JUMP_FORCE: 0.1,
    JUMP_HEIGHT: 0.0001,
    CAMERA_FOLLOW_HEIGHT: 0.2,
    CAMERA_FOLLOW_DISTANCE: 0.3,
    MOVEMENT_SPEED: 0.1,
    MOON_SCALE: 1/2
};

// Logarithmic size scaling constants
const REFERENCE_RADIUS = 6371;
const BASE_VISUAL_SIZE = 50;
const MIN_PLANET_SIZE = 20;
const MAX_PLANET_SIZE = 400;

export function getLogarithmicSize(realRadius: number): number {
    const logSize = BASE_VISUAL_SIZE * Math.log(1 + realRadius / REFERENCE_RADIUS);
    return Math.max(MIN_PLANET_SIZE, Math.min(MAX_PLANET_SIZE, logSize));
}

export const DISTANCE_SCALE_FACTOR = 0.8;

export const SOLAR_SYSTEM: { [key: string]: PlanetData } = {
    sun: {
        name: "Sun",
        radius: 696340,
        distanceFromSun: 0,
        orbitalPeriod: 0,
        rotationPeriod: 609.6,
        texture: '/public/textures/2k_sun.jpg',
        color: 0xffdd44
    },
    mercury: {
        name: "Mercury",
        radius: 2439.7,
        distanceFromSun: 57.9e6,
        orbitalPeriod: 88,
        rotationPeriod: 1407.6,
        texture: '/public/textures/2k_mercury.jpg',
        color: 0x888888,
        hasAtmosphere: false
    },
    venus: {
        name: "Venus",
        radius: 6051.8,
        distanceFromSun: 108.2e6,
        orbitalPeriod: 224.7,
        rotationPeriod: -5832.5,
        texture: '/public/textures/2k_venus_surface.jpg',
        color: 0xffd700,
        hasAtmosphere: true
    },
    earth: {
        name: "Earth",
        radius: 6371,
        distanceFromSun: 149.6e6,
        orbitalPeriod: 365.25,
        rotationPeriod: 24,
        texture: '/public/textures/2k_earth_daymap.jpg',
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
        rotationPeriod: 24.6,
        texture: '/public/textures/2k_mars.jpg',
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
        rotationPeriod: 9.9,
        texture: '/public/textures/2k_jupiter.jpg',
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
        rotationPeriod: 10.7,
        texture: '/public/textures/2k_saturn.jpg',
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
        rotationPeriod: -17.2,
        texture: '/public/textures/2k_uranus.jpg',
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
        rotationPeriod: 16.1,
        texture: '/public/textures/2k_neptune.jpg',
        color: 0x4169e1,
        hasAtmosphere: true,
        moons: [
            { name: "Triton", radius: 1353.4, distance: 354759, orbitalPeriod: 5.88, color: 0x87ceeb },
            { name: "Nereid", radius: 178.5, distance: 5513818, orbitalPeriod: 360.14, color: 0x696969 }
        ]
    }
};

export interface CelestialBody {
    mesh: THREE.Mesh;
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
    distanceScale: number
): Promise<SolarSystemObjects> {
    const planets = new Map<string, CelestialBody>();
    const moons = new Map<string, THREE.Mesh>();

    // Create sun
    const sunBody = await createSun(scene, textureLoader);
    planets.set('sun', sunBody);

    // Create planets
    for (const [name, data] of Object.entries(SOLAR_SYSTEM)) {
        if (name === 'sun') continue;

        const planetBody = await createPlanet(scene, textureLoader, name, data, distanceScale);
        planets.set(name, planetBody);

        // Create moons
        if (data.moons) {
            for (const moonData of data.moons) {
                const moon = createMoon(scene, planetBody.mesh, moonData, distanceScale);
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
    try {
        return await new Promise((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
        });
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
    scene.add(mesh);

    // Add point light
    const sunLight = new THREE.PointLight(0xffffff, 2, 0, 0.5);
    mesh.add(sunLight);

    // Add glow effect
    const glow = createSunGlow(visualSize);
    glow.name = 'sunGlow';
    mesh.add(glow);

    // Add corona
    const corona = createSunCorona(visualSize);
    corona.name = 'sunCorona';
    mesh.add(corona);

    return { mesh, glow, corona, data };
}

async function createPlanet(
    scene: THREE.Scene,
    textureLoader: THREE.TextureLoader,
    name: string,
    data: PlanetData,
    distanceScale: number
): Promise<CelestialBody> {
    const visualSize = getLogarithmicSize(data.radius);

    const geometry = new THREE.SphereGeometry(visualSize, 32, 32);
    const texture = await loadTextureWithFallback(textureLoader, data.texture);

    const material = new THREE.MeshPhongMaterial({
        color: texture ? 0xffffff : data.color,
        map: texture || undefined,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;

    // Initial position
    const angle = Math.random() * Math.PI * 2;
    const scaledDistance = data.distanceFromSun * SCALE.DISTANCE * distanceScale;
    mesh.position.x = Math.cos(angle) * scaledDistance;
    mesh.position.z = Math.sin(angle) * scaledDistance;

    scene.add(mesh);

    const body: CelestialBody = { mesh, data };

    // Add atmosphere if applicable
    if (data.hasAtmosphere && ATMOSPHERE_CONFIGS[name]) {
        const atmosphere = createAtmosphere(visualSize, ATMOSPHERE_CONFIGS[name]);
        atmosphere.name = `${name}Atmosphere`;
        mesh.add(atmosphere);
        body.atmosphere = atmosphere;
    }

    // Add rings if applicable
    if (data.hasRings) {
        let rings: THREE.Mesh;
        if (name === 'uranus') {
            rings = createUranusRings(visualSize);
        } else {
            rings = createPlanetRings(visualSize, RING_CONFIGS.saturn);
        }
        rings.name = `${name}Rings`;
        mesh.add(rings);
        body.rings = rings;
    }

    return body;
}

function createMoon(
    scene: THREE.Scene,
    parentPlanet: THREE.Mesh,
    moonData: MoonData,
    distanceScale: number
): THREE.Mesh {
    const moonVisualSize = Math.max(getLogarithmicSize(moonData.radius) * SCALE.MOON_SCALE, 5);

    const geometry = new THREE.SphereGeometry(moonVisualSize, 16, 16);
    const material = new THREE.MeshPhongMaterial({
        color: moonData.color,
        emissive: moonData.color,
        emissiveIntensity: 0.2
    });

    const moon = new THREE.Mesh(geometry, material);
    moon.name = moonData.name;

    // Position relative to planet
    const moonAngle = Math.random() * Math.PI * 2;
    const moonDistance = moonData.distance * SCALE.DISTANCE * distanceScale;
    moon.position.x = parentPlanet.position.x + Math.cos(moonAngle) * moonDistance;
    moon.position.z = parentPlanet.position.z + Math.sin(moonAngle) * moonDistance;
    moon.position.y = parentPlanet.position.y;

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
    distanceScale: number
): void {
    // Get selected planet's theoretical position
    const selectedData = SOLAR_SYSTEM[selectedPlanet];
    let selectedPosition = new THREE.Vector3(0, 0, 0);

    if (selectedPlanet !== 'sun') {
        const selectedDistance = selectedData.distanceFromSun * SCALE.DISTANCE;
        const selectedOrbitalSpeed = (2 * Math.PI) / (selectedData.orbitalPeriod * 24 * 60 * 60);
        const selectedAngle = time * selectedOrbitalSpeed;
        selectedPosition.x = Math.cos(selectedAngle) * selectedDistance;
        selectedPosition.z = Math.sin(selectedAngle) * selectedDistance;
    }

    // Update all planets
    for (const [name, body] of planets) {
        const data = body.data;

        if (name === 'sun') {
            body.mesh.position.copy(selectedPosition).multiplyScalar(-1);
            continue;
        }

        const scaledDistance = data.distanceFromSun * SCALE.DISTANCE * distanceScale;
        const orbitalSpeed = (2 * Math.PI) / (data.orbitalPeriod * 24 * 60 * 60);
        const angle = time * orbitalSpeed;

        if (name === selectedPlanet) {
            body.mesh.position.set(0, 0, 0);
        } else {
            body.mesh.position.x = Math.cos(angle) * scaledDistance - selectedPosition.x;
            body.mesh.position.z = Math.sin(angle) * scaledDistance - selectedPosition.z;
        }

        // Planet rotation
        const rotationSpeed = (2 * Math.PI) / (data.rotationPeriod * 60 * 60);
        body.mesh.rotation.y += rotationSpeed * SCALE.TIME / 60;

        // Update moons
        if (data.moons) {
            for (const moonData of data.moons) {
                const moon = moons.get(`${name}-${moonData.name}`);
                if (!moon) continue;

                const moonOrbitalSpeed = (2 * Math.PI) / (moonData.orbitalPeriod * 24 * 60 * 60);
                const moonAngle = time * moonOrbitalSpeed;
                const moonDistance = moonData.distance * SCALE.DISTANCE * distanceScale;

                moon.position.x = body.mesh.position.x + Math.cos(moonAngle) * moonDistance;
                moon.position.z = body.mesh.position.z + Math.sin(moonAngle) * moonDistance;
                moon.position.y = body.mesh.position.y;

                moon.rotation.y += moonOrbitalSpeed * SCALE.TIME / 60;
            }
        }
    }
}
