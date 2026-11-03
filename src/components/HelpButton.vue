<template>
  <div class="inline-flex">
    <Button
      variant="ghost"
      size="icon"
      class="h-8 w-8 text-muted-foreground"
      title="Help"
      aria-label="Help"
      @click="open = !open"
    >
      <HelpCircle class="size-4" />
    </Button>

    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-[300] flex justify-end bg-black/30" @click.self="open = false">
        <div class="flex h-screen w-[380px] max-w-[90vw] flex-col overflow-y-auto border-l border-border bg-card shadow-[-8px_0_30px_rgba(0,0,0,0.1)]">
          <div class="flex items-center justify-between border-b border-border px-6 py-5">
            <h3 class="text-lg font-semibold text-foreground">Help</h3>
            <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground" aria-label="Close help" @click="open = false">
              <X class="size-4" />
            </Button>
          </div>

          <div class="px-6 py-5">
            <h4 class="mb-4 text-sm font-bold uppercase tracking-wider text-foreground">Getting started</h4>
            <ol class="mb-7">
              <li v-for="(step, i) in STEPS" :key="step.title" class="mb-4 flex gap-3.5">
                <span class="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{{ i + 1 }}</span>
                <div>
                  <strong class="text-foreground">{{ step.title }}</strong>
                  <p class="mt-1 text-sm leading-snug text-muted-foreground">{{ step.text }}</p>
                </div>
              </li>
            </ol>

            <div class="grid gap-2">
              <Button variant="outline" class="w-full" as-child>
                <a href="/docs" target="_blank" rel="noopener">Read the docs</a>
              </Button>
              <Button variant="outline" class="w-full" as-child>
                <router-link to="/support" @click="open = false">Contact support</router-link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { HelpCircle, X } from '@lucide/vue'

const open = ref(false)

const STEPS = [
  {
    title: 'Add prompts on the Overview',
    text: 'Choose Add prompts and enter the questions your buyers ask, one per line. The AI engines are asked right away.',
  },
  {
    title: 'Check Google',
    text: 'Choose Check Google on the Overview to look up where your site ranks for each prompt.',
  },
  {
    title: 'Open a prompt to see what to change',
    text: 'Select a prompt to compare Google with each engine and get a ranked list of changes.',
  },
]
</script>
