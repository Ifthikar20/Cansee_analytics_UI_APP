<template>
  <InfoPage
    title="What we track"
    eyebrow="Transparency"
    intro="Everything our pixel and platform collect, why we collect it, how long we keep it, and the legal basis. Built so our customers can paste this into their own privacy policies without surprises."
    updated="June 5, 2026"
  >
    <div class="wt-callout">
      <strong>For our customers (data controllers):</strong> if you install Cansee on a site that
      serves visitors in the EU, UK, Brazil, California, or Canada, you are responsible for obtaining
      visitor consent before our pixel fires. Wire your CMP's "analytics accepted" event to
      <code>window._fb &amp;&amp; window._fb.track</code> or load the script tag only after consent.
      Our pixel also honors <code>navigator.doNotTrack</code> and the Global Privacy Control signal
      automatically.
    </div>

    <h2>1. What the pixel collects (per event)</h2>
    <p>
      Every event our pixel sends to <code>cansee.ai/api/v1/track/event/</code> contains the
      following fields. We do not collect anything beyond what is in this list.
    </p>

    <div class="wt-table-wrap">
      <table class="wt-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Example</th>
            <th>Personal data?</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in pixelFields" :key="f.field">
            <td><code>{{ f.field }}</code></td>
            <td class="wt-example">{{ f.example }}</td>
            <td>
              <span class="wt-tag" :class="'wt-tag-' + f.tag">{{ f.tagLabel }}</span>
            </td>
            <td>{{ f.purpose }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2>2. What the server derives or adds</h2>
    <p>
      A few fields are computed server-side from the request itself, not sent by the pixel. These
      never leave the Cansee platform and are not shared with sub-processors beyond what each
      sub-processor strictly needs.
    </p>

    <div class="wt-table-wrap">
      <table class="wt-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>How we get it</th>
            <th>Personal data?</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in serverFields" :key="f.field">
            <td><code>{{ f.field }}</code></td>
            <td>{{ f.source }}</td>
            <td>
              <span class="wt-tag" :class="'wt-tag-' + f.tag">{{ f.tagLabel }}</span>
            </td>
            <td>{{ f.purpose }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h2>3. What we explicitly do not collect</h2>
    <ul>
      <li>Raw IP addresses. Only a salted hash is stored, used for abuse detection.</li>
      <li>Mouse-movement traces, keystrokes, or session replays of any kind.</li>
      <li>Cross-site identifiers. The visitor fingerprint is derived only from properties the
        visitor's browser exposes to any website they visit and is not joined to data from other
        sites.</li>
      <li>Health, biometric, sexual-orientation, religious, or other GDPR Article 9 "special
        category" data. If our pixel happens to be installed on a page whose URL or form values
        contain such data, the page owner is responsible for excluding those fields client-side
        before the pixel sees them.</li>
      <li>Form input values. We only capture form <em>id</em> and <em>action</em>, never the
        fields a user typed.</li>
    </ul>

    <h2>4. Retention</h2>
    <p>
      Each category below is deleted on a nightly schedule once it passes its window. Deletion is
      permanent and the data cannot be recovered. The analytics window is also enforced at the read
      API, so the event log never returns rows older than the retention period.
    </p>
    <ul>
      <li><strong>Analytics events</strong> (the table in section 1) — 180 days. Covers page
        events, sessions and link clicks.</li>
      <li><strong>Visitor records</strong> (the salted fingerprint, hashed IP and country) — 180
        days from the last time that visitor was seen, so a profile never outlives the events that
        justified keeping it.</li>
      <li><strong>Dashboard access logs</strong> (which account opened which report, and when) —
        90 days. A shorter window because this is a security trail rather than product data. The
        record links to the account, not to a copy of your details: it holds no email address, IP
        address or user agent, so deleting an account removes it from this trail entirely.</li>
      <li><strong>Stored AI answers and citations</strong> — 24 months, so you can show what a model
        said about you on a given date. Shorter where a provider's terms require it.</li>
      <li><strong>Brand-security findings</strong> — 24 months.</li>
    </ul>
    <p>
      Account data — your name, email, and the websites you have registered — is retained for the
      lifetime of your account plus a 30-day grace period after cancellation, so you can recover an
      account closed in error.
    </p>

    <h2>5. Sub-processors</h2>
    <p>
      We use the following sub-processors. Each is bound by a written data-processing agreement
      and processes the categories of data listed.
    </p>
    <ul>
      <li><strong>AWS</strong> (us-east-1) — hosting, database, object storage.</li>
      <li><strong>Cloudflare</strong> — CDN, DNS and web application firewall in front of the
        application. Where you connect your own Cloudflare zone, we read its analytics with the
        API token you supply; those metrics are cached briefly and never written to our database.</li>
      <li><strong>Anthropic, OpenAI, Google, Perplexity, xAI</strong> — LLM API calls for the
        prompt-scanning feature. We do <strong>not</strong> send any visitor-pixel data to these
        providers, only the prompts and brand context the customer has configured.</li>
      <li><strong>Postmark</strong> — transactional email (sign-up confirmations, scan summaries).</li>
      <li><strong>Polar</strong> — billing and subscription management.</li>
    </ul>
    <p>
      A current list of sub-processors and the safeguards in place for each is maintained in the
      <router-link to="/dpa">Data Processing Agreement</router-link>.
    </p>

    <h2>6. Legal bases (GDPR Article 6)</h2>
    <ul>
      <li><strong>Account data:</strong> contract (Art. 6(1)(b)) — we need this to deliver the
        service the customer has signed up for.</li>
      <li><strong>Pixel-collected analytics:</strong> consent of the visitor (Art. 6(1)(a)),
        obtained by the customer through their own cookie/consent flow.</li>
      <li><strong>Abuse detection and rate-limit logs:</strong> legitimate interest (Art. 6(1)(f)),
        balanced against the visitor's right to use the customer's site without interference.</li>
    </ul>

    <h2>7. Your visitors' rights</h2>
    <p>
      Visitors of customer sites have the right to access, correct, delete, or export the data we
      hold about them, and to withdraw consent at any time. Because we are a processor and don't
      hold the visitor relationship directly, requests should be made to the customer in the
      first instance. If a customer forwards a request to us, we will action it within 30 days.
    </p>
    <p>
      Customers can also invoke <code>window._fb &amp;&amp; window._fb.track</code> with a
      <code>delete</code> event referencing a fingerprint to flag a visitor for purge across the
      retention window.
    </p>

    <h2>8. Changes</h2>
    <p>
      Material changes to what we collect are announced at least 14 days in advance via email to
      account owners and at the top of this page.
    </p>

    <h2>9. Cookies and storage on cansee.ai</h2>
    <p>
      This is every cookie and browser-storage key the Cansee application itself sets. There are
      no third-party advertising or analytics trackers on cansee.ai.
    </p>

    <div class="wt-table-wrap">
      <table class="wt-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Category</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in cookieInventory" :key="c.name">
            <td><code>{{ c.name }}</code></td>
            <td>{{ c.type }}</td>
            <td>
              <span class="wt-tag" :class="'wt-tag-' + c.tag">{{ c.category }}</span>
            </td>
            <td>{{ c.purpose }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <template v-if="cookiebotConfigured">
      <p>
        Consent on cansee.ai is managed by Cookiebot (Usercentrics). The live, automatically
        scanned declaration below always reflects the current state; you can change your choice at
        any time.
      </p>
      <p>
        <button type="button" class="wt-consent-btn" @click="renewConsent">
          Manage consent preferences
        </button>
      </p>
      <div ref="cookieDeclaration" class="wt-declaration"></div>
    </template>
    <p v-else class="wt-muted">
      The interactive consent manager appears here once Cookiebot is configured for this
      environment.
    </p>

    <p class="wt-footer">
      Questions about anything on this page? Email
      <a :href="`mailto:${PRIVACY_EMAIL}`">{{ PRIVACY_EMAIL }}</a>.
    </p>
  </InfoPage>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import InfoPage from './InfoPage.vue'
import { PRIVACY_EMAIL } from '@/constants/support'

// Cookiebot domain group ID — same variable index.html uses to load the
// consent banner. Empty in environments without a Cookiebot account.
const COOKIEBOT_CBID = import.meta.env.VITE_COOKIEBOT_CBID || ''
const cookiebotConfigured = Boolean(COOKIEBOT_CBID)
const cookieDeclaration = ref(null)

onMounted(() => {
  if (!cookiebotConfigured || !cookieDeclaration.value) return
  // Cookiebot's declaration renderer must be injected where the table
  // should appear; it fills the surrounding element.
  const script = document.createElement('script')
  script.id = 'CookieDeclaration'
  script.src = `https://consent.cookiebot.com/${COOKIEBOT_CBID}/cd.js`
  script.async = true
  cookieDeclaration.value.appendChild(script)
})

function renewConsent() {
  if (window.Cookiebot && typeof window.Cookiebot.renew === 'function') {
    window.Cookiebot.renew()
  }
}

// Everything the app itself puts in the browser. tag scheme mirrors the
// tables above: none = not personal data, weak = could contribute.
const cookieInventory = [
  { name: 'sessionid',        type: 'Cookie (HttpOnly, Secure)', tag: 'none', category: 'Necessary',  purpose: 'Keeps you signed in to the Cansee dashboard for up to 30 days.' },
  { name: 'csrftoken',        type: 'Cookie (Secure)',           tag: 'none', category: 'Necessary',  purpose: 'Protects forms and API calls against cross-site request forgery.' },
  { name: 'CookieConsent',    type: 'Cookie',                    tag: 'none', category: 'Necessary',  purpose: 'Stores your cookie-consent choice (set by Cookiebot once configured).' },
  { name: 'cs-access',        type: 'localStorage',              tag: 'none', category: 'Necessary',  purpose: 'Your login token for API requests from the browser.' },
  { name: 'cs-theme',         type: 'localStorage',              tag: 'none', category: 'Preferences', purpose: 'Remembers light/dark mode.' },
  { name: 'cs_ov_cards_*',   type: 'localStorage',              tag: 'none', category: 'Preferences', purpose: 'Remembers which dashboard cards you chose to show.' },
  { name: 'cs-analytics',     type: 'sessionStorage',            tag: 'none', category: 'Necessary',  purpose: 'Caches dashboard data for the current tab so navigation feels instant. Cleared when the tab closes.' },
  { name: 'cs_consent',       type: 'localStorage (customer sites only)', tag: 'none', category: 'Necessary', purpose: 'On sites running the Cansee pixel: records whether the visitor consented to analytics. The pixel does not run without it.' },
]

// Tag scheme:
//   none = aggregate / non-identifying
//   weak = could contribute to identification when combined
//   pii  = personally identifiable on its own
const pixelFields = [
  { field: 'pixel_key',         example: 'a4b1...e802',                                       tag: 'none', tagLabel: 'No',   purpose: 'Identifies the customer website the event belongs to.' },
  { field: 'event_type',        example: 'pageview',                                          tag: 'none', tagLabel: 'No',   purpose: 'pageview / click / scroll / form_submit / session_end.' },
  { field: 'url',               example: 'https://outfi.ai/cart',                             tag: 'weak', tagLabel: 'Weak', purpose: 'Top pages, funnel steps, entry/exit.' },
  { field: 'referrer',          example: 'https://google.com/',                               tag: 'weak', tagLabel: 'Weak', purpose: 'Traffic-source attribution.' },
  { field: 'timestamp',         example: '2026-06-05T14:32:11.092Z',                          tag: 'none', tagLabel: 'No',   purpose: 'Time-bucketed charts and ordering.' },
  { field: 'user_agent',        example: 'Mozilla/5.0 ... Chrome/126.0',                      tag: 'weak', tagLabel: 'Weak', purpose: 'Browser and OS breakdown.' },
  { field: 'screen_width, screen_height', example: '2560 × 1440',                              tag: 'weak', tagLabel: 'Weak', purpose: 'Device-class detection.' },
  { field: 'viewport_width, viewport_height', example: '1280 × 800',                           tag: 'weak', tagLabel: 'Weak', purpose: 'Responsive-design diagnostics.' },
  { field: 'language',          example: 'en-US',                                             tag: 'weak', tagLabel: 'Weak', purpose: 'Locale breakdown.' },
  { field: 'fingerprint',       example: 'UA | 2560 | 1440 | en-US | -240 | 8',               tag: 'pii',  tagLabel: 'Yes',  purpose: 'Recognize a returning visitor without cookies. Hashed server-side before storage.' },
  { field: 'scroll_depth',      example: '63 (%)',                                            tag: 'none', tagLabel: 'No',   purpose: 'Engagement and content effectiveness.' },
  { field: 'time_on_page_ms',   example: '24310',                                             tag: 'none', tagLabel: 'No',   purpose: 'Engagement and bounce analysis.' },
  { field: 'properties (click)', example: 'element=button, text="Add to cart", href=/checkout', tag: 'weak', tagLabel: 'Weak', purpose: 'Flow diagrams and conversion tracking. Text is capped at 100 chars.' },
  { field: 'properties (form_submit)', example: 'form_id=newsletter, form_action=/subscribe',  tag: 'none', tagLabel: 'No',   purpose: 'Form-conversion tracking. We never capture input values.' },
]

const serverFields = [
  { field: 'ip_hash',     source: 'SHA-256 of the request IP + a per-website salt.',                tag: 'none', tagLabel: 'No',   purpose: 'Abuse detection and bot filtering. Raw IPs are never stored.' },
  { field: 'geo_country', source: 'Looked up from the IP via MaxMind GeoIP, then the IP is discarded.', tag: 'weak', tagLabel: 'Weak', purpose: 'Country breakdown in the analytics dashboard.' },
  { field: 'geo_city',    source: 'Same as geo_country, city-level.',                                tag: 'weak', tagLabel: 'Weak', purpose: 'City breakdown. Customers can disable this in settings.' },
  { field: 'device_type', source: 'Parsed from user_agent (ua-parser).',                              tag: 'none', tagLabel: 'No',   purpose: 'Desktop / mobile / tablet split.' },
  { field: 'browser, os', source: 'Parsed from user_agent.',                                          tag: 'none', tagLabel: 'No',   purpose: 'Browser/OS breakdowns.' },
]
</script>

<style scoped>
.wt-consent-btn {
  padding: 9px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--muted);
  color: var(--foreground);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.wt-consent-btn:hover { background: var(--accent); }
.wt-declaration { margin: 16px 0 8px; }
.wt-muted { color: var(--muted-foreground); font-size: 14px; }

.wt-callout {
  margin: 0 0 32px;
  padding: 16px 20px;
  border-left: 3px solid var(--primary, #ff385c);
  background: color-mix(in srgb, var(--primary, #ff385c) 6%, transparent);
  border-radius: 0 12px 12px 0;
  font-size: 15px;
  line-height: 1.6;
}
.wt-callout strong { color: var(--foreground); font-weight: 700; margin-right: 6px; }
.wt-callout code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  background: var(--muted);
  padding: 1px 5px;
  border-radius: 4px;
}

.wt-table-wrap {
  overflow-x: auto;
  margin: 16px 0 28px;
  border-radius: 12px;
  border: 1px solid var(--border);
}
.wt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  background: var(--card);
}
.wt-table th, .wt-table td {
  padding: 11px 14px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--border);
}
.wt-table th {
  font-weight: 700;
  color: var(--foreground);
  background: var(--muted);
  font-size: 12.5px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.wt-table tbody tr:last-child td { border-bottom: none; }
.wt-table td code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12.5px;
  color: var(--foreground);
}
.wt-table .wt-example {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: var(--muted-foreground);
  max-width: 280px;
  word-break: break-word;
}

.wt-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
}
.wt-tag-none { background: color-mix(in srgb, #16a34a 14%, transparent); color: #15803d; }
.wt-tag-weak { background: color-mix(in srgb, #ca8a04 16%, transparent); color: #a16207; }
.wt-tag-pii  { background: color-mix(in srgb, #dc2626 14%, transparent); color: #b91c1c; }

.wt-footer {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  font-size: 14px;
  color: var(--muted-foreground);
}
</style>
