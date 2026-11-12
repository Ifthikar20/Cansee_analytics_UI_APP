<script setup>
// Shared empty state. Used wherever a card has no measured data yet.
//
// The product rule this enforces: never render representative or sample
// figures to fill a layout. A card with nothing to show says so and points
// at the action that would produce data, so the user is never left reading
// numbers that are not theirs.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'

const props = defineProps({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  ctaLabel: { type: String, default: '' },
  ctaTo: { type: String, default: '' },
  // 'card' sits inside an existing bordered card; 'panel' draws its own.
  variant: { type: String, default: 'card' },
})

const router = useRouter()
const hasCta = computed(() => Boolean(props.ctaLabel && props.ctaTo))

function go() {
  router.push(props.ctaTo)
}
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center"
    :class="variant === 'panel' ? 'border border-dashed border-input' : ''"
  >
    <p class="text-sm font-semibold text-foreground">{{ title }}</p>
    <p v-if="body" class="max-w-md text-[12px] leading-relaxed text-muted-foreground">
      {{ body }}
    </p>
    <Button v-if="hasCta" size="sm" class="mt-2" @click="go">
      {{ ctaLabel }}
    </Button>
  </div>
</template>
