<template>
  <div class="minimap" v-if="visible">
    <canvas ref="canvas" :width="size" :height="size"></canvas>
    <div class="minimap-player">
      <div
        class="player-icon"
        :style="{ transform: `rotate(${mapRotation}deg)` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import * as THREE from 'three';
import { radialUp, tangentFrame } from '../three/sphereFrame';

interface MinimapProps {
  visible: boolean;
  playerPosition: THREE.Vector3;
  headingDeg: number;
  terrainMesh: THREE.Mesh | null;
  terrainSize: number;
}

const props = withDefaults(defineProps<MinimapProps>(), {
  visible: true,
  terrainSize: 500,
});

const canvas = ref<HTMLCanvasElement | null>(null);
const size = 200; // Minimap size in pixels
const viewRadius = 50; // World units visible on minimap

const mapUp = new THREE.Vector3();
const mapEast = new THREE.Vector3();
const mapNorth = new THREE.Vector3();
const mapDir = new THREE.Vector3();

const mapRotation = computed(() => {
  const spherical = props.terrainMesh?.userData?.spherical;
  // Sphere map is north-up, and heading 0 faces north. The flat map drew +Z downward.
  return spherical ? props.headingDeg : 180 - props.headingDeg;
});

let animationId: number | null = null;
let lastDrawTime = 0;
const DRAW_INTERVAL_MS = 100; // 10Hz refresh rate

// Pre-allocate ImageData for batch pixel drawing (avoid 2500 fillRect calls)
let minimapImageData: ImageData | null = null;

function drawMinimap() {
  if (!canvas.value || !props.terrainMesh) return;

  const ctx = canvas.value.getContext('2d');
  if (!ctx) return;

  // Get or create reusable ImageData
  if (!minimapImageData || minimapImageData.width !== size) {
    minimapImageData = ctx.createImageData(size, size);
  }
  const imgData = minimapImageData.data;

  const terrainData = props.terrainMesh.userData;
  if (terrainData.spherical) {
    drawSpherePixels(imgData, terrainData);
    paintMinimap(ctx);
    return;
  }

  // Get terrain data
  const minimapColors = terrainData.minimapColors as Uint8Array | undefined;
  const minimapRes = (terrainData.minimapResolution as number) || 256;
  const terrainSize = terrainData.terrainSize as number;
  const halfSize = terrainSize / 2;
  const useMinimapColors = minimapColors && minimapColors.length > 0;

  const playerX = props.playerPosition.x;
  const playerZ = props.playerPosition.z;

  // Fill all pixels via ImageData buffer (single putImageData vs 2500 fillRect)
  const resolution = size; // 1:1 pixel resolution for smooth look
  const step = (viewRadius * 2) / resolution;

  for (let px = 0; px < resolution; px++) {
    for (let pz = 0; pz < resolution; pz++) {
      const worldX = playerX - viewRadius + px * step;
      const worldZ = playerZ - viewRadius + pz * step;

      // Wrap coordinates
      let localX = ((worldX % terrainSize) + terrainSize + halfSize) % terrainSize - halfSize;
      let localZ = ((worldZ % terrainSize) + terrainSize + halfSize) % terrainSize - halfSize;

      // Convert to grid indices (match getTerrainHeight in terrain.ts)
      const normX = (-localX + halfSize) / terrainSize;
      const normY = (localZ + halfSize) / terrainSize;

      const clampedNormX = Math.max(0, Math.min(1, normX));
      const clampedNormY = Math.max(0, Math.min(1, normY));

      let r: number, g: number, b: number;

      if (useMinimapColors) {
        const gridX = Math.floor((1 - clampedNormX) * (minimapRes - 1));
        const gridY = Math.floor(clampedNormY * (minimapRes - 1));
        const colorIdx = (gridY * minimapRes + gridX) * 3;

        if (colorIdx >= 0 && colorIdx + 2 < minimapColors.length) {
          r = minimapColors[colorIdx];
          g = minimapColors[colorIdx + 1];
          b = minimapColors[colorIdx + 2];
        } else {
          r = 50; g = 50; b = 50;
        }
      } else {
        r = 60; g = 60; b = 60;
      }

      const idx = (pz * resolution + px) * 4;
      imgData[idx] = r;
      imgData[idx + 1] = g;
      imgData[idx + 2] = b;
      imgData[idx + 3] = 200; // Slight transparency
    }
  }

  paintMinimap(ctx);
}

