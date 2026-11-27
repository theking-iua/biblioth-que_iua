import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useApp } from "../context/AppContext";
import { api } from "../lib/api";
import { Header, Screen, Field, Btn, toast } from "../components/ui";

export default function ProfilModifier() {
  const { user, isAuthenticated, updateUser } = useApp();
  const router = useRouter();
  const [f, setF] = useState({
    prenom: user?.prenom || "", nom: user?.nom || "", email: user?.email || "", telephone: user?.telephone || "", filiere: user?.filiere || "",
  });
  const [saving, setSaving] = useState(false);
  if (!isAuthenticated) return <Redirect href="/connexion" />;
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await api.updateMember({ id: user.id, ...f });
      await updateUser(f);
      toast("Informations enregistrées");
      router.back();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title="Mes informations" />
      <Screen edges={[]} contentStyle={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Field label="Prénom" value={f.prenom} onChangeText={set("prenom")} style={{ flex: 1 }} />
          <Field label="Nom" value={f.nom} onChangeText={set("nom")} style={{ flex: 1 }} />
        </View>
        <Field label="Email" value={f.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Téléphone" value={f.telephone} onChangeText={set("telephone")} keyboardType="phone-pad" placeholder="+225 07 00 00 00 00" />
        <Field label="Filière" value={f.filiere} onChangeText={set("filiere")} placeholder="Ex. Licence 3 Droit privé" />
        <Field label="Matricule" value={user.matricule || ""} editable={false} hint="Le matricule est modifiable uniquement par la bibliothèque." />
        <Btn title="Enregistrer" loading={saving} onPress={save} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
