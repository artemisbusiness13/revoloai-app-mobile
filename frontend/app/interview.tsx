import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../components/Avatar";
import { AVATARS, AVATAR_META, api, getOrCreateUserId } from "../lib/api";

const C_SOFIA = "#EC4899";

type Question = { question: string; category: string; difficulty: string };
type Score = { star_coverage: number; clarity: number; confidence: number; content_depth: number; structure: number; feedback?: string; strengths?: string[]; improvements?: string[] };

export default function InterviewScreen() {
  const params = useLocalSearchParams<{ role?: string; seniority?: string; total?: string }>();
  const role = params.role || "Generalist";
  const seniority = params.seniority || "mid";
  const total = parseInt((params.total as string) || "5", 10);

  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [current, setCurrent] = useState(1);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastScore, setLastScore] = useState<Score | null>(null);
  const [starting, setStarting] = useState(true);
  const meta = AVATAR_META.sofia;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        setStarting(true);
        const uid = await getOrCreateUserId();
        const r = await api<{ interview_id: string; question: Question; current: number; total: number }>("/interview/start", {
          method: "POST",
          body: JSON.stringify({ user_id: uid, role, seniority, style: "behavioural", total_questions: total }),
        });
        setInterviewId(r.interview_id);
        setQuestion(r.question);
        setCurrent(r.current);
        Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      } finally {
        setStarting(false);
      }
    })();
  }, [role, seniority, total, fade]);

  const submit = async () => {
    const t = answer.trim();
    if (!t || !interviewId || submitting) return;
    setSubmitting(true);
    try {
      const r = await api<any>("/interview/answer", {
        method: "POST",
        body: JSON.stringify({ interview_id: interviewId, answer: t }),
      });
      setLastScore(r.score || null);
      if (r.done) {
        setTimeout(() => {
          router.replace({ pathname: "/results", params: { interview_id: interviewId } });
        }, 900);
      } else {
        setQuestion(r.next_question);
        setCurrent(r.current);
        setAnswer("");
        fade.setValue(0);
        Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={st.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={st.header}>
          <Pressable testID="itv-close" onPress={() => router.back()} style={st.iconBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color="#0B0F19" />
          </Pressable>
          <View style={[st.avatarRing, { borderColor: C_SOFIA }]}>
            <Avatar uri={AVATARS.sofia} size={36} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={st.hTitle}>Mock interview</Text>
            <Text style={st.hSub}>{role} · {seniority}</Text>
          </View>
          <View style={st.progressBox}>
            <Text style={st.progressText}>{current}/{total}</Text>
          </View>
        </View>

        <View style={st.progressBar}>
          <View style={[st.progressFill, { width: `${(current / total) * 100}%`, backgroundColor: C_SOFIA }]} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {starting ? (
              <View style={{ alignItems: "center", marginTop: 40 }}>
                <ActivityIndicator color={C_SOFIA} />
                <Text style={{ marginTop: 10, color: "#5B6577" }}>Sofia is preparing…</Text>
              </View>
            ) : question ? (
              <Animated.View style={{ opacity: fade }}>
                <Text style={st.qLabel}>QUESTION {current}</Text>
                <Text style={st.qText}>{question.question}</Text>
                <View style={st.qMetaRow}>
                  <View style={st.qBadge}><Text style={st.qBadgeText}>{question.category}</Text></View>
                  <View style={[st.qBadge, { backgroundColor: "#FDECF5" }]}><Text style={[st.qBadgeText, { color: C_SOFIA }]}>{question.difficulty}</Text></View>
                </View>
              </Animated.View>
            ) : null}

            {lastScore && (
              <View testID="last-score" style={st.scoreCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={{ fontWeight: "800", color: "#0B0F19" }}>Quick feedback on last answer</Text>
                </View>
                {!!lastScore.feedback && <Text style={{ color: "#5B6577", marginBottom: 8, lineHeight: 18 }}>{lastScore.feedback}</Text>}
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  <Tile label="STAR" v={lastScore.star_coverage} />
                  <Tile label="Clarity" v={lastScore.clarity} />
                  <Tile label="Confidence" v={lastScore.confidence} />
                  <Tile label="Depth" v={lastScore.content_depth} />
                  <Tile label="Structure" v={lastScore.structure} />
                </View>
              </View>
            )}
          </ScrollView>

          <View style={st.bottom}>
            <TextInput
              testID="itv-answer"
              style={st.input}
              placeholder="Speak your answer…"
              placeholderTextColor="#8A93A6"
              multiline
              value={answer}
              onChangeText={setAnswer}
            />
            <Pressable
              testID="itv-submit"
              onPress={submit}
              disabled={!answer.trim() || submitting}
              style={[st.submitBtn, { backgroundColor: !answer.trim() || submitting ? "#CBD0DE" : C_SOFIA }]}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={st.submitText}>Submit answer</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Tile({ label, v }: { label: string; v: number }) {
  const color = v >= 75 ? "#10B981" : v >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <View style={{ paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#F2F3F7", borderRadius: 10, flexDirection: "row", gap: 6, alignItems: "center" }}>
      <Text style={{ fontSize: 11, color: "#5B6577", fontWeight: "700" }}>{label}</Text>
      <Text style={{ fontSize: 12, color, fontWeight: "800" }}>{v}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAFAFB" },
  header: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#fff" },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, overflow: "hidden", backgroundColor: "#fff" },
  hTitle: { fontSize: 15, fontWeight: "800", color: "#0B0F19" },
  hSub: { fontSize: 12, color: "#5B6577", marginTop: 2, textTransform: "capitalize" },
  progressBox: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#FDECF5", borderRadius: 999 },
  progressText: { color: C_SOFIA, fontWeight: "800", fontSize: 12 },
  progressBar: { height: 3, backgroundColor: "#ECEEF3" },
  progressFill: { height: "100%" },
  qLabel: { fontSize: 11, fontWeight: "800", color: "#5B6577", letterSpacing: 0.4 },
  qText: { fontSize: 22, fontWeight: "800", color: "#0B0F19", marginTop: 8, lineHeight: 30 },
  qMetaRow: { flexDirection: "row", gap: 6, marginTop: 12 },
  qBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "#F2F3F7" },
  qBadgeText: { fontSize: 11, color: "#5B6577", fontWeight: "700", textTransform: "capitalize" },
  scoreCard: { backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#ECEEF3", marginTop: 18 },
  bottom: { padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#ECEEF3", gap: 10 },
  input: { minHeight: 80, maxHeight: 200, padding: 12, backgroundColor: "#F2F3F7", borderRadius: 14, fontSize: 14, color: "#0B0F19", textAlignVertical: "top", ...(Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {}) },
  submitBtn: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 14, borderRadius: 999 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
