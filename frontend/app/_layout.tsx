import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { I18nProvider } from "../lib/i18n";
import { DemoProvider } from "../lib/demo";
import { AuthProvider } from "../lib/auth";
import DemoLauncher from "../components/DemoLauncher";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <AuthProvider>
            <DemoProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: "#FAFAFA" },
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
              <DemoLauncher />
            </DemoProvider>
          </AuthProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
