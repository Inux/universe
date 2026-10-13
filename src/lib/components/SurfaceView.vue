<template>
  <Transition name="surface">
    <div v-if="showView" class="surface-view">
      <div ref="canvasContainer" class="canvas-container"></div>

      <!-- Loading overlay -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading {{ displayPlanet }} {{ loadingNoun }}...</div>
      </div>

      <!-- HUD -->
      <div class="surface-hud">
        <div class="planet-name">{{ displayPlanet?.toUpperCase() }}</div>
        <div class="gravity-info">Gravity: {{ gravityDisplay }} m/s²</div>
        <div class="mode-row">
          <span class="mode-badge">{{ modeLabel }}</span>
          <button v-if="showWalkToggle" class="mode-btn" @click="toggleMode">
            {{ shownMode === 'walk' ? 'Fly over' : 'Land and walk' }}
          </button>
        </div>
        <p v-if="!showWalkToggle" class="mode-note">{{ flyOnlyNote }}</p>
        <div class="hud-row">
          <span class="hud-label">Heading</span>
          <span class="hud-value">{{ headingDisplay }}</span>
        </div>
        <div class="hud-row">
          <span class="hud-label">Coords</span>
          <span class="hud-value mono">{{ coordsDisplay }}</span>
        </div>
        <div class="hud-row">
          <span class="hud-label">Altitude</span>
          <span class="hud-value mono">{{ altitudeDisplay }}</span>
        </div>
        <div class="hud-row">
          <span class="hud-label">Time</span>
          <span class="hud-value">{{ timeDisplay }}</span>
        </div>
      </div>

      <!-- Minimap -->
      <Minimap
        :visible="isActive && !isLoading"
        :playerPosition="playerPosition"
        :headingDeg="headingDeg"
        :terrainMesh="getTerrainMesh()"
        :terrainSize="getTerrainSize()"
      />

      <!-- Controls hint -->
      <div class="controls-hint" v-if="showControlsHint">
        <template v-if="shownMode === 'fly'">
          <div class="hint-row"><span class="key">W A S D</span> Fly</div>
          <div class="hint-row"><span class="key">SPACE</span> Rise</div>
          <div class="hint-row"><span class="key">CTRL</span> Descend</div>
          <div class="hint-row"><span class="key">SHIFT</span> Faster</div>
        </template>
        <template v-else>
          <div class="hint-row"><span class="key">W A S D</span> Move</div>
          <div class="hint-row"><span class="key">SPACE</span> Jump</div>
          <div class="hint-row"><span class="key">SHIFT</span> Sprint</div>
        </template>
        <div class="hint-row"><span class="key">MOUSE</span> Look around</div>
        <div class="hint-row" v-if="showWalkToggle"><span class="key">F</span> {{ shownMode === 'walk' ? 'Fly over' : 'Land and walk' }}</div>
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
import { ref, computed, watch, nextTick } from 'vue';
import { useSurfaceView } from '../composables/useSurfaceView';
import { TERRAIN_CONFIGS } from '../three/terrain';
import { canWalkSurface, surfaceKind, type ExploreMode } from '../three/exploration';
import Minimap from './Minimap.vue';

const props = defineProps<{
  planet: string | null;
  mode: ExploreMode;
  shouldEnter: boolean;
}>();

const emit = defineEmits<{
  exit: [];
}>();

const canvasContainer = ref<HTMLElement | null>(null);
const showView = ref(false);
const displayPlanet = ref<string | null>(null);

const {
  isActive,
  isLoading,
  currentPlanet,
  exploreMode,
  canWalk,
  altitude,
  playerPosition,
  headingDeg,
  timeOfDay,
  getTerrainMesh,
  getTerrainSize,
  setExploreMode,
  enter,
  exit,
} = useSurfaceView(canvasContainer, {
  onExit: () => {
    showView.value = false;
    displayPlanet.value = null;
    emit('exit');
  },
});

const gravityDisplay = computed(() => {
  const planet = displayPlanet.value;
  if (!planet) return '9.81';
  const config = TERRAIN_CONFIGS[planet];
  return config?.gravity.toFixed(2) || '9.81';
});

