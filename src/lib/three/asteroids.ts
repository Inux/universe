import * as THREE from 'three';
import { SCALE, SOLAR_SYSTEM, DISTANCE_SCALE_FACTOR } from './solarSystem';

/**
 * Asteroid Belt Configuration
 * Located between Mars (227.9M km) and Jupiter (778.5M km)
 * Real asteroid belt: 329-478 million km from Sun
 */
const ASTEROID_BELT = {
    innerRadius: 329e6,  // km
    outerRadius: 478e6,  // km
    count: 3000,         // Number of asteroids
    minSize: 2,          // Visual size
    maxSize: 8,
    verticalSpread: 50,  // How much asteroids spread above/below orbital plane
    colors: [0x8b7d6b, 0x696969, 0x808080, 0xa0a0a0, 0x6b6b6b]
};

/**
 * Comet Configuration
 */
interface CometData {
    name: string;
    perihelion: number;    // Closest to sun (km)
    aphelion: number;      // Farthest from sun (km)
    orbitalPeriod: number; // Days
    inclination: number;   // Degrees from ecliptic
    tailLength: number;    // Visual tail length multiplier
}

const COMETS: CometData[] = [
    {
        name: "Halley",
        perihelion: 87.6e6,
        aphelion: 5.248e9,
        orbitalPeriod: 27510,  // ~75 years
        inclination: 162,
        tailLength: 1.5
    },
    {
        name: "Encke",
        perihelion: 51e6,
        aphelion: 611e6,
        orbitalPeriod: 1204,  // ~3.3 years
        inclination: 12,
        tailLength: 1.0
    }
];

export interface AsteroidBelt {
    mesh: THREE.InstancedMesh;
    update: (time: number) => void;
}

export interface Comet {
    group: THREE.Group;
    nucleus: THREE.Mesh;
    tail: THREE.Points;
    data: CometData;
    update: (time: number) => void;
}

/**
 * Creates the asteroid belt between Mars and Jupiter using Points (particles)
 * This approach is simpler and avoids lighting/rendering issues
 */
export function createAsteroidBelt(
    scene: THREE.Scene,
    distanceScale: number = DISTANCE_SCALE_FACTOR
): AsteroidBelt {
    const count = ASTEROID_BELT.count;

    // Create positions array
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
        // Random position in the belt (torus shape)
        const radius = THREE.MathUtils.lerp(
            ASTEROID_BELT.innerRadius,
            ASTEROID_BELT.outerRadius,
            Math.random()
        ) * SCALE.DISTANCE * distanceScale;

        const angle = Math.random() * Math.PI * 2;
        const yOffset = (Math.random() - 0.5) * ASTEROID_BELT.verticalSpread;

        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = yOffset;
        positions[i * 3 + 2] = Math.sin(angle) * radius;

        // Random color from palette
        const colorIndex = Math.floor(Math.random() * ASTEROID_BELT.colors.length);
        color.setHex(ASTEROID_BELT.colors[colorIndex]);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        // Random size (more small than large)
        sizes[i] = THREE.MathUtils.lerp(
            ASTEROID_BELT.minSize,
            ASTEROID_BELT.maxSize,
            Math.pow(Math.random(), 2)
        );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
        size: 4,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8,
    });

    const points = new THREE.Points(geometry, material);
    points.name = 'asteroidBelt';
    scene.add(points);

    // Update function - slowly rotate the belt
    function update(time: number) {
        points.rotation.y = time * 0.000005;
    }

    // Return with mesh property for compatibility (Points extends Object3D)
    return { mesh: points as unknown as THREE.InstancedMesh, update };
}

/**
 * Creates a comet with nucleus and particle tail
 */
