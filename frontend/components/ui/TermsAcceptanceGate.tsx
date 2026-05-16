import React, { useCallback, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, NativeSyntheticEvent, NativeScrollEvent, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useC, useTheme } from "./ThemeProvider";
import { Button } from "./Button";
import { DisclaimerBox } from "./Disclaimer";
import { radius, shadow, space } from "./theme";
import { TC_VERSION, TERMS_CONTENT, PRIVACY_CONTENT } from "../../lib/legalContent";
import { useTermsAcceptance } from "../../lib/useTermsAcceptance";
import { useI18n } from "../../lib/i18n";

export function TermsAcceptanceGate() {
  const { t, lang } = useI18n();
  const { ready, accepted, accept } = useTermsAcceptance();
  const C = useC();
  const { resolved } = useTheme();
  const [scrolledEnd, setScrolledEnd] = useState(false);
  const [acceptT, setAcceptT] = useState(false);
  const [acceptP, setAcceptP] = useState(false);
  const [declined, setDeclined] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const remaining = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (remaining < 40 && !scrolledEnd) setScrolledEnd(true);
  }, [scrolledEnd]);

  if (!ready) return null;
  if (accepted) return null;

  const canAccept = scrolledEnd && acceptT && acceptP;
  const showNonEnglishNote = lang !== "en";

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={{
          paddingTop: 48, paddingHorizontal: 20, paddingBottom: 14,
          backgroundColor: C.card,
          borderBottomWidth: 1, borderBottomColor: C.border,
          flexDirection: "row", alignItems: "center", gap: 12,
          ...shadow(1, resolved === "dark"),
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: 12, backgroundColor: C.primary,
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 22 }}>r</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: "800", fontSize: 18 }}>{t("legal.tcGate.welcome")}</Text>
            <Text style={{ color: C.text2, fontWeight: "500", fontSize: 12 }}>{t("legal.tcGate.subtitle")}</Text>
          </View>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
            backgroundColor: C.bgSoft, borderColor: C.border, borderWidth: 1,
          }}>
            <Text style={{ color: C.text2, fontWeight: "700", fontSize: 10 }}>v{TC_VERSION}</Text>
          </View>
        </View>

        {/* Body */}
        <ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={64}
          contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
        >
          {showNonEnglishNote ? (
            <DisclaimerBox variant="info" title={t("legal.tcGate.englishNoticeTitle")} style={{ marginBottom: 16 }}>
              {t("legal.tcGate.englishNoticeBody")}
            </DisclaimerBox>
          ) : null}

          <Text style={{ color: C.text, fontSize: 22, fontWeight: "800", marginBottom: 8 }}>{TERMS_CONTENT.title}</Text>
          <Text style={{ color: C.text2, fontSize: 14, lineHeight: 22, marginBottom: 16 }}>{TERMS_CONTENT.intro}</Text>
          {TERMS_CONTENT.sections.map((s, i) => (
            <View key={i} style={{ marginBottom: 14 }}>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: "700", marginBottom: 4 }}>{s.h}</Text>
              <Text style={{ color: C.text2, fontSize: 13.5, lineHeight: 22 }}>{s.p}</Text>
            </View>
          ))}

          <View style={{ height: 1, backgroundColor: C.border, marginVertical: 18 }} />

          <Text style={{ color: C.text, fontSize: 22, fontWeight: "800", marginBottom: 8 }}>{PRIVACY_CONTENT.title}</Text>
          <Text style={{ color: C.text2, fontSize: 14, lineHeight: 22, marginBottom: 16 }}>{PRIVACY_CONTENT.intro}</Text>
          {PRIVACY_CONTENT.sections.map((s, i) => (
            <View key={i} style={{ marginBottom: 14 }}>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: "700", marginBottom: 4 }}>{s.h}</Text>
              <Text style={{ color: C.text2, fontSize: 13.5, lineHeight: 22 }}>{s.p}</Text>
            </View>
          ))}

          <View style={{ marginTop: 12, paddingVertical: 18, alignItems: "center" }}>
            <Text style={{ color: C.text3, fontSize: 11 }}>— {t("legal.tcGate.endMarker")} —</Text>
          </View>
        </ScrollView>

        {/* Sticky footer */}
        <View style={{
          paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
          backgroundColor: C.card, borderTopColor: C.border, borderTopWidth: 1,
          gap: 10,
          ...shadow(2, resolved === "dark"),
        }}>
          {!scrolledEnd ? (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: C.warningSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: "flex-start",
            }}>
              <Ionicons name="arrow-down" size={12} color={C.warning} />
              <Text style={{ color: C.warning, fontSize: 12, fontWeight: "700" }}>{t("legal.tcGate.scrollHint")}</Text>
            </View>
          ) : null}

          <Pressable
            testID="tc-check-terms"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptT }}
            onPress={() => setAcceptT((v) => !v)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}
            hitSlop={8}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 6, borderWidth: 2,
              borderColor: acceptT ? C.primary : C.border,
              backgroundColor: acceptT ? C.primary : "transparent",
              alignItems: "center", justifyContent: "center",
            }}>
              {acceptT ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
            </View>
            <Text style={{ color: C.text, fontSize: 13, flex: 1, lineHeight: 18 }}>{t("legal.tcGate.checkbox1")}</Text>
          </Pressable>

          <Pressable
            testID="tc-check-privacy"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptP }}
            onPress={() => setAcceptP((v) => !v)}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}
            hitSlop={8}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 6, borderWidth: 2,
              borderColor: acceptP ? C.primary : C.border,
              backgroundColor: acceptP ? C.primary : "transparent",
              alignItems: "center", justifyContent: "center",
            }}>
              {acceptP ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
            </View>
            <Text style={{ color: C.text, fontSize: 13, flex: 1, lineHeight: 18 }}>{t("legal.tcGate.checkbox2")}</Text>
          </Pressable>

          {declined ? (
            <Text style={{ color: C.danger, fontSize: 12, fontWeight: "700" }}>{t("legal.tcGate.mustAcceptMessage")}</Text>
          ) : null}

          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                testID="tc-decline-btn"
                title={t("legal.tcGate.decline")}
                variant="secondary"
                onPress={() => setDeclined(true)}
                fullWidth
              />
            </View>
            <View style={{ flex: 1.5 }}>
              <Button
                testID="tc-accept-btn"
                title={t("legal.tcGate.accept")}
                variant="primary"
                disabled={!canAccept}
                onPress={accept}
                fullWidth
                rightIcon="arrow-forward"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
