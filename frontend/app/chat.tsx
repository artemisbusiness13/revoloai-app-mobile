import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Avatar } from "../components/Avatar";
import { useC, ThemeToggle, AvatarBubbleSkeleton } from "../components/ui";
import {
  AVATARS,
  AVATAR_META,
  AvatarKey,
  api,
  getOrCreateUserId,
} from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import {
  speak,
  stopSpeaking,
  startListening,
  voiceSupport,
} from "../lib/voice";

type Msg = { id: string; role: "user" | "ai"; content: string };

const SPEAKER_PREF_KEY = "revolo.voice.speaker";

export default function ChatScreen() {
  const params = useLocalSearchParams<{ avatar?: string }>();
  const key = ((params.avatar as AvatarKey) || "sofia") as AvatarKey;
  const meta = AVATAR_META[key];
  const { t, langName, lang } = useI18n();
  const { user } = useAuth();
  const C = useC();
  const isRTL = lang === "ur";
  const aName = t(`avatars.${key}.name`);
  const aRole = t(`avatars.${key}.role`);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [matching, setMatching] = useState(false);
  const [mayaPaid, setMayaPaid] = useState<boolean>(false);
  // Voice toggles & support flags
  const [speakerOn, setSpeakerOn] = useState(false); // default OFF (per requirements)
  const [vSupport] = useState(() => voiceSupport());
  const lastInputViaMicRef = useRef<boolean>(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const typingDot = useRef(new Animated.Value(0)).current;

  // Load speaker preference (per device)
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(SPEAKER_PREF_KEY);
        if (v === "1") setSpeakerOn(true);
      } catch {}
    })();
  }, []);

  // Stop any speech when leaving screen, switching avatar, or changing language
  useEffect(() => {
    return () => {
      stopSpeaking();
      try { recRef.current?.stop(); } catch {}
    };
  }, []);
  useEffect(() => {
    // Stop speaking when language changes so we don't read stale text in wrong voice
    stopSpeaking();
  }, [lang]);

  // Simple local greeting — NO backend call by default.
  // When the user is LOGGED IN AND has a completed onboarding profile, build
  // a deterministic context summary from the saved profile fields so we
  // NEVER hallucinate or repeat questions.
  const [profile, setProfile] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    const first = (user?.name || "").trim().split(/\s+/)[0] || "";
    const fallbackLine1 = first
      ? t("chat.greetWithName", { name: first })
      : t("chat.greet");
    const fallbackLine2 = t("chat.greetSub");
    const fallback = `${fallbackLine1}\n${fallbackLine2}`;
    // Default to the simple greeting immediately so the UI never feels stuck.
    setMessages([{ id: "ai0", role: "ai", content: fallback }]);
    setSuggestions([]);
    setProfile(null);
    if (!user?.user_id) return;
    (async () => {
      try {
        const r = await api<any>(`/profile/${user.user_id}`);
        if (!alive) return;
        if (!r || !r.target_role) {
          setProfile(r || null);
          return; // keep the simple greeting
        }
        setProfile(r);
        // Build deterministic search-criteria summary line. Only include
        // fields that actually have values — NO invented data.
        const fields: string[] = [];
        if (r.target_role) fields.push(String(r.target_role));
        if (r.location) fields.push(String(r.location));
        // remote can be "remote", "hybrid", "onsite", "any"
        const remote = String(r.remote || "").toLowerCase();
        if (remote && remote !== "any" && remote !== "unknown") fields.push(remote);
        const minS = Number(r.salary_min || 0);
        const maxS = Number(r.salary_max || 0);
        if (minS && maxS) fields.push(`£${minS.toLocaleString()}–£${maxS.toLocaleString()}`);
        else if (minS) fields.push(`from £${minS.toLocaleString()}`);
        else if (maxS) fields.push(`up to £${maxS.toLocaleString()}`);
        const summary = fields.join(", ");
        // Per-avatar wording
        let line1 = first ? t("chat.greetWithName", { name: first }) : t("chat.greet");
        let line2: string;
        if (key === "maya") {
          line2 = summary
            ? t("chat.profileSearchSummary", { summary }) + "\n" + t("chat.profileStartSearchQ")
            : t("chat.profileSavedNoFields");
        } else if (key === "sofia") {
          line2 = summary
            ? t("chat.profilePrepSummary", { summary }) + "\n" + t("chat.profileStartPrepQ")
            : t("chat.profileSavedNoFields");
        } else {
          // aria
          line2 = summary
            ? t("chat.profileCoachSummary", { summary }) + "\n" + t("chat.profileStartCoachQ")
            : t("chat.profileSavedNoFields");
        }
        setMessages([{ id: "ai0", role: "ai", content: `${line1}\n${line2}` }]);
      } catch {
        /* keep fallback greeting */
      }
    })();
    return () => { alive = false; };
  }, [key, lang, user?.user_id, user?.name, t]);

  useEffect(() => {
    if (sending) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingDot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(typingDot, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      typingDot.stopAnimation();
    }
  }, [sending, typingDot]);

  // Refresh Maya's paid status whenever the screen mounts or the user
  // returns from a Stripe redirect. Used to decide what the "Find jobs"
  // CTA button does: load matches (paid) or open checkout (unpaid).
  const refreshPaidStatus = useCallback(async () => {
    if (key !== "maya" || !user?.user_id) {
      setMayaPaid(false);
      return;
    }
    try {
      const purchases = await api<any[]>(`/purchases?user_id=${user.user_id}`);
      const paid = (purchases || []).some(
        (p) => (p?.avatar === "maya" || (p?.item_id || "").startsWith("jobs-") || p?.item_id === "bundle-starter") && p?.status === "paid"
      );
      setMayaPaid(paid);
    } catch {
      setMayaPaid(false);
    }
  }, [key, user?.user_id]);

  useFocusEffect(
    React.useCallback(() => {
      refreshPaidStatus();
    }, [refreshPaidStatus])
  );

  const send = async (text: string, opts?: { fromMic?: boolean }) => {
    const txt = text.trim();
    if (!txt || sending) return;
    // Stop any in-progress TTS before sending another message
    stopSpeaking();
    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", content: txt };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    try {
      // Prefer the authenticated user_id so the backend can find the saved
      // profile (anonymous guest IDs have no profile row).
      const uid = user?.user_id || (await getOrCreateUserId());
      const r = await api<{ session_id: string; reply: string; suggestions: string[] }>("/chat", {
        method: "POST",
        body: JSON.stringify({ avatar: key, message: txt, session_id: sessionId, user_id: uid, lang: langName }),
      });
      if (r.session_id) setSessionId(r.session_id);
      const ai: Msg = { id: `a${Date.now()}`, role: "ai", content: r.reply };
      setMessages((m) => [...m, ai]);
      setSuggestions(r.suggestions || []);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
      // Auto-speak reply ONLY when speaker is ON AND user input came from mic
      const shouldSpeak = !!(opts?.fromMic) && speakerOn && vSupport.tts;
      if (shouldSpeak && r.reply) {
        try { speak(r.reply, lang); } catch {}
      }
      // reset mic flag after handling
      lastInputViaMicRef.current = false;
    } catch {
      setMessages((m) => [
        ...m,
        { id: `a${Date.now()}`, role: "ai", content: t("chat.lostConnection") },
      ]);
    } finally {
      setSending(false);
    }
  };

  // Maya-only: find matched jobs. We no longer auto-extract a fresh profile
  // from the chat transcript before searching — that was OVERWRITING the
  // user's onboarding-saved target_role / location / salary with whatever
  // Claude inferred from the chat (e.g. "Software Engineer" from a sample
  // greeting), which then produced wrong Adzuna results. We now rely
  // strictly on the saved profile.
  const findJobs = async () => {
    if (matching) return;
    setMatching(true);
    try {
      router.push({ pathname: "/jobs", params: { avatar: key } });
    } finally {
      setMatching(false);
    }
  };

  // Sofia-only: start a real adaptive interview. Same protection — only
  // extract when the profile is INCOMPLETE so we never clobber user-saved
  // onboarding values.
  const startInterview = async () => {
    if (matching) return;
    setMatching(true);
    try {
      const uid = user?.user_id || (await getOrCreateUserId());
      const prof = await api<any>(`/profile/${uid}`).catch(() => null);
      // Only call extract when the profile has NEVER been completed (rare —
      // typically signup → onboarding → profile.completed=true). overwrite=false
      // is the new safe default but we double-gate here for clarity.
      if (sessionId && !prof?.completed) {
        await api("/profile/extract", {
          method: "POST",
          body: JSON.stringify({ user_id: uid, session_id: sessionId, overwrite: false }),
        }).catch(() => {});
      }
      const role = prof?.target_role || "Generalist";
      const seniority = prof?.seniority && prof.seniority !== "unknown" ? prof.seniority : "mid";
      router.push({
        pathname: "/interview",
        params: { role, seniority, total: "5" },
      });
    } finally {
      setMatching(false);
    }
  };

  const onFindJobsCta = useCallback(async () => {
    if (matching) return;
    // Logged out: route to home with signin modal, same UX as /checkout guard
    if (!user?.user_id) {
      router.replace({ pathname: "/", params: { signin: "1" } });
      return;
    }
    if (mayaPaid) {
      await findJobs();
      return;
    }
    // Not paid → open checkout with the basic Job Search plan.
    router.push({
      pathname: "/checkout",
      params: {
        avatar: "maya",
        item_id: "jobs-3",
        title: t("chat.findJobsPlanTitle"),
        price: "£3.99",
        kind: "service",
      },
    });
  }, [matching, user?.user_id, mayaPaid, findJobs, t]);

  // Detect if a given AI message contains a job-search CTA (the model said
  // "press the find-jobs button" or similar). Multilingual.
  const ctaRegex = React.useMemo(
    () =>
      /(\bfind\s+jobs?\b|\bstart\s+(the\s+)?(search|matching)\b|\bshow\s+(me\s+)?(the\s+)?matches\b|\brun\s+the\s+search\b|caut[ăa]\s+(joburi|locuri\s+de\s+munc[ăa])|porne(?:s|ș)te\s+c[ăa]utarea|incepe\s+c[ăa]utarea|znajdź\s+oferty|rozpocznij\s+wyszukiwanie|zacznij\s+szukać|buscar\s+empleos?|empezar\s+(la\s+)?búsqueda|comenzar\s+la\s+búsqueda|iniciar\s+búsqueda|ਨੌਕਰੀਆਂ\s+ਲੱਭੋ|ملازمت(?:یں)?\s+تلاش|تلاش\s+شروع)/i,
    []
  );

  // Decide whether to render the inline "Find jobs" CTA button under the
  // LAST Maya AI message that suggests starting the search. We render it
  // only once (under the most-recent matching AI bubble) so the chat stays
  // tidy when scrolling history.
  const lastCtaIndex = React.useMemo(() => {
    if (key !== "maya") return -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "ai") continue;
      if (ctaRegex.test(m.content)) return i;
    }
    return -1;
  }, [key, messages, ctaRegex]);

  const toggleSpeaker = useCallback(async () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    try { await AsyncStorage.setItem(SPEAKER_PREF_KEY, next ? "1" : "0"); } catch {}
    if (!next) stopSpeaking();
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  }, [speakerOn]);

  const stopMic = useCallback(() => {
    try { recRef.current?.stop(); } catch {}
    recRef.current = null;
    setListening(false);
  }, []);

  const onMic = async () => {
    // If already listening, treat tap as STOP
    if (listening) { stopMic(); return; }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Native (iOS/Android) fallback — informative alert; text input still works
    if (Platform.OS !== "web") {
      Alert.alert(t("chat.micUnavailable"), t("chat.micUnavailableMsg"));
      return;
    }

    // Browser STT support check
    if (!vSupport.stt) {
      Alert.alert(t("chat.micUnavailable"), t("chat.micUnavailableMsg"));
      return;
    }

    // Stop TTS first so it doesn't bleed into the mic
    stopSpeaking();

    // Request mic permission first (gives user-friendly error)
    try {
      const stream = await (navigator as any).mediaDevices?.getUserMedia?.({ audio: true });
      // Immediately stop the test stream — SpeechRecognition opens its own
      stream?.getTracks?.().forEach((tr: MediaStreamTrack) => tr.stop());
    } catch {
      Alert.alert(t("chat.micDenied"));
      return;
    }

    let finalCaptured = "";
    setListening(true);
    const handle = startListening(lang, {
      onResult: (text, isFinal) => {
        // Live preview in the input field
        setInput(text);
        if (isFinal) finalCaptured = text;
      },
      onError: () => {
        setListening(false);
        recRef.current = null;
      },
      onEnd: () => {
        setListening(false);
        recRef.current = null;
        const captured = (finalCaptured || "").trim();
        if (captured) {
          // Mark this as mic-originated and send
          lastInputViaMicRef.current = true;
          // Slight delay so UI shows captured text briefly
          setTimeout(() => send(captured, { fromMic: true }), 60);
        }
      },
    });
    if (!handle) {
      setListening(false);
      Alert.alert(t("chat.micUnavailable"), t("chat.micUnavailableMsg"));
      return;
    }
    recRef.current = handle;
  };

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: meta.soft }, Platform.OS === "web" && ({ direction: "ltr" } as any)]}>
          <Pressable
            testID="chat-close-btn"
            onPress={() => router.back()}
            style={styles.headerBtn}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </Pressable>
          <View style={[styles.headerAvatar, { borderColor: meta.color }]}>
            <Avatar uri={AVATARS[key]} size={38} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.headerName, { color: C.text }]}>{aName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: "#10B981" }]} />
              <Text style={[styles.statusText, { color: C.text2 }]}>{listening ? t("chat.listening") : sending ? t("chat.typing") : aRole}</Text>
            </View>
          </View>
          <ThemeToggle />
          <Pressable
            testID="chat-speaker-btn"
            style={styles.headerBtn}
            hitSlop={10}
            onPress={toggleSpeaker}
            accessibilityLabel={speakerOn ? t("chat.speakerOn") : t("chat.speakerOff")}
          >
            <Ionicons
              name={speakerOn ? "volume-high" : "volume-mute"}
              size={20}
              color={speakerOn ? meta.color : C.text2}
            />
          </Pressable>
          <Pressable testID="chat-info-btn" style={styles.headerBtn} hitSlop={10} onPress={() => Alert.alert(aName, `${aRole} — ${t("chat.info", { name: aName })}`)}>
            <Ionicons name="information-circle-outline" size={22} color={C.text2} />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.body}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((m, idx) => (
              <React.Fragment key={m.id}>
                <View
                  style={[
                    styles.bubble,
                    m.role === "user"
                      ? [styles.bubbleUser, { backgroundColor: meta.color }]
                      : [styles.bubbleAi, { backgroundColor: C.card, borderColor: C.border }],
                  ]}
                >
                  <Text
                    style={[
                      m.role === "user" ? styles.bubbleUserText : [styles.bubbleAiText, { color: C.text }],
                      isRTL && { writingDirection: "rtl", textAlign: "right" },
                    ]}
                  >
                    {m.content}
                  </Text>
                </View>
                {/* Inline "Find jobs" CTA — only under Maya AI messages that
                   suggest starting the job search, rendered once (latest match). */}
                {idx === lastCtaIndex && (
                  <Pressable
                    testID="chat-find-jobs-cta"
                    onPress={onFindJobsCta}
                    disabled={matching}
                    style={({ pressed }) => [
                      styles.ctaBtn,
                      { backgroundColor: meta.color, opacity: pressed || matching ? 0.85 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t("chat.findJobsCta")}
                  >
                    {matching ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="search" size={16} color="#fff" />
                        <Text style={styles.ctaBtnText}>{t("chat.findJobsCta")}</Text>
                        {!mayaPaid && user?.user_id ? (
                          <View style={styles.ctaPriceTag}>
                            <Text style={styles.ctaPriceTagText}>£3.99</Text>
                          </View>
                        ) : null}
                      </>
                    )}
                  </Pressable>
                )}
              </React.Fragment>
            ))}
            {sending && messages.length > 0 && (
              <View style={[styles.bubble, styles.bubbleAi, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                <Animated.View style={[styles.typingDot, { opacity: typingDot }]} />
                <Animated.View style={[styles.typingDot, { opacity: typingDot, transform: [{ translateY: typingDot.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }]} />
                <Animated.View style={[styles.typingDot, { opacity: typingDot }]} />
              </View>
            )}
          </ScrollView>

          {/* Suggestions removed — chat stays clean & conversational */}

          {/* Input */}
          <View style={[styles.inputRow, Platform.OS === "web" && ({ direction: "ltr" } as any)]}>
            <Pressable
              testID="chat-mic-btn"
              onPress={onMic}
              accessibilityLabel={listening ? t("chat.listening") : (vSupport.stt || Platform.OS !== "web" ? "Voice input" : t("chat.voiceUnsupported"))}
              style={[
                styles.micBtn,
                {
                  backgroundColor: listening ? meta.color : "#F2F3F7",
                  opacity: !vSupport.stt && Platform.OS === "web" ? 0.55 : 1,
                },
              ]}
            >
              <Ionicons
                name={listening ? "radio" : (vSupport.stt || Platform.OS !== "web" ? "mic" : "mic-off")}
                size={18}
                color={listening ? "#fff" : meta.color}
              />
            </Pressable>
            <TextInput
              testID="chat-input"
              style={[styles.input, isRTL && { textAlign: "right", writingDirection: "rtl" }]}
              placeholder={t("chat.placeholder", { name: aName })}
              placeholderTextColor="#8A93A6"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
              multiline
            />
            <Pressable
              testID="chat-send-btn"
              onPress={() => send(input)}
              disabled={!input.trim() || sending}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: !input.trim() || sending ? "#CBD0DE" : meta.color,
                },
              ]}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="arrow-up" size={18} color="#fff" />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAFAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  headerName: { fontSize: 15, fontWeight: "800", color: "#0B0F19" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, color: "#5B6577", fontWeight: "600" },

  body: { padding: 16, gap: 8, paddingBottom: 8 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, maxWidth: "85%" },
  bubbleAi: { backgroundColor: "#FFFFFF", alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#ECEEF3" },
  bubbleAiText: { fontSize: 14, color: "#0B0F19", lineHeight: 20 },
  bubbleUser: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleUserText: { fontSize: 14, color: "#fff", lineHeight: 20 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#8A93A6" },

  // Inline "Find jobs" CTA shown under Maya AI messages that suggest starting
  // the search. Sits below the bubble, full-width-ish but capped, primary tint.
  ctaBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 4,
    minHeight: 40,
  },
  ctaBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  ctaPriceTag: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 4,
  },
  ctaPriceTagText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  suggRow: { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  suggChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#fff",
    marginRight: 8,
  },
  suggText: { fontSize: 12, fontWeight: "700" },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#ECEEF3",
  },
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    backgroundColor: "#F2F3F7",
    borderRadius: 21,
    fontSize: 14,
    color: "#0B0F19",
    ...(Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {}),
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
