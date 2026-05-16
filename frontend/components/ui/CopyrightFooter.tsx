import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useC } from "./ThemeProvider";
import { space } from "./theme";
import { useI18n } from "../../lib/i18n";

/**
 * Global copyright notice for the bottom of every screen footer.
 * Compact: respects light/dark + adds an inline link to the full copyright
 * page (/legal/copyright).
 */
export function CopyrightFooter({ compact = false }: { compact?: boolean }) {
  const C = useC();
  const { t } = useI18n();
  const year = new Date().getFullYear();
  const text = compact
    ? t("legal.footer.copyright", { year })
    : t("legal.footer.copyrightLong", { year });
  return (
    <View style={{ paddingVertical: space.md, paddingHorizontal: space.lg }}>
      <Text style={{ color: C.text3, fontSize: 11, lineHeight: 16, textAlign: "center" }}>
        {text}
      </Text>
      <Pressable
        onPress={() => router.push({ pathname: "/legal/[slug]", params: { slug: "copyright" } })}
        hitSlop={8}
        accessibilityRole="link"
        style={{ alignSelf: "center", marginTop: 4 }}
      >
        <Text style={{ color: C.primary, fontSize: 11, fontWeight: "700", textDecorationLine: "underline" }}>
          {t("legal.footer.viewFull")}
        </Text>
      </Pressable>
    </View>
  );
}

/** Tiny inline badge for AI-generated content. */
export function AIContentBadge({ tone }: { tone?: string }) {
  const C = useC();
  const fg = tone || C.text3;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: fg, opacity: 0.6 }} />
      <Text style={{ color: fg, fontSize: 10, fontWeight: "600", opacity: 0.85 }}>
        AI-generated · © Revoloai
      </Text>
    </View>
  );
}
