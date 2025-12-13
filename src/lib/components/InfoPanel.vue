<template>
  <Transition name="slide">
    <div v-if="isVisible" class="info-panel">
      <div class="panel-header" :style="{ background: headerGradient }">
        <button class="close-btn" @click="$emit('close')">✕</button>
        <div class="emoji">{{ planetEmoji }}</div>
        <h2 class="name">{{ planetData?.name }}</h2>
        <div class="type">{{ extendedInfo?.type }}</div>
      </div>

      <div class="panel-content">
        <!-- Physical Properties -->
        <section>
          <h3>Physical Properties</h3>
          <div class="stats-grid">
            <div class="stat">
              <div class="stat-icon">📏</div>
              <div class="stat-label">Radius</div>
              <div class="stat-value">{{ formatNumber(planetData?.radius) }} km</div>
            </div>
            <div class="stat">
              <div class="stat-icon">⚖️</div>
              <div class="stat-label">Mass</div>
              <div class="stat-value">{{ extendedInfo?.mass }}</div>
            </div>
            <div class="stat">
              <div class="stat-icon">🌡️</div>
              <div class="stat-label">Temp</div>
              <div class="stat-value">{{ formatTemperature(extendedInfo?.temperature) }}</div>
            </div>
            <div class="stat">
              <div class="stat-icon">⬇️</div>
              <div class="stat-label">Gravity</div>
              <div class="stat-value">{{ extendedInfo?.gravity }} m/s²</div>
            </div>
          </div>
        </section>

        <!-- Orbital Data -->
        <section v-if="planet !== 'sun'">
          <h3>Orbital Data</h3>
          <div class="stats-grid">
            <div class="stat">
              <div class="stat-icon">🌍</div>
              <div class="stat-label">Distance</div>
              <div class="stat-value">{{ formatDistance(planetData?.distanceFromSun) }}</div>
            </div>
            <div class="stat">
              <div class="stat-icon">📅</div>
              <div class="stat-label">Year</div>
              <div class="stat-value">{{ formatNumber(planetData?.orbitalPeriod) }} days</div>
            </div>
            <div class="stat">
              <div class="stat-icon">⏰</div>
              <div class="stat-label">Day</div>
              <div class="stat-value">{{ formatRotation(planetData?.rotationPeriod) }} hours</div>
            </div>
            <div class="stat">
              <div class="stat-icon">🌙</div>
              <div class="stat-label">Moons</div>
              <div class="stat-value">{{ extendedInfo?.moonCount }}</div>
            </div>
          </div>
        </section>

        <!-- Atmosphere -->
        <section>
          <h3>Atmosphere</h3>
          <p class="description">{{ extendedInfo?.atmosphere }}</p>
        </section>

        <!-- Description -->
        <section>
          <h3>About</h3>
          <p class="description">{{ extendedInfo?.description }}</p>
        </section>

        <!-- Discovery Info -->
        <div v-if="extendedInfo?.discoverer" class="discovery">
          Discovered by {{ extendedInfo.discoverer }} in {{ extendedInfo.yearDiscovered }}
        </div>
      </div>

      <!-- Explore Button -->
      <div v-if="planet !== 'sun'" class="panel-footer">
        <button class="explore-btn" @click="handleExplore">
          🚀 Explore Surface
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { SOLAR_SYSTEM, type PlanetData } from '../three/solarSystem';
import { PLANET_INFO, type ExtendedPlanetInfo, getPlanetEmoji } from '../data/planetData';

const props = defineProps<{
  planet: string | null;
  isVisible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  explore: [planetName: string];
}>();

function handleExplore() {
  if (props.planet) {
    emit('explore', props.planet);
  }
}

const planetData = computed<PlanetData | undefined>(() =>
  props.planet ? SOLAR_SYSTEM[props.planet] : undefined
);

const extendedInfo = computed<ExtendedPlanetInfo | undefined>(() =>
  props.planet ? PLANET_INFO[props.planet] : undefined
);

