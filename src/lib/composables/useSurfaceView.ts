import { ref, shallowRef, type Ref } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    TerrainGenerator,
    TERRAIN_CONFIGS,
    createTerrainMesh,
    createWaterPlane,
    createSkyDome,
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
    const controls = shallowRef<OrbitControls | null>(null);

    let animationId: number | null = null;
    let terrainMesh: THREE.Mesh | null = null;
    let waterMesh: THREE.Mesh | null = null;
    let skyDome: THREE.Mesh | null = null;

    // Player state for surface exploration
    const playerPosition = ref(new THREE.Vector3(0, 5, 0));
    const playerVelocity = new THREE.Vector3();
    const moveState = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
    };

    let currentGravity = 9.81;
    let isGrounded = false;

    function initScene() {
        if (!containerRef.value) return;

        scene.value = new THREE.Scene();

        camera.value = new THREE.PerspectiveCamera(
            75,
            containerRef.value.clientWidth / containerRef.value.clientHeight,
            0.1,
            2000
        );
        camera.value.position.set(0, 10, 30);

        renderer.value = new THREE.WebGLRenderer({ antialias: true });
        renderer.value.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
        renderer.value.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.value.shadowMap.enabled = true;
        renderer.value.shadowMap.type = THREE.PCFSoftShadowMap;
        containerRef.value.appendChild(renderer.value.domElement);

        controls.value = new OrbitControls(camera.value, renderer.value.domElement);
        controls.value.enableDamping = true;
        controls.value.dampingFactor = 0.05;
        controls.value.maxPolarAngle = Math.PI * 0.49;
        controls.value.minDistance = 5;
        controls.value.maxDistance = 200;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.value.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
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

        // Hemisphere light for better ambient
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x8b4513, 0.4);
        scene.value.add(hemiLight);
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

        const config = TERRAIN_CONFIGS[planetName] || TERRAIN_CONFIGS.earth;
        currentGravity = config.gravity;

        // Create terrain
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

        // Create sky dome
        skyDome = createSkyDome(config, 800);
        scene.value.add(skyDome);

        // Update hemisphere light colors based on planet
        const hemiLight = scene.value.children.find(
            child => child instanceof THREE.HemisphereLight
        ) as THREE.HemisphereLight | undefined;

        if (hemiLight && config.atmosphereColor) {
            hemiLight.color.copy(config.atmosphereColor);
            hemiLight.groundColor.copy(config.baseColor);
        }

        // Reset camera position
        if (camera.value && controls.value) {
            camera.value.position.set(0, 30, 60);
            controls.value.target.set(0, 0, 0);
        }

        isLoading.value = false;
    }

    function animate() {
        if (!isActive.value) return;

        animationId = requestAnimationFrame(animate);

        // Update physics
        updatePhysics();

        controls.value?.update();

        if (renderer.value && scene.value && camera.value) {
            renderer.value.render(scene.value, camera.value);
        }
    }

    function updatePhysics() {
        const delta = 1 / 60;

        // Apply gravity
        if (!isGrounded) {
            playerVelocity.y -= currentGravity * delta;
        }

        // Apply movement
        const moveSpeed = 10;
        const direction = new THREE.Vector3();

        if (moveState.forward) direction.z -= 1;
        if (moveState.backward) direction.z += 1;
        if (moveState.left) direction.x -= 1;
        if (moveState.right) direction.x += 1;

        if (direction.length() > 0) {
            direction.normalize();
            playerVelocity.x = direction.x * moveSpeed;
            playerVelocity.z = direction.z * moveSpeed;
        } else {
            playerVelocity.x *= 0.9;
            playerVelocity.z *= 0.9;
        }

        // Jump
        if (moveState.jump && isGrounded) {
            playerVelocity.y = Math.sqrt(2 * currentGravity * 3); // Jump height of 3 units
            isGrounded = false;
        }

        // Update position
        playerPosition.value.add(playerVelocity.clone().multiplyScalar(delta));

        // Ground collision (simplified)
        if (playerPosition.value.y < 2) {
            playerPosition.value.y = 2;
            playerVelocity.y = 0;
            isGrounded = true;
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
        initScene();
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
