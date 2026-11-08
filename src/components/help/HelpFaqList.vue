<script setup>
// One list of questions as an accordion: the question is the trigger (Enter,
// Space, and Up and Down between questions), the answer its panel. Answers
// are text, never HTML. Several can be open at once.
import { ChevronDown } from '@lucide/vue'
import { AccordionContent, AccordionHeader, AccordionItem, AccordionRoot, AccordionTrigger } from 'reka-ui'

const props = defineProps({
  items: { type: Array, required: true },
  // Unique per list on the page: the same question can be in two lists.
  listId: { type: String, required: true },
  // The ids of the open questions.
  modelValue: { type: Array, default: () => [] },
  // 'h3' or 'h4': the questions' heading level under their list title.
  headingLevel: { type: String, default: 'h4' },
  // Where "Read more in Docs" goes: (anchor) => { href, target }.
  docsLink: { type: Function, default: null },
})
const emit = defineEmits(['update:modelValue', 'docs'])

const domId = (id) => `help-${props.listId}-${id}`

function onDocs(event, faq) {
  emit('docs', { event, faq })
}
</script>

<template>
  <AccordionRoot
    type="multiple"
    class="help-faq"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <AccordionItem
      v-for="faq in items"
      :key="faq.id"
      :value="faq.id"
      class="help-faq-item"
      :data-faq-id="faq.id"
    >
      <AccordionHeader :as="headingLevel" class="help-faq-head">
        <AccordionTrigger :id="domId(faq.id)" class="help-faq-trigger">
          <span class="help-faq-q">{{ faq.q }}</span>
          <ChevronDown class="help-faq-chev" aria-hidden="true" />
        </AccordionTrigger>
      </AccordionHeader>
      <AccordionContent class="help-faq-panel">
        <p v-for="(para, i) in faq.a" :key="i" class="help-faq-p">{{ para }}</p>
        <ul v-if="faq.list.length" class="help-faq-ul">
          <li v-for="(line, i) in faq.list" :key="i">{{ line }}</li>
        </ul>
        <a
          v-if="faq.docs && docsLink"
          class="help-faq-docs"
          :href="docsLink(faq.docs).href"
          :target="docsLink(faq.docs).target || undefined"
          :rel="docsLink(faq.docs).target ? 'noopener' : undefined"
          @click="onDocs($event, faq)"
        >Read more in Docs</a>
      </AccordionContent>
    </AccordionItem>
  </AccordionRoot>
</template>

<style scoped>
.help-faq-item + .help-faq-item {
  border-top: 1px solid var(--border);
}

.help-faq-head {
  margin: 0;
  font: inherit;
}

.help-faq-trigger {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 11px 2px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.help-faq-trigger:hover .help-faq-q {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.help-faq-trigger:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.help-faq-q {
  flex: 1;
  min-width: 0;
}

.help-faq-chev {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  color: var(--muted-foreground);
  transition: transform 0.18s ease;
}

.help-faq-trigger[data-state='open'] .help-faq-chev {
  transform: rotate(180deg);
}

.help-faq-panel {
  padding: 0 2px 12px;
  color: var(--muted-foreground);
  font-size: 13.5px;
  line-height: 1.55;
}

.help-faq-p {
  margin: 0 0 8px;
}

.help-faq-ul {
  margin: 0 0 8px;
  padding-left: 18px;
  list-style: disc;
}

.help-faq-ul li {
  margin: 0 0 4px;
}

.help-faq-docs {
  color: var(--foreground);
  font-size: 13px;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .help-faq-chev {
    transition: none;
  }
}
</style>
