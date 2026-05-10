// Lightweight cross-browser voice helpers (Web Speech API).
// Designed to FAIL SAFELY on unsupported browsers / native — chat keeps
// working in text-only mode.
//
// Usage:
//   import { speak, stopSpeaking, startListening, voiceSupport } from "../lib/voice";
//
// All functions are no-ops on native (Platform.OS !== "web") or when the
// browser lacks the relevant API.
import { Platform } from "react-native";

// BCP-47 language tags for STT/TTS. Used to set SpeechRecognition.lang and
// pick a SpeechSynthesis voice. Falls back to "en-US" for unknown.
const LANG_TAG: Record<string, string> = {
  en: "en-US",
  ro: "ro-RO",
  pl: "pl-PL",
  es: "es-ES",
  pa: "pa-IN",
  ur: "ur-PK",
};

export function bcp47(langCode: string): string {
  return LANG_TAG[langCode] || "en-US";
}

export type VoiceSupport = {
  stt: boolean; // Speech-to-Text (mic)
  tts: boolean; // Text-to-Speech (speaker)
};

export function voiceSupport(): VoiceSupport {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return { stt: false, tts: false };
  }
  const w = window as any;
  const stt = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
  const tts = !!(w.speechSynthesis && typeof w.SpeechSynthesisUtterance === "function");
  return { stt, tts };
}

// ---------- TTS ----------
let _currentUtterance: any = null;

export function stopSpeaking() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    (window as any).speechSynthesis?.cancel?.();
    _currentUtterance = null;
  } catch {}
}

export function speak(text: string, langCode: string): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  const w = window as any;
  if (!w.speechSynthesis || typeof w.SpeechSynthesisUtterance !== "function") return false;
  if (!text || !text.trim()) return false;
  try {
    // Cancel anything in progress so replies don't queue forever
    w.speechSynthesis.cancel();
    const utter = new w.SpeechSynthesisUtterance(text);
    utter.lang = bcp47(langCode);
    utter.rate = 1;
    utter.pitch = 1;
    // Try to pick a matching voice (best-effort; voices may load async on some browsers)
    const voices: any[] = (w.speechSynthesis.getVoices && w.speechSynthesis.getVoices()) || [];
    if (voices && voices.length) {
      const tag = utter.lang.toLowerCase();
      const exact = voices.find((v) => (v.lang || "").toLowerCase() === tag);
      const partial =
        exact ||
        voices.find((v) => (v.lang || "").toLowerCase().startsWith(tag.split("-")[0]));
      if (partial) utter.voice = partial;
    }
    _currentUtterance = utter;
    w.speechSynthesis.speak(utter);
    return true;
  } catch {
    return false;
  }
}

// ---------- STT ----------
export type ListenHandle = {
  stop: () => void;
};

export type ListenCallbacks = {
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (err: string) => void;
  onEnd?: () => void;
};

export function startListening(langCode: string, cb: ListenCallbacks): ListenHandle | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const w = window as any;
  const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Rec) return null;
  let stopped = false;
  try {
    const rec = new Rec();
    rec.lang = bcp47(langCode);
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = r[0]?.transcript || "";
        if (r.isFinal) finalText += txt;
        else interim += txt;
      }
      const combined = (finalText + interim).trim();
      if (combined) cb.onResult(combined, !!finalText);
    };
    rec.onerror = (e: any) => {
      const err = e?.error || "error";
      try { cb.onError?.(err); } catch {}
    };
    rec.onend = () => {
      try { cb.onEnd?.(); } catch {}
    };
    rec.start();
    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        try { rec.stop(); } catch {}
      },
    };
  } catch (e: any) {
    try { cb.onError?.(String(e?.message || e)); } catch {}
    return null;
  }
}
