<script setup>
// A Comparison Page Agent draft (p2_contract.md 12d comparison): each
// statement with whom it is about, the page it comes from and the quoted
// words, and whether the server found those words on that page.
import { computed } from 'vue'
import { CircleAlert, CircleCheck, ExternalLink } from '@lucide/vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { relativeTime } from '@/components/agent/common/agentText'
import { pathOf } from '@/lib/agent/contextSections'
import { comparison } from '@/lib/agent/structured'
import { safeHref } from '@/utils/safeHref'

const props = defineProps({
  data: { type: Object, default: null },
  live: { type: Boolean, default: false },
})

const view = computed(() => comparison(props.data))
const drafting = computed(() => props.live || view.value.drafting)
const competitorName = computed(() => view.value.competitor.name || view.value.competitor.domain || 'Competitor')

function sourceTitle(source) {
  return source?.title || pathOf(source?.url) || source?.url || ''
}

function sourceState(source) {
  if (source.state === 'failed') return "Couldn't load"
  const when = relativeTime(source.read_at)
  return when ? `Read ${when}` : ''
}
</script>

<template>
  <div class="ag-cmv">
    <div v-if="view.claims.length" class="ag-cmv-scroll" tabindex="0" aria-label="Statements, scrolls sideways">
      <table class="ag-cmv-table">
        <thead>
          <tr>
            <th scope="col">Statement</th>
            <th scope="col">About</th>
            <th scope="col">Source</th>
            <th scope="col">Quote</th>
            <th scope="col">Checked</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(claim, i) in view.claims" :key="`${claim.source_id}-${i}`">
            <td class="ag-cmv-statement">{{ claim.text }}</td>
            <td>{{ claim.about === 'competitor' ? competitorName : 'You' }}</td>
            <td>
              <a
                v-if="claim.source && safeHref(claim.source.url)"
                :href="safeHref(claim.source.url)"
                class="ag-cmv-link"
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                {{ sourceTitle(claim.source) }}
                <ExternalLink :size="11" aria-hidden="true" />
              </a>
              <span v-else>{{ claim.source ? sourceTitle(claim.source) : claim.source_id }}</span>
            </td>
            <td class="ag-cmv-quote">{{ claim.quote ? `"${claim.quote}"` : '' }}</td>
            <td>
              <span v-if="claim.verified === true" class="ag-cmv-check is-ok">
                <CircleCheck :size="13" aria-hidden="true" />
                Verified
              </span>
              <span v-else-if="claim.verified === false" class="ag-cmv-check is-warn">
                <CircleAlert :size="13" aria-hidden="true" />
                Not verified
              </span>
              <span v-else class="ag-cmv-check is-muted">Not checked</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <section v-if="view.sources.length" class="ag-cmv-sources" aria-labelledby="ag-cmv-sources-title">
      <h3 id="ag-cmv-sources-title" class="ag-cmv-title">Sources</h3>
      <ul class="ag-cmv-list" role="list">
        <li v-for="s in view.sources" :key="s.id" class="ag-cmv-source">
          <span class="ag-cmv-owner">{{ s.owner === 'you' ? 'You' : competitorName }}</span>
          <a v-if="safeHref(s.url)" :href="safeHref(s.url)" class="ag-cmv-link" target="_blank" rel="noopener noreferrer nofollow">
            {{ sourceTitle(s) }}
            <ExternalLink :size="11" aria-hidden="true" />
          </a>
          <span v-else>{{ sourceTitle(s) }}</span>
          <span class="ag-cmv-state" :class="{ 'is-warn': s.state === 'failed' }">{{ sourceState(s) }}</span>
        </li>
      </ul>
    </section>

    <p v-if="drafting" class="ag-cmv-drafting" role="status"><AgSpinner :size="12" /> Drafting…</p>
  </div>
</template>

<style scoped>
.ag-cmv {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 24px 32px;
  color: var(--ag-fg-1);
}

.ag-cmv-scroll {
  overflow-x: auto;
}

.ag-cmv-scroll:focus-visible {
  border-radius: var(--radius);
  outline: 2px solid var(--ag-ring);
  outline-offset: 2px;
}

.ag-cmv-table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 19px;
}

.ag-cmv-table th,
.ag-cmv-table td {
  padding: 8px 10px;
  border-top: 1px solid var(--ag-divider-subtle);
  text-align: left;
  vertical-align: top;
}

.ag-cmv-table thead th {
  border-top: 0;
  color: var(--ag-fg-3);
  font-weight: 500;
  white-space: nowrap;
}

.ag-cmv-statement {
  min-width: 200px;
}

.ag-cmv-quote {
  min-width: 160px;
  color: var(--ag-fg-2);
}

.ag-cmv-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ag-fg-1);
  text-decoration: underline;
  text-decoration-color: var(--ag-divider);
  text-underline-offset: 3px;
}

.ag-cmv-link:hover {
  text-decoration-color: currentColor;
  opacity: 1;
}

.ag-cmv-check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.ag-cmv-check.is-ok {
  color: var(--ag-you);
}

.ag-cmv-check.is-warn {
  color: var(--ag-warning);
}

.ag-cmv-check.is-muted {
  color: var(--ag-fg-4);
}

.ag-cmv-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.ag-cmv-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-cmv-source {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  font-size: 13px;
  line-height: 19px;
}

.ag-cmv-owner {
  color: var(--ag-fg-3);
  font-weight: 500;
}

.ag-cmv-state {
  color: var(--ag-fg-3);
}

.ag-cmv-state.is-warn {
  color: var(--ag-warning);
}

.ag-cmv-drafting {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
}

@media (max-width: 560px) {
  .ag-cmv {
    padding: 16px;
  }
}
</style>
