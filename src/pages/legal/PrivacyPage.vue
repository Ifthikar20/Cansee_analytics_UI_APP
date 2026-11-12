<template>
  <div class="legal-page min-h-screen bg-background text-foreground">
    <header class="sticky top-0 z-[100] flex items-center justify-between border-b border-border bg-card px-10 py-4 backdrop-blur-md">
      <router-link to="/" class="flex items-center gap-2.5 text-[1.1rem] font-bold text-foreground no-underline">
        <img src="/images/cansee-logo.png" alt="Cansee" style="height:22px;width:auto" />
      </router-link>
      <div class="flex items-center gap-5">
        <router-link to="/terms" class="text-sm font-medium text-muted-foreground no-underline hover:text-foreground">Terms of Service</router-link>
        <Button as="router-link" to="/login" size="sm">Sign In</Button>
      </div>
    </header>

    <main class="legal-content mx-auto max-w-[780px] px-6 pb-20 pt-12 leading-[1.8]">
      <div class="mb-4 flex items-center gap-3">
        <Badge variant="secondary">Legal</Badge>
        <span class="text-sm text-muted-foreground">Effective Date: May 17, 2026</span>
      </div>

      <h1>Privacy Policy</h1>
      <p class="legal-intro">
        Alicorr LLC ("Cansee", "we", "us", or "our"), operator of the Cansee service, respects your privacy. This Privacy
        Policy explains how we collect, use, and protect your information when you use our
        website, dashboard, applications, and APIs (the "Services").
      </p>
      <p class="legal-intro">
        This Policy applies to all Cansee surfaces, including the cansee.ai marketing site,
        the dashboard at cansee.ai/app, the api.cansee.ai API, the Cansee analytics pixel
        embedded on customer websites, and any third-party integrations you connect to your
        Cansee workspace (Google Analytics, Google Search Console, WordPress, Webflow,
        Shopify, HubSpot, Slack, Discord, and Telegram).
      </p>
      <p class="legal-intro">
        By using Cansee, you agree to the practices described in this Privacy Policy.
      </p>

      <div class="legal-toc my-8 rounded-xl bg-muted px-7 py-6">
        <h3>Table of Contents</h3>
        <ol>
          <li><a href="#info-collected">Information We Collect</a></li>
          <li><a href="#how-we-use">How We Use Information</a></li>
          <li><a href="#sharing">Sharing of Information</a></li>
          <li><a href="#subprocessors">Service Providers and Subprocessors</a></li>
          <li><a href="#ai-usage">AI Usage and LLM Providers</a></li>
          <li><a href="#pixel">The Cansee Analytics Pixel</a></li>
          <li><a href="#retention">Data Retention</a></li>
          <li><a href="#security">Security</a></li>
          <li><a href="#rights">Your Rights</a></li>
          <li><a href="#cookies">Cookies and Tracking</a></li>
          <li><a href="#international">International Data Transfers</a></li>
          <li><a href="#children">Children's Privacy</a></li>
          <li><a href="#changes">Changes to This Policy</a></li>
          <li><a href="#contact">Contact</a></li>
        </ol>
      </div>

      <section id="info-collected">
        <h2>1. Information We Collect</h2>

        <h3>(a) Information You Provide</h3>
        <ul>
          <li>Account details (name, email address, password, company name).</li>
          <li>Billing information collected by our payment processor (Polar).</li>
          <li>The URL of the website you want to analyze and any descriptive content you submit during onboarding (business name, industry, description, topics, competitor list).</li>
          <li>Communications you send to us (support requests, bug reports, feedback).</li>
        </ul>

        <h3>(b) Automatically Collected Information</h3>
        <ul>
          <li>Device information (operating system, browser, IP address, approximate region derived from IP).</li>
          <li>Usage data (pages visited, features accessed, clicks, API requests).</li>
          <li>Log data and error reports captured for security, debugging, and reliability.</li>
        </ul>

        <h3>(c) Website Content We Analyze on Your Request</h3>
        <p>
          When you onboard a website, we fetch its publicly accessible pages and supply
          excerpts to the LLM providers listed in Section 4 so we can describe the site,
          extract competitors, and perform prompt runs. We do not log into private areas of your
          site or bypass authentication. We may periodically refresh this content while
          your subscription is active.
        </p>

        <h3>(d) AI-Generated Content</h3>
        <p>
          When you request AI-assisted features (Content Studio briefs, LLM ranking prompt runs,
          competitor extraction, prompt generation), we send the relevant inputs to one or
          more LLM providers and return their outputs to you. Inputs and outputs are stored
          in your account so you can review historical prompt runs.
        </p>
      </section>

      <section id="how-we-use">
        <h2>2. How We Use Information</h2>
        <ul>
          <li>Operate, secure, and improve the Services.</li>
          <li>Perform LLM-visibility prompt runs on your behalf and surface the results in your dashboard.</li>
          <li>Generate content drafts, prompts, and competitor lists at your request.</li>
          <li>Collect website analytics on your behalf through the Cansee pixel (see Section 6).</li>
          <li>Process payments, manage your subscription, and detect fraud.</li>
          <li>Send transactional email (email verification, password reset, security alerts, billing notices).</li>
          <li>Send service email you have opted into (weekly reports, product announcements). Every such email contains a one-click unsubscribe link.</li>
          <li>Comply with legal obligations and enforce our Terms of Service.</li>
        </ul>
        <p><strong>We do not sell your personal information.</strong></p>
      </section>

      <section id="sharing">
        <h2>3. Sharing of Information</h2>
        <p>We share information only as described below:</p>
        <ul>
          <li><strong>Service providers and subprocessors</strong> that operate the platform on our behalf (listed in Section 4). Each receives only the data necessary for its function and is contractually required to process it on our behalf in accordance with applicable law.</li>
          <li><strong>Third-party integrations you choose to connect</strong> (e.g., Google Analytics, Search Console, WordPress, Webflow, Shopify, HubSpot, Slack, Discord, Telegram). Data flows are governed by each provider's own terms.</li>
          <li><strong>Legal disclosures</strong> when required by law, court order, or to protect our rights, users, or the public.</li>
          <li><strong>Corporate transactions</strong>: if Cansee is involved in a merger, acquisition, or asset sale, your information may be transferred subject to this Policy.</li>
        </ul>
        <p>
          We do not share LLM prompt-run data, content briefs, brand vault data, or website
          analytics with advertisers or data brokers.
        </p>
        <p id="sms">
          Mobile numbers and text message consent are used only to send the texts you ask for.
          They are never shared with third parties or affiliates for marketing.
        </p>
      </section>

      <section id="subprocessors">
        <h2>4. Service Providers and Subprocessors</h2>
        <p>
          We rely on the following categories of third-party providers to deliver the
          Services. Each provider receives only the data necessary for its function and is
          contractually required to process it on our behalf.
        </p>
        <ul>
          <li><strong>Hosting and infrastructure</strong>: Amazon Web Services (EC2 compute, S3 object storage), Cloudflare (CDN, DDoS protection, edge TLS).</li>
          <li><strong>Database and queue</strong>: self-managed PostgreSQL and Redis running on AWS.</li>
          <li><strong>LLM providers</strong>: Anthropic (Claude), OpenAI (GPT), Google (Gemini), Perplexity, Meta (Llama), Mistral AI, Cohere, DeepSeek, xAI (Grok), and Amazon (Nova via Bedrock). Each provider receives only the inputs required for the requested prompt run or content generation. See Section 5.</li>
          <li><strong>Payments</strong>: Polar (subscription billing and payment method storage). Cansee never stores full card numbers.</li>
          <li><strong>Email delivery</strong>: Amazon Simple Email Service (SES) for transactional and service email.</li>
          <li><strong>Error monitoring</strong>: Sentry, used only when SENTRY_DSN is configured in production, to correlate client and server errors.</li>
        </ul>
        <p>
          We may add or change subprocessors as the Services evolve. A current list is
          available on request by emailing
          <a href="mailto:privacy@cansee.ai">privacy@cansee.ai</a>.
        </p>
      </section>

      <section id="ai-usage">
        <h2>5. AI Usage and LLM Providers</h2>
        <p>
          Cansee's core feature is querying large language models on your behalf to
          measure how your brand appears in their responses. To do this we send prompts
          containing your business name, industry, topics, and competitor list to the LLM
          providers listed in Section 4. The responses we receive may contain mentions of
          your brand, competitors, and third-party content that we then parse and store in
          your account.
        </p>
        <ul>
          <li>LLM provider APIs we call are governed by each provider's privacy and data-processing terms in addition to this Policy.</li>
          <li>We use API endpoints that, per each provider's published terms, do not use your inputs to train their models. We do not opt in to any provider's training programs.</li>
          <li>AI-generated outputs may be inaccurate or out of date. You are responsible for reviewing AI-generated content before publishing it or relying on it for decisions.</li>
          <li>We may use anonymized or aggregated usage data internally to improve prompts, ranking algorithms, and quality.</li>
        </ul>
      </section>

      <section id="pixel">
        <h2>6. The Cansee Analytics Pixel</h2>
        <p>
          When you install our analytics pixel on a website you own, we collect anonymized
          visitor analytics for that site on your behalf:
        </p>
        <ul>
          <li>Visitor IP addresses (hashed before storage), browser user-agent strings, referrer URLs, and event timestamps.</li>
          <li>Page-view and click events fired by the pixel script.</li>
          <li>UTM and campaign parameters present on the inbound URL.</li>
        </ul>
        <p>
          For pixel data, you (the website operator) are the controller and Cansee is the
          processor. You are responsible for obtaining the consents required by applicable
          law (e.g., GDPR / ePrivacy in the EU, the UK PECR, and CCPA / CPRA in California)
          before activating the pixel on your site, and for surfacing this collection in
          your own privacy policy. A Data Processing Addendum is available on request.
        </p>
      </section>

      <section id="retention">
        <h2>7. Data Retention</h2>
        <ul>
          <li><strong>Active accounts</strong>: we retain account data, prompt-run history, and dashboards for as long as your account is active.</li>
          <li><strong>Account deletion</strong>: you may delete your account at any time. We remove your personal data from our active systems within 30 days. Some data may be retained longer where required by law (e.g., tax records for billing) or for fraud prevention and dispute resolution.</li>
          <li><strong>Server logs</strong>: typically retained for 90 days.</li>
          <li><strong>Backups</strong>: encrypted database backups roll off on a 30-day cycle.</li>
        </ul>
      </section>

      <section id="security">
        <h2>8. Security</h2>
        <p>
          We use reasonable administrative, technical, and physical safeguards to protect
          your information:
        </p>
        <ul>
          <li>TLS 1.2+ for all traffic, enforced by HSTS preload.</li>
          <li>Passwords stored only as salted hashes (Django's default hasher; never plaintext).</li>
          <li>JWT-based session tokens; refresh tokens are HTTP-only cookies blacklisted on logout.</li>
          <li>Brute-force protection on authentication endpoints via rate limiting and account lockout (django-axes).</li>
          <li>Principle-of-least-privilege access to production systems; access is logged and audited.</li>
          <li>Documented incident response. We notify affected users and regulators within 72 hours of confirming a personal-data breach where required by law (GDPR Art. 33).</li>
        </ul>
        <p>
          To report a security issue, email
          <a href="mailto:security@cansee.ai">security@cansee.ai</a>. We investigate every
          report in good faith and ask that you give us a reasonable opportunity to remediate
          before public disclosure.
        </p>
      </section>

      <section id="rights">
        <h2>9. Your Rights</h2>

        <h3>(a) General Rights</h3>
        <ul>
          <li>Access, edit, or delete your account information from your account settings.</li>
          <li>Export your prompt-run history and dashboard data on request.</li>
          <li>Opt out of non-essential email at any time using the unsubscribe link in any such message or by emailing <a href="mailto:privacy@cansee.ai">privacy@cansee.ai</a>.</li>
          <li>Delete your account; your personal data is removed from active systems within 30 days.</li>
        </ul>

        <h3>(b) Rights Under GDPR (EU / EEA / UK Users)</h3>
        <p>If you are located in the European Union, the European Economic Area, or the United Kingdom, you have the following rights:</p>
        <ul>
          <li>Right to access the personal data we hold about you.</li>
          <li>Right to request correction of inaccurate data.</li>
          <li>Right to request erasure of your data.</li>
          <li>Right to restrict or object to processing.</li>
          <li>Right to data portability (export in a structured, machine-readable format).</li>
          <li>Right to withdraw consent where processing is based on consent.</li>
          <li>Right to lodge a complaint with your local supervisory authority.</li>
        </ul>
        <p>To exercise these rights, email <a href="mailto:privacy@cansee.ai">privacy@cansee.ai</a>.</p>

        <h3>(c) Rights Under CCPA / CPRA (California Residents)</h3>
        <p>If you are a California resident, you have the following rights under the California Consumer Privacy Act, as amended by the California Privacy Rights Act:</p>
        <ul>
          <li>Right to know what categories of personal information we collect, the sources of that information, the purposes for which we use it, and the categories of third parties we share it with (described in Sections 1 through 5).</li>
          <li>Right to access a copy of the personal information we hold about you.</li>
          <li>Right to request deletion or correction of your personal information.</li>
          <li>Right to limit the use and disclosure of sensitive personal information.</li>
          <li>Right to opt out of the "sale" or "sharing" of personal information. We do not sell personal information and do not share it for cross-context behavioral advertising.</li>
          <li>Right to non-discrimination for exercising any of these rights.</li>
        </ul>
        <p>To exercise these rights, email <a href="mailto:privacy@cansee.ai">privacy@cansee.ai</a> with the subject line "CCPA Request". We verify requests using account-based authentication and respond within the timeframes required by law.</p>
      </section>

      <section id="cookies">
        <h2>10. Cookies and Tracking</h2>
        <p>Cansee uses cookies and similar technologies to operate the Services and understand how they are used:</p>
        <ul>
          <li><strong>Strictly necessary</strong>: session cookies that keep you signed in (HTTP-only refresh-token cookie), CSRF-protection tokens, and load-balancing cookies set by Cloudflare. These cannot be disabled without breaking the Services.</li>
          <li><strong>Functional</strong>: cookies that remember workspace preferences (active website, theme).</li>
          <li><strong>Error monitoring</strong>: Sentry may set short-lived identifiers to correlate client errors with backend logs.</li>
        </ul>
        <p>
          We do not use third-party advertising cookies and do not participate in
          cross-context behavioral advertising networks. Most browsers let you block or
          delete cookies; doing so may affect Cansee's functionality.
        </p>
      </section>

      <section id="international">
        <h2>11. International Data Transfers</h2>
        <p>
          Cansee is operated from the United States. If you access the Services from
          outside the United States, your information will be transferred to and processed
          in the United States. Where required by law (e.g., transfers out of the EEA or
          UK), we rely on Standard Contractual Clauses or other lawful transfer mechanisms
          with our subprocessors.
        </p>
      </section>

      <section id="children">
        <h2>12. Children's Privacy</h2>
        <p>
          Cansee is a B2B product not directed to children under 13 (or under 16 in the
          EU / EEA / UK), and we do not knowingly collect personal information from such
          children. If you believe we have collected information from a child below the
          applicable age, please email
          <a href="mailto:privacy@cansee.ai">privacy@cansee.ai</a> and we will delete it
          promptly.
        </p>
      </section>

      <section id="changes">
        <h2>13. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. When we do, we will update
          the "Effective Date" at the top and, for material changes, notify you by email
          or an in-app notice before the changes take effect.
        </p>
      </section>

      <section id="contact">
        <h2>14. Contact</h2>
        <p>
          If you have questions about this Privacy Policy or our data practices, contact
          us at <a href="mailto:privacy@cansee.ai">privacy@cansee.ai</a>. For security
          issues, email <a href="mailto:security@cansee.ai">security@cansee.ai</a>.
        </p>
        <p>
          Alicorr LLC (operator of Cansee).
        </p>
      </section>
    </main>

    <footer class="legal-footer flex items-center justify-between border-t border-border px-10 py-6 text-sm text-muted-foreground">
      <p>&copy; 2026 Alicorr LLC. All rights reserved.</p>
      <div class="flex gap-5">
        <router-link to="/terms" class="font-medium text-muted-foreground no-underline hover:text-foreground">Terms of Service</router-link>
        <router-link to="/privacy" class="font-medium text-muted-foreground no-underline hover:text-foreground">Privacy Policy</router-link>
        <a href="mailto:support@cansee.ai" class="font-medium text-muted-foreground no-underline hover:text-foreground">Contact</a>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

onMounted(() => {
  document.title = 'Privacy Policy — Cansee'
})
</script>

<style scoped>
h1 {
  font-size: 2.2rem;
  font-weight: 800;
  margin-bottom: 16px;
  letter-spacing: -0.02em;
}

.legal-intro {
  font-size: 1.05rem;
  color: var(--muted-foreground);
  margin-bottom: 12px;
}

.legal-toc h3 {
  font-size: 0.85rem;
  font-weight: 500;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted-foreground);
  margin-bottom: 12px;
}
.legal-toc ol {
  padding-left: 20px;
  columns: 2;
  column-gap: 24px;
}
.legal-toc li {
  padding: 3px 0;
  font-size: 0.875rem;
  break-inside: avoid;
}
.legal-toc a {
  color: var(--muted-foreground);
  text-decoration: none;
}
.legal-toc a:hover {
  color: var(--chart-1);
  text-decoration: underline;
}

section { margin-top: 40px; }

h2 {
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 20px 0 8px;
  color: var(--foreground);
}

p {
  margin-bottom: 12px;
  color: var(--muted-foreground);
}

ul, ol {
  padding-left: 24px;
  margin-bottom: 16px;
}

li {
  margin-bottom: 6px;
  color: var(--muted-foreground);
}

a {
  color: var(--chart-1);
  text-decoration: underline;
  text-underline-offset: 2px;
}

@media (max-width: 640px) {
  h1 { font-size: 1.6rem; }
  .legal-toc ol { columns: 1; }
}
</style>
