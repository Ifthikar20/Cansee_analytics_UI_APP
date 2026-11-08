<template>
  <div class="ag-sheet" :aria-busy="live ? 'true' : 'false'">
    <p v-if="live" class="ag-sheet-live" role="status">
      <AgSpinner :size="14" />
      Writing the campaign…
    </p>

    <section v-if="issues.length" class="ag-sheet-warn" aria-labelledby="ag-sheet-warn-title">
      <h3 id="ag-sheet-warn-title" class="ag-sheet-warn-title">
        <TriangleAlert :size="16" aria-hidden="true" />
        {{ issues.length }} {{ issues.length === 1 ? 'item' : 'items' }} to review
      </h3>
      <ul class="ag-sheet-warn-list">
        <li v-for="(w, i) in issues" :key="i">
          <span v-if="w.where" class="ag-sheet-where">{{ w.where }}</span>
          {{ w.message }}
        </li>
      </ul>
    </section>

    <section class="ag-sheet-section" aria-labelledby="ag-sheet-campaign">
      <h3 id="ag-sheet-campaign" class="ag-sheet-h">Campaign</h3>
      <div class="ag-sheet-table">
        <table>
          <tbody>
            <tr>
              <th scope="row">Name</th>
              <td :class="{ 'is-muted': !campaign.name }">{{ campaign.name || 'Not set' }}</td>
            </tr>
            <tr>
              <th scope="row">Platform</th>
              <td :class="{ 'is-muted': !campaign.platform }">{{ platformLabel(campaign.platform) || 'Not set' }}</td>
            </tr>
            <tr>
              <th scope="row">Objective</th>
              <td :class="{ 'is-muted': !campaign.objective }">{{ campaign.objective || 'Not set' }}</td>
            </tr>
            <tr>
              <th scope="row">Daily budget</th>
              <td :class="{ 'is-muted': budget === '' }" class="ag-tnum">{{ budget === '' ? 'Not set' : budget }}</td>
            </tr>
            <tr>
              <th scope="row">Bid strategy</th>
              <td :class="{ 'is-muted': !campaign.bid_strategy }">{{ campaign.bid_strategy || 'Not set' }}</td>
            </tr>
            <tr>
              <th scope="row">Final URL</th>
              <td class="is-url" :class="{ 'is-muted': !campaign.final_url }">{{ campaign.final_url || 'Not set' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      v-for="(group, gi) in groups"
      :key="`g${gi}`"
      class="ag-sheet-section"
      :aria-label="`Ad group ${group.name || gi + 1}`"
    >
      <h3 class="ag-sheet-h">
        <span class="ag-sheet-h-kicker">Ad group {{ gi + 1 }}</span>
        {{ group.name || 'Untitled ad group' }}
      </h3>

      <h4 class="ag-sheet-sub">
        Keywords <span class="ag-sheet-count ag-tnum">{{ list(group.keywords).length }}</span>
      </h4>
      <div v-if="list(group.keywords).length" class="ag-sheet-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Keyword</th>
              <th scope="col">Match type</th>
              <th scope="col">As entered</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(kw, ki) in list(group.keywords)" :key="ki">
              <td>{{ kw.text }}</td>
              <td>{{ matchLabel(kw.match) }}</td>
              <td class="is-mono">{{ matchSyntax(kw.text, kw.match) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="ag-sheet-none">No keywords yet.</p>

      <template v-if="list(group.negatives).length">
        <h4 class="ag-sheet-sub">
          Negative keywords <span class="ag-sheet-count ag-tnum">{{ list(group.negatives).length }}</span>
        </h4>
        <ul class="ag-sheet-chips">
          <li v-for="(neg, ni) in list(group.negatives)" :key="ni">{{ neg }}</li>
        </ul>
      </template>

      <div v-for="(ad, ai) in list(group.ads)" :key="`a${ai}`" class="ag-sheet-ad">
        <h4 class="ag-sheet-sub">
          Responsive search ad {{ ai + 1 }}
          <span v-if="adCountIssue(ad)" class="ag-sheet-flag">{{ adCountIssue(ad) }}</span>
        </h4>
        <div class="ag-sheet-table">
          <table>
            <thead>
              <tr>
                <th scope="col" class="is-num">#</th>
                <th scope="col">Headline</th>
                <th scope="col" class="is-num">Length</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(h, hi) in list(ad.headlines)" :key="hi" :class="{ 'is-over': measure(h, LIMITS.headline).over }">
                <td class="is-num">{{ hi + 1 }}</td>
                <td>{{ h }}</td>
                <td class="is-num">
                  <LengthCell :text="h" :limit="LIMITS.headline" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="ag-sheet-table">
          <table>
            <thead>
              <tr>
                <th scope="col" class="is-num">#</th>
                <th scope="col">Description</th>
                <th scope="col" class="is-num">Length</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(d, di) in list(ad.descriptions)"
                :key="di"
                :class="{ 'is-over': measure(d, LIMITS.description).over }"
              >
                <td class="is-num">{{ di + 1 }}</td>
                <td>{{ d }}</td>
                <td class="is-num">
                  <LengthCell :text="d" :limit="LIMITS.description" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="ad.path1 || ad.path2" class="ag-sheet-path">
          <span class="ag-sheet-path-label">Display path</span>
          <span class="is-mono">{{ displayPath(ad) }}</span>
          <LengthCell v-if="ad.path1" :text="ad.path1" :limit="LIMITS.path" label="Path 1" />
          <LengthCell v-if="ad.path2" :text="ad.path2" :limit="LIMITS.path" label="Path 2" />
        </p>
      </div>
      <p v-if="!list(group.ads).length" class="ag-sheet-none">No ads yet.</p>
    </section>

    <section v-if="sitelinks.length" class="ag-sheet-section" aria-labelledby="ag-sheet-sitelinks">
      <h3 id="ag-sheet-sitelinks" class="ag-sheet-h">Sitelinks</h3>
      <div class="ag-sheet-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Link text</th>
              <th scope="col">Final URL</th>
              <th scope="col">Description 1</th>
              <th scope="col">Description 2</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, si) in sitelinks" :key="si">
              <td>
                {{ s.text }}
                <LengthCell :text="s.text" :limit="LIMITS.sitelinkText" block />
              </td>
              <td class="is-url">{{ s.url }}</td>
              <td>
                <template v-if="s.description1">
                  {{ s.description1 }}
                  <LengthCell :text="s.description1" :limit="LIMITS.sitelinkDescription" block />
                </template>
              </td>
              <td>
                <template v-if="s.description2">
                  {{ s.description2 }}
                  <LengthCell :text="s.description2" :limit="LIMITS.sitelinkDescription" block />
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, defineComponent, h } from 'vue'
import { TriangleAlert } from '@lucide/vue'
import AgSpinner from '@/components/agent/common/AgSpinner.vue'
import { hostOf } from '@/lib/agent/url'
import {
  AD_COUNTS,
  LIMITS,
  countIssue,
  matchLabel,
  matchSyntax,
  measure,
  platformLabel,
  sheetWarnings,
} from './sheetModel'

const props = defineProps({
  sheet: { type: Object, default: null },
  warnings: { type: Array, default: () => [] },
  live: { type: Boolean, default: false },
})

const LengthCell = defineComponent({
  name: 'LengthCell',
  props: {
    text: { type: String, default: '' },
    limit: { type: Number, required: true },
    label: { type: String, default: '' },
    block: { type: Boolean, default: false },
  },
  setup(p) {
    return () => {
      const m = measure(p.text, p.limit)
      return h(
        'span',
        {
          class: ['ag-len', 'ag-tnum', { 'is-over': m.over, 'is-block': p.block }],
          title: m.over ? `Over the ${m.limit} character limit` : `${m.length} of ${m.limit} characters`,
        },
        [
          p.label ? `${p.label} ` : '',
          `${m.length}/${m.limit}`,
          m.over ? h('span', { class: 'ag-sr-only' }, ', over the limit') : null,
        ]
      )
    }
  },
})

const list = (value) => (Array.isArray(value) ? value.filter((v) => v !== null && v !== undefined) : [])

const campaign = computed(() => props.sheet?.campaign || {})
const groups = computed(() => list(props.sheet?.ad_groups))
const sitelinks = computed(() => list(props.sheet?.sitelinks))
const issues = computed(() => sheetWarnings(props.sheet, props.warnings))

const budget = computed(() => {
  const value = campaign.value.daily_budget
  return value === null || value === undefined || value === '' ? '' : String(value)
})

function adCountIssue(ad) {
  if (props.live) return ''
  return (
    countIssue(list(ad.headlines).length, AD_COUNTS.headlines, 'headline') ||
    countIssue(list(ad.descriptions).length, AD_COUNTS.descriptions, 'description')
  )
}

function displayPath(ad) {
  const path = [ad.path1, ad.path2].filter(Boolean).join('/')
  const host = hostOf(campaign.value.final_url)
  return host ? `${host}/${path}` : `/${path}`
}
</script>

<style scoped>
.ag-sheet {
  box-sizing: border-box;
  max-width: 880px;
  margin: 0 auto;
  padding: 24px 24px 56px;
  color: var(--ag-fg-1);
  font-size: 14px;
  line-height: 20px;
}

.ag-sheet-live {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  color: var(--ag-fg-3);
  font-size: 13px;
}

.ag-sheet-warn {
  margin-bottom: 24px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--ag-warning) 32%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--ag-warning) 8%, transparent);
}

