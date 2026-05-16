import React, { useEffect } from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { useTheme } from "./ThemeProvider";
import { radius, space } from "./theme";

export interface SkeletonProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * Single shimmer block. Uses a looped translateX gradient highlight so it
 * works on web (no native LinearGradient needed).
 */
export function Skeleton({ width = "100%", height = 14, radius: r = 8, style }: SkeletonProps) {
  const { palette } = useTheme();
  const x = useSharedValue(-1);
  useEffect(() => {
    x.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.linear }),
      -1,
      false
    );
  }, [x]);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * 220 }],
  }));
  return (
    <View
      style={[
        { width: width as any, height, borderRadius: r, backgroundColor: palette.shimmerBg, overflow: "hidden" },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: palette.shimmerHi, opacity: 0.55, width: 80, borderRadius: r },
          aStyle,
        ]}
      />
    </View>
  );
}

/** A pre-composed card-shaped skeleton matching a job card. */
export function JobCardSkeleton() {
  const { palette } = useTheme();
  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderRadius: 16,
        padding: space.lg,
        gap: 10,
        borderWidth: 1,
        borderColor: palette.border,
      }}
      accessibilityLabel="Loading job card"
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="45%" height={11} />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Skeleton width={70} height={20} radius={999} />
        <Skeleton width={60} height={20} radius={999} />
        <Skeleton width={80} height={20} radius={999} />
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
        <Skeleton width={90} height={36} radius={10} />
        <Skeleton width="100%" height={36} radius={10} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

/** Chat bubble skeleton (AI side). */
export function AvatarBubbleSkeleton() {
  return (
    <View style={{ marginVertical: 6, gap: 6, alignSelf: "flex-start", maxWidth: "82%" }}>
      <Skeleton width={220} height={14} />
      <Skeleton width={160} height={14} />
      <Skeleton width={120} height={14} />
    </View>
  );
}
