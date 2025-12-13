import * as THREE from 'three';
import { createNoise2D, createNoise3D } from 'simplex-noise';

/**
 * Terrain configuration for different planets
 */
export interface TerrainConfig {
    noiseFrequency: number;      // Base frequency for noise
    amplitude: number;           // Height multiplier
    octaves: number;             // Number of noise layers
    persistence: number;         // Amplitude reduction per octave
    lacunarity: number;          // Frequency increase per octave
    baseColor: THREE.Color;      // Primary terrain color
    secondaryColor: THREE.Color; // Secondary terrain color (valleys/peaks)
    waterLevel?: number;         // Optional water level (0-1)
    waterColor?: THREE.Color;    // Water color if applicable
    atmosphereColor?: THREE.Color;
    gravity: number;             // Surface gravity in m/s²
}

/**
 * Planet-specific terrain configurations
 */
export const TERRAIN_CONFIGS: { [key: string]: TerrainConfig } = {
    mercury: {
        noiseFrequency: 2.0,
        amplitude: 0.08,
        octaves: 6,
        persistence: 0.5,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0x8c8c8c),
        secondaryColor: new THREE.Color(0x5a5a5a),
        gravity: 3.7,
    },
    venus: {
        noiseFrequency: 1.2,
        amplitude: 0.06,
        octaves: 4,
        persistence: 0.6,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0xd4a574),
        secondaryColor: new THREE.Color(0xc98b4a),
        atmosphereColor: new THREE.Color(0xffcc66),
        gravity: 8.87,
    },
    earth: {
        noiseFrequency: 1.5,
        amplitude: 0.1,
        octaves: 6,
        persistence: 0.5,
        lacunarity: 2.2,
        baseColor: new THREE.Color(0x3d8c40),      // Green land
        secondaryColor: new THREE.Color(0x8b6914), // Brown mountains
        waterLevel: 0.4,
        waterColor: new THREE.Color(0x1a5f7a),
        atmosphereColor: new THREE.Color(0x87ceeb),
        gravity: 9.81,
    },
    mars: {
        noiseFrequency: 1.3,
        amplitude: 0.12,
        octaves: 5,
        persistence: 0.55,
        lacunarity: 2.1,
        baseColor: new THREE.Color(0xc1440e),
        secondaryColor: new THREE.Color(0x8b4513),
        atmosphereColor: new THREE.Color(0xffaa88),
        gravity: 3.71,
    },
    moon: {
        noiseFrequency: 2.5,
        amplitude: 0.07,
        octaves: 5,
        persistence: 0.5,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0xa0a0a0),
        secondaryColor: new THREE.Color(0x707070),
        gravity: 1.62,
    },
    jupiter: {
        noiseFrequency: 0.8,
        amplitude: 0.02,
        octaves: 3,
        persistence: 0.7,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0xd4a574),
        secondaryColor: new THREE.Color(0xc98b4a),
        atmosphereColor: new THREE.Color(0xffddaa),
        gravity: 24.79,
    },
    saturn: {
        noiseFrequency: 0.7,
        amplitude: 0.02,
        octaves: 3,
        persistence: 0.7,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0xe8d5a3),
        secondaryColor: new THREE.Color(0xc9b896),
        atmosphereColor: new THREE.Color(0xffeebb),
        gravity: 10.44,
    },
    uranus: {
        noiseFrequency: 0.6,
        amplitude: 0.015,
        octaves: 3,
        persistence: 0.6,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0x88ddff),
        secondaryColor: new THREE.Color(0x66bbdd),
        atmosphereColor: new THREE.Color(0x88ddff),
        gravity: 8.69,
    },
    neptune: {
        noiseFrequency: 0.6,
        amplitude: 0.015,
        octaves: 3,
        persistence: 0.6,
        lacunarity: 2.0,
        baseColor: new THREE.Color(0x4466ff),
        secondaryColor: new THREE.Color(0x3355dd),
        atmosphereColor: new THREE.Color(0x6688ff),
        gravity: 11.15,
    },
};

/**
 * Procedural terrain generator using simplex noise
 */
export class TerrainGenerator {
    private noise2D: ReturnType<typeof createNoise2D>;
    private noise3D: ReturnType<typeof createNoise3D>;
    private config: TerrainConfig;

    constructor(config: TerrainConfig, seed?: number) {
        // Create seeded random function if seed provided
        const random = seed !== undefined ? this.seededRandom(seed) : Math.random;
        this.noise2D = createNoise2D(random);
        this.noise3D = createNoise3D(random);
        this.config = config;
    }