.ag-sheet-warn-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ag-warning);
  font-size: 14px;
  font-weight: 600;
}

.ag-sheet-warn-list {
  margin: 8px 0 0;
  padding-left: 24px;
  color: var(--ag-fg-1b);
  font-size: 13px;
}

.ag-sheet-warn-list li + li {
  margin-top: 4px;
}

.ag-sheet-where {
  margin-right: 6px;
  color: var(--ag-fg-2);
  font-weight: 500;
}

.ag-sheet-section + .ag-sheet-section {
  margin-top: 32px;
}

.ag-sheet-h {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 0 12px;
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
}

.ag-sheet-h-kicker {
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.ag-sheet-sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 18px 0 8px;
  color: var(--ag-fg-2);
  font-size: 13px;
  font-weight: 600;
}

.ag-sheet-count {
  color: var(--ag-fg-4);
  font-weight: 400;
}

.ag-sheet-flag {
  padding: 0 6px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--ag-warning) 12%, transparent);
  color: var(--ag-warning);
  font-size: 12px;
  font-weight: 500;
}

.ag-sheet-table {
  overflow-x: auto;
  border: 1px solid var(--ag-card-border);
  border-radius: 10px;
}

.ag-sheet-table + .ag-sheet-table {
  margin-top: 10px;
}

