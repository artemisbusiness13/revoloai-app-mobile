import React from "react";
import { Pressable, View, Text, StyleSheet, AccessibilityInfo } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeProvider";
import { radius } from "./theme";

export interface ThemeToggleProps {
  compact?: boolean;
}

/**
 * Header theme toggle. Cycles system → light → dark → system.
 * Icon reflects the currently-selected MODE (not the resolved theme).
 * Uses a plain Pressable (no moti) to stay SSR-safe.
 */
export function ThemeToggle({ compact = true }: ThemeToggleProps) {
  const { mode, toggle, palette } = useTheme();
  const icon = mode === "system" ? "phone-portrait-outline" : mode === "light" ? "sunny-outline" : "moon-outline";
  const label = mode === "system" ? "System theme" : mode === "light" ? "Light theme" : "Dark theme";
  const next = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
  return (
    <Pressable
      onPress={() => {
        toggle();
        if (typeof AccessibilityInfo !== "undefined" && AccessibilityInfo.announceForAccessibility) {
          AccessibilityInfo.announceForAccessibility(`Theme set to ${next}`);
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Tap to switch to ${next}.`}
      hitSlop={10}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: palette.bgSoft, borderColor: palette.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon as any} size={18} color={palette.text} />
      {!compact ? <Text style={{ color: palette.text, fontWeight: "600", marginLeft: 6 }}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
});