function drawSpherePixels(imgData: Uint8ClampedArray, terrainData: Record<string, unknown>) {
  const minimapColors = terrainData.minimapColors as Uint8Array | undefined;
  const mw = (terrainData.minimapWidth as number) || 360;
  const mh = (terrainData.minimapHeight as number) || 180;
  const planetR = (terrainData.planetRadius as number) || 480;
  if (!minimapColors || minimapColors.length === 0) return;

  radialUp(mapUp, props.playerPosition);
  tangentFrame(mapUp, mapEast, mapNorth);

  const resolution = size;
  const step = (viewRadius * 2) / resolution;
  for (let pz = 0; pz < resolution; pz++) {
    const northOff = viewRadius - pz * step;
    for (let px = 0; px < resolution; px++) {
      const eastOff = -viewRadius + px * step;
      mapDir.copy(mapUp).multiplyScalar(planetR);
      mapDir.addScaledVector(mapEast, eastOff);
      mapDir.addScaledVector(mapNorth, northOff);
      mapDir.normalize();

      const lat = Math.asin(Math.max(-1, Math.min(1, mapDir.y)));
      const lon = Math.atan2(mapDir.x, mapDir.z);
      let u = lon / (Math.PI * 2) + 0.5;
      u = u - Math.floor(u);
      const v = Math.max(0, Math.min(0.999, 0.5 - lat / Math.PI));
      const ix = Math.min(mw - 1, Math.floor(u * mw));
      const iy = Math.min(mh - 1, Math.floor(v * mh));
      const colorIdx = (iy * mw + ix) * 3;
      const idx = (pz * resolution + px) * 4;
      imgData[idx] = minimapColors[colorIdx] ?? 40;
      imgData[idx + 1] = minimapColors[colorIdx + 1] ?? 40;
      imgData[idx + 2] = minimapColors[colorIdx + 2] ?? 40;
      imgData[idx + 3] = 200;
    }
  }
}

function paintMinimap(ctx: CanvasRenderingContext2D) {
  if (!minimapImageData) return;
  // Single putImageData call replaces 2500 fillRect calls
  ctx.putImageData(minimapImageData, 0, 0);

  // Draw subtle grid overlay
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
  ctx.lineWidth = 0.5;
  const pixelsPerUnit = size / (viewRadius * 2);
  const gridSize = 10;
  const gridPixels = gridSize * pixelsPerUnit;

  for (let i = gridPixels; i < size; i += gridPixels) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Draw border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);

  // Center crosshair (player position)
  const centerX = size / 2;
  const centerY = size / 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - 5, centerY);
  ctx.lineTo(centerX + 5, centerY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - 5);
  ctx.lineTo(centerX, centerY + 5);
  ctx.stroke();
}

function animate(currentTime: number = 0) {
  if (props.visible) {
    // Throttle to 10Hz for performance
    if (currentTime - lastDrawTime >= DRAW_INTERVAL_MS) {
      drawMinimap();
      lastDrawTime = currentTime;
    }
    animationId = requestAnimationFrame(animate);
  }
}

onMounted(() => {
  animate();
});

onUnmounted(() => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
  }
});

watch(() => props.visible, (visible) => {
  if (visible && animationId === null) {
    animate();
  } else if (!visible && animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
});
</script>

<style scoped>
.minimap {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 200px;
  height: 200px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 100;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

@media (max-width: 720px) {
  .minimap {
    width: 140px;
    height: 140px;
    right: 10px;
    bottom: 12px;
  }
}

.minimap-player {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  pointer-events: none;
}

.player-icon {
  width: 100%;
  height: 100%;
  position: relative;
}

.player-icon::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: #ff4444;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(255, 68, 68, 0.8);
}

.player-icon::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 8px solid #ff4444;
}
</style>
