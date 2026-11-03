<script setup>
// A PR Agent draft of correction requests (p2_contract.md 12d corrections):
// the claim engines repeat and your evidence, then one letter per page that
// states the claim, quoting that page. Pages that don't repeat the claim and
// pages that couldn't be read are listed, never written to.
import { computed } from 'vue'
import { ExternalLink } from '@lucide/vue'
import AgButton from '@/components/agent/common/AgButton.vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/lib/agent/download'
import { renderMarkdown } from '@/lib/agent/markdown/renderer'
import { domainOf } from '@/lib/agent/contextSections'
import { corrections } from '@/lib/agent/structured'
import { safeHref } from '@/utils/safeHref'

const props = defineProps({
  data: { type: Object, default: null },
  live: { type: Boolean, default: false },
})

const toast = useToast()
const count = new Intl.NumberFormat('en-US')

const view = computed(() => corrections(props.data))
const drafting = computed(() => props.live || view.value.drafting)
const claim = computed(() => view.value.claim)
const evidenceHref = computed(() => safeHref(claim.value.evidence.url))

const answersLine = computed(() => {
  const bits = []
  if (claim.value.answers !== null) {
    bits.push(`${count.format(claim.value.answers)} ${claim.value.answers === 1 ? 'answer' : 'answers'}`)
  }
  if (claim.value.engines.length) bits.push(claim.value.engines.join(', '))
  return bits.join(' · ')
})

const pagesChecked = computed(() => view.value.not_repeating.length + view.value.unreadable.length)

function publisherOf(target) {
  return target.publisher || domainOf(target.url) || target.id
}

function letterHtml(target) {
  return renderMarkdown(target.letter || '')
}

async function copyLetter(target) {
  if (await copyText(target.letter || '')) toast.success('Copied')
}
</script>

<template>
  <div class="ag-crv">
    <header v-if="claim.text" class="ag-crv-claim">
      <p class="ag-crv-claim-text">"{{ claim.text }}"</p>
      <p v-if="answersLine" class="ag-crv-meta">{{ answersLine }}</p>
      <p v-if="claim.evidence.quote" class="ag-crv-evidence">
        Your evidence: "{{ claim.evidence.quote }}"
        <a v-if="evidenceHref" :href="evidenceHref" class="ag-crv-link" target="_blank" rel="noopener noreferrer nofollow">
          {{ claim.evidence.url }}
          <ExternalLink :size="11" aria-hidden="true" />
        </a>
      </p>
    </header>

    <ol v-if="view.targets.length" class="ag-crv-targets" aria-label="Letters">
      <li v-for="target in view.targets" :key="target.id" class="ag-crv-target">
        <div class="ag-crv-head">
          <h3 class="ag-crv-publisher">{{ publisherOf(target) }}</h3>
          <a v-if="safeHref(target.url)" :href="safeHref(target.url)" class="ag-crv-link" target="_blank" rel="noopener noreferrer nofollow">
            {{ target.url }}
            <ExternalLink :size="11" aria-hidden="true" />
          </a>
        </div>
        <p v-if="target.quote" class="ag-crv-says">What it says: "{{ target.quote }}"</p>
        <!-- The shared Markdown renderer sanitizes the letter (raw HTML off, then DOMPurify). -->
        <div v-if="target.letter" class="ag-prose ag-crv-letter" v-html="letterHtml(target)" />
        <div v-if="target.letter && !drafting" class="ag-crv-actions">
          <AgButton size="xs" variant="ghost" @click="copyLetter(target)">Copy letter</AgButton>
        </div>
      </li>
    </ol>
    <p v-else-if="!drafting" class="ag-crv-none">
      None of the {{ count.format(pagesChecked) }} pages these answers cite repeats the claim.
    </p>

    <section v-if="view.not_repeating.length" class="ag-crv-list" aria-labelledby="ag-crv-not-repeating">
      <h3 id="ag-crv-not-repeating" class="ag-crv-title">Pages that don't repeat the claim</h3>
      <ul role="list">
        <li v-for="p in view.not_repeating" :key="p.url">
          <a v-if="safeHref(p.url)" :href="safeHref(p.url)" class="ag-crv-link" target="_blank" rel="noopener noreferrer nofollow">
            {{ p.publisher || p.url }}
          </a>
          <span v-else>{{ p.publisher || p.url }}</span>
        </li>
      </ul>
    </section>

    <section v-if="view.unreadable.length" class="ag-crv-list" aria-labelledby="ag-crv-unreadable">
      <h3 id="ag-crv-unreadable" class="ag-crv-title">Pages that couldn't be read</h3>
      <ul role="list">
        <li v-for="p in view.unreadable" :key="p.url">
          <span>{{ p.publisher || p.url }}</span>
          <span v-if="p.reason" class="ag-crv-reason">{{ p.reason }}</span>
        </li>
      </ul>
    </section>

    <p v-if="drafting" class="ag-crv-drafting" role="status"><AgSpinner :size="12" /> Drafting…</p>
  </div>
</template>

<style scoped>
.ag-crv {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px 24px 32px;
  color: var(--ag-fg-1);
}

.ag-crv-claim {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--ag-bubble-bg);
}

.ag-crv-claim-text {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 22px;
}

.ag-crv-meta,
.ag-crv-says,
.ag-crv-evidence {
  margin: 0;
  color: var(--ag-fg-2);
  font-size: 13px;
  line-height: 19px;
  overflow-wrap: anywhere;
}

.ag-crv-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  overflow: hidden;
  color: var(--ag-fg-1);
  font-size: 12.5px;
  text-decoration: underline;
  text-decoration-color: var(--ag-divider);
  text-overflow: ellipsis;
  text-underline-offset: 3px;
  white-space: nowrap;
}

.ag-crv-targets {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-crv-target {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
}

.ag-crv-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}

.ag-crv-publisher {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.ag-crv-letter {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--ag-bubble-bg);
  font-size: 13.5px;
}

.ag-crv-actions {
  display: flex;
  justify-content: flex-end;
}

.ag-crv-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
}

.ag-crv-list ul {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  line-height: 19px;
}

.ag-crv-list li {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
}

.ag-crv-reason {
  color: var(--ag-fg-3);
}

.ag-crv-none,
.ag-crv-drafting {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
}

@media (max-width: 560px) {
  .ag-crv {
    padding: 16px;
  }
}
</style>