.ag-sheet-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 19px;
}

.ag-sheet-table :is(th, td) {
  padding: 8px 12px;
  border-bottom: 1px solid var(--ag-divider-subtle);
  text-align: left;
  vertical-align: top;
}

.ag-sheet-table thead th {
  background: var(--ag-code-bg);
  color: var(--ag-fg-2);
  font-weight: 500;
  white-space: nowrap;
}

.ag-sheet-table tbody th {
  width: 140px;
  color: var(--ag-fg-2);
  font-weight: 500;
  white-space: nowrap;
}

.ag-sheet-table tr:last-child :is(th, td) {
  border-bottom: 0;
}

.ag-sheet-table tr.is-over td {
  background: var(--ag-danger-bg);
}

.ag-sheet-table .is-num {
  width: 1%;
  text-align: right;
  white-space: nowrap;
}

.ag-sheet-table .is-muted {
  color: var(--ag-fg-3);
}

.is-url {
  font-family: var(--ag-font-mono);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.is-mono {
  font-family: var(--ag-font-mono);
  font-size: 12px;
}

.ag-sheet-none {
  margin: 0;
  color: var(--ag-fg-3);
  font-size: 13px;
}

.ag-sheet-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-sheet-chips li {
  padding: 2px 8px;
  border: 1px solid var(--ag-tab-border);
  border-radius: 6px;
  background: var(--ag-tab-bg);
  color: var(--ag-fg-1b);
  font-size: 12px;
}

.ag-sheet-ad {
  margin-top: 8px;
}

.ag-sheet-path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 10px 0 0;
  color: var(--ag-fg-1b);
  font-size: 13px;
}

.ag-sheet-path-label {
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 500;
}

:deep(.ag-len) {
  color: var(--ag-fg-3);
  font-size: 12px;
  white-space: nowrap;
}

:deep(.ag-len.is-block) {
  display: block;
  margin-top: 2px;
}

:deep(.ag-len.is-over) {
  color: var(--ag-danger);
  font-weight: 600;
}
</style>
