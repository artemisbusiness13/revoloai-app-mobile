// Aurora design tokens for the RevoloAI app.
// Two palettes (light + dark) using the SAME shape so every screen can
// just consume `useTheme().palette` and switch instantly.
import { Platform, TextStyle, ViewStyle } from "react-native";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface Palette {
  // Surfaces
  bg: string;
  bgSoft: string;
  card: string;
  // Text
  text: string;
  text2: string;
  text3: string;
  // Lines
  border: string;
  // Primary / brand
  primary: string;
  primarySoft: string;
  primaryOn: string;
  // Status
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  // Avatar accents (kept across themes for brand consistency)
  maya: string;
  mayaSoft: string;
  sofia: string;
  sofiaSoft: string;
  aria: string;
  ariaSoft: string;
  // Legacy keys to keep older screens compatible during the staged rollout.
  amber: string;
  amberSoft: string;
  emerald: string;
  emeraldSoft: string;
  // Misc
  scrim: string;          // modal/backdrop wash
  highlight: string;      // selection / focus ring
  shimmerBg: string;
  shimmerHi: string;
}

export const lightPalette: Palette = {
  bg: "#F7F8FB",
  bgSoft: "#EEF1F7",
  card: "#FFFFFF",
  text: "#0B0F19",
  text2: "#5B6577",
  text3: "#8A93A6",
  border: "#E4E8EF",
  primary: "#5C7AE6",
  primarySoft: "#EEF1FF",
  primaryOn: "#FFFFFF",
  success: "#16A34A",
  successSoft: "#E6F8EF",
  warning: "#F59E0B",
  warningSoft: "#FFF6E5",
  danger: "#E11D48",
  dangerSoft: "#FFE6EC",
  maya: "#0EA5E9",
  mayaSoft: "#E6F6FE",
  sofia: "#EC4899",
  sofiaSoft: "#FDECF5",
  aria: "#8B5CF6",
  ariaSoft: "#F1ECFE",
  amber: "#F59E0B",
  amberSoft: "#FFF6E5",
  emerald: "#10B981",
  emeraldSoft: "#E6F8F1",
  scrim: "rgba(11,15,25,0.45)",
  highlight: "#5C7AE6",
  shimmerBg: "#E9ECF4",
  shimmerHi: "#F2F4F9",
};

export const darkPalette: Palette = {
  bg: "#0B0F19",
  bgSoft: "#141A2A",
  card: "#161D2F",
  text: "#F4F6FB",
  text2: "#A8B1C7",
  text3: "#6F7991",
  border: "#222B41",
  primary: "#7C97FF",
  primarySoft: "#1E2A4A",
  primaryOn: "#0B0F19",
  success: "#34D27A",
  successSoft: "#0F2F22",
  warning: "#F5C16C",
  warningSoft: "#2D2412",
  danger: "#FF6B83",
  dangerSoft: "#3A1623",
  // Avatar accents — slightly lifted for dark mode but recognisable
  maya: "#38BDF8",
  mayaSoft: "#0E2A3C",
  sofia: "#F472B6",
  sofiaSoft: "#3A1D2C",
  aria: "#A78BFA",
  ariaSoft: "#23193A",
  amber: "#F5C16C",
  amberSoft: "#2D2412",
  emerald: "#34D27A",
  emeraldSoft: "#0F2F22",
  scrim: "rgba(0,0,0,0.65)",
  highlight: "#7C97FF",
  shimmerBg: "#1B2238",
  shimmerHi: "#26304A",
};

// Typography scale
export const fonts = Platform.select<{ regular: string; bold: string; mono: string }>({
  ios: { regular: "System", bold: "System", mono: "Menlo" },
  android: { regular: "sans-serif", bold: "sans-serif", mono: "monospace" },
  default: { regular: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", bold: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", mono: "ui-monospace, SFMono-Regular, Menlo, monospace" },
})!;

export const type = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: "800" as TextStyle["fontWeight"] },
  h1:      { fontSize: 24, lineHeight: 30, fontWeight: "800" as TextStyle["fontWeight"] },
  h2:      { fontSize: 20, lineHeight: 26, fontWeight: "700" as TextStyle["fontWeight"] },
  h3:      { fontSize: 17, lineHeight: 22, fontWeight: "700" as TextStyle["fontWeight"] },
  body:    { fontSize: 15, lineHeight: 22, fontWeight: "500" as TextStyle["fontWeight"] },
  bodySm:  { fontSize: 13, lineHeight: 18, fontWeight: "500" as TextStyle["fontWeight"] },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600" as TextStyle["fontWeight"] },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

// Cross-platform shadow / elevation helper. Avoids the `"shadow*" style props
// are deprecated` warning on web by emitting `boxShadow` there.
export function shadow(level: 1 | 2 | 3, isDark: boolean): ViewStyle {
  if (Platform.OS === "web") {
    const opacityScale = isDark ? 0.55 : 0.12;
    const blurs = { 1: 12, 2: 24, 3: 48 } as const;
    const ys = { 1: 4, 2: 12, 3: 24 } as const;
    return {
      // RN Web supports the boxShadow string prop; cast through unknown.
      boxShadow: `0px ${ys[level]}px ${blurs[level]}px rgba(0,0,0,${opacityScale})`,
    } as ViewStyle;
  }
  const iosScale = isDark ? 0.55 : 0.10;
  if (Platform.OS === "ios") {
    return {
      shadowColor: "#000",
      shadowOpacity: iosScale,
      shadowRadius: level === 1 ? 8 : level === 2 ? 16 : 32,
      shadowOffset: { width: 0, height: level === 1 ? 2 : level === 2 ? 8 : 16 },
    };
  }
  // android
  return { elevation: level === 1 ? 2 : level === 2 ? 8 : 16 } as ViewStyle;
}
