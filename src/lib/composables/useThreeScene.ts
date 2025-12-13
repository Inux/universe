import { ref, shallowRef, onMounted, onUnmounted, type Ref } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStarfield, createSpaceBackground, createDistantGalaxies } from '../three/skybox';
import {
    SOLAR_SYSTEM,
    SCALE,
    DISTANCE_SCALE_FACTOR,
    getLogarithmicSize,
    createSolarSystem,
    updateOrbitalPositions,
    SolarSystemObjects
} from '../three/solarSystem';
import { CameraTransition, easeOutCubic } from '../three/CameraTransition';

export interface UseThreeSceneOptions {
    onPlanetSelect?: (planetName: string) => void;
    onBackgroundClick?: () => void;
}

export function useThreeScene(
    containerRef: Ref<HTMLElement | null>,
    options: UseThreeSceneOptions = {}
) {
    const isInitialized = ref(false);
    const isLoading = ref(true);
    const selectedPlanet = ref('sun');
    const error = ref<string | null>(null);

    // Three.js objects (use shallowRef to avoid Vue reactivity overhead)
    const scene = shallowRef<THREE.Scene | null>(null);
    const camera = shallowRef<THREE.PerspectiveCamera | null>(null);
    const renderer = shallowRef<THREE.WebGLRenderer | null>(null);
    const controls = shallowRef<OrbitControls | null>(null);
    const solarSystemObjects = shallowRef<SolarSystemObjects | null>(null);
    const cameraTransition = shallowRef<CameraTransition | null>(null);

    const textureLoader = new THREE.TextureLoader();
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const distanceScaleValue = DISTANCE_SCALE_FACTOR;
    let time = 0;
    let animationId: number | null = null;

    function initScene() {
        if (!containerRef.value) return;

        // Create scene
        scene.value = new THREE.Scene();

        // Create camera
        camera.value = new THREE.PerspectiveCamera(
            75,
            containerRef.value.clientWidth / containerRef.value.clientHeight,
            0.1,
            1000000
        );

        // Create renderer
        renderer.value = new THREE.WebGLRenderer({ antialias: true });
        renderer.value.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
        renderer.value.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        containerRef.value.appendChild(renderer.value.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        scene.value.add(ambientLight, directionalLight);

        // Set initial camera position
        const maxDistance = SOLAR_SYSTEM.neptune?.distanceFromSun || SOLAR_SYSTEM.earth.distanceFromSun;
        camera.value.position.set(0, maxDistance * SCALE.DISTANCE * distanceScaleValue * 1.5, 0);
        camera.value.lookAt(0, 0, 0);

        // Create controls
        controls.value = new OrbitControls(camera.value, renderer.value.domElement);
        controls.value.enableDamping = true;
        controls.value.dampingFactor = 0.05;
        controls.value.minDistance = getLogarithmicSize(SOLAR_SYSTEM.earth.radius) * 0.1;
        controls.value.maxDistance = SCALE.MAX_HEIGHT;
        controls.value.enablePan = true;
        controls.value.enableZoom = true;

        // Create camera transition helper
        cameraTransition.value = new CameraTransition(camera.value, controls.value);
    }

    async function initSolarSystem() {
        if (!scene.value) return;

        try {
            // Create space background
            createSpaceBackground(scene.value);
            createStarfield(scene.value, 15000);
            createDistantGalaxies(scene.value, 80);

            // Create solar system
            solarSystemObjects.value = await createSolarSystem(
                scene.value,
                textureLoader,
                distanceScaleValue
            );

            isInitialized.value = true;
            isLoading.value = false;
        } catch (err) {
            console.error('Failed to initialize solar system:', err);
            error.value = 'Failed to load solar system';
            isLoading.value = false;
        }
    }

    function updateOrbits() {
        if (!solarSystemObjects.value) return;

        time += SCALE.TIME / 60;

        updateOrbitalPositions(
            solarSystemObjects.value.planets,
            solarSystemObjects.value.moons,
            time,
            selectedPlanet.value,
            distanceScaleValue
        );

        if (controls.value) {
            controls.value.target.set(0, 0, 0);
        }
    }

    function animate() {
        if (!isInitialized.value) return;

        animationId = requestAnimationFrame(animate);
        controls.value?.update();
        updateOrbits();

        if (renderer.value && scene.value && camera.value) {
            renderer.value.render(scene.value, camera.value);
        }
    }

    function handleResize() {
        if (!containerRef.value || !camera.value || !renderer.value) return;

        camera.value.aspect = containerRef.value.clientWidth / containerRef.value.clientHeight;
        camera.value.updateProjectionMatrix();
        renderer.value.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
    }

    function handleClick(event: MouseEvent) {
        if (!solarSystemObjects.value || !camera.value || !containerRef.value) return;

        const rect = containerRef.value.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera.value);

        const planetMeshes = Array.from(solarSystemObjects.value.planets.values()).map(b => b.mesh);
        const moonMeshes = Array.from(solarSystemObjects.value.moons.values());
        const allBodies = [...planetMeshes, ...moonMeshes];

        const intersects = raycaster.intersectObjects(allBodies);

        if (intersects.length > 0) {
            const planetEntry = Array.from(solarSystemObjects.value.planets.entries())
                .find(([_, body]) => body.mesh === intersects[0].object);

            if (planetEntry) {
                selectPlanet(planetEntry[0]);
                options.onPlanetSelect?.(planetEntry[0]);
                return;
            }

            const moonEntry = Array.from(solarSystemObjects.value.moons.entries())
                .find(([_, mesh]) => mesh === intersects[0].object);

            if (moonEntry) {
                const planetName = moonEntry[0].split('-')[0];
                selectPlanet(planetName);
                options.onPlanetSelect?.(planetName);
            }
        } else {
            options.onBackgroundClick?.();
        }
    }

    function selectPlanet(planetName: string) {
        if (!solarSystemObjects.value || !camera.value || !controls.value) return;

        selectedPlanet.value = planetName;
        const body = solarSystemObjects.value.planets.get(planetName);
        if (!body) return;

        updateOrbits();
        controls.value.target.set(0, 0, 0);

        let targetPosition: THREE.Vector3;
        const lookAt = new THREE.Vector3(0, 0, 0);

        if (planetName === 'sun') {
            const maxDistance = SOLAR_SYSTEM.neptune?.distanceFromSun || SOLAR_SYSTEM.earth.distanceFromSun;
            targetPosition = new THREE.Vector3(0, maxDistance * SCALE.DISTANCE * distanceScaleValue * 1.5, 0);
        } else {
            const planetData = SOLAR_SYSTEM[planetName];
            const distance = getLogarithmicSize(planetData.radius) * 3;
            targetPosition = new THREE.Vector3(distance, distance * 0.7, distance);
        }

        cameraTransition.value?.transitionTo(targetPosition, lookAt, {
            duration: 1200,
            easing: easeOutCubic
        });
    }

    function resetView() {
        cameraTransition.value?.cancel();
        selectPlanet('sun');
    }

    onMounted(async () => {
        initScene();
        await initSolarSystem();
        animate();

        window.addEventListener('resize', handleResize);
    });

    onUnmounted(() => {
        if (animationId !== null) {
            cancelAnimationFrame(animationId);
        }

        window.removeEventListener('resize', handleResize);

        // Cleanup Three.js resources
        renderer.value?.dispose();
        controls.value?.dispose();

        if (containerRef.value && renderer.value) {
            containerRef.value.removeChild(renderer.value.domElement);
        }
    });

    return {
        isInitialized,
        isLoading,
        error,
        selectedPlanet,
        handleClick,
        selectPlanet,
        resetView
    };
}
