<template>
  <div class="controls-hint">
    <div class="title">Controls</div>
    <div class="control">🖱️ Click planet to focus</div>
    <div class="control">⎋ ESC - View all</div>
    <div class="control">📍 L - Locate player</div>
    <div class="control">🎮 WASD - Move | Space - Jump</div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.controls-hint {
  position: fixed;
  bottom: 20px;
  left: 20px;
  color: white;
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.6), rgba(20, 20, 40, 0.6));
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  font-size: 12px;
  line-height: 1.6;
  z-index: 100;
}

.title {
  font-weight: bold;
  margin-bottom: 8px;
  color: #88aaff;
}

.control {
  opacity: 0.9;
}
</style>
