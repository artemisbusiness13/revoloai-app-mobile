export type LegalKind = "info" | "warning" | "danger" | "success";

export interface StructuredLegalSection {
  id: string;
  kind: LegalKind;
  icon: string;        // emoji icon shown next to heading
  h: string;
  bullets: string[];   // each bullet may contain **bold** markers
}

export interface StructuredLegalDoc {
  title: string;
  intro: string;
  sections: StructuredLegalSection[];
}

export type Translations = {
  meta: { name: string; code: string; dir: "ltr" | "rtl" };
  common: Record<string, string>;
  home: Record<string, string>;
  lang: Record<string, string>;
  trust: Record<string, string>;
  meetAvatars: Record<string, string>;
  avatars: Record<"maya" | "sofia" | "aria", { name: string; role: string }>;
  services: Record<string, string>;
  plans: Record<string, { title: string; sub: string; bullets: string[] }>;
  bundles: {
    label: string; title: string; sub: string; unlock: string;
    [key: string]: any;
  };
  conversation: Record<string, string>;
  how: Record<string, string>;
  finalCta: Record<string, string>;
  account: Record<string, string>;
  footer: Record<string, string>;
  install: Record<string, string>;
  chat: Record<string, string>;
  checkout: Record<string, string>;
  jobs: Record<string, string>;
  interview: Record<string, string>;
  results: {
    title: string; overall: string; breakdown: string; summary: string;
    strengths: string; improvements: string; nextSteps: string;
    verdict: Record<string, string>;
    axes: Record<string, string>;
  };
  demo: Record<string, string>;
  profile: Record<string, string>;
  legal: {
    privacy: { title: string; updated: string; intro: string; sections: { h: string; p: string }[] };
    terms:   { title: string; updated: string; intro: string; sections: { h: string; p: string }[] };
    cookies: { title: string; updated: string; intro: string; sections: { h: string; p: string }[] };
    deletion:{ title: string; updated: string; intro: string; sections: { h: string; p: string }[] };
    // T&C Gate compliance namespace.
    tcGate?: Record<string, string> & {
      // Structured legal documents shown in the gate.
      termsDoc?: StructuredLegalDoc;
      privacyDoc?: StructuredLegalDoc;
      // Notice shown in non-EN languages explaining English is the binding original.
      bindingNote?: string;
      bindingNoteTitle?: string;
    };
    serviceInfo?: Record<string, string> & {
      refundBullets?: string[];
      howSteps?: string[];
    };
    disclaimers?: Record<string, string>;
    footer?: Record<string, string>;
  };
};
