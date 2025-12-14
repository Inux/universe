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
    getTerrainHeight,
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

    // Terrain settings - use flat terrain for GTA-style experience
    const useSphericalTerrain = ref(false);
    const planetRadius = 100; // Radius of the walkable planet sphere (if spherical)

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

    // Pre-allocated objects for performance
    const tempVector3 = new THREE.Vector3();
    const tempVector3b = new THREE.Vector3(); // Additional temp vector
    const tempQuaternion = new THREE.Quaternion();
    const yawQuaternion = new THREE.Quaternion();
    const pitchQuaternion = new THREE.Quaternion();
    const upVector = new THREE.Vector3(0, 1, 0);
    const forwardVector = new THREE.Vector3(0, 0, -1);

    // Pre-allocated raycaster for terrain collision
    const terrainRaycaster = new THREE.Raycaster();
    const rayOrigin = new THREE.Vector3();
    const rayDirection = new THREE.Vector3(0, -1, 0);

    // Performance and physics state
    let lastTime = 0;

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
            // Create flat terrain - larger for smoother wrapping
            const terrainSize = 500;
            const resolution = 256;
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
            if (camera.value && terrainMesh) {
                const startHeight = getTerrainHeight(terrainMesh, 0, 0) + 2;
                camera.value.position.set(0, startHeight, 0);
                camera.value.up.set(0, 1, 0); // Ensure up vector is correct
                camera.value.lookAt(0, startHeight, -10); // Look along -Z axis
                cameraYaw = 0; // Reset yaw
                cameraPitch = 0; // Reset pitch
            } else if (camera.value) {
                camera.value.position.set(0, 20, 0);
                camera.value.up.set(0, 1, 0);
                camera.value.lookAt(0, 20, -10);
                cameraYaw = 0; // Reset yaw
                cameraPitch = 0; // Reset pitch
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

        // Update sky dome - follow camera position
        updateSkyDome(skyDome, sunDirection, !!config.atmosphereColor);
        if (camera.value) {
            skyDome.position.copy(camera.value.position);
        }

        // Update water animation
        if (waterMesh) {
            updateWater(waterMesh, dayTime * dayDuration, sunDirection);
        }

        // Update starfield - follow camera position
        if (starfield) {
            const starOpacity = 1 - THREE.MathUtils.smoothstep(sunHeight, -0.1, 0.2);
            (starfield.material as THREE.PointsMaterial).opacity = 1.0; // TEMP: Force full opacity
            if (camera.value) {
                starfield.position.copy(camera.value.position);
            }
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

        // Calculate actual time delta once for consistency
        const currentTime = performance.now() / 1000; // Convert to seconds
        const delta = Math.min(currentTime - lastTime, 1/30); // Cap at 30 FPS minimum
        lastTime = currentTime;

        // Update day/night cycle
        updateDayNightCycle(delta);

        // Update physics and movement
        updatePhysics(delta);

        if (renderer.value && scene.value && camera.value) {
            renderer.value.render(scene.value, camera.value);
        }
    }

    function updatePhysics(delta: number) {
        if (!camera.value) return;

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
            // FLAT TERRAIN MOVEMENT WITH INFINITE WRAPPING
            const terrainSize = 500; // Must match terrain size in loadPlanetSurface
            const halfSize = terrainSize / 2;
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

            // Wrap position to create infinite terrain (walk around planet)
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

            // PROPER FIRST-PERSON CAMERA CONTROLS
            const lookSpeed = 1.5; // radians per second
            // Strict pitch limits - prevent camera from flipping
            const maxPitch = Math.PI / 3; // 60 degrees
            const minPitch = -Math.PI / 4; // -45 degrees (look down)

            // Update yaw (left/right rotation around world Y axis)
            if (moveState.lookLeft) {
                cameraYaw += lookSpeed * delta;
            }
            if (moveState.lookRight) {
                cameraYaw -= lookSpeed * delta;
            }

            // Update pitch (up/down rotation around local X axis)
            if (moveState.lookUp) {
                cameraPitch = Math.min(maxPitch, cameraPitch + lookSpeed * delta);
            }
            if (moveState.lookDown) {
                cameraPitch = Math.max(minPitch, cameraPitch - lookSpeed * delta);
            }

            // Create camera orientation: yaw first (around world Y), then pitch (around local X)
            tempQuaternion.setFromAxisAngle(upVector, cameraYaw); // Yaw around world up
            yawQuaternion.setFromAxisAngle(forwardVector, cameraPitch); // Pitch around local forward

            // Combine: yaw * pitch
            camera.value.quaternion.multiplyQuaternions(tempQuaternion, yawQuaternion);

            // Ensure up vector remains consistent
            camera.value.up.copy(upVector);

            // JUMPING LOGIC FOR FLAT TERRAIN
            // Jump - must be checked BEFORE applying gravity
            if (moveState.jump && isGrounded) {
                playerVelocity.y = Math.sqrt(2 * currentGravity * 4); // Increased to 4m jump for better feel
                isGrounded = false;
                moveState.jump = false; // Consume the jump
            }

            // Apply gravity when not grounded - MUCH stronger for realistic feel
            if (!isGrounded) {
                playerVelocity.y -= currentGravity * 8 * delta; // Increased gravity dramatically
                // Clamp falling speed to prevent tunneling through terrain
                playerVelocity.y = Math.max(playerVelocity.y, -50); // Reduced max fall speed
            }

            // Apply vertical velocity
            camera.value.position.y += playerVelocity.y * delta;

            // TERRAIN COLLISION: Check after movement
            let groundHeight = 0;
            if (terrainMesh) {
                try {
                    // Ensure raycaster is available
                    if (typeof terrainRaycaster === 'undefined') {
                        console.error('terrainRaycaster is undefined!');
                        return;
                    }

                    tempVector3.set(camera.value.position.x, camera.value.position.y + 10, camera.value.position.z);
                    terrainRaycaster.set(tempVector3, rayDirection);

                    const intersects = terrainRaycaster.intersectObject(terrainMesh, false);
                    if (intersects.length > 0) {
                        groundHeight = intersects[0].point.y;
                    }
                } catch (error) {
                    console.error('Error in terrain collision:', error);
                    return; // Prevent further execution
                }
            }
            const targetY = groundHeight + eyeHeight;

            // Ground collision - snap to terrain if below it
            if (camera.value.position.y < targetY) {
                camera.value.position.y = targetY;
                playerVelocity.y = 0;
                isGrounded = true;
            } else if (camera.value.position.y > targetY + 0.5) {
                isGrounded = false;
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
