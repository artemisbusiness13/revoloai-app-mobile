import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable, StyleSheet, Platform, KeyboardAvoidingView, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";

const C = {
  bg: "#FAFAFB", card: "#FFFFFF", text: "#0B0F19", text2: "#5B6577", text3: "#8A93A6",
  border: "#ECEEF3", primary: "#5B5FE9", primarySoft: "#EEEFFE", emerald: "#10B981", emeraldSoft: "#E6F8F1",
  bgSoft: "#F2F3F7",
};

const SENIORITY = ["entry", "junior", "mid", "senior", "lead", "principal"];
const REMOTE = ["any", "remote", "hybrid", "onsite"];

type Profile = {
  target_role: string; seniority: string; years_experience: number;
  location: string; remote: string; salary_min: number; salary_max: number;
  skills: string[]; languages: string[]; qualifications: string[]; education: string;
  experience_summary: string; industries: string[]; industries_avoid: string[];
  strengths: string[]; weaknesses: string[]; availability: string;
  cv_text: string; cv_filename: string; notes: string;
};

const empty: Profile = {
  target_role: "", seniority: "unknown", years_experience: 0,
  location: "", remote: "any", salary_min: 0, salary_max: 0,
  skills: [], languages: [], qualifications: [], education: "",
  experience_summary: "", industries: [], industries_avoid: [],
  strengths: [], weaknesses: [], availability: "",
  cv_text: "", cv_filename: "", notes: "",
};

const splitCsv = (s: string) => s.split(",").map(x => x.trim()).filter(Boolean);
const joinCsv = (a: string[]) => (a || []).join(", ");

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, setProfileCompleted } = useAuth();
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<Profile>(empty);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) { setLoading(false); return; }
      try {
        const r = await api(`/profile/${user.user_id}`);
        if (r) setP({ ...empty, ...r });
      } catch {}
      setLoading(false);
    })();
  }, [user]);

  if (!user) {
    return (
      <View style={[s.full, s.center, { paddingTop: insets.top }]}>
        <Text style={s.h1}>{t("profile.signInFirst")}</Text>
        <Pressable style={s.btn} onPress={() => router.replace("/")}>
          <Text style={s.btnText}>{t("common.back")}</Text>
        </Pressable>
      </View>
    );
  }

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const body = { ...p, user_id: user.user_id };
      await api(`/profile/${user.user_id}`, {
        method: "PUT",
        body: JSON.stringify(body),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setProfileCompleted(!!p.target_role.trim());
      router.replace("/");
    } catch (e: any) {
      setError(String(e?.message || e || "Save failed"));
    } finally {
      setBusy(false);
    }
  };

  const next = () => setStep(s => Math.min(4, s + 1));
  const prev = () => (step <= 1 ? router.replace("/") : setStep(s => Math.max(1, s - 1)));

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.full}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={prev} hitSlop={10} style={s.iconBtn}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t("profile.title")}</Text>
          <Text style={s.headerSub}>{t("profile.step")} {step}/4</Text>
        </View>
        <View style={[s.iconBtn, { backgroundColor: "transparent" }]} />
      </View>

      <View style={s.progressRow}>
        {[1, 2, 3, 4].map(n => (
          <View key={n} style={[s.progressDot, n <= step && s.progressDotOn]} />
        ))}
      </View>

      {loading ? (
        <View style={[s.full, s.center]}><ActivityIndicator color={C.primary} /></View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <>
              <Text style={s.section}>{t("profile.s1")}</Text>
              <Field label={t("profile.targetRole")} value={p.target_role} onChange={v => set("target_role", v)} placeholder="e.g. Senior Product Designer" />
              <Field label={t("profile.location")} value={p.location} onChange={v => set("location", v)} placeholder="e.g. London, UK" />
              <Picker label={t("profile.remote")} options={REMOTE} value={p.remote} onChange={v => set("remote", v)} />
              <Row>
                <NumField label={t("profile.salaryMin")} value={p.salary_min} onChange={v => set("salary_min", v)} />
                <NumField label={t("profile.salaryMax")} value={p.salary_max} onChange={v => set("salary_max", v)} />
              </Row>
              <Field label={t("profile.availability")} value={p.availability} onChange={v => set("availability", v)} placeholder="e.g. 4 weeks notice" />
            </>
          )}
          {step === 2 && (
            <>
              <Text style={s.section}>{t("profile.s2")}</Text>
              <Picker label={t("profile.seniority")} options={SENIORITY} value={p.seniority} onChange={v => set("seniority", v)} />
              <NumField label={t("profile.years")} value={p.years_experience} onChange={v => set("years_experience", v)} />
              <Field label={t("profile.experience")} value={p.experience_summary} onChange={v => set("experience_summary", v)} placeholder="Briefly summarise your last 2-3 roles" multi />
              <Field label={t("profile.education")} value={p.education} onChange={v => set("education", v)} placeholder="e.g. BSc Computer Science, UCL 2018" multi />
              <CsvField label={t("profile.qualifications")} value={p.qualifications} onChange={v => set("qualifications", v)} placeholder="PMP, AWS Solutions Architect, …" />
            </>
          )}
          {step === 3 && (
            <>
              <Text style={s.section}>{t("profile.s3")}</Text>
              <CsvField label={t("profile.skills")} value={p.skills} onChange={v => set("skills", v)} placeholder="React, Figma, SQL, leadership" />
              <CsvField label={t("profile.languages")} value={p.languages} onChange={v => set("languages", v)} placeholder="English (native), Romanian (fluent)" />
              <CsvField label={t("profile.industries")} value={p.industries} onChange={v => set("industries", v)} placeholder="SaaS, FinTech, Health" />
              <CsvField label={t("profile.industriesAvoid")} value={p.industries_avoid} onChange={v => set("industries_avoid", v)} placeholder="Gambling, Tobacco" />
              <CsvField label={t("profile.strengths")} value={p.strengths} onChange={v => set("strengths", v)} placeholder="Leadership, design systems" />
              <CsvField label={t("profile.weaknesses")} value={p.weaknesses} onChange={v => set("weaknesses", v)} placeholder="Public speaking, advanced statistics" />
            </>
          )}
          {step === 4 && (
            <>
              <Text style={s.section}>{t("profile.s4")}</Text>
              <Field label={t("profile.cvText")} value={p.cv_text} onChange={v => set("cv_text", v)} placeholder={t("profile.cvPaste")} multi big />
              <Field label={t("profile.cvFilename")} value={p.cv_filename} onChange={v => set("cv_filename", v)} placeholder="my-cv.pdf (optional)" />
              <Field label={t("profile.notes")} value={p.notes} onChange={v => set("notes", v)} placeholder={t("profile.notesPh")} multi />
              <Text style={s.tip}>{t("profile.savedTip")}</Text>
            </>
          )}
          {error ? <Text style={s.err}>{error}</Text> : null}
        </ScrollView>
      )}

      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step < 4 ? (
          <>
            <Pressable style={s.btnGhost} onPress={save}>
              <Text style={s.btnGhostText}>{t("profile.saveAndExit")}</Text>
            </Pressable>
            <Pressable style={s.btn} onPress={next}>
              <Text style={s.btnText}>{t("profile.next")}</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </Pressable>
          </>
        ) : (
          <Pressable style={[s.btn, { flex: 1 }]} onPress={save} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={s.btnText}>{t("profile.finish")}</Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: "row", gap: 10 }}>{children}</View>
);

