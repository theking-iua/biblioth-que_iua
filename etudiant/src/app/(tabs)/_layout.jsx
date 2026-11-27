import React from "react";
import { Tabs } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../context/AppContext";
import { font } from "../../lib/theme";

// Icônes de la barre d'onglets (définies hors du composant : stables d'un rendu à l'autre)
function HomeIcon({ color, size }) { return <Feather name="home" size={size - 2} color={color} />; }
function SearchIcon({ color, size }) { return <Feather name="search" size={size - 2} color={color} />; }
function SchoolIcon({ color, size }) { return <Ionicons name="school-outline" size={size} color={color} />; }
function LoansIcon({ color, size }) { return <Feather name="bookmark" size={size - 2} color={color} />; }
function UserIcon({ color, size }) { return <Feather name="user" size={size - 2} color={color} />; }

export default function TabsLayout() {
  const { c, unread } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.brand,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.line,
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 8,
        },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: c.paper },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarIcon: HomeIcon }} />
      <Tabs.Screen name="catalogue" options={{ title: "Catalogue", tabBarIcon: SearchIcon }} />
      <Tabs.Screen
        name="memoires"
        options={{ title: "Mémoires", tabBarIcon: SchoolIcon }}
      />
      <Tabs.Screen name="prets" options={{ title: "Mes prêts", tabBarIcon: LoansIcon }} />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: UserIcon,
          tabBarBadge: unread > 0 ? (unread > 9 ? "9+" : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: c.late, fontFamily: font.bold, fontSize: 10 },
        }}
      />
    </Tabs>
  );
}
