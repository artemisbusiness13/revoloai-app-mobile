import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, ColorSchemeName, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Palette, ResolvedTheme, ThemeMode, darkPalette, lightPalette, radius, space, type as typo } from "./theme";

const KEY = "revolo.theme.mode";

export interface ThemeContextValue {
  mode: ThemeMode;          // user's setting (light/dark/system)
  resolved: ResolvedTheme;  // what's actually applied
  palette: Palette;
  space: typeof space;
  radius: typeof radius;
  type: typeof typo;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme() || "light"
  );

  // Hydrate persisted preference
  useEffect(() => {
    (async () => {
      try {
        const saved = (await AsyncStorage.getItem(KEY)) as ThemeMode | null;
        if (saved === "light" || saved === "dark" || saved === "system") {
          setModeState(saved);
        }
      } catch {}
    })();
  }, []);

  // Track OS appearance changes (only matters when mode === "system")
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || "light");
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const toggle = useCallback(() => {
    // Cycle: system → light → dark → system
    setModeState((curr) => {
      const next: ThemeMode = curr === "system" ? "light" : curr === "light" ? "dark" : "system";
      AsyncStorage.setItem(KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const resolved: ResolvedTheme = mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;
  const palette = resolved === "dark" ? darkPalette : lightPalette;

  // Mirror the resolved theme to the html element on web so any browser UI
  // (scrollbar, autofill) also picks the right palette.
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      try {
        document.documentElement.setAttribute("data-theme", resolved);
        document.documentElement.style.colorScheme = resolved;
        const bg = palette.bg;
        const body = document.body;
        if (body) body.style.backgroundColor = bg;
      } catch {}
    }
  }, [resolved, palette.bg]);

  const value = useMemo<ThemeContextValue>(() => ({
    mode, resolved, palette, space, radius, type: typo, setMode, toggle,
  }), [mode, resolved, palette, setMode, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback for screens used before the provider mounted — returns light.
    return {
      mode: "system",
      resolved: "light",
      palette: lightPalette,
      space, radius, type: typo,
      setMode: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

// Convenience hook — many existing screens just want a `C` palette object.
export function useC(): Palette {
  return useTheme().palette;
}
