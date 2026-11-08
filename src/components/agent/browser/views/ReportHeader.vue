<template>
  <header v-if="model" class="ag-rh" :class="{ 'is-sample': sample }" :aria-label="sample ? 'Sample report details' : 'Report details'">
    <p v-if="model.template || sample" class="ag-rh-top">
      <span v-if="model.template" class="ag-rh-template">{{ model.template.name }}</span>
      <span v-if="sample" class="ag-rh-sample">Sample</span>
    </p>
    <dl class="ag-rh-list">
      <div v-if="model.project.name || model.project.host" class="ag-rh-row">
        <dt>Project</dt>
        <dd>
          {{ model.project.name || model.project.host }}
          <span v-if="model.project.name && model.project.host" class="ag-rh-muted">{{ model.project.host }}</span>
        </dd>
      </div>
      <div v-if="model.captured" class="ag-rh-row">
        <dt>Captured</dt>
        <dd>
          <time :datetime="model.capturedAt">{{ model.captured }}</time>
        </dd>
      </div>
      <div v-if="model.data.length" class="ag-rh-row">
        <dt>Data</dt>
        <dd>
          <ul class="ag-rh-items">
            <li v-for="d in model.data" :key="d.key || d.label">{{ d.text }}</li>
          </ul>
        </dd>
      </div>
      <div v-if="model.engines.length" class="ag-rh-row">
        <dt>Engines</dt>
        <dd>
          <ul class="ag-rh-engines">
            <li v-for="e in model.engines" :key="e.key" class="ag-rh-engine" :class="`is-${e.status}`">
              {{ e.label }}<span class="ag-rh-sep">: </span><span class="ag-rh-status">{{ e.statusText }}</span>
            </li>
          </ul>
        </dd>
      </div>
      <div v-if="model.locations.length" class="ag-rh-row">
        <dt>{{ model.locations.length === 1 ? 'Location' : 'Locations' }}</dt>
        <dd>{{ model.locations.join(', ') }}</dd>
      </div>
      <div v-if="model.prompts.length" class="ag-rh-row">
        <dt>{{ model.prompts.length === 1 ? 'Prompt' : 'Prompts' }}</dt>
        <dd>
          <ul class="ag-rh-items">
            <li v-for="(p, i) in model.prompts" :key="i">
              "{{ p.text }}"<template v-if="p.location">{{ ' ' }}<span class="ag-rh-muted">{{ p.location }}</span></template>
            </li>
          </ul>
        </dd>
      </div>
      <div v-if="model.competitors.length" class="ag-rh-row">
        <dt>Competitors</dt>
        <dd>
          <ul class="ag-rh-items">
            <li v-for="(c, i) in model.competitors" :key="i">
              {{ c.name
              }}<template v-if="c.domain && c.domain !== c.name">{{ ' ' }}<span class="ag-rh-muted">{{ c.domain }}</span></template>
            </li>
          </ul>
        </dd>
      </div>
      <div v-if="model.compared" class="ag-rh-row">
        <dt>Compared</dt>
        <dd>{{ model.compared }}</dd>
      </div>
    </dl>
  </header>
</template>

<script setup>
// The structured header of a saved report (version data.header): the
// template, project, capture date, data windows, each engine's status,
// locations and, per template, the prompts, competitors or the runs
// compared. Renders nothing for a report saved before headers existed.
// Plain markup, so the HTML export and print keep it without these styles.
// `sample` marks the gallery previews, which show made-up values.
import { computed } from 'vue'
import { headerModel } from '@/lib/agent/reportHeader'

const props = defineProps({
  header: { type: Object, default: null },
  // data.template; wins over header.template.id.
  template: { type: String, default: null },
  sample: { type: Boolean, default: false },
})

const model = computed(() => headerModel(props.header, props.template))
</script>

<style scoped>
.ag-rh {
  box-sizing: border-box;
  max-width: 720px;
  margin: 0 auto 24px;
  padding: 14px 16px;
  border: 1px solid var(--ag-card-border);
  border-radius: 12px;
  background: transparent;
  color: var(--ag-fg-1);
  font-size: 13px;
  line-height: 19px;
}

.ag-rh-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin: 0 0 10px;
}

.ag-rh-template {
  color: var(--ag-fg-1);
  font-size: 14px;
  font-weight: 600;
}

.ag-rh-sample {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border: 1px solid var(--ag-tab-border);
  border-radius: 6px;
  background: var(--ag-tab-bg);
  color: var(--ag-fg-2);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.ag-rh-list {
  display: grid;
  gap: 6px;
  margin: 0;
}

.ag-rh-row {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 12px;
}

.ag-rh-row dt {
  color: var(--ag-fg-3);
  font-weight: 500;
}

.ag-rh-row dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.ag-rh-muted {
  color: var(--ag-fg-3);
}

.ag-rh-items {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-rh-engines {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-rh-engine .ag-rh-status {
  color: var(--ag-fg-2);
}

.ag-rh-engine:is(.is-not_configured, .is-failed, .is-not_selected, .is-not_asked) .ag-rh-status {
  color: var(--ag-fg-3);
}

@media (max-width: 520px) {
  .ag-rh-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
}
</style>
