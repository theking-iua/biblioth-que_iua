import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useApp } from "../context/AppContext";
import { api, getApiUrl, setApiUrl, DEFAULT_API_URL } from "../lib/api";
import { Header, Screen, Field, Btn, Txt, toast } from "../components/ui";
import { alpha } from "../lib/theme";

// Adresse de l'API : utile pour tester l'APK sur le Wi-Fi local (ex. http://192.168.1.10:4000/api)
// avant la mise en ligne du serveur.
export default function Serveur() {
  const { c, isAuthenticated, logout } = useApp();
  const router = useRouter();
  const [url, setUrl] = useState(getApiUrl());
  const [state, setState] = useState(null); // null | "test" | "ok" | message d'erreur

  const test = async () => {
    const previous = getApiUrl();
    setState("test");
    try {
      await setApiUrl(url);
      await api.health();
      setState("ok");
    } catch (e) {
      setState(e.message);
    } finally {
      await setApiUrl(previous);
    }
  };

  const save = async () => {
    const before = getApiUrl();
    const after = await setApiUrl(url);
    // Changer de serveur invalide la session en cours
    if (after !== before && isAuthenticated) await logout();
    toast("Adresse du serveur enregistrée");
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title="Serveur" />
      <Screen edges={[]} contentStyle={{ paddingHorizontal: 16 }}>
        <Txt muted style={{ marginBottom: 16 }}>
          Adresse de l'API de la bibliothèque. À ne modifier que sur indication du service informatique.
        </Txt>
        <Field
          label="Adresse de l'API"
          value={url}
          onChangeText={(v) => { setUrl(v); setState(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://api.biblio.iua.ci/api"
          hint={`Par défaut : ${DEFAULT_API_URL}`}
        />
        {state && state !== "test" && (
          <View style={{ flexDirection: "row", gap: 10, padding: 14, borderRadius: 14, marginBottom: 16, backgroundColor: alpha(state === "ok" ? c.ok : c.late, 0.1) }}>
            <Feather name={state === "ok" ? "check-circle" : "alert-circle"} size={18} color={state === "ok" ? c.ok : c.late} />
            <Txt v="small" color={state === "ok" ? c.ok : c.late} style={{ flex: 1 }}>
              {state === "ok" ? "Connexion réussie : le serveur répond." : state}
            </Txt>
          </View>
        )}
        <View style={{ gap: 8 }}>
          <Btn title="Tester la connexion" kind="quiet" icon="activity" loading={state === "test"} onPress={test} />
          <Btn title="Enregistrer" onPress={save} />
          <Btn title="Revenir à l'adresse par défaut" kind="outline" onPress={() => { setUrl(DEFAULT_API_URL); setState(null); }} />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
