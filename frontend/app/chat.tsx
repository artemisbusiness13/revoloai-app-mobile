import React, { useEffect, useRef, useState } from "react";
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
import { Stack, useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Avatar } from "../components/Avatar";
import {
  AVATARS,
  AVATAR_META,
  AvatarKey,
  api,
  getOrCreateUserId,
} from "../lib/api";
import { useI18n } from "../lib/i18n";

type Msg = { id: string; role: "user" | "ai"; content: string };

export default function ChatScreen() {
  const params = useLocalSearchParams<{ avatar?: string }>();
  const key = ((params.avatar as AvatarKey) || "sofia") as AvatarKey;
  const meta = AVATAR_META[key];
  const { t, langName } = useI18n();
  const aName = t(`avatars.${key}.name`);
  const aRole = t(`avatars.${key}.role`);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [matching, setMatching] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const typingDot = useRef(new Animated.Value(0)).current;

  // intro on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      const uid = await getOrCreateUserId();
      try {
        setSending(true);
        const r = await api<{ session_id: string; reply: string; suggestions: string[] }>("/chat", {
          method: "POST",
          body: JSON.stringify({ avatar: key, message: "", user_id: uid, lang: langName }),
        });
        if (!alive) return;
        setSessionId(r.session_id);
        setMessages([{ id: "ai0", role: "ai", content: r.reply }]);
        setSuggestions(r.suggestions || []);
      } catch (e) {
        setMessages([
          { id: "ai0", role: "ai", content: t("chat.fallback", { name: aName }) },
        ]);
      } finally {
        if (alive) setSending(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, meta.name]);

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

  const send = async (text: string) => {
    const txt = text.trim();
    if (!txt || sending) return;
    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", content: txt };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    try {
      const uid = await getOrCreateUserId();
      const r = await api<{ session_id: string; reply: string; suggestions: string[] }>("/chat", {
        method: "POST",
        body: JSON.stringify({ avatar: key, message: txt, session_id: sessionId, user_id: uid, lang: langName }),
      });
      if (r.session_id) setSessionId(r.session_id);
      const ai: Msg = { id: `a${Date.now()}`, role: "ai", content: r.reply };
      setMessages((m) => [...m, ai]);
      setSuggestions(r.suggestions || []);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      setMessages((m) => [
        ...m,
        { id: `a${Date.now()}`, role: "ai", content: t("chat.lostConnection") },
      ]);
    } finally {
      setSending(false);
    }
  };

  // Maya-only: find matched jobs (extracts profile from chat then ranks)
  const findJobs = async () => {
    if (matching) return;
    setMatching(true);
    try {
      const uid = await getOrCreateUserId();
      if (sessionId) {
        await api("/profile/extract", {
          method: "POST",
          body: JSON.stringify({ user_id: uid, session_id: sessionId }),
        }).catch(() => {});
      }
      router.push({ pathname: "/jobs", params: { avatar: key } });
    } finally {
      setMatching(false);
    }
  };

  // Sofia-only: start a real adaptive interview
  const startInterview = async () => {
    if (matching) return;
    setMatching(true);
    try {
      const uid = await getOrCreateUserId();
      // Try to enrich from current chat first
      if (sessionId) {
        await api("/profile/extract", {
          method: "POST",
          body: JSON.stringify({ user_id: uid, session_id: sessionId }),
        }).catch(() => {});
      }
      const profile = await api<any>(`/profile/${uid}`).catch(() => null);
      const role = profile?.target_role || "Generalist";
      const seniority = profile?.seniority && profile.seniority !== "unknown" ? profile.seniority : "mid";
      router.push({
        pathname: "/interview",
        params: { role, seniority, total: "5" },
      });
    } finally {
      setMatching(false);
    }
  };

  const onMic = async () => {
    // Prepare voice interaction: ask for permission on native, simulate on web
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (Platform.OS === "web") {
      try {
        const stream = await (navigator as any).mediaDevices?.getUserMedia?.({ audio: true });
        if (stream) {
          stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
          setListening(true);
          setTimeout(() => setListening(false), 1500);
        } else {
          Alert.alert(t("chat.micUnavailable"), t("chat.micUnavailableMsg"));
        }
      } catch {
        Alert.alert(t("chat.micDenied"));
      }
      return;
    }
    setListening(true);
    setTimeout(() => setListening(false), 1500);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: meta.soft }]}>
          <Pressable
            testID="chat-close-btn"
            onPress={() => router.back()}
            style={styles.headerBtn}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={22} color="#0B0F19" />
          </Pressable>
          <View style={[styles.headerAvatar, { borderColor: meta.color }]}>
            <Avatar uri={AVATARS[key]} size={38} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.headerName}>{aName}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: "#10B981" }]} />
              <Text style={styles.statusText}>{listening ? t("chat.listening") : sending ? t("chat.typing") : aRole}</Text>
            </View>
          </View>
          <Pressable testID="chat-info-btn" style={styles.headerBtn} hitSlop={10} onPress={() => Alert.alert(aName, `${aRole} — ${t("chat.info", { name: aName })}`)}>
            <Ionicons name="information-circle-outline" size={22} color="#5B6577" />
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
            {messages.map((m) => (
              <View
                key={m.id}
                style={[
                  styles.bubble,
                  m.role === "user"
                    ? [styles.bubbleUser, { backgroundColor: meta.color }]
                    : styles.bubbleAi,
                ]}
              >
                <Text style={m.role === "user" ? styles.bubbleUserText : styles.bubbleAiText}>
                  {m.content}
                </Text>
              </View>
            ))}
            {sending && messages.length > 0 && (
              <View style={[styles.bubble, styles.bubbleAi, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                <Animated.View style={[styles.typingDot, { opacity: typingDot }]} />
                <Animated.View style={[styles.typingDot, { opacity: typingDot, transform: [{ translateY: typingDot.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }]} />
                <Animated.View style={[styles.typingDot, { opacity: typingDot }]} />
              </View>
            )}
          </ScrollView>

          {/* Suggestions */}
          {!!suggestions.length && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggRow}
            >
              {(key === "maya" || key === "sofia") && (
                <Pressable
                  testID={key === "maya" ? "chat-find-jobs" : "chat-start-interview"}
                  onPress={key === "maya" ? findJobs : startInterview}
                  style={[styles.suggChip, { backgroundColor: meta.color, borderColor: meta.color }]}
                  disabled={matching}
                >
                  {matching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons
                      name={key === "maya" ? "briefcase" : "play"}
                      size={12}
                      color="#fff"
                    />
                  )}
                  <Text style={[styles.suggText, { color: "#fff" }]}>
                    {key === "maya" ? t("chat.findJobs") : t("chat.startInterview")}
                  </Text>
                </Pressable>
              )}
              {suggestions.map((s, i) => (
                <Pressable
                  key={s + i}
                  testID={`chat-suggestion-${i}`}
                  onPress={() => send(s)}
                  style={[styles.suggChip, { borderColor: meta.color }]}
                >
                  <Ionicons name="sparkles-outline" size={12} color={meta.color} />
                  <Text style={[styles.suggText, { color: meta.color }]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Input */}
          <View style={styles.inputRow}>
            <Pressable
              testID="chat-mic-btn"
              onPress={onMic}
              style={[styles.micBtn, { backgroundColor: listening ? meta.color : "#F2F3F7" }]}
            >
              <Ionicons name={listening ? "radio" : "mic"} size={18} color={listening ? "#fff" : meta.color} />
            </Pressable>
            <TextInput
              testID="chat-input"
              style={styles.input}
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
