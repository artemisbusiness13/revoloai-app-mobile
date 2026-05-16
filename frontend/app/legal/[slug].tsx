import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useI18n, getDict } from "../../lib/i18n";
import { CopyrightFooter } from "../../components/ui";
import { COPYRIGHT_CONTENT } from "../../lib/legalContent";

const VALID = ["privacy", "terms", "cookies", "deletion", "copyright"] as const;
type Slug = (typeof VALID)[number];

export default function LegalScreen() {
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ slug?: string }>();
  const slug = (VALID.includes(params.slug as Slug) ? (params.slug as Slug) : "privacy") as Slug;

  // Read the section list directly from the dictionary (typed) so we don't
  // need a `tArr` helper for nested objects. Copyright uses the static
  // English IP content from legalContent until per-locale copies are added.
  const page = useMemo(() => {
    if (slug === "copyright") {
      return { ...COPYRIGHT_CONTENT, updated: "© " + new Date().getFullYear() };
    }
    const dict = getDict(lang as any);
    return dict.legal[slug as Exclude<Slug, "copyright">];
  }, [lang, slug]);

  return (
    <View style={st.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={st.header}>
          <Pressable testID="legal-close" onPress={() => router.back()} style={st.iconBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#0B0F19" />
          </Pressable>
          <Text style={st.hTitle} numberOfLines={1}>{page.title}</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={st.title}>{page.title}</Text>
          <Text style={st.updated}>{page.updated}</Text>
          <Text style={st.intro}>{page.intro}</Text>

          {page.sections.map((s, i) => (
            <View key={i} style={st.section}>
              <Text style={st.h}>{s.h}</Text>
              <Text style={st.p}>{s.p}</Text>
            </View>
          ))}

          <View style={{ height: 12 }} />
          <Pressable
            testID="legal-back"
            onPress={() => router.back()}
            style={st.backBtn}
          >
            <Ionicons name="arrow-back" size={16} color="#fff" />
            <Text style={st.backBtnText}>{t("common.back")}</Text>
          </Pressable>

          {/* Quick links to other legal pages */}
          <View style={st.linksRow}>
            {VALID.filter((v) => v !== slug && v !== "copyright").map((v) => (
              <Pressable
                key={v}
                testID={`legal-link-${v}`}
                onPress={() => router.replace({ pathname: "/legal/[slug]", params: { slug: v } })}
                style={st.linkChip}
              >
                <Text style={st.linkChipText}>{t(`legal.${v}.title`)}</Text>
              </Pressable>
            ))}
          </View>
          <CopyrightFooter compact />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAFAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#ECEEF3",
  },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  hTitle: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "800", color: "#0B0F19" },
  title: { fontSize: 28, fontWeight: "800", color: "#0B0F19", letterSpacing: -0.6, lineHeight: 34 },
  updated: { fontSize: 12, color: "#8A93A6", marginTop: 6, fontWeight: "600" },
  intro: { fontSize: 15, color: "#0B0F19", marginTop: 14, lineHeight: 22 },
  section: { marginTop: 18 },
  h: { fontSize: 14, fontWeight: "800", color: "#0B0F19", marginBottom: 4, letterSpacing: -0.2 },
  p: { fontSize: 13, color: "#5B6577", lineHeight: 20 },
  backBtn: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "#5B5FE9",
    borderRadius: 999,
  },
  backBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  linksRow: { marginTop: 18, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  linkChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECEEF3",
    borderRadius: 999,
  },
  linkChipText: { fontSize: 12, fontWeight: "700", color: "#5B6577" },
});
