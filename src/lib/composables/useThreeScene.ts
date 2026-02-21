import { ref, shallowRef, onMounted, onUnmounted, type Ref } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createStarfield, createSpaceBackground, createDistantGalaxies } from '../three/skybox';
import {
    SOLAR_SYSTEM,
    getLogarithmicSize,
    farthestOrbitRadius,
    createSolarSystem,
    updateOrbitalPositions,
    SolarSystemObjects
} from '../three/solarSystem';
import { CameraTransition, easeOutCubic } from '../three/CameraTransition';
import {
    DEFAULT_STEP,
    cameraClipPlanes,
    clampStep,
    orbitMaxDistance,
    skyScaleForFarthest,
    spinScaleForRate,
    timeRate,
} from '../three/viewScale';

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
    raycaster.params.Line = { threshold: 10 };
    const mouse = new THREE.Vector2();
    // Outer edge of the star shell and the space-background sphere in skybox.ts.
    const SKY_SHELL_RADIUS = 600_000;
    let skyScale = 1;
    let skyObjects: THREE.Object3D[] = [];
    let farthestOrbit = 0;
    let timeRunning = true;
    let timeStepIndex = DEFAULT_STEP;
    let distanceStepIndex = DEFAULT_STEP;
    let time = 0;
    let lastFrameMs = 0;
    let animationId: number | null = null;
    let isPaused = false;

    // Hitbox meshes for easier clicking (invisible, larger spheres)
    const hitboxMeshes = new Map<string, THREE.Mesh>();

    // Cached arrays for raycasting (avoid Array.from() on every click)
    let cachedRaycastTargets: THREE.Object3D[] | null = null;

    // Planet label sprites
    const labelSprites = new Map<string, THREE.Sprite>();
    let labelsVisible = false;

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

        // Create renderer with proper color management
        renderer.value = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance',
        });
        renderer.value.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
        renderer.value.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Enable ACES tonemapping and sRGB output for realistic rendering
        renderer.value.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.value.toneMappingExposure = 1.0;
        renderer.value.outputColorSpace = THREE.SRGBColorSpace;

        // Expose renderer globally for PerformanceHUD
        (window as any).__THREE_RENDERER__ = renderer.value;

        containerRef.value.appendChild(renderer.value.domElement);

        // Fill light only. The sun's point light supplies the day side, so a fixed
        // directional light would light planets from the wrong direction.
        const ambientLight = new THREE.AmbientLight(0x222238, 0.55);
        scene.value.add(ambientLight);

        // Set initial camera position - closer view so sun is visible
        const sunSize = getLogarithmicSize(SOLAR_SYSTEM.sun.radius);
        camera.value.position.set(0, sunSize * 8, sunSize * 8);
        camera.value.lookAt(0, 0, 0);

        // Create controls with reasonable zoom limits
        controls.value = new OrbitControls(camera.value, renderer.value.domElement);
        controls.value.enableDamping = true;
        controls.value.dampingFactor = 0.05;
        controls.value.minDistance = getLogarithmicSize(SOLAR_SYSTEM.sun.radius) * 1.15;
        controls.value.maxDistance = 120000; // Extended for Kuiper belt objects
        controls.value.enablePan = true;
        controls.value.enableZoom = true;

        // Create camera transition helper
        cameraTransition.value = new CameraTransition(camera.value, controls.value);
    }

    async function initSolarSystem() {
        if (!scene.value) return;

        try {
            // Create space background
            skyObjects = [
                createSpaceBackground(scene.value),
                createStarfield(scene.value, 15000),
                createDistantGalaxies(scene.value, 80),
            ];

            // Create solar system
            solarSystemObjects.value = await createSolarSystem(
                scene.value,
                textureLoader,
                distanceStepIndex
            );
            applyDistanceStep();

            // Create invisible hitbox meshes for easier clicking
            createHitboxes();

            // Create planet labels
            createLabels();

            isInitialized.value = true;
            isLoading.value = false;
        } catch (err) {
            console.error('Failed to initialize solar system:', err);
            error.value = 'Failed to load solar system';
            isLoading.value = false;
        }
    }

    function createHitboxes() {
        if (!scene.value || !solarSystemObjects.value) return;

        // Create larger invisible spheres for each planet for easier clicking
        const hitboxScale = 2.5; // Hitbox is 2.5x the visual size

        for (const [name, body] of solarSystemObjects.value.planets.entries()) {
            const planetData = SOLAR_SYSTEM[name];
            const visualSize = getLogarithmicSize(planetData.radius);

            const geometry = new THREE.SphereGeometry(visualSize * hitboxScale, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                visible: false, // Invisible
                transparent: true,
                opacity: 0
            });

            const hitbox = new THREE.Mesh(geometry, material);
            hitbox.userData.planetName = name;
            hitbox.userData.isHitbox = true;

            // Position will be updated in updateOrbits
            scene.value.add(hitbox);
            hitboxMeshes.set(name, hitbox);
        }
    }

    function updateOrbits(delta: number) {
        if (!solarSystemObjects.value) return;

        const rate = timeRate(timeStepIndex);
        time += rate * delta;

        updateOrbitalPositions(
            solarSystemObjects.value.planets,
            solarSystemObjects.value.moons,
            time,
            selectedPlanet.value,
            distanceStepIndex,
            delta,
            spinScaleForRate(rate)
        );

        // Update hitbox positions to match planet positions
        for (const [name, hitbox] of hitboxMeshes.entries()) {
            const body = solarSystemObjects.value.planets.get(name);
            if (body) {
                hitbox.position.copy(body.root.position);
            }
        }

        // Update label positions to float above planets
        for (const [name, label] of labelSprites.entries()) {
            const body = solarSystemObjects.value.planets.get(name);
            if (body) {
                const planetData = SOLAR_SYSTEM[name];
                const visualSize = getLogarithmicSize(planetData.radius);
                label.position.copy(body.root.position);
                label.position.y += visualSize * 1.5; // Float above planet
            }
        }
    }

    function animate(now = performance.now()) {
        if (!isInitialized.value || isPaused) return;

        animationId = requestAnimationFrame(animate);
        const delta = lastFrameMs === 0 ? 1 / 60 : Math.min((now - lastFrameMs) / 1000, 0.05);
        lastFrameMs = now;
        controls.value?.update();
        // Pausing time freezes orbits and spin. The camera keeps damping and the loop keeps drawing.
        updateOrbits(timeRunning ? delta : 0);
        updateCameraClip();

        if (renderer.value && scene.value && camera.value) {
            renderer.value.render(scene.value, camera.value);
        }
    }

    function applyDistanceStep() {
        farthestOrbit = farthestOrbitRadius(distanceStepIndex);
        if (controls.value) {
            controls.value.maxDistance = orbitMaxDistance(farthestOrbit);
        }
        const nextScale = skyScaleForFarthest(farthestOrbit, SKY_SHELL_RADIUS);
        if (nextScale !== skyScale) {
            skyScale = nextScale;
            for (const obj of skyObjects) obj.scale.setScalar(skyScale);
        }
        updateCameraClip();
    }

    function updateCameraClip() {
        const cam = camera.value;
        const ctr = controls.value;
        if (!cam || !ctr) return;
        const dist = cam.position.distanceTo(ctr.target);
        const clip = cameraClipPlanes(dist, farthestOrbit, SKY_SHELL_RADIUS * skyScale);
        if (cam.near === clip.near && cam.far === clip.far) return;
        cam.near = clip.near;
        cam.far = clip.far;
        cam.updateProjectionMatrix();
    }

    function setTimeRunning(running: boolean) {
        timeRunning = running;
    }

    function setTimeStep(step: number) {
        timeStepIndex = clampStep(step);
    }

    function setDistanceStep(step: number) {
        distanceStepIndex = clampStep(step);
        // Reposition at the current simulated time. A zero delta does not advance the clock.
        applyDistanceStep();
        updateOrbits(0);
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

        // Build cached raycast targets array (invalidated when solar system changes)
        if (!cachedRaycastTargets) {
            const hitboxArray = Array.from(hitboxMeshes.values());
            const planetMeshes = Array.from(solarSystemObjects.value.planets.values()).map(b => b.mesh);
            const moonMeshes = Array.from(solarSystemObjects.value.moons.values());
            cachedRaycastTargets = [...hitboxArray, ...planetMeshes, ...moonMeshes];
        }

        const intersects = raycaster.intersectObjects(cachedRaycastTargets);

        if (intersects.length > 0) {
            const hitObject = intersects[0].object;

            // Check if we hit a hitbox (invisible larger sphere)
            if (hitObject.userData.isHitbox && hitObject.userData.planetName) {
                const planetName = hitObject.userData.planetName;
                selectPlanet(planetName);
                options.onPlanetSelect?.(planetName);
                return;
            }

            // Check if we hit a planet mesh directly
            const planetEntry = Array.from(solarSystemObjects.value.planets.entries())
                .find(([_, body]) => body.mesh === hitObject);

            if (planetEntry) {
                selectPlanet(planetEntry[0]);
                options.onPlanetSelect?.(planetEntry[0]);
                return;
            }

            // Check if we hit a moon
            const moonEntry = Array.from(solarSystemObjects.value.moons.entries())
                .find(([_, mesh]) => mesh === hitObject);

            if (moonEntry) {
                const planetName = moonEntry[0].split('-')[0];
                selectPlanet(planetName);
                options.onPlanetSelect?.(planetName);
                return;
            }
        }

        options.onBackgroundClick?.();
    }

    function selectPlanet(planetName: string) {
        if (!solarSystemObjects.value || !camera.value || !controls.value) return;

        selectedPlanet.value = planetName;
        const body = solarSystemObjects.value.planets.get(planetName);
        if (!body) return;

        updateOrbits(0);
        controls.value.target.set(0, 0, 0);
        controls.value.minDistance = Math.max(2, getLogarithmicSize(SOLAR_SYSTEM[planetName].radius) * 1.15);

        const lookAt = new THREE.Vector3(0, 0, 0);

        // Frame the sunlit face. The camera sits sunward of the body so the day side
        // points at the viewer. The sun itself keeps a fixed three-quarter view.
        const planetData = SOLAR_SYSTEM[planetName];
        const distance = getLogarithmicSize(planetData.radius) * 3;
        const sunRoot = solarSystemObjects.value.planets.get('sun')?.root;
        const targetPosition = new THREE.Vector3(distance, distance * 0.55, distance);
        if (planetName !== 'sun' && sunRoot && sunRoot.position.lengthSq() > 1) {
            const sunward = sunRoot.position.clone().normalize();
            targetPosition.set(sunward.x * distance, distance * 0.45, sunward.z * distance);
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

    /**
     * Pause the animation loop to save resources when not visible
     */
    function pause() {
        isPaused = true;
        if (animationId !== null) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    /**
     * Resume the animation loop
     */
    function resume() {
        if (isPaused && isInitialized.value) {
            isPaused = false;
            lastFrameMs = 0;
            animate();
        }
    }

    function createLabelSprite(text: string): THREE.Sprite {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = 256;
        canvas.height = 64;

        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.roundRect(0, 0, canvas.width, canvas.height, 8);
        context.fill();

        context.font = 'bold 32px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });

        const sprite = new THREE.Sprite(material);
        sprite.scale.set(100, 25, 1);
        sprite.visible = false;

        return sprite;
    }

    function createLabels() {
        if (!scene.value || !solarSystemObjects.value) return;

        for (const [name, body] of solarSystemObjects.value.planets.entries()) {
            const planetData = SOLAR_SYSTEM[name];
            const label = createLabelSprite(planetData.name);
            scene.value.add(label);
            labelSprites.set(name, label);
        }
    }

    function setLabelsVisible(visible: boolean) {
        labelsVisible = visible;
        for (const sprite of labelSprites.values()) {
            sprite.visible = visible;
        }
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
        resetView,
        setLabelsVisible,
        pause,
        resume,
        setTimeRunning,
        setTimeStep,
        setDistanceStep
    };
}
