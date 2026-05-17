import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image as RNImage,
  Pressable,
  Animated,
  Platform,
  Dimensions,
  useWindowDimensions,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  api,
  getOrCreateUserId,
  getUserName,
  setUserName as saveUserName,
  clearUserName,
} from "../lib/api";
import { useI18n, SUPPORTED_LANGS, type LangCode } from "../lib/i18n";
import { useDemo } from "../lib/demo";
import { useAuth } from "../lib/auth";
import { useC, ThemeToggle, useTheme, CopyrightFooter } from "../components/ui";
import { TC_VERSION } from "../lib/legalContent";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* Cross-platform circular avatar image (uses raw <img> on web for reliable rendering) */
function Avatar({
  uri,
  size,
  style,
}: {
  uri: string;
  size: number;
  style?: any;
}) {
  if (Platform.OS === "web") {
    return React.createElement("img", {
      src: uri,
      style: {
        width: size,
        height: size,
        objectFit: "cover",
        display: "block",
        ...((style as object) || {}),
      },
      alt: "avatar",
    });
  }
  return (
    <RNImage
      source={{ uri }}
      style={[{ width: size, height: size }, style]}
      resizeMode="cover"
    />
  );
}

/* ---------- Theme ---------- */
const C_default = {
  bg: "#FAFAFB",
  bgSoft: "#F2F3F7",
  card: "#FFFFFF",
  text: "#0B0F19",
  text2: "#5B6577",
  text3: "#8A93A6",
  border: "#ECEEF3",
  primary: "#5B5FE9",
  primarySoft: "#EEEFFE",
  amber: "#F59E0B",
  amberSoft: "#FFF6E5",
  emerald: "#10B981",
  emeraldSoft: "#E6F8F1",
  maya: "#0EA5E9",
  mayaSoft: "#E6F6FE",
  sofia: "#EC4899",
  sofiaSoft: "#FDECF5",
  aria: "#8B5CF6",
  ariaSoft: "#F1ECFE",
};
// `C` is shadowed inside Home() by `useC()` so all JSX consuming it switches
// light/dark automatically. The default above is only used by `StyleSheet`
// definitions at module-load time (those serve as the light-mode baseline).
const C = C_default;

// Flag glyphs for the 6 supported languages. We use Regional Indicator
// emojis (rather than imported icons) so they auto-theme and render natively
// on iOS / Android / web without an extra dependency.
const LANG_FLAG: Record<string, string> = {
  en: "🇬🇧",
  ro: "🇷🇴",
  pl: "🇵🇱",
  es: "🇪🇸",
  pa: "🇮🇳", // Punjabi — written script is most commonly used in India/Pakistan; using IN flag.
  ur: "🇵🇰",
};

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const AVATARS = {
  maya: `/avatars/maya.png`,
  sofia: `/avatars/sofia.png`,
  aria: `/avatars/aria.png`,
};

const { width: SCREEN_W } = Dimensions.get("window");

/* ---------- Press Animation Hook ---------- */
function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
  }, [scale]);
  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 120,
    }).start();
  }, [scale]);
  return { scale, onPressIn, onPressOut };
}

/* ---------- Reusable Bits ---------- */
const SectionLabel = ({ label, color = C.primary }: { label: string; color?: string }) => (
  <View style={[styles.sectionLabel, { backgroundColor: color + "14" }]}>
    <View style={[styles.dot, { backgroundColor: color }]} />
    <Text style={[styles.sectionLabelText, { color }]}>{label}</Text>
  </View>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.sectionTitle}>{children}</Text>
);

const SectionSub = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.sectionSub}>{children}</Text>
);

/* ---------- Pressable Card Wrapper ---------- */
function PressableCard({
  children,
  style,
  onPress,
  testID,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  testID?: string;
}) {
  const { onPressIn, onPressOut } = usePressScale();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => [
        style,
        Platform.OS !== "web" && { transform: [{ scale: pressed ? 0.985 : 1 }] },
        pressed && { opacity: 0.92 },
      ]}
    >
      {children}
    </Pressable>
  );
}

/* ---------- Service Card ---------- */
type Plan = {
  id: string;
  title: string;
  subtitle: string;
  bullets: string[];
  price: string;
  badge?: string;
  accent: string;
  accentSoft: string;
  avatar: "maya" | "sofia" | "aria";
};

function ServiceCard({ plan, idx, onPress, isDesktop }: { plan: Plan; idx: number; onPress: (p: Plan) => void; isDesktop?: boolean }) {
  const { t } = useI18n();
  const isFeatured = !!plan.badge;
  return (
    <PressableCard
      testID={`service-card-${idx}`}
      onPress={() => onPress(plan)}
      style={[
        styles.serviceCard,
        isFeatured && {
          borderColor: plan.accent,
          borderWidth: 1.5,
          shadowOpacity: 0.12,
        },
        isDesktop && styles.serviceCardDesktop,
      ]}
    >
      <View style={styles.serviceTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.serviceTitle}>{plan.title}</Text>
          <Text style={styles.serviceSub}>{plan.subtitle}</Text>
        </View>
        {plan.badge ? (
          <View style={[styles.bestBadge, { backgroundColor: plan.accent }]}>
            <Ionicons name="star" size={10} color="#fff" />
            <Text style={styles.bestBadgeText}>{plan.badge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.serviceBullets}>
        {plan.bullets.map((b, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={[styles.checkDot, { backgroundColor: plan.accentSoft }]}>
              <Ionicons name="checkmark" size={11} color={plan.accent} />
            </View>
            <Text style={styles.bulletText}>{b}</Text>
          </View>
        ))}
      </View>

      <View style={styles.serviceFoot}>
        <View>
          <Text style={styles.priceLabel}>{t("services.from")}</Text>
          <Text style={styles.servicePrice}>{plan.price}</Text>
        </View>
        <View style={[styles.getBtn, { backgroundColor: plan.accent }]}>
          <Text style={styles.getBtnText}>{t("services.get")}</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </View>
      </View>
    </PressableCard>
  );
}

/* ---------- Avatar Hero Chip ---------- */
function AvatarChip({
  src,
  name,
  role,
  color,
  bg,
  testID,
  onPress,
}: {
  src: string;
  name: string;
  role: string;
  color: string;
  bg: string;
  testID?: string;
  onPress?: () => void;
}) {
  return (
    <PressableCard testID={testID} onPress={onPress} style={[styles.avatarCard, { backgroundColor: bg }]}>
      <View style={[styles.avatarRing, { borderColor: color }]}>
        <Avatar uri={src } size={84} style={styles.avatarImg} />
      </View>
      <Text style={styles.avatarRole}>{role}</Text>
      <Text style={[styles.avatarName, { color }]}>{name}</Text>
    </PressableCard>
  );
}

/* ---------- How Step ---------- */
function HowStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <View style={styles.howStep}>
      <View style={styles.howNum}>
        <Text style={styles.howNumText}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.howTitle}>{title}</Text>
        <Text style={styles.howDesc}>{desc}</Text>
      </View>
    </View>
  );
}

