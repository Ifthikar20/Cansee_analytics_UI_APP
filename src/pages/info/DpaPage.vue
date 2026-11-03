<template>
  <InfoPage title="Data Processing Agreement" eyebrow="Legal" intro="This Data Processing Agreement (DPA) supplements the Cansee Terms of Service and governs how Alicorr LLC processes personal data on behalf of customers ('Controllers')." updated="May 19, 2026">
    <h2>1. Scope</h2>
    <p>
      This DPA applies whenever Cansee processes personal data (as defined under GDPR, UK GDPR,
      and the CCPA/CPRA) on behalf of a Controller using the Cansee platform.
    </p>

    <h2>2. Roles</h2>
    <p>
      The Customer is the Controller. Alicorr LLC, operator of Cansee, is the Processor. Sub-processors
      (e.g. hosting, LLM providers, email delivery) act as Sub-processors.
    </p>

    <h2>3. Subject-matter, duration, and purpose</h2>
    <p>
      Cansee processes personal data only to deliver the contracted Service: measuring brand
      visibility in LLM answers, generating content briefs, and providing analytics. Processing
      runs for the duration of the customer agreement plus any deletion grace period.
    </p>

    <h2>4. Categories of data</h2>
    <ul>
      <li>Account data: name, email, hashed password, organization membership.</li>
      <li>Usage data: API request logs, audit events, billing records.</li>
      <li>Customer-uploaded content: Brand Vault facts, prompt libraries, generated drafts.</li>
    </ul>

    <h2>5. Sub-processors</h2>
    <p>
      Current sub-processors include AWS (hosting), Anthropic, OpenAI, Google, and Perplexity
      (LLM probing), and SES / SendGrid (transactional email). A complete list is available on
      request via <a :href="`mailto:${PRIVACY_EMAIL}`">{{ PRIVACY_EMAIL }}</a>.
    </p>

    <h2>6. Security measures</h2>
    <p>
      We maintain administrative, technical, and physical safeguards aligned with SOC 2 CC6:
      encryption in transit and at rest, role-based access control, audit logging, and quarterly
      access reviews.
    </p>

    <h2>7. International transfers</h2>
    <p>
      Where personal data leaves the EEA / UK, transfers rely on Standard Contractual Clauses and,
      where applicable, the UK Addendum.
    </p>

    <h2>8. Contact</h2>
    <p>
      To execute a counter-signed copy of this DPA, email
      <a :href="`mailto:${PRIVACY_EMAIL}`">{{ PRIVACY_EMAIL }}</a>.
    </p>
  </InfoPage>
</template>

<script setup>
import InfoPage from './InfoPage.vue'
import { PRIVACY_EMAIL } from '@/constants/support'
</script>
