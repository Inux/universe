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

  // Draw terrain (simplified - just show biome colors)
  const resolution = 50; // Pixels per sample
  const step = (viewRadius * 2) / resolution;

  for (let x = 0; x < resolution; x++) {
    for (let z = 0; z < resolution; z++) {
      const worldX = playerX - viewRadius + x * step;
      const worldZ = playerZ - viewRadius + z * step;

      // Get terrain height at this position (simplified)
      const terrainData = props.terrainMesh.userData;
      const heights = terrainData.heights as number[];
      if (heights) {
        // Map world position to terrain grid
        const terrainSize = terrainData.terrainSize as number;
        const terrainRes = terrainData.terrainResolution as number;
        const halfSize = terrainSize / 2;

        // Wrap coordinates
        let localX = worldX;
        let localZ = worldZ;
        while (localX > halfSize) localX -= terrainSize;
        while (localX < -halfSize) localX += terrainSize;
        while (localZ > halfSize) localZ -= terrainSize;
        while (localZ < -halfSize) localZ += terrainSize;

        // Convert to grid indices
        const normX = ((-localX + halfSize) / terrainSize); // Flip X
        const normZ = ((localZ + halfSize) / terrainSize);
        const gridX = Math.floor(normX * (terrainRes - 1));
        const gridZ = Math.floor(normZ * (terrainRes - 1));
        const idx = gridZ * terrainRes + gridX;

        if (idx >= 0 && idx < heights.length) {
          const height = heights[idx];
          const normalizedHeight = height / 30; // Assuming heightScale = 30

          // Color based on height
          let color;
          if (normalizedHeight < 0.3) {
            color = `rgb(58, 140, 61)`; // Green (low)
          } else if (normalizedHeight < 0.6) {
            color = `rgb(139, 105, 20)`; // Brown (medium)
          } else {
            color = `rgb(125, 109, 92)`; // Gray (high)
          }

          const pixelX = x * (size / resolution);
          const pixelZ = z * (size / resolution);
          ctx.fillStyle = color;
          ctx.fillRect(pixelX, pixelZ, size / resolution + 1, size / resolution + 1);
        }
      }
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

function animate() {
  if (props.visible) {
    drawMinimap();
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