export function createComet(
    scene: THREE.Scene,
    cometData: CometData,
    distanceScale: number = DISTANCE_SCALE_FACTOR
): Comet {
    const group = new THREE.Group();
    group.name = `comet-${cometData.name}`;

    // Create nucleus (small bright sphere)
    const nucleusGeometry = new THREE.SphereGeometry(8, 16, 16);
    const nucleusMaterial = new THREE.MeshBasicMaterial({
        color: 0xccffff,
    });
    const nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
    group.add(nucleus);

    // Create coma (fuzzy glow around nucleus)
    const comaGeometry = new THREE.SphereGeometry(15, 16, 16);
    const comaMaterial = new THREE.MeshBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.4,
    });
    const coma = new THREE.Mesh(comaGeometry, comaMaterial);
    group.add(coma);

    // Create tail using particles
    const tailParticleCount = 2000;
    const tailPositions = new Float32Array(tailParticleCount * 3);
    const tailColors = new Float32Array(tailParticleCount * 3);
    const tailSizes = new Float32Array(tailParticleCount);

    for (let i = 0; i < tailParticleCount; i++) {
        // Tail extends away from sun (will be updated dynamically)
        const t = i / tailParticleCount;
        const spread = t * 50 * cometData.tailLength;

        tailPositions[i * 3] = -t * 300 * cometData.tailLength; // Extends backward
        tailPositions[i * 3 + 1] = (Math.random() - 0.5) * spread;
        tailPositions[i * 3 + 2] = (Math.random() - 0.5) * spread;

        // Color gradient: white/blue near nucleus, fading to transparent
        const brightness = 1 - t * 0.8;
        tailColors[i * 3] = brightness * 0.8;     // R
        tailColors[i * 3 + 1] = brightness * 0.9; // G
        tailColors[i * 3 + 2] = brightness;       // B

        tailSizes[i] = (1 - t) * 4 + 1;
    }

    const tailGeometry = new THREE.BufferGeometry();
    tailGeometry.setAttribute('position', new THREE.BufferAttribute(tailPositions, 3));
    tailGeometry.setAttribute('color', new THREE.BufferAttribute(tailColors, 3));
    tailGeometry.setAttribute('size', new THREE.BufferAttribute(tailSizes, 1));

    const tailMaterial = new THREE.PointsMaterial({
        size: 3,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    const tail = new THREE.Points(tailGeometry, tailMaterial);
    group.add(tail);

    scene.add(group);

    // Calculate orbital parameters
    const semiMajorAxis = (cometData.perihelion + cometData.aphelion) / 2;
    const eccentricity = (cometData.aphelion - cometData.perihelion) / (cometData.aphelion + cometData.perihelion);
    const inclinationRad = THREE.MathUtils.degToRad(cometData.inclination);

    // Update function for animation
    function update(time: number) {
        // Calculate position on elliptical orbit
        const orbitalSpeed = (2 * Math.PI) / (cometData.orbitalPeriod * 24 * 60 * 60);
        const meanAnomaly = time * orbitalSpeed * SCALE.TIME * 0.00001;

        // Approximate true anomaly (simplified)
        const trueAnomaly = meanAnomaly + 2 * eccentricity * Math.sin(meanAnomaly);

        // Distance from sun at current position
        const r = semiMajorAxis * (1 - eccentricity * eccentricity) / (1 + eccentricity * Math.cos(trueAnomaly));
        const scaledR = r * SCALE.DISTANCE * distanceScale;

        // Position in orbital plane
        const x = scaledR * Math.cos(trueAnomaly);
        const z = scaledR * Math.sin(trueAnomaly);

        // Apply inclination
        const y = z * Math.sin(inclinationRad);
        const zFinal = z * Math.cos(inclinationRad);

        group.position.set(x, y, zFinal);

        // Point tail away from sun
        const toSun = new THREE.Vector3(-x, -y, -zFinal).normalize();
        const tailDirection = toSun.clone().negate();

        // Rotate tail to point away from sun
        tail.lookAt(group.position.clone().add(tailDirection.multiplyScalar(100)));

        // Scale tail based on distance from sun (longer when closer)
        const distanceFromSun = Math.sqrt(x * x + y * y + zFinal * zFinal);
        const tailScale = Math.max(0.5, 2 - distanceFromSun / 5000);
        tail.scale.setScalar(tailScale);

        // Coma brightness based on distance
        const comaBrightness = Math.max(0.2, 1 - distanceFromSun / 10000);
        (comaMaterial as THREE.MeshBasicMaterial).opacity = comaBrightness * 0.4;
    }

    return { group, nucleus, tail, data: cometData, update };
}

/**
 * Creates all comets
 */
export function createComets(
    scene: THREE.Scene,
    distanceScale: number = DISTANCE_SCALE_FACTOR
): Comet[] {
    return COMETS.map(data => createComet(scene, data, distanceScale));
}
