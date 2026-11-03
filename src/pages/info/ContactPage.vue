<template>
  <InfoPage title="Contact us" eyebrow="Talk to Cansee" intro="Email the address that matches your question.">
    <div class="info-grid">
      <div v-for="c in contacts" :key="c.email">
        <h4>{{ c.title }}</h4>
        <p>{{ c.desc }}</p>
        <p><a :href="`mailto:${c.email}`">{{ c.email }}</a></p>
      </div>
    </div>

    <h2>Getting an account</h2>
    <p>
      Cansee accounts are by invitation. To ask for one, email
      <a :href="`mailto:${SALES_EMAIL}`">{{ SALES_EMAIL }}</a>.
    </p>

    <h2>Company</h2>
    <p>Cansee is operated by Alicorr LLC.</p>
  </InfoPage>
</template>

<script setup>
import InfoPage from './InfoPage.vue'
import {
  AI_SAFETY_EMAIL, GENERAL_EMAIL, LEGAL_EMAIL, PRIVACY_EMAIL, SALES_EMAIL, SECURITY_EMAIL,
  SUPPORT_EMAIL,
} from '@/constants/support'

const contacts = [
  { title: 'Support', desc: 'Your account, a prompt that looks wrong, or a billing question.', email: SUPPORT_EMAIL },
  { title: 'Sales', desc: 'Plans, pricing and new accounts.', email: SALES_EMAIL },
  { title: 'Privacy', desc: 'Data requests and privacy questions.', email: PRIVACY_EMAIL },
  { title: 'Security', desc: 'Report a security issue.', email: SECURITY_EMAIL },
  { title: 'Legal', desc: 'Terms and agreements.', email: LEGAL_EMAIL },
  { title: 'Responsible AI', desc: 'Concerns about how Cansee uses AI.', email: AI_SAFETY_EMAIL },
  { title: 'Everything else', desc: 'Anything not covered above.', email: GENERAL_EMAIL },
]
</script>
