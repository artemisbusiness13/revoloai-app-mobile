import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import en from "./translations/en";
import ro from "./translations/ro";
import pl from "./translations/pl";
import es from "./translations/es";
import pa from "./translations/pa";
import ur from "./translations/ur";
import { Translations } from "./translations/types";

const DICTS: Record<string, Translations> = { en, ro, pl, es, pa, ur };
const STORAGE_KEY = "revolo.lang";

export type LangCode = keyof typeof DICTS;

export const SUPPORTED_LANGS: { code: LangCode; name: string; native: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", name: "English",  native: "English",  dir: "ltr" },
  { code: "ro", name: "Romanian", native: "Română",   dir: "ltr" },
  { code: "pl", name: "Polish",   native: "Polski",   dir: "ltr" },
  { code: "es", name: "Spanish",  native: "Español",  dir: "ltr" },
  { code: "pa", name: "Punjabi",  native: "ਪੰਜਾਬੀ",     dir: "ltr" },
  { code: "ur", name: "Urdu",     native: "اردو",      dir: "rtl" },
];

type Ctx = {
  lang: LangCode;
  setLang: (l: LangCode) => Promise<void>;
  t: (path: string, vars?: Record<string, string | number>) => string;
  tArr: (path: string) => string[];
  ready: boolean;
  langName: string; // English-language name (sent to LLM)
};

const I18nCtx = createContext<Ctx | null>(null);

function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

function format(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY);
        if (v && v in DICTS) {
          setLangState(v as LangCode);
        } else {
          // First visit — auto-detect from browser/device locale (best-effort).
          // Maps the BCP-47 primary subtag to one of our 6 supported codes.
          let detected: LangCode | null = null;
          try {
            if (Platform.OS === "web" && typeof navigator !== "undefined") {
              const langs: string[] = (navigator.languages && navigator.languages.length
                ? navigator.languages
                : [navigator.language || "en"]) as string[];
              const map: Record<string, LangCode> = {
                en: "en", ro: "ro", pl: "pl", es: "es",
                pa: "pa", ur: "ur",
                // Common aliases / regional variants
                "es-mx": "es", "es-ar": "es", "es-es": "es",
                "en-gb": "en", "en-us": "en",
                "pa-in": "pa", "pa-pk": "pa",
                "ur-pk": "ur", "ur-in": "ur",
              };
              for (const l of langs) {
                const lower = String(l || "").toLowerCase();
                if (map[lower]) { detected = map[lower]; break; }
                const primary = lower.split("-")[0];
                if (map[primary]) { detected = map[primary]; break; }
              }
            }
          } catch {}
          if (detected) {
            setLangState(detected);
            // Persist so subsequent loads don't re-detect (user may have
            // a different browser/OS lang than what they prefer in-app).
            try { await AsyncStorage.setItem(STORAGE_KEY, detected); } catch {}
          }
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  const setLang = useCallback(async (l: LangCode) => {
    if (!(l in DICTS)) return;
    setLangState(l);
    try { await AsyncStorage.setItem(STORAGE_KEY, l); } catch {}
    // Apply RTL direction on web for Urdu (and any future RTL locale)
    if (Platform.OS === "web") {
      try {
        const dir = SUPPORTED_LANGS.find((s) => s.code === l)?.dir || "ltr";
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("dir", dir);
          document.documentElement.setAttribute("lang", String(l));
        }
      } catch {}
    }
  }, []);

  // On boot, also apply dir/lang attributes for the loaded language
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const dir = SUPPORTED_LANGS.find((s) => s.code === lang)?.dir || "ltr";
      document.documentElement.setAttribute("dir", dir);
      document.documentElement.setAttribute("lang", String(lang));
    }
  }, [lang]);

  const dict = DICTS[lang] || DICTS.en;

  const t = useCallback((path: string, vars?: Record<string, string | number>) => {
    const v = getByPath(dict, path);
    if (typeof v === "string") return format(v, vars);
    // graceful fallback to english
    const fb = getByPath(DICTS.en, path);
    if (typeof fb === "string") return format(fb, vars);
    return path; // last resort: show key
  }, [dict]);

  const tArr = useCallback((path: string) => {
    const v = getByPath(dict, path);
    if (Array.isArray(v)) return v as string[];
    const fb = getByPath(DICTS.en, path);
    return Array.isArray(fb) ? (fb as string[]) : [];
  }, [dict]);

  const langName = SUPPORTED_LANGS.find((s) => s.code === lang)?.name || "English";

  const value = useMemo(() => ({ lang, setLang, t, tArr, ready, langName }), [lang, setLang, t, tArr, ready, langName]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nCtx);
  if (c) return c;
  // Fallback for environments where the provider isn't mounted (e.g. SSR pre-render
  // or a deeply isolated test) — returns safe English-only defaults.
  const noop = async () => {};
  const fb = (path: string, vars?: Record<string, string | number>) => {
    const v = getByPath(en, path);
    if (typeof v === "string") return format(v, vars);
    return path;
  };
  const fbArr = (path: string) => {
    const v = getByPath(en, path);
    return Array.isArray(v) ? (v as string[]) : [];
  };
  return { lang: "en", setLang: noop, t: fb, tArr: fbArr, ready: true, langName: "English" };
}

export function getDict(lang: LangCode): Translations {
  return DICTS[lang] || DICTS.en;
}
