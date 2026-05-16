import React from "react";
import { Text, View, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeProvider";
import { radius, space } from "./theme";

export type DisclaimerVariant = "warning" | "danger" | "info" | "success";

export interface DisclaimerBoxProps {
  variant: DisclaimerVariant;
  title?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}

const ICONS: Record<DisclaimerVariant, keyof typeof Ionicons.glyphMap> = {
  warning: "alert-circle-outline",
  danger: "warning-outline",
  info: "information-circle-outline",
  success: "checkmark-circle-outline",
};

export function DisclaimerBox({ variant, title, children, style }: DisclaimerBoxProps) {
  const { palette } = useTheme();
  const bg =
    variant === "warning" ? palette.warningSoft :
    variant === "danger"  ? palette.dangerSoft  :
    variant === "success" ? palette.successSoft :
                            palette.primarySoft;
  const fg =
    variant === "warning" ? palette.warning :
    variant === "danger"  ? palette.danger  :
    variant === "success" ? palette.success :
                            palette.primary;
  const textColor =
    variant === "warning" ? palette.warning :
    variant === "danger"  ? palette.danger  :
    variant === "success" ? palette.success :
                            palette.primary;
  return (
    <View style={[{
      backgroundColor: bg,
      borderRadius: radius.md,
      padding: space.md,
      borderWidth: 1,
      borderColor: fg + "55",
      gap: 6,
    }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={ICONS[variant]} size={18} color={fg} />
        {title ? <Text style={{ color: textColor, fontWeight: "800", fontSize: 13, flexShrink: 1 }}>{title}</Text> : null}
      </View>
      <View style={{ paddingLeft: 26 }}>
        {typeof children === "string" ? (
          <Text style={{ color: textColor, fontSize: 13, lineHeight: 20 }}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

/**
 * Legal-text wrapper that emphasises key terms by underlining them. Pass the
 * `emphasise` array of substrings (case-insensitive) to highlight in bold.
 */
export function LegalText({ children, emphasise = [], color, size = 13, style }: { children: string; emphasise?: string[]; color?: string; size?: number; style?: TextStyle }) {
  const { palette } = useTheme();
  const c = color || palette.text;
  if (emphasise.length === 0) {
    return <Text style={[{ color: c, fontSize: size, lineHeight: size * 1.6 }, style]}>{children}</Text>;
  }
  const re = new RegExp(`(${emphasise.map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = children.split(re);
  return (
    <Text style={[{ color: c, fontSize: size, lineHeight: size * 1.6 }, style]}>
      {parts.map((p, i) =>
        emphasise.some((e) => e.toLowerCase() === p.toLowerCase())
          ? <Text key={i} style={{ fontWeight: "800", textDecorationLine: "underline" }}>{p}</Text>
          : <Text key={i}>{p}</Text>
      )}
    </Text>
  );
}
