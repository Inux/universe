import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Player, Vector3, CONSTANTS } from './models';
import { updatePlayerMovement, updatePlayerPhysics } from './physics';

interface MoonData {
    name: string;
    radius: number;  // km
    distance: number;  // km from planet center
    orbitalPeriod: number;  // days
    color: number;  // hex color
}

interface PlanetData {
    name: string;
    radius: number;  // km
    distanceFromSun: number;  // km
    orbitalPeriod: number;  // days
    rotationPeriod: number;  // hours
    texture: string;
    color: number;  // hex color as fallback
    moons?: MoonData[];  // Optional array of moons
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
    MOVEMENT_SPEED: 0.1,   // Player movement speed
    MOON_SCALE: 1/2       // Scale moons smaller than planets but more visible
};

const SOLAR_SYSTEM: { [key: string]: PlanetData } = {
    sun: {
        name: "Sun",
        radius: 696340,  // Fixed: was 6963, should be 696,340 km
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
        color: 0x2233ff,
        moons: [
            { name: "Moon", radius: 1737.4, distance: 384400, orbitalPeriod: 27.3, color: 0xc0c0c0 }
        ]
    },
    mars: {
        name: "Mars",
        radius: 3389.5,
        distanceFromSun: 227.9e6,
        orbitalPeriod: 687,
        rotationPeriod: 24.6,
        texture: 'https://svs.gsfc.nasa.gov/vis/a000000/a004600/a004676/mars_1k_color.jpg',
        color: 0xcd5c5c,
        moons: [
            { name: "Phobos", radius: 11.1, distance: 9376, orbitalPeriod: 0.32, color: 0x8b7d6b },
            { name: "Deimos", radius: 6.2, distance: 23458, orbitalPeriod: 1.26, color: 0x696969 }
        ]
    },
    jupiter: {
        name: "Jupiter",
        radius: 69911,
        distanceFromSun: 778.5e6,
        orbitalPeriod: 4333,
        rotationPeriod: 9.9,
        texture: 'https://svs.gsfc.nasa.gov/vis/a000000/a004600/a004677/jupiter_1k.jpg',
        color: 0xd8ca9d,
        moons: [
            { name: "Io", radius: 1818.1, distance: 421700, orbitalPeriod: 1.77, color: 0xffff99 },
            { name: "Europa", radius: 1560.8, distance: 670900, orbitalPeriod: 3.55, color: 0xffffff },
            { name: "Ganymede", radius: 2631.2, distance: 1070400, orbitalPeriod: 7.15, color: 0x8b7d6b },
            { name: "Callisto", radius: 2410.3, distance: 1882700, orbitalPeriod: 16.69, color: 0x696969 }
        ]
    },
    saturn: {
        name: "Saturn",
        radius: 58232,
        distanceFromSun: 1432e6,
        orbitalPeriod: 10759,
        rotationPeriod: 10.7,
        texture: 'https://svs.gsfc.nasa.gov/vis/a000000/a004600/a004678/saturn_1k.jpg',
        color: 0xfad5a5,
        moons: [
            { name: "Titan", radius: 2574.7, distance: 1221870, orbitalPeriod: 15.95, color: 0xffd700 },
            { name: "Rhea", radius: 764.3, distance: 527108, orbitalPeriod: 4.52, color: 0xc0c0c0 },
            { name: "Iapetus", radius: 734.5, distance: 3560820, orbitalPeriod: 79.33, color: 0x8b7d6b },
            { name: "Dione", radius: 561.4, distance: 377396, orbitalPeriod: 2.74, color: 0xffffff }
        ]
    },
    uranus: {
        name: "Uranus",
        radius: 25362,
        distanceFromSun: 2867e6,
        orbitalPeriod: 30687,
        rotationPeriod: -17.2,
        texture: 'https://svs.gsfc.nasa.gov/vis/a000000/a004600/a004679/uranus_1k.jpg',
        color: 0x4fd0e7,
        moons: [
            { name: "Titania", radius: 788.9, distance: 435910, orbitalPeriod: 8.71, color: 0xc0c0c0 },
            { name: "Oberon", radius: 761.4, distance: 583520, orbitalPeriod: 13.46, color: 0x8b7d6b },
            { name: "Umbriel", radius: 584.7, distance: 266300, orbitalPeriod: 4.14, color: 0x696969 },
            { name: "Ariel", radius: 578.9, distance: 191020, orbitalPeriod: 2.52, color: 0xffffff }
        ]
    },
    neptune: {
        name: "Neptune",
        radius: 24622,
        distanceFromSun: 4515e6,
        orbitalPeriod: 60190,
        rotationPeriod: 16.1,
        texture: 'https://svs.gsfc.nasa.gov/vis/a000000/a004600/a004680/neptune_1k.jpg',
        color: 0x4169e1,
        moons: [
            { name: "Triton", radius: 1353.4, distance: 354759, orbitalPeriod: 5.88, color: 0x87ceeb },
            { name: "Nereid", radius: 178.5, distance: 5513818, orbitalPeriod: 360.14, color: 0x696969 }
        ]
    }
};

