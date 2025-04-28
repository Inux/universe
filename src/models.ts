// Ported from Go backend models
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface Camera {
    position: Vector3;
    target: Vector3;
    zoom: number;
}

export interface Movement {
    isWalking: boolean;
    isSwimming: boolean;
    isDiving: boolean;
    isClimbing: boolean;
    diveTime: number;
    maxDiveTime: number;
}

export interface Physics {
    velocity: Vector3;
    acceleration: Vector3;
    grounded: boolean;
}

export interface Player {
    id: string;
    position: Vector3;
    rotation: Vector3;
    camera: Camera;
    movement: Movement;
    physics: Physics;
}

export interface ClientMessage {
    type: string;
    movement?: Vector3;
    camera?: Camera;
    clientId: string;
}

// Constants ported from Go backend
export const CONSTANTS = {
    EARTH_RADIUS: 6371000, // meters
    GRAVITY: 9.81,
    WALK_SPEED: 500.0, // meters per second
    SWIM_SPEED: 2.0,
    CLIMB_SPEED: 1.5,
    MAX_DIVE_TIME: 30.0, // seconds
    TICK_RATE: 1, // updates per second
    PHYSICS_TIMESTEP: 1.0 / 1, // 1.0 / TICK_RATE
} as const;
