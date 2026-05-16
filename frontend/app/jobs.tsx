import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../components/Avatar";
import { AVATARS, AVATAR_META, AvatarKey, api, getOrCreateUserId } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { useC, ThemeToggle, JobCardSkeleton, CopyrightFooter } from "../components/ui";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: string;
  seniority: string;
  salary_min: number | null;
  salary_max: number | null;
  skills: string[];
  match_score: number;
  url?: string;
  contract_time?: string;
  source?: string;
};

type SearchStatus = "idle" | "ok" | "no_results" | "error" | "demo" | "not_configured" | "no_target_role";

export default function JobsScreen() {
  const params = useLocalSearchParams<{ avatar?: string }>();
  const key = ((params.avatar as AvatarKey) || "maya") as AvatarKey;
  const meta = AVATAR_META[key];
  const { t } = useI18n();
  const { user, ready: authReady } = useAuth();
  const C = useC();
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [status, setStatus] = useState<SearchStatus>("idle");
  // Monotonic request counter — used to ignore out-of-order responses from
  // earlier load() invocations (race condition when auth.user_id resolves
  // asynchronously and useFocusEffect re-fires).
  const reqIdRef = React.useRef(0);

  const load = useCallback(async () => {
    // Hold off until auth context has hydrated. Without this guard, the very
    // first focus pass fires with user=null → guest user_id → backend has no
    // profile → status="no_target_role" → those results race the real
    // user.user_id call and can finish LAST, clobbering the real "ok" jobs.
    if (!authReady) {
      // eslint-disable-next-line no-console
      console.log("[jobs] auth not ready yet — waiting");
      return;
    }
    const myReq = ++reqIdRef.current;
    setLoading(true);
    setStatus("idle");
    setJobs([]);
    setProfile(null);
    const tStart = Date.now();
    // eslint-disable-next-line no-console
    console.log("[jobs] load() start req=", myReq, "user_id=", user?.user_id || "(none)");
    let httpStatus = 0;
    try {
      const uid = user?.user_id || (await getOrCreateUserId());
      const apiBase = (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api";
      // Raw fetch so we can log HTTP status separately from JSON-parse errors.
      const fetchRes = await fetch(`${apiBase}/jobs/match?_t=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
        body: JSON.stringify({ user_id: uid, limit: 10 }),
      });
      httpStatus = fetchRes.status;
      // eslint-disable-next-line no-console
      console.log("[jobs] HTTP", httpStatus, "for req=", myReq);
      if (!fetchRes.ok) {
        const errBody = await fetchRes.text().catch(() => "");
        // eslint-disable-next-line no-console
        console.warn("[jobs] non-OK body:", errBody.slice(0, 200));
        throw new Error(`HTTP ${httpStatus}`);
      }
      let r: any;
      try {
        r = await fetchRes.json();
      } catch (jsonErr) {
        // eslint-disable-next-line no-console
        console.warn("[jobs] JSON parse failed:", (jsonErr as Error)?.message);
        throw jsonErr;
      }
      // Drop the result if a newer load() has started in the meantime — this
      // prevents an earlier "no_target_role"/"error" response from overwriting
      // a later "ok" response (and vice-versa).
      if (myReq !== reqIdRef.current) {
        // eslint-disable-next-line no-console
        console.log("[jobs] stale response (req=", myReq, "current=", reqIdRef.current, ") — ignored");
        return;
      }
      // eslint-disable-next-line no-console
      console.log("[jobs] response.status =", r?.status, "live =", r?.live, "count =", r?.count, "query =", r?.query, "where =", r?.where);
      // eslint-disable-next-line no-console
      console.log("[jobs] first title =", r?.matches?.[0]?.title || "(none)", "| total matches =", (r?.matches || []).length);
      setJobs(r?.matches || []);
      setProfile(r?.profile);
      setStatus((r?.status as SearchStatus) || "ok");
      // eslint-disable-next-line no-console
      console.log(`[jobs] rendered ${(r?.matches || []).length} job(s) in ${Date.now() - tStart}ms (req=${myReq})`);
    } catch (e) {
      // Same staleness guard for errors — don't show "error" if a newer
      // request is still in flight (it may succeed).
      if (myReq !== reqIdRef.current) {
        // eslint-disable-next-line no-console
        console.log("[jobs] stale error (req=", myReq, "current=", reqIdRef.current, ") — ignored");
        return;
      }
      // eslint-disable-next-line no-console
      console.warn("[jobs] /jobs/match failed (HTTP", httpStatus, "):", (e as Error)?.message);
      setJobs([]);
      setStatus("error");
    } finally {
      if (myReq === reqIdRef.current) {
        setLoading(false);
      }
    }
  }, [authReady, user?.user_id]);

  // Re-fetch on every screen focus so coming back from chat or checkout
  // always shows fresh, profile-bound results.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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

  const openApply = async (j: Job) => {
    if (!j.url) {
      router.push({ pathname: "/chat", params: { avatar: "aria" } });
      return;
    }
    try { await Linking.openURL(j.url); } catch {}
  };

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={[s.header, { backgroundColor: C.card, borderBottomColor: C.border }]}>
          <Pressable testID="jobs-back" onPress={() => router.back()} style={s.iconBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </Pressable>
          <View style={[s.avatarRing, { borderColor: meta.color }]}>
            <Avatar uri={AVATARS[key]} size={36} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[s.hTitle, { color: C.text }]}>{t("jobs.title")}</Text>
            <Text style={[s.hSub, { color: C.text2 }]}>{profile?.target_role ? t("jobs.forRole", { role: profile.target_role }) : t("jobs.topPicks")}</Text>
          </View>
          <ThemeToggle />
          <Pressable testID="jobs-refresh" onPress={load} style={s.iconBtn} hitSlop={10}>
            <Ionicons name="refresh" size={20} color={C.text2} />
          </Pressable>
        </View>

        {loading ? (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
            {/* Demo-mode banner — shows when the backend is NOT configured for
               live Adzuna in this environment so the user knows the cards are
               curated samples, not real jobs. */}
            {status === "demo" ? (
              <View style={s.demoBanner}>
                <Ionicons name="alert-circle-outline" size={14} color="#9A6B00" />
                <Text style={s.demoBannerText}>{t("jobs.demoBanner")}</Text>
              </View>
            ) : null}
            {jobs.length === 0 && status === "error" ? (
              <View style={s.stateBox}>
                <Ionicons name="cloud-offline-outline" size={28} color="#5B6577" />
                <Text style={s.stateTitle}>{t("jobs.errorTitle")}</Text>
                <Text style={s.stateBody}>{t("jobs.errorBody")}</Text>
                <Pressable onPress={load} style={[s.retryBtn, { backgroundColor: meta.color }]}>
                  <Ionicons name="refresh" size={14} color="#fff" />
                  <Text style={s.retryText}>{t("common.retry")}</Text>
                </Pressable>
              </View>
            ) : jobs.length === 0 && status === "no_target_role" ? (
              <View style={s.stateBox}>
                <Ionicons name="briefcase-outline" size={28} color="#5B6577" />
                <Text style={s.stateTitle}>{t("jobs.noTargetTitle")}</Text>
                <Text style={s.stateBody}>{t("jobs.noTargetBody")}</Text>
                <Pressable onPress={() => router.push("/profile")} style={[s.retryBtn, { backgroundColor: meta.color }]}>
                  <Ionicons name="person-circle-outline" size={14} color="#fff" />
                  <Text style={s.retryText}>{t("jobs.openProfile")}</Text>
                </Pressable>
              </View>
            ) : jobs.length === 0 && (status === "no_results" || status === "not_configured") ? (
              <View style={s.stateBox}>
                <Ionicons name="search-outline" size={28} color="#5B6577" />
                <Text style={s.stateTitle}>{t("jobs.noResultsTitle")}</Text>
                <Text style={s.stateBody}>{t("jobs.noResultsBody")}</Text>
              </View>
            ) : null}
            {jobs.map((j) => (
              <View key={j.id} testID={`job-${j.id}`} style={[s.card, { backgroundColor: C.card, borderColor: C.border, borderWidth: 1 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                  <View style={[s.scoreCircle, { backgroundColor: scoreBg(j.match_score) }]}>
                    <Text style={[s.scoreText, { color: scoreFg(j.match_score) }]}>{j.match_score}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[s.title, { color: C.text }]}>{j.title}</Text>
                    <Text style={[s.sub, { color: C.text2 }]}>{[j.company, j.location].filter(Boolean).join(" · ")}</Text>
                  </View>
                </View>
                <View style={s.metaRow}>
                  {j.seniority ? <Tag icon="briefcase-outline" text={j.seniority} /> : null}
                  {j.remote ? <Tag icon="globe-outline" text={j.remote} /> : null}
                  {j.contract_time ? <Tag icon="time-outline" text={j.contract_time} /> : null}
                  {(j.salary_min || j.salary_max) ? (
                    <Tag
                      icon="cash-outline"
                      text={
                        j.salary_min && j.salary_max
                          ? `£${Math.round(j.salary_min/1000)}–${Math.round(j.salary_max/1000)}k`
                          : j.salary_min
                          ? `£${Math.round(j.salary_min/1000)}k+`
                          : `up to £${Math.round((j.salary_max as number)/1000)}k`
                      }
                    />
                  ) : null}
                </View>
                {j.skills && j.skills.length ? (
                  <View style={s.skillsRow}>
                    {j.skills.slice(0, 4).map((sk) => (
                      <View key={sk} style={s.skillChip}>
                        <Text style={s.skillText}>{sk}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
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
                  <Pressable
                    testID={`job-apply-${j.id}`}
                    onPress={() => openApply(j)}
                    style={[s.btn, { backgroundColor: meta.color, flex: 1 }]}
                  >
                    <Text style={[s.btnText, { color: "#fff" }]}>
                      {j.url ? t("jobs.apply") : t("jobs.getPrep")}
                    </Text>
                    <Ionicons name={j.url ? "open-outline" : "arrow-forward"} size={14} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ))}
            <CopyrightFooter compact />
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
  stateBox: { alignItems: "center", gap: 8, marginTop: 40, paddingHorizontal: 24 },
  stateTitle: { fontSize: 15, fontWeight: "800", color: "#0B0F19", marginTop: 4, textAlign: "center" },
  stateBody: { fontSize: 13, color: "#5B6577", textAlign: "center", lineHeight: 19 },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, marginTop: 8 },
  retryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF7E0",
    borderColor: "#F2DE9C",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 4,
  },
  demoBannerText: { color: "#9A6B00", fontSize: 12, fontWeight: "600", flexShrink: 1 },
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
