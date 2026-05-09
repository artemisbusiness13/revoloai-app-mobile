import React, { useRef, useState, useCallback } from "react";
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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

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

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const AVATARS = {
  maya: `${BACKEND}/api/avatars/maya`,
  sofia: `${BACKEND}/api/avatars/sofia`,
  aria: `${BACKEND}/api/avatars/aria`,
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
  const { scale, onPressIn, onPressOut } = usePressScale();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/* ---------- Service Card ---------- */
type Plan = {
  title: string;
  subtitle: string;
  bullets: string[];
  price: string;
  badge?: string;
  accent: string;
  accentSoft: string;
};

function ServiceCard({ plan, idx }: { plan: Plan; idx: number }) {
  const isFeatured = !!plan.badge;
  return (
    <PressableCard
      testID={`service-card-${idx}`}
      style={[
        styles.serviceCard,
        isFeatured && {
          borderColor: plan.accent,
          borderWidth: 1.5,
          shadowOpacity: 0.12,
        },
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
          <Text style={styles.priceLabel}>From</Text>
          <Text style={styles.servicePrice}>{plan.price}</Text>
        </View>
        <View style={[styles.getBtn, { backgroundColor: plan.accent }]}>
          <Text style={styles.getBtnText}>Get</Text>
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
}: {
  src: string;
  name: string;
  role: string;
  color: string;
  bg: string;
  testID?: string;
}) {
  return (
    <PressableCard testID={testID} style={[styles.avatarCard, { backgroundColor: bg }]}>
      <View style={[styles.avatarRing, { borderColor: color }]}>
        <Avatar uri={src } size={66} style={styles.avatarImg} />
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tag: string;
  cta: string;
  color: string;
  bg: string;
  testID?: string;
}) {
  return (
    <PressableCard testID={testID} style={[styles.trustCard]}>
      <View style={[styles.trustIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.trustTitle}>{title}</Text>
      <Text style={styles.trustTag}>{tag}</Text>
      <Text style={[styles.trustCta, { color }]}>{cta} →</Text>
    </PressableCard>
  );
}

/* ---------- MAIN ---------- */
export default function Home() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<"maya" | "sofia" | "aria">("sofia");
  const [lang, setLang] = useState("English");

  const langs = ["English", "Urdu", "Hindi", "Punjabi", "Bengali", "Romanian", "German", "Polish"];

  const jobsPlans: Plan[] = [
    {
      title: "3 jobs",
      subtitle: "3 hand-picked roles matching your profile",
      bullets: ["3 matched job results", "Match score per job", "Direct apply links"],
      price: "£3.99",
      accent: C.maya,
      accentSoft: C.mayaSoft,
    },
    {
      title: "5 jobs",
      subtitle: "5 curated roles + match scores",
      bullets: ["5 curated job results", "Better comparison", "Priority matching"],
      price: "£6.99",
      accent: C.maya,
      accentSoft: C.mayaSoft,
    },
    {
      title: "10 jobs",
      subtitle: "10 deep-matched roles + insights",
      bullets: ["10 job shortlist", "Best value search", "More options"],
      price: "£8.99",
      badge: "Best value",
      accent: C.maya,
      accentSoft: C.mayaSoft,
    },
  ];

  const interviewPlans: Plan[] = [
    {
      title: "Basic interview",
      subtitle: "3 questions · quick warm-up",
      bullets: ["3 interview questions", "Quick warm-up session", "Short feedback report"],
      price: "£5.99",
      accent: C.sofia,
      accentSoft: C.sofiaSoft,
    },
    {
      title: "Standard interview",
      subtitle: "Full 6-question interview",
      bullets: ["6 interview questions", "Score report included", "Improvement tips"],
      price: "£8.99",
      accent: C.sofia,
      accentSoft: C.sofiaSoft,
    },
    {
      title: "Advanced interview",
      subtitle: "10 questions + scored feedback",
      bullets: ["10 interview questions", "Deep scored feedback", "Strong preparation"],
      price: "£13.99",
      badge: "Best value",
      accent: C.sofia,
      accentSoft: C.sofiaSoft,
    },
  ];

  const coachPlans: Plan[] = [
    {
      title: "CV review",
      subtitle: "Detailed feedback on your CV",
      bullets: ["Full CV analysis", "Improvement notes", "Better positioning"],
      price: "£7.99",
      accent: C.aria,
      accentSoft: C.ariaSoft,
    },
    {
      title: "Answer suggestions",
      subtitle: "Tailored answers to common questions",
      bullets: ["Answer templates", "STAR structure guidance", "Confidence boost"],
      price: "£7.99",
      accent: C.aria,
      accentSoft: C.ariaSoft,
    },
    {
      title: "Career plan",
      subtitle: "12-month roadmap to your next role",
      bullets: ["30-day action plan", "Skill gap analysis", "Clear next steps"],
      price: "£11.99",
      badge: "Best value",
      accent: C.aria,
      accentSoft: C.ariaSoft,
    },
  ];

  const bundles = [
    {
      title: "Job Hunt Starter",
      desc: "5 jobs + Standard interview",
      bullets: ["5 curated job results", "Standard mock interview", "Save 20% vs separate"],
      price: "£11.99",
      save: "Save 20%",
      g1: "#5B5FE9",
      g2: "#7C8DFF",
    },
    {
      title: "Career Pro",
      desc: "10 jobs + Advanced interview + CV review",
      bullets: ["10 jobs + Advanced interview", "Full CV review included", "Save 35% vs separate"],
      price: "£22.99",
      save: "Save 35%",
      g1: "#0F172A",
      g2: "#334155",
    },
    {
      title: "Career Launch",
      desc: "Career plan + 5 jobs + CV review",
      bullets: ["Career plan + 5 jobs", "Full CV review included", "Save 24% vs separate"],
      price: "£19.99",
      save: "Save 24%",
      g1: "#EC4899",
      g2: "#F472B6",
    },
  ];

  const handleSelectAvatar = (a: "maya" | "sofia" | "aria") => {
    setSelectedAvatar(a);
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <LinearGradient
                colors={["#5B5FE9", "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.logoLetter}>r</Text>
            </View>
            <Text style={styles.brandText}>revolo<Text style={{ color: C.primary }}>ai</Text></Text>
          </View>
          <PressableCard testID="install-btn" style={styles.installBtn}>
            <Ionicons name="phone-portrait-outline" size={14} color={C.text} />
            <Text style={styles.installBtnText}>Install</Text>
          </PressableCard>
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
          <View style={styles.heroWrap}>
            <LinearGradient
              colors={["#EEEFFE", "#FDECF5", "#FFFFFF"]}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBg}
            />
            <View style={styles.earlyAccessPill}>
              <View style={[styles.pulseDot]} />
              <Text style={styles.earlyAccessText}>Now in early access</Text>
            </View>

            <Text style={styles.heroTitle}>
              Find better jobs.{"\n"}
              <Text style={{ color: C.primary }}>Practice interviews.</Text>
              {"\n"}Get hired faster.
            </Text>
            <Text style={styles.heroSub}>
              Your AI Career Assistant — three friendly avatars guide you from CV to offer.
            </Text>

            {/* Hero avatars row */}
            <View style={styles.heroAvatars}>
              <View style={[styles.heroAvatarWrap, { borderColor: C.maya, zIndex: 3, marginLeft: 0 }]}>
                <Avatar uri={AVATARS.maya } size={50} style={styles.heroAvatar} />
              </View>
              <View style={[styles.heroAvatarWrap, { borderColor: C.sofia, zIndex: 2, marginLeft: -22 }]}>
                <Avatar uri={AVATARS.sofia } size={50} style={styles.heroAvatar} />
              </View>
              <View style={[styles.heroAvatarWrap, { borderColor: C.aria, zIndex: 1, marginLeft: -22 }]}>
                <Avatar uri={AVATARS.aria } size={50} style={styles.heroAvatar} />
              </View>
              <View style={styles.heroAvatarsLabel}>
                <Text style={styles.heroAvatarsTitle}>Start with your avatar</Text>
                <Text style={styles.heroAvatarsSub}>Tap any card to explore</Text>
              </View>
            </View>

            <View style={styles.heroCtas}>
              <PressableCard
                testID="hero-cta-primary"
                style={styles.primaryBtn}
                onPress={() => scrollRef.current?.scrollTo({ y: 1100, animated: true })}
              >
                <Text style={styles.primaryBtnText}>Choose your avatar</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </PressableCard>
              <View style={styles.heroChip}>
                <Ionicons name="cash-outline" size={14} color={C.emerald} />
                <Text style={styles.heroChipText}>No subscription · Pay per use</Text>
              </View>
            </View>
          </View>

          {/* LANGUAGE SELECTOR */}
          <View style={styles.section}>
            <View style={styles.langCard}>
              <View style={styles.langHeader}>
                <View style={styles.langIcon}>
                  <Ionicons name="globe-outline" size={16} color={C.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.langTitle}>Choose your language</Text>
                  <Text style={styles.langSub}>Instantly translate the app experience</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
                {langs.map((l) => {
                  const active = lang === l;
                  return (
                    <Pressable
                      key={l}
                      testID={`lang-${l}`}
                      onPress={() => {
                        setLang(l);
                        if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
                      }}
                      style={[styles.langChip, active && styles.langChipActive]}
                    >
                      <Text style={[styles.langChipText, active && styles.langChipTextActive]}>{l}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* TRUST */}
          <View style={styles.section}>
            <SectionLabel label="Trust & safety" color={C.emerald} />
            <SectionTitle>Built to be private, secure, and yours</SectionTitle>
            <View style={styles.trustGrid}>
              <TrustCard
                testID="trust-privacy"
                icon="shield-checkmark-outline"
                title="Privacy Policy"
                tag="Policy"
                cta="View details"
                color={C.primary}
                bg={C.primarySoft}
              />
              <TrustCard
                testID="trust-deletion"
                icon="trash-outline"
                title="Data Deletion"
                tag="Your right"
                cta="Open"
                color={C.sofia}
                bg={C.sofiaSoft}
              />
              <TrustCard
                testID="trust-payments"
                icon="card-outline"
                title="Stripe & PayPal"
                tag="Secure"
                cta="See pricing"
                color={C.emerald}
                bg={C.emeraldSoft}
              />
              <TrustCard
                testID="trust-honest"
                icon="information-circle-outline"
                title="No card data stored"
                tag="No lock-in"
                cta="Learn more"
                color={C.aria}
                bg={C.ariaSoft}
              />
            </View>
            <View style={styles.honestNote}>
              <Ionicons name="alert-circle-outline" size={14} color={C.text2} />
              <Text style={styles.honestNoteText}>
                Revoloai helps you find and prepare for opportunities, but does not guarantee employment, interviews, or job offers.
              </Text>
            </View>
          </View>

          {/* MEET YOUR AVATARS */}
          <View style={styles.section}>
            <SectionLabel label="Choose" color={C.primary} />
            <SectionTitle>Meet your avatars</SectionTitle>
            <SectionSub>Three friendly AIs, each with a clear role.</SectionSub>
            <View style={styles.avatarRow}>
              <AvatarChip
                testID="avatar-maya"
                src={AVATARS.maya}
                name="Maya"
                role="Job Finder"
                color={C.maya}
                bg={C.mayaSoft}
              />
              <AvatarChip
                testID="avatar-sofia"
                src={AVATARS.sofia}
                name="Sofia"
                role="Interview Coach"
                color={C.sofia}
                bg={C.sofiaSoft}
              />
              <AvatarChip
                testID="avatar-aria"
                src={AVATARS.aria}
                name="Aria"
                role="Career Coach"
                color={C.aria}
                bg={C.ariaSoft}
              />
            </View>
          </View>

          {/* MAYA - JOBS */}
          <View style={[styles.section, { backgroundColor: "#fff", paddingVertical: 28, marginTop: 8 }]}>
            <View style={styles.servicePerson}>
              <View style={[styles.personRing, { borderColor: C.maya }]}>
                <Avatar uri={AVATARS.maya } size={50} style={styles.personImg} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <SectionLabel label="Job Finder · Maya" color={C.maya} />
                <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Get jobs that actually fit</Text>
                <Text style={styles.sectionSub}>Maya scouts roles based on your profile and goals.</Text>
              </View>
            </View>
            <View style={styles.plansList}>
              {jobsPlans.map((p, i) => (
                <ServiceCard key={p.title} plan={p} idx={i} />
              ))}
            </View>
          </View>

          {/* SOFIA - INTERVIEWS */}
          <View style={[styles.section, { paddingVertical: 28 }]}>
            <View style={styles.servicePerson}>
              <View style={[styles.personRing, { borderColor: C.sofia }]}>
                <Avatar uri={AVATARS.sofia } size={50} style={styles.personImg} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <SectionLabel label="Interview Sim · Sofia" color={C.sofia} />
                <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Practice the interview</Text>
                <Text style={styles.sectionSub}>Sofia runs realistic mock interviews for the role you want.</Text>
              </View>
            </View>
            <View style={styles.plansList}>
              {interviewPlans.map((p, i) => (
                <ServiceCard key={p.title} plan={p} idx={i + 10} />
              ))}
            </View>
          </View>

          {/* ARIA - CAREER */}
          <View style={[styles.section, { backgroundColor: "#fff", paddingVertical: 28 }]}>
            <View style={styles.servicePerson}>
              <View style={[styles.personRing, { borderColor: C.aria }]}>
                <Avatar uri={AVATARS.aria } size={50} style={styles.personImg} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <SectionLabel label="Career Coach · Aria" color={C.aria} />
                <Text style={[styles.sectionTitle, { marginTop: 6 }]}>Plan your next move</Text>
                <Text style={styles.sectionSub}>Aria reviews your CV, sharpens answers, maps your year.</Text>
              </View>
            </View>
            <View style={styles.plansList}>
              {coachPlans.map((p, i) => (
                <ServiceCard key={p.title} plan={p} idx={i + 20} />
              ))}
            </View>
          </View>

          {/* BUNDLES */}
          <View style={[styles.section, { paddingVertical: 28 }]}>
            <SectionLabel label="Save more" color={C.amber} />
            <SectionTitle>Smart bundles</SectionTitle>
            <SectionSub>Combine services and save up to 35%.</SectionSub>
            <View style={{ marginTop: 16, gap: 14 }}>
              {bundles.map((b, i) => (
                <PressableCard key={b.title} testID={`bundle-${i}`} style={styles.bundleCard}>
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
                      <Text style={styles.bundleCtaText}>Unlock</Text>
                      <Ionicons name="arrow-forward" size={14} color={b.g1} />
                    </View>
                  </View>
                </PressableCard>
              ))}
            </View>
          </View>

          {/* CONVERSATION DEMO */}
          <View style={[styles.section, { backgroundColor: "#fff", paddingVertical: 28 }]}>
            <SectionLabel label="Conversation" color={C.sofia} />
            <SectionTitle>Talk like a real interview</SectionTitle>
            <View style={styles.chatCard}>
              <View style={styles.chatHeader}>
                <View style={[styles.personRing, { borderColor: C.sofia, width: 40, height: 40 }]}>
                  <Avatar uri={AVATARS.sofia } size={50} style={styles.personImg} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.chatName}>Sofia</Text>
                  <View style={styles.chatStatus}>
                    <View style={[styles.pulseDot, { backgroundColor: C.emerald }]} />
                    <Text style={styles.chatStatusText}>live · listening</Text>
                  </View>
                </View>
              </View>
              <View style={styles.chatBody}>
                <View style={[styles.bubble, styles.bubbleAi]}>
                  <Text style={styles.bubbleAiText}>Tell me about a project you're proud of.</Text>
                </View>
                <View style={[styles.bubble, styles.bubbleUser]}>
                  <Text style={styles.bubbleUserText}>I led a redesign that doubled signups in 3 months.</Text>
                </View>
                <View style={[styles.bubble, styles.bubbleAi]}>
                  <Text style={styles.bubbleAiText}>Nice — what was the hardest trade-off?</Text>
                </View>
              </View>
              <View style={styles.chatInput}>
                <View style={styles.micBtn}>
                  <Ionicons name="mic" size={16} color="#fff" />
                </View>
                <Text style={styles.chatInputText}>Tap mic or type…</Text>
              </View>
            </View>
          </View>

          {/* HOW IT WORKS */}
          <View style={[styles.section, { paddingVertical: 28 }]}>
            <SectionLabel label="How" color={C.primary} />
            <SectionTitle>How it works</SectionTitle>
            <View style={styles.howCard}>
              <HowStep n={1} title="Choose service" desc="Pick what you need today." />
              <View style={styles.howDivider} />
              <HowStep n={2} title="Pay once" desc="From £4. No subscription." />
              <View style={styles.howDivider} />
              <HowStep n={3} title="Talk with avatar" desc="Real conversation, real prep." />
              <View style={styles.howDivider} />
              <HowStep n={4} title="Get results" desc="Jobs, scores & next steps." />
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
                <View style={[styles.finalAvatarWrap, { borderColor: C.sofia, marginLeft: -16 }]}>
                  <Avatar uri={AVATARS.sofia } size={50} style={styles.finalAvatar} />
                </View>
                <View style={[styles.finalAvatarWrap, { borderColor: C.aria, marginLeft: -16 }]}>
                  <Avatar uri={AVATARS.aria } size={50} style={styles.finalAvatar} />
                </View>
              </View>
              <Text style={styles.finalTitle}>Choose your career avatar</Text>
              <Text style={styles.finalSub}>
                It takes 30 seconds. Real human-style guidance from minute one.
              </Text>
              <PressableCard testID="final-start-btn" style={styles.finalBtn}>
                <Text style={styles.finalBtnText}>Start now</Text>
                <Ionicons name="arrow-forward" size={16} color="#0B0F19" />
              </PressableCard>
            </View>
          </View>

          {/* ACCOUNT */}
          <View style={[styles.section, { paddingVertical: 24 }]}>
            <SectionLabel label="You" color={C.text2} />
            <SectionTitle>Account</SectionTitle>
            <View style={styles.accountCard}>
              <View style={styles.guestRow}>
                <View style={styles.guestAvatar}>
                  <Text style={styles.guestAvatarText}>G</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.guestName}>Guest</Text>
                  <Text style={styles.guestSub}>Sign in to save jobs and history</Text>
                </View>
                <View style={styles.signInBtn}>
                  <Text style={styles.signInBtnText}>Sign in</Text>
                </View>
              </View>
              <View style={styles.accountTabs}>
                <View style={[styles.accountTab, styles.accountTabActive]}>
                  <Ionicons name="bag-handle-outline" size={14} color={C.primary} />
                  <Text style={[styles.accountTabText, { color: C.primary }]}>Purchases</Text>
                </View>
                <View style={styles.accountTab}>
                  <Ionicons name="bookmark-outline" size={14} color={C.text2} />
                  <Text style={styles.accountTabText}>Saved jobs</Text>
                </View>
              </View>
            </View>
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              revoloai helps users find and prepare for job opportunities, but does not guarantee employment, interviews, or job offers.
            </Text>
            <View style={styles.footerLinks}>
              <Text style={styles.footerLink}>Privacy Policy</Text>
              <Text style={styles.footerDot}>·</Text>
              <Text style={styles.footerLink}>Terms</Text>
              <Text style={styles.footerDot}>·</Text>
              <Text style={styles.footerLink}>Cookies</Text>
              <Text style={styles.footerDot}>·</Text>
              <Text style={styles.footerLink}>Data Deletion</Text>
            </View>
            <Text style={styles.footerCopy}>© {new Date().getFullYear()} revoloai</Text>
          </View>
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
              onPress={() => {
                if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }}
            >
              <LinearGradient
                colors={["#5B5FE9", "#8B5CF6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={styles.stickyCtaText}>Start with {selectedAvatar === "maya" ? "Maya" : selectedAvatar === "sofia" ? "Sofia" : "Aria"}</Text>
            </PressableCard>
          </View>
        </View>
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
    shadowColor: "#0B0F19",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
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
    width: 56,
    height: 56,
    borderRadius: 28,
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
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    backgroundColor: "#fff",
    overflow: "hidden",
    marginBottom: 10,
  },
  avatarImg: { width: "100%", height: "100%", resizeMode: "cover" },
  avatarRole: { fontSize: 11, color: C.text2, fontWeight: "600" },
  avatarName: { fontSize: 16, fontWeight: "800", marginTop: 2 },

  /* Service person header */
  servicePerson: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  personRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
});
