import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Polygon, Polyline, Circle, Text as SvgText, Line } from "react-native-svg";
import { Avatar } from "../components/Avatar";
import { AVATARS, api } from "../lib/api";
import { useI18n } from "../lib/i18n";

const SOFIA = "#EC4899";
const AXES = [
  { key: "star_coverage", label: "STAR" },
  { key: "clarity", label: "Clarity" },
  { key: "confidence", label: "Confidence" },
  { key: "content_depth", label: "Depth" },
  { key: "structure", label: "Structure" },
] as const;

export default function ResultsScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ interview_id?: string }>();
  const id = (params.interview_id as string) || "";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (!id) return;
        const r = await api<any>(`/interview/${id}`);
        setData(r);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const avgs = useMemo(() => {
    if (!data?.scores?.length) return AXES.map(() => 0);
    const sums: Record<string, number> = {};
    AXES.forEach((a) => (sums[a.key] = 0));
    data.scores.forEach((s: any) => {
      AXES.forEach((a) => (sums[a.key] += s[a.key] || 0));
    });
    return AXES.map((a) => Math.round(sums[a.key] / data.scores.length));
  }, [data]);

  const summary = data?.summary;
  const overall = summary?.overall ?? Math.round(avgs.reduce((a, b) => a + b, 0) / Math.max(1, avgs.length));
  const rawVerdict = summary?.verdict || (overall >= 80 ? "Excellent" : overall >= 65 ? "Strong" : overall >= 50 ? "Promising" : "Needs work");
  const verdict = t(`results.verdict.${rawVerdict}`);

  return (
    <View style={st.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={st.header}>
          <Pressable testID="results-close" onPress={() => router.replace("/")} style={st.iconBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color="#0B0F19" />
          </Pressable>
          <Text style={st.hTitle}>{t("results.title")}</Text>
          <View style={{ width: 38 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={SOFIA} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* Hero */}
            <View style={st.hero}>
              <View style={[st.ring, { borderColor: SOFIA }]}>
                <Avatar uri={AVATARS.sofia} size={56} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={st.role}>{data?.role || "Generalist"} · {data?.seniority || "mid"}</Text>
                <Text style={st.verdict}>{verdict}</Text>
              </View>
              <View style={st.scoreCircle}>
                <Text style={st.scoreText}>{overall}</Text>
                <Text style={st.scoreLabel}>{t("results.overall")}</Text>
              </View>
            </View>

            {/* Radar */}
            <View style={st.card}>
              <Text style={st.cardTitle}>{t("results.breakdown")}</Text>
              <RadarChart values={avgs} labels={AXES.map((a) => t(`results.axes.${a.key}`))} color={SOFIA} />
              <View style={st.legendRow}>
                {AXES.map((a, i) => (
                  <View key={a.key} style={st.legendItem}>
                    <Text style={st.legendLabel}>{a.label}</Text>
                    <Text style={[st.legendVal, { color: tone(avgs[i]) }]}>{avgs[i]}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Summary */}
            {summary?.summary && (
              <View style={st.card}>
                <Text style={st.cardTitle}>{t("results.summary")}</Text>
                <Text style={st.body}>{summary.summary}</Text>
              </View>
            )}

            {/* Strengths / Improvements */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <PillBox title={t("results.strengths")} items={summary?.top_strengths || []} color="#10B981" />
              <PillBox title={t("results.improvements")} items={summary?.top_improvements || []} color="#F59E0B" />
            </View>

            {/* Next steps */}
            {!!summary?.next_steps?.length && (
              <View style={st.card}>
                <Text style={st.cardTitle}>{t("results.nextSteps")}</Text>
                {summary.next_steps.map((n: string, i: number) => (
                  <View key={i} style={st.nextRow}>
                    <View style={st.nextDot}><Text style={st.nextDotText}>{i + 1}</Text></View>
                    <Text style={st.nextText}>{n}</Text>
                  </View>
                ))}
              </View>
            )}

            <Pressable testID="results-restart" onPress={() => router.replace("/")} style={[st.primaryBtn, { backgroundColor: SOFIA }]}>
              <Text style={st.primaryBtnText}>{t("common.done")}</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function RadarChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const size = 260;
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 30;
  const n = values.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const grid = [0.25, 0.5, 0.75, 1].map((g) =>
    values
      .map((_, i) => `${cx + Math.cos(angle(i)) * r * g},${cy + Math.sin(angle(i)) * r * g}`)
      .join(" ")
  );

  const points = values
    .map((v, i) => {
      const k = (v || 0) / 100;
      return `${cx + Math.cos(angle(i)) * r * k},${cy + Math.sin(angle(i)) * r * k}`;
    })
    .join(" ");

  return (
    <Svg width={size} height={size + 6} style={{ alignSelf: "center", marginVertical: 6 }}>
      {/* grid */}
      {grid.map((g, idx) => (
        <Polygon key={idx} points={g} fill="none" stroke="#ECEEF3" strokeWidth={1} />
      ))}
      {/* axes */}
      {values.map((_, i) => (
        <Line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + Math.cos(angle(i)) * r}
          y2={cy + Math.sin(angle(i)) * r}
          stroke="#ECEEF3"
          strokeWidth={1}
        />
      ))}
      {/* shape */}
      <Polygon points={points} fill={color + "44"} stroke={color} strokeWidth={2} />
      {/* dots */}
      {values.map((v, i) => {
        const k = (v || 0) / 100;
        return <Circle key={i} cx={cx + Math.cos(angle(i)) * r * k} cy={cy + Math.sin(angle(i)) * r * k} r={3} fill={color} />;
      })}
      {/* labels */}
      {labels.map((l, i) => (
        <SvgText
          key={l}
          x={cx + Math.cos(angle(i)) * (r + 16)}
          y={cy + Math.sin(angle(i)) * (r + 16) + 3}
          textAnchor="middle"
          fontSize="10"
          fill="#5B6577"
          fontWeight="700"
        >
          {l}
        </SvgText>
      ))}
    </Svg>
  );
}

function PillBox({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <View style={[st.card, { flex: 1 }]}>
      <Text style={st.cardTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={{ color: "#8A93A6", fontSize: 12 }}>—</Text>
      ) : (
        items.slice(0, 4).map((it, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: color }} />
            <Text style={{ flex: 1, fontSize: 12, color: "#0B0F19", lineHeight: 18 }}>{it}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function tone(v: number) {
  if (v >= 75) return "#10B981";
  if (v >= 50) return "#F59E0B";
  return "#EF4444";
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAFAFB" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#ECEEF3" },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  hTitle: { fontSize: 16, fontWeight: "800", color: "#0B0F19" },

  hero: { flexDirection: "row", alignItems: "center", padding: 18, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#ECEEF3", marginBottom: 14 },
  ring: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, overflow: "hidden", backgroundColor: "#fff" },
  role: { fontSize: 12, color: "#5B6577", textTransform: "capitalize", fontWeight: "700" },
  verdict: { fontSize: 22, fontWeight: "800", color: "#0B0F19", marginTop: 2 },
  scoreCircle: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: "#FDECF5" },
  scoreText: { fontSize: 24, fontWeight: "800", color: SOFIA },
  scoreLabel: { fontSize: 10, color: "#5B6577", fontWeight: "700", marginTop: -2 },

  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#ECEEF3", marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: "800", color: "#5B6577", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 },
  body: { color: "#0B0F19", fontSize: 13, lineHeight: 20 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6, justifyContent: "center" },
  legendItem: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#F2F3F7", borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 6 },
  legendLabel: { fontSize: 11, color: "#5B6577", fontWeight: "700" },
  legendVal: { fontSize: 12, fontWeight: "800" },

  nextRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 8 },
  nextDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#FDECF5", marginTop: 1 },
  nextDotText: { color: SOFIA, fontWeight: "800", fontSize: 11 },
  nextText: { flex: 1, color: "#0B0F19", fontSize: 13, lineHeight: 19 },

  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 999, marginTop: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
