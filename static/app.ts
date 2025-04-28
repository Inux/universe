import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

interface Vector3 {
    x: number;
    y: number;
    z: number;
}

interface Camera {
    position: Vector3;
    target: Vector3;
    zoom: number;
}

interface Movement {
    isWalking: boolean;
    isSwimming: boolean;
    isDiving: boolean;
    isClimbing: boolean;
    diveTime: number;
    maxDiveTime: number;
}

interface Physics {
    velocity: Vector3;
    acceleration: Vector3;
    grounded: boolean;
}

interface Player {
    id: string;
    position: Vector3;
    rotation: Vector3;
    camera: Camera;
    movement: Movement;
    physics: Physics;
}

interface PlanetData {
    name: string;
    radius: number;  // km
    distanceFromSun: number;  // km
    orbitalPeriod: number;  // days
    rotationPeriod: number;  // hours
    texture: string;
    color: number;  // hex color as fallback
}

const SCALE = {
    DISTANCE: 1/100000,    // Less extreme scaling for distances
    SIZE: 1/100,          // Less extreme scaling for sizes
    TIME: 1000000,        // Speed up time
    MIN_HEIGHT: 0.005,    // 5 meters minimum height
    MAX_HEIGHT: 5e8,      // 500,000 km maximum height
    PLAYER: 0.5,         // Make player 5% of Earth's radius
    GRAVITY: 0.5,         // Half of Earth's gravity for fun jumping
    JUMP_FORCE: 0.1,      // Smaller jump force
    JUMP_HEIGHT: 0.0001,   // Maximum jump height relative to Earth radius
    CAMERA_FOLLOW_HEIGHT: 0.2,    // Camera height when following player
    CAMERA_FOLLOW_DISTANCE: 0.3,  // Camera distance when following player
    MOVEMENT_SPEED: 0.1    // Player movement speed
};

const SOLAR_SYSTEM: { [key: string]: PlanetData } = {
    sun: {
        name: "Sun",
        radius: 6963,
        distanceFromSun: 0,
        orbitalPeriod: 0,
        rotationPeriod: 609.6,
        texture: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg',
        color: 0xffdd44
    },
    mercury: {
        name: "Mercury",
        radius: 2439.7,
        distanceFromSun: 57.9e6,
        orbitalPeriod: 88,
        rotationPeriod: 1407.6,
        texture: 'https://svs.gsfc.nasa.gov/vis/a000000/a004600/a004675/mercury_1k_color.jpg',
        color: 0x888888
    },
    venus: {
        name: "Venus",
        radius: 6051.8,
        distanceFromSun: 108.2e6,
        orbitalPeriod: 224.7,
        rotationPeriod: -5832.5,
        texture: 'https://svs.gsfc.nasa.gov/vis/a000000/a004600/a004674/venus_1k.jpg',
        color: 0xffd700
    },
    earth: {
        name: "Earth",
        radius: 6371,
        distanceFromSun: 149.6e6,
        orbitalPeriod: 365.25,
        rotationPeriod: 24,
        texture: 'https://svs.gsfc.nasa.gov/vis/a000000/a004600/a004673/earth_1k.jpg',
        color: 0x2233ff
    },
    // ... add other planets similarly
};

