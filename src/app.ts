import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Player, Vector3, CONSTANTS } from './lib/game/models';
import { updatePlayerMovement, updatePlayerPhysics } from './lib/game/physics';
import { createStarfield, createSpaceBackground, createDistantGalaxies } from './lib/three/skybox';
import {
    SOLAR_SYSTEM,
    SCALE,
    DISTANCE_SCALE_FACTOR,
    getLogarithmicSize,
    createSolarSystem,
    updateOrbitalPositions,
    SolarSystemObjects
} from './lib/three/solarSystem';
import { CameraTransition, easeOutCubic } from './lib/three/CameraTransition';

class GameClient {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls!: OrbitControls;
    private earth: THREE.Mesh | null = null;
    private playerMesh: THREE.Mesh;
    private clientId: string;
    private movement: Vector3;
    private solarSystemObjects: SolarSystemObjects | null = null;
    private distanceScaleValue: number;
    private textureLoader: THREE.TextureLoader;
    private time: number = 0;
    private loadingElement: HTMLDivElement;
    private isInitialized: boolean = false;
    private selectedPlanet: string = 'sun';
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private lastPlayerPosition: THREE.Vector3 | null = null;
    private isJumping: boolean = false;
    private jumpVelocity: number = 0;
    private isFollowingPlayer: boolean = false;

    // Local player state
    private localPlayer: Player;
    private gameLoopId: number | null = null;

