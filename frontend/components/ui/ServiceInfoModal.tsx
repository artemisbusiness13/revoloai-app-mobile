import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useC, useTheme } from "./ThemeProvider";
import { Button } from "./Button";
import { DisclaimerBox } from "./Disclaimer";
import { radius, shadow, space } from "./theme";
import { useI18n } from "../../lib/i18n";

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
  const { t } = useI18n();
  const C = useC();
  const { resolved } = useTheme();
  const [accept1, setAccept1] = useState(false);
  const [accept2, setAccept2] = useState(false);
  const canContinue = accept1 && accept2;

  React.useEffect(() => {
    if (!visible) { setAccept1(false); setAccept2(false); }
  }, [visible]);

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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="document-text-outline" size={18} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: "800", fontSize: 17 }}>{t("legal.serviceInfo.title")}</Text>
              <Text style={{ color: C.text2, fontWeight: "600", fontSize: 12 }}>{serviceTitle}</Text>
            </View>
            <Pressable testID="svc-info-close" onPress={onClose} hitSlop={12} style={{ padding: 4 }} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={C.text2} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 12, gap: 12 }} showsVerticalScrollIndicator={false}>
            {/* WHAT YOU GET */}
            <DisclaimerBox variant="warning" title={t("legal.serviceInfo.whatYouGet")}>
              <View style={{ gap: 6 }}>
                {whatYouGet.map((line, i) => (
                  <View key={`y${i}`} style={{ flexDirection: "row", gap: 6 }}>
                    <Ionicons name="checkmark" size={14} color={C.warning} style={{ marginTop: 3 }} />
                    <Text style={{ color: C.warning, fontSize: 13, lineHeight: 19, flex: 1 }}>{line}</Text>
                  </View>
                ))}
                {whatNotIncluded.length > 0 ? (
                  <View style={{ marginTop: 6, gap: 6 }}>
                    <Text style={{ color: C.warning, fontSize: 12, fontWeight: "800", textTransform: "uppercase" }}>{t("legal.serviceInfo.notIncluded")}</Text>
                    {whatNotIncluded.map((line, i) => (
                      <View key={`n${i}`} style={{ flexDirection: "row", gap: 6 }}>
                        <Ionicons name="close" size={14} color={C.warning} style={{ marginTop: 3 }} />
                        <Text style={{ color: C.warning, fontSize: 13, lineHeight: 19, flex: 1 }}>{line}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {estimatedTime ? (
                  <Text style={{ color: C.warning, fontSize: 12, marginTop: 6, fontStyle: "italic" }}>⏱ {t("legal.serviceInfo.estTime", { time: estimatedTime })}</Text>
                ) : null}
              </View>
            </DisclaimerBox>

            {/* HOW IT WORKS */}
            <DisclaimerBox variant="info" title={t("legal.serviceInfo.howItWorks")}>
              <View style={{ gap: 6 }}>
                {howItWorks.map((line, i) => (
                  <View key={`h${i}`} style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>{i + 1}</Text>
                    </View>
                    <Text style={{ color: C.primary, fontSize: 13, lineHeight: 19, flex: 1 }}>{line}</Text>
                  </View>
                ))}
              </View>
            </DisclaimerBox>

            {/* DISCLAIMERS */}
            <DisclaimerBox variant="danger" title={t("legal.serviceInfo.disclaimers")}>
              <View style={{ gap: 6 }}>
                <Text style={{ color: C.danger, fontSize: 13, lineHeight: 20 }}>• <Text style={{ fontWeight: "800" }}>{t("legal.disclaimers.noGuarantee")}</Text></Text>
                <Text style={{ color: C.danger, fontSize: 13, lineHeight: 20 }}>• <Text style={{ fontWeight: "800" }}>{t("legal.disclaimers.aiInaccuracies")}</Text></Text>
                <Text style={{ color: C.danger, fontSize: 13, lineHeight: 20 }}>• {t("legal.disclaimers.personalUseOnly")}</Text>
                {extraDisclaimer ? <Text style={{ color: C.danger, fontSize: 13, lineHeight: 20 }}>• {extraDisclaimer}</Text> : null}
              </View>
            </DisclaimerBox>

            {/* REFUND */}
            <DisclaimerBox variant="success" title={t("legal.serviceInfo.refundTitle")}>
              {t("legal.serviceInfo.refundBody")}
            </DisclaimerBox>
          </ScrollView>

          {/* Sticky checkboxes + buttons */}
          <View style={{ paddingTop: 10, paddingBottom: 24, gap: 10, borderTopColor: C.border, borderTopWidth: 1 }}>
            <Pressable testID="svc-accept-1" onPress={() => setAccept1((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }} hitSlop={8}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: accept1 ? C.primary : C.border, backgroundColor: accept1 ? C.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
                {accept1 ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
              </View>
              <Text style={{ color: C.text, fontSize: 13, flex: 1, lineHeight: 18 }}>{t("legal.serviceInfo.check1")}</Text>
            </Pressable>
            <Pressable testID="svc-accept-2" onPress={() => setAccept2((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }} hitSlop={8}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: accept2 ? C.primary : C.border, backgroundColor: accept2 ? C.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
                {accept2 ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
              </View>
              <Text style={{ color: C.text, fontSize: 13, flex: 1, lineHeight: 18 }}>{t("legal.serviceInfo.check2")}</Text>
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
