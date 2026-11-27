import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "../context/AppContext";
import { api } from "../lib/api";
import { Header, Screen, Txt, Field, PasswordField, Btn, LinkText, toast } from "../components/ui";
import { Brand, ErrorLine } from "../components/AuthBits";

export default function Inscription() {
  const { login } = useApp();
  const router = useRouter();
  const [f, setF] = useState({ prenom: "", nom: "", email: "", matricule: "", filiere: "", telephone: "", mot_de_passe: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const submit = async () => {
    setError("");
    if (!f.nom.trim() || !f.email.trim()) return setError("Le nom et l'adresse email sont obligatoires.");
    if (f.mot_de_passe.length < 6) return setError("Le mot de passe doit contenir au moins 6 caractères.");
    setLoading(true);
    try {
      await api.register({ ...f, email: f.email.trim() });
      await login(f.email.trim(), f.mot_de_passe);
      toast("Compte créé. Bienvenue à la bibliothèque !");
      router.replace("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title="" />
      <Screen edges={[]}>
        <Brand title="Créer un compte" text="Gratuit pour les étudiants et le personnel de l'IUA." />
        <View style={{ paddingHorizontal: 20 }}>
          <ErrorLine message={error} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Field label="Prénom" value={f.prenom} onChangeText={set("prenom")} autoComplete="given-name" style={{ flex: 1 }} />
            <Field label="Nom" value={f.nom} onChangeText={set("nom")} autoComplete="family-name" style={{ flex: 1 }} />
          </View>
          <Field label="Email" value={f.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
          <Field label="Matricule" hint="Facultatif. Laissez vide si vous n'en avez pas : un numéro vous sera attribué." value={f.matricule} onChangeText={set("matricule")} autoCapitalize="characters" />
          <Field label="Filière" value={f.filiere} onChangeText={set("filiere")} placeholder="Ex. Master 1 Finance" />
          <Field label="Téléphone" value={f.telephone} onChangeText={set("telephone")} keyboardType="phone-pad" autoComplete="tel" />
          <PasswordField label="Mot de passe" hint="6 caractères minimum." value={f.mot_de_passe} onChangeText={set("mot_de_passe")} autoComplete="new-password" textContentType="newPassword" />
          <Btn title="Créer mon compte" loading={loading} onPress={submit} />
          <Txt v="small" muted style={{ textAlign: "center", marginTop: 24 }}>
            Déjà inscrit ? <LinkText onPress={() => router.replace("/connexion")}>Se connecter</LinkText>
          </Txt>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
