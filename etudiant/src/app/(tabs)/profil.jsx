import React, { useEffect, useState } from "react";
import { View, Pressable, Linking, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Feather from "@expo/vector-icons/Feather";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import { remindersEnabled, setRemindersEnabled, ensurePermission, syncReminders } from "../../lib/reminders";
import { Txt, Screen, Card, Divider, MenuRow, Toggle, Sheet, Btn, Empty, toast } from "../../components/ui";
import { fullName } from "../../lib/format";
import { Avatar } from "../../components/Avatar";
import { font, alpha } from "../../lib/theme";

const THEMES = { system: "Comme le téléphone", light: "Clair", dark: "Sombre" };

export default function Profil() {
  const { c, user, isAuthenticated, unread, logout, updateUser, themePref, setTheme } = useApp();
  const router = useRouter();
  const [rules, setRules] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reminders, setReminders] = useState(true);

  useEffect(() => {
    api.settings().then(setRules).catch(() => {});
    remindersEnabled().then(setReminders);
  }, []);

  const changePhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled) return;
    const asset = res.assets[0];
    if (asset.fileSize && asset.fileSize > 3 * 1024 * 1024) return toast("La photo ne doit pas dépasser 3 Mo.", "error");
    setUploading(true);
    try {
      const out = await api.uploadPhoto(asset);
      await updateUser({ photo: out.photo });
      toast("Photo mise à jour");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const toggleReminders = async () => {
    const next = !reminders;
    if (next && !(await ensurePermission())) {
      return toast("Autorisez les notifications de Biblio IUA dans les réglages du téléphone.", "info");
    }
    await setRemindersEnabled(next);
    setReminders(next);
    if (next) api.loans().then(syncReminders).catch(() => {});
    toast(next ? "Rappels activés : 2 jours avant et le jour du retour, à 9 h" : "Rappels désactivés", "info");
  };

  const rulesSheet = (
    <Sheet open={showRules} onClose={() => setShowRules(false)} title="Règles de prêt">
      {rules &&
        [
          ["Durée d'un prêt", `${rules.duree_pret_jours} jours`],
          ["Documents en même temps", `${rules.max_emprunts_simultanes} maximum`],
          ["Prolongations", `${rules.max_renouvellements} × ${rules.jours_prolongation} jours`],
          ["Retrait d'une réservation", `sous ${rules.delai_recuperation_reservation_heures} h`],
          ["Suspension du compte", `après ${rules.jours_retard_suspension} j de retard`],
        ].map(([k, v], i) => (
          <View key={k}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 13, gap: 12 }}>
              <Txt muted>{k}</Txt>
              <Txt v="strong" style={{ flexShrink: 1, textAlign: "right" }}>{v}</Txt>
            </View>
          </View>
        ))}
      {rules && (
        <Txt v="small" muted style={{ marginTop: 8 }}>
          Un livre réservé par un autre lecteur ne peut pas être prolongé. Contact :{" "}
          <Txt v="smallStrong" color={c.brand} onPress={() => Linking.openURL(`mailto:${rules.email_contact}`)}>{rules.email_contact}</Txt>
        </Txt>
      )}
    </Sheet>
  );

  const themeSheet = (
    <Sheet open={showTheme} onClose={() => setShowTheme(false)} title="Apparence">
      {Object.entries(THEMES).map(([k, label], i) => (
        <View key={k}>
          {i > 0 && <Divider />}
          <Pressable onPress={() => { setTheme(k); setShowTheme(false); }} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 15 }} accessibilityRole="radio" accessibilityState={{ checked: themePref === k }}>
            <Txt style={{ flex: 1 }}>{label}</Txt>
            {themePref === k && <Feather name="check" size={20} color={c.brand} />}
          </Pressable>
        </View>
      ))}
    </Sheet>
  );

  const common = (
    <>
      <MenuRow icon="file-text" label="Règles de prêt" onPress={() => setShowRules(true)} />
      <Divider inset={50} />
      <MenuRow icon="moon" label="Apparence" onPress={() => setShowTheme(true)} right={<Txt v="small" muted>{THEMES[themePref]}</Txt>} />
      <Divider inset={50} />
      <MenuRow icon="server" label="Serveur" onPress={() => router.push("/serveur")} />
    </>
  );

  if (!isAuthenticated) {
    return (
      <Screen>
        <Txt v="h2" style={{ paddingHorizontal: 16, paddingTop: 12 }}>Profil</Txt>
        <Empty icon="log-in" title="Vous n'êtes pas connecté" text="Connectez-vous avec votre email IUA ou votre matricule pour suivre vos prêts.">
          <View style={{ gap: 8, width: 240 }}>
            <Btn title="Se connecter" onPress={() => router.push("/connexion")} />
            <Btn title="Créer un compte" kind="quiet" onPress={() => router.push("/inscription")} />
          </View>
        </Empty>
        <Card style={{ marginHorizontal: 16 }}>{common}</Card>
        {rulesSheet}
        {themeSheet}
      </Screen>
    );
  }

  return (
    <Screen>
      <Txt v="h2" style={{ paddingHorizontal: 16, paddingTop: 12 }}>Profil</Txt>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 16, marginTop: 16 }}>
        <Pressable onPress={changePhoto} accessibilityRole="button" accessibilityLabel="Changer la photo de profil">
          <Avatar user={user} />
          <View style={{ position: "absolute", right: -4, bottom: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center" }}>
            {uploading ? <ActivityIndicator size="small" color={c.brand} /> : <Feather name="camera" size={14} color={c.ink} />}
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Txt v="title" numberOfLines={1}>{fullName(user)}</Txt>
          <Txt v="small" muted numberOfLines={1}>{user.filiere || user.email}</Txt>
          {user.statut === "suspendu" && <Txt v="smallStrong" color={c.late}>Compte suspendu</Txt>}
        </View>
      </View>

      <Pressable onPress={() => router.push("/carte")} style={{ marginHorizontal: 16, marginTop: 20, flexDirection: "row", alignItems: "center", gap: 16, padding: 16, borderRadius: 16, backgroundColor: c.ink }}>
        <Feather name="maximize" size={26} color={c.paper} />
        <View style={{ flex: 1 }}>
          <Txt v="strong" color={c.paper}>Ma carte de lecteur</Txt>
          <Txt v="small" color={alpha(c.paper, 0.72)}>{user.matricule || "Matricule non renseigné"}</Txt>
        </View>
        <Feather name="chevron-right" size={20} color={c.paper} />
      </Pressable>

      <Card style={{ marginHorizontal: 16, marginTop: 20 }}>
        <MenuRow
          icon="bell"
          label="Notifications"
          onPress={() => router.push("/notifications")}
          right={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {unread > 0 && (
                <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: c.late, alignItems: "center", justifyContent: "center" }}>
                  <Txt style={{ color: "#fff", fontFamily: font.bold, fontSize: 12 }}>{unread}</Txt>
                </View>
              )}
              <Feather name="chevron-right" size={18} color={c.muted} />
            </View>
          }
        />
        <Divider inset={50} />
        <MenuRow icon="heart" label="Mes favoris" onPress={() => router.push("/favoris")} />
        <Divider inset={50} />
        <MenuRow icon="clock" label="Rappels avant la date de retour" onPress={toggleReminders} right={<Toggle on={reminders} />} />
      </Card>

      <Card style={{ marginHorizontal: 16, marginTop: 16 }}>
        <MenuRow icon="edit-3" label="Modifier mes informations" onPress={() => router.push("/profil-modifier")} />
        <Divider inset={50} />
        <MenuRow icon="key" label="Changer de mot de passe" onPress={() => router.push("/mot-de-passe")} />
        <Divider inset={50} />
        {common}
      </Card>

      <Card style={{ marginHorizontal: 16, marginTop: 16 }}>
        <MenuRow
          icon="log-out"
          label="Se déconnecter"
          danger
          onPress={async () => {
            await logout();
            toast("Vous êtes déconnecté", "info");
            router.replace("/");
          }}
        />
      </Card>
      {rulesSheet}
      {themeSheet}
    </Screen>
  );
}
