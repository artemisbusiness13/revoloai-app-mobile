import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#FAFAFA" },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="chat" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="checkout" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="jobs" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="interview" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="results" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
