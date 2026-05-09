import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  Animated,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDemo } from "../lib/demo";
import { useI18n, SUPPORTED_LANGS, type LangCode } from "../lib/i18n";

const C = {
  bg: "#FAFAFB",
  bgSoft: "#F2F3F7",
  card: "#FFFFFF",
  text: "#0B0F19",
  text2: "#5B6577",
  text3: "#8A93A6",
  border: "#ECEEF3",
  primary: "#5B5FE9",
  primarySoft: "#EEEFFE",
  emerald: "#10B981",
  emeraldSoft: "#E6F8F1",
  amber: "#F59E0B",
  amberSoft: "#FFF6E5",
  maya: "#0EA5E9",
  mayaSoft: "#E6F6FE",
  sofia: "#EC4899",
  sofiaSoft: "#FDECF5",
  aria: "#8B5CF6",
  ariaSoft: "#F1ECFE",
};

function haptic() {
  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
}

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  title: string;
  sub?: string;
  onPress: () => void;
  testID?: string;
  loading?: boolean;
  rightLabel?: string;
};

function Row({ icon, color, bg, title, sub, onPress, testID, loading, rightLabel }: RowProps) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        haptic();
        onPress();
      }}
      disabled={loading}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: C.bgSoft }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={C.text2} />
      ) : rightLabel ? (
        <Text style={[styles.rowRight, { color }]}>{rightLabel}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={C.text3} />
      )}
    </Pressable>
  );
}

