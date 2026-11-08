<!--
  LEGAL REVIEW REQUIRED: this Terms of Service text is a working draft that
  describes the live product. It must be reviewed and approved by counsel
  before launch, including the operating party (no legal entity has been
  chosen yet, so it reads "Cansee") and Section 14.
-->
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
      <!-- Version 2026-11-08: keep this date in step with the API's current
           terms version (session terms.current_version). Changing the terms
           means a new version there, which asks every user to accept again. -->
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <Badge variant="secondary">Legal</Badge>
        <span class="text-sm text-muted-foreground">Last updated: November 8, 2026</span>
        <span class="text-sm text-muted-foreground">Effective: November 8, 2026</span>
      </div>

      <h1>Terms of Service</h1>
      <p class="legal-intro">
        Welcome to Cansee. These Terms of Service ("Terms") govern your use of the Cansee
        platform, website, analytics pixel, and related services (collectively, the "Service")
        provided by Cansee ("we", "us", or "our").
      </p>
      <p class="legal-intro">
        By creating an account, accepting these Terms in the Service, or otherwise using the
        Service, you agree to be bound by these Terms. If you do not agree, you may not use the
        Service.
      </p>

      <div class="legal-toc my-8 rounded-xl bg-muted px-7 py-6">
        <h3>Table of Contents</h3>
        <ol>
          <li><a href="#definitions">Definitions</a></li>
          <li><a href="#eligibility">Eligibility & Account Registration</a></li>
          <li><a href="#service">Description of Service</a></li>
          <li><a href="#plans">Plans, Billing & Payments</a></li>
          <li><a href="#trial">Free plan & Trials</a></li>
          <li><a href="#acceptable-use">Acceptable Use Policy</a></li>
          <li><a href="#data-ownership">Data Ownership & Licensing</a></li>
          <li><a href="#ai">AI-Generated Content</a></li>
          <li><a href="#integrations">Third-Party Services & Integrations</a></li>
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
          <li><strong>"User"</strong> or <strong>"you"</strong> means any individual who creates an account and uses the Service, and the business on whose behalf that individual acts.</li>
          <li><strong>"Plan"</strong> means the Free plan or a paid subscription plan as described on our <router-link to="/pricing">Pricing page</router-link>, or a plan agreed in a separate written order with us.</li>
          <li><strong>"Project"</strong> means a workspace within the Service tied to a specific brand, website, or domain.</li>
          <li><strong>"Prompt"</strong> means a question or instruction that you choose, or that the Service suggests and you approve, which the Service sends to AI engines to measure how your brand appears in their answers.</li>
          <li><strong>"AI Engine"</strong> means a third-party AI model or AI search product that the Service queries, such as those offered by OpenAI, Anthropic, Google, xAI, and Perplexity.</li>
          <li><strong>"Your Data"</strong> means data you provide to the Service or that the Service collects on your behalf, including project and brand details, Prompts, brand facts, data collected by the analytics pixel on your websites, and data from services you connect.</li>
          <li><strong>"Content"</strong> means the results, reports, analyses, and other materials the Service produces for you, including AI Engine answers it records and AI-generated output.</li>
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
        <p>Each individual may maintain only one account. Creating multiple accounts to circumvent plan limits, exploit promotional offers, or evade enforcement actions is prohibited and may result in termination of all associated accounts.</p>

        <h3>2.4 Account Security</h3>
        <p>You agree to notify us promptly of any unauthorized use of your account or any other breach of security. We are not liable for any loss or damage arising from your failure to protect your credentials.</p>
      </section>

      <!-- ── 3. Description of Service ── -->
      <section id="service">
        <h2>3. Description of Service</h2>
        <p>Cansee measures and helps you improve how your brand appears in AI-generated answers. The Service includes:</p>
        <ul>
          <li><strong>Prompt runs across AI Engines</strong>: the Service sends your Prompts to multiple AI Engines on a schedule and records whether, where, and how your brand and your competitors are mentioned.</li>
          <li><strong>Citations and source analysis</strong>: the Service identifies the sources and pages AI answers cite, and analyzes how they relate to your content and your competitors.</li>
          <li><strong>Brand security</strong>: the Service compares AI answers with the brand facts you provide and flags answers that conflict with them.</li>
          <li><strong>Analytics pixel</strong>: a script you may install on websites you own that measures visits from AI assistants and AI search products and related site activity, as described on our <router-link to="/what-we-track">What we track</router-link> page.</li>
          <li><strong>Agent</strong>: an AI assistant that works with your Project data to answer questions, run analyses, and draft content and recommendations. Drafts and suggestions the agent produces are yours to review before you use them.</li>
          <li><strong>Reports and alerts</strong>: dashboards, daily reports, and notifications delivered in the Service and to channels you connect.</li>
        </ul>
        <p>Features and limits vary by Plan. We may modify, enhance, or discontinue features. Where a change materially reduces the paid features you rely on, we will give you reasonable notice.</p>
      </section>

      <!-- ── 4. Plans, Billing & Payments ── -->
      <section id="plans">
        <h2>4. Plans, Billing & Payments</h2>
        <h3>4.1 Plans and Prices</h3>
        <p>The Plans available, their prices, and their limits (such as the number of Projects and tracked Prompts, how often Prompts run, and AI usage allowances) are shown on our <router-link to="/pricing">Pricing page</router-link> and at checkout. The Plan, price, and limits shown when you subscribe apply to your subscription until changed under Section 4.6. Paid Plans are billed in advance on a recurring basis, and by subscribing you authorize us and our payment processor to charge your payment method for each billing period until you cancel.</p>

        <h3>4.2 Custom Agreements</h3>
        <p>If you subscribe under a separate written order form or service agreement with us, that agreement governs pricing and any terms it states expressly, and these Terms govern everything else. Contact <a href="mailto:sales@cansee.ai">sales@cansee.ai</a> for details.</p>

        <h3>4.3 Payment Processing</h3>
        <p>Payments are processed by our payment processor, Polar. We do not store or handle your full card details. Your payment information is subject to Polar's terms and privacy policy.</p>

        <h3>4.4 Taxes</h3>
        <p>Prices do not include taxes unless stated. Applicable sales, use, value added, or similar taxes may be added at checkout.</p>

        <h3>4.5 Cancellation, Refunds, and Failed Payments</h3>
        <p>You may cancel a paid Plan at any time. Cancellation takes effect at the end of the current billing period, and you keep access to paid features until then. Except where required by law, fees already paid are non-refundable and we do not provide prorated refunds for partial periods. If a payment fails and is not resolved, your account moves to the Free plan and paid features are restricted.</p>

        <h3>4.6 Price Changes</h3>
        <p>We may change Plan prices or limits with at least 30 days' advance notice by email or in the Service. Changes take effect at the start of your next billing period after the notice period. If you do not agree, you may cancel before the change takes effect.</p>
      </section>

      <!-- ── 5. Free plan (the id stays #trial so old links still land here) ── -->
      <section id="trial">
        <h2>5. Free plan & Trials</h2>
        <p>The Free plan is provided at no charge with the limits shown on the Pricing page. Where a paid Plan offers a free trial, its length is shown at checkout, and the subscription is billed when the trial ends unless you cancel before then. We may change or end the Free plan or trial offers with notice.</p>
      </section>

      <!-- ── 6. Acceptable Use Policy ── -->
      <section id="acceptable-use">
        <h2>6. Acceptable Use Policy</h2>
        <p>You agree that you will NOT use the Service to:</p>
        <ul>
          <li>Violate any applicable laws, regulations, or third-party rights.</li>
          <li>Track or analyze websites or brands you do not own or are not authorized to act for, except for the competitor and market analysis the Service is designed to provide.</li>
          <li>Install the analytics pixel on websites without the visitor notices and consents required by applicable law (such as the GDPR, ePrivacy rules, or the CCPA).</li>
          <li>Submit Prompts or other input designed to make AI Engines produce harmful, deceptive, or illegal content, or that violate the AI Engine providers' usage policies.</li>
          <li>Generate, distribute, or promote spam, phishing, fake reviews, or fraudulent content.</li>
          <li>Attempt to gain unauthorized access to any part of the Service, other users' accounts, or our infrastructure.</li>
          <li>Reverse engineer, decompile, or attempt to extract the source code of the Service, except where applicable law permits it.</li>
          <li>Resell, sublicense, or redistribute the Service without our express written consent.</li>
          <li>Circumvent Plan limits, rate limits, or feature restrictions through technical or other means.</li>
          <li>Access the Service with automated tools (bots, scripts, scrapers) other than through interfaces we provide for that purpose.</li>
          <li>Introduce malware, viruses, or other harmful code into the Service.</li>
          <li>Interfere with or disrupt the integrity or performance of the Service.</li>
        </ul>
        <p>Violation of this Acceptable Use Policy may result in suspension or termination of your account, without refund where permitted by law.</p>
      </section>

      <!-- ── 7. Data Ownership ── -->
      <section id="data-ownership">
        <h2>7. Data Ownership & Licensing</h2>
        <h3>7.1 Your Data</h3>
        <p>You retain ownership of Your Data. We do not claim intellectual property rights over data you provide to the Service or data collected on your behalf through the analytics pixel.</p>

        <h3>7.2 License to Process</h3>
        <p>You grant us a limited, non-exclusive, worldwide license to host, process, analyze, and transmit Your Data solely to provide, secure, and support the Service for you, including sending Prompts and related Project details to AI Engines. This license ends when Your Data is deleted under Section 11.3.</p>

        <h3>7.3 Aggregated Data</h3>
        <p>We may use de-identified, aggregated data that does not identify you, your brand, or your website visitors to operate and improve the Service and to produce general benchmarks.</p>

        <h3>7.4 Data Export</h3>
        <p>You may export reports and data using the export features available in the Service. After your account is closed, we keep Your Data for 30 days before deletion, as described in our <router-link to="/privacy">Privacy Policy</router-link>, and you may ask for an export during that time.</p>

        <h3>7.5 Our Service</h3>
        <p>We own the Service, including its software, design, and the methods it uses to measure AI visibility. Apart from the rights these Terms grant you to use the Service, no rights are transferred to you.</p>
      </section>

      <!-- ── 8. AI-Generated Content ── -->
      <section id="ai">
        <h2>8. AI-Generated Content</h2>
        <h3>8.1 Nature of AI Output</h3>
        <p>The Service records answers produced by third-party AI Engines and uses AI to analyze them, explain results, and suggest content or changes (including through the agent). AI Engine answers reflect those third parties, not us. AI-generated output is provided as information and is not professional, legal, or financial advice.</p>

        <h3>8.2 Accuracy and Variability</h3>
        <p>AI Engine answers vary over time, by location, and between runs, and AI-generated output may contain errors, outdated information, or biases. Visibility measurements are estimates based on the Prompts run. You are responsible for reviewing AI-generated content before publishing it or relying on it for decisions.</p>

        <h3>8.3 Ownership of AI Output</h3>
        <p>As between you and us, AI-generated output produced for your account belongs to you, subject to the rights of third parties and the AI Engine providers' terms. Similar or identical output may be generated for other users, and no exclusivity is granted.</p>

        <h3>8.4 No Control over AI Engines</h3>
        <p>We do not control how AI Engines rank, mention, or describe any brand, and we do not guarantee any change in your visibility from using the Service or following its suggestions.</p>
      </section>

      <!-- ── 9. Third-Party Services & Integrations ── -->
      <section id="integrations">
        <h2>9. Third-Party Services & Integrations</h2>
        <p>The Service relies on third-party AI Engine providers (such as OpenAI, Anthropic, Google, xAI, and Perplexity) to run your Prompts, and lets you connect other services, including Slack, Discord, Microsoft Teams, text messages, and Google Search Console and Google Analytics. When you use these:</p>
        <ul>
          <li>You authorize us to send the data needed for the feature to the provider or connected service on your behalf, and to read the data you authorize from services you connect.</li>
          <li>Your use of a third-party service is governed by that provider's terms and privacy policy.</li>
          <li>We are not responsible for the availability, accuracy, or security of third-party services, and a provider may change or withdraw access to its service.</li>
          <li>You may disconnect any integration at any time in your account settings.</li>
        </ul>
        <p>For chat and text message integrations, we send only the reports and notifications you configure and the replies to requests you make. We read data from a connected service only to provide the features you use with it.</p>
      </section>

      <!-- ── 10. Service Level & Uptime ── -->
      <section id="uptime">
        <h2>10. Service Level & Uptime</h2>
        <h3>10.1 Availability</h3>
        <p>We aim to keep the Service available at all times, excluding scheduled maintenance, which we will try to announce in advance. Features that depend on AI Engines or other third-party services are available only when those services are.</p>

        <h3>10.2 Service Level Agreements</h3>
        <p>Formal uptime commitments and service credits apply only where agreed in a separate written agreement under Section 4.2.</p>

        <h3>10.3 No Warranty</h3>
        <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
      </section>

      <!-- ── 11. Termination ── -->
      <section id="termination">
        <h2>11. Termination & Suspension</h2>
        <h3>11.1 By You</h3>
        <p>You may cancel your subscription and delete your account at any time in Settings. Cancellation of a paid Plan takes effect at the end of the current billing period.</p>

        <h3>11.2 By Us</h3>
        <p>We may suspend or terminate your account, with notice where practical, if:</p>
        <ul>
          <li>You violate these Terms or the Acceptable Use Policy.</li>
          <li>Your account is used for fraudulent or illegal activities.</li>
          <li>We are required to do so by law or regulatory action.</li>
          <li>Continued service would create a security risk for the Service or other users.</li>
        </ul>

        <h3>11.3 Effect of Termination</h3>
        <p>Upon termination, your right to access the Service ends. We retain Your Data for 30 days following termination, after which it is deleted, except where we must keep it longer by law. Sections that by their nature should survive termination, including Sections 7, 8, 10.3, 12, 13, and 14, survive.</p>
      </section>

      <!-- ── 12. Limitation of Liability ── -->
      <section id="liability">
        <h2>12. Limitation of Liability</h2>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, CANSEE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, BUSINESS OPPORTUNITIES, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, INCLUDING ANY RELIANCE ON AI ENGINE ANSWERS OR AI-GENERATED CONTENT.</p>
        <p>OUR TOTAL LIABILITY UNDER THESE TERMS SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO US IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.</p>
      </section>

      <!-- ── 13. Indemnification ── -->
      <section id="indemnification">
        <h2>13. Indemnification</h2>
        <p>You agree to indemnify, defend, and hold harmless Cansee and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable attorneys' fees) arising out of:</p>
        <ul>
          <li>Your use of the Service.</li>
          <li>Your violation of these Terms.</li>
          <li>Your violation of any applicable law or third-party rights, including installing the analytics pixel without required consents.</li>
          <li>Any data or Prompts you submit to the Service, and any content you publish based on it.</li>
        </ul>
      </section>

      <!-- ── 14. Dispute Resolution ── -->
      <section id="disputes">
        <h2>14. Dispute Resolution</h2>
        <!-- Governing law, venue and arbitration must be confirmed by counsel
             before launch; the text below is unchanged pending that review. -->
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
        <p>We may update these Terms from time to time. When we make material changes, we will post the updated Terms on this page with a new "Last updated" date, notify you by email or in the Service, and ask you to accept the updated Terms the next time you use the Service. If you do not accept them, you may stop using the Service and close your account. Changes do not apply retroactively.</p>
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
          <p><strong>Cansee</strong></p>
          <p>Email: <a href="mailto:legal@cansee.ai">legal@cansee.ai</a></p>
          <p>Support: <a href="mailto:support@cansee.ai">support@cansee.ai</a></p>
          <p>Website: <a href="https://cansee.ai" target="_blank" rel="noopener">https://cansee.ai</a></p>
        </div>
      </section>
    </main>

    <footer class="legal-footer flex items-center justify-between border-t border-border px-10 py-6 text-sm text-muted-foreground">
      <p>&copy; 2026 Cansee. All rights reserved.</p>
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