/* ---------- Trust Card ---------- */
function TrustCard({
  icon,
  title,
  tag,
  cta,
  color,
  bg,
  testID,
  onPress,
  isDesktop,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tag: string;
  cta: string;
  color: string;
  bg: string;
  testID?: string;
  onPress?: () => void;
  isDesktop?: boolean;
}) {
  const card = (
    <PressableCard testID={testID} onPress={onPress} style={[styles.trustCard, isDesktop && styles.trustCardDesktop]}>
      <View style={[styles.trustIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.trustTitle}>{title}</Text>
      <Text style={styles.trustTag}>{tag}</Text>
      <Text style={[styles.trustCta, { color }]}>{cta} →</Text>
    </PressableCard>
  );
  if (isDesktop) {
    return <View style={styles.gridCellTrust}>{card}</View>;
  }
  return card;
}

/* ---------- Desktop Hero Right Visual ---------- */
/* Lightweight glass/SaaS composition for desktop only. Uses existing brand
 * avatars + tokens. No animations, no images outside our own. Rendered only
 * when the viewport is ≥ 1024px wide; mobile layout is untouched. */
function HeroRightVisual({
  C,
  t,
}: {
  C: ReturnType<typeof useC>;
  t: (k: string) => string;
}) {
  return (
    <View style={hr.wrap} pointerEvents="none">
      {/* Soft branded glow background */}
      <View style={[hr.glowA, { backgroundColor: C.primary }]} />
      <View style={[hr.glowB, { backgroundColor: C.sofia }]} />
      <View style={[hr.glowC, { backgroundColor: C.maya }]} />

      {/* Avatar trio card — top */}
      <View style={[hr.card, hr.avatarsCard]}>
        <View style={hr.avatarsRow}>
          <View style={[hr.ringSm, { borderColor: C.maya, marginLeft: 0, zIndex: 3 }]}>
            <Avatar uri={AVATARS.maya} size={42} />
          </View>
          <View style={[hr.ringSm, { borderColor: C.sofia, marginLeft: -14, zIndex: 2 }]}>
            <Avatar uri={AVATARS.sofia} size={42} />
          </View>
          <View style={[hr.ringSm, { borderColor: C.aria, marginLeft: -14, zIndex: 1 }]}>
            <Avatar uri={AVATARS.aria} size={42} />
          </View>
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={[hr.cardTitle, { color: C.text }]}>{t("home.startWithAvatar")}</Text>
          <View style={hr.statusRow}>
            <View style={[hr.dot, { backgroundColor: C.emerald }]} />
            <Text style={[hr.cardSub, { color: C.text2 }]}>{t("home.tapToExplore")}</Text>
          </View>
        </View>
      </View>

      {/* Chat preview card — middle */}
      <View style={[hr.card, hr.chatCard]}>
        <View style={hr.chatHeader}>
          <View style={[hr.ringXs, { borderColor: C.sofia }]}>
            <Avatar uri={AVATARS.sofia} size={28} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[hr.chatName, { color: C.text }]}>Sofia</Text>
            <Text style={[hr.chatRole, { color: C.text2 }]}>AI · Interview coach</Text>
          </View>
          <View style={[hr.livePill, { backgroundColor: C.emerald + "22" }]}>
            <View style={[hr.dot, { backgroundColor: C.emerald }]} />
            <Text style={[hr.liveText, { color: C.emerald }]}>Live</Text>
          </View>
        </View>
        <View style={[hr.bubble, { backgroundColor: C.sofiaSoft || "#FCE7F3" }]}>
          <Text style={[hr.bubbleText, { color: C.text }]} numberOfLines={2}>
            Let’s sharpen your STAR answers — pick a role and we’ll start.
          </Text>
        </View>
        <View style={[hr.bubble, hr.bubbleMe, { backgroundColor: C.primarySoft || "#E0E7FF" }]}>
          <Text style={[hr.bubbleText, { color: C.text }]} numberOfLines={1}>
            Frontend engineer · mid-level
          </Text>
        </View>
      </View>

      {/* Job match card — bottom-left */}
      <View style={[hr.card, hr.jobCard]}>
        <View style={hr.jobHeader}>
          <View style={[hr.iconBox, { backgroundColor: C.mayaSoft || "#FEE2E2" }]}>
            <Ionicons name="briefcase" size={14} color={C.maya} />
          </View>
          <Text style={[hr.jobTitle, { color: C.text }]} numberOfLines={1}>Senior Product Designer</Text>
        </View>
        <Text style={[hr.jobMeta, { color: C.text2 }]} numberOfLines={1}>Stripe · London · £85k</Text>
        <View style={hr.matchRow}>
          <View style={hr.matchBarTrack}>
            <View style={[hr.matchBarFill, { width: "92%", backgroundColor: C.maya }]} />
          </View>
          <Text style={[hr.matchText, { color: C.maya }]}>92%</Text>
        </View>
      </View>

      {/* Score card — bottom-right */}
      <View style={[hr.card, hr.scoreCard]}>
        <Text style={[hr.scoreLabel, { color: C.text2 }]}>Interview score</Text>
        <Text style={[hr.scoreVal, { color: C.text }]}>8.6</Text>
        <View style={hr.scoreLegend}>
          <View style={[hr.legendDot, { backgroundColor: C.sofia }]} />
          <Text style={[hr.legendText, { color: C.text2 }]}>Communication</Text>
        </View>
        <View style={hr.scoreLegend}>
          <View style={[hr.legendDot, { backgroundColor: C.primary }]} />
          <Text style={[hr.legendText, { color: C.text2 }]}>Technical</Text>
        </View>
      </View>
    </View>
  );
}

const hr = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 480,
    position: "relative",
    marginLeft: 24,
  },
  glowA: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -40,
    right: -40,
    opacity: 0.18,
    filter: "blur(60px)" as any,
  },
  glowB: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: 20,
    left: -30,
    opacity: 0.16,
    filter: "blur(60px)" as any,
  },
  glowC: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: 160,
    right: 80,
    opacity: 0.12,
    filter: "blur(50px)" as any,
  },
  card: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.78)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(15,18,56,0.06)",
    padding: 14,
    ...(Platform.OS === "web"
      ? {
          backdropFilter: "blur(14px) saturate(160%)",
          WebkitBackdropFilter: "blur(14px) saturate(160%)",
          boxShadow:
            "0 10px 30px -10px rgba(15,18,56,0.18), 0 2px 6px -2px rgba(15,18,56,0.08)",
        }
      : {}),
  },
  avatarsCard: {
    top: 12,
    left: 24,
    right: 32,
    flexDirection: "row",
    alignItems: "center",
  },
  avatarsRow: { flexDirection: "row", alignItems: "center" },
  ringSm: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  ringXs: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  cardTitle: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  cardSub: { fontSize: 12, fontWeight: "500" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  chatCard: {
    top: 110,
    right: 0,
    width: 260,
  },
  chatHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  chatName: { fontSize: 13, fontWeight: "800" },
  chatRole: { fontSize: 11, fontWeight: "500", marginTop: 1 },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveText: { fontSize: 10, fontWeight: "700" },
  bubble: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 6,
  },
  bubbleMe: { alignSelf: "flex-end" },
  bubbleText: { fontSize: 12, lineHeight: 16, fontWeight: "500" },

  jobCard: {
    bottom: 24,
    left: 8,
    width: 240,
  },
  jobHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  jobTitle: { flex: 1, fontSize: 13, fontWeight: "800", letterSpacing: -0.2 },
  jobMeta: { fontSize: 11, fontWeight: "500", marginBottom: 10 },
  matchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  matchBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(15,18,56,0.08)",
    overflow: "hidden",
  },
  matchBarFill: { height: "100%", borderRadius: 3 },
  matchText: { fontSize: 12, fontWeight: "800" },

  scoreCard: {
    bottom: 24,
    right: 16,
    width: 150,
  },
  scoreLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  scoreVal: { fontSize: 28, fontWeight: "800", letterSpacing: -1, marginTop: 2, marginBottom: 8 },
  scoreLegend: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: "600" },
});

