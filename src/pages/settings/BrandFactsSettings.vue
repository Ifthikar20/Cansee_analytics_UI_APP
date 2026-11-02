<template>
  <SettingsShell active="brand-facts">
    <BrandInputPage />
  </SettingsShell>
</template>

<script setup>
// The brand knowledge base (formerly "Brand Ingestion"), now a project
// setting: it feeds the alignment score and the fact checks on each
// prompt rather than being a destination of its own.
import SettingsShell from '@/components/settings/SettingsShell.vue'
import BrandInputPage from '@/pages/BrandInputPage.vue'
</script>
