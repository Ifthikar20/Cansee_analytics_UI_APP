<template>
  <div class="ss fade-in" @keydown.esc="open = false">
    <!-- Breadcrumb heading: parent is a link back to settings, current section is plain -->
    <nav class="ss-crumb" aria-label="Breadcrumb">
      <router-link to="/settings" class="ss-crumb-parent">Settings</router-link>
      <span class="ss-crumb-sep" aria-hidden="true">&rsaquo;</span>
      <span class="ss-crumb-current">{{ activeLabel }}</span>
    </nav>

    <div class="ss-cols">
      <!-- Desktop: grouped nav column on the left, content on the right.
           The heading spans both; the column is aligned to its left edge. -->
      <aside class="ss-nav" aria-label="Settings sections">
        <template v-for="group in NAV" :key="group.label">
          <p class="ss-nav-group">{{ group.label }}</p>
          <router-link
            v-for="item in visibleItems(group)" :key="item.key"
            :to="item.to"
            class="ss-nav-item"
            :class="{ 'is-active': active === item.key }"
            :aria-current="active === item.key ? 'page' : null"
          >
            <NavIcon :paths="item.icon" :size="16" class="ss-nav-icon" />
            <span>{{ item.label }}</span>
          </router-link>
        </template>
      </aside>

      <div class="ss-content">
        <!-- Narrow screens: the column condenses into one bordered row
             showing the current section; tapping it unfolds the grouped
             list in place, and picking a section folds it back up. -->
        <div class="ss-switch" :class="{ 'is-open': open }">
          <button
            type="button"
            class="ss-switch-row"
            :aria-expanded="open ? 'true' : 'false'"
            aria-controls="settings-section-menu"
            @click="open = !open"
          >
            <NavIcon :paths="activeItem.icon" :size="18" class="ss-switch-icon" />
            <span class="ss-switch-label">{{ activeLabel }}</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              class="ss-switch-chevron" aria-hidden="true"
            ><path d="m6 9 6 6 6-6" /></svg>
          </button>

          <div v-if="open" id="settings-section-menu" class="ss-switch-menu">
            <template v-for="group in NAV" :key="group.label">
              <p class="ss-nav-group">{{ group.label }}</p>
              <router-link
                v-for="item in visibleItems(group)" :key="item.key"
                :to="item.to"
                class="ss-nav-item"
                :class="{ 'is-active': active === item.key }"
                :aria-current="active === item.key ? 'page' : null"
              >
                <NavIcon :paths="item.icon" :size="16" class="ss-nav-icon" />
                <span>{{ item.label }}</span>
              </router-link>
            </template>
          </div>
        </div>

        <div class="ss-body">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, h, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  /** Key of the active nav item: account | subscription | notifications | project | connections | brand-facts | usage | command-center | appearance | contact | team | domains */
  active: { type: String, required: true },
})

const authStore = useAuthStore()

