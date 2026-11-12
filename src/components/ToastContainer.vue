<template>
  <Teleport to="body">
    <div class="toast-container" v-if="toasts.length">
      <transition-group name="toast">
        <Alert
          v-for="toast in toasts"
          :key="toast.id"
          :variant="toast.type === 'error' ? 'destructive' : 'default'"
          class="toast-item"
          :class="{ 'toast-leaving': toast.leaving }"
          @click="remove(toast.id)"
        >
          <component :is="ICONS[toast.type] || Info" :class="ICON_TINT[toast.type]" />
          <AlertTitle>{{ toast.message }}</AlertTitle>
          <AlertDescription v-if="toast.description">{{ toast.description }}</AlertDescription>
          <button class="toast-close" @click.stop="remove(toast.id)" aria-label="Close">
            <X class="size-3.5" />
          </button>
        </Alert>
      </transition-group>
    </div>
  </Teleport>
</template>

<script setup>
// Toast host built on the shadcn Alert primitives so notifications and
// inline alerts share one design: neutral card surface, subtle border,
// icon-tinted semantics — never a colored wash.
import { onMounted } from 'vue'
import { CircleCheck, CircleX, Info, TriangleAlert, X } from '@lucide/vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const { toasts, remove } = toast

const ICONS = {
  success: CircleCheck,
  error: CircleX,
  warning: TriangleAlert,
  info: Info,
}

// Semantics live in the icon tint only; error additionally gets the
// destructive variant's text treatment from the Alert itself.
const ICON_TINT = {
  success: 'text-[color:var(--chart-4)]',
  warning: 'text-[color:var(--chart-5)]',
  info: 'text-muted-foreground',
}

onMounted(() => {
  // Dev-only hook so toasts can be exercised from the console without
  // driving a full user flow (window.__fbToast.success('...')).
  if (import.meta.env.DEV) window.__fbToast = toast
})
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 400px;
  pointer-events: none;
}

.toast-item {
  cursor: pointer;
  pointer-events: auto;
  /* Floating without a shadow: a popover surface with an ink edge. */
  border-color: var(--foreground);
  background: var(--popover);
  color: var(--popover-foreground);
  animation: toast-in 0.35s ease;
  transition: opacity 0.3s, transform 0.3s;
}

.toast-leaving {
  opacity: 0;
  transform: translateX(100%);
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(100%); }
  to { opacity: 1; transform: translateX(0); }
}

.toast-close {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted-foreground);
  opacity: 0.7;
  padding: 2px;
  line-height: 1;
  transition: opacity 0.15s;
}
.toast-close:hover { opacity: 1; }

@media (max-width: 480px) {
  .toast-container {
    top: auto;
    bottom: 20px;
    right: 12px;
    left: 12px;
    max-width: 100%;
  }
}
</style>