class GameClient {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls!: OrbitControls;
    private earth: THREE.Mesh;
    private playerMesh: THREE.Mesh;
    private clientId: string;
    private movement: Vector3;
    private planets: Map<string, THREE.Mesh>;
    private moons: Map<string, THREE.Mesh>;
    private hudElement!: HTMLDivElement;
    private distanceScaleSlider!: HTMLInputElement;
    private distanceScaleValue: number;
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

    // Local player state (replaces WebSocket multiplayer)
    private localPlayer: Player;
    private gameLoopId: number | null = null;

    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000000);
        this.renderer = new THREE.WebGLRenderer();
        this.earth = new THREE.Mesh();
        this.clientId = Math.random().toString(36);
        this.movement = { x: 0, y: 0, z: 0 };
        this.planets = new Map();
        this.moons = new Map();
        this.distanceScaleValue = 1.0;
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
        this.initSolarSystem().then(() => {
            this.isInitialized = true;
            this.loadingElement.style.display = 'none';
            this.startGameLoop();
            this.animate();
        }).catch(error => {
            console.error('Failed to initialize solar system:', error);
            this.loadingElement.textContent = 'Failed to load solar system';
        });

        // Add click and keyboard listeners
        window.addEventListener('click', this.handleClick.bind(this));
        window.addEventListener('keydown', this.handleGlobalKeyDown.bind(this));
    }

    private createPlayerMesh(): THREE.Mesh {
        const geometry = new THREE.SphereGeometry(
            SOLAR_SYSTEM.earth.radius * SCALE.SIZE * SCALE.PLAYER,
            32, 32
        );
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
        document.body.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(ambientLight, directionalLight);

        // Set initial camera position to view entire system
        const maxDistance = SOLAR_SYSTEM.neptune?.distanceFromSun || SOLAR_SYSTEM.earth.distanceFromSun;
        this.camera.position.set(0, maxDistance * SCALE.DISTANCE * this.distanceScaleValue * 1.5, 0);
        this.camera.lookAt(0, 0, 0);
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

    private startGameLoop() {
        this.gameLoopId = setInterval(() => {
            this.updateGameState();
        }, 1000 / CONSTANTS.TICK_RATE);
    }

    private updateGameState() {
        if (!this.isInitialized) return;

        // Update player movement based on current input
        if (this.movement.x !== 0 || this.movement.y !== 0 || this.movement.z !== 0) {
            updatePlayerMovement(this.localPlayer, this.movement);
        }

        // Update player physics
        updatePlayerPhysics(this.localPlayer);

        // Update player mesh position
        this.updatePlayerMeshPosition();

        // Update HUD
        this.updateHUD();
    }

    private updatePlayerMeshPosition() {
        const earth = this.planets.get('earth');
        if (!earth) return;

        // Position relative to Earth's surface
        const surfaceNormal = new THREE.Vector3(
            this.localPlayer.position.x,
            this.localPlayer.position.y,
            this.localPlayer.position.z
        ).normalize();

        const surfaceHeight = SOLAR_SYSTEM.earth.radius * SCALE.SIZE;
        this.playerMesh.position.copy(surfaceNormal.multiplyScalar(surfaceHeight));

        this.lastPlayerPosition = this.playerMesh.position.clone();
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

        // Add distance scale slider
        const sliderContainer = document.createElement('div');
        sliderContainer.style.position = 'fixed';
        sliderContainer.style.bottom = '20px';
        sliderContainer.style.left = '20px';
        sliderContainer.style.color = 'white';
        sliderContainer.style.fontFamily = 'Arial, sans-serif';
        sliderContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        sliderContainer.style.padding = '10px';
        sliderContainer.style.borderRadius = '5px';

        const sliderLabel = document.createElement('div');
        sliderLabel.textContent = `Distance Scale: ${this.distanceScaleValue.toFixed(2)}x`;
        sliderLabel.style.marginBottom = '5px';

        this.distanceScaleSlider = document.createElement('input');
        this.distanceScaleSlider.type = 'range';
        this.distanceScaleSlider.min = '0.1';
        this.distanceScaleSlider.max = '10.0';
        this.distanceScaleSlider.step = '0.1';
        this.distanceScaleSlider.value = this.distanceScaleValue.toString();
        this.distanceScaleSlider.style.width = '200px';

        this.distanceScaleSlider.addEventListener('input', (e) => {
            this.distanceScaleValue = parseFloat((e.target as HTMLInputElement).value);
            sliderLabel.textContent = `Distance Scale: ${this.distanceScaleValue.toFixed(2)}x`;

            // Update all positions when scale changes
            this.updateAllPositions();
        });

        sliderContainer.appendChild(sliderLabel);
        sliderContainer.appendChild(this.distanceScaleSlider);
        document.body.appendChild(sliderContainer);
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
                const scaledDistance = data.distanceFromSun * SCALE.DISTANCE * this.distanceScaleValue;
                planet.position.x = Math.cos(angle) * scaledDistance;
                planet.position.z = Math.sin(angle) * scaledDistance;

                this.scene.add(planet);
                this.planets.set(name, planet);

                if (name === 'earth') {
                    this.earth = planet;
                }

                // Create moons for this planet
                if (data.moons) {
                    for (const moonData of data.moons) {
                        const moonGeometry = new THREE.SphereGeometry(
                            Math.max(moonData.radius * SCALE.SIZE * SCALE.MOON_SCALE, 0.01), // Ensure minimum visible size
                            16, 16
                        );
                        const moonMaterial = new THREE.MeshPhongMaterial({
                            color: moonData.color,
                            emissive: moonData.color,
                            emissiveIntensity: 0.2 // Make moons slightly emissive for visibility
                        });
                        const moon = new THREE.Mesh(moonGeometry, moonMaterial);

                        // Position moon relative to planet
                        const moonAngle = Math.random() * Math.PI * 2;
                        const moonDistance = moonData.distance * SCALE.DISTANCE * this.distanceScaleValue;
                        moon.position.x = planet.position.x + Math.cos(moonAngle) * moonDistance;
                        moon.position.z = planet.position.z + Math.sin(moonAngle) * moonDistance;
                        moon.position.y = planet.position.y;

                        this.scene.add(moon);
                        this.moons.set(`${name}-${moonData.name}`, moon);
                    }
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

    private updateAllPositions() {
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

            const scaledDistance = data.distanceFromSun * SCALE.DISTANCE * this.distanceScaleValue;
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

            // Update moon positions
            if (data.moons) {
                for (const moonData of data.moons) {
                    const moon = this.moons.get(`${name}-${moonData.name}`);
                    if (!moon) continue;

                    const moonOrbitalSpeed = (2 * Math.PI) / (moonData.orbitalPeriod * 24 * 60 * 60);
                    const moonAngle = this.time * moonOrbitalSpeed;
                    const moonDistance = moonData.distance * SCALE.DISTANCE * this.distanceScaleValue;

                    moon.position.x = planet.position.x + Math.cos(moonAngle) * moonDistance;
                    moon.position.z = planet.position.z + Math.sin(moonAngle) * moonDistance;
                    moon.position.y = planet.position.y;

                    // Moon rotation
                    moon.rotation.y += moonOrbitalSpeed * SCALE.TIME/60;
                }
            }
        }

        // Update controls target to keep focused on selected planet
        this.controls.target.set(0, 0, 0);

        // Update player position only if not following player
        if (!this.isFollowingPlayer && this.lastPlayerPosition) {
            const relativePos = this.playerMesh.position.clone().sub(selectedPosition);
            this.playerMesh.position.copy(relativePos);
        }
    }

    private animate() {
        if (!this.isInitialized) return;

        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.updateAllPositions();
        this.renderer.render(this.scene, this.camera);
    }

    private handleClick(event: MouseEvent) {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Calculate objects intersecting the picking ray (include both planets and moons)
        const allBodies = [...Array.from(this.planets.values()), ...Array.from(this.moons.values())];
        const intersects = this.raycaster.intersectObjects(allBodies);

        if (intersects.length > 0) {
            // Find the body name from the intersected mesh
            const planetEntry = Array.from(this.planets.entries())
                .find(([_, mesh]) => mesh === intersects[0].object);

            if (planetEntry) {
                this.selectPlanet(planetEntry[0]);
                return;
            }

            // Check if it's a moon
            const moonEntry = Array.from(this.moons.entries())
                .find(([_, mesh]) => mesh === intersects[0].object);

            if (moonEntry) {
                const [moonKey] = moonEntry;
                // For now, just select the planet that the moon orbits
                const planetName = moonKey.split('-')[0];
                this.selectPlanet(planetName);
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
        this.updateAllPositions();

        // Update moon positions to match new reference frame
        for (const [name, data] of Object.entries(SOLAR_SYSTEM)) {
            if (data.moons) {
                const planet = this.planets.get(name);
                if (!planet) continue;

                for (const moonData of data.moons) {
                    const moon = this.moons.get(`${name}-${moonData.name}`);
                    if (!moon) continue;

                    // Calculate moon position relative to its planet in the current reference frame
                    const moonOrbitalSpeed = (2 * Math.PI) / (moonData.orbitalPeriod * 24 * 60 * 60);
                    const moonAngle = this.time * moonOrbitalSpeed;
                    const moonDistance = moonData.distance * SCALE.DISTANCE * this.distanceScaleValue;

                    moon.position.x = planet.position.x + Math.cos(moonAngle) * moonDistance;
                    moon.position.z = planet.position.z + Math.sin(moonAngle) * moonDistance;
                    moon.position.y = planet.position.y;
                }
            }
        }

        // Update controls target
        this.controls.target.set(0, 0, 0);

        // If selecting sun, move camera to overview position
        if (planetName === 'sun') {
            const maxDistance = SOLAR_SYSTEM.neptune?.distanceFromSun || SOLAR_SYSTEM.earth.distanceFromSun;
            this.camera.position.set(0, maxDistance * SCALE.DISTANCE * this.distanceScaleValue * 1.5, 0);
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
