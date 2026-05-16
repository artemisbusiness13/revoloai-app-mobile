import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { I18nProvider } from "../lib/i18n";
import { DemoProvider } from "../lib/demo";
import { AuthProvider } from "../lib/auth";
import DemoLauncher from "../components/DemoLauncher";
import { ThemeProvider, useTheme } from "../components/ui";
import { TermsAcceptanceGate } from "../components/ui/TermsAcceptanceGate";

/**
 * Inner layout that reads the resolved theme so the global Stack background
 * and StatusBar tint always match light/dark.
 */
function ThemedStack() {
  const { resolved, palette } = useTheme();
  return (
    <>
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="profile" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="chat" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="checkout" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="jobs" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="interview" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="results" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="legal/[slug]" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              <DemoProvider>
                <ThemedStack />
                <TermsAcceptanceGate />
                <DemoLauncher />
              </DemoProvider>
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
