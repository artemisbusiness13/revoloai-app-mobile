import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Linking,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Avatar } from "../components/Avatar";
import {
  AVATARS,
  AVATAR_META,
  AvatarKey,
  api,
} from "../lib/api";
import { useI18n } from "../lib/i18n";
import { useAuth } from "../lib/auth";
import { ServiceInfoModal } from "../components/ui/ServiceInfoModal";
import { CopyrightFooter } from "../components/ui/CopyrightFooter";
import { recordPurchaseAcceptance } from "../lib/useTermsAcceptance";

export default function CheckoutScreen() {
  const { t } = useI18n();
  const { user, ready: authReady } = useAuth();
  const params = useLocalSearchParams<{
    avatar?: string;
    item_id?: string;
    title?: string;
    price?: string;
    bullets?: string;
    kind?: string;
  }>();
  const key = ((params.avatar as AvatarKey) || "maya") as AvatarKey;
  const meta = AVATAR_META[key];
  const item = {
    id: params.item_id || "item",
    title: params.title || "Item",
    price: params.price || "£0.00",
    bullets: (params.bullets || "").split("|").filter(Boolean),
    kind: params.kind || "service",
  };
  const [method, setMethod] = useState<"stripe" | "paypal">("stripe");
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [pollSession, setPollSession] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  // Guard: require logged-in user with email BEFORE allowing any payment action.
  // We show a friendly message and redirect to home with `?signin=1` so the
  // signin modal opens automatically.
  useEffect(() => {
    if (!authReady) return;
    if (!user || !user.email) {
      const msg = t("checkout.loginRequired");
      if (Platform.OS === "web") {
        try { window.alert(msg); } catch {}
        router.replace({ pathname: "/", params: { signin: "1" } });
      } else {
        Alert.alert(t("checkout.loginRequiredTitle"), msg, [
          { text: t("common.gotIt"), onPress: () => router.replace({ pathname: "/", params: { signin: "1" } }) },
        ]);
      }
    }
  }, [authReady, user, t]);

  useEffect(() => {
    if (done) {
      Animated.timing(fade, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [done, fade]);

  // Poll status when redirected back to the app
  useEffect(() => {
    if (!pollSession) return;
    let stopped = false;
    let attempts = 0;
    const tick = async () => {
      if (stopped || attempts >= 30) return;
      attempts++;
      try {
        const r = await api<any>(`/payments/status/${pollSession}`);
        if (r.payment_status === "paid") {
          setDone(true);
          setPaying(false);
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          return;
        }
        if (r.status === "expired") {
          setPaying(false);
          setPollSession(null);
          Alert.alert(t("checkout.cancelledTitle"), t("checkout.cancelledMsg"));
          return;
        }
      } catch {}
      setTimeout(tick, 2500);
    };
    tick();
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") tick();
    });
    return () => {
      stopped = true;
      sub.remove();
    };
  }, [pollSession]);

  // pay() is now a gate: it validates auth, then opens the ServiceInfoModal.
  // The actual Stripe redirect lives in doPay(), invoked by the modal's
  // "Continue to payment" button after the user accepts the disclosures.
  const pay = () => {
    if (paying || done) return;
    if (!user || !user.email) {
      const msg = t("checkout.loginRequired");
      if (Platform.OS === "web") {
        try { window.alert(msg); } catch {}
      } else {
        Alert.alert(t("checkout.loginRequiredTitle"), msg);
      }
      router.replace({ pathname: "/", params: { signin: "1" } });
      return;
    }
    if (method === "paypal") {
      Alert.alert(t("checkout.paypalSoonTitle"), t("checkout.paypalSoonMsg"));
      return;
    }
    // Open the pre-purchase information modal — required by UK consumer law.
    setShowInfo(true);
  };

  const doPay = async () => {
    if (paying || done) return;
    // Hard gate: must be logged in with email. Surfaced to user.
    if (!user || !user.email) {
      const msg = t("checkout.loginRequired");
      if (Platform.OS === "web") {
        try { window.alert(msg); } catch {}
      } else {
        Alert.alert(t("checkout.loginRequiredTitle"), msg);
      }
      router.replace({ pathname: "/", params: { signin: "1" } });
      return;
    }
    setShowInfo(false);
    // Record the per-purchase legal acceptance locally (T&C version + service
    // id + timestamp) — fulfils GDPR audit requirement without a new backend
    // endpoint.
    recordPurchaseAcceptance({ service: item.id, userId: user.user_id }).catch(() => {});
    setPaying(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const user_id = user.user_id;
      const user_email = user.email;
      const origin = Platform.OS === "web"
        ? (typeof window !== "undefined" ? window.location.origin : "")
        : "";
      // Where to send the user after payment confirmation (post webhook). The
      // backend stores this on the purchase row for the success-poll logic to
      // pick up. We also forward it as a query param on success_url for legacy
      // redirect handling.
      const return_path = `/chat?avatar=${encodeURIComponent(key)}`;
      const r = await api<{ url: string; session_id: string }>("/payments/checkout", {
        method: "POST",
        body: JSON.stringify({
          user_id,
          user_email,
          item_id: item.id,
          service_id: item.id,
          avatar_id: key,
          return_path,
          chat_path: return_path,
          success_url: `${origin}/?paid=1&session={CHECKOUT_SESSION_ID}&avatar=${encodeURIComponent(key)}`,
          cancel_url: `${origin}/?cancelled=1`,
        }),
      });
      setPollSession(r.session_id);
      if (Platform.OS === "web") {
        window.location.href = r.url;
      } else {
        await Linking.openURL(r.url);
      }
    } catch (e: any) {
      const msg = String(e?.message || "");
      // Backend returned 401/400 for missing auth/email — surface clean message
      if (msg.includes("login_required") || msg.includes("401")) {
        const m = t("checkout.loginRequired");
        if (Platform.OS === "web") { try { window.alert(m); } catch {} }
        else Alert.alert(t("checkout.loginRequiredTitle"), m);
        router.replace({ pathname: "/", params: { signin: "1" } });
      } else if (msg.includes("email_required")) {
        Alert.alert(t("checkout.payFailed"), t("checkout.loginRequired"));
      } else {
        Alert.alert(t("checkout.payFailed"), msg || t("common.retry"));
      }
      setPaying(false);
    }
  };

  const goChat = () => {
    router.replace({ pathname: "/chat", params: { avatar: key } });
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.header}>
          <Pressable testID="checkout-close-btn" onPress={() => router.back()} style={styles.headerBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color="#0B0F19" />
          </Pressable>
          <Text style={styles.headerTitle}>{t("checkout.title")}</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Avatar header */}
          <View style={[styles.avatarHeader, { backgroundColor: meta.soft }]}>
            <View style={[styles.headerAvatarRing, { borderColor: meta.color }]}>
              <Avatar uri={AVATARS[key]} size={62} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.smallLabel}>{t(`avatars.${key}.role`).toUpperCase()}</Text>
              <Text style={[styles.avatarName, { color: meta.color }]}>{t(`avatars.${key}.name`)}</Text>
            </View>
          </View>

          {/* Item */}
          <View style={styles.card}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {item.bullets.map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.tick, { backgroundColor: meta.soft }]}>
                  <Ionicons name="checkmark" size={11} color={meta.color} />
                </View>
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            ))}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{t("checkout.oneTime")}</Text>
              <Text style={styles.price}>{item.price}</Text>
            </View>
          </View>

          {/* Method */}
          <Text style={styles.sectionLabel}>{t("checkout.paymentMethod")}</Text>
          <View style={styles.methods}>
            {(["stripe", "paypal"] as const).map((m) => (
              <Pressable
                key={m}
                testID={`pay-method-${m}`}
                onPress={() => setMethod(m)}
                style={[
                  styles.methodCard,
                  method === m && { borderColor: meta.color, borderWidth: 2 },
                ]}
              >
                <Ionicons
                  name={m === "stripe" ? "card-outline" : "logo-paypal"}
                  size={20}
                  color={method === m ? meta.color : "#5B6577"}
                />
                <Text style={[styles.methodText, method === m && { color: meta.color }]}>
                  {m === "stripe" ? t("checkout.stripe") : t("checkout.paypal")}
                </Text>
                <View style={[styles.radio, method === m && { borderColor: meta.color }]}>
                  {method === m && <View style={[styles.radioInner, { backgroundColor: meta.color }]} />}
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.secureNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
            <Text style={styles.secureText}>{t("checkout.secure")}</Text>
          </View>
          <CopyrightFooter compact />
        </ScrollView>

        {/* Pre-purchase info modal — opens before any Stripe redirect */}
        <ServiceInfoModal
          visible={showInfo}
          onClose={() => setShowInfo(false)}
          onContinue={doPay}
          serviceTitle={item.title}
          serviceId={item.id}
          whatYouGet={item.bullets.length ? item.bullets : [item.title]}
          howItWorks={[
            t("legal.serviceInfo.howStep1") !== "legal.serviceInfo.howStep1"
              ? t("legal.serviceInfo.howStep1")
              : "Secure payment via Stripe",
            t("legal.serviceInfo.howStep2") !== "legal.serviceInfo.howStep2"
              ? t("legal.serviceInfo.howStep2")
              : "Instant access after payment confirmation",
            t("legal.serviceInfo.howStep3") !== "legal.serviceInfo.howStep3"
              ? t("legal.serviceInfo.howStep3")
              : "Start chatting with your AI avatar straight away",
          ]}
          estimatedTime={item.kind === "interview" ? "20–30 min" : item.kind === "review" ? "5–10 min" : undefined}
        />

        {/* Pay button / success */}
        <View style={styles.bottom}>
          {!done ? (
            <Pressable
              testID="pay-btn"
              onPress={pay}
              disabled={paying}
              style={({ pressed }) => [
                styles.payBtn,
                { opacity: pressed && !paying ? 0.92 : 1 },
              ]}
            >
              <LinearGradient
                colors={[meta.color, meta.color]}
                style={StyleSheet.absoluteFill}
              />
              {paying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={16} color="#fff" />
                  <Text style={styles.payBtnText}>{t("checkout.pay", { price: item.price })}</Text>
                </>
              )}
            </Pressable>
          ) : (
            <Animated.View style={[styles.successBox, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
              <View style={[styles.successDot, { backgroundColor: "#10B981" }]}>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </View>
              <Text style={styles.successTitle}>{t("checkout.confirmedTitle")}</Text>
              <Text style={styles.successSub}>{t("checkout.confirmedSub", { name: t(`avatars.${key}.name`) })}</Text>
              <Pressable testID="start-session-btn" onPress={goChat} style={[styles.startBtn, { backgroundColor: meta.color }]}>
                <Text style={styles.startBtnText}>{t("checkout.startSession")}</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </Pressable>
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAFAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#ECEEF3",
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#0B0F19" },

  avatarHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 22,
    marginBottom: 16,
  },
  headerAvatarRing: {
    width: 75, height: 75, borderRadius: 37.5, borderWidth: 3, overflow: "hidden", backgroundColor: "#fff",
  },
  smallLabel: { fontSize: 11, fontWeight: "700", color: "#5B6577", letterSpacing: 0.4 },
  avatarName: { fontSize: 22, fontWeight: "800", marginTop: 2 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ECEEF3",
    padding: 18,
  },
  itemTitle: { fontSize: 18, fontWeight: "800", color: "#0B0F19", marginBottom: 12 },
  bulletRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  tick: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  bulletText: { flex: 1, fontSize: 13, color: "#0B0F19" },
  priceRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: "#ECEEF3", marginTop: 12, paddingTop: 12,
  },
  priceLabel: { fontSize: 12, color: "#5B6577", fontWeight: "600" },
  price: { fontSize: 24, fontWeight: "800", color: "#0B0F19" },

  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#5B6577", marginTop: 22, marginBottom: 10, letterSpacing: 0.3, textTransform: "uppercase" },
  methods: { gap: 10 },
  methodCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff",
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 16, borderWidth: 1, borderColor: "#ECEEF3",
  },
  methodText: { flex: 1, fontSize: 14, fontWeight: "700", color: "#0B0F19" },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#CBD0DE",
    alignItems: "center", justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },

  secureNote: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#E6F8F1",
    padding: 10, borderRadius: 12, marginTop: 14,
  },
  secureText: { fontSize: 12, color: "#0B0F19", fontWeight: "600" },

  bottom: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: "#FAFAFB",
    borderTopWidth: 1,
    borderTopColor: "#ECEEF3",
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 999,
    overflow: "hidden",
  },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  successBox: { alignItems: "center", paddingTop: 4 },
  successDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 16, fontWeight: "800", color: "#0B0F19", marginTop: 10 },
  successSub: { fontSize: 13, color: "#5B6577", marginTop: 4, marginBottom: 14 },
  startBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999,
  },
  startBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