    // Camera transition
    private cameraTransition: CameraTransition | null = null;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000000);
        this.renderer = new THREE.WebGLRenderer();
        this.clientId = Math.random().toString(36);
        this.movement = { x: 0, y: 0, z: 0 };
        this.distanceScaleValue = DISTANCE_SCALE_FACTOR;
        this.textureLoader = new THREE.TextureLoader();
        this.loadingElement = document.getElementById('loading') as HTMLDivElement;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Initialize local player
        this.localPlayer = {
            id: this.clientId,
            position: {
                x: CONSTANTS.EARTH_RADIUS,
                y: 0,
                z: 0,
            },
            rotation: { x: 0, y: 0, z: 0 },
            camera: {
                position: { x: CONSTANTS.EARTH_RADIUS + 10, y: 10, z: 0 },
                target: { x: CONSTANTS.EARTH_RADIUS, y: 0, z: 0 },
                zoom: 1.0,
            },
            movement: {
                isWalking: false,
                isSwimming: false,
                isDiving: false,
                isClimbing: false,
                diveTime: 0,
                maxDiveTime: CONSTANTS.MAX_DIVE_TIME,
            },
            physics: {
                velocity: { x: 0, y: 0, z: 0 },
                acceleration: { x: 0, y: 0, z: 0 },
                grounded: true,
            },
        };

        // Create player mesh
        this.playerMesh = this.createPlayerMesh();

        this.initThree();
        this.initControls();
        this.initGame();

        // Add event listeners
        window.addEventListener('click', this.handleClick.bind(this));
        window.addEventListener('keydown', this.handleGlobalKeyDown.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    private async initGame() {
        try {
            // Create space background first
            createSpaceBackground(this.scene);
            createStarfield(this.scene, 15000);
            createDistantGalaxies(this.scene, 80);

            // Create solar system
            this.solarSystemObjects = await createSolarSystem(
                this.scene,
                this.textureLoader,
                this.distanceScaleValue
            );

            // Get Earth reference
            const earthBody = this.solarSystemObjects.planets.get('earth');
            if (earthBody) {
                this.earth = earthBody.mesh;
            }

            // Set initial camera position
            if (this.earth) {
                this.camera.position.copy(this.earth.position);
                this.camera.position.y += getLogarithmicSize(SOLAR_SYSTEM.earth.radius) * 2;
                this.camera.lookAt(this.earth.position);
            }

            this.isInitialized = true;
            this.loadingElement.style.display = 'none';
            this.startGameLoop();
            this.animate();
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.loadingElement.textContent = 'Failed to load solar system';
        }
    }

    private createPlayerMesh(): THREE.Mesh {
        const playerSize = getLogarithmicSize(SOLAR_SYSTEM.earth.radius) * 0.05;
        const geometry = new THREE.SphereGeometry(playerSize, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });
        const mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);
        return mesh;
    }

    private initThree() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(ambientLight, directionalLight);

        // Set initial camera position
        const maxDistance = SOLAR_SYSTEM.neptune?.distanceFromSun || SOLAR_SYSTEM.earth.distanceFromSun;
        this.camera.position.set(0, maxDistance * SCALE.DISTANCE * this.distanceScaleValue * 1.5, 0);
        this.camera.lookAt(0, 0, 0);
    }

    private initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = getLogarithmicSize(SOLAR_SYSTEM.earth.radius) * 0.1;
        this.controls.maxDistance = SCALE.MAX_HEIGHT;
        this.controls.enablePan = true;
        this.controls.enableZoom = true;

        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    private handleKeyDown(e: KeyboardEvent) {
        const currentPos = this.lastPlayerPosition?.clone() || new THREE.Vector3(0, 1, 0);
        const up = currentPos.clone().normalize();
        const right = new THREE.Vector3(0, 1, 0).cross(up).normalize();
        const forward = up.clone().cross(right).normalize();

        switch (e.key.toLowerCase()) {
            case 'w':
                this.movement = { x: forward.x, y: forward.y, z: forward.z };
                break;
            case 's':
                this.movement = { x: -forward.x, y: -forward.y, z: -forward.z };
                break;
            case 'a':
                this.movement = { x: -right.x, y: -right.y, z: -right.z };
                break;
            case 'd':
                this.movement = { x: right.x, y: right.y, z: right.z };
                break;
            case ' ':
                if (!this.isJumping) {
                    this.isJumping = true;
                    this.jumpVelocity = SCALE.JUMP_FORCE;
                    this.movement = { x: up.x, y: up.y, z: up.z };
                }
                break;
        }
    }

    private handleKeyUp(e: KeyboardEvent) {
        switch (e.key.toLowerCase()) {
            case 'w': case 's': case 'a': case 'd':
                this.movement.x = 0;
                this.movement.y = 0;
                this.movement.z = 0;
                break;
        }
    }

    private handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private startGameLoop() {
        this.gameLoopId = setInterval(() => {
            this.updateGameState();
        }, 1000 / CONSTANTS.TICK_RATE) as unknown as number;
    }

    private updateGameState() {
        if (!this.isInitialized) return;

        if (this.movement.x !== 0 || this.movement.y !== 0 || this.movement.z !== 0) {
            updatePlayerMovement(this.localPlayer, this.movement);
        }

        updatePlayerPhysics(this.localPlayer);
        this.updatePlayerMeshPosition();
    }

    private updatePlayerMeshPosition() {
        if (!this.earth) return;

        const surfaceNormal = new THREE.Vector3(
            this.localPlayer.position.x,
            this.localPlayer.position.y,
            this.localPlayer.position.z
        ).normalize();

        const surfaceHeight = getLogarithmicSize(SOLAR_SYSTEM.earth.radius);
        this.playerMesh.position.copy(surfaceNormal.multiplyScalar(surfaceHeight));
        this.lastPlayerPosition = this.playerMesh.position.clone();
    }

    private updateAllPositions() {
        if (!this.solarSystemObjects) return;

        this.time += SCALE.TIME / 60;

        updateOrbitalPositions(
            this.solarSystemObjects.planets,
            this.solarSystemObjects.moons,
            this.time,
            this.selectedPlanet,
            this.distanceScaleValue
        );

        this.controls.target.set(0, 0, 0);
    }

    private animate() {
        if (!this.isInitialized) return;

        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.updateAllPositions();
        this.renderer.render(this.scene, this.camera);
    }

    private handleClick(event: MouseEvent) {
        if (!this.solarSystemObjects) return;

        // Ignore clicks on UI elements
        const target = event.target as HTMLElement;
        if (target.closest('#vue-ui')) return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const planetMeshes = Array.from(this.solarSystemObjects.planets.values()).map(b => b.mesh);
        const moonMeshes = Array.from(this.solarSystemObjects.moons.values());
        const allBodies = [...planetMeshes, ...moonMeshes];

        const intersects = this.raycaster.intersectObjects(allBodies);

        if (intersects.length > 0) {
            const planetEntry = Array.from(this.solarSystemObjects.planets.entries())
                .find(([_, body]) => body.mesh === intersects[0].object);

            if (planetEntry) {
                this.selectPlanetWithInfo(planetEntry[0]);
                return;
            }

            const moonEntry = Array.from(this.solarSystemObjects.moons.entries())
                .find(([_, mesh]) => mesh === intersects[0].object);

            if (moonEntry) {
                const planetName = moonEntry[0].split('-')[0];
                this.selectPlanetWithInfo(planetName);
            }
        }
    }

    private selectPlanetWithInfo(planetName: string): void {
        this.selectPlanet(planetName);
        // Info panel is handled by Vue UI layer
    }

    private handleGlobalKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            this.isFollowingPlayer = false;
            this.controls.enabled = true;

            // Cancel any camera transition
            if (this.cameraTransition) {
                this.cameraTransition.cancel();
            }

            this.selectPlanet('sun');
        } else if (event.key.toLowerCase() === 'l') {
            this.locatePlayer();
        }
    }

    private selectPlanet(planetName: string) {
        if (!this.solarSystemObjects) return;

        this.selectedPlanet = planetName;
        const body = this.solarSystemObjects.planets.get(planetName);
        if (!body) return;

        this.updateAllPositions();
        this.controls.target.set(0, 0, 0);

        // Initialize camera transition if not exists
        if (!this.cameraTransition) {
            this.cameraTransition = new CameraTransition(this.camera, this.controls);
        }

        let targetPosition: THREE.Vector3;
        const lookAt = new THREE.Vector3(0, 0, 0);

        if (planetName === 'sun') {
            const maxDistance = SOLAR_SYSTEM.neptune?.distanceFromSun || SOLAR_SYSTEM.earth.distanceFromSun;
            targetPosition = new THREE.Vector3(0, maxDistance * SCALE.DISTANCE * this.distanceScaleValue * 1.5, 0);
        } else {
            const planetData = SOLAR_SYSTEM[planetName];
            const distance = getLogarithmicSize(planetData.radius) * 3;
            targetPosition = new THREE.Vector3(distance, distance * 0.7, distance);
        }

        // Use smooth transition
        this.cameraTransition.transitionTo(targetPosition, lookAt, {
            duration: 1200,
            easing: easeOutCubic
        });
    }

    private locatePlayer() {
        if (!this.lastPlayerPosition) return;

        this.controls.enabled = false;
        this.isFollowingPlayer = true;
        this.selectPlanet('earth');
        this.updateCameraFollowPlayer();
    }

    private updateCameraFollowPlayer() {
        if (!this.lastPlayerPosition) return;

        const up = this.lastPlayerPosition.clone().normalize();
        const right = new THREE.Vector3(0, 1, 0).cross(up).normalize();
        const forward = up.clone().cross(right).normalize();

        const playerPos = this.lastPlayerPosition.clone();
        const distance = getLogarithmicSize(SOLAR_SYSTEM.earth.radius);

        const cameraPos = playerPos.clone()
            .add(forward.multiplyScalar(-distance * SCALE.CAMERA_FOLLOW_DISTANCE))
            .add(up.multiplyScalar(distance * SCALE.CAMERA_FOLLOW_HEIGHT));

        this.camera.position.copy(cameraPos);
        this.camera.lookAt(playerPos);
        this.camera.up.copy(up);
        this.controls.target.copy(playerPos);
    }
}

// Start the game
new GameClient();
