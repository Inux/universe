import { ref, shallowRef, type Ref } from 'vue';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import {
    TerrainGenerator,
    TERRAIN_CONFIGS,
    createTerrainMesh,
    createSphericalTerrain,
    createSphericalWater,
    createWaterPlane,
    updateWater,
    createSkyDome,
    createStarfield,
    updateSkyDome,
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
    let waterMesh: THREE.Mesh | null = null;
    let skyDome: THREE.Mesh | null = null;
    let starfield: THREE.Points | null = null;
    let sunLight: THREE.DirectionalLight | null = null;

    // Day/night cycle
    let dayTime = 0.25; // Start at sunrise (0-1, 0.5 = noon)
    const dayDuration = 120; // Seconds for a full day cycle

    // Spherical terrain settings
    const useSphericalTerrain = ref(true);
    const planetRadius = 100; // Radius of the walkable planet sphere

    // Player state for surface exploration
    const playerPosition = ref(new THREE.Vector3(0, 5, 0));
    const playerVelocity = new THREE.Vector3();
    const moveState = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
    };

    let currentGravity = 9.81;
    let isGrounded = false;

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

        renderer.value = new THREE.WebGLRenderer({ antialias: true });
        renderer.value.setSize(width, height);
        renderer.value.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.value.shadowMap.enabled = true;
        renderer.value.shadowMap.type = THREE.PCFSoftShadowMap;
        containerRef.value.appendChild(renderer.value.domElement);

        // First-person controls with pointer lock
        controls.value = new PointerLockControls(camera.value, renderer.value.domElement);
        scene.value.add(controls.value.getObject());

        // Click to lock pointer for first-person control
        renderer.value.domElement.addEventListener('click', () => {
            controls.value?.lock();
        });

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

        // Hemisphere light for sky/ground color bleeding
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x8b4513, 0.4);
        scene.value.add(hemiLight);

        return true;
    }

    function loadPlanetSurface(planetName: string) {
        if (!scene.value) return;

        isLoading.value = true;
        currentPlanet.value = planetName;

        // Clear previous terrain
        if (terrainMesh) {
            scene.value.remove(terrainMesh);
            terrainMesh.geometry.dispose();
            (terrainMesh.material as THREE.Material).dispose();
        }
        if (waterMesh) {
            scene.value.remove(waterMesh);
            waterMesh.geometry.dispose();
            (waterMesh.material as THREE.Material).dispose();
        }
        if (skyDome) {
            scene.value.remove(skyDome);
            skyDome.geometry.dispose();
            (skyDome.material as THREE.Material).dispose();
        }
        if (starfield) {
            scene.value.remove(starfield);
            starfield.geometry.dispose();
            (starfield.material as THREE.Material).dispose();
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
                // Start at "north pole" of the planet, standing on surface
                const startHeight = planetRadius + 2; // Eye height above surface
                camera.value.position.set(0, startHeight, 0);
                // Look along the surface (tangent direction)
                camera.value.lookAt(0, startHeight, 10);
            }
        } else {
            // Create flat terrain (original behavior)
            const terrainSize = 200;
            const resolution = 128;
            terrainMesh = createTerrainMesh(planetName, terrainSize, resolution);
            terrainMesh.castShadow = true;
            terrainMesh.receiveShadow = true;
            scene.value.add(terrainMesh);

            // Create water if applicable
            waterMesh = createWaterPlane(terrainSize, config);
            if (waterMesh) {
                scene.value.add(waterMesh);
            }

            // Reset camera position for flat terrain - standing on ground
            if (camera.value) {
                camera.value.position.set(0, 2, 0); // Eye height
                camera.value.lookAt(0, 2, 10);
            }
        }

        // Create sky dome with day/night support (larger for spherical)
        const skyRadius = useSphericalTerrain.value ? planetRadius * 8 : 800;
        skyDome = createSkyDome(config, skyRadius);
        scene.value.add(skyDome);

        // Create starfield for night sky
        starfield = createStarfield(skyRadius * 1.1);
        scene.value.add(starfield);

        // Update hemisphere light colors based on planet
        const hemiLight = scene.value.children.find(
            child => child instanceof THREE.HemisphereLight
        ) as THREE.HemisphereLight | undefined;

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

        // Calculate sun position (circular path)
        const sunAngle = dayTime * Math.PI * 2 - Math.PI / 2; // Start at horizon
        const sunHeight = Math.sin(sunAngle);
        const sunHorizontal = Math.cos(sunAngle);

        const sunDirection = new THREE.Vector3(sunHorizontal, sunHeight, 0.3).normalize();

        // Update sun light position
        sunLight.position.copy(sunDirection.clone().multiplyScalar(200));

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

        // Update sky dome
        updateSkyDome(skyDome, sunDirection, !!config.atmosphereColor);

        // Update water animation
        if (waterMesh) {
            updateWater(waterMesh, dayTime * dayDuration, sunDirection);
        }

        // Update starfield visibility
        if (starfield) {
            const starOpacity = 1 - THREE.MathUtils.smoothstep(sunHeight, -0.1, 0.2);
            (starfield.material as THREE.PointsMaterial).opacity = starOpacity * 0.8;
        }

        // Update hemisphere light
        const hemiLight = scene.value.children.find(
            child => child instanceof THREE.HemisphereLight
        ) as THREE.HemisphereLight | undefined;

        if (hemiLight) {
            hemiLight.intensity = Math.max(0.1, sunHeight * 0.4 + 0.2);
        }
    }

    function animate() {
        if (!isActive.value) return;

        animationId = requestAnimationFrame(animate);

        const delta = 1 / 60;

        // Update day/night cycle
        updateDayNightCycle(delta);

        // Update physics and movement
        updatePhysics();

        if (renderer.value && scene.value && camera.value) {
            renderer.value.render(scene.value, camera.value);
        }
    }

    function updatePhysics() {
        if (!camera.value) return;

        const delta = 1 / 60;
        const moveSpeed = 10; // Walking speed
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
            // FLAT TERRAIN MOVEMENT
            const cameraDirection = new THREE.Vector3();
            camera.value.getWorldDirection(cameraDirection);
            cameraDirection.y = 0;
            cameraDirection.normalize();

            const cameraRight = new THREE.Vector3();
            cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();

            const moveDirection = new THREE.Vector3();
            if (moveState.forward) moveDirection.add(cameraDirection);
            if (moveState.backward) moveDirection.sub(cameraDirection);
            if (moveState.left) moveDirection.sub(cameraRight);
            if (moveState.right) moveDirection.add(cameraRight);

            if (moveDirection.length() > 0) {
                moveDirection.normalize();
                const movement = moveDirection.multiplyScalar(moveSpeed * sprintMultiplier * delta);
                camera.value.position.add(movement);
            }

            // Apply gravity
            if (!isGrounded) {
                playerVelocity.y -= currentGravity * delta;
            }

            // Jump
            if (moveState.jump && isGrounded) {
                playerVelocity.y = Math.sqrt(2 * currentGravity * 2);
                isGrounded = false;
                moveState.jump = false;
            }

            // Apply vertical velocity
            camera.value.position.y += playerVelocity.y * delta;

            // Ground collision
            const groundHeight = 2;
            if (camera.value.position.y < groundHeight) {
                camera.value.position.y = groundHeight;
                playerVelocity.y = 0;
                isGrounded = true;
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
    }

    function handleResize() {
        if (!containerRef.value || !camera.value || !renderer.value) return;

        camera.value.aspect = containerRef.value.clientWidth / containerRef.value.clientHeight;
        camera.value.updateProjectionMatrix();
        renderer.value.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
    }

    function enter(planetName: string) {
        if (isActive.value) return;

        isActive.value = true;

        const sceneReady = initScene();
        if (!sceneReady) {
            console.error('Failed to initialize scene');
            isActive.value = false;
            return;
        }

        loadPlanetSurface(planetName);
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

        // Cleanup
        if (terrainMesh && scene.value) {
            scene.value.remove(terrainMesh);
            terrainMesh.geometry.dispose();
            (terrainMesh.material as THREE.Material).dispose();
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

        renderer.value?.dispose();
        controls.value?.dispose();

        if (containerRef.value && renderer.value) {
            containerRef.value.removeChild(renderer.value.domElement);
        }

        scene.value = null;
        camera.value = null;
        renderer.value = null;
        controls.value = null;

        options.onExit?.();
    }

    return {
        isActive,
        isLoading,
        currentPlanet,
        enter,
        exit,
    };
}
