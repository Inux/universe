<template>
  <div class="view-controls" role="group" aria-label="Time and distance">
    <div class="control-row">
      <span class="name">Time</span>
      <button type="button" class="time-pause" @click="$emit('toggleTime')">
        {{ timeRunning ? 'Pause' : 'Resume' }}
      </button>
      <span class="value">{{ timeLabel(timeStep) }}</span>
    </div>
    <input
      class="step-slider time-slider"
      type="range"
      min="0"
      :max="lastStep"
      step="1"
      :value="timeStep"
      aria-label="Time speed"
      aria-valuemin="0"
      :aria-valuemax="lastStep"
      :aria-valuenow="timeStep"
      :aria-valuetext="timeLabel(timeStep)"
      @input="onTimeInput"
    />
    <div class="detail">{{ timeDetail(timeStep) }}</div>

    <div class="control-row">
      <span class="name">Distance</span>
      <span class="value">{{ distanceLabel(distanceStep) }}</span>
    </div>
    <input
      class="step-slider distance-slider"
      type="range"
      min="0"
      :max="lastStep"
      step="1"
      :value="distanceStep"
      aria-label="Orbital distances"
      aria-valuemin="0"
      :aria-valuemax="lastStep"
      :aria-valuenow="distanceStep"
      :aria-valuetext="distanceLabel(distanceStep)"
      @input="onDistanceInput"
    />
    <div class="detail">{{ distanceDetail(distanceStep) }}</div>
  </div>
</template>

<script setup lang="ts">
import { DEFAULT_STEP, distanceDetail, distanceLabel, timeDetail, timeLabel } from '../three/viewScale';

defineProps<{
  timeRunning: boolean;
  timeStep: number;
  distanceStep: number;
}>();

const emit = defineEmits<{
  toggleTime: [];
  updateTimeStep: [step: number];
  updateDistanceStep: [step: number];
}>();

const lastStep = DEFAULT_STEP;

function onTimeInput(event: Event) {
  emit('updateTimeStep', Number((event.target as HTMLInputElement).value));
}

function onDistanceInput(event: Event) {
  emit('updateDistanceStep', Number((event.target as HTMLInputElement).value));
}
</script>

<style scoped>
.view-controls {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  width: min(420px, calc(100vw - 640px));
  z-index: 120;
  color: white;
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.6), rgba(20, 20, 40, 0.6));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  padding: 10px 14px 8px;
  box-sizing: border-box;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-row + .step-slider {
  margin-top: 4px;
}

.name {
  font-size: 12px;
  font-weight: bold;
  color: #88aaff;
}

.value {
  margin-left: auto;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.time-pause {
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: white;
  border-radius: 999px;
  padding: 2px 10px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.time-pause:hover {
  background: rgba(255, 255, 255, 0.16);
}

.step-slider {
  display: block;
  width: 100%;
  margin: 0;
  accent-color: #9bb6ff;
  height: 22px;
  cursor: pointer;
}

.detail {
  margin: 0 0 6px;
  font-size: 11px;
  line-height: 1.35;
  opacity: 0.8;
}

.detail:last-child {
  margin-bottom: 0;
}

@media (max-width: 1140px) {
  .view-controls {
    left: 240px;
    right: 360px;
    transform: none;
    width: auto;
    max-width: 420px;
    margin-left: auto;
    margin-right: auto;
  }
}

@media (max-width: 900px) {
  .view-controls {
    position: relative;
    left: auto;
    right: auto;
    bottom: auto;
    transform: none;
    width: auto;
    max-width: none;
    margin: 0;
  }
}
</style>
