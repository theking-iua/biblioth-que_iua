import React from "react";
import { View, Image } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useApp } from "../context/AppContext";
import { Txt } from "./ui";
import { alpha } from "../lib/theme";

export function Brand({ title, text }) {
  const { c } = useApp();
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
      <Image source={require("../../assets/logo.png")} style={{ width: 56, height: 56, borderRadius: 16, borderWidth: 1, borderColor: c.line }} />
      <Txt v="h1" style={{ marginTop: 20 }}>{title}</Txt>
      <Txt muted style={{ marginTop: 4 }}>{text}</Txt>
    </View>
  );
}

export function ErrorLine({ message }) {
  const { c } = useApp();
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={{ flexDirection: "row", gap: 10, padding: 14, borderRadius: 14, backgroundColor: alpha(c.late, 0.1), marginBottom: 16 }}>
      <Feather name="alert-circle" size={18} color={c.late} style={{ marginTop: 1 }} />
      <Txt v="small" color={c.late} style={{ flex: 1 }}>{message}</Txt>
    </View>
  );
}
