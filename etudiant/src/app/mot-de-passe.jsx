import React, { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useApp } from "../context/AppContext";
import { api } from "../lib/api";
import { Header, Screen, PasswordField, Btn, toast } from "../components/ui";

export default function MotDePasse() {
  const { user, isAuthenticated } = useApp();
  const router = useRouter();
  const [f, setF] = useState({ old: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  if (!isAuthenticated) return <Redirect href="/connexion" />;

  const save = async () => {
    if (f.next.length < 6) return toast("Le nouveau mot de passe doit contenir au moins 6 caractères.", "error");
    if (f.next !== f.confirm) return toast("Les deux nouveaux mots de passe ne sont pas identiques.", "error");
    setSaving(true);
    try {
      await api.updateMember({ id: user.id, nom: user.nom, email: user.email, mot_de_passe: f.next, ancien_mot_de_passe: f.old });
      toast("Mot de passe changé");
      router.back();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title="Mot de passe" />
      <Screen edges={[]} contentStyle={{ paddingHorizontal: 16 }}>
        <PasswordField
          label="Mot de passe actuel"
          hint="Compte importé par la bibliothèque : votre mot de passe initial est votre matricule."
          value={f.old}
          onChangeText={(v) => setF((x) => ({ ...x, old: v }))}
          autoComplete="current-password"
        />
        <PasswordField label="Nouveau mot de passe" hint="6 caractères minimum." value={f.next} onChangeText={(v) => setF((x) => ({ ...x, next: v }))} autoComplete="new-password" />
        <PasswordField label="Confirmer le nouveau mot de passe" value={f.confirm} onChangeText={(v) => setF((x) => ({ ...x, confirm: v }))} autoComplete="new-password" />
        <Btn title="Changer le mot de passe" loading={saving} onPress={save} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
