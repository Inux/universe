<template>
  <div id="app-root">
    <!-- Three.js Canvas (Solar System View) -->
    <ThreeCanvas
      v-show="!surfaceViewActive"
      ref="threeCanvas"
      :showLabels="showPlanetLabels"
      @planet-select="handlePlanetSelect"
      @background-click="handleBackgroundClick"
    />

    <!-- Surface Exploration View -->
    <SurfaceView
      :planet="selectedPlanet"
      :mode="surfaceMode"
      :shouldEnter="shouldEnterSurface"
      @exit="handleSurfaceExit"
    />

    <!-- Loading Overlay -->
    <div v-if="isLoading && !surfaceViewActive" class="loading-overlay">
      Loading Universe...
    </div>

    <!-- Performance HUD (F3 to toggle) -->
    <PerformanceHUD />

    <!-- UI Layer (hidden during surface view) -->
    <div v-show="!surfaceViewActive" class="ui-layer">
      <div class="orbit-dock">
        <ControlsHint />
        <ViewControls
          :time-running="timeRunning"
          :time-step="timeStep"
          :distance-step="distanceStep"
          @toggle-time="toggleTime"
          @update-time-step="setTimeStep"
          @update-distance-step="setDistanceStep"
        />
      </div>
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
import ViewControls from './lib/components/ViewControls.vue';
import InfoPanel from './lib/components/InfoPanel.vue';
import { DEFAULT_STEP } from './lib/three/viewScale';
import SurfaceView from './lib/components/SurfaceView.vue';
import PerformanceHUD from './lib/components/PerformanceHUD.vue';
import { defaultExploreMode, type ExploreMode } from './lib/three/exploration';

const threeCanvas = ref<InstanceType<typeof ThreeCanvas> | null>(null);
const selectedPlanet = ref<string | null>(null);
const infoPanelVisible = ref(false);
const surfaceViewActive = ref(false);
const shouldEnterSurface = ref(false);
const surfaceMode = ref<ExploreMode>('walk');
const showPlanetLabels = ref(false);
const timeRunning = ref(true);
const timeStep = ref(DEFAULT_STEP);
const distanceStep = ref(DEFAULT_STEP);

// Planet order for arrow key navigation (including dwarf planets)
const PLANET_ORDER = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'haumea', 'makemake', 'eris'];

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

function handleExplore(planetName: string, mode?: ExploreMode) {
  surfaceMode.value = mode ?? defaultExploreMode(planetName);
  infoPanelVisible.value = false;
  surfaceViewActive.value = true;
  shouldEnterSurface.value = true;

  // Pause solar system rendering to save resources
  threeCanvas.value?.pause();
}

function handleSurfaceExit() {
  surfaceViewActive.value = false;
  shouldEnterSurface.value = false;

  // Show info panel again when returning from surface
  infoPanelVisible.value = true;

  // Resume solar system rendering
  threeCanvas.value?.resume();

  // Trigger resize to fix renderer after being hidden
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 100);
}

function toggleTime() {
  timeRunning.value = !timeRunning.value;
  threeCanvas.value?.setTimeRunning(timeRunning.value);
}

function setTimeStep(step: number) {
  timeStep.value = step;
  threeCanvas.value?.setTimeStep(step);
}

function setDistanceStep(step: number) {
  distanceStep.value = step;
  threeCanvas.value?.setDistanceStep(step);
}

function navigatePlanet(direction: 'prev' | 'next') {
  if (!selectedPlanet.value) return;

  const currentIndex = PLANET_ORDER.indexOf(selectedPlanet.value);
  if (currentIndex === -1) return;

  let newIndex: number;
  if (direction === 'prev') {
    newIndex = currentIndex > 0 ? currentIndex - 1 : PLANET_ORDER.length - 1;
  } else {
    newIndex = currentIndex < PLANET_ORDER.length - 1 ? currentIndex + 1 : 0;
  }

  const newPlanet = PLANET_ORDER[newIndex];
  selectedPlanet.value = newPlanet;
  threeCanvas.value?.selectPlanet(newPlanet);
}

function handleKeyDown(event: KeyboardEvent) {
  // Surface view uses Space to jump or rise. Don't steal it.
  if (surfaceViewActive.value) return;

  const tag = (event.target as HTMLElement | null)?.tagName;

  if (event.key === ' ') {
    // A focused Pause button activates itself. Anywhere else, Space pauses time.
    if (tag === 'BUTTON') return;
    event.preventDefault();
    if (event.repeat || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    toggleTime();
    return;
  }

  if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    return;
  }

  switch (event.key) {
    case 'Escape':
      infoPanelVisible.value = false;
      threeCanvas.value?.resetView();
      break;

    case 'Enter':
      if (infoPanelVisible.value && selectedPlanet.value) {
        handleExplore(selectedPlanet.value);
      } else {
        // First Enter opens info panel
        // If no planet selected, select sun first
        if (!selectedPlanet.value) {
          selectedPlanet.value = 'sun';
        }
        infoPanelVisible.value = true;
        threeCanvas.value?.selectPlanet(selectedPlanet.value);
      }
      break;

    case 'ArrowLeft':
      if (infoPanelVisible.value) {
        navigatePlanet('prev');
      }
      break;

    case 'ArrowRight':
      if (infoPanelVisible.value) {
        navigatePlanet('next');
      }
      break;

    case 'i':
    case 'I':
      showPlanetLabels.value = !showPlanetLabels.value;
      break;
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

@media (max-width: 900px) {
  .orbit-dock {
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: 8px;
    z-index: 130;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}
</style>
