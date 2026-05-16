import React, { useCallback } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle, TextStyle, AccessibilityRole } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeProvider";
import { radius, space, type as typo, shadow } from "./theme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ComponentProps<typeof Ionicons>["name"];
  rightIcon?: React.ComponentProps<typeof Ionicons>["name"];
  accent?: string;     // override primary tint (used by avatar-tinted CTAs)
  accentOn?: string;   // text colour on accent backgrounds (default white)
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
}

export function Button({
  title, onPress, variant = "primary", size = "md", fullWidth, loading, disabled,
  leftIcon, rightIcon, accent, accentOn, style, textStyle, testID,
  accessibilityLabel, accessibilityRole = "button",
}: ButtonProps) {
  const { palette, resolved } = useTheme();
  const tint = accent || palette.primary;
  const isDisabled = !!disabled || !!loading;

  const padY = size === "sm" ? 8 : size === "lg" ? 14 : 11;
  const padX = size === "sm" ? 12 : size === "lg" ? 20 : 16;
  const fontSize = size === "sm" ? 13 : size === "lg" ? 16 : 14.5;
  const iconSize = size === "sm" ? 14 : size === "lg" ? 18 : 16;

  let bg: string, fg: string, borderColor: string | undefined;
  if (variant === "primary") {
    bg = tint;
    fg = accentOn || "#fff";
    borderColor = tint;
  } else if (variant === "secondary") {
    bg = palette.bgSoft;
    fg = palette.text;
    borderColor = palette.border;
  } else if (variant === "destructive") {
    bg = palette.danger;
    fg = "#fff";
    borderColor = palette.danger;
  } else {
    // ghost
    bg = "transparent";
    fg = tint;
    borderColor = undefined;
  }

  const baseStyle: ViewStyle = {
    backgroundColor: bg,
    paddingVertical: padY,
    paddingHorizontal: padX,
    borderRadius: radius.md,
    borderWidth: borderColor ? StyleSheet.hairlineWidth : 0,
    borderColor,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: size === "sm" ? 36 : size === "lg" ? 52 : 44,
    opacity: isDisabled ? 0.55 : 1,
    width: fullWidth ? "100%" : undefined,
    ...(variant === "primary" || variant === "destructive" ? shadow(1, resolved === "dark") : null),
  };

  const handle = useCallback(() => { if (!isDisabled && onPress) onPress(); }, [isDisabled, onPress]);

  return (
    <Pressable
      onPress={handle}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      hitSlop={8}
    >
      {({ pressed }) => (
        <View
          style={[baseStyle, style, pressed && !isDisabled ? { opacity: 0.9 } : null]}
        >
          {loading ? (
            <ActivityIndicator color={fg} size="small" />
          ) : (
            <>
              {leftIcon ? <Ionicons name={leftIcon} size={iconSize} color={fg} /> : null}
              <Text style={[{ color: fg, fontSize, fontWeight: "700" }, textStyle]} numberOfLines={1}>
                {title}
              </Text>
              {rightIcon ? <Ionicons name={rightIcon} size={iconSize} color={fg} /> : null}
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}