/* Tiny functional icon: stroke paths only, inherits currentColor. */
const NavIcon = (p) =>
  h(
    'svg',
    {
      width: p.size || 16, height: p.size || 16, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', 'stroke-width': 1.8,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    },
    (p.paths || []).map((d) => h('path', { d })),
  )
NavIcon.props = { paths: Array, size: Number }

const NAV_BASE = [
  {
    label: 'General',
    items: [
      {
        key: 'account', label: 'Account',
        to: { path: '/settings', query: { section: 'account' } },
        icon: [
          'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
          'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
        ],
      },
      {
        key: 'subscription', label: 'Subscription',
        to: { path: '/billing' },
        icon: [
          'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
          'M2 10h20',
        ],
      },
      {
        key: 'notifications', label: 'Notifications',
        to: { path: '/settings', query: { section: 'notifications' } },
        icon: [
          'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9',
          'M13.7 21a2 2 0 0 1-3.4 0',
        ],
      },
    ],
  },
  {
    // The active project's own settings. These pages read the project
    // from the header switcher (appStore.activeWebsite).
    label: 'Project',
    items: [
      {
        key: 'project', label: 'Project',
        to: { path: '/settings/project' },
        icon: [
          'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
          'M2 12h20',
          'M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z',
        ],
      },
      {
        key: 'connections', label: 'Connections',
        to: { path: '/settings/connections' },
        icon: ['M9 2v6', 'M15 2v6', 'M6 8h12v4a6 6 0 0 1-12 0z', 'M12 18v4'],
      },
      {
        key: 'brand-facts', label: 'Brand facts',
        to: { path: '/settings/brand-facts' },
        icon: [
          'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
          'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
        ],
      },
    ],
  },
  {
    label: 'Application',
    items: [
      {
        key: 'usage', label: 'AI Usage',
        to: { path: '/settings', query: { section: 'usage' } },
        icon: ['M22 12h-4l-3 9L9 3l-3 9H2'],
      },
      {
        key: 'command-center', label: 'Usage dashboard',
        to: { name: 'settings-command-center' },
        icon: ['m12 14 4-4', 'M3.34 19a10 10 0 1 1 17.32 0'],
      },
      {
        key: 'appearance', label: 'Appearance',
        to: { path: '/settings', query: { section: 'appearance' } },
        icon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
      },
    ],
  },
  {
    label: 'Support',
    items: [
      {
        key: 'contact', label: 'Contact us',
        to: { path: '/settings', query: { section: 'contact' } },
        icon: [
          'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
          'm22 6-10 7L2 6',
        ],
      },
    ],
  },
]

// Organization sections appear only when the session belongs to an org.
// The "Domains & SSO" entry stays in the tree for every member (so the
// breadcrumb resolves on a deep link) but is hidden from the nav lists
// for non-admins via its `hidden` flag.
const NAV = computed(() => {
  if (!authStore.org) return NAV_BASE
  const orgGroup = {
    label: 'Organization',
    items: [
      {
        key: 'team', label: 'Team',
        to: { path: '/settings', query: { section: 'team' } },
        icon: [
          'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
          'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
          'M23 21v-2a4 4 0 0 0-3-3.87',
          'M16 3.13a4 4 0 0 1 0 7.75',
        ],
      },
      {
        key: 'domains', label: 'Domains & SSO',
        to: { path: '/settings', query: { section: 'domains' } },
        hidden: !authStore.isOrgAdmin,
        icon: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
      },
    ],
  }
  // After General, before Application.
  return [NAV_BASE[0], orgGroup, ...NAV_BASE.slice(1)]
})

function visibleItems(group) {
  return group.items.filter((i) => !i.hidden)
}

const FLAT = computed(() => NAV.value.flatMap((g) => g.items))

const activeItem = computed(
  () => FLAT.value.find((i) => i.key === props.active) || FLAT.value[0],
)
const activeLabel = computed(() => activeItem.value.label)

/* The narrow-screen switcher folds back up on any navigation. */
const open = ref(false)
const route = useRoute()
watch(() => route.fullPath, () => { open.value = false })
</script>

<style scoped>
/* ── Page frame ── */
.ss {
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: 28px 20px 96px;
}
@media (min-width: 640px) {
  .ss { padding: 32px 32px 96px; }
}

/* ── Breadcrumb heading ── */
.ss-crumb {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 24px;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.2;
}
@media (min-width: 768px) {
  .ss-crumb { margin-bottom: 40px; }
}
.ss-crumb-parent {
  color: var(--muted-foreground);
  opacity: 0.7;
  font-weight: 600;
  transition: color 150ms ease, opacity 150ms ease;
}
.ss-crumb-parent:hover { color: var(--foreground); opacity: 1; }
.ss-crumb-sep { color: var(--muted-foreground); opacity: 0.5; user-select: none; }
.ss-crumb-current { color: var(--foreground); }

/* ── Two columns on desktop, one below it ── */
.ss-cols {
  display: flex;
  flex-direction: column;
}
@media (min-width: 768px) {
  .ss-cols {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    gap: 56px;
  }
}

.ss-nav { display: none; }
@media (min-width: 768px) {
  .ss-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: none;
    width: 188px;
  }
}

.ss-content {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
}
@media (min-width: 768px) {
  .ss-content { max-width: 620px; }
}

/* ── Nav items (shared by the desktop column and the narrow menu) ── */
.ss-nav-group {
  margin: 0;
  padding: 22px 10px 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  user-select: none;
}
.ss-nav-group:first-child { padding-top: 4px; }

.ss-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--foreground);
  opacity: 0.82;
  transition: background-color 120ms ease, opacity 120ms ease;
}
.ss-nav-item:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--muted) 65%, transparent);
}
.ss-nav-item.is-active {
  opacity: 1;
  background: var(--muted);
}
.ss-nav-icon { flex: none; color: var(--muted-foreground); }

/* ── Narrow-screen switcher ── */
.ss-switch {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  margin: 0 0 28px;
}
@media (min-width: 768px) {
  .ss-switch { display: none; }
}
.ss-switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 6px;
  background: none;
  border: 0;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--foreground);
  text-align: left;
  cursor: pointer;
  border-radius: 10px;
}
.ss-switch-icon { flex: none; color: var(--muted-foreground); }
.ss-switch-label { flex: 1; min-width: 0; }
.ss-switch-chevron {
  flex: none;
  color: var(--muted-foreground);
  transition: transform 200ms ease;
}
.is-open .ss-switch-chevron { transform: rotate(180deg); }
.ss-switch-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 0 14px;
}

/* ── Content column ── */
.ss-body {
  display: flex;
  flex-direction: column;
  gap: 36px;
}
</style>