    private seededRandom(seed: number): () => number {
        return () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    /**
     * Generate height value using fractal brownian motion (fBm)
     */
    public getHeight(x: number, y: number): number {
        let amplitude = 1;
        let frequency = this.config.noiseFrequency;
        let height = 0;
        let maxValue = 0;

        for (let i = 0; i < this.config.octaves; i++) {
            height += amplitude * this.noise2D(x * frequency, y * frequency);
            maxValue += amplitude;
            amplitude *= this.config.persistence;
            frequency *= this.config.lacunarity;
        }

        // Normalize to 0-1 range
        height = (height / maxValue + 1) / 2;

        return height * this.config.amplitude;
    }

    /**
     * Generate height for spherical coordinates (for planet surfaces)
     */
    public getSphericalHeight(theta: number, phi: number): number {
        // Convert spherical to 3D noise coordinates
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.sin(phi) * Math.sin(theta);
        const z = Math.cos(phi);

        let amplitude = 1;
        let frequency = this.config.noiseFrequency;
        let height = 0;
        let maxValue = 0;

        for (let i = 0; i < this.config.octaves; i++) {
            height += amplitude * this.noise3D(
                x * frequency,
                y * frequency,
                z * frequency
            );
            maxValue += amplitude;
            amplitude *= this.config.persistence;
            frequency *= this.config.lacunarity;
        }

        // Normalize to 0-1 range
        height = (height / maxValue + 1) / 2;

        return height * this.config.amplitude;
    }

    /**
     * Get terrain color based on height
     */
    public getColor(height: number): THREE.Color {
        const normalizedHeight = height / this.config.amplitude;

        // Check for water
        if (this.config.waterLevel && normalizedHeight < this.config.waterLevel) {
            return this.config.waterColor || new THREE.Color(0x1a5f7a);
        }

        // Interpolate between base and secondary color based on height
        const color = new THREE.Color();
        color.lerpColors(
            this.config.baseColor,
            this.config.secondaryColor,
            normalizedHeight
        );

        return color;
    }
}

/**
 * Creates a terrain mesh for a planet surface
 */
export function createTerrainMesh(
    planetName: string,
    size: number = 100,
    resolution: number = 128
): THREE.Mesh {
    const config = TERRAIN_CONFIGS[planetName] || TERRAIN_CONFIGS.earth;
    const generator = new TerrainGenerator(config, planetName.length * 1000);

    const geometry = new THREE.PlaneGeometry(size, size, resolution - 1, resolution - 1);
    const positions = geometry.attributes.position;
    const colors: number[] = [];

    // Generate terrain heights and colors
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getY(i);

        // Scale coordinates for noise
        const nx = (x / size + 0.5) * 4;
        const nz = (z / size + 0.5) * 4;

        const height = generator.getHeight(nx, nz) * size;
        positions.setZ(i, height);

        // Get color for this height
        const color = generator.getColor(height / size);
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.8,
        metalness: 0.1,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;

    return mesh;
}

/**
 * Creates a spherical terrain mesh (for viewing from space)
 */
export function createSphericalTerrain(
    planetName: string,
    radius: number,
    resolution: number = 64
): THREE.Mesh {
    const config = TERRAIN_CONFIGS[planetName] || TERRAIN_CONFIGS.earth;
    const generator = new TerrainGenerator(config, planetName.length * 1000);

    const geometry = new THREE.SphereGeometry(radius, resolution, resolution);
    const positions = geometry.attributes.position;
    const colors: number[] = [];

    // Displace vertices based on noise
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);

        // Convert to spherical coordinates
        const theta = Math.atan2(y, x);
        const phi = Math.acos(z / radius);

        const height = generator.getSphericalHeight(theta, phi);
        const displacement = 1 + height;

        positions.setX(i, x * displacement);
        positions.setY(i, y * displacement);
        positions.setZ(i, z * displacement);

        // Get color for this height
        const color = generator.getColor(height);
        colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: false,
        roughness: 0.9,
        metalness: 0.05,
    });

    return new THREE.Mesh(geometry, material);
}

/**
 * Creates water plane for planets with water
 */
export function createWaterPlane(size: number, config: TerrainConfig): THREE.Mesh | null {
    if (!config.waterLevel || !config.waterColor) return null;

    const geometry = new THREE.PlaneGeometry(size * 1.2, size * 1.2);
    const material = new THREE.MeshStandardMaterial({
        color: config.waterColor,
        transparent: true,
        opacity: 0.8,
        roughness: 0.1,
        metalness: 0.3,
    });

    const water = new THREE.Mesh(geometry, material);
    water.rotation.x = -Math.PI / 2;
    water.position.y = config.waterLevel * config.amplitude * size * 0.5;

    return water;
}

/**
 * Creates a sky dome for surface view
 */
export function createSkyDome(config: TerrainConfig, radius: number = 500): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(radius, 32, 32);

    const skyColor = config.atmosphereColor || new THREE.Color(0x000011);
    const horizonColor = skyColor.clone().multiplyScalar(0.5);

    const material = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: skyColor },
            bottomColor: { value: horizonColor },
            offset: { value: 20 },
            exponent: { value: 0.6 },
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize(vWorldPosition + offset).y;
                gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
            }
        `,
        side: THREE.BackSide,
    });

    return new THREE.Mesh(geometry, material);
}