const showWalkToggle = computed(() => (isActive.value ? canWalk.value : props.planet ? canWalkSurface(props.planet) : false));
const shownMode = computed(() => (isActive.value ? exploreMode.value : props.mode));
const modeLabel = computed(() => (shownMode.value === 'fly' ? 'Flying' : 'Walking'));
const loadingNoun = computed(() => {
  const planet = displayPlanet.value;
  if (!planet) return 'terrain';
  const kind = surfaceKind(planet);
  if (kind === 'photosphere') return 'photosphere';
  if (kind === 'cloud') return 'cloud deck';
  return props.mode === 'fly' ? 'flyover' : 'terrain';
});
const flyOnlyNote = computed(() =>
  displayPlanet.value === 'sun'
    ? 'No surface to stand on. Fly over the photosphere.'
    : 'No solid surface. Fly over the cloud deck.'
);
const altitudeDisplay = computed(() => altitude.value.toFixed(1));

function toggleMode() {
  setExploreMode(exploreMode.value === 'walk' ? 'fly' : 'walk');
  showControls();
}

function showControls() {
  showControlsHint.value = true;
  if (hideHintTimer) clearTimeout(hideHintTimer);
  hideHintTimer = window.setTimeout(() => {
    showControlsHint.value = false;
  }, 5000);
}

const headingDisplay = computed(() => `${Math.round(headingDeg.value) % 360}°`);
const coordsDisplay = computed(() => {
  const pos = playerPosition.value;
  const mesh = getTerrainMesh();
  if (mesh?.userData?.spherical) {
    const len = Math.hypot(pos.x, pos.y, pos.z) || 1;
    const lat = Math.asin(Math.max(-1, Math.min(1, pos.y / len))) * 180 / Math.PI;
    const lon = Math.atan2(pos.x / len, pos.z / len) * 180 / Math.PI;
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(1)}°${ns}  ${Math.abs(lon).toFixed(1)}°${ew}`;
  }
  return `X ${pos.x.toFixed(1)}  Z ${pos.z.toFixed(1)}  Y ${pos.y.toFixed(1)}`;
});
const timeDisplay = computed(() => {
  const hoursFloat = (timeOfDay.value || 0) * 24;
  const h = Math.floor(hoursFloat) % 24;
  const m = Math.floor((hoursFloat - h) * 60);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}`;
});

const showControlsHint = ref(true);
let hideHintTimer: number | undefined;

function handleExit() {
  exit();
}

// Watch for enter trigger
watch(
  () => props.shouldEnter,
  async (shouldEnter) => {
    if (shouldEnter && props.planet && !isActive.value) {
      // First show the view so container is mounted
      displayPlanet.value = props.planet;
      showView.value = true;

      // Wait for DOM to update
      await nextTick();

      // Give a small delay for the container to be fully ready
      setTimeout(() => {
        if (canvasContainer.value && props.planet) {
          enter(props.planet, props.mode);
        }
      }, 50);

      showControls();
    }
  }
);

defineExpose({
  enter,
  exit,
  isActive,
  showView,
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
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 300;
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
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  margin-bottom: 10px;
}

.mode-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.mode-badge {
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
}

.mode-btn {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: white;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.mode-btn:hover {
  background: rgba(255, 255, 255, 0.22);
}

.mode-note {
  margin: 0 0 12px 0;
  font-size: 12px;
  line-height: 1.4;
  opacity: 0.75;
  max-width: 280px;
}

.hud-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 8px 0;
  min-width: 300px;
}

.hud-label {
  opacity: 0.7;
  font-size: 13px;
  flex: 0 0 auto;
}

.hud-value {
  font-weight: 600;
  font-size: 14px;
  margin-left: 10px;
  text-align: right;
}

.mono {
  font-family: 'Courier New', monospace;
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

/* Opacity only. A scale here freezes mid-zoom when terrain generation blocks the main thread. */
.surface-enter-active {
  transition: opacity 0.5s ease;
}

.surface-leave-active {
  transition: opacity 0.3s ease;
}

.surface-enter-from,
.surface-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .surface-hud {
    top: 56px;
    left: 10px;
    max-width: calc(100% - 148px);
    padding: 12px 14px;
  }

  .planet-name {
    font-size: 22px;
    letter-spacing: 2px;
  }

  .hud-row {
    min-width: 0;
    gap: 8px;
  }

  .hud-value {
    font-size: 13px;
  }

  .mono {
    font-size: 12px;
  }

  .exit-btn {
    top: 56px;
    right: 10px;
    padding: 10px 12px;
  }

  .controls-hint {
    left: 10px;
    bottom: 12px;
    max-width: calc(100% - 170px);
    padding: 10px 12px;
  }
}
</style>
