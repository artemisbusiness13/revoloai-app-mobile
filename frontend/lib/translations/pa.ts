import { Translations } from "./types";

// ਪੰਜਾਬੀ — Punjabi (Gurmukhi). Partial translation; untranslated keys fall back to English.
const pa = {
  meta: { name: "Punjabi", code: "pa", dir: "ltr" },
  common: {
    save: "ਸੇਵ ਕਰੋ", cancel: "ਰੱਦ ਕਰੋ", continue: "ਜਾਰੀ ਰੱਖੋ", back: "ਵਾਪਸ", close: "ਬੰਦ ਕਰੋ",
    open: "ਖੋਲ੍ਹੋ", refresh: "ਤਾਜ਼ਾ ਕਰੋ", done: "ਹੋ ਗਿਆ", confirm: "ਪੁਸ਼ਟੀ ਕਰੋ", submit: "ਭੇਜੋ",
    loading: "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…", error: "ਕੁਝ ਗਲਤ ਹੋਇਆ", retry: "ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ", gotIt: "ਸਮਝ ਗਿਆ",
  },
  home: {
    install: "ਇੰਸਟਾਲ ਕਰੋ", earlyAccess: "ਸ਼ੁਰੂਆਤੀ ਪਹੁੰਚ",
    heroTitle1: "ਬਿਹਤਰ ਨੌਕਰੀਆਂ ਲੱਭੋ।",
    heroTitle2: "ਇੰਟਰਵਿਊ ਦਾ ਅਭਿਆਸ ਕਰੋ।",
    heroTitle3: "ਜਲਦੀ ਨੌਕਰੀ ਪ੍ਰਾਪਤ ਕਰੋ।",
    heroSub: "ਤੁਹਾਡਾ AI ਕਰੀਅਰ ਸਹਾਇਕ — ਤਿੰਨ ਦੋਸਤਾਨਾ ਅਵਤਾਰ CV ਤੋਂ ਪੇਸ਼ਕਸ਼ ਤੱਕ ਮਾਰਗਦਰਸ਼ਨ ਕਰਦੇ ਹਨ।",
    chooseAvatar: "ਆਪਣਾ ਅਵਤਾਰ ਚੁਣੋ",
    noSubscription: "ਕੋਈ ਸਬਸਕ੍ਰਿਪਸ਼ਨ ਨਹੀਂ · ਵਰਤੋਂ ਮੁਤਾਬਕ ਭੁਗਤਾਨ",
    startWithAvatar: "ਆਪਣੇ ਅਵਤਾਰ ਨਾਲ ਸ਼ੁਰੂ ਕਰੋ",
    tapToExplore: "ਖੋਜਣ ਲਈ ਕੋਈ ਵੀ ਕਾਰਡ ਟੈਪ ਕਰੋ",
    startWith: "{name} ਨਾਲ ਸ਼ੁਰੂ ਕਰੋ",
  },
  lang: { title: "ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ", sub: "ਐਪ ਨੂੰ ਤੁਰੰਤ ਅਨੁਵਾਦ ਕਰੋ" },
  avatars: {
    maya: { name: "Maya", role: "ਨੌਕਰੀ ਖੋਜਕਾਰ" },
    sofia: { name: "Sofia", role: "ਇੰਟਰਵਿਊ ਕੋਚ" },
    aria: { name: "Aria", role: "ਕਰੀਅਰ ਕੋਚ" },
  },
  meetAvatars: { label: "ਚੁਣੋ", title: "ਆਪਣੇ ਅਵਤਾਰਾਂ ਨੂੰ ਮਿਲੋ", sub: "ਤਿੰਨ ਦੋਸਤਾਨਾ AI, ਹਰ ਇੱਕ ਦੀ ਸਪੱਸ਼ਟ ਭੂਮਿਕਾ।" },
  chat: {
    placeholder: "ਸੁਨੇਹਾ ਲਿਖੋ…", send: "ਭੇਜੋ", listening: "ਸੁਣ ਰਿਹਾ ਹਾਂ…", speakReply: "ਜਵਾਬ ਉੱਚੀ ਆਵਾਜ਼ ਵਿੱਚ ਪੜ੍ਹੋ", micPermission: "ਮਾਈਕ੍ਰੋਫੋਨ ਪਹੁੰਚ ਦੀ ਆਗਿਆ ਦਿਓ", typing: "ਟਾਈਪ ਕਰ ਰਿਹਾ ਹੈ…",
  },
  account: {
    signupTitle: "ਆਪਣਾ ਖਾਤਾ ਬਣਾਓ", signupSub: "ਨਿੱਜੀ ਕਰੀਅਰ ਮਦਦ — 30 ਸਕਿੰਟਾਂ ਵਿੱਚ ਸ਼ੁਰੂ।",
    loginTitle: "ਮੁੜ ਜੀ ਆਇਆਂ ਨੂੰ", loginSub: "ਜਾਰੀ ਰੱਖਣ ਲਈ ਸਾਈਨ ਇਨ ਕਰੋ।",
    signupTab: "ਸਾਈਨ ਅੱਪ", loginTab: "ਲੌਗ ਇਨ",
    namePh: "ਤੁਹਾਡਾ ਨਾਮ", emailPh: "ਈਮੇਲ ਪਤਾ", passwordPh: "ਪਾਸਵਰਡ (ਘੱਟੋ-ਘੱਟ 6 ਅੱਖਰ)",
    createAccount: "ਖਾਤਾ ਬਣਾਓ", logIn: "ਲੌਗ ਇਨ",
    fillAll: "ਕਿਰਪਾ ਕਰਕੇ ਸਾਰੇ ਖੇਤਰ ਭਰੋ।", signupFailed: "ਖਾਤਾ ਨਹੀਂ ਬਣਾਇਆ ਜਾ ਸਕਿਆ।", loginFailed: "ਗਲਤ ਈਮੇਲ ਜਾਂ ਪਾਸਵਰਡ।",
  },
  profile: {
    title: "ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ", step: "ਪੜਾਅ",
    s1: "ਟੀਚੇ", s2: "ਅਨੁਭਵ", s3: "ਹੁਨਰ", s4: "ਤੁਹਾਡੇ ਬਾਰੇ",
    targetRole: "ਟੀਚਾ ਨੌਕਰੀ", location: "ਪਸੰਦੀਦਾ ਸਥਾਨ", remote: "ਕੰਮ ਦਾ ਤਰੀਕਾ",
    salaryMin: "ਘੱਟੋ-ਘੱਟ ਤਨਖਾਹ (£/ਸਾਲ)", salaryMax: "ਵੱਧ ਤੋਂ ਵੱਧ ਤਨਖਾਹ (£/ਸਾਲ)",
    availability: "ਉਪਲਬਧਤਾ", seniority: "ਅਨੁਭਵ ਦਾ ਪੱਧਰ", years: "ਅਨੁਭਵ ਦੇ ਸਾਲ",
    experience: "ਪਿਛਲਾ ਅਨੁਭਵ", education: "ਸਿੱਖਿਆ", qualifications: "ਯੋਗਤਾਵਾਂ",
    skills: "ਮੁੱਖ ਹੁਨਰ", languages: "ਭਾਸ਼ਾਵਾਂ",
    industries: "ਪਸੰਦੀਦਾ ਉਦਯੋਗ", industriesAvoid: "ਉਦਯੋਗ ਜਿਨ੍ਹਾਂ ਤੋਂ ਬਚਣਾ ਹੈ",
    strengths: "ਤਾਕਤ", weaknesses: "ਕਮਜ਼ੋਰੀ",
    cvText: "CV (ਟੈਕਸਟ ਪੇਸਟ ਕਰੋ)", cvPaste: "ਆਪਣਾ CV ਇੱਥੇ ਪੇਸਟ ਕਰੋ…", cvFilename: "CV ਫਾਈਲ ਨਾਮ",
    notes: "ਵਾਧੂ ਨੋਟ", notesPh: "ਕੁਝ ਹੋਰ ਜੋ ਸਾਨੂੰ ਜਾਣਨਾ ਚਾਹੀਦਾ ਹੈ?",
    savedTip: "ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਐਨਕ੍ਰਿਪਟ ਕੀਤੀ ਜਾਂਦੀ ਹੈ ਅਤੇ ਸਿਰਫ਼ ਨਿੱਜੀਕਰਨ ਲਈ ਵਰਤੀ ਜਾਂਦੀ ਹੈ।",
    saveAndExit: "ਸੇਵ ਕਰੋ ਅਤੇ ਬਾਹਰ ਨਿਕਲੋ", next: "ਅੱਗੇ", finish: "ਸਮਾਪਤ ਕਰੋ",
    signInFirst: "ਕਿਰਪਾ ਕਰਕੇ ਪਹਿਲਾਂ ਸਾਈਨ ਇਨ ਕਰੋ।",
  },
  footer: { privacy: "ਨਿੱਜਤਾ ਨੀਤੀ", terms: "ਸ਼ਰਤਾਂ", deletion: "ਡਾਟਾ ਮਿਟਾਓ", cookies: "ਕੁਕੀਜ਼" },
} as unknown as Translations;

export default pa;
