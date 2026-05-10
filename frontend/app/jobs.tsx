import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../components/Avatar";
import { AVATARS, AVATAR_META, AvatarKey, api, getOrCreateUserId } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";

type Job = { id: string; title: string; company: string; location: string; remote: string; seniority: string; salary_min: number; salary_max: number; skills: string[]; match_score: number };

export default function JobsScreen() {
  const params = useLocalSearchParams<{ avatar?: string }>();
  const key = ((params.avatar as AvatarKey) || "maya") as AvatarKey;
  const meta = AVATAR_META[key];
  const { t } = useI18n();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // Always prefer the authenticated user id so the search uses the saved
      // profile (target_role, location, remote, salary, skills, ...).
      const uid = user?.user_id || (await getOrCreateUserId());
      const r = await api<{ profile: any; matches: Job[] }>("/jobs/match", {
        method: "POST",
        body: JSON.stringify({ user_id: uid, limit: 10 }),
      });
      setJobs(r.matches || []);
      setProfile(r.profile);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.user_id]);

  const save = async (j: Job) => {
    setSavingId(j.id);
    try {
      const uid = user?.user_id || (await getOrCreateUserId());
      await api("/saved-jobs", {
        method: "POST",
        body: JSON.stringify({ user_id: uid, title: j.title, company: j.company, location: j.location }),
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={s.header}>
          <Pressable testID="jobs-back" onPress={() => router.back()} style={s.iconBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#0B0F19" />
          </Pressable>
          <View style={[s.avatarRing, { borderColor: meta.color }]}>
            <Avatar uri={AVATARS[key]} size={36} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.hTitle}>{t("jobs.title")}</Text>
            <Text style={s.hSub}>{profile?.target_role ? t("jobs.forRole", { role: profile.target_role }) : t("jobs.topPicks")}</Text>
          </View>
          <Pressable testID="jobs-refresh" onPress={load} style={s.iconBtn} hitSlop={10}>
            <Ionicons name="refresh" size={20} color="#5B6577" />
          </Pressable>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={meta.color} />
            <Text style={{ marginTop: 8, color: "#5B6577" }}>{t("jobs.searching")}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
            {jobs.length === 0 ? (
              <Text style={s.empty}>{t("jobs.noMatches")}</Text>
            ) : null}
            {jobs.map((j) => (
              <View key={j.id} testID={`job-${j.id}`} style={s.card}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                  <View style={[s.scoreCircle, { backgroundColor: scoreBg(j.match_score) }]}>
                    <Text style={[s.scoreText, { color: scoreFg(j.match_score) }]}>{j.match_score}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.title}>{j.title}</Text>
                    <Text style={s.sub}>{j.company} · {j.location}</Text>
                  </View>
                </View>
                <View style={s.metaRow}>
                  <Tag icon="briefcase-outline" text={j.seniority} />
                  <Tag icon="globe-outline" text={j.remote} />
                  <Tag icon="cash-outline" text={`£${Math.round(j.salary_min/1000)}–${Math.round(j.salary_max/1000)}k`} />
                </View>
                <View style={s.skillsRow}>
                  {j.skills.slice(0, 4).map((sk) => (
                    <View key={sk} style={s.skillChip}>
                      <Text style={s.skillText}>{sk}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <Pressable
                    testID={`job-save-${j.id}`}
                    onPress={() => save(j)}
                    disabled={savingId === j.id}
                    style={[s.btn, { backgroundColor: "#F2F3F7" }]}
                  >
                    {savingId === j.id ? (
                      <ActivityIndicator size="small" color="#0B0F19" />
                    ) : (
                      <>
                        <Ionicons name="bookmark-outline" size={14} color="#0B0F19" />
                        <Text style={[s.btnText, { color: "#0B0F19" }]}>{t("jobs.save")}</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable testID={`job-apply-${j.id}`} onPress={() => router.push({ pathname: "/chat", params: { avatar: "aria" } })} style={[s.btn, { backgroundColor: meta.color, flex: 1 }]}>
                    <Text style={[s.btnText, { color: "#fff" }]}>{t("jobs.getPrep")}</Text>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function Tag({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={s.tag}>
      <Ionicons name={icon} size={11} color="#5B6577" />
      <Text style={s.tagText}>{text}</Text>
    </View>
  );
}

function scoreBg(n: number) {
  if (n >= 80) return "#E6F8F1";
  if (n >= 60) return "#EEEFFE";
  return "#F2F3F7";
}
function scoreFg(n: number) {
  if (n >= 80) return "#10B981";
  if (n >= 60) return "#5B5FE9";
  return "#5B6577";
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAFAFB" },
  header: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#ECEEF3" },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, overflow: "hidden", backgroundColor: "#fff" },
  hTitle: { fontSize: 15, fontWeight: "800", color: "#0B0F19" },
  hSub: { fontSize: 12, color: "#5B6577", marginTop: 2 },
  empty: { textAlign: "center", color: "#5B6577", marginTop: 40 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#ECEEF3" },
  scoreCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  scoreText: { fontSize: 14, fontWeight: "800" },
  title: { fontSize: 15, fontWeight: "800", color: "#0B0F19" },
  sub: { fontSize: 12, color: "#5B6577", marginTop: 2 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F2F3F7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  tagText: { fontSize: 11, color: "#0B0F19", fontWeight: "600", textTransform: "capitalize" },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  skillChip: { backgroundColor: "#EEEFFE", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  skillText: { fontSize: 11, color: "#5B5FE9", fontWeight: "700" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 999 },
  btnText: { fontSize: 13, fontWeight: "700" },
});
