import React from "react";
import { View, Image } from "react-native";
import { useApp } from "../context/AppContext";
import { api } from "../lib/api";
import { Txt } from "./ui";
import { initials } from "../lib/format";
import { font } from "../lib/theme";

export function Avatar({ user, size = 64 }) {
  const { c } = useApp();
  const r = size * 0.3;
  return user?.photo ? (
    <Image source={{ uri: api.fileUrl(user.photo) }} style={{ width: size, height: size, borderRadius: r, backgroundColor: c.line }} />
  ) : (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: "#2463EB", alignItems: "center", justifyContent: "center" }}>
      <Txt style={{ color: "#fff", fontFamily: font.display, fontSize: size * 0.32 }}>{initials(user)}</Txt>
    </View>
  );
}