class GameClient {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls!: OrbitControls;
    private earth: THREE.Mesh;
    private players: Map<string, THREE.Mesh>;
    private ws!: WebSocket;
    private clientId: string;
    private movement: Vector3;
    private planets: Map<string, THREE.Mesh>;
    private hudElement!: HTMLDivElement;
    private textureLoader: THREE.TextureLoader;
    private currentPlanet: string = 'earth';
    private time: number = 0;
    private loadingElement: HTMLDivElement;
    private isInitialized: boolean = false;
    private selectedPlanet: string = 'sun';  // Change default to sun
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private playerScale: number = SCALE.PLAYER;
    private lastPlayerPosition: THREE.Vector3 | null = null;
    private readonly PLAYER_VIEW_DISTANCE = 2; // Distance multiplier for player view
    private isJumping: boolean = false;
    private jumpVelocity: number = 0;
    private isFollowingPlayer: boolean = false;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000000);
        this.renderer = new THREE.WebGLRenderer();
        this.earth = new THREE.Mesh();
        this.players = new Map();
        this.clientId = Math.random().toString(36);
        this.movement = { x: 0, y: 0, z: 0 };
        this.planets = new Map();
        this.textureLoader = new THREE.TextureLoader();
        this.loadingElement = document.getElementById('loading') as HTMLDivElement;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.initThree();
        this.initWebSocket();
        this.initControls();
        this.initHUD();
        this.initSolarSystem().then(() => {
            this.isInitialized = true;
            this.loadingElement.style.display = 'none';
            this.animate();
        }).catch(error => {
            console.error('Failed to initialize solar system:', error);
            this.loadingElement.textContent = 'Failed to load solar system';
        });

        // Add click and keyboard listeners
        window.addEventListener('click', this.handleClick.bind(this));
        window.addEventListener('keydown', this.handleGlobalKeyDown.bind(this));
    }

    private initThree() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(ambientLight, directionalLight);

        // Set initial camera position to view entire system
        const maxDistance = SOLAR_SYSTEM.neptune?.distanceFromSun || SOLAR_SYSTEM.earth.distanceFromSun;
        this.camera.position.set(0, maxDistance * SCALE.DISTANCE * 1.5, 0);
        this.camera.lookAt(0, 0, 0);
    }

    private initWebSocket() {
        this.ws = new WebSocket(`ws://localhost:8080/ws?clientId=${this.clientId}`);

        this.ws.onmessage = (event) => {
            const worldState = JSON.parse(event.data);
            console.log("Received world state", worldState);
            this.updateWorld(worldState);
        };
    }

    private initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = SOLAR_SYSTEM.earth.radius * SCALE.SIZE + SCALE.MIN_HEIGHT;
        this.controls.maxDistance = SCALE.MAX_HEIGHT;
        this.controls.enablePan = true;
        this.controls.enableZoom = true;

        // Movement controls
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    private handleKeyDown(e: KeyboardEvent) {
        // Convert WASD movement to tangent space of the sphere
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
        this.sendMovement();
    }

    private handleKeyUp(e: KeyboardEvent) {
        switch (e.key.toLowerCase()) {
            case 'w': case 's': case 'a': case 'd':
                this.movement.x = 0;
                this.movement.y = 0;
                this.movement.z = 0;
                break;
        }
        this.sendMovement();
    }

    private sendMovement() {
        this.ws.send(JSON.stringify({
            type: 'movement',
            movement: this.movement,
            clientId: this.clientId
        }));
    }

    private updateWorld(worldState: any) {
        const players = worldState.players as { [key: string]: Player };
        const earth = this.planets.get('earth');

        if (!earth) return;

        (Object.entries(players) as [string, Player][]).forEach(([id, player]) => {
            let playerMesh = this.players.get(id);

            if (!playerMesh) {
                // Create player mesh with proper spherical geometry
                const geometry = new THREE.SphereGeometry(
                    SOLAR_SYSTEM.earth.radius * SCALE.SIZE * SCALE.PLAYER,
                    32, 32
                );

                // Make player more visible
                const material = new THREE.MeshPhongMaterial({
                    color: id === this.clientId ? 0xff0000 : 0x00ff00,
                    emissive: id === this.clientId ? 0xff0000 : 0x00ff00,
                    emissiveIntensity: 0.5
                });
                playerMesh = new THREE.Mesh(geometry, material);

                this.scene.add(playerMesh);
                this.players.set(id, playerMesh);
            }

            // Position relative to Earth's surface
            const surfaceNormal = new THREE.Vector3(
                player.position.x,
                player.position.y,
                player.position.z
            ).normalize();

            const surfaceHeight = SOLAR_SYSTEM.earth.radius * SCALE.SIZE;
            playerMesh.position.copy(surfaceNormal.multiplyScalar(surfaceHeight));

            if (id === this.clientId) {
                this.lastPlayerPosition = playerMesh.position.clone();
            }
        });
    }

    private initHUD() {
        this.hudElement = document.createElement('div');
        this.hudElement.style.position = 'fixed';
        this.hudElement.style.top = '20px';
        this.hudElement.style.right = '20px';
        this.hudElement.style.color = 'white';
        this.hudElement.style.fontFamily = 'Arial, sans-serif';
        this.hudElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.hudElement.style.padding = '10px';
        this.hudElement.style.borderRadius = '5px';
        document.body.appendChild(this.hudElement);
    }

    private updateHUD() {
        const currentPlanetData = SOLAR_SYSTEM[this.selectedPlanet];
        const height = this.calculateHeightAboveSurface();

        this.hudElement.innerHTML = `
            <div>Selected Body: ${currentPlanetData.name}</div>
            <div>Height: ${height.toFixed(2)} km</div>
            <div>Distance from Sun: ${(currentPlanetData.distanceFromSun/1e6).toFixed(1)} million km</div>
            <div>Orbital Period: ${currentPlanetData.orbitalPeriod} days</div>
            <div><small>Click on a planet to focus, ESC to view all</small></div>
            <div><small>Press 'L' to locate player</small></div>
        `;
    }

    private calculateHeightAboveSurface(): number {
        const planetData = SOLAR_SYSTEM[this.selectedPlanet];
        const planetMesh = this.planets.get(this.selectedPlanet);
        if (!planetMesh) return 0;

        const distanceFromCenter = this.camera.position.distanceTo(planetMesh.position);
        const heightInKm = (distanceFromCenter / SCALE.SIZE) - planetData.radius;

        if (heightInKm < 0.005) return 0.005; // Minimum 5 meters
        return heightInKm;
    }

    private async loadTextureWithFallback(url: string, color: number): Promise<THREE.Texture | null> {
        try {
            return await new Promise((resolve, reject) => {
                this.textureLoader.load(url, resolve, undefined, reject);
            });
        } catch (error) {
            console.warn(`Failed to load texture ${url}, using color fallback`);
            return null;
        }
    }

    private async initSolarSystem() {
        try {
            // Create sun
            const sunGeometry = new THREE.SphereGeometry(SOLAR_SYSTEM.sun.radius * SCALE.SIZE, 64, 64);
            const sunTexture = await this.loadTextureWithFallback(SOLAR_SYSTEM.sun.texture, SOLAR_SYSTEM.sun.color);
            const sunMaterial = new THREE.MeshBasicMaterial({
                color: SOLAR_SYSTEM.sun.color,
                map: sunTexture || null
            });
            const sun = new THREE.Mesh(sunGeometry, sunMaterial);
            this.scene.add(sun);
            this.planets.set('sun', sun);

            // Add point light at sun's position
            const sunLight = new THREE.PointLight(0xffffff, 2);
            sun.add(sunLight);

            // Create planets
            for (const [name, data] of Object.entries(SOLAR_SYSTEM)) {
                if (name === 'sun') continue;

                const planetGeometry = new THREE.SphereGeometry(data.radius * SCALE.SIZE, 32, 32);
                const texture = await this.loadTextureWithFallback(data.texture, data.color);
                const planetMaterial = new THREE.MeshPhongMaterial({
                    color: texture ? 0xffffff : data.color, // Use color if texture failed
                    map: texture || null
                });
                const planet = new THREE.Mesh(planetGeometry, planetMaterial);

                // Initial position
                const angle = Math.random() * Math.PI * 2;
                const scaledDistance = data.distanceFromSun * SCALE.DISTANCE;
                planet.position.x = Math.cos(angle) * scaledDistance;
                planet.position.z = Math.sin(angle) * scaledDistance;

                this.scene.add(planet);
                this.planets.set(name, planet);

                if (name === 'earth') {
                    this.earth = planet;
                }
            }

            // Set initial camera position relative to Earth
            const earth = this.planets.get('earth')!;
            this.camera.position.copy(earth.position);
            this.camera.position.y += SOLAR_SYSTEM.earth.radius * SCALE.SIZE * 2;
            this.camera.lookAt(earth.position);

        } catch (error) {
            console.error('Error creating solar system:', error);
            throw error;
        }
    }

    private updatePlanetPositions() {
        this.time += SCALE.TIME/60;

        // Get the selected planet's theoretical position (where it would be)
        const selectedData = SOLAR_SYSTEM[this.selectedPlanet];
        let selectedPosition = new THREE.Vector3(0, 0, 0);
        if (this.selectedPlanet !== 'sun') {
            const selectedDistance = selectedData.distanceFromSun * SCALE.DISTANCE;
            const selectedOrbitalSpeed = (2 * Math.PI) / (selectedData.orbitalPeriod * 24 * 60 * 60);
            const selectedAngle = this.time * selectedOrbitalSpeed;
            selectedPosition.x = Math.cos(selectedAngle) * selectedDistance;
            selectedPosition.z = Math.sin(selectedAngle) * selectedDistance;
        }

        // Update all planets' positions relative to the selected planet
        for (const [name, data] of Object.entries(SOLAR_SYSTEM)) {
            const planet = this.planets.get(name);
            if (!planet) continue;

            if (name === 'sun') {
                // Move sun opposite to selected planet's position
                planet.position.copy(selectedPosition).multiplyScalar(-1);
                continue;
            }

            const scaledDistance = data.distanceFromSun * SCALE.DISTANCE;
            const orbitalSpeed = (2 * Math.PI) / (data.orbitalPeriod * 24 * 60 * 60);
            const angle = this.time * orbitalSpeed;

            if (name === this.selectedPlanet) {
                // Selected planet stays at origin
                planet.position.set(0, 0, 0);
            } else {
                // Other planets move relative to selected planet
                planet.position.x = Math.cos(angle) * scaledDistance - selectedPosition.x;
                planet.position.z = Math.sin(angle) * scaledDistance - selectedPosition.z;
            }

            // Planet rotation
            const rotationSpeed = (2 * Math.PI) / (data.rotationPeriod * 60 * 60);
            planet.rotation.y += rotationSpeed * SCALE.TIME/60;
        }

        // Update controls target to keep focused on selected planet
        this.controls.target.set(0, 0, 0);

        // Update player positions only if not following player
        if (!this.isFollowingPlayer && this.lastPlayerPosition) {
            this.players.forEach((playerMesh, id) => {
                if (id === this.clientId) {
                    const relativePos = playerMesh.position.clone().sub(selectedPosition);
                    playerMesh.position.copy(relativePos);
                }
            });
        }
    }

    private animate() {
        if (!this.isInitialized) return;

        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.updatePlanetPositions();
        this.updateHUD();
        this.renderer.render(this.scene, this.camera);
    }

    private handleClick(event: MouseEvent) {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Calculate objects intersecting the picking ray
        const intersects = this.raycaster.intersectObjects(Array.from(this.planets.values()));

        if (intersects.length > 0) {
            // Find the planet name from the intersected mesh
            const planetEntry = Array.from(this.planets.entries())
                .find(([_, mesh]) => mesh === intersects[0].object);

            if (planetEntry) {
                this.selectPlanet(planetEntry[0]);
            }
        }
    }

    private handleGlobalKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            this.isFollowingPlayer = false;
            this.controls.enabled = true;  // Re-enable orbit controls
            this.selectPlanet('sun');
        } else if (event.key.toLowerCase() === 'l') {
            this.locatePlayer();
        }
    }

    private selectPlanet(planetName: string) {
        this.selectedPlanet = planetName;
        const planet = this.planets.get(planetName);
        if (!planet) return;

        // Reset all planet positions before changing reference frame
        this.updatePlanetPositions();

        // Update controls target
        this.controls.target.set(0, 0, 0);

        // If selecting sun, move camera to overview position
        if (planetName === 'sun') {
            const maxDistance = SOLAR_SYSTEM.neptune?.distanceFromSun || SOLAR_SYSTEM.earth.distanceFromSun;
            this.camera.position.set(0, maxDistance * SCALE.DISTANCE * 1.5, 0);
        } else {
            // Move camera to view the selected planet
            const planetData = SOLAR_SYSTEM[planetName];
            const distance = planetData.radius * SCALE.SIZE * 10;
            const offset = new THREE.Vector3(distance, distance, distance);
            this.camera.position.copy(offset);
        }
    }

    private locatePlayer() {
        if (!this.lastPlayerPosition) return;

        // Disable orbit controls when following player
        this.controls.enabled = false;
        this.isFollowingPlayer = true;

        // Select Earth when locating player
        this.selectPlanet('earth');

        // Initial camera update
        this.updateCameraFollowPlayer();

        // Update HUD
        this.hudElement.innerHTML = `
            <div>Following Player</div>
            <div style="color: #ff6666">Press ESC to exit follow mode</div>
        `;
    }

    private updateCameraFollowPlayer() {
        if (!this.lastPlayerPosition) return;

        // Get player's orientation on the sphere
        const up = this.lastPlayerPosition.clone().normalize();
        const right = new THREE.Vector3(0, 1, 0).cross(up).normalize();
        const forward = up.clone().cross(right).normalize();

        // Calculate camera position
        const playerPos = this.lastPlayerPosition.clone();
        const distance = SOLAR_SYSTEM.earth.radius * SCALE.SIZE;

        // Position camera behind and above player
        const cameraPos = playerPos.clone()
            .add(forward.multiplyScalar(-distance * SCALE.CAMERA_FOLLOW_DISTANCE))
            .add(up.multiplyScalar(distance * SCALE.CAMERA_FOLLOW_HEIGHT));

        // Update camera
        this.camera.position.copy(cameraPos);
        this.camera.lookAt(playerPos);
        this.camera.up.copy(up);

        // Update controls target
        this.controls.target.copy(playerPos);
    }
}

// Start the game
new GameClient();