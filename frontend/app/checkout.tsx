import React, { useEffect, useState } from "react";
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
  getOrCreateUserId,
} from "../lib/api";

export default function CheckoutScreen() {
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
  const fade = React.useRef(new Animated.Value(0)).current;

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

  const pay = async () => {
    if (paying || done) return;
    setPaying(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const user_id = await getOrCreateUserId();
      await api("/purchases", {
        method: "POST",
        body: JSON.stringify({
          user_id,
          avatar: key,
          item_id: item.id,
          item_title: item.title,
          price: item.price,
          kind: item.kind,
        }),
      });
      // small simulated processing time
      await new Promise((r) => setTimeout(r, 700));
      setDone(true);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e: any) {
      Alert.alert("Payment failed", e?.message || "Please try again.");
    } finally {
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
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Avatar header */}
          <View style={[styles.avatarHeader, { backgroundColor: meta.soft }]}>
            <View style={[styles.headerAvatarRing, { borderColor: meta.color }]}>
              <Avatar uri={AVATARS[key]} size={50} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.smallLabel}>{meta.role.toUpperCase()}</Text>
              <Text style={[styles.avatarName, { color: meta.color }]}>{meta.name}</Text>
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
              <Text style={styles.priceLabel}>One-time</Text>
              <Text style={styles.price}>{item.price}</Text>
            </View>
          </View>

          {/* Method */}
          <Text style={styles.sectionLabel}>Payment method</Text>
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
                  {m === "stripe" ? "Card · Stripe" : "PayPal"}
                </Text>
                <View style={[styles.radio, method === m && { borderColor: meta.color }]}>
                  {method === m && <View style={[styles.radioInner, { backgroundColor: meta.color }]} />}
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.secureNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#10B981" />
            <Text style={styles.secureText}>Secured by Stripe & PayPal · No card data stored.</Text>
          </View>
        </ScrollView>

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
                  <Text style={styles.payBtnText}>Pay {item.price}</Text>
                </>
              )}
            </Pressable>
          ) : (
            <Animated.View style={[styles.successBox, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
              <View style={[styles.successDot, { backgroundColor: "#10B981" }]}>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </View>
              <Text style={styles.successTitle}>Payment confirmed</Text>
              <Text style={styles.successSub}>Your session with {meta.name} is ready.</Text>
              <Pressable testID="start-session-btn" onPress={goChat} style={[styles.startBtn, { backgroundColor: meta.color }]}>
                <Text style={styles.startBtnText}>Start session</Text>
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
    width: 60, height: 60, borderRadius: 30, borderWidth: 3, overflow: "hidden", backgroundColor: "#fff",
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
