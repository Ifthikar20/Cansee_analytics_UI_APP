<script>
// The Analytics side of the sidebar: the 14 tabs of lib/analyticsNav.js in
// their four groups, with the agent sections' row look. Each group label is
// a plain heading above its list. Tabs addressed by a project render
// disabled without one (the Overview follows the active project).
//
// Icons resolve through this explicit map of named imports, never
// `import * as` from @lucide/vue, which would put every icon in the bundle.
import {
  BadgeCheck,
  Bot,
  ChartLine,
  Eye,
  FileText,
  GitBranch,
  Globe,
  LayoutDashboard,
  Lightbulb,
  MousePointerClick,
  Quote,
  ShoppingBag,
  Smile,
  Swords,
} from '@lucide/vue'

export const SECTION_ICONS = Object.freeze({
  BadgeCheck,
  Bot,
  ChartLine,
  Eye,
  FileText,
  GitBranch,
  Globe,
  LayoutDashboard,
  Lightbulb,
  MousePointerClick,
  Quote,
  ShoppingBag,
  Smile,
  Swords,
})
</script>

<script setup>
import { computed, useId } from 'vue'
import { useRoute } from 'vue-router'
import { analyticsSectionOf, sectionRoute, sectionsByGroup } from '@/lib/analyticsNav'

const props = defineProps({
  websiteId: { type: String, default: null },
})

const route = useRoute()
const idPrefix = useId()

const current = computed(() => route.meta?.analytics || analyticsSectionOf(route.name))

const groups = computed(() =>
  sectionsByGroup().map((group) => ({
    key: group.key,
    label: group.label,
    headingId: `${idPrefix}-${group.key}`,
    items: group.sections.map((s) => ({
      key: s.key,
      label: s.label,
      icon: SECTION_ICONS[s.icon] || FileText,
      to: sectionRoute(s.key, props.websiteId),
      active: s.key === current.value,
    })),
  })),
)
</script>

<template>
  <div class="ag-an" role="group" aria-label="Analytics">
    <template v-for="group in groups" :key="group.key">
      <p :id="group.headingId" class="ag-an-group">{{ group.label }}</p>
      <ul class="ag-nav" role="list" :aria-labelledby="group.headingId">
        <li v-for="item in group.items" :key="item.key">
          <router-link
            v-if="item.to"
            :to="item.to"
            class="ag-nav-row"
            :class="{ 'is-active': item.active }"
            :aria-current="item.active ? 'page' : undefined"
          >
            <component :is="item.icon" class="ag-nav-icon" :size="16" aria-hidden="true" />
            <span class="ag-nav-label">{{ item.label }}</span>
          </router-link>
          <span v-else class="ag-nav-row is-disabled" aria-disabled="true">
            <component :is="item.icon" class="ag-nav-icon" :size="16" aria-hidden="true" />
            <span class="ag-nav-label">{{ item.label }}</span>
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.ag-an {
  display: flex;
  flex: 1 0 auto;
  flex-direction: column;
}

.ag-an-group {
  margin: 16px 8px 4px;
  color: var(--ag-fg-3);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

/* Rows: the SidebarNav look. */
.ag-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-nav-row {
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  height: 34px;
  padding: 0 8px;
  border-radius: 8px;
  color: var(--ag-fg-2);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-decoration: none;
  transition: background-color 120ms ease, color 120ms ease;
  -webkit-tap-highlight-color: transparent;
}

a.ag-nav-row:hover {
  background: var(--ag-row-hover);
  color: var(--ag-fg-1);
  opacity: 1;
}

.ag-nav-row.is-active {
  background: var(--ag-row-active);
  color: var(--ag-fg-1);
}

.ag-nav-row.is-disabled {
  color: var(--ag-fg-disabled);
  cursor: default;
}

.ag-nav-row:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--ag-ring);
  outline-offset: -2px;
}

.ag-nav-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.ag-nav-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
