import React, { useEffect } from "react";
import { View, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useFonts } from "expo-font";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { BricolageGrotesque_600SemiBold } from "@expo-google-fonts/bricolage-grotesque/600SemiBold";
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque/700Bold";
import { AppProvider, useApp } from "../context/AppContext";
import { Toaster } from "../components/ui";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { ready, c, isDark } = useApp();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold,
  });
  const loaded = ready && (fontsLoaded || !!fontError);
  const router = useRouter();

  // Toucher un rappel de retour ouvre « Mes prêts »
  useEffect(() => {
    if (Platform.OS === "web" || !loaded) return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = r?.notification?.request?.content?.data?.url;
      if (typeof url === "string" && url.startsWith("/")) router.push(url);
    });
    return () => sub.remove();
  }, [loaded, router]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(c.paper).catch(() => {});
  }, [c.paper]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.paper }, animation: "slide_from_right" }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="livre/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="favoris" />
        <Stack.Screen name="carte" />
        <Stack.Screen name="profil-modifier" />
        <Stack.Screen name="mot-de-passe" />
        <Stack.Screen name="serveur" />
        <Stack.Screen name="connexion" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="inscription" />
      </Stack>
      <Toaster />
    </View>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Root />
      </AppProvider>
    </SafeAreaProvider>
  );
}
