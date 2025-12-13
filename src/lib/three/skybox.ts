import * as THREE from 'three';

/**
 * Creates a procedural starfield background
 * Uses particle system for stars with varying sizes and colors
 */
export function createStarfield(scene: THREE.Scene, starCount: number = 10000): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];

    const colorPalette = [
        new THREE.Color(0xffffff), // White
        new THREE.Color(0xffeedd), // Warm white
        new THREE.Color(0xddddff), // Cool white
        new THREE.Color(0xffccaa), // Orange tint
        new THREE.Color(0xaaccff), // Blue tint
        new THREE.Color(0xffffaa), // Yellow tint
    ];

    for (let i = 0; i < starCount; i++) {
        // Distribute stars on a large sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 500000 + Math.random() * 100000; // Far away

        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);

        positions.push(x, y, z);

        // Random color from palette with slight variation
        const baseColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        const variation = 0.1;
        colors.push(
            baseColor.r + (Math.random() - 0.5) * variation,
            baseColor.g + (Math.random() - 0.5) * variation,
            baseColor.b + (Math.random() - 0.5) * variation
        );

        // Varying star sizes - most small, few large
        const sizeRandom = Math.random();
        let size: number;
        if (sizeRandom < 0.7) {
            size = 1 + Math.random() * 2; // Small stars
        } else if (sizeRandom < 0.95) {
            size = 3 + Math.random() * 3; // Medium stars
        } else {
            size = 6 + Math.random() * 6; // Bright stars
        }
        sizes.push(size);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
        size: 3,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: false, // Stars stay same size regardless of distance
    });

    const stars = new THREE.Points(geometry, material);
    stars.name = 'starfield';
    scene.add(stars);

    return stars;
}

/**
 * Creates a subtle nebula/galaxy background using a large textured sphere
 * Uses procedural gradient for a space atmosphere feel
 */
export function createSpaceBackground(scene: THREE.Scene): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(600000, 32, 32);

    // Create a gradient texture for the background
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Create a dark space gradient with subtle color variations
    const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, '#0a0a15');
    gradient.addColorStop(0.3, '#050510');
    gradient.addColorStop(0.6, '#020208');
    gradient.addColorStop(1, '#000005');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add some nebula-like color patches
    const nebulaColors = [
        { color: 'rgba(100, 50, 150, 0.03)', x: 0.2, y: 0.3 },
        { color: 'rgba(50, 100, 150, 0.02)', x: 0.7, y: 0.6 },
        { color: 'rgba(150, 80, 50, 0.02)', x: 0.5, y: 0.8 },
        { color: 'rgba(80, 120, 180, 0.03)', x: 0.3, y: 0.7 },
    ];

    for (const nebula of nebulaColors) {
        const nebulaGradient = ctx.createRadialGradient(
            canvas.width * nebula.x, canvas.height * nebula.y, 0,
            canvas.width * nebula.x, canvas.height * nebula.y, canvas.width * 0.3
        );
        nebulaGradient.addColorStop(0, nebula.color);
        nebulaGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = nebulaGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Add Milky Way band effect
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(Math.PI / 6); // Tilt the band

    const milkyWayGradient = ctx.createLinearGradient(0, -canvas.height, 0, canvas.height);
    milkyWayGradient.addColorStop(0, 'transparent');
    milkyWayGradient.addColorStop(0.4, 'rgba(200, 200, 255, 0.02)');
    milkyWayGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)');
    milkyWayGradient.addColorStop(0.6, 'rgba(200, 200, 255, 0.02)');
    milkyWayGradient.addColorStop(1, 'transparent');

    ctx.fillStyle = milkyWayGradient;
    ctx.fillRect(-canvas.width, -canvas.height / 4, canvas.width * 2, canvas.height / 2);
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide,
        transparent: true,
    });

    const background = new THREE.Mesh(geometry, material);
    background.name = 'spaceBackground';
    scene.add(background);

    return background;
}

/**
 * Creates distant galaxy sprites for visual depth
 */
export function createDistantGalaxies(scene: THREE.Scene, count: number = 50): THREE.Group {
    const galaxyGroup = new THREE.Group();
    galaxyGroup.name = 'galaxies';

    // Create a simple galaxy texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Draw a fuzzy ellipse for galaxy
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.2, 'rgba(200, 200, 255, 0.4)');
    gradient.addColorStop(0.5, 'rgba(150, 150, 200, 0.1)');
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(32, 32, 30, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);

    for (let i = 0; i < count; i++) {
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.3 + Math.random() * 0.4,
            color: new THREE.Color().setHSL(Math.random() * 0.1 + 0.6, 0.3, 0.7),
        });

        const sprite = new THREE.Sprite(material);

        // Position far away
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = 400000 + Math.random() * 100000;

        sprite.position.set(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
        );

        // Random size and rotation
        const scale = 2000 + Math.random() * 8000;
        sprite.scale.set(scale, scale * (0.3 + Math.random() * 0.4), 1);

        galaxyGroup.add(sprite);
    }

    scene.add(galaxyGroup);
    return galaxyGroup;
}
