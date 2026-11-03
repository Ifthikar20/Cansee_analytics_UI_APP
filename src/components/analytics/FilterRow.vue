<script setup>
// One left-aligned row of filters above the content they scope; every
// filter applies to every chart below it. Wraps on phones.
defineProps({
  label: { type: String, default: 'Filters' },
})
</script>

<template>
  <div class="an-filters" role="group" :aria-label="label">
    <slot />
  </div>
</template>

<style scoped>
.an-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
}
</style>
