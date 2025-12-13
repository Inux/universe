<template>
  <Transition name="surface">
    <div v-if="isActive" class="surface-view">
      <div ref="canvasContainer" class="canvas-container"></div>

      <!-- Loading overlay -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">Generating {{ currentPlanet }} terrain...</div>
      </div>

      <!-- HUD -->
      <div class="surface-hud">
        <div class="planet-name">{{ currentPlanet?.toUpperCase() }}</div>
        <div class="gravity-info">Gravity: {{ gravityDisplay }} m/s²</div>
      </div>

      <!-- Controls hint -->
      <div class="controls-hint">
        <div class="hint-row"><span class="key">W A S D</span> Move</div>
        <div class="hint-row"><span class="key">SPACE</span> Jump</div>
        <div class="hint-row"><span class="key">MOUSE</span> Look around</div>
        <div class="hint-row"><span class="key">ESC</span> Return to orbit</div>
      </div>

      <!-- Exit button -->
      <button class="exit-btn" @click="handleExit">
        ← Return to Orbit
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useSurfaceView } from '../composables/useSurfaceView';
import { TERRAIN_CONFIGS } from '../three/terrain';

const props = defineProps<{
  planet: string | null;
  shouldEnter: boolean;
}>();

const emit = defineEmits<{
  exit: [];
}>();

const canvasContainer = ref<HTMLElement | null>(null);

const { isActive, isLoading, currentPlanet, enter, exit } = useSurfaceView(canvasContainer, {
  onExit: () => emit('exit'),
});

const gravityDisplay = computed(() => {
  if (!currentPlanet.value) return '0.00';
  const config = TERRAIN_CONFIGS[currentPlanet.value];
  return config?.gravity.toFixed(2) || '9.81';
});

function handleExit() {
  exit();
}

// Watch for enter trigger
watch(
  () => props.shouldEnter,
  (shouldEnter) => {
    if (shouldEnter && props.planet && !isActive.value) {
      // Small delay to ensure container is mounted
      setTimeout(() => {
        if (canvasContainer.value && props.planet) {
          enter(props.planet);
        }
      }, 100);
    }
  }
);

defineExpose({
  enter,
  exit,
  isActive,
});
</script>

<style scoped>
.surface-view {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 200;
  background: #000;
}

.canvas-container {
  width: 100%;
  height: 100%;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #4da6ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 20px;
  color: white;
  font-size: 18px;
  text-transform: capitalize;
}

.surface-hud {
  position: absolute;
  top: 20px;
  left: 20px;
  color: white;
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
}

.planet-name {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 4px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}

.gravity-info {
  font-size: 14px;
  opacity: 0.7;
  margin-top: 4px;
}

.controls-hint {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px 20px;
  color: white;
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 13px;
}

.hint-row {
  margin: 6px 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.key {
  background: rgba(255, 255, 255, 0.15);
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
  min-width: 60px;
  text-align: center;
}

.exit-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
}

.exit-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateX(-4px);
}

/* Transition animations */
.surface-enter-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.surface-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.surface-enter-from {
  opacity: 0;
  transform: scale(1.1);
}

.surface-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
