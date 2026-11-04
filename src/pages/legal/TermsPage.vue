<template>
  <div class="legal-page min-h-screen bg-background text-foreground">
    <header class="sticky top-0 z-[100] flex items-center justify-between border-b border-border bg-card px-10 py-4 backdrop-blur-md">
      <router-link to="/" class="flex items-center gap-2.5 text-[1.1rem] font-bold text-foreground no-underline">
        <img src="/images/cansee-logo.png" alt="Cansee" style="height:22px;width:auto" />
      </router-link>
      <div class="flex items-center gap-5">
        <router-link to="/privacy" class="text-sm font-medium text-muted-foreground no-underline hover:text-foreground">Privacy Policy</router-link>
        <Button as="router-link" to="/login" size="sm">Sign In</Button>
      </div>
    </header>

    <main class="legal-content mx-auto max-w-[780px] px-6 pb-20 pt-12 leading-[1.8]">
      <div class="mb-4 flex items-center gap-3">
        <Badge variant="secondary">Legal</Badge>
        <span class="text-sm text-muted-foreground">Last updated: March 26, 2026</span>
      </div>

      <h1>Terms of Service</h1>
      <p class="legal-intro">
        Welcome to Cansee. These Terms of Service ("Terms") govern your use of the Cansee
        platform, website, APIs, and related services (collectively, the "Service") operated by
        Alicorr LLC ("Company", "we", "us", or "our"), operator of the Cansee service.
      </p>
      <p class="legal-intro">
        By accessing or using the Service, you agree to be bound by these Terms. If you do not
        agree to these Terms, you may not access or use the Service.
      </p>

      <div class="legal-toc my-8 rounded-xl bg-muted px-7 py-6">
        <h3>Table of Contents</h3>
        <ol>
          <li><a href="#definitions">Definitions</a></li>
          <li><a href="#eligibility">Eligibility & Account Registration</a></li>
          <li><a href="#service">Description of Service</a></li>
          <li><a href="#plans">Plans, Billing & Payments</a></li>
          <li><a href="#trial">Free plan</a></li>
          <li><a href="#acceptable-use">Acceptable Use Policy</a></li>
          <li><a href="#data-ownership">Data Ownership & Licensing</a></li>
          <li><a href="#ai">AI-Generated Content</a></li>
          <li><a href="#integrations">Third-Party Integrations</a></li>
          <li><a href="#uptime">Service Level & Uptime</a></li>
          <li><a href="#termination">Termination & Suspension</a></li>
          <li><a href="#liability">Limitation of Liability</a></li>
          <li><a href="#indemnification">Indemnification</a></li>
          <li><a href="#disputes">Dispute Resolution</a></li>
          <li><a href="#changes">Changes to Terms</a></li>
          <li><a href="#sms">Text messages</a></li>
          <li><a href="#contact">Contact Information</a></li>
        </ol>
      </div>

      <!-- ── 1. Definitions ── -->
      <section id="definitions">
        <h2>1. Definitions</h2>
        <ul>
          <li><strong>"User"</strong> refers to any individual who creates an account and uses the Service.</li>
          <li><strong>"Individual Plan"</strong> means the self-serve subscription at $14/month designed for solopreneurs, freelancers, and indie hackers.</li>
          <li><strong>"Enterprise Plan"</strong> means a custom-priced subscription for teams, agencies, and organizations, including additional features such as SSO, API access, and dedicated support.</li>
          <li><strong>"Content"</strong> refers to all data, text, analytics, reports, and materials generated through the Service.</li>
          <li><strong>"Your Data"</strong> means data you provide to us or that we collect on your behalf, including website analytics, lead information, and campaign data.</li>
          <li><strong>"AI Credits"</strong> refers to the consumable units used to access AI-powered features such as keyword analysis and competitive intelligence.</li>
          <li><strong>"Workspace"</strong> means a project environment within Cansee tied to a specific website or domain.</li>
        </ul>
      </section>

      <!-- ── 2. Eligibility ── -->
      <section id="eligibility">
        <h2>2. Eligibility & Account Registration</h2>
        <h3>2.1 Age Requirement</h3>
        <p>You must be at least 18 years of age, or the age of legal majority in your jurisdiction, to create an account and use the Service.</p>

        <h3>2.2 Account Information</h3>
        <p>When registering, you must provide accurate, complete, and current information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>

        <h3>2.3 One Account Per Person</h3>
        <p>Each individual may maintain only one account. Creating multiple accounts to circumvent usage limits, exploit promotional offers, or evade enforcement actions is strictly prohibited and will result in immediate termination of all associated accounts.</p>

        <h3>2.4 Account Security</h3>
        <p>You agree to immediately notify us of any unauthorized use of your account or any other breach of security. We will not be liable for any loss or damage arising from your failure to comply with this requirement. We strongly recommend enabling two-factor authentication (2FA) on your account.</p>
      </section>

      <!-- ── 3. Description of Service ── -->
      <section id="service">
        <h2>3. Description of Service</h2>
        <p>Cansee is a marketing intelligence platform that provides:</p>
        <ul>
          <li><strong>Website Analytics</strong> — Real-time visitor tracking, session recording, and behavioral analysis.</li>
          <li><strong>Lead Scoring & Management</strong> — Automated identification, scoring, and pipeline management of potential customers.</li>
          <li><strong>Heatmaps</strong> — Visual representation of user interaction patterns on your pages.</li>
          <li><strong>Keyword Research</strong> — Search engine keyword analysis and tracking with competitive positioning data.</li>
          <li><strong>Campaign Management</strong> — Tools to plan, execute, and track multi-channel marketing campaigns.</li>
          <li><strong>LLM Dashboard</strong> — Monitor how your brand appears in AI search results across ChatGPT, Claude, Gemini, and others.</li>
          <li><strong>Competitive Intelligence</strong> — Track competitor websites, keywords, and market positioning.</li>
          <li><strong>Integrations</strong> — Connect with Slack, Discord, Telegram, and other platforms for real-time alerts and reports.</li>
        </ul>
        <p>Features may vary by plan. We reserve the right to modify, enhance, or discontinue any features with reasonable notice.</p>
      </section>

      <!-- ── 4. Plans, Billing & Payments ── -->
      <section id="plans">
        <h2>4. Plans, Billing & Payments</h2>
        <h3>4.1 Monthly plans</h3>
        <p>The 100 prompts plan is $80 a month and the 200 prompts plan is $140 a month, billed in advance by Polar. Each includes the tracked prompts its name says, the AI usage shown on the pricing page and daily checks. By subscribing, you authorize us to charge your payment method on a recurring monthly basis.</p>

        <h3>4.2 Enterprise Plan (Custom Pricing)</h3>
        <p>Enterprise plans are custom-quoted based on team size, usage requirements, and feature needs. Enterprise pricing is agreed upon via a separate order form or service agreement. Contact <a href="mailto:sales@cansee.ai">sales@cansee.ai</a> for details.</p>

        <h3>4.3 Payment Processing</h3>
        <p>All payments are processed securely by Polar. We never store, access, or handle your credit card numbers directly. Your payment information is subject to Polar's privacy policy and terms of service.</p>

        <h3>4.4 Refund Policy</h3>
        <p>Subscription fees are non-refundable. If you cancel your subscription, you will retain access to paid features until the end of your current billing period. We do not provide prorated refunds for partial months.</p>

        <h3>4.5 Failed Payments</h3>
        <p>If a payment fails, we will provide a 7-day grace period during which you can update your payment method. After 7 days, your account will be downgraded to the free tier and access to paid features will be restricted.</p>

        <h3>4.6 Price Changes</h3>
        <p>We reserve the right to change subscription prices with 30 days' advance written notice. Price changes will take effect at the start of your next billing cycle following the notice period.</p>
      </section>

      <!-- ── 5. Free plan (the id stays #trial so old links still land here) ── -->
      <section id="trial">
        <h2>5. Free plan</h2>
        <p>The Free plan stays free with its limits. The 100 and 200 prompt plans have no free trial.</p>
      </section>

      <!-- ── 6. Acceptable Use Policy ── -->
      <section id="acceptable-use">
        <h2>6. Acceptable Use Policy</h2>
        <p>You agree that you will NOT use the Service to:</p>
        <ul>
          <li>Violate any applicable laws, regulations, or third-party rights.</li>
          <li>Scrape, crawl, or harvest data from websites you do not own or have explicit authorization to analyze.</li>
          <li>Use analytics tracking scripts on websites without proper user consent (GDPR, CCPA, or equivalent).</li>
          <li>Generate, distribute, or promote spam, phishing, or fraudulent content.</li>
          <li>Attempt to gain unauthorized access to any part of the Service, other users' accounts, or our infrastructure.</li>
          <li>Reverse engineer, decompile, or attempt to extract the source code of the Service.</li>
          <li>Use the AI features to generate harmful, deceptive, or illegal content.</li>
          <li>Resell, sublicense, or redistribute the Service without our express written consent.</li>
          <li>Circumvent usage limits, rate limits, or feature restrictions through technical means.</li>
          <li>Use automated tools (bots, scripts) to interact with the Service beyond our provided APIs.</li>
          <li>Introduce malware, viruses, or other harmful code into the Service.</li>
          <li>Interfere with or disrupt the integrity or performance of the Service.</li>
        </ul>
        <p>Violation of this Acceptable Use Policy may result in immediate suspension or termination of your account without notice or refund.</p>
      </section>

      <!-- ── 7. Data Ownership ── -->
      <section id="data-ownership">
        <h2>7. Data Ownership & Licensing</h2>
        <h3>7.1 Your Data</h3>
        <p>You retain full ownership of Your Data. We do not claim any intellectual property rights over data you provide to the Service or data collected on your behalf through analytics tracking.</p>

        <h3>7.2 License to Process</h3>
        <p>By using the Service, you grant us a limited, non-exclusive, worldwide license to process, analyze, and store Your Data solely for the purpose of providing the Service to you. This license terminates when you delete your account.</p>

        <h3>7.3 Aggregated Data</h3>
        <p>We may use anonymized, aggregated data (which cannot identify you or your users) for the purposes of improving the Service, developing new features, and generating industry benchmarks. This aggregated data does not constitute Personal Data under any applicable privacy law.</p>

        <h3>7.4 Data Portability</h3>
        <p>You may export Your Data at any time through our API or the data export features available in your account settings. Upon account termination, we will retain Your Data for 30 days before permanent deletion, during which time you may request an export.</p>
      </section>

      <!-- ── 8. AI-Generated Content ── -->
      <section id="ai">
        <h2>8. AI-Generated Content</h2>
        <h3>8.1 Nature of AI Output</h3>
        <p>Cansee uses artificial intelligence to provide trend analysis, keyword suggestions, and other marketing insights. AI-generated content is provided as informational guidance and should not be treated as professional advice.</p>

        <h3>8.2 Accuracy</h3>
        <p>While we strive for accuracy, AI-generated content may contain errors, outdated information, or biases. You are responsible for independently verifying any AI-generated content before making business decisions based on it.</p>

        <h3>8.3 Ownership of AI Output</h3>
        <p>AI-generated content produced within your account is owned by you. However, similar or identical outputs may be generated for other users, and no exclusivity is granted over AI-generated content.</p>

        <h3>8.4 AI Credit Usage</h3>
        <p>AI features consume credits from your plan allocation. Credits reset at the beginning of each billing period and do not roll over. Unused credits expire at the end of each billing cycle.</p>
      </section>

      <!-- ── 9. Third-Party Integrations ── -->
      <section id="integrations">
        <h2>9. Third-Party Integrations</h2>
        <p>The Service allows you to connect with third-party platforms including Slack, Discord, and Telegram. When you connect an integration:</p>
        <ul>
          <li>You authorize us to send data to the connected platform on your behalf.</li>
          <li>Your use of the third-party platform is governed by that platform's terms and privacy policy.</li>
          <li>We are not responsible for the availability, accuracy, or security of third-party platforms.</li>
          <li>You may disconnect any integration at any time through your account settings.</li>
        </ul>
        <p>We transmit only the notification data you configure (e.g., growth reports, lead alerts). We do not read or store data from your third-party accounts.</p>
      </section>

      <!-- ── 10. Service Level & Uptime ── -->
      <section id="uptime">
        <h2>10. Service Level & Uptime</h2>
        <h3>10.1 Uptime Target</h3>
        <p>We target 99.9% uptime for the Service, measured on a monthly basis. This excludes scheduled maintenance windows, which will be communicated at least 24 hours in advance.</p>

        <h3>10.2 Enterprise SLA</h3>
        <p>Enterprise Plan customers may be eligible for a formal Service Level Agreement (SLA) with defined uptime guarantees and service credits for downtime. SLA terms are specified in the Enterprise order form.</p>

        <h3>10.3 No Warranty</h3>
        <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
      </section>

      <!-- ── 11. Termination ── -->
      <section id="termination">
        <h2>11. Termination & Suspension</h2>
        <h3>11.1 By You</h3>
        <p>You may cancel your subscription and delete your account at any time through the Settings page. Cancellation takes effect at the end of your current billing period.</p>

        <h3>11.2 By Us</h3>
        <p>We may suspend or terminate your account immediately, without prior notice, if:</p>
        <ul>
          <li>You violate these Terms or the Acceptable Use Policy.</li>
          <li>Your account is used for fraudulent or illegal activities.</li>
          <li>Your payment method fails and is not updated within the grace period.</li>
          <li>We are required to do so by law or regulatory action.</li>
        </ul>

        <h3>11.3 Effect of Termination</h3>
        <p>Upon termination, your right to access the Service ceases immediately. We will retain Your Data for 30 days following termination, after which it will be permanently deleted. Any accrued rights or obligations survive termination.</p>
      </section>

      <!-- ── 12. Limitation of Liability ── -->
      <section id="liability">
        <h2>12. Limitation of Liability</h2>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, CANSEE INC. SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, BUSINESS OPPORTUNITIES, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.</p>
        <p>OUR TOTAL LIABILITY UNDER THESE TERMS SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO US IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.</p>
      </section>

      <!-- ── 13. Indemnification ── -->
      <section id="indemnification">
        <h2>13. Indemnification</h2>
        <p>You agree to indemnify, defend, and hold harmless Alicorr LLC and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable attorneys' fees) arising out of:</p>
        <ul>
          <li>Your use of the Service.</li>
          <li>Your violation of these Terms.</li>
          <li>Your violation of any applicable law or third-party rights.</li>
          <li>Any data you submit to the Service.</li>
        </ul>
      </section>

      <!-- ── 14. Dispute Resolution ── -->
      <section id="disputes">
        <h2>14. Dispute Resolution</h2>
        <h3>14.1 Governing Law</h3>
        <p>These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions.</p>

        <h3>14.2 Arbitration</h3>
        <p>Any dispute arising out of or in connection with these Terms shall be resolved through binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules. The arbitration shall be conducted in English and the seat of arbitration shall be Wilmington, Delaware.</p>

        <h3>14.3 Class Action Waiver</h3>
        <p>You agree that any dispute resolution proceedings will be conducted only on an individual basis and not in a class, consolidated, or representative action.</p>
      </section>

      <!-- ── 15. Changes to Terms ── -->
      <section id="changes">
        <h2>15. Changes to Terms</h2>
        <p>We may update these Terms from time to time. When we make material changes, we will notify you by email to the address associated with your account and post the updated Terms on this page with a revised "Last updated" date. Your continued use of the Service after the effective date of the revised Terms constitutes acceptance of the changes.</p>
      </section>

      <!-- ── 16. Text messages (linked from the consent box as /terms#sms) ── -->
      <section id="sms">
        <h2>16. Text messages</h2>
        <p>The program name is Cansee Autopilot texts.</p>
        <p>You get one text a day per project you turn on in Autopilot, plus the verification codes and replies you ask for. Texts go only to the mobile number you verified.</p>
        <p>Msg &amp; data rates may apply. Reply STOP to cancel, HELP for help.</p>
        <p>Carriers are not liable for delayed or undelivered messages.</p>
        <p>Consent to receive text messages is not a condition of purchase.</p>
        <p>Our <router-link to="/privacy">Privacy Policy</router-link> says how we use your mobile number.</p>
      </section>

      <!-- ── 17. Contact ── -->
      <section id="contact">
        <h2>17. Contact Information</h2>
        <p>If you have any questions about these Terms, you can reach us at:</p>
        <div class="contact-card mt-3 rounded-xl bg-muted px-6 py-5">
          <p><strong>Alicorr LLC</strong> (operator of Cansee)</p>
          <p>Email: <a href="mailto:legal@cansee.ai">legal@cansee.ai</a></p>
          <p>Support: <a href="mailto:support@cansee.ai">support@cansee.ai</a></p>
          <p>Website: <a href="https://cansee.ai" target="_blank" rel="noopener">https://cansee.ai</a></p>
        </div>
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
  document.title = 'Terms of Service — Cansee'
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
  font-weight: 700;
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

section {
  margin-top: 40px;
}

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

.contact-card p { margin-bottom: 4px; }

@media (max-width: 640px) {
  h1 { font-size: 1.6rem; }
  .legal-toc ol { columns: 1; }
}
</style>
