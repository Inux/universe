<template>
  <div id="app-root">
    <!-- Three.js Canvas (Solar System View) -->
    <ThreeCanvas
      v-show="!surfaceViewActive"
      ref="threeCanvas"
      @planet-select="handlePlanetSelect"
      @background-click="handleBackgroundClick"
    />

    <!-- Surface Exploration View -->
    <SurfaceView
      :planet="selectedPlanet"
      :shouldEnter="shouldEnterSurface"
      @exit="handleSurfaceExit"
    />

    <!-- Loading Overlay -->
    <div v-if="isLoading && !surfaceViewActive" class="loading-overlay">
      Loading Universe...
    </div>

    <!-- UI Layer (hidden during surface view) -->
    <div v-show="!surfaceViewActive" class="ui-layer">
      <ControlsHint />
      <InfoPanel
        :planet="selectedPlanet"
        :isVisible="infoPanelVisible"
        @close="handleClose"
        @explore="handleExplore"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import ThreeCanvas from './lib/components/ThreeCanvas.vue';
import ControlsHint from './lib/components/ControlsHint.vue';
import InfoPanel from './lib/components/InfoPanel.vue';
import SurfaceView from './lib/components/SurfaceView.vue';

const threeCanvas = ref<InstanceType<typeof ThreeCanvas> | null>(null);
const selectedPlanet = ref<string | null>(null);
const infoPanelVisible = ref(false);
const surfaceViewActive = ref(false);
const shouldEnterSurface = ref(false);

const isLoading = computed(() => threeCanvas.value?.isLoading ?? true);

function handlePlanetSelect(planetName: string) {
  selectedPlanet.value = planetName;
  infoPanelVisible.value = true;
}

function handleBackgroundClick() {
  infoPanelVisible.value = false;
}

function handleClose() {
  infoPanelVisible.value = false;
}

function handleExplore(planetName: string) {
  // Hide info panel and enter surface view
  infoPanelVisible.value = false;
  surfaceViewActive.value = true;
  shouldEnterSurface.value = true;
}

function handleSurfaceExit() {
  surfaceViewActive.value = false;
  shouldEnterSurface.value = false;
}

function handleKeyDown(event: KeyboardEvent) {
  // Don't handle escape if in surface view (SurfaceView handles it)
  if (surfaceViewActive.value) return;

  if (event.key === 'Escape') {
    infoPanelVisible.value = false;
    threeCanvas.value?.resetView();
  }
}

// Register global keyboard handler
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeyDown);
}
</script>

<style>
#app-root {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
}

.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 24px;
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  z-index: 1000;
}

.ui-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
}

.ui-layer > * {
  pointer-events: auto;
}
</style>
