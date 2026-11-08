<template>
  <div class="gcard">
    <div class="gcard-field" aria-hidden="true"></div>
    <div class="gcard-grain" aria-hidden="true"></div>
    <div class="gcard-content">
      <slot />
    </div>
  </div>
</template>

<script setup>
// The grainy violet panel shared by the landing hero and the auth screens.
// Pure CSS: layered radial gradients for the colour field, an SVG
// fractal-noise tile for the grain. No images or video to download.
</script>

<style scoped>
.gcard {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  border-radius: 28px;
  background: #5e5494;
  color: #ffffff;
}

/* Oversized and blurred so the slow drift never shows an edge. */
.gcard-field {
  position: absolute;
  inset: -25%;
  z-index: -2;
  background:
    radial-gradient(38% 48% at 22% 78%, #1f2490 0%, rgba(31, 36, 144, 0) 72%),
    radial-gradient(34% 42% at 84% 18%, #c8ae86 0%, rgba(200, 174, 134, 0) 72%),
    radial-gradient(30% 38% at 86% 84%, #a66b97 0%, rgba(166, 107, 151, 0) 72%),
    radial-gradient(36% 44% at 14% 16%, #6863bb 0%, rgba(104, 99, 187, 0) 72%),
    radial-gradient(48% 54% at 52% 48%, #9479b8 0%, rgba(148, 121, 184, 0) 76%);
  filter: blur(18px);
  animation: gcard-drift 26s ease-in-out infinite alternate;
}

.gcard-grain {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 160px 160px;
  mix-blend-mode: overlay;
  opacity: 0.55;
}

.gcard-content {
  position: relative;
  height: 100%;
}

@keyframes gcard-drift {
  0% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(3%, -2%, 0) scale(1.06); }
  100% { transform: translate3d(-3%, 2%, 0) scale(1.02); }
}

@media (prefers-reduced-motion: reduce) {
  .gcard-field { animation: none; }
}
</style>
