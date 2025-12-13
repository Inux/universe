import * as THREE from 'three';

/**
 * Atmosphere shader using Fresnel effect
 * Creates a glowing halo around planets
 */
export const atmosphereVertexShader = `
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const atmosphereFragmentShader = `
    uniform vec3 atmosphereColor;
    uniform float intensity;
    uniform float power;

    varying vec3 vNormal;
    varying vec3 vPosition;

    void main() {
        vec3 viewDirection = normalize(-vPosition);
        float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), power);
        gl_FragColor = vec4(atmosphereColor, fresnel * intensity);
    }
`;

export interface AtmosphereConfig {
    color: THREE.Color;
    intensity: number;
    power: number;
    scale: number;
}

/**
 * Default atmosphere configurations for different planet types
 */
export const ATMOSPHERE_CONFIGS: { [key: string]: AtmosphereConfig } = {
    earth: {
        color: new THREE.Color(0x4da6ff),
        intensity: 0.8,
        power: 2.0,
        scale: 1.15,
    },
    venus: {
        color: new THREE.Color(0xffcc66),
        intensity: 1.0,
        power: 1.5,
        scale: 1.2,
    },
    mars: {
        color: new THREE.Color(0xffaa88),
        intensity: 0.4,
        power: 2.5,
        scale: 1.08,
    },
    jupiter: {
        color: new THREE.Color(0xffddaa),
        intensity: 0.6,
        power: 2.0,
        scale: 1.1,
    },
    saturn: {
        color: new THREE.Color(0xffeebb),
        intensity: 0.5,
        power: 2.0,
        scale: 1.1,
    },
    uranus: {
        color: new THREE.Color(0x88ddff),
        intensity: 0.6,
        power: 2.0,
        scale: 1.12,
    },
    neptune: {
        color: new THREE.Color(0x6688ff),
        intensity: 0.7,
        power: 2.0,
        scale: 1.12,
    },
    titan: {
        color: new THREE.Color(0xffaa44),
        intensity: 0.8,
        power: 1.8,
        scale: 1.15,
    },
};

/**
 * Creates an atmosphere mesh for a planet
 */
export function createAtmosphere(
    planetRadius: number,
    config: AtmosphereConfig
): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(planetRadius * config.scale, 64, 64);

    const material = new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
            atmosphereColor: { value: config.color },
            intensity: { value: config.intensity },
            power: { value: config.power },
        },
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
    });

    return new THREE.Mesh(geometry, material);
}

/**
 * Sun glow shader for emissive effect
 */
export const sunGlowVertexShader = `
    varying vec3 vNormal;

    void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const sunGlowFragmentShader = `
    uniform vec3 glowColor;
    uniform float intensity;

    varying vec3 vNormal;

    void main() {
        float glow = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        gl_FragColor = vec4(glowColor, glow * intensity);
    }
`;

/**
 * Creates a sun glow effect
 */
export function createSunGlow(sunRadius: number): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(sunRadius * 1.5, 64, 64);

    const material = new THREE.ShaderMaterial({
        vertexShader: sunGlowVertexShader,
        fragmentShader: sunGlowFragmentShader,
        uniforms: {
            glowColor: { value: new THREE.Color(0xffdd44) },
            intensity: { value: 0.6 },
        },
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
    });

    return new THREE.Mesh(geometry, material);
}

/**
 * Creates a corona effect for the sun (outer glow)
 */
export function createSunCorona(sunRadius: number): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(sunRadius * 2.5, 32, 32);

    const material = new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
            atmosphereColor: { value: new THREE.Color(0xffaa22) },
            intensity: { value: 0.3 },
            power: { value: 3.0 },
        },
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
    });

    return new THREE.Mesh(geometry, material);
}
