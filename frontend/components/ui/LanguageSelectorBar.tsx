import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useC } from "./ThemeProvider";
import { SUPPORTED_LANGS, useI18n, type LangCode } from "../../lib/i18n";

/**
 * Compact horizontal language selector — designed to sit ABOVE the T&C gate
 * header so a user who hasn't accepted yet can still pick their language.
 *
 * - Total height ≈50pt (bar) — meets 44pt touch target on each chip.
 * - Fully translated label uses native scripts of all 6 languages so users
 *   can recognise their own without prior context.
 * - Active chip uses brand primary fill + check; inactive uses bgSoft + border.
 */
const FLAGS: Record<LangCode, string> = {
  en: "🇬🇧",
  ro: "🇷🇴",
  pl: "🇵🇱",
  es: "🇪🇸",
  pa: "🇮🇳",
  ur: "🇵🇰",
};

export interface LanguageSelectorBarProps {
  onChange?: (next: LangCode) => void;
  compact?: boolean; // when true, hides the multilingual label row
}

export function LanguageSelectorBar({ onChange, compact }: LanguageSelectorBarProps) {
  const C = useC();
  const { lang, setLang } = useI18n();

  const handlePress = async (code: LangCode) => {
    if (code === lang) return;
    await setLang(code);
    onChange?.(code);
  };

  return (
    <View style={{
      backgroundColor: C.card,
      borderBottomColor: C.border, borderBottomWidth: 1,
      paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8,
      gap: 6,
    }}>
      {!compact ? (
        <Text
          numberOfLines={1}
          style={{
            color: C.text2, fontSize: 11, fontWeight: "700",
            letterSpacing: 0.2,
          }}
        >
          🌍 Language · Limba · Język · Idioma · ਭਾਸ਼ਾ · زبان
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6, paddingRight: 6 }}
      >
        {SUPPORTED_LANGS.map((l) => {
          const active = l.code === lang;
          return (
            <Pressable
              key={l.code}
              testID={`lang-chip-${l.code}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${l.name} (${l.native})`}
              onPress={() => handlePress(l.code as LangCode)}
              hitSlop={8}
              style={{
                flexDirection: "row", alignItems: "center", gap: 6,
                paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
                minHeight: 40,
                backgroundColor: active ? C.primary : C.bgSoft,
                borderColor: active ? C.primary : C.border, borderWidth: 1,
              }}
            >
              <Text style={{ fontSize: 14 }}>{FLAGS[l.code as LangCode]}</Text>
              <Text style={{
                color: active ? "#fff" : C.text,
                fontSize: 12, fontWeight: "700",
              }}>
                {l.native}
              </Text>
              {active ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
