import React, { useCallback, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, NativeSyntheticEvent, NativeScrollEvent, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useC, useTheme } from "./ThemeProvider";
import { Button } from "./Button";
import { DisclaimerBox } from "./Disclaimer";
import { MdText } from "./MdText";
import { LanguageSelectorBar } from "./LanguageSelectorBar";
import { radius, shadow, space } from "./theme";
import { TC_VERSION, TERMS_CONTENT, PRIVACY_CONTENT } from "../../lib/legalContent";
import { useTermsAcceptance } from "../../lib/useTermsAcceptance";
import { useI18n, getDict } from "../../lib/i18n";
import type { StructuredLegalDoc, StructuredLegalSection } from "../../lib/translations/types";

type Variant = "info" | "warning" | "danger" | "success";

function Section({ s, rtl }: { s: StructuredLegalSection; rtl: boolean }) {
  const { palette } = useTheme();
  const variant: Variant = (["info","warning","danger","success"] as const).includes(s.kind as any)
    ? (s.kind as Variant) : "info";
  const fg =
    variant === "warning" ? palette.warning :
    variant === "danger"  ? palette.danger  :
    variant === "success" ? palette.success :
                            palette.primary;

  return (
    <DisclaimerBox variant={variant} title={`${s.icon}  ${s.h}`}>
      <View style={{ gap: 6 }}>
        {s.bullets.map((b, i) => (
          <View
            key={`${s.id}-b${i}`}
            style={{
              flexDirection: rtl ? "row-reverse" : "row",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <Text style={{ color: fg, fontWeight: "800", lineHeight: 24, fontSize: 14 }}>•</Text>
            <View style={{ flex: 1 }}>
              <MdText color={fg} size={14} rtl={rtl}>{b}</MdText>
            </View>
          </View>
        ))}
      </View>
    </DisclaimerBox>
  );
}

function Doc({ doc, rtl, C }: { doc: StructuredLegalDoc; rtl: boolean; C: any }) {
  return (
    <View style={{ gap: 12 }}>
      <Text
        style={{
          color: C.text, fontSize: 22, fontWeight: "800",
          textAlign: rtl ? "right" : "left",
          writingDirection: rtl ? "rtl" : "ltr",
        }}
      >
        {doc.title}
      </Text>
      <Text
        style={{
          color: C.text2, fontSize: 14, lineHeight: 24, fontWeight: "500",
          textAlign: rtl ? "right" : "left",
          writingDirection: rtl ? "rtl" : "ltr",
        }}
      >
        {doc.intro}
      </Text>
      <View style={{ gap: 12, marginTop: 4 }}>
        {doc.sections.map((s) => (
          <Section key={s.id} s={s} rtl={rtl} />
        ))}
      </View>
    </View>
  );
}

/**
 * TermsAcceptanceGate
 *
 * Two modes:
 *  1. **Auto mode** (no props): self-mounts a full-screen modal whenever the
 *     user has not yet accepted the current T&C version. Kept for backwards
 *     compatibility. NOTE: no longer mounted in app/_layout.tsx — the gate now
 *     only appears post-signup.
 *  2. **Controlled mode**: pass `visible`, `onAccept` and `onDecline` to drive
 *     the modal from a parent flow (e.g. show after the signup form, before
 *     pushing the user into the profile onboarding).
 *
 * In controlled mode the gate ignores stored acceptance state and shows
 * whenever `visible === true`, so the caller is responsible for skipping the
 * gate when `useTermsAcceptance().accepted` is already true.
 */
export interface TermsAcceptanceGateProps {
  visible?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
}

export function TermsAcceptanceGate(props: TermsAcceptanceGateProps = {}) {
  const controlled = typeof props.visible === "boolean";
  const { t, lang } = useI18n();
  const { ready, accepted, accept } = useTermsAcceptance();
  const C = useC();
  const { resolved } = useTheme();
  const [scrolledEnd, setScrolledEnd] = useState(false);
  const [acceptT, setAcceptT] = useState(false);
  const [acceptP, setAcceptP] = useState(false);
  const [declined, setDeclined] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Reset all transient state every time the gate is (re)opened in controlled mode.
  React.useEffect(() => {
    if (controlled && props.visible) {
      setScrolledEnd(false);
      setAcceptT(false);
      setAcceptP(false);
      setDeclined(false);
      try { scrollRef.current?.scrollTo({ y: 0, animated: false }); } catch {}
    }
  }, [controlled, props.visible]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const remaining = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (remaining < 60 && !scrolledEnd) setScrolledEnd(true);
  }, [scrolledEnd]);

  // ── Visibility logic ──────────────────────────────────────────────
  // Auto mode: respect storage flag (legacy/backwards-compat).
  // Controlled mode: parent drives visibility regardless of storage.
  if (controlled) {
    if (!props.visible) return null;
  } else {
    if (!ready) return null;
    if (accepted) return null;
  }

  const handleAccept = async () => {
    await accept();
    props.onAccept?.();
  };
  const handleDecline = () => {
    setDeclined(true);
    props.onDecline?.();
  };

  const canAccept = scrolledEnd && acceptT && acceptP;
  const isNonEnglish = lang !== "en";
  const rtl = lang === "ur";

  // Pull structured docs from i18n (per-locale dictionary) with English fallback
  // to the static legacy content.
  const dict = getDict(lang as any);
  const termsDocAny = (dict as any)?.legal?.tcGate?.termsDoc;
  const privDocAny  = (dict as any)?.legal?.tcGate?.privacyDoc;
  const enFallbackTerms = (getDict("en" as any) as any)?.legal?.tcGate?.termsDoc;
  const enFallbackPriv  = (getDict("en" as any) as any)?.legal?.tcGate?.privacyDoc;
  const termsDoc: StructuredLegalDoc = (termsDocAny && typeof termsDocAny === "object")
    ? termsDocAny
    : (enFallbackTerms || {
        title: TERMS_CONTENT.title,
        intro: TERMS_CONTENT.intro,
        sections: TERMS_CONTENT.sections.map((s, i) => ({
          id: `t${i}`, kind: "info", icon: "📄", h: s.h, bullets: [s.p],
        })),
      });
  const privacyDoc: StructuredLegalDoc = (privDocAny && typeof privDocAny === "object")
    ? privDocAny
    : (enFallbackPriv || {
        title: PRIVACY_CONTENT.title,
        intro: PRIVACY_CONTENT.intro,
        sections: PRIVACY_CONTENT.sections.map((s, i) => ({
          id: `p${i}`, kind: "info", icon: "📄", h: s.h, bullets: [s.p],
        })),
      });

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Compact language selector at the very top */}
        <LanguageSelectorBar
          onChange={() => {
            setScrolledEnd(false);
            setAcceptT(false);
            setAcceptP(false);
            setDeclined(false);
            try { scrollRef.current?.scrollTo({ y: 0, animated: false }); } catch {}
          }}
        />
        {/* Compact header (~12% target) */}
        <View style={{
          paddingTop: 12, paddingHorizontal: 14, paddingBottom: 8,
          backgroundColor: C.card,
          borderBottomWidth: 1, borderBottomColor: C.border,
          flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 10,
          ...shadow(1, resolved === "dark"),
        }}>
          <View style={{
            width: 36, height: 36, borderRadius: 10, backgroundColor: C.primary,
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>r</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{
                color: C.text, fontWeight: "800", fontSize: 15,
                textAlign: rtl ? "right" : "left",
                writingDirection: rtl ? "rtl" : "ltr",
              }}
            >{t("legal.tcGate.welcome")}</Text>
            <Text
              numberOfLines={1}
              style={{
                color: C.text2, fontWeight: "500", fontSize: 11, marginTop: 1,
                textAlign: rtl ? "right" : "left",
                writingDirection: rtl ? "rtl" : "ltr",
              }}
            >{t("legal.tcGate.subtitle")}</Text>
          </View>
          <View style={{
            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
            backgroundColor: C.bgSoft, borderColor: C.border, borderWidth: 1,
          }}>
            <Text style={{ color: C.text2, fontWeight: "700", fontSize: 9 }}>v{TC_VERSION}</Text>
          </View>
        </View>

        {/* Body — gets the lion's share (~73%) */}
        <ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={64}
          contentContainerStyle={{ padding: 14, paddingBottom: 24, gap: 12 }}
          style={{ flex: 1 }}
        >
          {isNonEnglish ? (
            <DisclaimerBox variant="info" title={`🌐  ${t("legal.tcGate.bindingNoteTitle")}`}>
              <MdText color={C.primary} size={13} rtl={rtl}>
                {t("legal.tcGate.bindingNote")}
              </MdText>
            </DisclaimerBox>
          ) : null}

          <Doc doc={termsDoc} rtl={rtl} C={C} />

          <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />

          <Doc doc={privacyDoc} rtl={rtl} C={C} />

          {isNonEnglish ? (
            <DisclaimerBox variant="warning" title={`⚠️  ${t("legal.tcGate.bindingNoteTitle")}`}>
              <MdText color={C.warning} size={12.5} rtl={rtl}>
                {t("legal.tcGate.bindingNote")}
              </MdText>
            </DisclaimerBox>
          ) : null}

          <View style={{ paddingVertical: 8, alignItems: "center" }}>
            <Text style={{ color: C.text3, fontSize: 11, fontWeight: "600" }}>— {t("legal.tcGate.endMarker")} —</Text>
          </View>
        </ScrollView>

        {/* Compact sticky footer (~15% target) */}
        <View style={{
          paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14,
          backgroundColor: C.card, borderTopColor: C.border, borderTopWidth: 1,
          gap: 6,
          ...shadow(2, resolved === "dark"),
        }}>
          {!scrolledEnd ? (
            <View style={{
              flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 5,
              backgroundColor: C.warningSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, alignSelf: rtl ? "flex-end" : "flex-start",
            }}>
              <Ionicons name="arrow-down" size={11} color={C.warning} />
              <Text style={{ color: C.warning, fontSize: 11, fontWeight: "700" }}>{t("legal.tcGate.scrollHint")}</Text>
            </View>
          ) : null}

          <Pressable
            testID="tc-check-terms"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptT }}
            onPress={() => setAcceptT((v) => !v)}
            style={{ flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 8, paddingVertical: 2, minHeight: 32 }}
            hitSlop={10}
          >
            <View style={{
              width: 18, height: 18, borderRadius: 5, borderWidth: 2,
              borderColor: acceptT ? C.primary : C.border,
              backgroundColor: acceptT ? C.primary : "transparent",
              alignItems: "center", justifyContent: "center",
            }}>
              {acceptT ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
            </View>
            <Text
              numberOfLines={2}
              style={{
                color: C.text, fontSize: 12, flex: 1, lineHeight: 16,
                textAlign: rtl ? "right" : "left",
                writingDirection: rtl ? "rtl" : "ltr",
              }}
            >{t("legal.tcGate.checkbox1")}</Text>
          </Pressable>

          <Pressable
            testID="tc-check-privacy"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptP }}
            onPress={() => setAcceptP((v) => !v)}
            style={{ flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 8, paddingVertical: 2, minHeight: 32 }}
            hitSlop={10}
          >
            <View style={{
              width: 18, height: 18, borderRadius: 5, borderWidth: 2,
              borderColor: acceptP ? C.primary : C.border,
              backgroundColor: acceptP ? C.primary : "transparent",
              alignItems: "center", justifyContent: "center",
            }}>
              {acceptP ? <Ionicons name="checkmark" size={11} color="#fff" /> : null}
            </View>
            <Text
              numberOfLines={2}
              style={{
                color: C.text, fontSize: 12, flex: 1, lineHeight: 16,
                textAlign: rtl ? "right" : "left",
                writingDirection: rtl ? "rtl" : "ltr",
              }}
            >{t("legal.tcGate.checkbox2")}</Text>
          </Pressable>

          {declined ? (
            <Text style={{ color: C.danger, fontSize: 11, fontWeight: "700" }}>{t("legal.tcGate.mustAcceptMessage")}</Text>
          ) : null}

          <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
            <View style={{ flex: 1 }}>
              <Button
                testID="tc-decline-btn"
                title={t("legal.tcGate.decline")}
                variant="secondary"
                size="sm"
                onPress={handleDecline}
                fullWidth
              />
            </View>
            <View style={{ flex: 1.5 }}>
              <Button
                testID="tc-accept-btn"
                title={t("legal.tcGate.accept")}
                variant="primary"
                size="sm"
                disabled={!canAccept}
                onPress={handleAccept}
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