const Field = ({ label, value, onChange, placeholder, multi, big }: any) => (
  <View style={s.field}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.text3}
      style={[s.input, multi && { minHeight: big ? 140 : 70, textAlignVertical: "top" }]} multiline={!!multi} />
  </View>
);

const NumField = ({ label, value, onChange }: any) => (
  <View style={[s.field, { flex: 1 }]}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TextInput value={value ? String(value) : ""} onChangeText={t => onChange(parseInt(t.replace(/[^0-9]/g, "") || "0", 10))} keyboardType="numeric" style={s.input} />
  </View>
);

const CsvField = ({ label, value, onChange, placeholder }: any) => (
  <View style={s.field}>
    <Text style={s.fieldLabel}>{label}</Text>
    <Text style={s.hint}>Separate with commas</Text>
    <TextInput value={joinCsv(value)} onChangeText={t => onChange(splitCsv(t))} placeholder={placeholder} placeholderTextColor={C.text3} style={[s.input, { minHeight: 60, textAlignVertical: "top" }]} multiline />
  </View>
);

const Picker = ({ label, options, value, onChange }: any) => (
  <View style={s.field}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={s.chipRow}>
      {options.map((o: string) => (
        <Pressable key={o} onPress={() => onChange(o)} style={[s.chip, value === o && s.chipOn]}>
          <Text style={[s.chipText, value === o && s.chipTextOn]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  </View>
);

const s = StyleSheet.create({
  full: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 8, gap: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bgSoft, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: C.text },
  headerSub: { fontSize: 12, color: C.text2, marginTop: 1 },
  progressRow: { flexDirection: "row", paddingHorizontal: 14, gap: 6, paddingVertical: 6 },
  progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border },
  progressDotOn: { backgroundColor: C.primary },
  scroll: { padding: 16, paddingBottom: 30 },
  section: { fontSize: 13, fontWeight: "800", color: C.text3, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: C.text, marginBottom: 6 },
  hint: { fontSize: 11, color: C.text3, marginBottom: 4 },
  input: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, fontSize: 14, color: C.text },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  chipOn: { backgroundColor: C.primarySoft, borderColor: C.primary },
  chipText: { fontSize: 12, color: C.text2, fontWeight: "600", textTransform: "capitalize" },
  chipTextOn: { color: C.primary },
  tip: { fontSize: 12, color: C.text3, marginTop: 4 },
  err: { fontSize: 13, color: "#DC2626", marginTop: 12 },
  footer: { flexDirection: "row", padding: 14, gap: 10, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.card },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 13 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  btnGhost: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 13, backgroundColor: C.bgSoft },
  btnGhostText: { color: C.text2, fontWeight: "700", fontSize: 13 },
  h1: { fontSize: 18, fontWeight: "800", color: C.text, marginBottom: 12 },
});
