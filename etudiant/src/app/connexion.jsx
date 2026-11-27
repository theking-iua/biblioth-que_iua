import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useApp } from "../context/AppContext";
import { getApiUrl } from "../lib/api";
import { Header, Screen, Txt, Field, PasswordField, Btn, LinkText, toast } from "../components/ui";
import { Brand, ErrorLine } from "../components/AuthBits";

// Seules les adresses internes de l'appli sont acceptées comme destination après connexion
const safeNext = (s) => (typeof s === "string" && s.startsWith("/") && !s.startsWith("//") ? s : null);

export default function Connexion() {
  const { login, sessionExpired } = useApp();
  const router = useRouter();
  const { suite } = useLocalSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(sessionExpired ? "Votre session a expiré. Reconnectez-vous." : "");

  const submit = async () => {
    if (!email.trim() || !password) return setError("Saisissez votre email (ou matricule) et votre mot de passe.");
    setError("");
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      toast(`Bienvenue, ${u.prenom || u.nom}`);
      const next = safeNext(suite);
      if (router.canGoBack()) router.back();
      if (next) router.push(next);
      else if (!router.canGoBack()) router.replace("/");
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
        <Brand title="Connexion" text="Avec votre email IUA ou votre matricule." />
        <View style={{ paddingHorizontal: 20 }}>
          <ErrorLine message={error} />
          <Field
            label="Email ou matricule"
            value={email}
            onChangeText={setEmail}
            placeholder="prenom.nom@iua.ci"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
          />
          <PasswordField
            label="Mot de passe"
            hint="Compte créé par la bibliothèque : le mot de passe initial est votre matricule."
            value={password}
            onChangeText={setPassword}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <Btn title="Se connecter" loading={loading} onPress={submit} style={{ marginTop: 4 }} />
          <Txt v="small" muted style={{ textAlign: "center", marginTop: 28 }}>
            Pas encore de compte ? <LinkText onPress={() => router.replace("/inscription")}>Créer un compte</LinkText>
          </Txt>
          <Txt v="tiny" muted style={{ textAlign: "center", marginTop: 24 }} onPress={() => router.push("/serveur")}>
            Serveur : {getApiUrl().replace(/^https?:\/\//, "")}
          </Txt>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
