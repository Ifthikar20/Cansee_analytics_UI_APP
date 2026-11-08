<script setup>
// Session restore is handled by the router beforeEach guard (sessionRestored flag).
// The Terms of Service gate sits above every route; it decides for itself
// which screens it blocks (lib/legal/terms.js).
import TermsAcceptanceModal from '@/components/legal/TermsAcceptanceModal.vue'
</script>

<template>
  <router-view />
  <TermsAcceptanceModal />
</template>
