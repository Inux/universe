import * as THREE from 'three';

/**
 * Ring configuration for planets
 */
export interface RingConfig {
    innerRadius: number;  // Multiplier of planet radius
    outerRadius: number;  // Multiplier of planet radius
    color: THREE.Color;
    opacity: number;
    segments: number;
}

/**
 * Default ring configurations
 */
export const RING_CONFIGS: { [key: string]: RingConfig } = {
    saturn: {
        innerRadius: 1.2,
        outerRadius: 2.3,
        color: new THREE.Color(0xc9b896),
        opacity: 0.8,
        segments: 128,
    },
    uranus: {
        innerRadius: 1.5,
        outerRadius: 2.0,
        color: new THREE.Color(0x88aacc),
        opacity: 0.3,
        segments: 64,
    },
};

/**
 * Creates a procedural ring texture with bands
 */
function createRingTexture(width: number = 512, bands: number = 20): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Create gradient with multiple bands
    const gradient = ctx.createLinearGradient(0, 0, width, 0);

    // Saturn-like ring pattern with gaps
    const ringPattern = [
        { pos: 0.0, color: 'rgba(180, 160, 140, 0.0)' },   // Inner gap
        { pos: 0.05, color: 'rgba(180, 160, 140, 0.2)' },
        { pos: 0.1, color: 'rgba(200, 180, 150, 0.6)' },   // C Ring
        { pos: 0.2, color: 'rgba(220, 200, 170, 0.8)' },   // B Ring inner
        { pos: 0.35, color: 'rgba(240, 220, 190, 0.9)' },  // B Ring bright
        { pos: 0.45, color: 'rgba(200, 180, 150, 0.3)' },  // Cassini Division
        { pos: 0.5, color: 'rgba(180, 160, 140, 0.1)' },   // Cassini Division center
        { pos: 0.55, color: 'rgba(200, 180, 150, 0.3)' },  // Cassini Division
        { pos: 0.6, color: 'rgba(230, 210, 180, 0.85)' },  // A Ring
        { pos: 0.75, color: 'rgba(210, 190, 160, 0.7)' },  // A Ring outer
        { pos: 0.85, color: 'rgba(180, 160, 140, 0.4)' },  // F Ring
        { pos: 0.95, color: 'rgba(160, 140, 120, 0.1)' },  // Outer edge
        { pos: 1.0, color: 'rgba(140, 120, 100, 0.0)' },   // Fade out
    ];

    for (const stop of ringPattern) {
        gradient.addColorStop(stop.pos, stop.color);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, canvas.height);

    // Add some noise/variation
    const imageData = ctx.getImageData(0, 0, width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 20;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }

    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    return texture;
}

/**
 * Creates a ring mesh for a planet (like Saturn's rings)
 */
export function createPlanetRings(
    planetRadius: number,
    config: RingConfig
): THREE.Mesh {
    const innerRadius = planetRadius * config.innerRadius;
    const outerRadius = planetRadius * config.outerRadius;

    // Use RingGeometry for the ring shape
    const geometry = new THREE.RingGeometry(
        innerRadius,
        outerRadius,
        config.segments,
        1
    );

    // Adjust UVs for proper texture mapping
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const distance = Math.sqrt(x * x + y * y);

        // Map UV based on distance from center
        const u = (distance - innerRadius) / (outerRadius - innerRadius);
        uv.setXY(i, u, 0.5);
    }

    const texture = createRingTexture();

    const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: config.opacity,
        depthWrite: false,
    });

    const ring = new THREE.Mesh(geometry, material);

    // Rotate to be horizontal (rings are in the equatorial plane)
    ring.rotation.x = -Math.PI / 2;

    return ring;
}

/**
 * Creates Uranus-style rings (thinner, darker)
 */
export function createUranusRings(planetRadius: number): THREE.Mesh {
    const config = RING_CONFIGS.uranus;
    const innerRadius = planetRadius * config.innerRadius;
    const outerRadius = planetRadius * config.outerRadius;

    const geometry = new THREE.RingGeometry(
        innerRadius,
        outerRadius,
        config.segments,
        1
    );

    // Simple dark ring texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0, 'rgba(100, 120, 140, 0.0)');
    gradient.addColorStop(0.1, 'rgba(100, 120, 140, 0.3)');
    gradient.addColorStop(0.3, 'rgba(80, 100, 120, 0.2)');
    gradient.addColorStop(0.5, 'rgba(100, 120, 140, 0.4)');
    gradient.addColorStop(0.7, 'rgba(80, 100, 120, 0.2)');
    gradient.addColorStop(0.9, 'rgba(100, 120, 140, 0.3)');
    gradient.addColorStop(1, 'rgba(100, 120, 140, 0.0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 32);

    const texture = new THREE.CanvasTexture(canvas);

    // Adjust UVs
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const distance = Math.sqrt(x * x + y * y);
        const u = (distance - innerRadius) / (outerRadius - innerRadius);
        uv.setXY(i, u, 0.5);
    }

    const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: config.opacity,
        depthWrite: false,
    });

    const ring = new THREE.Mesh(geometry, material);

    // Uranus has tilted rings (97.77 degrees axial tilt)
    ring.rotation.x = -Math.PI / 2;
    ring.rotation.y = Math.PI * 0.54; // Approximate tilt

    return ring;
}