export default function DemoLauncher() {
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useI18n();
  const { isDemo, enableDemo, disableDemo, refreshTick, bumpRefresh } = useDemo();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "enable" | "disable">(null);
  const fabScale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(fabScale, { toValue: 0.92, useNativeDriver: true, friction: 8 }).start();
    haptic();
  }, [fabScale]);
  const onPressOut = useCallback(() => {
    Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, friction: 6 }).start();
  }, [fabScale]);

  const close = () => setOpen(false);
  const closeAnd = (fn: () => void) => () => {
    close();
    setTimeout(fn, 80);
  };

  const handleEnableDemo = async () => {
    setBusy("enable");
    await enableDemo();
    setBusy(null);
  };

  const handleDisableDemo = async () => {
    setBusy("disable");
    await disableDemo();
    setBusy(null);
  };

  const cycleLang = () => {
    const codes = SUPPORTED_LANGS.map((l) => l.code as LangCode);
    const i = codes.indexOf(lang);
    const next = codes[(i + 1) % codes.length];
    setLang(next);
    bumpRefresh();
  };

  const currentLang = SUPPORTED_LANGS.find((l) => l.code === lang)?.native || lang;

  return (
    <>
      {/* Floating FAB */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.fabWrap,
          {
            bottom: Math.max(insets.bottom, 12) + 96, // sit above sticky bottom bar
            transform: [{ scale: fabScale }],
          },
        ]}
      >
        <Pressable
          testID="demo-launcher-fab"
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={() => setOpen(true)}
          style={[
            styles.fab,
            isDemo ? { backgroundColor: C.emerald } : { backgroundColor: C.text },
          ]}
        >
          <Ionicons
            name={isDemo ? "flash" : "flash-outline"}
            size={16}
            color="#fff"
          />
          <Text style={styles.fabText}>
            {isDemo ? t("demo.fabActive") : t("demo.fab")}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Bottom-sheet style modal */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 16 },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View
              style={[
                styles.headerBadge,
                { backgroundColor: isDemo ? C.emeraldSoft : C.primarySoft },
              ]}
            >
              <Ionicons
                name="sparkles"
                size={14}
                color={isDemo ? C.emerald : C.primary}
              />
              <Text
                style={[
                  styles.headerBadgeText,
                  { color: isDemo ? C.emerald : C.primary },
                ]}
              >
                {isDemo ? t("demo.statusOn") : t("demo.statusOff")}
              </Text>
            </View>
            <Pressable testID="demo-close" onPress={close} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={C.text2} />
            </Pressable>
          </View>

          <Text style={styles.sheetTitle}>{t("demo.title")}</Text>
          <Text style={styles.sheetSub}>{t("demo.sub")}</Text>

          <ScrollView
            style={{ maxHeight: 460 }}
            contentContainerStyle={{ paddingBottom: 6 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Demo account toggle */}
            <View style={styles.group}>
              <Text style={styles.groupLabel}>{t("demo.groupAccount")}</Text>
              {!isDemo ? (
                <Row
                  testID="demo-enable"
                  icon="rocket-outline"
                  color={C.emerald}
                  bg={C.emeraldSoft}
                  title={t("demo.enableTitle")}
                  sub={t("demo.enableSub")}
                  onPress={handleEnableDemo}
                  loading={busy === "enable"}
                  rightLabel={t("demo.start")}
                />
              ) : (
                <Row
                  testID="demo-disable"
                  icon="refresh-outline"
                  color={C.amber}
                  bg={C.amberSoft}
                  title={t("demo.disableTitle")}
                  sub={t("demo.disableSub")}
                  onPress={handleDisableDemo}
                  loading={busy === "disable"}
                  rightLabel={t("demo.reset")}
                />
              )}
            </View>

            {/* Avatar shortcuts */}
            <View style={styles.group}>
              <Text style={styles.groupLabel}>{t("demo.groupAvatars")}</Text>
              <Row
                testID="demo-chat-maya"
                icon="search-outline"
                color={C.maya}
                bg={C.mayaSoft}
                title={t("demo.chatMaya")}
                sub={t("avatars.maya.role")}
                onPress={closeAnd(() => router.push({ pathname: "/chat", params: { avatar: "maya" } }))}
              />
              <Row
                testID="demo-chat-sofia"
                icon="mic-outline"
                color={C.sofia}
                bg={C.sofiaSoft}
                title={t("demo.chatSofia")}
                sub={t("avatars.sofia.role")}
                onPress={closeAnd(() => router.push({ pathname: "/chat", params: { avatar: "sofia" } }))}
              />
              <Row
                testID="demo-chat-aria"
                icon="compass-outline"
                color={C.aria}
                bg={C.ariaSoft}
                title={t("demo.chatAria")}
                sub={t("avatars.aria.role")}
                onPress={closeAnd(() => router.push({ pathname: "/chat", params: { avatar: "aria" } }))}
              />
            </View>

            {/* Flow shortcuts */}
            <View style={styles.group}>
              <Text style={styles.groupLabel}>{t("demo.groupFlows")}</Text>
              <Row
                testID="demo-interview"
                icon="mic-circle-outline"
                color={C.sofia}
                bg={C.sofiaSoft}
                title={t("demo.interview")}
                sub={t("demo.interviewSub")}
                onPress={closeAnd(() => router.push({ pathname: "/interview", params: { avatar: "sofia" } }))}
              />
              <Row
                testID="demo-jobs"
                icon="briefcase-outline"
                color={C.maya}
                bg={C.mayaSoft}
                title={t("demo.jobs")}
                sub={t("demo.jobsSub")}
                onPress={closeAnd(() => router.push({ pathname: "/jobs", params: { avatar: "maya" } }))}
              />
              <Row
                testID="demo-checkout"
                icon="card-outline"
                color={C.primary}
                bg={C.primarySoft}
                title={t("demo.checkout")}
                sub={t("demo.checkoutSub")}
                onPress={closeAnd(() =>
                  router.push({
                    pathname: "/checkout",
                    params: {
                      avatar: "sofia",
                      item_id: "itv-standard",
                      title: "Interview Sim · Standard",
                      price: "£8.99",
                      bullets: "30-min mock interview|Detailed feedback|Score breakdown",
                      kind: "service",
                    },
                  })
                )}
              />
            </View>

            {/* Settings shortcuts */}
            <View style={styles.group}>
              <Text style={styles.groupLabel}>{t("demo.groupSettings")}</Text>
              <Row
                testID="demo-lang"
                icon="globe-outline"
                color={C.primary}
                bg={C.primarySoft}
                title={t("demo.language")}
                sub={t("demo.languageSub")}
                onPress={cycleLang}
                rightLabel={currentLang}
              />
              <Row
                testID="demo-legal-privacy"
                icon="shield-checkmark-outline"
                color={C.emerald}
                bg={C.emeraldSoft}
                title={t("footer.privacy")}
                onPress={closeAnd(() => router.push({ pathname: "/legal/[slug]", params: { slug: "privacy" } }))}
              />
              <Row
                testID="demo-legal-terms"
                icon="document-text-outline"
                color={C.text}
                bg={C.bgSoft}
                title={t("footer.terms")}
                onPress={closeAnd(() => router.push({ pathname: "/legal/[slug]", params: { slug: "terms" } }))}
              />
              <Row
                testID="demo-home"
                icon="home-outline"
                color={C.aria}
                bg={C.ariaSoft}
                title={t("demo.home")}
                onPress={closeAnd(() => router.replace("/"))}
              />
            </View>
          </ScrollView>

          <Text style={styles.footnote}>{t("demo.footnote")}</Text>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: "absolute",
    right: 14,
    zIndex: 60,
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#0B0F19",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.18,
          shadowRadius: 14,
        }
      : Platform.OS === "android"
      ? { elevation: 6 }
      : { boxShadow: "0px 6px 18px rgba(11,15,25,0.22)" } as any),
  },
  fabText: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(11,15,25,0.45)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EE",
    marginBottom: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  headerBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.bgSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.4,
    marginTop: 12,
  },
  sheetSub: { fontSize: 13, color: C.text2, marginTop: 4, lineHeight: 18 },
  group: { marginTop: 16 },
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: C.text3,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  rowSub: { fontSize: 12, color: C.text2, marginTop: 2 },
  rowRight: { fontSize: 12, fontWeight: "700" },
  footnote: {
    fontSize: 11,
    color: C.text3,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 16,
  },
});
