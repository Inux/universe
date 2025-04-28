import { Vector3, Player, Movement, CONSTANTS } from './models';

export function updatePlayerMovement(player: Player, movement: Vector3) {
    // Normalize movement vector
    const length = Math.sqrt(movement.x * movement.x + movement.y * movement.y + movement.z * movement.z);
    if (length > 0) {
        player.movement.isWalking = true;
        movement.x /= length;
        movement.y /= length;
        movement.z /= length;
    }

    let speed = CONSTANTS.WALK_SPEED;
    if (player.movement.isSwimming) {
        speed = CONSTANTS.SWIM_SPEED;
    } else if (player.movement.isClimbing) {
        speed = CONSTANTS.CLIMB_SPEED;
    }

    player.physics.velocity = {
        x: movement.x * speed,
        y: movement.y * speed,
        z: movement.z * speed,
    };
}

export function updatePlayerPhysics(player: Player) {
    // Apply gravity if not swimming
    if (!player.movement.isSwimming) {
        player.physics.velocity.y -= CONSTANTS.GRAVITY * CONSTANTS.PHYSICS_TIMESTEP;
    }

    // Update position
    player.position.x += player.physics.velocity.x * CONSTANTS.PHYSICS_TIMESTEP;
    player.position.y += player.physics.velocity.y * CONSTANTS.PHYSICS_TIMESTEP;
    player.position.z += player.physics.velocity.z * CONSTANTS.PHYSICS_TIMESTEP;

    // Simple ground collision
    const distanceFromCenter = Math.sqrt(
        player.position.x * player.position.x +
        player.position.y * player.position.y +
        player.position.z * player.position.z
    );

    if (distanceFromCenter < CONSTANTS.EARTH_RADIUS) {
        // Normalize position to surface
        const factor = CONSTANTS.EARTH_RADIUS / distanceFromCenter;
        player.position.x *= factor;
        player.position.y *= factor;
        player.position.z *= factor;
        player.physics.grounded = true;
    } else {
        player.physics.grounded = false;
    }

    // Update dive time
    if (player.movement.isDiving) {
        player.movement.diveTime += CONSTANTS.PHYSICS_TIMESTEP;
        if (player.movement.diveTime >= player.movement.maxDiveTime) {
            player.movement.isDiving = false;
            player.movement.isSwimming = true;
        }
    }
}
