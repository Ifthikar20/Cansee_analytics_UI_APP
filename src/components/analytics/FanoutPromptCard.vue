<script setup>
// One prompt's query fan-outs (contract 8 `prompts[]`): the web searches
// the engines ran while answering it, how often, and where you stand on
// Google for each. Searches picked with the checkboxes (1 to 10) go to the
// page's Google check dialog, which shows the cost before anything runs.
import { computed, ref, watch } from 'vue'
import { fanoutGoogleText, fanoutGoogleWord } from '@/lib/analytics/researchSpecs'
import { engineMeta } from '@/lib/engines'
import { timeAgo } from '@/utils/timeAgo'
import AskAgentButton from './AskAgentButton.vue'
import { Button } from '@/components/ui/button'

const props = defineProps({
  websiteId: { type: String, required: true },
  prompt: { type: Object, required: true },
  // Searches whose text the engines did not send (shown as a line).
  unreported: { type: Number, default: 0 },
  // The header links to the prompt's page (off on the Prompt page itself).
  linkPrompt: { type: Boolean, default: true },
  // Most searches one Google check takes (INSIGHTS_FANOUT_MAX_QUERIES).
  maxQueries: { type: Number, default: 10 },
  // Why a Google check can't start right now ('' when it can).
  checkBlocked: { type: String, default: '' },
})
// check([{prompt_id, text}]): the searches to check on Google.
const emit = defineEmits(['check'])

const integer = new Intl.NumberFormat('en-US')

const queries = computed(() => (Array.isArray(props.prompt?.queries) ? props.prompt.queries : []))
const searched = computed(() => (typeof props.prompt?.searched === 'number' ? props.prompt.searched : 0))
const answers = computed(() => (typeof props.prompt?.answers === 'number' ? props.prompt.answers : 0))
const headerId = computed(() => `fpc-${props.prompt?.prompt_id}`)

const selected = ref([])
watch(
  () => queries.value.map((q) => q.key).join('|'),
  () => {
    selected.value = selected.value.filter((key) => queries.value.some((q) => q.key === key))
  },
)
const full = computed(() => selected.value.length >= props.maxQueries)

const rows = computed(() =>
  queries.value.map((q) => ({
    ...q,
    engineText: (q.engines || []).map((k) => engineMeta(k).label).join(', '),
    times: typeof q.answers === 'number' ? integer.format(q.answers) : '',
    google: fanoutGoogleText(q.google, timeAgo),
    ask: {
      prompt: props.prompt?.text || '',
      engines: q.engines || [],
      query: q.text,
      google: fanoutGoogleWord(q.google),
    },
  })),
)

function check() {
  const picked = queries.value.filter((q) => selected.value.includes(q.key))
  if (!picked.length || props.checkBlocked) return
  emit(
    'check',
    picked.map((q) => ({ prompt_id: String(props.prompt.prompt_id), text: q.text })),
  )
}
</script>

<template>
  <section class="fpc" :aria-labelledby="headerId">
    <header class="fpc-head">
      <h3 :id="headerId" class="fpc-title">
        <router-link
          v-if="linkPrompt"
          :to="{ name: 'prompt', params: { websiteId, promptId: String(prompt.prompt_id) } }"
          class="fpc-title-link"
        >{{ prompt.text }}</router-link>
        <template v-else>{{ prompt.text }}</template>
      </h3>
      <p class="fpc-sub">{{ integer.format(searched) }} of {{ integer.format(answers) }} answers searched</p>
    </header>

    <p v-if="!queries.length && !(unreported > 0)" class="fpc-empty">
      The engines answered this prompt without searching the web.
    </p>

    <div v-if="rows.length" class="fpc-scroll" role="region" :aria-label="`Searches for ${prompt.text}, scrolls sideways`" tabindex="0">
      <table class="fpc-table">
        <caption class="sr-only">Searches the engines ran for {{ prompt.text }}</caption>
        <thead>
          <tr>
            <th scope="col" class="fpc-pick"><span class="sr-only">Check on Google</span></th>
            <th scope="col">Search</th>
            <th scope="col">Engines</th>
            <th scope="col" class="is-num">Times</th>
            <th scope="col">Google</th>
            <th scope="col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key">
            <td class="fpc-pick">
              <input
                v-model="selected"
                type="checkbox"
                :value="row.key"
                :disabled="full && !selected.includes(row.key)"
                :aria-label="`Check on Google: ${row.text}`"
              />
            </td>
            <th scope="row" class="fpc-query">{{ row.text }}</th>
            <td class="fpc-nowrap">{{ row.engineText }}</td>
            <td class="is-num">{{ row.times }}</td>
            <td class="fpc-nowrap">
              <span class="fpc-google" :class="{ 'is-word': !row.google.measured }">{{ row.google.text }}</span>
              <span v-if="row.google.sub" class="fpc-google-sub">{{ row.google.sub }}</span>
            </td>
            <td class="fpc-actions">
              <AskAgentButton :website-id="websiteId" template="fanout" :values="row.ask" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="unreported > 0" class="fpc-note">{{ integer.format(unreported) }} searches didn't report their text.</p>

    <footer v-if="selected.length" class="fpc-foot">
      <span v-if="checkBlocked" class="fpc-blocked">{{ checkBlocked }}</span>
      <Button class="rounded-full" :disabled="Boolean(checkBlocked)" @click="check">
        Check {{ selected.length }} on Google
      </Button>
    </footer>
  </section>
</template>

<style scoped>
.fpc {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--card);
}

.fpc-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 16px;
}

.fpc-title {
  min-width: 0;
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}

.fpc-title-link {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: var(--border);
  text-underline-offset: 3px;
}

.fpc-title-link:hover {
  text-decoration-color: currentColor;
}

.fpc-sub,
.fpc-empty,
.fpc-note {
  color: var(--muted-foreground);
  font-size: 13px;
}

.fpc-scroll {
  position: relative;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 14px;
}

.fpc-scroll:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.fpc-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: 13.5px;
}

.fpc-table th,
.fpc-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
}

.fpc-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.fpc-table tbody tr:last-child > * {
  border-bottom: 0;
}

.fpc-table .is-num {
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
}

.fpc-pick {
  width: 36px;
}

.fpc-pick input {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  accent-color: var(--primary);
}

.fpc-query {
  min-width: 220px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.fpc-nowrap {
  white-space: nowrap;
}

.fpc-google {
  display: block;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.fpc-google.is-word {
  color: var(--muted-foreground);
  font-weight: 400;
}

.fpc-google-sub {
  display: block;
  color: var(--muted-foreground);
  font-size: 12px;
}

.fpc-actions {
  text-align: right !important;
}

.fpc-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 12px;
}

.fpc-blocked {
  color: var(--muted-foreground);
  font-size: 13px;
}

@media (max-width: 640px) {
  .fpc {
    padding: 16px;
  }
}
</style>