const planetEmoji = computed(() =>
  props.planet ? getPlanetEmoji(props.planet) : '🌑'
);

const headerGradient = computed(() => {
  const gradients: Record<string, string> = {
    sun: 'linear-gradient(135deg, rgba(255, 200, 50, 0.4), rgba(255, 100, 0, 0.3))',
    mercury: 'linear-gradient(135deg, rgba(150, 140, 130, 0.4), rgba(100, 90, 80, 0.3))',
    venus: 'linear-gradient(135deg, rgba(255, 200, 100, 0.4), rgba(200, 150, 50, 0.3))',
    earth: 'linear-gradient(135deg, rgba(50, 100, 200, 0.4), rgba(50, 150, 100, 0.3))',
    mars: 'linear-gradient(135deg, rgba(200, 100, 50, 0.4), rgba(150, 50, 30, 0.3))',
    jupiter: 'linear-gradient(135deg, rgba(200, 150, 100, 0.4), rgba(180, 120, 80, 0.3))',
    saturn: 'linear-gradient(135deg, rgba(220, 190, 140, 0.4), rgba(180, 150, 100, 0.3))',
    uranus: 'linear-gradient(135deg, rgba(100, 200, 220, 0.4), rgba(80, 150, 180, 0.3))',
    neptune: 'linear-gradient(135deg, rgba(50, 100, 200, 0.4), rgba(30, 60, 150, 0.3))'
  };
  return props.planet ? gradients[props.planet] || gradients.mercury : gradients.mercury;
});

function formatNumber(num: number | undefined): string {
  return num?.toLocaleString() ?? '—';
}

function formatTemperature(kelvin: number | undefined): string {
  if (!kelvin) return '—';
  const celsius = kelvin - 273;
  return `${kelvin} K (${celsius > 0 ? '+' : ''}${celsius}°C)`;
}

function formatDistance(km: number | undefined): string {
  if (!km) return '—';
  if (km >= 1e9) return `${(km / 1e9).toFixed(2)}B km`;
  if (km >= 1e6) return `${(km / 1e6).toFixed(1)}M km`;
  return `${km.toLocaleString()} km`;
}

function formatRotation(hours: number | undefined): string {
  return hours ? Math.abs(hours).toFixed(1) : '—';
}
</script>

<style scoped>
.info-panel {
  position: fixed;
  top: 50%;
  right: 30px;
  transform: translateY(-50%);
  width: 320px;
  max-height: 85vh;
  background: linear-gradient(145deg, rgba(10, 15, 30, 0.95), rgba(20, 25, 45, 0.95));
  border: 1px solid rgba(100, 150, 255, 0.3);
  border-radius: 16px;
  color: white;
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(100, 150, 255, 0.1);
  backdrop-filter: blur(20px);
  overflow: hidden;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 20px 24px;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.emoji {
  font-size: 40px;
  margin-bottom: 8px;
}

.name {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 1px;
}

.type {
  margin-top: 6px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 2px;
  opacity: 0.8;
}

.panel-content {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

section {
  margin-bottom: 20px;
}

h3 {
  margin: 0 0 12px 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.5);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 10px 12px;
}

.stat-icon {
  font-size: 14px;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 2px;
}

.stat-value {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.description {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.6;
  margin: 0;
}

.discovery {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 12px;
  margin-top: 12px;
}

.panel-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.explore-btn {
  width: 100%;
  padding: 14px 20px;
  background: linear-gradient(135deg, rgba(100, 150, 255, 0.3), rgba(150, 100, 255, 0.3));
  border: 1px solid rgba(100, 150, 255, 0.5);
  border-radius: 10px;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 1px;
}

.explore-btn:hover {
  background: linear-gradient(135deg, rgba(100, 150, 255, 0.5), rgba(150, 100, 255, 0.5));
  transform: translateY(-2px);
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateY(-50%) translateX(120%);
  opacity: 0;
}

.slide-enter-to,
.slide-leave-from {
  transform: translateY(-50%) translateX(0);
  opacity: 1;
}
</style>
