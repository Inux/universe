<template>
  <div class="minimap" v-if="visible">
    <canvas ref="canvas" :width="size" :height="size"></canvas>
    <div class="minimap-player">
      <div
        class="player-icon"
        :style="{ transform: `rotate(${headingDeg}deg)` }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';

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

let animationId: number | null = null;
let lastDrawTime = 0;
const DRAW_INTERVAL_MS = 100; // 10Hz refresh rate

function drawMinimap() {
  if (!canvas.value || !props.terrainMesh) return;

  const ctx = canvas.value.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, size, size);

  // Background
  ctx.fillStyle = 'rgba(20, 20, 20, 0.8)';
  ctx.fillRect(0, 0, size, size);

  // Draw terrain heightmap in a small area around player
  const playerX = props.playerPosition.x;
  const playerZ = props.playerPosition.z;

  // Get terrain data once outside the loop for performance
  const terrainData = props.terrainMesh.userData;
  const minimapColors = terrainData.minimapColors as Uint8Array | undefined;
  const minimapRes = (terrainData.minimapResolution as number) || 256;

  const terrainSize = terrainData.terrainSize as number;
  const halfSize = terrainSize / 2;

  // Use minimap colors if available, otherwise fall back to height-based coloring
  const useMinimapColors = minimapColors && minimapColors.length > 0;

  const pixelsPerUnit = size / (viewRadius * 2);

  // Draw grid
  ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
  ctx.lineWidth = 1;
  const gridSize = 10; // World units per grid line
  const gridPixels = gridSize * pixelsPerUnit;

  for (let i = 0; i <= size; i += gridPixels) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }

  // Draw terrain using stored biome colors from terrain mesh
  const resolution = 50; // Pixels per sample
  const step = (viewRadius * 2) / resolution;
  const pixelSize = size / resolution;

  for (let x = 0; x < resolution; x++) {
    for (let z = 0; z < resolution; z++) {
      const worldX = playerX - viewRadius + x * step;
      const worldZ = playerZ - viewRadius + z * step;

      // Wrap coordinates
      let localX = worldX;
      let localZ = worldZ;
      while (localX > halfSize) localX -= terrainSize;
      while (localX < -halfSize) localX += terrainSize;
      while (localZ > halfSize) localZ -= terrainSize;
      while (localZ < -halfSize) localZ += terrainSize;

      // Convert to grid indices (match getTerrainHeight in terrain.ts)
      const geoX = -localX; // Flip X due to 180° Z rotation
      const geoY = localZ;  // Z becomes Y after -90° X rotation

      const normX = (geoX + halfSize) / terrainSize;
      const normY = (geoY + halfSize) / terrainSize;

      const clampedNormX = Math.max(0, Math.min(1, normX));
      const clampedNormY = Math.max(0, Math.min(1, normY));

      let r: number, g: number, b: number;

      if (useMinimapColors) {
        // Sample from stored biome colors
        // The color array is stored as [z * res + x] in heightmap space
        // clampedNormX corresponds to -localX (flipped), clampedNormY corresponds to localZ
        // We need to flip X back to match the color array storage
        const gridX = Math.floor((1 - clampedNormX) * (minimapRes - 1));
        const gridY = Math.floor(clampedNormY * (minimapRes - 1));
        const colorIdx = (gridY * minimapRes + gridX) * 3;

        if (colorIdx >= 0 && colorIdx + 2 < minimapColors.length) {
          r = minimapColors[colorIdx];
          g = minimapColors[colorIdx + 1];
          b = minimapColors[colorIdx + 2];
        } else {
          r = 50; g = 50; b = 50; // Fallback gray
        }
      } else {
        // Fallback: simple gray gradient
        r = 80; g = 80; b = 80;
      }

      const color = `rgb(${r}, ${g}, ${b})`;
      const pixelX = x * pixelSize;
      const pixelZ = z * pixelSize;
      ctx.fillStyle = color;
      ctx.fillRect(pixelX, pixelZ, pixelSize + 1, pixelSize + 1);
    }
  }

  // Draw border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);

  // Center crosshair (player position)
  const centerX = size / 2;
  const centerY = size / 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
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
