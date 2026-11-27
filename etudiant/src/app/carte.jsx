import React from "react";
import { View, Image } from "react-native";
import { Redirect } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { useApp } from "../context/AppContext";
import { Header, Txt, Screen, shadow } from "../components/ui";
import { Avatar } from "../components/Avatar";
import { fullName } from "../lib/format";
import { font } from "../lib/theme";

// Carte de lecteur : le QR code contient le matricule, que la douchette du comptoir saisit
// directement dans le champ « lecteur » du prêt rapide. Fonctionne hors connexion.
export default function Carte() {
  const { c, user, isAuthenticated } = useApp();
  if (!isAuthenticated) return <Redirect href="/connexion" />;
  const code = user.matricule || user.email;
  const valid = user.statut === "actif";

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <Header title="Carte de lecteur" />
      <Screen edges={[]} contentStyle={{ paddingHorizontal: 20 }}>
        <View style={[{ borderRadius: 24, backgroundColor: "#fff", overflow: "hidden" }, shadow(5)]}>
          <View style={{ backgroundColor: "#2463EB", paddingHorizontal: 20, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Image source={require("../../assets/logo.png")} style={{ width: 40, height: 40, borderRadius: 12 }} />
            <View>
              <Txt style={{ color: "#fff", fontFamily: font.displaySemi, fontSize: 15 }}>Institut Universitaire d'Abidjan</Txt>
              <Txt v="small" style={{ color: "rgba(255,255,255,0.82)" }}>Carte de la bibliothèque</Txt>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingTop: 20 }}>
            <Avatar user={user} />
            <View style={{ flex: 1 }}>
              <Txt v="title" color="#14213D">{fullName(user)}</Txt>
              <Txt v="small" color="#5C6880" numberOfLines={1}>{user.filiere || "Lecteur"}</Txt>
            </View>
          </View>
          <View style={{ padding: 20, alignItems: "center" }}>
            <QRCode value={code} size={220} color="#14213D" backgroundColor="#FFFFFF" ecl="M" />
            <Txt style={{ marginTop: 14, fontFamily: font.display, fontSize: 22, letterSpacing: 0.5, color: "#14213D" }}>{code}</Txt>
            <Txt v="smallStrong" color={valid ? "#12805C" : "#C2362B"} style={{ marginTop: 2 }}>
              {valid ? "Carte valide" : user.statut === "suspendu" ? "Compte suspendu" : "En attente de validation"}
            </Txt>
          </View>
        </View>
        <Txt v="small" muted style={{ textAlign: "center", marginTop: 20, paddingHorizontal: 24 }}>
          Présentez ce code au comptoir pour emprunter ou retirer une réservation. Il s'affiche même sans connexion.
        </Txt>
      </Screen>
    </View>
  );
}
