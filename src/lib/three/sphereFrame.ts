import * as THREE from 'three';

/**
 * Camera frame on a planet.
 *
 * One heading vector is the source of truth. It lives in the tangent plane
 * and is parallel-transported when the player moves, so crossing a pole does
 * not rebuild the view from world-up and spin the camera.
 *
 * Canonical basis, checked by the frame self-test:
 * position (0, 0, +R) → up = (0, 0, 1)
 * east = WORLD_UP × up = (1, 0, 0)
 * north = up × east = (0, 1, 0)
 * facing north, right = heading × up = (1, 0, 0)
 * positive yaw turns left, toward −X (west)
 * positive pitch looks away from the planet center
 */

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_X = new THREE.Vector3(1, 0, 0);
const _poleEast = new THREE.Vector3();
const _poleNorth = new THREE.Vector3();

/** Unit radial up. `out` may alias `position`. */
export function radialUp(out: THREE.Vector3, position: THREE.Vector3): THREE.Vector3 {
    const len = position.length();
    if (len < 1e-8) return out.set(0, 0, 1);
    return out.copy(position).multiplyScalar(1 / len);
}

/**
 * Geographic east and north for `up`.
 * `east` and `north` must not alias `up` or each other.
 * At the poles WORLD_UP × up vanishes, so east falls back to WORLD_X × up.
 */
export function tangentFrame(up: THREE.Vector3, east: THREE.Vector3, north: THREE.Vector3): void {
    east.crossVectors(WORLD_UP, up);
    if (east.lengthSq() < 1e-8) {
        east.crossVectors(WORLD_X, up);
    }
    east.normalize();
    north.crossVectors(up, east).normalize();
}

/** Remove the radial part of `heading`. If that leaves nothing, face north. */
export function projectHeading(heading: THREE.Vector3, up: THREE.Vector3): void {
    heading.addScaledVector(up, -heading.dot(up));
    if (heading.lengthSq() < 1e-10) {
        tangentFrame(up, _poleEast, _poleNorth);
        heading.copy(_poleNorth);
        return;
    }
    heading.normalize();
}

/**
 * Turn `heading` inside the tangent plane.
 * Positive `dYaw` turns left: heading' = heading cos(dYaw) − right sin(dYaw),
 * right = heading × up.
 * `right` is scratch and must not alias `heading` or `up`.
 */
export function yawHeading(
    heading: THREE.Vector3,
    up: THREE.Vector3,
    dYaw: number,
    right: THREE.Vector3,
): void {
    right.crossVectors(heading, up);
    if (right.lengthSq() < 1e-10) return;
    right.normalize();
    const c = Math.cos(dYaw);
    const s = Math.sin(dYaw);
    heading.multiplyScalar(c).addScaledVector(right, -s);
    if (heading.lengthSq() < 1e-10) return;
    heading.normalize();
}

/** look = heading cos(pitch) + up sin(pitch). Positive pitch looks up. `out` must not alias the inputs. */
export function lookFromHeading(
    out: THREE.Vector3,
    heading: THREE.Vector3,
    up: THREE.Vector3,
    pitch: number,
): THREE.Vector3 {
    return out
        .copy(heading)
        .multiplyScalar(Math.cos(pitch))
        .addScaledVector(up, Math.sin(pitch))
        .normalize();
}

/** Point the camera along `look` with `up` as the screen's up. Call after the camera position is final. */
export function applySphereLook(camera: THREE.Camera, look: THREE.Vector3, up: THREE.Vector3): void {
    camera.up.copy(up);
    const p = camera.position;
    camera.lookAt(p.x + look.x, p.y + look.y, p.z + look.z);
}

/** Degrees clockwise from north toward east. 0 = north. */
export function headingDegrees(heading: THREE.Vector3, north: THREE.Vector3, east: THREE.Vector3): number {
    let deg = THREE.MathUtils.radToDeg(Math.atan2(heading.dot(east), heading.dot(north)));
    if (deg < 0) deg += 360;
    return deg;
}
