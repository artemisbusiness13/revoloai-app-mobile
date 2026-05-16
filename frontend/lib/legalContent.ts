/**
 * Legal content registry for Revoloai.
 *
 * The structured Terms / Privacy content shown inside the T&C acceptance gate
 * is now sourced from the i18n dictionaries (lib/translations/*.ts) under
 * `legal.tcGate.termsDoc` and `legal.tcGate.privacyDoc` — see TermsAcceptanceGate.
 *
 * This file keeps:
 *   - `TC_VERSION`           — bumped when material changes require re-acceptance
 *   - `COPYRIGHT_CONTENT`    — used by the static /legal/copyright page (English-binding original)
 *
 * The legacy `TERMS_CONTENT` and `PRIVACY_CONTENT` exports are kept as
 * English fallbacks for environments that bypass the gate (e.g. SSR previews).
 */
export const TC_VERSION = "1.1";

export interface LegalSection { h: string; p: string }

export const TERMS_CONTENT: { title: string; intro: string; sections: LegalSection[] } = {
  title: "Terms & Conditions",
  intro:
    "Welcome to Revoloai. These Terms govern your use of our AI career assistant. " +
    "By using Revoloai you agree to be bound by these Terms.",
  sections: [
    { h: "About the service", p: "Revoloai is a UK AI career assistant. Operated by Revoloai Ltd, England and Wales." },
    { h: "Acceptance & age", p: "You confirm you are at least 18 years old. Acceptance is recorded with timestamp and version." },
    { h: "Important warnings", p: "We do NOT guarantee employment, interviews, or job offers. AI may contain inaccuracies." },
    { h: "Your obligations", p: "Provide accurate info, do not scrape, do not use outputs to train competing AI models." },
    { h: "Payments & refunds", p: "14-day refund under UK Consumer Rights Act 2015 only if delivery has not started." },
    { h: "IP & liability", p: "Liability limited to amount paid for the specific service. Governed by laws of England and Wales." },
    { h: "Contact", p: "legal@revoloai.com — Revoloai Ltd, London, United Kingdom." },
  ],
};

export const PRIVACY_CONTENT: { title: string; intro: string; sections: LegalSection[] } = {
  title: "Privacy Policy",
  intro:
    "Revoloai Ltd processes your data under UK GDPR and Data Protection Act 2018.",
  sections: [
    { h: "Data controller", p: "Revoloai Ltd, England and Wales. privacy@revoloai.com" },
    { h: "Data we collect", p: "Account, profile, usage and minimal technical data." },
    { h: "AI processing", p: "Anthropic (Claude), Adzuna and Stripe act as processors and do not train on your data." },
    { h: "Your rights", p: "Access, rectification, erasure, portability, withdraw consent, complain to ICO." },
    { h: "Retention & children", p: "Active accounts kept while active. Deleted accounts purged in 30 days. Not for under-18s." },
  ],
};

export const COPYRIGHT_CONTENT: { title: string; intro: string; sections: LegalSection[] } = {
  title: "Copyright & Intellectual Property",
  intro:
    "\u00a9 2026 Revoloai Ltd. All rights reserved. The Revoloai service, software, branding, and AI outputs are protected under the UK Copyright, Designs and Patents Act 1988 and applicable trademark law.",
  sections: [
    { h: "Trademarks", p: "\"Revoloai\" and the avatar character names \"Maya\", \"Sofia\" and \"Aria\" are trademarks of Revoloai Ltd in the United Kingdom and other jurisdictions." },
    { h: "Protected Content", p: "All AI-generated outputs (chat replies, interview questions, scoring, CV feedback, job match explanations) are the intellectual property of Revoloai and licensed to you under a personal, non-transferable, non-commercial licence." },
    { h: "Prohibited Uses", p: "You may NOT (a) scrape, mass-download, or systematically copy Revoloai content; (b) reproduce or redistribute AI outputs publicly or commercially; (c) use Revoloai outputs to train, fine-tune, evaluate, or benchmark competing AI models; (d) use the Maya, Sofia, or Aria personas in any third-party product." },
    { h: "Permitted Uses", p: "You MAY (a) use AI outputs for personal career development; (b) save and locally store CV feedback for your own use; (c) practise interview answers privately; (d) quote short excerpts for personal reference with attribution to Revoloai." },
    { h: "Reporting Infringement", p: "To report copyright infringement or request a licence, contact legal@revoloai.com with the subject line \"IP Notice\"." },
  ],
};
