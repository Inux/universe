import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Player, Vector3, CONSTANTS } from './models';
import { updatePlayerMovement, updatePlayerPhysics } from './physics';
import { createStarfield, createSpaceBackground, createDistantGalaxies } from './skybox';
import {
    SOLAR_SYSTEM,
    SCALE,
    DISTANCE_SCALE_FACTOR,
    getLogarithmicSize,
    createSolarSystem,
    updateOrbitalPositions,
    CelestialBody,
    SolarSystemObjects
} from './solarSystem';

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
    private hudElement!: HTMLDivElement;
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
        this.initHUD();
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
        this.updateHUD();
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

    private initHUD() {
        this.hudElement = document.createElement('div');
        this.hudElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            color: white;
            font-family: 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.7), rgba(20, 20, 40, 0.7));
            padding: 15px 20px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            min-width: 180px;
        `;
        document.body.appendChild(this.hudElement);

        const controlsHint = document.createElement('div');
        controlsHint.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            color: white;
            font-family: 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.6), rgba(20, 20, 40, 0.6));
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            font-size: 12px;
            line-height: 1.6;
        `;
        controlsHint.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; color: #88aaff;">Controls</div>
            <div>🖱️ Click planet to focus</div>
            <div>⎋ ESC - View all</div>
            <div>📍 L - Locate player</div>
            <div>🎮 WASD - Move | Space - Jump</div>
        `;
        document.body.appendChild(controlsHint);
    }

    private updateHUD() {
        const currentPlanetData = SOLAR_SYSTEM[this.selectedPlanet];
        if (!currentPlanetData) return;

        const planetEmoji = this.getPlanetEmoji(this.selectedPlanet);

        this.hudElement.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #ffdd88;">
                ${planetEmoji} ${currentPlanetData.name}
            </div>
            <div style="font-size: 13px; opacity: 0.9;">
                <div style="margin: 4px 0;">📏 Radius: ${currentPlanetData.radius.toLocaleString()} km</div>
                <div style="margin: 4px 0;">🌍 Distance: ${(currentPlanetData.distanceFromSun/1e6).toFixed(1)}M km</div>
                <div style="margin: 4px 0;">📅 Year: ${currentPlanetData.orbitalPeriod.toLocaleString()} days</div>
                <div style="margin: 4px 0;">⏰ Day: ${Math.abs(currentPlanetData.rotationPeriod).toFixed(1)} hours</div>
            </div>
        `;
    }

    private getPlanetEmoji(name: string): string {
        const emojis: { [key: string]: string } = {
            sun: '☀️',
            mercury: '☿️',
            venus: '♀️',
            earth: '🌍',
            mars: '🔴',
            jupiter: '🟠',
            saturn: '🪐',
            uranus: '🔵',
            neptune: '🔷'
        };
        return emojis[name] || '🌑';
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
                this.selectPlanet(planetEntry[0]);
                return;
            }

            const moonEntry = Array.from(this.solarSystemObjects.moons.entries())
                .find(([_, mesh]) => mesh === intersects[0].object);

            if (moonEntry) {
                const planetName = moonEntry[0].split('-')[0];
                this.selectPlanet(planetName);
            }
        }
    }

    private handleGlobalKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            this.isFollowingPlayer = false;
            this.controls.enabled = true;
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

        if (planetName === 'sun') {
            const maxDistance = SOLAR_SYSTEM.neptune?.distanceFromSun || SOLAR_SYSTEM.earth.distanceFromSun;
            this.camera.position.set(0, maxDistance * SCALE.DISTANCE * this.distanceScaleValue * 1.5, 0);
        } else {
            const planetData = SOLAR_SYSTEM[planetName];
            const distance = getLogarithmicSize(planetData.radius) * 3;
            const offset = new THREE.Vector3(distance, distance, distance);
            this.camera.position.copy(offset);
        }
    }

    private locatePlayer() {
        if (!this.lastPlayerPosition) return;

        this.controls.enabled = false;
        this.isFollowingPlayer = true;
        this.selectPlanet('earth');
        this.updateCameraFollowPlayer();

        this.hudElement.innerHTML = `
            <div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">Following Player</div>
            <div style="color: #ff6666;">Press ESC to exit follow mode</div>
        `;
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
