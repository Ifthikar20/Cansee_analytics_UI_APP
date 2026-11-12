<script setup>
// The AI crawlers and what the project's robots.txt lets each one do
// (p2_contract.md 5a, 5d): bots grouped by operator, with the rule that
// applies, the home page's access, how many audited pages it may not read
// and whether the operator says the bot follows robots.txt.
import { computed, useId } from 'vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { botGroups } from '@/lib/analytics/siteSpecs'

const props = defineProps({
  // The crawler-access payload (contract 5d).
  payload: { type: Object, default: null },
  title: { type: String, default: 'AI crawlers' },
})

const groups = computed(() => botGroups(props.payload))
const titleId = useId()
</script>

<template>
  <section class="bat" :aria-labelledby="titleId">
    <h3 :id="titleId" class="bat-title">{{ title }}</h3>
    <TooltipProvider :delay-duration="150">
      <div class="bat-scroll" tabindex="0" role="region" :aria-label="`${title}, scrolls sideways`">
        <table class="bat-table">
          <caption class="sr-only">{{ title }}</caption>
          <thead>
            <tr>
              <th scope="col">Bot</th>
              <th scope="col">Purpose</th>
              <th scope="col">robots.txt rule</th>
              <th scope="col">Home page</th>
              <th scope="col" class="is-num">Pages blocked</th>
              <th scope="col">Follows robots.txt</th>
            </tr>
          </thead>
          <tbody v-for="group in groups" :key="group.operator">
            <tr class="bat-group">
              <th scope="colgroup" colspan="6">{{ group.operator }}</th>
            </tr>
            <tr v-for="row in group.rows" :key="row.key">
              <th scope="row" class="bat-token">{{ row.token }}</th>
              <td>{{ row.purpose }}</td>
              <td class="bat-rule">{{ row.rule }}</td>
              <td :class="{ 'is-blocked': row.homeState === 'blocked' || row.homeState === 'blocked_unreachable' }">{{ row.home }}</td>
              <td class="is-num">{{ row.blocked }}</td>
              <td>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button type="button" class="bat-follows">{{ row.follows }}</button>
                  </TooltipTrigger>
                  <TooltipContent side="top" class="max-w-72 whitespace-normal leading-relaxed">{{ row.followsNote }}</TooltipContent>
                </Tooltip>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  </section>
</template>

<style scoped>
.bat {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}

.bat-title {
  color: var(--foreground);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.bat-scroll {
  overflow-x: auto;
}

.bat-scroll:focus-visible {
  border-radius: var(--radius);
}

.bat-table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: 13px;
}

.bat-table th,
.bat-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  text-align: left;
  vertical-align: top;
}

.bat-table thead th {
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 500;
}

.bat-group th {
  padding-top: 14px;
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.bat-token {
  font-weight: 500;
  white-space: nowrap;
}

.bat-rule {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
}

.is-blocked {
  font-weight: 600;
}

.is-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.bat-table th.is-num {
  text-align: right;
}

.bat-follows {
  padding: 0;
  border: 0;
  border-bottom: 1px dotted var(--muted-foreground);
  background: none;
  color: inherit;
  font: inherit;
  cursor: help;
}

.bat-follows:focus-visible {
  border-radius: var(--radius);
}
</style>
