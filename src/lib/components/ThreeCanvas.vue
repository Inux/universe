<template>
  <div
    ref="canvasContainer"
    class="three-canvas"
    @click="handleClick"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useThreeScene } from '../composables/useThreeScene';

const props = defineProps<{
  showLabels?: boolean;
}>();

const emit = defineEmits<{
  planetSelect: [planetName: string];
  backgroundClick: [];
  initialized: [];
}>();

const canvasContainer = ref<HTMLElement | null>(null);

const {
  isInitialized,
  isLoading,
  error,
  selectedPlanet,
  handleClick,
  selectPlanet,
  resetView,
  setLabelsVisible,
  pause,
  resume
} = useThreeScene(canvasContainer, {
  onPlanetSelect: (planetName) => emit('planetSelect', planetName),
  onBackgroundClick: () => emit('backgroundClick')
});

// Watch for label visibility changes
watch(() => props.showLabels, (show) => {
  setLabelsVisible(show ?? false);
});

defineExpose({
  isInitialized,
  isLoading,
  error,
  selectedPlanet,
  selectPlanet,
  resetView,
  pause,
  resume
});
</script>

<style scoped>
.three-canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.three-canvas :deep(canvas) {
  display: block;
}
</style>
