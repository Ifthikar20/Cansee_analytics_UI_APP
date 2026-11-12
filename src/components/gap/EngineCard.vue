<template>
  <article class="ec" :class="{ 'is-empty': !engine.answers }">
    <header class="ec-head">
      <span class="ec-name">
        <span class="ec-dot" :style="{ background: meta.color }" aria-hidden="true"></span>
        {{ meta.label }}
      </span>
      <GapBadge v-if="engine.answers" :cls="engine.class" />
    </header>

    <template v-if="engine.answers">
      <!-- The big figure is the latest answer; the line under it (and the
           gap badge) cover the last few answers, which can disagree. -->
      <div class="ec-rank">
        <span class="ec-rank-caption">Latest answer</span>
        <span class="ec-rank-value" :class="{ 'is-missing': !engine.mentioned }">
          {{ engine.mentioned ? (engine.rank ? `#${engine.rank}` : 'Named') : 'Not named' }}
        </span>
        <span class="ec-rank-meta">
          Named in {{ engine.visibility_pct }}% of the last {{ engine.answers }} {{ engine.answers === 1 ? 'answer' : 'answers' }}
          <template v-if="engine.sentiment"> · {{ engine.sentiment }}</template>
        </span>
      </div>

      <blockquote v-if="engine.snippet" class="ec-quote">{{ engine.snippet }}</blockquote>

      <div v-if="engine.brands_above?.length" class="ec-block">
        <h4 class="ec-sub">{{ engine.mentioned ? 'Listed above you' : 'Recommended instead' }}</h4>
        <div class="ec-brands">
          <span v-for="b in engine.brands_above" :key="b.name" class="ec-brand">
            <span v-if="b.position" class="ec-brand-pos">#{{ b.position }}</span>{{ b.name }}
          </span>
        </div>
      </div>

      <div v-if="engine.citations?.length" class="ec-block">
        <h4 class="ec-sub">Pages it cited</h4>
        <ul class="ec-cites">
          <li v-for="c in engine.citations" :key="c.url">
            <a :href="c.url" target="_blank" rel="noopener" :title="c.url">{{ c.domain }}{{ pathOf(c.url) }}</a>
            <span v-if="c.is_yours" class="ec-yours">Yours</span>
          </li>
        </ul>
      </div>

      <button v-if="engine.latest_result_public_id" type="button" class="ec-open" @click="emit('read', engine)">
        Read the full answer
      </button>
    </template>

    <p v-else class="ec-empty">
      {{ engine.configured ? 'No answers yet. Use Check now to ask this engine.' : "This engine isn't available yet." }}
    </p>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import GapBadge from '@/components/gap/GapBadge.vue'
import { engineMeta } from '@/lib/engines'

const props = defineProps({
  engine: { type: Object, required: true },
})
const emit = defineEmits(['read'])

const meta = computed(() => engineMeta(props.engine.key))

function pathOf(url) {
  try {
    const path = new URL(url).pathname.replace(/\/$/, '')
    return path.length > 32 ? `${path.slice(0, 30)}...` : path
  } catch {
    return ''
  }
}
</script>

<style scoped>
.ec {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}

.ec.is-empty {
  background: transparent;
  border-style: dashed;
}

.ec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ec-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--foreground);
  font-size: 14.5px;
  font-weight: 600;
}

.ec-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.ec-rank {
  display: grid;
  gap: 2px;
}

.ec-rank-caption {
  color: var(--muted-foreground);
  font-size: 11.5px;
  font-weight: 500;
}

.ec-rank-value {
  color: var(--foreground);
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.ec-rank-value.is-missing {
  color: var(--muted-foreground);
  font-size: 22px;
}

.ec-rank-meta {
  color: var(--muted-foreground);
  font-size: 12.5px;
}

.ec-quote {
  margin: 0;
  padding: 10px 12px;
  border-left: 2px solid var(--gap-ai);
  border-radius: 0 var(--radius) var(--radius) 0;
  background: var(--muted);
  color: var(--foreground);
  font-size: 13px;
  line-height: 1.55;
}

.ec-block {
  display: grid;
  gap: 6px;
}

.ec-sub {
  color: var(--muted-foreground);
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.06em;
  font-family: var(--font-mono);
  text-transform: uppercase;
}

.ec-brands {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ec-brand {
  padding: 3px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--foreground);
  font-size: 12px;
}

.ec-brand-pos {
  margin-right: 5px;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
}

.ec-cites {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12.5px;
}

.ec-cites li {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ec-cites a {
  overflow: hidden;
  color: var(--foreground);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ec-yours {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: var(--radius);
  background: var(--gap-ai);
  color: var(--card);
  font-size: 10.5px;
  font-weight: 700;
}

.ec-open {
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--foreground);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.ec-empty {
  color: var(--muted-foreground);
  font-size: 13px;
}
</style>
