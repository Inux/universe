<template>
  <div v-if="visible" class="perf-hud">
    <div class="perf-row">
      <span class="perf-label">FPS</span>
      <span class="perf-value" :class="fpsClass">{{ fps }}</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Draw Calls</span>
      <span class="perf-value">{{ drawCalls }}</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Triangles</span>
      <span class="perf-value">{{ trianglesFormatted }}</span>
    </div>
    <div class="perf-row">
      <span class="perf-label">Memory</span>
      <span class="perf-value">{{ memoryFormatted }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const visible = ref(true); // Show by default
const fps = ref(0);
const drawCalls = ref(0);
const triangles = ref(0);
const memory = ref(0);

let frameCount = 0;
let lastTime = performance.now();
let animationId: number | null = null;

declare global {
  interface Window {
    __THREE_RENDERER__?: {
      info: {
        render: { calls: number; triangles: number };
        memory: { geometries: number; textures: number };
      };
    };
  }
}

const fpsClass = computed(() => {
  if (fps.value >= 55) return 'good';
  if (fps.value >= 30) return 'warning';
  return 'bad';
});

const trianglesFormatted = computed(() => {
  if (triangles.value >= 1000000) {
    return (triangles.value / 1000000).toFixed(2) + 'M';
  }
  if (triangles.value >= 1000) {
    return (triangles.value / 1000).toFixed(1) + 'K';
  }
  return triangles.value.toString();
});

const memoryFormatted = computed(() => {
  if (memory.value >= 1024) {
    return (memory.value / 1024).toFixed(1) + ' GB';
  }
  return memory.value.toFixed(0) + ' MB';
});

function update() {
  frameCount++;
  const now = performance.now();

  // Update FPS every 500ms
  if (now - lastTime >= 500) {
    fps.value = Math.round((frameCount * 1000) / (now - lastTime));
    frameCount = 0;
    lastTime = now;

    // Update renderer stats from global
    const renderer = window.__THREE_RENDERER__;
    if (renderer) {
      drawCalls.value = renderer.info.render.calls;
      triangles.value = renderer.info.render.triangles;

      // Memory from Three.js renderer (geometries + textures)
      const mem = renderer.info.memory;
      const geometryMem = mem.geometries * 0.5; // Rough estimate: 0.5MB per geometry
      const textureMem = mem.textures * 2; // Rough estimate: 2MB per texture
      memory.value = geometryMem + textureMem;
    }
  }

  if (visible.value) {
    animationId = requestAnimationFrame(update);
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'F3') {
    event.preventDefault();
    visible.value = !visible.value;

    if (visible.value && animationId === null) {
      lastTime = performance.now();
      frameCount = 0;
      update();
    } else if (!visible.value && animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  // Start update loop if visible by default
  if (visible.value) {
    lastTime = performance.now();
    frameCount = 0;
    update();
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
  }
});

defineExpose({
  visible,
  toggle: () => {
    visible.value = !visible.value;
    if (visible.value && animationId === null) {
      lastTime = performance.now();
      frameCount = 0;
      update();
    }
  }
});
</script>

<style scoped>
.perf-hud {
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 16px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: white;
  z-index: 9999;
  display: flex;
  gap: 20px;
}

.perf-row {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.perf-label {
  opacity: 0.6;
  font-size: 10px;
  text-transform: uppercase;
}

.perf-value {
  font-weight: bold;
  font-size: 14px;
}

.perf-value.good {
  color: #4ade80;
}

.perf-value.warning {
  color: #fbbf24;
}

.perf-value.bad {
  color: #f87171;
}
</style>