/* ---------- MAIN ---------- */
export default function Home() {
  const insets = useSafeAreaInsets();
  const { t, tArr, lang, setLang, langName } = useI18n();
  const { isDemo, enableDemo, refreshTick } = useDemo();
  const auth = useAuth();
  // Pull the theme-aware palette. Shadows the module-level `C_default`/`C`
  // for every JSX-inline style consumer in this component, giving us
  // dark-mode + system-follow behaviour everywhere `C.xxx` is read inline.
  // (Pre-baked styles from StyleSheet.create still use the light defaults.)
  const C = useC();
  const { resolved: themeMode } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<"maya" | "sofia" | "aria">("sofia");
  /* Track viewport width for desktop-only enhancements. Mobile (<1024px)
   * keeps its original single-column layout — only web ≥1024 gets the
   * SaaS-style two-column hero + the right-side visual composition. */
  const { width: winW } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && winW >= 1024;

  // Built-in supported languages — extend SUPPORTED_LANGS to add more
  const langs = SUPPORTED_LANGS;

  const PRICES: Record<string, string> = {
    "jobs-3": "£3.99", "jobs-5": "£6.99", "jobs-10": "£8.99",
    "itv-basic": "£5.99", "itv-standard": "£8.99", "itv-advanced": "£13.99",
    "coach-cv": "£7.99", "coach-answers": "£7.99", "coach-plan": "£11.99",
  };

  const jobsPlans: Plan[] = [
    { id: "jobs-3",  avatar: "maya", title: t("plans.jobs-3.title"),  subtitle: t("plans.jobs-3.sub"),  bullets: tArr("plans.jobs-3.bullets"),  price: PRICES["jobs-3"],  accent: C.maya, accentSoft: C.mayaSoft },
    { id: "jobs-5",  avatar: "maya", title: t("plans.jobs-5.title"),  subtitle: t("plans.jobs-5.sub"),  bullets: tArr("plans.jobs-5.bullets"),  price: PRICES["jobs-5"],  accent: C.maya, accentSoft: C.mayaSoft },
    { id: "jobs-10", avatar: "maya", title: t("plans.jobs-10.title"), subtitle: t("plans.jobs-10.sub"), bullets: tArr("plans.jobs-10.bullets"), price: PRICES["jobs-10"], accent: C.maya, accentSoft: C.mayaSoft, badge: t("services.bestValue") },
  ];

  const interviewPlans: Plan[] = [
    { id: "itv-basic",    avatar: "sofia", title: t("plans.itv-basic.title"),    subtitle: t("plans.itv-basic.sub"),    bullets: tArr("plans.itv-basic.bullets"),    price: PRICES["itv-basic"],    accent: C.sofia, accentSoft: C.sofiaSoft },
    { id: "itv-standard", avatar: "sofia", title: t("plans.itv-standard.title"), subtitle: t("plans.itv-standard.sub"), bullets: tArr("plans.itv-standard.bullets"), price: PRICES["itv-standard"], accent: C.sofia, accentSoft: C.sofiaSoft },
    { id: "itv-advanced", avatar: "sofia", title: t("plans.itv-advanced.title"), subtitle: t("plans.itv-advanced.sub"), bullets: tArr("plans.itv-advanced.bullets"), price: PRICES["itv-advanced"], accent: C.sofia, accentSoft: C.sofiaSoft, badge: t("services.bestValue") },
  ];

  const coachPlans: Plan[] = [
    { id: "coach-cv",      avatar: "aria", title: t("plans.coach-cv.title"),      subtitle: t("plans.coach-cv.sub"),      bullets: tArr("plans.coach-cv.bullets"),      price: PRICES["coach-cv"],      accent: C.aria, accentSoft: C.ariaSoft },
    { id: "coach-answers", avatar: "aria", title: t("plans.coach-answers.title"), subtitle: t("plans.coach-answers.sub"), bullets: tArr("plans.coach-answers.bullets"), price: PRICES["coach-answers"], accent: C.aria, accentSoft: C.ariaSoft },
    { id: "coach-plan",    avatar: "aria", title: t("plans.coach-plan.title"),    subtitle: t("plans.coach-plan.sub"),    bullets: tArr("plans.coach-plan.bullets"),    price: PRICES["coach-plan"],    accent: C.aria, accentSoft: C.ariaSoft, badge: t("services.bestValue") },
  ];

  const bundles: { id: string; avatar: "maya" | "sofia" | "aria"; title: string; desc: string; bullets: string[]; price: string; save: string; g1: string; g2: string }[] = [
    {
      id: "bundle-starter",
      avatar: "maya",
      title: t("bundles.bundle-starter.title"),
      desc: t("bundles.bundle-starter.desc"),
      bullets: tArr("bundles.bundle-starter.bullets"),
      price: "£11.99",
      save: t("bundles.bundle-starter.save"),
      g1: "#5B5FE9",
      g2: "#7C8DFF",
    },
    {
      id: "bundle-pro",
      avatar: "sofia",
      title: t("bundles.bundle-pro.title"),
      desc: t("bundles.bundle-pro.desc"),
      bullets: tArr("bundles.bundle-pro.bullets"),
      price: "£22.99",
      save: t("bundles.bundle-pro.save"),
      g1: "#0F172A",
      g2: "#334155",
    },
    {
      id: "bundle-launch",
      avatar: "aria",
      title: t("bundles.bundle-launch.title"),
      desc: t("bundles.bundle-launch.desc"),
      bullets: tArr("bundles.bundle-launch.bullets"),
      price: "£19.99",
      save: t("bundles.bundle-launch.save"),
      g1: "#EC4899",
      g2: "#F472B6",
    },
  ];

  const handleSelectAvatar = (a: "maya" | "sofia" | "aria") => {
    setSelectedAvatar(a);
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    // Smooth scroll to that avatar's services
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(servicesY.current[a] - 12, 0), animated: true });
    }, 30);
  };

  // Section refs for accurate scroll-to behaviour
  const avatarsSectionY = useRef(0);
  const servicesY = useRef<{ maya: number; sofia: number; aria: number; bundles: number }>({
    maya: 0,
    sofia: 0,
    aria: 0,
    bundles: 0,
  });

  // User / account state
  const [userName, setUserNameState] = useState<string | null>(null);
  const [accountTab, setAccountTab] = useState<"purchases" | "saved">("purchases");
  const [purchases, setPurchases] = useState<any[]>([]);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  // Sign-in modal
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInMode, setSignInMode] = useState<"signup" | "login">("signup");
  const [signInName, setSignInName] = useState("");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPwd, setSignInPwd] = useState("");
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInErr, setSignInErr] = useState<string | null>(null);
  // Open the signin modal when redirected here with ?signin=1 (e.g. from
  // /checkout when the user is not logged in).
  const homeParams = useLocalSearchParams<{ signin?: string; paid?: string }>();
  useEffect(() => {
    if (homeParams?.signin === "1" && !auth.user) {
      setSignInMode("signup");
      setSignInOpen(true);
    }
  }, [homeParams?.signin, auth.user]);

  // Trust modal
  const [trustModal, setTrustModal] = useState<null | { title: string; body: string }>(null);
  // Conversation demo state
  const [demoText, setDemoText] = useState("");
  const [demoSending, setDemoSending] = useState(false);

  useEffect(() => {
    (async () => {
      await getOrCreateUserId();
      const n = await getUserName();
      setUserNameState(n);
    })();
    // Prefetch avatar images for snappy first render
    if (Platform.OS !== "web") {
      RNImage.prefetch(AVATARS.maya).catch(() => {});
      RNImage.prefetch(AVATARS.sofia).catch(() => {});
      RNImage.prefetch(AVATARS.aria).catch(() => {});
    }
  }, []);

  // Refresh account whenever demo seed/reset bumps the tick + sync display name
  useEffect(() => {
    (async () => {
      const n = await getUserName();
      setUserNameState(n);
    })();
    reloadAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  // Detect Stripe success / cancel redirect on web
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const paid = sp.get("paid");
    const sess = sp.get("session");
    const paidAvatar = sp.get("avatar") || "";
    const cancelled = sp.get("cancelled");
    if (paid === "1" && sess) {
      (async () => {
        try {
          await api(`/payments/confirm/${sess}`, { method: "POST" });
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          reloadAccount();
        } catch {}
        // clean URL
        window.history.replaceState({}, "", window.location.pathname);
        // Return user to the correct chat/service after confirmation.
        if (paidAvatar && ["maya", "sofia", "aria"].includes(paidAvatar)) {
          router.replace({ pathname: "/chat", params: { avatar: paidAvatar } });
        }
      })();
    } else if (cancelled === "1") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const reloadAccount = useCallback(async () => {
    try {
      setAccountLoading(true);
      // Prefer the authenticated user_id (u_*). Fallback to guest id when
      // signed out so the screen still loads gracefully. Purchases from
      // checkout are now ALWAYS linked to a u_* id (anonymous payments are
      // blocked by the backend).
      const uid = auth.user?.user_id || (await getOrCreateUserId());
      const [p, j] = await Promise.all([
        api<any[]>(`/purchases?user_id=${uid}`).catch(() => []),
        api<any[]>(`/saved-jobs?user_id=${uid}`).catch(() => []),
      ]);
      setPurchases(p || []);
      setSavedJobs(j || []);
    } finally {
      setAccountLoading(false);
    }
  }, [auth.user?.user_id]);

  useEffect(() => {
    reloadAccount();
  }, [reloadAccount]);

  const scrollToAvatars = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    scrollRef.current?.scrollTo({ y: Math.max(avatarsSectionY.current - 12, 0), animated: true });
  };

  const scrollToServices = (a: "maya" | "sofia" | "aria") => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    scrollRef.current?.scrollTo({ y: Math.max(servicesY.current[a] - 12, 0), animated: true });
  };

  // Auth gate: signup → profile → service. Demo mode bypasses for testing.
  const gateForService = (proceed: () => void) => {
    // Demo mode is allowed (testing only)
    if (isDemo) { proceed(); return; }
    // Not logged in → push them through signup
    if (!auth.user) {
      setSignInMode("signup");
      setSignInOpen(true);
      return;
    }
    // Logged in but profile not completed → onboard them
    if (!auth.profileCompleted) {
      router.push("/profile");
      return;
    }
    // All good
    proceed();
  };

  const openChat = (a: "maya" | "sofia" | "aria") => {
    setSelectedAvatar(a);
    gateForService(() => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      router.push({ pathname: "/chat", params: { avatar: a } });
    });
  };

  const openCheckout = (p: Plan) => {
    gateForService(() => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      router.push({
        pathname: "/checkout",
        params: {
          avatar: p.avatar,
          item_id: p.id,
          title: p.title,
          price: p.price,
          bullets: p.bullets.join("|"),
          kind: "service",
        },
      });
    });
  };

  const openBundleCheckout = (b: typeof bundles[number]) => {
    gateForService(() => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      router.push({
        pathname: "/checkout",
        params: {
          avatar: b.avatar,
          item_id: b.id,
          title: b.title,
          price: b.price,
          bullets: b.bullets.join("|"),
          kind: "bundle",
        },
      });
    });
  };

  const handleInstall = async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    if (Platform.OS === "web") {
      Alert.alert(t("install.title"), t("install.bodyWeb"));
      return;
    }
    Alert.alert(t("install.nativeTitle"), t("install.bodyNative"));
  };

  const openTrust = (kind: "privacy" | "deletion" | "payments" | "honest") => {
    const map = {
      privacy:  { title: t("trust.privacyTitle"),  body: t("trust.privacyBody") },
      deletion: { title: t("trust.deletionTitle"), body: t("trust.deletionBody") },
      payments: { title: t("trust.paymentsTitle"), body: t("trust.paymentsBody") },
      honest:   { title: t("trust.honestTitle"),   body: t("trust.honestBody") },
    };
    setTrustModal(map[kind]);
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  };

  const handleSaveDemoJob = async () => {
    try {
      const uid = await getOrCreateUserId();
      await api("/saved-jobs", {
        method: "POST",
        body: JSON.stringify({ user_id: uid, title: "Sample matched role", company: "Revoloai", location: "Remote" }),
      });
      reloadAccount();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {}
  };

  const sendDemo = async () => {
    const t = demoText.trim();
    if (!t || demoSending) return;
    setDemoSending(true);
    try {
      // jump straight into a real chat with Sofia, prefilled
      router.push({ pathname: "/chat", params: { avatar: "sofia" } });
      setDemoText("");
    } finally {
      setDemoSending(false);
    }
  };

  const handleSignIn = async () => {
    setSignInErr(null);
    setSignInBusy(true);
    try {
      if (signInMode === "signup") {
        if (!signInName.trim() || !signInEmail.trim() || !signInPwd) {
          setSignInErr(t("account.fillAll"));
          return;
        }
        const r = await auth.signup(signInName.trim(), signInEmail.trim(), signInPwd);
        if (!r.ok) {
          setSignInErr(r.error || t("account.signupFailed"));
          return;
        }
        // Sync legacy AsyncStorage name + user_id
        await saveUserName(signInName.trim());
        setUserNameState(signInName.trim());
        setSignInOpen(false);
        setSignInName(""); setSignInEmail(""); setSignInPwd("");
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

        // Read T&C acceptance directly from AsyncStorage at decision time so
        // we don't rely on potentially stale React state. If the current
        // version is already accepted on this device, skip straight to the
        // profile form. Otherwise we still push to /profile — the global
        // <PostAuthTermsGuard /> will overlay the T&C modal because the user
        // is now authed and tcAccepted=false, blocking interaction with the
        // profile until they accept.
        let storedOk: string | null = null;
        let storedVer: string | null = null;
        try {
          storedOk = await AsyncStorage.getItem("revolo.tc.accepted");
          storedVer = await AsyncStorage.getItem("revolo.tc.version");
        } catch {}
        const acceptedNow = storedOk === "true" && storedVer === TC_VERSION;
        // Note: navigation is the same in either branch — the guard handles
        // the modal overlay. Kept as an explicit conditional in case future
        // requirements diverge between the two paths.
        if (acceptedNow) {
          router.push("/profile");
        } else {
          router.push("/profile");
        }
      } else {
        if (!signInEmail.trim() || !signInPwd) {
          setSignInErr(t("account.fillAll"));
          return;
        }
        const r = await auth.login(signInEmail.trim(), signInPwd);
        if (!r.ok) {
          setSignInErr(r.error || t("account.loginFailed"));
          return;
        }
        await saveUserName(r ? (auth.user?.name || signInEmail.trim()) : signInEmail.trim());
        setUserNameState(auth.user?.name || signInEmail.trim());
        setSignInOpen(false);
        setSignInName(""); setSignInEmail(""); setSignInPwd("");
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        // If profile not completed yet, push to profile
        if (!auth.profileCompleted) router.push("/profile");
      }
    } finally {
      setSignInBusy(false);
    }
  };

  const handleSignOut = async () => {
    await auth.logout();
    await clearUserName();
    setUserNameState(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={[styles.brandRow, { flex: 1 }]}>
            <RNImage
              source={require("../assets/images/revoloai-icon.png")}
              style={styles.logoMark}
              accessibilityLabel="RevoloAI logo"
              resizeMode="contain"
            />
            <Text style={[styles.brandText, { color: C.text }]}>revolo<Text style={{ color: C.primary }}>ai</Text></Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ThemeToggle />
            <PressableCard testID="install-btn" onPress={handleInstall} style={[styles.installBtn, { backgroundColor: C.bgSoft, borderColor: C.border }]}>
              <Ionicons name="phone-portrait-outline" size={14} color={C.text} />
              <Text style={[styles.installBtnText, { color: C.text }]}>{t("home.install")}</Text>
            </PressableCard>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
          scrollEventThrottle={16}
          decelerationRate="normal"
        >
          {/* HERO */}
          <View style={[styles.heroWrap, isDesktop && styles.heroWrapDesktop]}>
            <LinearGradient
              colors={["#EEEFFE", "#FDECF5", "#FFFFFF"]}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBg}
            />
            <View style={isDesktop ? styles.heroRow : undefined}>
              <View style={isDesktop ? styles.heroLeft : undefined}>
                <View style={styles.earlyAccessPill}>
                  <View style={[styles.pulseDot]} />
                  <Text style={styles.earlyAccessText}>{t("home.earlyAccess")}</Text>
                </View>

                <Text style={styles.heroTitle}>
                  {t("home.heroTitle1")}{"\n"}
                  <Text style={{ color: C.primary }}>{t("home.heroTitle2")}</Text>
                  {"\n"}{t("home.heroTitle3")}
                </Text>
                <Text style={styles.heroSub}>
                  {t("home.heroSub")}
                </Text>

                {/* Hero avatars row */}
                <View style={styles.heroAvatars}>
                  <View style={[styles.heroAvatarWrap, { borderColor: C.maya, zIndex: 3, marginLeft: 0 }]}>
                    <Avatar uri={AVATARS.maya } size={62} style={styles.heroAvatar} />
                  </View>
                  <View style={[styles.heroAvatarWrap, { borderColor: C.sofia, zIndex: 2, marginLeft: -28 }]}>
                    <Avatar uri={AVATARS.sofia } size={62} style={styles.heroAvatar} />
                  </View>
                  <View style={[styles.heroAvatarWrap, { borderColor: C.aria, zIndex: 1, marginLeft: -28 }]}>
                    <Avatar uri={AVATARS.aria } size={62} style={styles.heroAvatar} />
                  </View>
                  <View style={styles.heroAvatarsLabel}>
                    <Text style={styles.heroAvatarsTitle}>{t("home.startWithAvatar")}</Text>
                    <Text style={styles.heroAvatarsSub}>{t("home.tapToExplore")}</Text>
                  </View>
                </View>

                <View style={styles.heroCtas}>
                  <PressableCard
                    testID="hero-cta-primary"
                    style={styles.primaryBtn}
                    onPress={scrollToAvatars}
                  >
                    <Text style={styles.primaryBtnText}>{t("home.chooseAvatar")}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </PressableCard>
                  <View style={styles.heroChip}>
                    <Ionicons name="cash-outline" size={14} color={C.emerald} />
                    <Text style={styles.heroChipText}>{t("home.noSubscription")}</Text>
                  </View>
                </View>
              </View>

              {/* Desktop-only premium right-side visual composition. */}
              {isDesktop ? <HeroRightVisual C={C} t={t} /> : null}
            </View>
          </View>

          {/* LANGUAGE SELECTOR */}
          <View style={[styles.section, isDesktop && styles.sectionDesktop]}>
            <View style={[styles.langCard, { backgroundColor: C.card, borderColor: C.border }, isDesktop && styles.langCardDesktop]}>
              <View style={styles.langHeader}>
                <View style={[styles.langIcon, { backgroundColor: C.primarySoft }]}>
                  <Ionicons name="globe-outline" size={16} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.langTitle, { color: C.text }]}>{t("lang.title")}</Text>
                  <Text style={[styles.langSub, { color: C.text2 }]}>{t("lang.sub")}</Text>
                </View>
                <View style={[styles.langCountPill, { backgroundColor: C.primarySoft, borderColor: C.primary }]}>
                  <Text style={[styles.langCountPillText, { color: C.primary }]}>{langs.length}</Text>
                </View>
              </View>
              {/* 2-column grid — all 6 languages visible without scrolling.
                 Always LTR (the selector itself never mirrors). */}
              <View style={[styles.langGrid, Platform.OS === "web" && ({ direction: "ltr" } as any)]}>
                {langs.map((l) => {
                  const active = lang === l.code;
                  const flag = LANG_FLAG[l.code] || "";
                  return (
                    <Pressable
                      key={l.code}
                      testID={`lang-${l.code}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${l.name} (${l.native})`}
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        setLang(l.code as LangCode);
                        if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
                      }}
                      hitSlop={4}
                      style={({ pressed }) => [
                        styles.langTile,
                        isDesktop && styles.langTileDesktop,
                        {
                          backgroundColor: active ? C.primary : C.bgSoft,
                          borderColor: active ? C.primary : C.border,
                          opacity: pressed ? 0.85 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        },
                      ]}
                    >
                      <Text style={styles.langFlag}>{flag}</Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.langTileNative,
                            { color: active ? "#fff" : C.text, writingDirection: "ltr" as any },
                          ]}
                        >
                          {l.native}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.langTileName,
                            { color: active ? "rgba(255,255,255,0.85)" : C.text2 },
                          ]}
                        >
                          {l.name}
                        </Text>
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* TRUST */}
          <View style={styles.section}>
            <SectionLabel label={t("trust.label")} color={C.emerald} />
            <SectionTitle>{t("trust.title")}</SectionTitle>
            <View style={[styles.trustGrid, isDesktop && styles.trustGridDesktop]}>
              <TrustCard
                testID="trust-privacy" onPress={() => openTrust("privacy")}
                icon="shield-checkmark-outline"
                title={t("trust.privacyTitle")}
                tag={t("trust.privacyTag")}
                cta={t("trust.privacyCta")}
                color={C.primary}
                bg={C.primarySoft}
                isDesktop={isDesktop}
              />
              <TrustCard
                testID="trust-deletion" onPress={() => openTrust("deletion")}
                icon="trash-outline"
                title={t("trust.deletionTitle")}
                tag={t("trust.deletionTag")}
                cta={t("trust.deletionCta")}
                color={C.sofia}
                bg={C.sofiaSoft}
                isDesktop={isDesktop}
              />
              <TrustCard
                testID="trust-payments" onPress={() => openTrust("payments")}
                icon="card-outline"
                title={t("trust.paymentsTitle")}
                tag={t("trust.paymentsTag")}
                cta={t("trust.paymentsCta")}
                color={C.emerald}
                bg={C.emeraldSoft}
                isDesktop={isDesktop}
              />
              <TrustCard
                testID="trust-honest" onPress={() => openTrust("honest")}
                icon="information-circle-outline"
                title={t("trust.honestTitle")}
                tag={t("trust.honestTag")}
                cta={t("trust.honestCta")}
                color={C.aria}
                bg={C.ariaSoft}
                isDesktop={isDesktop}
              />
            </View>
            <View style={styles.honestNote}>
              <Ionicons name="alert-circle-outline" size={14} color={C.text2} />
              <Text style={styles.honestNoteText}>
                {t("trust.note")}
              </Text>
            </View>
          </View>

          {/* MEET YOUR AVATARS */}
          <View style={styles.section} onLayout={(e) => (avatarsSectionY.current = e.nativeEvent.layout.y)}>
            <SectionLabel label={t("meetAvatars.label")} color={C.primary} />
            <SectionTitle>{t("meetAvatars.title")}</SectionTitle>
            <SectionSub>{t("meetAvatars.sub")}</SectionSub>
            <View style={[styles.avatarRow, isDesktop && styles.avatarRowDesktop]}>
              <AvatarChip
                testID="avatar-maya" onPress={() => openChat("maya")}
                src={AVATARS.maya}
                name={t("avatars.maya.name")}
                role={t("avatars.maya.role")}
                color={C.maya}
                bg={C.mayaSoft}
              />
              <AvatarChip
                testID="avatar-sofia" onPress={() => openChat("sofia")}
                src={AVATARS.sofia}
                name={t("avatars.sofia.name")}
                role={t("avatars.sofia.role")}
                color={C.sofia}
                bg={C.sofiaSoft}
              />
              <AvatarChip
                testID="avatar-aria" onPress={() => openChat("aria")}
                src={AVATARS.aria}
                name={t("avatars.aria.name")}
                role={t("avatars.aria.role")}
                color={C.aria}
                bg={C.ariaSoft}
              />
            </View>
          </View>

          {/* MAYA - JOBS */}
          <View style={[styles.section, { backgroundColor: "#fff", paddingVertical: 28, marginTop: 8 }]} onLayout={(e) => (servicesY.current.maya = e.nativeEvent.layout.y)}>
            <View style={styles.servicePerson}>
              <View style={[styles.personRing, { borderColor: C.maya }]}>
                <Avatar uri={AVATARS.maya } size={62} style={styles.personImg} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <SectionLabel label={t("services.mayaLabel")} color={C.maya} />
                <Text style={[styles.sectionTitle, { marginTop: 6 }]}>{t("services.mayaTitle")}</Text>
                <Text style={styles.sectionSub}>{t("services.mayaSub")}</Text>
              </View>
            </View>
            <View style={[styles.plansList, isDesktop && styles.plansListDesktop]}>
              {jobsPlans.map((p, i) => (
                isDesktop ? (
                  <View key={p.title} style={styles.gridCellDesktop}>
                    <ServiceCard plan={p} idx={i} onPress={openCheckout} isDesktop />
                  </View>
                ) : (
                  <ServiceCard key={p.title} plan={p} idx={i} onPress={openCheckout} />
                )
              ))}
            </View>
          </View>

          {/* SOFIA - INTERVIEWS */}
          <View style={[styles.section, { paddingVertical: 28 }]} onLayout={(e) => (servicesY.current.sofia = e.nativeEvent.layout.y)}>
            <View style={styles.servicePerson}>
              <View style={[styles.personRing, { borderColor: C.sofia }]}>
                <Avatar uri={AVATARS.sofia } size={62} style={styles.personImg} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <SectionLabel label={t("services.sofiaLabel")} color={C.sofia} />
                <Text style={[styles.sectionTitle, { marginTop: 6 }]}>{t("services.sofiaTitle")}</Text>
                <Text style={styles.sectionSub}>{t("services.sofiaSub")}</Text>
              </View>
            </View>
            <View style={[styles.plansList, isDesktop && styles.plansListDesktop]}>
              {interviewPlans.map((p, i) => (
                isDesktop ? (
                  <View key={p.title} style={styles.gridCellDesktop}>
                    <ServiceCard plan={p} idx={i + 10} onPress={openCheckout} isDesktop />
                  </View>
                ) : (
                  <ServiceCard key={p.title} plan={p} idx={i + 10} onPress={openCheckout} />
                )
              ))}
            </View>
          </View>

          {/* ARIA - CAREER */}
          <View style={[styles.section, { backgroundColor: "#fff", paddingVertical: 28 }]} onLayout={(e) => (servicesY.current.aria = e.nativeEvent.layout.y)}>
            <View style={styles.servicePerson}>
              <View style={[styles.personRing, { borderColor: C.aria }]}>
                <Avatar uri={AVATARS.aria } size={62} style={styles.personImg} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <SectionLabel label={t("services.ariaLabel")} color={C.aria} />
                <Text style={[styles.sectionTitle, { marginTop: 6 }]}>{t("services.ariaTitle")}</Text>
                <Text style={styles.sectionSub}>{t("services.ariaSub")}</Text>
              </View>
            </View>
            <View style={[styles.plansList, isDesktop && styles.plansListDesktop]}>
              {coachPlans.map((p, i) => (
                isDesktop ? (
                  <View key={p.title} style={styles.gridCellDesktop}>
                    <ServiceCard plan={p} idx={i + 20} onPress={openCheckout} isDesktop />
                  </View>
                ) : (
                  <ServiceCard key={p.title} plan={p} idx={i + 20} onPress={openCheckout} />
                )
              ))}
            </View>
          </View>

          {/* BUNDLES */}
          <View style={[styles.section, { paddingVertical: 28 }]} onLayout={(e) => (servicesY.current.bundles = e.nativeEvent.layout.y)}>
            <SectionLabel label={t("bundles.label")} color={C.amber} />
            <SectionTitle>{t("bundles.title")}</SectionTitle>
            <SectionSub>{t("bundles.sub")}</SectionSub>
            <View style={[{ marginTop: 16, gap: 14 }, isDesktop && styles.bundlesGridDesktop]}>
              {bundles.map((b, i) => {
                const card = (
                  <PressableCard testID={`bundle-${i}`} onPress={() => openBundleCheckout(b)} style={[styles.bundleCard, isDesktop && styles.bundleCardDesktop]}>
                    <LinearGradient
                      colors={[b.g1, b.g2]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.bundleBadge}>
                      <Text style={styles.bundleBadgeText}>{b.save}</Text>
                    </View>
                    <Text style={styles.bundleTitle}>{b.title}</Text>
                    <Text style={styles.bundleDesc}>{b.desc}</Text>
                    <View style={{ marginTop: 14, gap: 8 }}>
                      {b.bullets.map((bb, ii) => (
                        <View key={ii} style={styles.bundleBullet}>
                          <Ionicons name="checkmark-circle" size={14} color="#fff" />
                          <Text style={styles.bundleBulletText}>{bb}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.bundleFooter}>
                      <Text style={styles.bundlePrice}>{b.price}</Text>
                      <View style={styles.bundleCta}>
                        <Text style={styles.bundleCtaText}>{t("bundles.unlock")}</Text>
                        <Ionicons name="arrow-forward" size={14} color={b.g1} />
                      </View>
                    </View>
                  </PressableCard>
                );
                return isDesktop ? (
                  <View key={b.title} style={styles.gridCellDesktop}>{card}</View>
                ) : (
                  <React.Fragment key={b.title}>{card}</React.Fragment>
                );
              })}
            </View>
          </View>

          {/* CONVERSATION DEMO */}
          <View style={[styles.section, { backgroundColor: "#fff", paddingVertical: 28 }]}>
            <SectionLabel label={t("conversation.label")} color={C.sofia} />
            <SectionTitle>{t("conversation.title")}</SectionTitle>
            <View style={styles.chatCard}>
              <View style={styles.chatHeader}>
                <View style={[styles.personRing, { borderColor: C.sofia, width: 50, height: 50 }]}>
                  <Avatar uri={AVATARS.sofia } size={62} style={styles.personImg} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.chatName}>Sofia</Text>
                  <View style={styles.chatStatus}>
                    <View style={[styles.pulseDot, { backgroundColor: C.emerald }]} />
                    <Text style={styles.chatStatusText}>{t("conversation.live")}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.chatBody}>
                <View style={[styles.bubble, styles.bubbleAi]}>
                  <Text style={styles.bubbleAiText}>{t("conversation.sofiaQ1")}</Text>
                </View>
                <View style={[styles.bubble, styles.bubbleUser]}>
                  <Text style={styles.bubbleUserText}>{t("conversation.userA")}</Text>
                </View>
                <View style={[styles.bubble, styles.bubbleAi]}>
                  <Text style={styles.bubbleAiText}>{t("conversation.sofiaQ2")}</Text>
                </View>
              </View>
              <View style={styles.chatInput}>
                <Pressable testID="demo-mic-btn" onPress={() => openChat("sofia")} style={styles.micBtn}>
                  <Ionicons name="mic" size={16} color="#fff" />
                </Pressable>
                <TextInput
                  testID="demo-chat-input"
                  style={[styles.chatInputText, { flex: 1, paddingVertical: 6, ...(Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {}) }]}
                  placeholder={t("conversation.inputPh")}
                  placeholderTextColor={C.text3}
                  value={demoText}
                  onChangeText={setDemoText}
                  onSubmitEditing={sendDemo}
                  returnKeyType="send"
                />
                <Pressable
                  testID="demo-send-btn"
                  onPress={sendDemo}
                  disabled={!demoText.trim() || demoSending}
                  style={[
                    styles.demoSendBtn,
                    { backgroundColor: !demoText.trim() ? "#CBD0DE" : C.sofia },
                  ]}
                >
                  {demoSending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="arrow-up" size={14} color="#fff" />
                  )}
                </Pressable>
              </View>
            </View>
          </View>

          {/* HOW IT WORKS */}
          <View style={[styles.section, { paddingVertical: 28 }]}>
            <SectionLabel label={t("how.label")} color={C.primary} />
            <SectionTitle>{t("how.title")}</SectionTitle>
            <View style={styles.howCard}>
              <HowStep n={1} title={t("how.s1Title")} desc={t("how.s1Desc")} />
              <View style={styles.howDivider} />
              <HowStep n={2} title={t("how.s2Title")} desc={t("how.s2Desc")} />
              <View style={styles.howDivider} />
              <HowStep n={3} title={t("how.s3Title")} desc={t("how.s3Desc")} />
              <View style={styles.howDivider} />
              <HowStep n={4} title={t("how.s4Title")} desc={t("how.s4Desc")} />
            </View>
          </View>

          {/* FINAL CTA */}
          <View style={[styles.section, { paddingTop: 8, paddingBottom: 28 }]}>
            <View style={styles.finalCta}>
              <LinearGradient
                colors={["#0B0F19", "#1E2440"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.finalAvatars}>
                <View style={[styles.finalAvatarWrap, { borderColor: C.maya, marginLeft: 0 }]}>
                  <Avatar uri={AVATARS.maya } size={50} style={styles.finalAvatar} />
                </View>
                <View style={[styles.finalAvatarWrap, { borderColor: C.sofia, marginLeft: -20 }]}>
                  <Avatar uri={AVATARS.sofia } size={50} style={styles.finalAvatar} />
                </View>
                <View style={[styles.finalAvatarWrap, { borderColor: C.aria, marginLeft: -20 }]}>
                  <Avatar uri={AVATARS.aria } size={50} style={styles.finalAvatar} />
                </View>
              </View>
              <Text style={styles.finalTitle}>{t("finalCta.title")}</Text>
              <Text style={styles.finalSub}>
                {t("finalCta.sub")}
              </Text>
              <PressableCard testID="final-start-btn" onPress={scrollToAvatars} style={styles.finalBtn}>
                <Text style={styles.finalBtnText}>{t("finalCta.btn")}</Text>
                <Ionicons name="arrow-forward" size={16} color="#0B0F19" />
              </PressableCard>
            </View>
          </View>

          {/* ACCOUNT */}
          <View style={[styles.section, { paddingVertical: 24 }]}>
            <SectionLabel label={t("account.label")} color={C.text2} />
            <SectionTitle>{t("account.title")}</SectionTitle>
            <View style={styles.accountCard}>
              <View style={styles.guestRow}>
                <View style={[styles.guestAvatar, userName ? { backgroundColor: C.primary } : null]}>
                  <Text style={[styles.guestAvatarText, userName ? { color: "#fff" } : null]}>
                    {(userName || "G").trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.guestName}>{userName || t("account.guest")}</Text>
                  <Text style={styles.guestSub}>
                    {userName ? t("account.signedSub") : t("account.guestSub")}
                  </Text>
                </View>
                <Pressable
                  testID="signin-btn"
                  onPress={() => (userName ? handleSignOut() : setSignInOpen(true))}
                  style={styles.signInBtn}
                >
                  <Text style={styles.signInBtnText}>{userName ? t("account.signOut") : t("account.signIn")}</Text>
                </Pressable>
              </View>
              <View style={styles.accountTabs}>
                <Pressable
                  testID="account-tab-purchases"
                  onPress={() => setAccountTab("purchases")}
                  style={[styles.accountTab, accountTab === "purchases" && styles.accountTabActive]}
                >
                  <Ionicons name="bag-handle-outline" size={14} color={accountTab === "purchases" ? C.primary : C.text2} />
                  <Text style={[styles.accountTabText, accountTab === "purchases" && { color: C.primary }]}>{t("account.purchases")}</Text>
                </Pressable>
                <Pressable
                  testID="account-tab-saved"
                  onPress={() => setAccountTab("saved")}
                  style={[styles.accountTab, accountTab === "saved" && styles.accountTabActive]}
                >
                  <Ionicons name="bookmark-outline" size={14} color={accountTab === "saved" ? C.primary : C.text2} />
                  <Text style={[styles.accountTabText, accountTab === "saved" && { color: C.primary }]}>{t("account.savedJobs")}</Text>
                </Pressable>
              </View>

              {/* Tab content */}
              <View style={{ marginTop: 14 }}>
                {accountLoading ? (
                  <ActivityIndicator color={C.primary} />
                ) : accountTab === "purchases" ? (
                  purchases.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Ionicons name="receipt-outline" size={20} color={C.text3} />
                      <Text style={styles.emptyText}>{t("account.noPurchases")}</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {purchases.map((p) => (
                        <View key={p.id} style={styles.listRow}>
                          <View style={[styles.listIcon, { backgroundColor: C.primarySoft }]}>
                            <Ionicons name="checkmark" size={14} color={C.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.listTitle}>{p.item_title}</Text>
                            <Text style={styles.listSub}>{p.price} · {p.kind}</Text>
                          </View>
                          <Pressable
                            testID={`open-purchase-${p.id}`}
                            onPress={() => openChat(p.avatar)}
                            style={[styles.smallCta, { backgroundColor: C.primary }]}
                          >
                            <Text style={styles.smallCtaText}>{t("common.open")}</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )
                ) : savedJobs.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="bookmark-outline" size={20} color={C.text3} />
                    <Text style={styles.emptyText}>{t("account.noSaved")}</Text>
                    <Pressable
                      testID="save-demo-job-btn"
                      onPress={handleSaveDemoJob}
                      style={[styles.smallCta, { backgroundColor: C.maya, marginTop: 10 }]}
                    >
                      <Text style={styles.smallCtaText}>{t("account.saveSample")}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    {savedJobs.map((j) => (
                      <View key={j.id} style={styles.listRow}>
                        <View style={[styles.listIcon, { backgroundColor: C.mayaSoft }]}>
                          <Ionicons name="briefcase-outline" size={14} color={C.maya} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.listTitle}>{j.title}</Text>
                          <Text style={styles.listSub}>{j.company}{j.location ? ` · ${j.location}` : ""}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              {t("footer.note")}
            </Text>
            <View style={styles.footerLinks}>
              <Pressable testID="footer-privacy" onPress={() => router.push({ pathname: "/legal/[slug]", params: { slug: "privacy" } })} hitSlop={8}>
                <Text style={styles.footerLink}>{t("footer.privacy")}</Text>
              </Pressable>
              <Text style={styles.footerDot}>·</Text>
              <Pressable testID="footer-terms" onPress={() => router.push({ pathname: "/legal/[slug]", params: { slug: "terms" } })} hitSlop={8}>
                <Text style={styles.footerLink}>{t("footer.terms")}</Text>
              </Pressable>
              <Text style={styles.footerDot}>·</Text>
              <Pressable testID="footer-cookies" onPress={() => router.push({ pathname: "/legal/[slug]", params: { slug: "cookies" } })} hitSlop={8}>
                <Text style={styles.footerLink}>{t("footer.cookies")}</Text>
              </Pressable>
              <Text style={styles.footerDot}>·</Text>
              <Pressable testID="footer-deletion" onPress={() => router.push({ pathname: "/legal/[slug]", params: { slug: "deletion" } })} hitSlop={8}>
                <Text style={styles.footerLink}>{t("footer.deletion")}</Text>
              </Pressable>
            </View>
            <Text style={styles.footerCopy}>{t("footer.copy", { year: new Date().getFullYear() })}</Text>
          </View>
          <CopyrightFooter />
        </ScrollView>

        {/* STICKY BOTTOM BAR */}
        <View style={[styles.bottomBarWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {Platform.OS === "ios" ? (
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.92)" }]} />
          )}
          <View style={styles.bottomBar}>
            <View style={styles.bottomNavRow}>
              {(["maya", "sofia", "aria"] as const).map((a) => {
                const active = selectedAvatar === a;
                const color = a === "maya" ? C.maya : a === "sofia" ? C.sofia : C.aria;
                const name = a === "maya" ? "Maya" : a === "sofia" ? "Sofia" : "Aria";
                return (
                  <Pressable
                    key={a}
                    testID={`bottom-nav-${a}`}
                    onPress={() => handleSelectAvatar(a)}
                    style={[
                      styles.bottomNavItem,
                      active && { backgroundColor: color + "14" },
                    ]}
                  >
                    <Avatar uri={AVATARS[a] } size={22} style={styles.bottomNavImg} />
                    <Text
                      style={[
                        styles.bottomNavText,
                        { color: active ? color : C.text2, fontWeight: active ? "700" : "500" },
                      ]}
                    >
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <PressableCard
              testID="sticky-cta"
              style={styles.stickyCta}
              onPress={() => openChat(selectedAvatar)}
            >
              <LinearGradient
                colors={["#5B5FE9", "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={styles.stickyCtaText}>{t("home.startWith", { name: t(`avatars.${selectedAvatar}.name`) })}</Text>
            </PressableCard>
          </View>
        </View>

        {/* Sign in modal */}
        {signInOpen && (
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {signInMode === "signup" ? t("account.signupTitle") : t("account.loginTitle")}
              </Text>
              <Text style={styles.modalSub}>
                {signInMode === "signup" ? t("account.signupSub") : t("account.loginSub")}
              </Text>

              <View style={{ flexDirection: "row", marginTop: 12, marginBottom: 8 }}>
                <Pressable onPress={() => setSignInMode("signup")} style={[styles.tabBtn, signInMode === "signup" && styles.tabBtnOn]}>
                  <Text style={[styles.tabBtnText, signInMode === "signup" && styles.tabBtnTextOn]}>{t("account.signupTab")}</Text>
                </Pressable>
                <Pressable onPress={() => setSignInMode("login")} style={[styles.tabBtn, signInMode === "login" && styles.tabBtnOn]}>
                  <Text style={[styles.tabBtnText, signInMode === "login" && styles.tabBtnTextOn]}>{t("account.loginTab")}</Text>
                </Pressable>
              </View>

              {signInMode === "signup" && (
                <TextInput
                  testID="signin-name-input"
                  placeholder={t("account.namePh")}
                  placeholderTextColor={C.text3}
                  value={signInName}
                  onChangeText={setSignInName}
                  style={styles.modalInput}
                  autoFocus
                />
              )}
              <TextInput
                testID="signin-email-input"
                placeholder={t("account.emailPh")}
                placeholderTextColor={C.text3}
                value={signInEmail}
                onChangeText={setSignInEmail}
                style={[styles.modalInput, { marginTop: 8 }]}
                autoCapitalize="none"
                keyboardType="email-address"
                autoFocus={signInMode === "login"}
              />
              <TextInput
                testID="signin-password-input"
                placeholder={t("account.passwordPh")}
                placeholderTextColor={C.text3}
                value={signInPwd}
                onChangeText={setSignInPwd}
                secureTextEntry
                style={[styles.modalInput, { marginTop: 8 }]}
                onSubmitEditing={handleSignIn}
              />

              {signInErr ? <Text style={styles.errText}>{signInErr}</Text> : null}

              <Pressable
                testID="signin-try-demo"
                onPress={async () => {
                  setSignInOpen(false);
                  await enableDemo();
                  if (Platform.OS !== "web")
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                }}
                style={styles.demoTryBtn}
              >
                <Ionicons name="sparkles" size={14} color={C.emerald} />
                <Text style={styles.demoTryText}>{t("demo.enableTitle")}</Text>
              </Pressable>
              <View style={styles.modalActions}>
                <Pressable testID="signin-cancel" onPress={() => setSignInOpen(false)} style={[styles.modalBtn, { backgroundColor: C.bgSoft }]}>
                  <Text style={[styles.modalBtnText, { color: C.text }]}>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable
                  testID="signin-confirm"
                  onPress={handleSignIn}
                  disabled={signInBusy}
                  style={[styles.modalBtn, { backgroundColor: signInBusy ? "#CBD0DE" : C.primary }]}
                >
                  {signInBusy ? <ActivityIndicator color="#fff" /> : (
                    <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                      {signInMode === "signup" ? t("account.createAccount") : t("account.logIn")}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Trust info modal */}
        {!!trustModal && (
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{trustModal.title}</Text>
              <Text style={styles.modalSub}>{trustModal.body}</Text>
              <View style={styles.modalActions}>
                <Pressable
                  testID="trust-modal-close"
                  onPress={() => setTrustModal(null)}
                  style={[styles.modalBtn, { flex: 1, backgroundColor: C.primary }]}
                >
                  <Text style={[styles.modalBtnText, { color: "#fff" }]}>{t("common.gotIt")}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

/* ---------- Styles ---------- */
const cardShadow = Platform.select({
  ios: {
    shadowColor: "#0B0F19",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
  },
  android: { elevation: 2 },
  default: {
    boxShadow: "0px 6px 18px rgba(11, 15, 25, 0.06)",
  },
});

const styles = StyleSheet.create({
  /* Top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: -0.5 },
  brandText: { fontSize: 18, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
  installBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    ...cardShadow,
  },
  installBtnText: { fontSize: 13, fontWeight: "600", color: C.text },

  /* Hero */
  heroWrap: {
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 20,
    overflow: "hidden",
    position: "relative",
  },
  /* Desktop hero — extra vertical padding + room for the right-side
     premium visual composition. Mobile stays untouched. */
  heroWrapDesktop: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 24,
  },
  heroLeft: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingVertical: 12,
  },
  heroBg: { ...StyleSheet.absoluteFillObject, opacity: 0.9 },
  earlyAccessPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.emerald,
  },
  earlyAccessText: { fontSize: 12, fontWeight: "600", color: C.text },
  heroTitle: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -1.2,
    marginTop: 18,
  },
  heroSub: {
    fontSize: 15,
    lineHeight: 22,
    color: C.text2,
    marginTop: 12,
    maxWidth: 340,
  },
  heroAvatars: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
  },
  heroAvatarWrap: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  heroAvatar: { width: "100%", height: "100%", resizeMode: "cover" },
  heroAvatarsLabel: { marginLeft: 14 },
  heroAvatarsTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  heroAvatarsSub: { fontSize: 12, color: C.text2, marginTop: 2 },
  heroCtas: { marginTop: 22, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.primary,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  heroChipText: { fontSize: 12, fontWeight: "600", color: C.text },

  /* Section */
  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionLabel: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sectionLabelText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  sectionTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.6,
    marginTop: 10,
    lineHeight: 32,
  },
  sectionSub: { fontSize: 14, color: C.text2, marginTop: 6, lineHeight: 20 },

  /* Language */
  langCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    ...cardShadow,
  },
  langHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  langIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  langTitle: { fontSize: 15, fontWeight: "700", color: C.text },
  langSub: { fontSize: 12, color: C.text2, marginTop: 2 },
  langChip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.bgSoft,
    marginRight: 8,
  },
  langChipActive: { backgroundColor: C.primary },
  langChipText: { fontSize: 13, fontWeight: "600", color: C.text2 },
  langChipTextActive: { color: "#fff" },
  langGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 8,
    rowGap: 8,
    marginTop: 6,
  },
  langTile: {
    width: "48%",
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  langFlag: { fontSize: 22, lineHeight: 26 },
  langTileNative: { fontSize: 15, fontWeight: "700" },
  langTileName: { fontSize: 11, fontWeight: "500", marginTop: 1 },
  langCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 26,
    alignItems: "center",
  },
  langCountPillText: { fontSize: 11, fontWeight: "800" },

  /* Trust */
  trustGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  trustCard: {
    width: (SCREEN_W - 40 - 12) / 2,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    ...cardShadow,
  },
  trustIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  trustTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  trustTag: { fontSize: 11, color: C.text3, marginTop: 2 },
  trustCta: { fontSize: 12, fontWeight: "700", marginTop: 10 },
  honestNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: C.bgSoft,
    padding: 12,
    borderRadius: 14,
    marginTop: 14,
  },
  honestNoteText: { flex: 1, fontSize: 12, color: C.text2, lineHeight: 18 },

  /* Avatars row */
  avatarRow: { marginTop: 18, flexDirection: "row", gap: 10 },
  avatarCard: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "center",
    ...cardShadow,
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    backgroundColor: "#fff",
    overflow: "hidden",
    marginBottom: 12,
  },
  avatarImg: { width: "100%", height: "100%", resizeMode: "cover" },
  avatarRole: { fontSize: 11, color: C.text2, fontWeight: "600" },
  avatarName: { fontSize: 16, fontWeight: "800", marginTop: 2 },

  /* Service person header */
  servicePerson: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  personRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  personImg: { width: "100%", height: "100%", resizeMode: "cover" },

  /* Service plan card */
  plansList: { gap: 12 },
  serviceCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
    ...cardShadow,
  },
  serviceTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  serviceTitle: { fontSize: 17, fontWeight: "800", color: C.text, letterSpacing: -0.3 },
  serviceSub: { fontSize: 13, color: C.text2, marginTop: 3, lineHeight: 18 },
  bestBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  bestBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  serviceBullets: { marginTop: 14, gap: 8 },
  bulletRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bulletText: { fontSize: 13, color: C.text, flex: 1 },
  serviceFoot: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 14,
  },
  priceLabel: { fontSize: 11, color: C.text3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  servicePrice: { fontSize: 22, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
  getBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  getBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  /* Bundles */
  bundleCard: {
    borderRadius: 24,
    padding: 22,
    overflow: "hidden",
    ...cardShadow,
  },
  bundleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginBottom: 12,
  },
  bundleBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  bundleTitle: { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  bundleDesc: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4 },
  bundleBullet: { flexDirection: "row", alignItems: "center", gap: 8 },
  bundleBulletText: { color: "rgba(255,255,255,0.95)", fontSize: 13 },
  bundleFooter: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bundlePrice: { color: "#fff", fontSize: 24, fontWeight: "800" },
  bundleCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  bundleCtaText: { fontSize: 14, fontWeight: "800", color: "#0B0F19" },

  /* Chat */
  chatCard: {
    backgroundColor: C.bgSoft,
    borderRadius: 22,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  chatHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  chatName: { fontSize: 14, fontWeight: "800", color: C.text },
  chatStatus: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  chatStatusText: { fontSize: 11, color: C.text2 },
  chatBody: { gap: 8 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, maxWidth: "85%" },
  bubbleAi: { backgroundColor: "#fff", alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  bubbleAiText: { fontSize: 13, color: C.text, lineHeight: 18 },
  bubbleUser: { backgroundColor: C.primary, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleUserText: { fontSize: 13, color: "#fff", lineHeight: 18 },
  chatInput: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.sofia,
    alignItems: "center",
    justifyContent: "center",
  },
  chatInputText: { color: C.text3, fontSize: 13 },

  /* How */
  howCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    marginTop: 16,
    ...cardShadow,
  },
  howStep: { flexDirection: "row", alignItems: "center", gap: 14 },
  howNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  howNumText: { color: C.primary, fontWeight: "800", fontSize: 14 },
  howTitle: { fontSize: 15, fontWeight: "700", color: C.text },
  howDesc: { fontSize: 13, color: C.text2, marginTop: 2 },
  howDivider: { height: 1, backgroundColor: C.border, marginVertical: 12, marginLeft: 46 },

  /* Final CTA */
  finalCta: {
    borderRadius: 28,
    padding: 28,
    overflow: "hidden",
    alignItems: "center",
    ...cardShadow,
  },
  finalAvatars: { flexDirection: "row", marginBottom: 16 },
  finalAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  finalAvatar: { width: "100%", height: "100%", resizeMode: "cover" },
  finalTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  finalSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
    maxWidth: 300,
  },
  finalBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  finalBtnText: { color: "#0B0F19", fontWeight: "800", fontSize: 15 },

  /* Account */
  accountCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    marginTop: 16,
    ...cardShadow,
  },
  guestRow: { flexDirection: "row", alignItems: "center" },
  guestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.bgSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  guestAvatarText: { fontSize: 16, fontWeight: "800", color: C.text2 },
  guestName: { fontSize: 15, fontWeight: "700", color: C.text },
  guestSub: { fontSize: 12, color: C.text2, marginTop: 2 },
  signInBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: C.text,
  },
  signInBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  accountTabs: { flexDirection: "row", gap: 8, marginTop: 16 },
  accountTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.bgSoft,
    paddingVertical: 12,
    borderRadius: 14,
  },
  accountTabActive: { backgroundColor: C.primarySoft },
  accountTabText: { fontSize: 13, fontWeight: "600", color: C.text2 },

  /* Footer */
  footer: { paddingHorizontal: 20, paddingTop: 24, alignItems: "center", gap: 12 },
  footerNote: { fontSize: 11, color: C.text3, textAlign: "center", lineHeight: 16, maxWidth: 320 },
  footerLinks: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6 },
  footerLink: { fontSize: 12, color: C.text2, fontWeight: "600" },
  footerDot: { color: C.text3 },
  footerCopy: { fontSize: 11, color: C.text3, marginTop: 4 },

  /* Bottom bar */
  bottomBarWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 8,
    overflow: "hidden",
  },
  bottomBar: {
    paddingHorizontal: 14,
    paddingBottom: 4,
    gap: 10,
  },
  bottomNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bottomNavItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  bottomNavImg: { width: 22, height: 22, borderRadius: 11 },
  bottomNavText: { fontSize: 12 },
  stickyCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 5,
  },
  stickyCtaText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },

  /* Demo chat send */
  demoSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },

  /* Account list rows */
  emptyBox: {
    backgroundColor: C.bgSoft,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    gap: 6,
  },
  emptyText: { fontSize: 13, color: C.text2, textAlign: "center" },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.bgSoft,
    padding: 12,
    borderRadius: 14,
  },
  listIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  listTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  listSub: { fontSize: 12, color: C.text2, marginTop: 2 },
  smallCta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  smallCtaText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  /* Modal */
  modalBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(11, 15, 25, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 50,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 22,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: C.text },
  modalSub: { fontSize: 13, color: C.text2, marginTop: 6, lineHeight: 19 },
  modalInput: {
    marginTop: 14,
    backgroundColor: C.bgSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.text,
    ...(Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {}),
  },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  demoTryBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.emeraldSoft,
    borderWidth: 1,
    borderColor: C.emerald + "33",
  },
  demoTryText: { fontSize: 13, fontWeight: "700", color: C.emerald },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10, backgroundColor: C.bgSoft },
  tabBtnOn: { backgroundColor: C.primarySoft },
  tabBtnText: { fontSize: 12, fontWeight: "700", color: C.text2 },
  tabBtnTextOn: { color: C.primary },
  errText: { fontSize: 12, color: "#DC2626", marginTop: 8 },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnText: { fontSize: 14, fontWeight: "700" },

  /* ──────────────── Desktop-only compaction overrides ──────────────── */
  /* Applied via `isDesktop && styles.xDesktop`. Mobile + tablet (<1024px)
   * never receive these styles, so the native/app feel is preserved. */
  sectionDesktop: {
    paddingHorizontal: 40,
    paddingTop: 28,
  },
  langCardDesktop: {
    padding: 20,
    borderRadius: 18,
    // softer, premium drop shadow
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  langTileDesktop: {
    width: "31.8%",   // 3-column grid on desktop
    minHeight: 52,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  trustGridDesktop: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 14,
  },
  trustCardDesktop: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  avatarRowDesktop: {
    marginTop: 16,
    gap: 14,
  },
  plansListDesktop: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 14,
    alignItems: "stretch",
  },
  serviceCardDesktop: {
    // Mirror the working pattern of avatarCard (flex:1) so the inner card
    // stretches inside its outer 32%/flex parent. Combined with the
    // `gridCellDesktop` wrapper at the call site this gives a clean 3-up
    // grid with full natural card heights.
    flex: 1,
    padding: 16,
    borderRadius: 18,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  bundlesGridDesktop: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 14,
    alignItems: "stretch",
  },
  bundleCardDesktop: {
    flex: 1,
    padding: 18,
    borderRadius: 20,
  },
  /* Desktop 3-up grid cell. Wraps a ServiceCard / bundle card so the OUTER
   * element (a plain View) holds the width inside a flex row, while the
   * inner card retains its natural intrinsic height. */
  gridCellDesktop: {
    width: "32%",
  },
  gridCellTrust: {
    width: "23.5%",
  },
});
