import * as THREE from 'three';

export interface TransitionOptions {
    duration: number;      // milliseconds
    easing: (t: number) => number;
}

const defaultOptions: TransitionOptions = {
    duration: 1500,
    easing: easeOutCubic
};

/**
 * Easing functions for smooth camera transitions
 */
export function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutExpo(t: number): number {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Smoothly transitions camera position and target
 */
export class CameraTransition {
    private camera: THREE.PerspectiveCamera;
    private controls: { target: THREE.Vector3; update: () => void };
    private isAnimating: boolean = false;
    private animationId: number | null = null;

    constructor(
        camera: THREE.PerspectiveCamera,
        controls: { target: THREE.Vector3; update: () => void }
    ) {
        this.camera = camera;
        this.controls = controls;
    }

    /**
     * Animate camera to a new position looking at a target
     */
    public transitionTo(
        targetPosition: THREE.Vector3,
        lookAtTarget: THREE.Vector3,
        options: Partial<TransitionOptions> = {}
    ): Promise<void> {
        const opts = { ...defaultOptions, ...options };

        // Cancel any existing animation
        this.cancel();

        return new Promise((resolve) => {
            const startPosition = this.camera.position.clone();
            const startTarget = this.controls.target.clone();
            const startTime = performance.now();

            this.isAnimating = true;

            const animate = (currentTime: number) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / opts.duration, 1);
                const easedProgress = opts.easing(progress);

                // Interpolate position
                this.camera.position.lerpVectors(startPosition, targetPosition, easedProgress);

                // Interpolate target
                this.controls.target.lerpVectors(startTarget, lookAtTarget, easedProgress);
                this.controls.update();

                if (progress < 1) {
                    this.animationId = requestAnimationFrame(animate);
                } else {
                    this.isAnimating = false;
                    this.animationId = null;
                    resolve();
                }
            };

            this.animationId = requestAnimationFrame(animate);
        });
    }

    /**
     * Orbit camera around a point while transitioning
     */
    public orbitTo(
        center: THREE.Vector3,
        distance: number,
        azimuth: number,  // horizontal angle in radians
        elevation: number, // vertical angle in radians
        options: Partial<TransitionOptions> = {}
    ): Promise<void> {
        // Calculate target position from spherical coordinates
        const targetPosition = new THREE.Vector3(
            center.x + distance * Math.cos(elevation) * Math.sin(azimuth),
            center.y + distance * Math.sin(elevation),
            center.z + distance * Math.cos(elevation) * Math.cos(azimuth)
        );

        return this.transitionTo(targetPosition, center, options);
    }

    /**
     * Zoom to focus on an object with appropriate framing
     */
    public focusOn(
        objectPosition: THREE.Vector3,
        objectRadius: number,
        options: Partial<TransitionOptions> = {}
    ): Promise<void> {
        // Calculate optimal distance based on object size and FOV
        const fov = this.camera.fov * (Math.PI / 180);
        const distance = objectRadius * 3 / Math.tan(fov / 2);

        // Position camera at an angle for better view
        const offset = new THREE.Vector3(
            distance * 0.7,
            distance * 0.5,
            distance * 0.7
        );

        const targetPosition = objectPosition.clone().add(offset);

        return this.transitionTo(targetPosition, objectPosition, options);
    }

    /**
     * Cancel any ongoing transition
     */
    public cancel(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.isAnimating = false;
    }

    /**
     * Check if a transition is currently in progress
     */
    public getIsAnimating(): boolean {
        return this.isAnimating;
    }
}
