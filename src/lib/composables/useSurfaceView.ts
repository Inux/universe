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
import {
    PREGENERATED_TERRAINS,
    canWalkSurface,
    defaultExploreMode,
    surfaceKind,
    type ExploreMode,
} from '../three/exploration';
import {
    applySphereLook,
    headingDegrees,
    lookFromHeading,
    projectHeading,
    radialUp,
    tangentFrame,
    yawHeading,
} from '../three/sphereFrame';
import { RELIEF_CANDIDATES, createMappedSurface } from '../three/mappedSurface';

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
    const exploreMode = ref<ExploreMode>('walk');
    const canWalk = ref(true);
    const altitude = ref(0);

    const WALK_EYE = 2;
    const FLY_CLEARANCE = 8;
    const FLY_CRUISE = 48;
    const FLY_CEILING = 160;
    const FLY_SPEED = 70;

    const scene = shallowRef<THREE.Scene | null>(null);
    const camera = shallowRef<THREE.PerspectiveCamera | null>(null);
    const renderer = shallowRef<THREE.WebGLRenderer | null>(null);
    const controls = shallowRef<PointerLockControls | null>(null);

    let animationId: number | null = null;
    let terrainMesh: THREE.Mesh | null = null;
    let updateMapped: ((cameraPosition: THREE.Vector3) => void) | null = null;
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
    let ssaoPass: SSAOPass | null = null;

    // Cached scene references (avoid per-frame searches)
    let hemiLight: THREE.HemisphereLight | null = null;

    // Pre-allocated vector for sun direction (reused every frame)
    const sunDirection = new THREE.Vector3();

    // Day/night cycle
    let dayTime = 0.42; // Mid-morning, so the surface is lit on arrival (0.5 = noon)
    const dayDuration = 120; // Seconds for a full day cycle

    // Closed planet. Circumference is about 3016, so a walk laps in a few minutes.
    // The flat branch remains in this file and is not what enter() shows.
    const WALK_PLANET_RADIUS = 480;
    const useSphericalTerrain = ref(true);
    let terrainSize = 1000; // Size of the unused flat patch

    // Player state for surface exploration
    const playerPosition = ref(new THREE.Vector3(0, 5, 0));
    const headingDeg = ref(0); // 0 = north, clockwise toward east
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
        descend: false,
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

    // Sphere frame. Heading is parallel-transported; do not rebuild it from world up.
    const sphereUp = new THREE.Vector3();
    const sphereRight = new THREE.Vector3();
    const sphereMoveDir = new THREE.Vector3();
    const sphereHeading = new THREE.Vector3(0, 1, 0);
    const sphereEast = new THREE.Vector3();
    const sphereNorth = new THREE.Vector3();
    const sphereLook = new THREE.Vector3();
    let lastAppliedYaw = 0;
    let radialVelocity = 0;

    // Pre-allocated vector for flat terrain forward direction (reused every frame)
    const flatForwardDir = new THREE.Vector3();
    const flyForward = new THREE.Vector3();
    const flyFlat = new THREE.Vector3();
    const flyRight = new THREE.Vector3();

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

        // The composer resolves its own target, so canvas MSAA would be unused.
        renderer.value = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: 'high-performance',
        });
        renderer.value.setSize(width, height);
        renderer.value.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
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

        // Set up SSAO post-processing for contact shadows.
        // Half-resolution SSAO and a 16-sample kernel: the full-res 32-tap pass
        // was redrawing the scene several times per frame.
        const beautyTarget = new THREE.WebGLRenderTarget(width, height, { samples: 2 });
        composer = new EffectComposer(renderer.value, beautyTarget);
        const renderPass = new RenderPass(scene.value, camera.value);
        composer.addPass(renderPass);

        ssaoPass = new SSAOPass(
            scene.value,
            camera.value,
            Math.max(1, Math.floor(width / 2)),
            Math.max(1, Math.floor(height / 2)),
            16
        );
        ssaoPass.kernelRadius = 8;
        ssaoPass.minDistance = 0.002;
        ssaoPass.maxDistance = 0.12;
        ssaoPass.output = SSAOPass.OUTPUT.Default;
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
            const release = terrainMesh.userData.disposeMapped as (() => void) | undefined;
            release?.();
            terrainMesh.geometry.dispose();
            (terrainMesh.material as THREE.Material).dispose();
            terrainMesh = null;
            updateMapped = null;
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
        const kind = surfaceKind(planetName);

        if (useSphericalTerrain.value) {
            const mapped = RELIEF_CANDIDATES.has(planetName)
                ? await createMappedSurface(planetName, WALK_PLANET_RADIUS)
                : null;
            if (mapped) {
                terrainMesh = mapped.mesh;
                scene.value.add(terrainMesh);
                waterMesh = mapped.water;
                if (waterMesh) scene.value.add(waterMesh);
                propsGroup = mapped.scatter;
                if (propsGroup) scene.value.add(propsGroup);
                updateMapped = mapped.update;
                if (camera.value) placeOnSphere(mapped.spawnDir);
            } else {
                terrainMesh = createSphericalTerrain(planetName, WALK_PLANET_RADIUS, 256, 128);
                scene.value.add(terrainMesh);

                waterMesh = createSphericalWater(WALK_PLANET_RADIUS, config);
                if (waterMesh) {
                    scene.value.add(waterMesh);
                }

                if (camera.value && terrainMesh) {
                    placeOnSphere(findSphereSpawn(terrainMesh));
                }
            }
        } else {
            // Load pre-generated terrain (Phase 7.7)
            terrainSize = 1000; // Terrain size

            if (PREGENERATED_TERRAINS.has(planetName)) {
                try {
                    terrainMesh = await createTerrainFromPreGenerated(planetName, terrainSize);
                    terrainMesh.castShadow = false;
                    terrainMesh.receiveShadow = true;
                    scene.value.add(terrainMesh);
                } catch (error) {
                    console.warn(`Failed to load pre-generated terrain for ${planetName}, falling back to runtime generation:`, error);
                }
            }
            if (!terrainMesh) {
                terrainMesh = createTerrainMesh(planetName, terrainSize, 256, false);
                terrainMesh.castShadow = false;
                terrainMesh.receiveShadow = true;
                scene.value.add(terrainMesh);
            }

            // Create water if applicable
            waterMesh = createWaterPlane(terrainSize, config);
            if (waterMesh) {
                scene.value.add(waterMesh);
            }

            // Walk starts on dry ground. Fly starts above that same point, looking down.
            if (camera.value && terrainMesh) {
                const waterY = waterMesh ? waterMesh.position.y : null;
                placeExplorer(findDrySpawn(terrainMesh, waterY));
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
                const fogColor = config.atmosphereColor.clone();
                if (kind === 'ground') {
                    // Rayleigh tint: distant ground shifts toward blue.
                    fogColor.multiplyScalar(0.4);
                    fogColor.lerp(new THREE.Color(0.5, 0.6, 0.85), 0.3);
                    scene.value.fog = new THREE.FogExp2(fogColor.getHex(), 0.0016);
                } else if (kind === 'photosphere') {
                    fogColor.multiplyScalar(0.55);
                    scene.value.fog = new THREE.FogExp2(fogColor.getHex(), 0.0024);
                } else {
                    fogColor.multiplyScalar(0.45);
                    scene.value.fog = new THREE.FogExp2(fogColor.getHex(), 0.0018);
                }
            } else {
                scene.value.fog = null;
            }
        }

        // Mars dust is a flat disk around the origin. On a sphere that is the planet center.
        if (planetName === 'mars' && scene.value && !useSphericalTerrain.value) {
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
        // Rocks and plants sit on solid ground. A cloud deck and the photosphere stay empty.
        if (scene.value && terrainMesh && kind === 'ground' && !useSphericalTerrain.value) {
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
        const skyRadius = useSphericalTerrain.value ? WALK_PLANET_RADIUS * 6 : 3500;
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

        // Mid-morning. A dawn start left cloud decks in the dark.
        dayTime = 0.42;

        isLoading.value = false;
    }

    /**
     * Update day/night cycle
     */
    function updateDayNightCycle(delta: number) {
        if (!sunLight || !skyDome || !scene.value) return;

        const config = TERRAIN_CONFIGS[currentPlanet.value || 'earth'] || TERRAIN_CONFIGS.earth;

        if (config.selfLit) {
            // On the photosphere the light does not set.
            sunDirection.set(0.15, 0.95, 0.2).normalize();
            placeSunLight();
            sunLight.intensity = 1.4;
            sunLight.color.setHex(0xfff4dd);
            if (renderer.value) renderer.value.toneMappingExposure = 1.05;
            updateSkyDome(skyDome, sunDirection, true);
            if (camera.value) skyDome.position.copy(camera.value.position);
            if (starfield) {
                updateStarfield(starfield, 0, 1);
                if (camera.value) starfield.position.copy(camera.value.position);
            }
            if (hemiLight) hemiLight.intensity = 0.55;
            timeOfDay.value = 0.5;
            return;
        }

        // Advance time
        dayTime += delta / dayDuration;
        if (dayTime > 1) dayTime -= 1;

        // Update sun position (circular path) - reuse pre-allocated vector
        const sunAngle = dayTime * Math.PI * 2 - Math.PI / 2; // Start at horizon
        const sunHeight = Math.sin(sunAngle);
        const sunHorizontal = Math.cos(sunAngle);

        sunDirection.set(sunHorizontal, sunHeight, 0.3).normalize();

        // On the sphere the sun stays a world direction, offset from the player,
        // so walking around the planet changes the local time of day.
        placeSunLight();

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
        if (updateMapped && camera.value) updateMapped(camera.value.position);

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

    function placeSunLight() {
        if (!sunLight) return;
        if (useSphericalTerrain.value && camera.value) {
            sunLight.position.copy(camera.value.position).addScaledVector(sunDirection, 200);
        } else {
            sunLight.position.copy(sunDirection).multiplyScalar(200);
        }
    }

    function groundRadius(dir: THREE.Vector3): number {
        const radiusAt = terrainMesh?.userData.radiusAt as ((d: THREE.Vector3) => number) | undefined;
        if (!radiusAt) return WALK_PLANET_RADIUS;
        return radiusAt(dir);
    }

    function updateSpherePhysics(delta: number) {
        const cam = camera.value;
        if (!cam) return;
        const flying = exploreMode.value === 'fly';

        const lookSpeed = 2.0;
        if (moveState.lookLeft) cameraYaw += lookSpeed * delta;
        if (moveState.lookRight) cameraYaw -= lookSpeed * delta;
        if (moveState.lookUp) cameraPitch += lookSpeed * delta;
        if (moveState.lookDown) cameraPitch -= lookSpeed * delta;
        const maxPitch = Math.PI / 2.5;
        cameraPitch = Math.max(-maxPitch, Math.min(maxPitch, cameraPitch));

        radialUp(sphereUp, cam.position);
        projectHeading(sphereHeading, sphereUp);
        const dYaw = cameraYaw - lastAppliedYaw;
        if (dYaw !== 0) {
            yawHeading(sphereHeading, sphereUp, dYaw, sphereRight);
            lastAppliedYaw = cameraYaw;
        }
        // right = heading × up. Facing north at +Z, right is +X.
        sphereRight.crossVectors(sphereHeading, sphereUp).normalize();
        lookFromHeading(sphereLook, sphereHeading, sphereUp, cameraPitch);

        sphereMoveDir.set(0, 0, 0);
        if (flying) {
            const speed = FLY_SPEED * (moveState.sprint ? 2.2 : 1);
            if (moveState.forward) sphereMoveDir.add(sphereLook);
            if (moveState.backward) sphereMoveDir.sub(sphereLook);
            if (moveState.left) sphereMoveDir.sub(sphereRight);
            if (moveState.right) sphereMoveDir.add(sphereRight);
            if (moveState.jump) sphereMoveDir.add(sphereUp);
            if (moveState.descend) sphereMoveDir.sub(sphereUp);
            if (sphereMoveDir.lengthSq() > 0) {
                sphereMoveDir.normalize().multiplyScalar(speed * delta);
                cam.position.add(sphereMoveDir);
            }
            radialUp(sphereUp, cam.position);
            const ground = groundRadius(sphereUp);
            let radius = cam.position.length();
            const minR = ground + FLY_CLEARANCE;
            const maxR = ground + FLY_CEILING;
            if (radius < minR) radius = minR;
            else if (radius > maxR) radius = maxR;
            cam.position.copy(sphereUp).multiplyScalar(radius);
            radialVelocity = 0;
            isGrounded = false;
            altitude.value = radius - ground;
        } else {
            const speed = 18 * (moveState.sprint ? 2 : 1);
            if (moveState.forward) sphereMoveDir.add(sphereHeading);
            if (moveState.backward) sphereMoveDir.sub(sphereHeading);
            if (moveState.left) sphereMoveDir.sub(sphereRight);
            if (moveState.right) sphereMoveDir.add(sphereRight);
            if (sphereMoveDir.lengthSq() > 0) {
                sphereMoveDir.normalize().multiplyScalar(speed * delta);
                cam.position.add(sphereMoveDir);
            }

            if (moveState.jump && isGrounded) {
                radialVelocity = Math.sqrt(2 * currentGravity * 6);
                isGrounded = false;
                moveState.jump = false;
            }
            if (!isGrounded) {
                radialVelocity -= currentGravity * 5 * delta;
                if (radialVelocity < -40) radialVelocity = -40;
            }

            radialUp(sphereUp, cam.position);
            let radius = cam.position.length() + radialVelocity * delta;
            const ground = groundRadius(sphereUp);
            const floor = ground + WALK_EYE;
            // Snap into the ground, and stick across a small downhill gap so a slope is not a jump.
            if (radius <= floor || (radialVelocity <= 0 && radius < floor + 0.45)) {
                radius = floor;
                radialVelocity = 0;
                isGrounded = true;
            } else {
                isGrounded = false;
            }
            cam.position.copy(sphereUp).multiplyScalar(radius);
            altitude.value = radius - ground;
        }

        projectHeading(sphereHeading, sphereUp);
        lookFromHeading(sphereLook, sphereHeading, sphereUp, cameraPitch);
        applySphereLook(cam, sphereLook, sphereUp);

        playerPosition.value.copy(cam.position);
        tangentFrame(sphereUp, sphereEast, sphereNorth);
        headingDeg.value = headingDegrees(sphereHeading, sphereNorth, sphereEast);
    }

    function updatePhysics(delta: number) {
        if (!camera.value) return;

        if (useSphericalTerrain.value) {
            updateSpherePhysics(delta);
            return;
        }

        const moveSpeed = 18; // Walking speed (faster)
        const sprintMultiplier = moveState.sprint ? 2 : 1;

        {
            const flying = exploreMode.value === 'fly';
            const eyeHeight = WALK_EYE;

            if (!flying) {
                // Camera.getWorldDirection is the look direction (−Z). Flat it for walking.
                camera.value.getWorldDirection(tempVector3);
                tempVector3.y = 0;
                tempVector3.normalize();
                flatForwardDir.copy(tempVector3);
                // look × up = right. look (0,0,−1) → right (1,0,0).
                tempVector3b.crossVectors(flatForwardDir, upVector).normalize();

                const moveDirection = tempVector3;
                moveDirection.set(0, 0, 0);
                if (moveState.forward) moveDirection.add(flatForwardDir);
                if (moveState.backward) moveDirection.sub(flatForwardDir);
                if (moveState.left) moveDirection.sub(tempVector3b);
                if (moveState.right) moveDirection.add(tempVector3b);

                if (moveDirection.length() > 0) {
                    moveDirection.normalize();
                    const movement = moveDirection.multiplyScalar(moveSpeed * sprintMultiplier * delta);
                    camera.value.position.add(movement);
                }
                wrapFlatPosition();
            }

            // Mouse look writes cameraYaw/cameraPitch. Arrows do the same when the pointer is free.
            const lookSpeed = 2.0;
            if (moveState.lookLeft) cameraYaw += lookSpeed * delta;
            if (moveState.lookRight) cameraYaw -= lookSpeed * delta;
            if (moveState.lookUp) cameraPitch += lookSpeed * delta;
            if (moveState.lookDown) cameraPitch -= lookSpeed * delta;

            const maxPitch = Math.PI / 2.5;
            const minPitch = -Math.PI / 2.5;
            cameraPitch = Math.max(minPitch, Math.min(maxPitch, cameraPitch));
            camera.value.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');

            if (flying) {
                flyStep(delta);
            } else {
                if (moveState.jump && isGrounded) {
                    playerVelocity.y = Math.sqrt(2 * currentGravity * 6);
                    isGrounded = false;
                    moveState.jump = false;
                }

                if (!isGrounded) {
                    playerVelocity.y -= currentGravity * 5 * delta;
                    playerVelocity.y = Math.max(playerVelocity.y, -40);
                }

                camera.value.position.y += playerVelocity.y * delta;

                const groundHeight = terrainMesh
                    ? getTerrainHeight(terrainMesh, camera.value.position.x, camera.value.position.z)
                    : 0;
                const targetY = groundHeight + eyeHeight;

                if (camera.value.position.y < targetY) {
                    const landingSpeed = 0.3;
                    camera.value.position.y = THREE.MathUtils.lerp(
                        camera.value.position.y,
                        targetY,
                        landingSpeed
                    );
                    if (Math.abs(camera.value.position.y - targetY) < 0.01) {
                        camera.value.position.y = targetY;
                    }
                    playerVelocity.y = 0;
                    isGrounded = true;
                } else if (camera.value.position.y > targetY + 0.5) {
                    isGrounded = false;
                }
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
            altitude.value = camera.value.position.y - groundAt(camera.value.position.x, camera.value.position.z);
        }
    }

    function groundAt(x: number, z: number): number {
        if (!terrainMesh) return 0;
        return getTerrainHeight(terrainMesh, x, z);
    }

    function wrapFlatPosition() {
        if (!camera.value) return;
        const halfSize = terrainSize / 2;
        const p = camera.value.position;
        if (p.x > halfSize) p.x -= terrainSize;
        else if (p.x < -halfSize) p.x += terrainSize;
        if (p.z > halfSize) p.z -= terrainSize;
        else if (p.z < -halfSize) p.z += terrainSize;
    }

    function flyStep(delta: number) {
        if (!camera.value) return;
        // Camera.getWorldDirection is the look direction, pitch included.
        camera.value.getWorldDirection(flyForward);
        flyFlat.copy(flyForward);
        flyFlat.y = 0;
        if (flyFlat.lengthSq() < 1e-8) {
            // Looking straight up or down. Screen-right stays matrix column 0 (no roll).
            flyRight.setFromMatrixColumn(camera.value.matrixWorld, 0);
            flyRight.y = 0;
            if (flyRight.lengthSq() > 1e-8) {
                flyRight.normalize();
                // up × right = horizontal forward. right (1,0,0) → forward (0,0,−1).
                flyFlat.crossVectors(upVector, flyRight);
            } else {
                flyRight.set(0, 0, 0);
            }
        } else {
            flyFlat.normalize();
            // look × up = right. look (0,0,−1) → right (1,0,0).
            flyRight.crossVectors(flyFlat, upVector).normalize();
        }

        const move = tempVector3;
        move.set(0, 0, 0);
        if (moveState.forward) move.add(flyForward);
        if (moveState.backward) move.sub(flyForward);
        if (moveState.left) move.sub(flyRight);
        if (moveState.right) move.add(flyRight);
        if (moveState.jump) move.y += 1;
        if (moveState.descend) move.y -= 1;
        if (move.lengthSq() > 0) {
            const speed = FLY_SPEED * (moveState.sprint ? 2.2 : 1);
            move.normalize().multiplyScalar(speed * delta);
            camera.value.position.add(move);
        }
        wrapFlatPosition();

        const ground = groundAt(camera.value.position.x, camera.value.position.z);
        const minY = ground + FLY_CLEARANCE;
        const maxY = ground + FLY_CEILING;
        if (camera.value.position.y < minY) camera.value.position.y = minY;
        else if (camera.value.position.y > maxY) camera.value.position.y = maxY;
        playerVelocity.y = 0;
        isGrounded = false;
    }

    function placeExplorer(groundPoint: THREE.Vector3) {
        if (!camera.value) return;
        const flying = exploreMode.value === 'fly';
        const y = groundPoint.y + (flying ? FLY_CRUISE : WALK_EYE);
        camera.value.position.set(groundPoint.x, y, groundPoint.z);
        playerPosition.value.set(groundPoint.x, y, groundPoint.z);
        camera.value.up.set(0, 1, 0);
        cameraYaw = 0;
        cameraPitch = flying ? -0.42 : 0;
        camera.value.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');
        playerVelocity.set(0, 0, 0);
        isGrounded = !flying;
        altitude.value = y - groundPoint.y;
    }

    function resetMoveState() {
        moveState.forward = false;
        moveState.backward = false;
        moveState.left = false;
        moveState.right = false;
        moveState.jump = false;
        moveState.sprint = false;
        moveState.lookUp = false;
        moveState.lookDown = false;
        moveState.lookLeft = false;
        moveState.lookRight = false;
        moveState.descend = false;
    }

    function setExploreMode(mode: ExploreMode) {
        if (!camera.value) {
            exploreMode.value = mode === 'walk' && !canWalk.value ? 'fly' : mode;
            return;
        }
        if (mode === 'walk' && !canWalk.value) mode = 'fly';
        if (mode === exploreMode.value) return;

        exploreMode.value = mode;
        if (useSphericalTerrain.value) {
            radialUp(sphereUp, camera.value.position);
            const ground = groundRadius(sphereUp);
            let radius = camera.value.position.length();
            if (mode === 'fly') {
                const lifted = ground + 28;
                if (radius < lifted) radius = lifted;
                isGrounded = false;
            } else {
                radius = ground + WALK_EYE;
                isGrounded = true;
            }
            camera.value.position.copy(sphereUp).multiplyScalar(radius);
            radialVelocity = 0;
            playerVelocity.set(0, 0, 0);
            moveState.jump = false;
            moveState.descend = false;
            projectHeading(sphereHeading, sphereUp);
            lookFromHeading(sphereLook, sphereHeading, sphereUp, cameraPitch);
            applySphereLook(camera.value, sphereLook, sphereUp);
            playerPosition.value.copy(camera.value.position);
            altitude.value = radius - ground;
            tangentFrame(sphereUp, sphereEast, sphereNorth);
            headingDeg.value = headingDegrees(sphereHeading, sphereNorth, sphereEast);
            return;
        }
        const x = camera.value.position.x;
        const z = camera.value.position.z;
        const ground = groundAt(x, z);
        playerVelocity.set(0, 0, 0);
        moveState.jump = false;
        moveState.descend = false;
        if (mode === 'fly') {
            const lifted = ground + 28;
            if (camera.value.position.y < lifted) camera.value.position.y = lifted;
            isGrounded = false;
        } else {
            camera.value.position.y = ground + WALK_EYE;
            isGrounded = true;
        }
        playerPosition.value.copy(camera.value.position);
        altitude.value = camera.value.position.y - ground;
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (!isActive.value) return;

        switch (event.key.toLowerCase()) {
            case 'w': moveState.forward = true; break;
            case 's': moveState.backward = true; break;
            case 'a': moveState.left = true; break;
            case 'd': moveState.right = true; break;
            case ' ':
                moveState.jump = true;
                event.preventDefault();
                break;
            case 'shift': moveState.sprint = true; break;
            case 'control':
                moveState.descend = true;
                break;
            case 'f':
                if (!event.repeat) {
                    setExploreMode(exploreMode.value === 'walk' ? 'fly' : 'walk');
                }
                event.preventDefault();
                break;
            case 'escape':
                exit();
                break;
        }
        switch (event.key) {
            case 'ArrowUp': moveState.lookUp = true; event.preventDefault(); break;
            case 'ArrowDown': moveState.lookDown = true; event.preventDefault(); break;
            case 'ArrowLeft': moveState.lookLeft = true; event.preventDefault(); break;
            case 'ArrowRight': moveState.lookRight = true; event.preventDefault(); break;
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
            case 'control': moveState.descend = false; break;
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
            // Composer resizes every pass to the full buffer. Put SSAO back to half res.
            ssaoPass?.setSize(Math.max(1, Math.floor(w / 2)), Math.max(1, Math.floor(h / 2)));
        }
    }

    function placeOnSphere(dir: THREE.Vector3) {
        if (!camera.value) return;
        const flying = exploreMode.value === 'fly';
        const ground = groundRadius(dir);
        const radius = ground + (flying ? FLY_CRUISE : WALK_EYE);
        const cam = camera.value;
        cam.position.copy(dir).normalize().multiplyScalar(radius);
        radialUp(sphereUp, cam.position);
        tangentFrame(sphereUp, sphereEast, sphereNorth);
        sphereHeading.copy(sphereNorth);
        cameraYaw = 0;
        cameraPitch = flying ? -0.42 : 0;
        lastAppliedYaw = 0;
        radialVelocity = 0;
        playerVelocity.set(0, 0, 0);
        isGrounded = !flying;
        lookFromHeading(sphereLook, sphereHeading, sphereUp, cameraPitch);
        applySphereLook(cam, sphereLook, sphereUp);
        playerPosition.value.copy(cam.position);
        altitude.value = radius - ground;
        headingDeg.value = 0;
    }

    /**
     * A dry point near the equator. Fallback is +Z if every sample is underwater.
     * The returned vector is a new one; callers may keep it.
     */
    function findSphereSpawn(terrain: THREE.Mesh): THREE.Vector3 {
        const radiusAt = terrain.userData.radiusAt as ((d: THREE.Vector3) => number) | undefined;
        const waterR = (terrain.userData.waterRadius as number) ?? -1;
        const base = (terrain.userData.planetRadius as number) ?? WALK_PLANET_RADIUS;
        const relief = (terrain.userData.relief as number) ?? 30;
        const modest = base + relief * 0.5;
        const probe = new THREE.Vector3();
        let best = new THREE.Vector3(0, 0, 1);
        let bestScore = -Infinity;
        let found = false;
        const latitudes = [0.05, 0.22, -0.18, 0.4];
        for (const latY of latitudes) {
            let ringFound = false;
            for (let i = 0; i < 48; i++) {
                const lon = (i / 48) * Math.PI * 2;
                probe.set(Math.sin(lon), latY, Math.cos(lon)).normalize();
                const radial = radiusAt ? radiusAt(probe) : base;
                const dry = waterR < 0 || radial > waterR + 1.5;
                if (!dry) continue;
                ringFound = true;
                found = true;
                const score = -Math.abs(radial - modest);
                if (score > bestScore) {
                    bestScore = score;
                    best = probe.clone();
                }
            }
            if (ringFound) break;
        }
        if (!found) best.set(0, 0, 1);
        return best;
    }

    function findDrySpawn(terrain: THREE.Mesh, waterY: number | null): THREE.Vector3 {
        const size = terrain.userData.terrainSize as number;
        const originY = getTerrainHeight(terrain, 0, 0);
        if (waterY == null || originY > waterY + 2) {
            return new THREE.Vector3(0, originY, 0);
        }

        const step = size / 20;
        let bestX = 0;
        let bestZ = 0;
        let bestY = originY;
        let bestScore = -Infinity;
        for (let z = -size / 2 + step; z < size / 2; z += step) {
            for (let x = -size / 2 + step; x < size / 2; x += step) {
                const y = getTerrainHeight(terrain, x, z);
                if (y < waterY + 2) continue;
                const score = -Math.hypot(x, z);
                if (score > bestScore) {
                    bestScore = score;
                    bestX = x;
                    bestZ = z;
                    bestY = y;
                }
            }
        }
        return new THREE.Vector3(bestX, bestY, bestZ);
    }

    async function enter(planetName: string, mode?: ExploreMode) {
        if (isActive.value) return;

        isActive.value = true;
        canWalk.value = canWalkSurface(planetName);
        const requested = mode ?? defaultExploreMode(planetName);
        exploreMode.value = requested === 'walk' && !canWalk.value ? 'fly' : requested;
        resetMoveState();

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
        resetMoveState();

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
            const release = terrainMesh.userData.disposeMapped as (() => void) | undefined;
            release?.();
            terrainMesh.geometry.dispose();
            updateMapped = null;
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
        exploreMode,
        canWalk,
        altitude,
        playerPosition,
        headingDeg,
        timeOfDay,
        getTerrainMesh,
        getTerrainSize,
        setExploreMode,
        enter,
        exit,
    };
}
