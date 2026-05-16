import React from "react";
import { View, ViewProps, ViewStyle } from "react-native";
import { useTheme } from "./ThemeProvider";
import { radius, shadow, space } from "./theme";

export interface CardProps extends ViewProps {
  elevated?: 0 | 1 | 2;     // 0 = flat
  padded?: boolean;          // default true
  style?: ViewStyle | ViewStyle[];
}

export function Card({ elevated = 1, padded = true, style, children, ...rest }: CardProps) {
  const { palette, resolved } = useTheme();
  const base: ViewStyle = {
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    borderColor: palette.border,
    borderWidth: elevated === 0 ? 1 : 0,
    padding: padded ? space.lg : 0,
    ...(elevated > 0 ? shadow(elevated as 1 | 2, resolved === "dark") : null),
  };
  return (
    <View {...rest} style={[base, style]}>
      {children}
    </View>
  );
}
