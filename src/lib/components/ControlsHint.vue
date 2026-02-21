<template>
  <div class="controls-hint">
    <div class="title">Controls</div>
    <div class="control">🖱️ Click planet to select</div>
    <div class="control">⏎ Enter - Open info / Explore</div>
    <div class="control">◀▶ Arrows - Navigate planets</div>
    <div class="control">ℹ️ I - Toggle planet names</div>
    <div class="control">␣ Space - Pause time</div>
    <div class="control">⎋ ESC - Close / View all</div>
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

@media (max-width: 900px) {
  .controls-hint {
    position: relative;
    left: auto;
    right: auto;
    bottom: auto;
    max-width: none;
    box-sizing: border-box;
  }
}
</style>
