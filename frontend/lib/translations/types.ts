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
};
