import { ref, shallowRef, type Ref } from 'vue';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
    TerrainGenerator,
    TERRAIN_CONFIGS,
    createTerrainMesh,
    createTerrainFromPreGenerated,
    createTerrainLOD,
    createSphericalTerrain,
    createSphericalWater,
    createWaterPlane,
    updateWater,
    createSkyDome,
    createStarfield,
    updateStarfield,
    updateSkyDome,
    getTerrainHeight,
    createTerrainChunkGrid,
    updateTerrainChunks,
    BiomeType,
    BIOMES,
    type TerrainConfig
} from '../three/terrain';

export interface UseSurfaceViewOptions {
    onExit?: () => void;
}

export function useSurfaceView(
    containerRef: Ref<HTMLElement | null>,
    options: UseSurfaceViewOptions = {}
) {
    const isActive = ref(false);
    const currentPlanet = ref<string | null>(null);
    const isLoading = ref(false);

    const scene = shallowRef<THREE.Scene | null>(null);
    const camera = shallowRef<THREE.PerspectiveCamera | null>(null);
    const renderer = shallowRef<THREE.WebGLRenderer | null>(null);
    const controls = shallowRef<PointerLockControls | null>(null);

    let animationId: number | null = null;
    let terrainMesh: THREE.Mesh | null = null;
    let terrainChunkGroup: THREE.Group | null = null; // For chunked terrain system
    let terrainLOD: THREE.LOD | null = null;
    let waterMesh: THREE.Mesh | null = null;
    let skyDome: THREE.Mesh | null = null;
    let starfield: THREE.Points | null = null;
    let sunLight: THREE.DirectionalLight | null = null;
    let rimLight: THREE.DirectionalLight | null = null;
    let dustSystem: THREE.Points | null = null;
    let propsGroup: THREE.Group | null = null;
    let composer: EffectComposer | null = null;

    // Cached scene references (avoid per-frame searches)
    let hemiLight: THREE.HemisphereLight | null = null;

    // Pre-allocated vector for sun direction (reused every frame)
    const sunDirection = new THREE.Vector3();

    // Day/night cycle
    let dayTime = 0.25; // Start at sunrise (0-1, 0.5 = noon)
    const dayDuration = 120; // Seconds for a full day cycle

    // Terrain settings - use flat terrain for GTA-style experience
    const useSphericalTerrain = ref(false);
    const planetRadius = 100; // Radius of the walkable planet sphere (if spherical)
    let terrainSize = 1000; // Size of flat terrain (updated when terrain is created)

    // Player state for surface exploration
    const playerPosition = ref(new THREE.Vector3(0, 5, 0));
    const headingDeg = ref(0); // 0-360, 0 = north (+Z), increases clockwise
    const timeOfDay = ref(0); // 0-1 normalized day cycle
    const playerVelocity = new THREE.Vector3();
    const moveState = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        lookUp: false,
        lookDown: false,
        lookLeft: false,
        lookRight: false,
    };

    let currentGravity = 9.81;
    let isGrounded = false;

    // Camera rotation state for first-person controls
    let cameraYaw = 0; // Left/right rotation (radians)
    let cameraPitch = 0; // Up/down rotation (radians)

    // Mouse look sensitivity
    const mouseSensitivity = 0.002; // radians per pixel

    // Camera smoothing
    const targetCameraPosition = new THREE.Vector3();
    const cameraSmoothingFactor = 0.15; // Lower = smoother but more lag, higher = more responsive

    // Pre-allocated objects for performance
    const tempVector3 = new THREE.Vector3();
    const tempVector3b = new THREE.Vector3(); // Additional temp vector
    const tempQuaternion = new THREE.Quaternion();
    const yawQuaternion = new THREE.Quaternion();
    const pitchQuaternion = new THREE.Quaternion();
    const upVector = new THREE.Vector3(0, 1, 0);
    const forwardVector = new THREE.Vector3(0, 0, -1);

    // Pre-allocated vectors for spherical physics (reused every frame)
    const sphereUp = new THREE.Vector3();
    const sphereCameraDir = new THREE.Vector3();
    const sphereForward = new THREE.Vector3();
    const sphereRight = new THREE.Vector3();
    const sphereMoveDir = new THREE.Vector3();
    const sphereNewUp = new THREE.Vector3();
    const sphereWorldUp = new THREE.Vector3(0, 1, 0);
    const sphereAxis = new THREE.Vector3();
    const sphereQuat = new THREE.Quaternion();

    // Pre-allocated vector for flat terrain forward direction (reused every frame)
    const flatForwardDir = new THREE.Vector3();

    // Performance and physics state
    let lastTime = 0;

    // Event handlers (stored for cleanup)
    let handleMouseMove: ((event: MouseEvent) => void) | null = null;

    function initScene() {
        if (!containerRef.value) {
            console.error('SurfaceView: Container ref is null');
            return false;
        }

        // Get container dimensions, fallback to window if 0
        const width = containerRef.value.clientWidth || window.innerWidth;
        const height = containerRef.value.clientHeight || window.innerHeight;

        scene.value = new THREE.Scene();
        // Don't set background - let sky dome handle it
        scene.value.background = null;

        // Increase far plane to see sky dome
        camera.value = new THREE.PerspectiveCamera(75, width / height, 0.1, 5000);
        camera.value.position.set(0, 2, 0); // Eye height

        // CRITICAL: Set rotation order to YXZ to prevent gimbal lock
        // YXZ = Yaw (Y) first, then Pitch (X), then Roll (Z)
        // This ensures yaw always rotates around world Y axis
        camera.value.rotation.order = 'YXZ';

        renderer.value = new THREE.WebGLRenderer({ antialias: true });
        renderer.value.setSize(width, height);
        renderer.value.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.value.shadowMap.enabled = true;
        renderer.value.shadowMap.type = THREE.PCFSoftShadowMap;

        // Enable ACES tonemapping and sRGB output for realistic rendering
        renderer.value.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.value.toneMappingExposure = 1.0;
        renderer.value.outputColorSpace = THREE.SRGBColorSpace;

        // Expose renderer globally for PerformanceHUD
        (window as any).__THREE_RENDERER__ = renderer.value;

        containerRef.value.appendChild(renderer.value.domElement);

        // Pointer lock for cursor hiding and mouse look
        renderer.value.domElement.addEventListener('click', () => {
            renderer.value?.domElement.requestPointerLock();
        });

        // Mouse look handler - only active when pointer is locked
        handleMouseMove = (event: MouseEvent) => {
            if (document.pointerLockElement === renderer.value?.domElement) {
                // Update yaw (left/right) - negative because moving right should rotate right
                cameraYaw -= event.movementX * mouseSensitivity;

                // Update pitch (up/down) - negative because moving up should look up
                cameraPitch -= event.movementY * mouseSensitivity;

                // Clamp pitch to prevent camera flipping
                const maxPitch = Math.PI / 2.5; // ~72 degrees
                const minPitch = -Math.PI / 2.5; // ~-72 degrees
                cameraPitch = Math.max(minPitch, Math.min(maxPitch, cameraPitch));
            }
        };

        document.addEventListener('mousemove', handleMouseMove);

        // Lighting - ambient for base illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        scene.value.add(ambientLight);

        // Sun light (directional) - will be animated for day/night
        sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        sunLight.position.set(100, 100, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.camera.left = -50;
        sunLight.shadow.camera.right = 50;
        sunLight.shadow.camera.top = 50;
        sunLight.shadow.camera.bottom = -50;
        scene.value.add(sunLight);

        // Rim light (opposite sun) for subtle edge lighting
        rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
        rimLight.position.set(-100, 80, -50);
        scene.value.add(rimLight);

        // Hemisphere light for sky/ground color bleeding
        hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x8b4513, 0.4);
        scene.value.add(hemiLight);

        // Set up SSAO post-processing for contact shadows
        composer = new EffectComposer(renderer.value);
        const renderPass = new RenderPass(scene.value, camera.value);
        composer.addPass(renderPass);

        const ssaoPass = new SSAOPass(scene.value, camera.value, width, height);
        ssaoPass.kernelRadius = 12;
        ssaoPass.minDistance = 0.001;
        ssaoPass.maxDistance = 0.15;
        (ssaoPass as any).output = SSAOPass.OUTPUT.Default;
        composer.addPass(ssaoPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);

        return true;
    }

    async function loadPlanetSurface(planetName: string) {
        if (!scene.value) return;

        isLoading.value = true;
        currentPlanet.value = planetName;

        // Clear previous terrain
        if (terrainMesh) {
            scene.value.remove(terrainMesh);
            terrainMesh.geometry.dispose();
            (terrainMesh.material as THREE.Material).dispose();
            terrainMesh = null;
        }
        if (waterMesh) {
            scene.value.remove(waterMesh);
            waterMesh.geometry.dispose();
            (waterMesh.material as THREE.Material).dispose();
            waterMesh = null;
        }
        if (skyDome) {
            scene.value.remove(skyDome);
            skyDome.geometry.dispose();
            (skyDome.material as THREE.Material).dispose();
            skyDome = null;
        }
        if (starfield) {
            scene.value.remove(starfield);
            starfield.geometry.dispose();
            (starfield.material as THREE.Material).dispose();
            starfield = null;
        }
        if (dustSystem) {
            scene.value.remove(dustSystem);
            dustSystem.geometry.dispose();
            (dustSystem.material as THREE.Material).dispose();
            dustSystem = null;
        }
        if (propsGroup) {
            // Dispose all props (InstancedMesh or regular Mesh) to prevent GPU resource leaks on re-entry
            propsGroup.children.forEach((child) => {
                if (child instanceof THREE.InstancedMesh || child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (child.material instanceof THREE.Material) {
                        child.material.dispose();
                    }
                }
            });
            scene.value.remove(propsGroup);
            propsGroup = null;
        }

        const config = TERRAIN_CONFIGS[planetName] || TERRAIN_CONFIGS.earth;
        currentGravity = config.gravity;

        if (useSphericalTerrain.value) {
            // Create spherical terrain (walkable planet)
            terrainMesh = createSphericalTerrain(planetName, planetRadius, 128);
            scene.value.add(terrainMesh);

            // Create spherical water if applicable
            waterMesh = createSphericalWater(planetRadius, config);
            if (waterMesh) {
                scene.value.add(waterMesh);
            }

            // Position camera on the surface
            if (camera.value) {
                const startHeight = planetRadius + 2; // Eye height above surface
                camera.value.position.set(0, startHeight, 0);
                camera.value.lookAt(0, startHeight, 10);
                cameraYaw = 0;
                cameraPitch = 0;
            }
        } else {
            // Load pre-generated terrain (Phase 7.7)
            terrainSize = 1000; // Terrain size

            try {
                // Load pre-generated high-quality terrain
                terrainMesh = await createTerrainFromPreGenerated(planetName, terrainSize);
                terrainMesh.castShadow = true;
                terrainMesh.receiveShadow = true;
                scene.value.add(terrainMesh);
            } catch (error) {
                console.warn(`Failed to load pre-generated terrain for ${planetName}, falling back to runtime generation:`, error);
                // Fallback to runtime generation
                terrainMesh = createTerrainMesh(planetName, terrainSize, 256, false);
                terrainMesh.castShadow = true;
                terrainMesh.receiveShadow = true;
                scene.value.add(terrainMesh);
            }

            // Create water if applicable
            waterMesh = createWaterPlane(terrainSize, config);
            if (waterMesh) {
                scene.value.add(waterMesh);
            }

            // Reset camera position for flat terrain - standing on ground
            if (camera.value && terrainMesh) {
                const startHeight = getTerrainHeight(terrainMesh, 0, 0) + 2;
                camera.value.position.set(0, startHeight, 0);
                camera.value.up.set(0, 1, 0);
                camera.value.lookAt(0, startHeight, -10);
                cameraYaw = 0;
                cameraPitch = 0;
            } else if (camera.value) {
                camera.value.position.set(0, 20, 0);
                camera.value.up.set(0, 1, 0);
                camera.value.lookAt(0, 20, -10);
                cameraYaw = 0;
                cameraPitch = 0;
            }
        }

        // Aerial perspective fog for planets with atmosphere
        // Tints distant terrain toward a blue-shifted atmosphere color,
        // creating a sense of depth and scale (Rayleigh scattering approximation)
        if (scene.value) {
            if (config.atmosphereColor) {
                // Mix atmosphere color with a blue tint for Rayleigh-like effect
                const fogColor = config.atmosphereColor.clone().multiplyScalar(0.4);
                const blueShift = new THREE.Color(0.5, 0.6, 0.85);
                fogColor.lerp(blueShift, 0.3); // 30% blue shift for aerial perspective
                scene.value.fog = new THREE.FogExp2(fogColor.getHex(), 0.0016);
            } else {
                // No atmosphere = no fog, just darkness
                scene.value.fog = null;
            }
        }

        // Mars dust (simple particle field)
        if (planetName === 'mars' && scene.value) {
            const dustCount = 1500;
            const positions = new Float32Array(dustCount * 3);
            for (let i = 0; i < dustCount; i++) {
                const r = 120 * Math.sqrt(Math.random());
                const theta = Math.random() * Math.PI * 2;
                positions[i * 3] = Math.cos(theta) * r;
                positions[i * 3 + 1] = Math.random() * 20 + 1;
                positions[i * 3 + 2] = Math.sin(theta) * r;
            }
            const dustGeom = new THREE.BufferGeometry();
            dustGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const dustMat = new THREE.PointsMaterial({
                color: config.atmosphereColor ?? new THREE.Color(0xffaa88),
                size: 1.8,
                transparent: true,
                opacity: 0.12,
                depthWrite: false,
            });
            dustSystem = new THREE.Points(dustGeom, dustMat);
            scene.value.add(dustSystem);
        }

        // Props: biome-specific vegetation and details (using InstancedMesh for performance)
        // Uses Poisson disk sampling for natural spacing and slope-based filtering
        if (scene.value && terrainMesh) {
            propsGroup = new THREE.Group();
            scene.value.add(propsGroup);
            const size = (terrainMesh.userData.terrainSize as number) ?? 500;
            const half = size / 2;

            const dummy = new THREE.Object3D(); // Reusable transform helper

            /**
             * Calculate terrain slope at a world position (0 = flat, 1+ = very steep)
             * Uses finite differences on the height lookup
             */
            const getSlopeAt = (wx: number, wz: number, step: number = 2): number => {
                const hC = getTerrainHeight(terrainMesh!, wx, wz);
                const hR = getTerrainHeight(terrainMesh!, wx + step, wz);
                const hL = getTerrainHeight(terrainMesh!, wx - step, wz);
                const hU = getTerrainHeight(terrainMesh!, wx, wz - step);
                const hD = getTerrainHeight(terrainMesh!, wx, wz + step);
                const dx = (hR - hL) / (2 * step);
                const dz = (hD - hU) / (2 * step);
                return Math.sqrt(dx * dx + dz * dz);
            };

            /**
             * Bridson's Poisson disk sampling — guarantees minimum distance
             * between samples while maintaining natural distribution.
             * Returns points in [-half, half] x [-half, half].
             */
            const poissonDiskSample = (minDist: number, maxAttempts: number = 30): Array<{ x: number; z: number }> => {
                const cellSize = minDist / Math.SQRT2;
                const gridW = Math.ceil(size / cellSize);
                const gridH = Math.ceil(size / cellSize);
                const grid: number[] = new Array(gridW * gridH).fill(-1);
                const points: Array<{ x: number; z: number }> = [];
                const active: number[] = [];

                // Seed with first point
                const first = { x: Math.random() * size - half, z: Math.random() * size - half };
                points.push(first);
                active.push(0);
                const gi = Math.floor((first.x + half) / cellSize);
                const gj = Math.floor((first.z + half) / cellSize);
                if (gi >= 0 && gi < gridW && gj >= 0 && gj < gridH) {
                    grid[gj * gridW + gi] = 0;
                }

                while (active.length > 0) {
                    const aIdx = Math.floor(Math.random() * active.length);
                    const point = points[active[aIdx]];
                    let found = false;

                    for (let attempt = 0; attempt < maxAttempts; attempt++) {
                        const angle = Math.random() * Math.PI * 2;
                        const dist = minDist + Math.random() * minDist;
                        const nx = point.x + Math.cos(angle) * dist;
                        const nz = point.z + Math.sin(angle) * dist;

                        if (nx < -half || nx >= half || nz < -half || nz >= half) continue;

                        const ngi = Math.floor((nx + half) / cellSize);
                        const ngj = Math.floor((nz + half) / cellSize);

                        // Check 5x5 neighborhood for conflicts
                        let tooClose = false;
                        for (let dy = -2; dy <= 2 && !tooClose; dy++) {
                            for (let dx = -2; dx <= 2 && !tooClose; dx++) {
                                const ci = ngi + dx;
                                const cj = ngj + dy;
                                if (ci < 0 || ci >= gridW || cj < 0 || cj >= gridH) continue;
                                const cellIdx = grid[cj * gridW + ci];
                                if (cellIdx >= 0) {
                                    const p = points[cellIdx];
                                    const ddx = nx - p.x;
                                    const ddz = nz - p.z;
                                    if (ddx * ddx + ddz * ddz < minDist * minDist) {
                                        tooClose = true;
                                    }
                                }
                            }
                        }

                        if (!tooClose) {
                            points.push({ x: nx, z: nz });
                            active.push(points.length - 1);
                            if (ngi >= 0 && ngi < gridW && ngj >= 0 && ngj < gridH) {
                                grid[ngj * gridW + ngi] = points.length - 1;
                            }
                            found = true;
                            break;
                        }
                    }

                    if (!found) {
                        // Swap-and-pop: O(1) removal instead of O(n) splice
                        active[aIdx] = active[active.length - 1];
                        active.pop();
                    }
                }

                return points;
            };

            if (planetName === 'earth' && config.hasBiomes) {
                const generator = new TerrainGenerator(config, planetName.length * 1000);

                const treeFoliagePositions: { x: number; y: number; z: number; s: number }[] = [];
                const treeTrunkPositions: { x: number; y: number; z: number; s: number }[] = [];
                const bushPositions: { x: number; y: number; z: number; s: number }[] = [];
                const cactusPositions: { x: number; y: number; z: number; s: number }[] = [];
                const rockPositions: { x: number; y: number; z: number; s: number }[] = [];
                const icePositions: { x: number; y: number; z: number; s: number }[] = [];
                const palmPositions: { x: number; y: number; z: number; s: number }[] = [];

                // Generate Poisson samples with biome-appropriate spacing
                // Use moderate spacing — tighter than random for better coverage
                const samples = poissonDiskSample(18, 25);

                for (const pt of samples) {
                    const x = pt.x;
                    const z = pt.z;
                    const y = getTerrainHeight(terrainMesh, x, z);
                    const slope = getSlopeAt(x, z);

                    const nx = (x / size + 0.5) * 3;
                    const nz = (z / size + 0.5) * 3;
                    const height = generator.getHeight(nx, nz);
                    const normalizedHeight = height / config.amplitude;
                    const biome = generator.getBiome(nx, nz, normalizedHeight);

                    switch (biome) {
                        case BiomeType.FOREST:
                            // Trees: no steep slopes, not too high
                            if (slope < 0.5 && Math.random() > 0.15) {
                                const s = 0.7 + Math.random() * 0.6;
                                treeFoliagePositions.push({ x, y: y + 2.0 * s, z, s });
                                treeTrunkPositions.push({ x, y: y + 0.8 * s, z, s });
                            } else if (slope >= 0.5 && slope < 1.0 && Math.random() > 0.6) {
                                // Bushes on moderate slopes in forest
                                bushPositions.push({ x, y: y + 0.3, z, s: 0.3 + Math.random() * 0.3 });
                            }
                            break;
                        case BiomeType.PLAINS:
                            if (slope < 0.4 && Math.random() > 0.5) {
                                bushPositions.push({ x, y: y + 0.3, z, s: 0.4 + Math.random() * 0.4 });
                            }
                            break;
                        case BiomeType.DESERT:
                            if (slope < 0.6 && Math.random() > 0.45) {
                                if (Math.random() > 0.5) {
                                    cactusPositions.push({ x, y: y + 1, z, s: 0.8 + Math.random() * 0.4 });
                                } else {
                                    rockPositions.push({ x, y, z, s: 0.5 + Math.random() * 0.5 });
                                }
                            }
                            break;
                        case BiomeType.TUNDRA:
                            if (slope < 0.7 && Math.random() > 0.55) {
                                icePositions.push({ x, y: y + 0.75, z, s: 0.6 + Math.random() * 0.5 });
                            }
                            break;
                        case BiomeType.MOUNTAIN:
                            // Rocks more likely on steep slopes (scree fields)
                            if (slope > 0.3 && Math.random() > 0.3) {
                                // Scree: smaller rocks clustered at base of steep areas
                                const screeScale = 0.4 + Math.random() * 0.6;
                                rockPositions.push({ x, y, z, s: screeScale });
                            } else if (Math.random() > 0.5) {
                                // Boulders on moderate mountain slopes
                                rockPositions.push({ x, y, z, s: 0.8 + Math.random() * 1.2 });
                            }
                            break;
                        case BiomeType.BEACH:
                            if (slope < 0.3 && Math.random() > 0.8) {
                                const s = 0.8 + Math.random() * 0.3;
                                palmPositions.push({ x, y: y + 2.0 * s, z, s });
                                treeTrunkPositions.push({ x, y: y + 0.8 * s, z, s });
                            }
                            break;
                    }
                }

                // --- Ecosystem simulation: plant competition ---
                // Trees compete for space; weaker ones die, creating natural
                // forest structure with clearings, canopy gaps, and size variation.
                // Also spawns understory bushes near surviving large trees.
                {
                    interface EcoPlant {
                        idx: number;       // Index into treeFoliagePositions
                        x: number;
                        z: number;
                        radius: number;    // Competition radius
                        vigor: number;     // Growth strength (0-1)
                    }

                    // Build list of competing plants (trees only)
                    const plants: EcoPlant[] = treeFoliagePositions.map((p, i) => ({
                        idx: i,
                        x: p.x,
                        z: p.z,
                        radius: p.s * 3.0, // Competition radius based on tree size
                        vigor: 0.3 + Math.random() * 0.7,
                    }));

                    // Ecosystem simulation: plant competition with spatial grid
                    const gridCellSize = 15; // Slightly larger than max tree radius
                    const gridW = Math.ceil(terrainSize / gridCellSize) + 1;
                    const gridH = Math.ceil(terrainSize / gridCellSize) + 1;

                    for (let iter = 0; iter < 4; iter++) {
                        // Build spatial grid
                        const grid = new Map<number, number[]>();
                        for (let i = 0; i < plants.length; i++) {
                            const gx = Math.floor((plants[i].x + terrainSize / 2) / gridCellSize);
                            const gy = Math.floor((plants[i].z + terrainSize / 2) / gridCellSize);
                            const key = gy * gridW + gx;
                            if (!grid.has(key)) grid.set(key, []);
                            grid.get(key)!.push(i);
                        }

                        // Check competition only against nearby cells
                        for (let i = 0; i < plants.length; i++) {
                            if (plants[i].vigor <= 0) continue;
                            const gx = Math.floor((plants[i].x + terrainSize / 2) / gridCellSize);
                            const gy = Math.floor((plants[i].z + terrainSize / 2) / gridCellSize);

                            // Check 3x3 neighborhood
                            for (let dy = -1; dy <= 1; dy++) {
                                for (let dx = -1; dx <= 1; dx++) {
                                    const key = (gy + dy) * gridW + (gx + dx);
                                    const cell = grid.get(key);
                                    if (!cell) continue;
                                    for (const j of cell) {
                                        if (j <= i || plants[j].vigor <= 0) continue;
                                        const distSq = (plants[i].x - plants[j].x) ** 2 +
                                                       (plants[i].z - plants[j].z) ** 2;
                                        const minDist = plants[i].radius + plants[j].radius;
                                        if (distSq < minDist * minDist) {
                                            // Weaker plant loses vigor
                                            if (plants[i].vigor < plants[j].vigor) {
                                                plants[i].vigor -= 0.25;
                                            } else {
                                                plants[j].vigor -= 0.25;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Remove dead plants (swap-and-pop)
                        for (let i = plants.length - 1; i >= 0; i--) {
                            if (plants[i].vigor <= 0) {
                                plants[i] = plants[plants.length - 1];
                                plants.pop();
                            }
                        }
                    }

                    // Build set of surviving tree indices
                    const survivingIndices = new Set(plants.map(p => p.idx));

                    // Filter tree positions to only survivors, and adjust scale by vigor
                    const survivingFoliage: typeof treeFoliagePositions = [];
                    const survivingTrunks: typeof treeTrunkPositions = [];
                    for (const plant of plants) {
                        const foliage = treeFoliagePositions[plant.idx];
                        const trunk = treeTrunkPositions[plant.idx];
                        if (!foliage || !trunk) continue;

                        // Scale by vigor — healthier trees are bigger
                        const vigorScale = 0.7 + plant.vigor * 0.5;
                        survivingFoliage.push({ ...foliage, s: foliage.s * vigorScale });
                        survivingTrunks.push({ ...trunk, s: trunk.s * vigorScale });

                        // Spawn understory bush near large surviving trees
                        if (plant.vigor > 0.5 && Math.random() > 0.5) {
                            const angle = Math.random() * Math.PI * 2;
                            const dist = plant.radius * 0.6;
                            const bx = plant.x + Math.cos(angle) * dist;
                            const bz = plant.z + Math.sin(angle) * dist;
                            const by = getTerrainHeight(terrainMesh!, bx, bz);
                            bushPositions.push({ x: bx, y: by + 0.3, z: bz, s: 0.25 + Math.random() * 0.3 });
                        }
                    }

                    // Replace arrays with filtered results
                    treeFoliagePositions.length = 0;
                    treeFoliagePositions.push(...survivingFoliage);
                    treeTrunkPositions.length = 0;
                    treeTrunkPositions.push(...survivingTrunks);
                }

                // Create InstancedMesh batches
                if (treeFoliagePositions.length > 0) {
                    // Multi-layered conifer crown: 3 stacked cones merged for pine silhouette
                    const bottomTier = new THREE.ConeGeometry(1.1, 1.5, 7);
                    bottomTier.translate(0, -0.3, 0);
                    const middleTier = new THREE.ConeGeometry(0.85, 1.3, 7);
                    middleTier.translate(0, 0.4, 0);
                    const topTier = new THREE.ConeGeometry(0.6, 1.2, 7);
                    topTier.translate(0, 1.0, 0);
                    const geom = mergeGeometries([bottomTier, middleTier, topTier])!;
                    // Organic vertex displacement for natural variation
                    const positions = geom.attributes.position;
                    for (let i = 0; i < positions.count; i++) {
                        const x = positions.getX(i);
                        const y = positions.getY(i);
                        const z = positions.getZ(i);
                        const radial = Math.sqrt(x * x + z * z);
                        if (radial > 0.05) {
                            const noise = Math.sin(x * 13.7 + z * 17.3) * Math.cos(y * 11.1) * 0.15;
                            positions.setX(i, x + x * noise);
                            positions.setZ(i, z + z * noise);
                        }
                    }
                    positions.needsUpdate = true;
                    geom.computeVertexNormals();
                    const mat = new THREE.MeshStandardMaterial({ color: 0x1d4c0e, roughness: 0.9, metalness: 0.0 });
                    const inst = new THREE.InstancedMesh(geom, mat, treeFoliagePositions.length);
                    inst.castShadow = true;
                    inst.receiveShadow = true;
                    for (let i = 0; i < treeFoliagePositions.length; i++) {
                        const p = treeFoliagePositions[i];
                        dummy.position.set(p.x, p.y, p.z);
                        dummy.scale.setScalar(p.s);
                        dummy.rotation.y = Math.random() * Math.PI * 2;
                        dummy.updateMatrix();
                        inst.setMatrixAt(i, dummy.matrix);
                    }
                    propsGroup.add(inst);
                }

                if (palmPositions.length > 0) {
                    // Palm tree foliage — wider, flatter cone
                    const geom = new THREE.ConeGeometry(1.2, 1.5, 6);
                    const mat = new THREE.MeshStandardMaterial({ color: 0x2d7c1e, roughness: 0.9, metalness: 0.0 });
                    const inst = new THREE.InstancedMesh(geom, mat, palmPositions.length);
                    inst.castShadow = true;
                    inst.receiveShadow = true;
                    for (let i = 0; i < palmPositions.length; i++) {
                        const p = palmPositions[i];
                        dummy.position.set(p.x, p.y, p.z);
                        dummy.scale.setScalar(p.s);
                        dummy.rotation.y = Math.random() * Math.PI * 2;
                        dummy.updateMatrix();
                        inst.setMatrixAt(i, dummy.matrix);
                    }
                    propsGroup.add(inst);
                }

                if (treeTrunkPositions.length > 0) {
                    const geom = new THREE.CylinderGeometry(0.12, 0.22, 1.8, 8);
                    const mat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.95, metalness: 0.0 });
                    const inst = new THREE.InstancedMesh(geom, mat, treeTrunkPositions.length);
                    inst.castShadow = true;
                    for (let i = 0; i < treeTrunkPositions.length; i++) {
                        const p = treeTrunkPositions[i];
                        dummy.position.set(p.x, p.y, p.z);
                        dummy.scale.setScalar(p.s);
                        dummy.rotation.set(0, 0, 0);
                        dummy.updateMatrix();
                        inst.setMatrixAt(i, dummy.matrix);
                    }
                    propsGroup.add(inst);
                }

                if (bushPositions.length > 0) {
                    const geom = new THREE.SphereGeometry(0.5, 8, 6);
                    // Clumpy foliage displacement
                    const positions = geom.attributes.position;
                    for (let i = 0; i < positions.count; i++) {
                        const x = positions.getX(i);
                        const y = positions.getY(i);
                        const z = positions.getZ(i);
                        const noise = Math.sin(x * 8.7 + z * 12.3) * Math.cos(y * 9.1 + x * 7.7) * 0.25;
                        positions.setX(i, x * (1 + noise));
                        positions.setY(i, y * (1 + noise * 0.5) + 0.1);
                        positions.setZ(i, z * (1 + noise));
                    }
                    positions.needsUpdate = true;
                    geom.computeVertexNormals();
                    const mat = new THREE.MeshStandardMaterial({ color: 0x4a8c2d, roughness: 0.95, metalness: 0.0 });
                    const inst = new THREE.InstancedMesh(geom, mat, bushPositions.length);
                    inst.castShadow = true;
                    inst.receiveShadow = true;
                    for (let i = 0; i < bushPositions.length; i++) {
                        const p = bushPositions[i];
                        dummy.position.set(p.x, p.y, p.z);
                        dummy.scale.setScalar(p.s);
                        dummy.rotation.set(0, 0, 0);
                        dummy.updateMatrix();
                        inst.setMatrixAt(i, dummy.matrix);
                    }
                    propsGroup.add(inst);
                }

                if (cactusPositions.length > 0) {
                    const geom = new THREE.CylinderGeometry(0.3, 0.3, 2, 8);
                    const mat = new THREE.MeshStandardMaterial({ color: 0x3a6b35, roughness: 0.9, metalness: 0.0 });
                    const inst = new THREE.InstancedMesh(geom, mat, cactusPositions.length);
                    inst.castShadow = true;
                    inst.receiveShadow = true;
                    for (let i = 0; i < cactusPositions.length; i++) {
                        const p = cactusPositions[i];
                        dummy.position.set(p.x, p.y, p.z);
                        dummy.scale.setScalar(p.s);
                        dummy.rotation.set(0, 0, 0);
                        dummy.updateMatrix();
                        inst.setMatrixAt(i, dummy.matrix);
                    }
                    propsGroup.add(inst);
                }

                if (rockPositions.length > 0) {
                    const geom = new THREE.IcosahedronGeometry(0.8, 1);
                    // Irregular rocky displacement
                    const positions = geom.attributes.position;
                    for (let i = 0; i < positions.count; i++) {
                        const x = positions.getX(i);
                        const y = positions.getY(i);
                        const z = positions.getZ(i);
                        const noise = (Math.sin(x * 7.3 + y * 11.7) * Math.cos(z * 13.1 + x * 5.3) * 0.3 +
                                       Math.sin(x * 23.1 + z * 19.7) * 0.15);
                        const scale = 1 + noise;
                        positions.setX(i, x * scale);
                        positions.setY(i, y * scale * 0.7);
                        positions.setZ(i, z * scale);
                    }
                    positions.needsUpdate = true;
                    geom.computeVertexNormals();
                    const mat = new THREE.MeshStandardMaterial({ color: 0x7d6d5c, roughness: 0.95, metalness: 0.05 });
                    const inst = new THREE.InstancedMesh(geom, mat, rockPositions.length);
                    inst.castShadow = true;
                    inst.receiveShadow = true;
                    for (let i = 0; i < rockPositions.length; i++) {
                        const p = rockPositions[i];
                        dummy.position.set(p.x, p.y, p.z);
                        dummy.scale.setScalar(p.s);
                        dummy.rotation.set(Math.random(), Math.random(), Math.random());
                        dummy.updateMatrix();
                        inst.setMatrixAt(i, dummy.matrix);
                    }
                    propsGroup.add(inst);
                }

                if (icePositions.length > 0) {
                    const geom = new THREE.ConeGeometry(0.35, 1.5, 6);
                    // Crystalline vertex displacement for ice shards
                    const positions = geom.attributes.position;
                    for (let i = 0; i < positions.count; i++) {
                        const x = positions.getX(i);
                        const y = positions.getY(i);
                        const z = positions.getZ(i);
                        const radial = Math.sqrt(x * x + z * z);
                        if (radial > 0.02) {
                            const noise = Math.sin(x * 19.3 + z * 23.7) * Math.cos(y * 17.1) * 0.2;
                            positions.setX(i, x * (1 + noise));
                            positions.setZ(i, z * (1 + noise));
                        }
                    }
                    positions.needsUpdate = true;
                    geom.computeVertexNormals();
                    const mat = new THREE.MeshStandardMaterial({
                        color: 0xd4e4e8, roughness: 0.3, metalness: 0.2,
                        emissive: 0x88aacc, emissiveIntensity: 0.1
                    });
                    const inst = new THREE.InstancedMesh(geom, mat, icePositions.length);
                    inst.castShadow = true;
                    inst.receiveShadow = true;
                    for (let i = 0; i < icePositions.length; i++) {
                        const p = icePositions[i];
                        dummy.position.set(p.x, p.y, p.z);
                        dummy.scale.setScalar(p.s);
                        dummy.rotation.set(0, 0, 0);
                        dummy.updateMatrix();
                        inst.setMatrixAt(i, dummy.matrix);
                    }
                    propsGroup.add(inst);
                }
            } else {
                // Non-Earth planets: Poisson-sampled rocks with slope awareness
                const rockSamples = poissonDiskSample(35, 20);
                const rockPosArr: { x: number; y: number; z: number; s: number }[] = [];
                const iceArr: { x: number; y: number; z: number; s: number }[] = [];
                const coldPlanets = ['pluto', 'eris', 'makemake', 'haumea', 'moon'];
                const isCold = coldPlanets.includes(planetName);

                for (const pt of rockSamples) {
                    const x = pt.x;
                    const z = pt.z;
                    const y = getTerrainHeight(terrainMesh, x, z);
                    const slope = getSlopeAt(x, z);

                    // Rocks more likely on steep terrain (scree accumulation)
                    const rockProb = 0.3 + slope * 0.5;
                    if (Math.random() < rockProb) {
                        const scale = 0.6 + Math.random() * 1.4;
                        rockPosArr.push({ x, y, z, s: scale });
                    }

                    // Ice on cold planets: prefers gentle slopes, higher elevations
                    if (isCold && slope < 0.6 && Math.random() > 0.5) {
                        iceArr.push({ x, y: y + 1.2, z, s: 0.7 + Math.random() * 0.6 });
                    }
                }

                if (rockPosArr.length > 0) {
                    const rockGeom = new THREE.IcosahedronGeometry(1, 1);
                    // Irregular rocky displacement for non-Earth rocks
                    const rockPositions = rockGeom.attributes.position;
                    for (let i = 0; i < rockPositions.count; i++) {
                        const x = rockPositions.getX(i);
                        const y = rockPositions.getY(i);
                        const z = rockPositions.getZ(i);
                        const noise = (Math.sin(x * 7.3 + y * 11.7) * Math.cos(z * 13.1 + x * 5.3) * 0.3 +
                                       Math.sin(x * 23.1 + z * 19.7) * 0.15);
                        const scale = 1 + noise;
                        rockPositions.setX(i, x * scale);
                        rockPositions.setY(i, y * scale * 0.7);
                        rockPositions.setZ(i, z * scale);
                    }
                    rockPositions.needsUpdate = true;
                    rockGeom.computeVertexNormals();
                    const rockMat = new THREE.MeshStandardMaterial({ color: 0x7d7d7d, roughness: 0.9, metalness: 0.05 });
                    const rockInst = new THREE.InstancedMesh(rockGeom, rockMat, rockPosArr.length);
                    rockInst.castShadow = true;
                    rockInst.receiveShadow = true;
                    for (let i = 0; i < rockPosArr.length; i++) {
                        const p = rockPosArr[i];
                        dummy.position.set(p.x, p.y, p.z);
                        dummy.scale.setScalar(p.s);
                        dummy.rotation.set(Math.random(), Math.random(), Math.random());
                        dummy.updateMatrix();
                        rockInst.setMatrixAt(i, dummy.matrix);
                    }
                    propsGroup.add(rockInst);
                }

                if (iceArr.length > 0) {
                    const iceGeom = new THREE.ConeGeometry(0.55, 2.4, 6);
                    // Crystalline vertex displacement for ice formations
                    const icePositions = iceGeom.attributes.position;
                    for (let i = 0; i < icePositions.count; i++) {
                        const x = icePositions.getX(i);
                        const y = icePositions.getY(i);
                        const z = icePositions.getZ(i);
                        const radial = Math.sqrt(x * x + z * z);
                        if (radial > 0.02) {
                            const noise = Math.sin(x * 19.3 + z * 23.7) * Math.cos(y * 17.1) * 0.2;
                            icePositions.setX(i, x * (1 + noise));
                            icePositions.setZ(i, z * (1 + noise));
                        }
                    }
                    icePositions.needsUpdate = true;
                    iceGeom.computeVertexNormals();
                    const iceMat = new THREE.MeshStandardMaterial({
                        color: 0xa4dfff, roughness: 0.4, metalness: 0.1,
                        emissive: 0x66aaff, emissiveIntensity: 0.1
                    });
                    const iceInst = new THREE.InstancedMesh(iceGeom, iceMat, iceArr.length);
                    iceInst.castShadow = true;
                    iceInst.receiveShadow = true;
                    for (let i = 0; i < iceArr.length; i++) {
                        const p = iceArr[i];
                        dummy.position.set(p.x, p.y, p.z);
                        dummy.scale.setScalar(p.s);
                        dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
                        dummy.updateMatrix();
                        iceInst.setMatrixAt(i, dummy.matrix);
                    }
                    propsGroup.add(iceInst);
                }
            }
        }

        // Create sky dome with day/night support (much larger to cover horizon)
        // Sky dome should be close to camera far plane (5000) but not too close
        const skyRadius = useSphericalTerrain.value ? planetRadius * 8 : 3500;
        skyDome = createSkyDome(config, skyRadius);
        skyDome.renderOrder = -2; // Render first (furthest back)
        scene.value.add(skyDome);

        // Create starfield for night sky - MUST be smaller than sky dome
        starfield = createStarfield(skyRadius * 0.7);
        starfield.renderOrder = -1; // Render after sky dome but before terrain
        scene.value.add(starfield);

        // Update hemisphere light colors based on planet (using cached ref)
        if (hemiLight && config.atmosphereColor) {
            hemiLight.color.copy(config.atmosphereColor);
            hemiLight.groundColor.copy(config.baseColor);
        }

        // Reset day time to sunrise
        dayTime = 0.25;

        isLoading.value = false;
    }

    /**
     * Update day/night cycle
     */
    function updateDayNightCycle(delta: number) {
        if (!sunLight || !skyDome || !scene.value) return;

        const config = TERRAIN_CONFIGS[currentPlanet.value || 'earth'] || TERRAIN_CONFIGS.earth;

        // Advance time
        dayTime += delta / dayDuration;
        if (dayTime > 1) dayTime -= 1;

        // Update sun position (circular path) - reuse pre-allocated vector
        const sunAngle = dayTime * Math.PI * 2 - Math.PI / 2; // Start at horizon
        const sunHeight = Math.sin(sunAngle);
        const sunHorizontal = Math.cos(sunAngle);

        sunDirection.set(sunHorizontal, sunHeight, 0.3).normalize();

        // Update sun light position (reuse sunDirection, scale in-place then restore)
        sunLight.position.copy(sunDirection).multiplyScalar(200);

        // Update sun intensity based on height
        const intensity = Math.max(0, sunHeight) * 1.5 + 0.1;
        sunLight.intensity = intensity;

        // Update sun color (warmer at sunrise/sunset)
        if (sunHeight > 0 && sunHeight < 0.3) {
            sunLight.color.setHex(0xffaa66); // Orange
        } else if (sunHeight >= 0.3) {
            sunLight.color.setHex(0xffffff); // White
        } else {
            sunLight.color.setHex(0x4466aa); // Moonlight blue
        }

        // Shadow camera follows player for better shadow quality
        if (camera.value && sunLight.shadow) {
            sunLight.target.position.copy(camera.value.position);
            sunLight.target.updateMatrixWorld();
        }

        // Dynamic tonemap exposure: brighter midday, dimmer at night
        if (renderer.value) {
            const exposureBase = 0.3 + Math.max(0, sunHeight) * 0.9;
            renderer.value.toneMappingExposure = exposureBase;
        }

        // Update sky dome - follow camera position
        updateSkyDome(skyDome, sunDirection, !!config.atmosphereColor);
        if (camera.value) {
            skyDome.position.copy(camera.value.position);
        }

        // Update water animation
        if (waterMesh) {
            updateWater(waterMesh, dayTime * dayDuration, sunDirection);
        }

        // Update starfield - follow camera, twinkling, fade with daylight
        if (starfield) {
            updateStarfield(starfield, dayTime * dayDuration, sunHeight);
            if (camera.value) {
                starfield.position.copy(camera.value.position);
            }
        }

        // Update cached hemisphere light
        if (hemiLight) {
            hemiLight.intensity = Math.max(0.1, sunHeight * 0.4 + 0.2);
        }

        // Expose normalized time for HUD
        timeOfDay.value = dayTime;
    }

    function animate() {
        if (!isActive.value) return;

        animationId = requestAnimationFrame(animate);

        // Calculate actual time delta once for consistency
        const currentTime = performance.now() / 1000; // Convert to seconds
        const delta = Math.min(currentTime - lastTime, 1/30); // Cap at 30 FPS minimum
        lastTime = currentTime;

        // Update day/night cycle
        updateDayNightCycle(delta);

        // Update physics and movement
        updatePhysics(delta);

        // Animate dust particles
        if (dustSystem && camera.value) {
            dustSystem.position.copy(camera.value.position);
            dustSystem.position.y = 0;
        }

        if (renderer.value && scene.value && camera.value) {
            if (composer) {
                // Disable autoReset so PerformanceHUD sees total stats across all passes
                renderer.value.info.autoReset = false;
                renderer.value.info.reset();
                composer.render();
            } else {
                renderer.value.info.autoReset = true;
                renderer.value.render(scene.value, camera.value);
            }
        }
    }

    function updatePhysics(delta: number) {
        if (!camera.value) return;

        const moveSpeed = 18; // Walking speed (faster)
        const sprintMultiplier = moveState.sprint ? 2 : 1;

        if (useSphericalTerrain.value) {
            // SPHERICAL TERRAIN MOVEMENT
            // Get the "up" direction (away from planet center)
            sphereUp.copy(camera.value.position).normalize();

            // Get camera forward direction projected onto the tangent plane
            camera.value.getWorldDirection(sphereCameraDir);

            // Project forward onto tangent plane (remove the "up" component)
            const dotVal = sphereCameraDir.dot(sphereUp);
            sphereForward.copy(sphereCameraDir).addScaledVector(sphereUp, -dotVal).normalize();

            // Right is perpendicular to up and forward
            sphereRight.crossVectors(sphereForward, sphereUp).normalize();

            // Calculate movement on the tangent plane
            sphereMoveDir.set(0, 0, 0);
            if (moveState.forward) sphereMoveDir.add(sphereForward);
            if (moveState.backward) sphereMoveDir.sub(sphereForward);
            if (moveState.left) sphereMoveDir.sub(sphereRight);
            if (moveState.right) sphereMoveDir.add(sphereRight);

            if (sphereMoveDir.length() > 0) {
                sphereMoveDir.normalize().multiplyScalar(moveSpeed * sprintMultiplier * delta);
                camera.value.position.add(sphereMoveDir);

                // Re-normalize to stay on sphere surface
                const groundHeight = planetRadius + 2;
                camera.value.position.normalize().multiplyScalar(groundHeight);
            }

            // Keep camera "up" aligned with surface normal
            sphereNewUp.copy(camera.value.position).normalize();
            sphereWorldUp.set(0, 1, 0).applyQuaternion(camera.value.quaternion);

            // Smoothly rotate camera to align with new up
            if (sphereWorldUp.dot(sphereNewUp) < 0.9999) {
                sphereAxis.crossVectors(sphereWorldUp, sphereNewUp).normalize();
                const angle = Math.acos(Math.min(1, sphereWorldUp.dot(sphereNewUp)));
                const smoothAngle = angle * 0.1; // Smooth rotation

                sphereQuat.setFromAxisAngle(sphereAxis, smoothAngle);
                camera.value.quaternion.premultiply(sphereQuat);
            }

            // Always grounded on sphere (no jumping for now on spherical)
            isGrounded = true;

        } else {
            // FLAT TERRAIN MOVEMENT WITH INFINITE WRAPPING
            const eyeHeight = 2; // Player eye height above ground

            // Get camera forward direction (reuse temp vector)
            camera.value.getWorldDirection(tempVector3);
            tempVector3.y = 0; // Remove vertical component for ground movement
            tempVector3.normalize();

            // Store forward direction in pre-allocated vector before reusing tempVector3
            flatForwardDir.copy(tempVector3);

            // Calculate right vector (use tempVector3b)
            tempVector3b.crossVectors(flatForwardDir, upVector).normalize();

            // Calculate movement direction (reuse tempVector3)
            const moveDirection = tempVector3; // Reuse tempVector3
            moveDirection.set(0, 0, 0); // Reset

            if (moveState.forward) moveDirection.add(flatForwardDir);
            if (moveState.backward) moveDirection.sub(flatForwardDir);
            if (moveState.left) moveDirection.sub(tempVector3b); // Left = subtract right vector
            if (moveState.right) moveDirection.add(tempVector3b); // Right = add right vector

            if (moveDirection.length() > 0) {
                moveDirection.normalize();
                const movement = moveDirection.multiplyScalar(moveSpeed * sprintMultiplier * delta);
                camera.value.position.add(movement);
            }

            // Wrap position for infinite terrain feel
            // TODO Phase 7.7: Replace with proper chunk system using pre-generated terrain
            const halfSize = terrainSize / 2;
            if (camera.value.position.x > halfSize) {
                camera.value.position.x -= terrainSize;
            } else if (camera.value.position.x < -halfSize) {
                camera.value.position.x += terrainSize;
            }
            if (camera.value.position.z > halfSize) {
                camera.value.position.z -= terrainSize;
            } else if (camera.value.position.z < -halfSize) {
                camera.value.position.z += terrainSize;
            }

            // FIRST-PERSON CAMERA CONTROLS
            // Mouse look is handled in mousemove event (updates cameraYaw/cameraPitch directly)
            // Keyboard look for when mouse is not available
            const lookSpeed = 2.0; // radians per second for keyboard

            // Keyboard look controls (arrow keys)
            if (moveState.lookLeft) {
                cameraYaw += lookSpeed * delta;
            }
            if (moveState.lookRight) {
                cameraYaw -= lookSpeed * delta;
            }
            if (moveState.lookUp) {
                cameraPitch += lookSpeed * delta;
            }
            if (moveState.lookDown) {
                cameraPitch -= lookSpeed * delta;
            }

            // Clamp pitch to prevent camera flipping (same limits as mouse look)
            const maxPitch = Math.PI / 2.5; // ~72 degrees
            const minPitch = -Math.PI / 2.5; // ~-72 degrees
            cameraPitch = Math.max(minPitch, Math.min(maxPitch, cameraPitch));

            // Apply rotation with YXZ order (yaw first, then pitch, then roll)
            // This prevents gimbal lock - yaw always rotates around world Y axis
            camera.value.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');

            // JUMPING LOGIC FOR FLAT TERRAIN
            // Jump - must be checked BEFORE applying gravity
            if (moveState.jump && isGrounded) {
                playerVelocity.y = Math.sqrt(2 * currentGravity * 6); // Higher jump
                isGrounded = false;
                moveState.jump = false; // Consume the jump
            }

            // Apply gravity when not grounded - stronger but balanced
            if (!isGrounded) {
                playerVelocity.y -= currentGravity * 5 * delta;
                // Clamp falling speed to prevent tunneling through terrain
                playerVelocity.y = Math.max(playerVelocity.y, -40);
            }

            // Apply vertical velocity
            camera.value.position.y += playerVelocity.y * delta;

            // TERRAIN COLLISION: O(1) height lookup (no raycasting)
            let groundHeight = 0;
            if (terrainMesh) {
                groundHeight = getTerrainHeight(terrainMesh, camera.value.position.x, camera.value.position.z);
            }
            const targetY = groundHeight + eyeHeight;

            // Ground collision with smooth landing
            if (camera.value.position.y < targetY) {
                // Smooth landing interpolation when hitting ground
                const landingSpeed = 0.3; // Higher = faster landing snap
                camera.value.position.y = THREE.MathUtils.lerp(
                    camera.value.position.y,
                    targetY,
                    landingSpeed
                );

                // Snap if very close to avoid float precision issues
                if (Math.abs(camera.value.position.y - targetY) < 0.01) {
                    camera.value.position.y = targetY;
                }

                playerVelocity.y = 0;
                isGrounded = true;
            } else if (camera.value.position.y > targetY + 0.5) {
                isGrounded = false;
            }
        }

        // Update HUD values
        if (camera.value) {
            playerPosition.value.copy(camera.value.position);
            // Heading from camera forward vector on XZ plane
            camera.value.getWorldDirection(tempVector3);
            tempVector3.y = 0;
            if (tempVector3.lengthSq() > 0) {
                tempVector3.normalize();
                const angleRad = Math.atan2(tempVector3.x, tempVector3.z); // 0 = +Z
                let deg = THREE.MathUtils.radToDeg(angleRad);
                if (deg < 0) deg += 360;
                headingDeg.value = deg;
            }
        }
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (!isActive.value) return;

        switch (event.key.toLowerCase()) {
            case 'w': moveState.forward = true; break;
            case 's': moveState.backward = true; break;
            case 'a': moveState.left = true; break;
            case 'd': moveState.right = true; break;
            case ' ': moveState.jump = true; break;
            case 'shift': moveState.sprint = true; break;
            case 'escape':
                exit();
                break;
        }
        // Arrow keys for looking (don't use toLowerCase for these)
        switch (event.key) {
            case 'ArrowUp': moveState.lookUp = true; break;
            case 'ArrowDown': moveState.lookDown = true; break;
            case 'ArrowLeft': moveState.lookLeft = true; break;
            case 'ArrowRight': moveState.lookRight = true; break;
        }
    }

    function handleKeyUp(event: KeyboardEvent) {
        switch (event.key.toLowerCase()) {
            case 'w': moveState.forward = false; break;
            case 's': moveState.backward = false; break;
            case 'a': moveState.left = false; break;
            case 'd': moveState.right = false; break;
            case ' ': moveState.jump = false; break;
            case 'shift': moveState.sprint = false; break;
        }
        switch (event.key) {
            case 'ArrowUp': moveState.lookUp = false; break;
            case 'ArrowDown': moveState.lookDown = false; break;
            case 'ArrowLeft': moveState.lookLeft = false; break;
            case 'ArrowRight': moveState.lookRight = false; break;
        }
    }

    function handleResize() {
        if (!containerRef.value || !camera.value || !renderer.value) return;

        const w = containerRef.value.clientWidth;
        const h = containerRef.value.clientHeight;
        camera.value.aspect = w / h;
        camera.value.updateProjectionMatrix();
        renderer.value.setSize(w, h);
        if (composer) {
            composer.setSize(w, h);
        }
    }

    async function enter(planetName: string) {
        if (isActive.value) return;

        isActive.value = true;

        const sceneReady = initScene();
        if (!sceneReady) {
            console.error('Failed to initialize scene');
            isActive.value = false;
            return;
        }

        await loadPlanetSurface(planetName);
        lastTime = performance.now() / 1000; // Initialize so first frame gets a proper delta
        animate();

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('resize', handleResize);
    }

    function exit() {
        if (!isActive.value) return;

        isActive.value = false;
        currentPlanet.value = null;

        if (animationId !== null) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }

        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        window.removeEventListener('resize', handleResize);

        if (handleMouseMove) {
            document.removeEventListener('mousemove', handleMouseMove);
            handleMouseMove = null;
        }

        // Exit pointer lock if active
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        // Cleanup all GPU resources
        if (terrainMesh && scene.value) {
            scene.value.remove(terrainMesh);
            terrainMesh.geometry.dispose();
            const terrainMat = terrainMesh.material as THREE.MeshStandardMaterial;
            if (terrainMat.normalMap) terrainMat.normalMap.dispose();
            terrainMat.dispose();
            terrainMesh = null;
        }
        if (waterMesh && scene.value) {
            scene.value.remove(waterMesh);
            waterMesh.geometry.dispose();
            (waterMesh.material as THREE.Material).dispose();
            waterMesh = null;
        }
        if (skyDome && scene.value) {
            scene.value.remove(skyDome);
            skyDome.geometry.dispose();
            (skyDome.material as THREE.Material).dispose();
            skyDome = null;
        }
        if (starfield && scene.value) {
            scene.value.remove(starfield);
            starfield.geometry.dispose();
            (starfield.material as THREE.Material).dispose();
            starfield = null;
        }
        if (dustSystem && scene.value) {
            scene.value.remove(dustSystem);
            dustSystem.geometry.dispose();
            (dustSystem.material as THREE.Material).dispose();
            dustSystem = null;
        }
        if (propsGroup && scene.value) {
            // Dispose all props (InstancedMesh or regular Mesh) in the group
            propsGroup.children.forEach((child) => {
                if (child instanceof THREE.InstancedMesh || child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (child.material instanceof THREE.Material) {
                        child.material.dispose();
                    }
                }
            });
            scene.value.remove(propsGroup);
            propsGroup = null;
        }

        if (composer) {
            composer.dispose();
            composer = null;
        }
        renderer.value?.dispose();
        controls.value?.dispose();

        if (containerRef.value && renderer.value) {
            containerRef.value.removeChild(renderer.value.domElement);
        }

        scene.value = null;
        camera.value = null;
        renderer.value = null;
        controls.value = null;
        hemiLight = null;

        options.onExit?.();
    }

    /**
     * Get current terrain mesh for minimap
     */
    function getTerrainMesh(): THREE.Mesh | null {
        return terrainMesh;
    }

    /**
     * Get terrain size
     */
    function getTerrainSize(): number {
        return terrainMesh?.userData.terrainSize as number || 500;
    }

    return {
        isActive,
        isLoading,
        currentPlanet,
        playerPosition,
        headingDeg,
        timeOfDay,
        getTerrainMesh,
        getTerrainSize,
        enter,
        exit,
    };
}
