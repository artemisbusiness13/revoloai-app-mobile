import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useC, useTheme } from "./ThemeProvider";
import { Button } from "./Button";
import { DisclaimerBox } from "./Disclaimer";
import { MdText } from "./MdText";
import { radius, shadow, space } from "./theme";
import { useI18n, getDict } from "../../lib/i18n";

export interface ServiceInfoModalProps {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
  serviceTitle: string;
  serviceId: string;
  whatYouGet: string[];
  whatNotIncluded?: string[];
  estimatedTime?: string;
  howItWorks: string[];
  extraDisclaimer?: string;
}

export function ServiceInfoModal({
  visible, onClose, onContinue,
  serviceTitle, serviceId,
  whatYouGet, whatNotIncluded = [], estimatedTime, howItWorks, extraDisclaimer,
}: ServiceInfoModalProps) {
  const { t, lang } = useI18n();
  const C = useC();
  const { resolved } = useTheme();
  const [accept1, setAccept1] = useState(false);
  const [accept2, setAccept2] = useState(false);
  const canContinue = accept1 && accept2;
  const rtl = lang === "ur";

  React.useEffect(() => {
    if (!visible) { setAccept1(false); setAccept2(false); }
  }, [visible]);

  // Pull translated arrays from the active locale dictionary (with EN fallback).
  const dict = getDict(lang as any) as any;
  const enDict = getDict("en" as any) as any;
  const howSteps: string[] =
    Array.isArray(dict?.legal?.serviceInfo?.howSteps) ? dict.legal.serviceInfo.howSteps :
    Array.isArray(enDict?.legal?.serviceInfo?.howSteps) ? enDict.legal.serviceInfo.howSteps :
    (howItWorks && howItWorks.length ? howItWorks : []);
  const refundBullets: string[] =
    Array.isArray(dict?.legal?.serviceInfo?.refundBullets) ? dict.legal.serviceInfo.refundBullets :
    Array.isArray(enDict?.legal?.serviceInfo?.refundBullets) ? enDict.legal.serviceInfo.refundBullets :
    [];

  const ChkBox = ({ checked }: { checked: boolean }) => (
    <View style={{
      width: 22, height: 22, borderRadius: 6, borderWidth: 2,
      borderColor: checked ? C.primary : C.border,
      backgroundColor: checked ? C.primary : "transparent",
      alignItems: "center", justifyContent: "center",
    }}>
      {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
    </View>
  );

  const Bullet = ({ icon, color, children }: { icon: keyof typeof Ionicons.glyphMap; color: string; children: string }) => (
    <View style={{ flexDirection: rtl ? "row-reverse" : "row", gap: 8, alignItems: "flex-start" }}>
      <Ionicons name={icon} size={14} color={color} style={{ marginTop: 4 }} />
      <View style={{ flex: 1 }}>
        <MdText color={color} size={13.5} rtl={rtl}>{children}</MdText>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: C.scrim, justifyContent: "flex-end" }}>
        <View style={{
          backgroundColor: C.bg,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          maxHeight: "92%", paddingHorizontal: 20, paddingTop: 16,
          ...shadow(3, resolved === "dark"),
        }}>
          {/* Handle */}
          <View style={{ alignSelf: "center", width: 44, height: 4, backgroundColor: C.border, borderRadius: 999, marginBottom: 10 }} />
          {/* Title row */}
          <View style={{ flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="document-text-outline" size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                color: C.text, fontWeight: "800", fontSize: 17,
                textAlign: rtl ? "right" : "left",
                writingDirection: rtl ? "rtl" : "ltr",
              }}>{t("legal.serviceInfo.title")}</Text>
              <Text style={{
                color: C.text2, fontWeight: "600", fontSize: 12,
                textAlign: rtl ? "right" : "left",
                writingDirection: rtl ? "rtl" : "ltr",
              }}>{serviceTitle}</Text>
            </View>
            <Pressable testID="svc-info-close" onPress={onClose} hitSlop={12} style={{ padding: 4 }} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={C.text2} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 12, gap: 12 }} showsVerticalScrollIndicator={false}>
            {/* WHAT YOU GET — green/success */}
            <DisclaimerBox variant="success" title={`✓  ${t("legal.serviceInfo.whatYouGet")}`}>
              <View style={{ gap: 8 }}>
                {whatYouGet.map((line, i) => (
                  <Bullet key={`y${i}`} icon="checkmark-circle" color={C.success}>{line}</Bullet>
                ))}
                {whatNotIncluded.length > 0 ? (
                  <View style={{ marginTop: 6, gap: 6 }}>
                    <Text style={{
                      color: C.success, fontSize: 11, fontWeight: "800", textTransform: "uppercase",
                      textAlign: rtl ? "right" : "left",
                    }}>{t("legal.serviceInfo.notIncluded")}</Text>
                    {whatNotIncluded.map((line, i) => (
                      <Bullet key={`n${i}`} icon="close-circle" color={C.success}>{line}</Bullet>
                    ))}
                  </View>
                ) : null}
                {estimatedTime ? (
                  <Text style={{
                    color: C.success, fontSize: 12, marginTop: 6, fontStyle: "italic",
                    textAlign: rtl ? "right" : "left",
                  }}>⏱  {t("legal.serviceInfo.estTime", { time: estimatedTime })}</Text>
                ) : null}
              </View>
            </DisclaimerBox>

            {/* HOW IT WORKS — blue/info */}
            <DisclaimerBox variant="info" title={`ℹ️  ${t("legal.serviceInfo.howItWorks")}`}>
              <View style={{ gap: 8 }}>
                {howSteps.map((line, i) => (
                  <View key={`h${i}`} style={{ flexDirection: rtl ? "row-reverse" : "row", gap: 8, alignItems: "flex-start" }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", marginTop: 2 }}>
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <MdText color={C.primary} size={13.5} rtl={rtl}>{line}</MdText>
                    </View>
                  </View>
                ))}
              </View>
            </DisclaimerBox>

            {/* DISCLAIMERS — red/danger */}
            <DisclaimerBox variant="danger" title={`⚠️  ${t("legal.serviceInfo.disclaimers")}`}>
              <View style={{ gap: 8 }}>
                <Bullet icon="alert-circle" color={C.danger}>{`**${t("legal.disclaimers.noGuarantee")}**`}</Bullet>
                <Bullet icon="alert-circle" color={C.danger}>{`**${t("legal.disclaimers.aiInaccuracies")}**`}</Bullet>
                <Bullet icon="alert-circle" color={C.danger}>{t("legal.disclaimers.personalUseOnly")}</Bullet>
                {extraDisclaimer ? <Bullet icon="alert-circle" color={C.danger}>{extraDisclaimer}</Bullet> : null}
              </View>
            </DisclaimerBox>

            {/* REFUND — amber/warning to draw attention */}
            <DisclaimerBox variant="warning" title={`💰  ${t("legal.serviceInfo.refundTitle")}`}>
              <View style={{ gap: 8 }}>
                {refundBullets.length ? (
                  refundBullets.map((line, i) => (
                    <Bullet key={`r${i}`} icon="information-circle" color={C.warning}>{line}</Bullet>
                  ))
                ) : (
                  <MdText color={C.warning} size={13.5} rtl={rtl}>{t("legal.serviceInfo.refundBody")}</MdText>
                )}
              </View>
            </DisclaimerBox>
          </ScrollView>

          {/* Sticky checkboxes + buttons */}
          <View style={{ paddingTop: 10, paddingBottom: 24, gap: 10, borderTopColor: C.border, borderTopWidth: 1 }}>
            <Pressable testID="svc-accept-1" onPress={() => setAccept1((v) => !v)} style={{ flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 10 }} hitSlop={8}>
              <ChkBox checked={accept1} />
              <Text style={{
                color: C.text, fontSize: 13, flex: 1, lineHeight: 18,
                textAlign: rtl ? "right" : "left",
                writingDirection: rtl ? "rtl" : "ltr",
              }}>{t("legal.serviceInfo.check1")}</Text>
            </Pressable>
            <Pressable testID="svc-accept-2" onPress={() => setAccept2((v) => !v)} style={{ flexDirection: rtl ? "row-reverse" : "row", alignItems: "center", gap: 10 }} hitSlop={8}>
              <ChkBox checked={accept2} />
              <Text style={{
                color: C.text, fontSize: 13, flex: 1, lineHeight: 18,
                textAlign: rtl ? "right" : "left",
                writingDirection: rtl ? "rtl" : "ltr",
              }}>{t("legal.serviceInfo.check2")}</Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button testID="svc-cancel" title={t("legal.serviceInfo.cancel")} variant="secondary" onPress={onClose} fullWidth />
              </View>
              <View style={{ flex: 1.5 }}>
                <Button testID="svc-continue" title={t("legal.serviceInfo.continueToPayment")} variant="primary" disabled={!canContinue} onPress={onContinue} rightIcon="arrow-forward" fullWidth />
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
