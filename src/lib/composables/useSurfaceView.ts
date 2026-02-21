import { ref, shallowRef, type Ref } from 'vue';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
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
        sunLight.shadow.camera.left = -100;
        sunLight.shadow.camera.right = 100;
        sunLight.shadow.camera.top = 100;
        sunLight.shadow.camera.bottom = -100;
        scene.value.add(sunLight);

        // Rim light (opposite sun) for subtle edge lighting
        rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
        rimLight.position.set(-100, 80, -50);
        scene.value.add(rimLight);

        // Hemisphere light for sky/ground color bleeding
        hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x8b4513, 0.4);
        scene.value.add(hemiLight);

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

        // Exponential fog for planets with atmosphere (avoids banding unlike linear fog)
        if (scene.value) {
            if (config.atmosphereColor) {
                // Use FogExp2 - exponential squared fog for smooth distance fade
                const fogColor = config.atmosphereColor.clone().multiplyScalar(0.4);
                scene.value.fog = new THREE.FogExp2(fogColor.getHex(), 0.0018);
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
        if (scene.value && terrainMesh) {
            propsGroup = new THREE.Group();
            scene.value.add(propsGroup);
            const size = (terrainMesh.userData.terrainSize as number) ?? 500;
            const half = size / 2;

            const dummy = new THREE.Object3D(); // Reusable transform helper

            if (planetName === 'earth' && config.hasBiomes) {
                const generator = new TerrainGenerator(config, planetName.length * 1000);

                // Sample biomes and collect positions per type
                const treeFoliagePositions: { x: number; y: number; z: number; s: number }[] = [];
                const treeTrunkPositions: { x: number; y: number; z: number; s: number }[] = [];
                const bushPositions: { x: number; y: number; z: number; s: number }[] = [];
                const cactusPositions: { x: number; y: number; z: number; s: number }[] = [];
                const rockPositions: { x: number; y: number; z: number; s: number }[] = [];
                const icePositions: { x: number; y: number; z: number; s: number }[] = [];

                const propCount = 300;
                for (let i = 0; i < propCount; i++) {
                    const x = (Math.random() * 2 - 1) * half;
                    const z = (Math.random() * 2 - 1) * half;
                    const y = getTerrainHeight(terrainMesh, x, z);

                    const nx = (x / size + 0.5) * 3;
                    const nz = (z / size + 0.5) * 3;
                    const height = generator.getHeight(nx, nz);
                    const normalizedHeight = height / config.amplitude;
                    const biome = generator.getBiome(nx, nz, normalizedHeight);

                    switch (biome) {
                        case BiomeType.FOREST:
                            if (Math.random() > 0.25) {
                                const s = 0.7 + Math.random() * 0.6;
                                treeFoliagePositions.push({ x, y: y + 2.0 * s, z, s });
                                treeTrunkPositions.push({ x, y: y + 0.8 * s, z, s });
                            }
                            break;
                        case BiomeType.PLAINS:
                            if (Math.random() > 0.65) {
                                bushPositions.push({ x, y: y + 0.3, z, s: 0.4 + Math.random() * 0.4 });
                            }
                            break;
                        case BiomeType.DESERT:
                            if (Math.random() > 0.55) {
                                if (Math.random() > 0.5) {
                                    cactusPositions.push({ x, y: y + 1, z, s: 0.8 + Math.random() * 0.4 });
                                } else {
                                    rockPositions.push({ x, y, z, s: 0.5 + Math.random() * 0.5 });
                                }
                            }
                            break;
                        case BiomeType.TUNDRA:
                            if (Math.random() > 0.65) {
                                icePositions.push({ x, y: y + 0.75, z, s: 0.6 + Math.random() * 0.5 });
                            }
                            break;
                        case BiomeType.MOUNTAIN:
                            if (Math.random() > 0.45) {
                                rockPositions.push({ x, y, z, s: 0.8 + Math.random() * 1.2 });
                            }
                            break;
                        case BiomeType.BEACH:
                            if (Math.random() > 0.85) {
                                treeTrunkPositions.push({ x, y: y + 1.5, z, s: 0.8 + Math.random() * 0.3 });
                            }
                            break;
                    }
                }

                // Create InstancedMesh batches
                if (treeFoliagePositions.length > 0) {
                    const geom = new THREE.ConeGeometry(0.9, 3.0, 6);
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

                if (treeTrunkPositions.length > 0) {
                    const geom = new THREE.CylinderGeometry(0.15, 0.2, 1.8, 6);
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
                    const geom = new THREE.SphereGeometry(0.5, 6, 6);
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
                    const geom = new THREE.IcosahedronGeometry(0.8, 0);
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
                    const geom = new THREE.ConeGeometry(0.4, 1.5, 5);
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
                // Non-Earth planets: instanced rocks
                const rockGeom = new THREE.IcosahedronGeometry(1, 0);
                const rockMat = new THREE.MeshStandardMaterial({ color: 0x7d7d7d, roughness: 0.9, metalness: 0.05 });
                const rockCount = 50;
                const rockInst = new THREE.InstancedMesh(rockGeom, rockMat, rockCount);
                rockInst.castShadow = true;
                rockInst.receiveShadow = true;
                for (let i = 0; i < rockCount; i++) {
                    const scale = 0.6 + Math.random() * 1.4;
                    const x = (Math.random() * 2 - 1) * half;
                    const z = (Math.random() * 2 - 1) * half;
                    const y = getTerrainHeight(terrainMesh, x, z);
                    dummy.position.set(x, y, z);
                    dummy.scale.setScalar(scale);
                    dummy.rotation.set(Math.random(), Math.random(), Math.random());
                    dummy.updateMatrix();
                    rockInst.setMatrixAt(i, dummy.matrix);
                }
                propsGroup.add(rockInst);

                // Ice formations on cold planets (instanced)
                const coldPlanets = ['pluto', 'eris', 'makemake', 'haumea', 'moon'];
                if (coldPlanets.includes(planetName)) {
                    const iceGeom = new THREE.ConeGeometry(0.6, 2.4, 5);
                    const iceMat = new THREE.MeshStandardMaterial({
                        color: 0xa4dfff, roughness: 0.4, metalness: 0.1,
                        emissive: 0x66aaff, emissiveIntensity: 0.1
                    });
                    const iceCount = 35;
                    const iceInst = new THREE.InstancedMesh(iceGeom, iceMat, iceCount);
                    iceInst.castShadow = true;
                    iceInst.receiveShadow = true;
                    for (let i = 0; i < iceCount; i++) {
                        const x = (Math.random() * 2 - 1) * half;
                        const z = (Math.random() * 2 - 1) * half;
                        const y = getTerrainHeight(terrainMesh, x, z);
                        dummy.position.set(x, y + 1.2, z);
                        dummy.scale.setScalar(0.7 + Math.random() * 0.6);
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
            renderer.value.render(scene.value, camera.value);
        }
    }

    function updatePhysics(delta: number) {
        if (!camera.value) return;

        const moveSpeed = 18; // Walking speed (faster)
        const sprintMultiplier = moveState.sprint ? 2 : 1;

        if (useSphericalTerrain.value) {
            // SPHERICAL TERRAIN MOVEMENT
            // Get the "up" direction (away from planet center)
            const up = camera.value.position.clone().normalize();

            // Get camera forward direction projected onto the tangent plane
            const cameraDir = new THREE.Vector3();
            camera.value.getWorldDirection(cameraDir);

            // Project forward onto tangent plane (remove the "up" component)
            const forward = cameraDir.clone().sub(up.clone().multiplyScalar(cameraDir.dot(up))).normalize();

            // Right is perpendicular to up and forward
            const right = new THREE.Vector3().crossVectors(forward, up).normalize();

            // Calculate movement on the tangent plane
            const moveDirection = new THREE.Vector3();
            if (moveState.forward) moveDirection.add(forward);
            if (moveState.backward) moveDirection.sub(forward);
            if (moveState.left) moveDirection.sub(right);
            if (moveState.right) moveDirection.add(right);

            if (moveDirection.length() > 0) {
                moveDirection.normalize();
                const movement = moveDirection.multiplyScalar(moveSpeed * sprintMultiplier * delta);
                camera.value.position.add(movement);

                // Re-normalize to stay on sphere surface
                const groundHeight = planetRadius + 2;
                camera.value.position.normalize().multiplyScalar(groundHeight);
            }

            // Keep camera "up" aligned with surface normal
            const newUp = camera.value.position.clone().normalize();
            const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.value.quaternion);

            // Smoothly rotate camera to align with new up
            if (currentUp.dot(newUp) < 0.9999) {
                const rotationAxis = new THREE.Vector3().crossVectors(currentUp, newUp).normalize();
                const angle = Math.acos(Math.min(1, currentUp.dot(newUp)));
                const smoothAngle = angle * 0.1; // Smooth rotation

                const quaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, smoothAngle);
                camera.value.quaternion.premultiply(quaternion);
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

            // Store forward direction before reusing tempVector3
            const forwardDir = tempVector3.clone();

            // Calculate right vector (use tempVector3b)
            tempVector3b.crossVectors(forwardDir, upVector).normalize();

            // Calculate movement direction (reuse tempVector3)
            const moveDirection = tempVector3; // Reuse tempVector3
            moveDirection.set(0, 0, 0); // Reset

            if (moveState.forward) moveDirection.add(forwardDir);
            if (moveState.backward) moveDirection.sub(forwardDir);
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

            // Auto-correct any residual roll with damping (should rarely be needed)
            const rollDamping = 0.9;
            camera.value.rotation.z *= rollDamping;
            if (Math.abs(camera.value.rotation.z) < 0.001) {
                camera.value.rotation.z = 0;
            }

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

        camera.value.aspect = containerRef.value.clientWidth / containerRef.value.clientHeight;
        camera.value.updateProjectionMatrix();
        renderer.value.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
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
