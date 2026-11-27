import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, FlatList, TextInput, Pressable, RefreshControl } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import { Txt, Chips, Loading, Empty, ErrorBox, Divider, Toggle } from "../../components/ui";
import { BookRow } from "../../components/Books";
import { TYPE_LABELS } from "../../lib/format";
import { font } from "../../lib/theme";

export default function Catalogue() {
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [q, setQ] = useState(params.q || "");
  const [query, setQuery] = useState(params.q || "");
  const [categorie, setCategorie] = useState(params.categorie || "Toutes");
  const [type, setType] = useState("Tous");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState([]);
  const timer = useRef();

  // Recherche ou domaine choisi depuis l'accueil (onglet déjà ouvert) : on ajuste les filtres
  const [seen, setSeen] = useState({ q: params.q, categorie: params.categorie });
  if (params.q !== seen.q || params.categorie !== seen.categorie) {
    setSeen({ q: params.q, categorie: params.categorie });
    if (params.q !== undefined) { setQ(params.q); setQuery(params.q); }
    if (params.categorie !== undefined) setCategorie(params.categorie);
  }

  useEffect(() => {
    api.categories().then((cs) => setCategories(cs.map((x) => x.nom))).catch(() => {});
  }, []);

  const fetchDocs = useCallback(
    () =>
      api
        .documents({ q: query, categorie, type })
        .then((d) => { setDocs(d); setError(""); })
        .catch((e) => setError(e.message))
        .finally(() => setRefreshing(false)),
    [query, categorie, type]
  );
  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  const load = (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    fetchDocs();
  };

  const onType = (v) => {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setQuery(v.trim()), 350);
  };

  const shown = useMemo(() => (docs || []).filter((d) => !onlyAvailable || Number(d.copies_disponibles) > 0), [docs, onlyAvailable]);

  const header = (
    <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: c.paper, borderBottomWidth: 1, borderBottomColor: c.line, gap: 12 }}>
      <Txt v="h2">Catalogue</Txt>
      <View style={{ justifyContent: "center" }}>
        <Feather name="search" size={18} color={c.muted} style={{ position: "absolute", left: 14, zIndex: 1 }} />
        <TextInput
          value={q}
          onChangeText={onType}
          returnKeyType="search"
          placeholder="Titre, auteur, ISBN, cote, mot-clé"
          placeholderTextColor={c.muted}
          accessibilityLabel="Rechercher"
          style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingLeft: 42, paddingRight: 42, paddingVertical: 11, color: c.ink, fontFamily: font.regular, fontSize: 15 }}
        />
        {!!q && (
          <Pressable onPress={() => onType("")} style={{ position: "absolute", right: 10 }} hitSlop={10} accessibilityLabel="Effacer">
            <Feather name="x" size={18} color={c.muted} />
          </Pressable>
        )}
      </View>
      <Chips value={categorie} onChange={setCategorie} options={["Toutes", ...categories]} />
      <Chips
        value={type}
        onChange={setType}
        options={[{ value: "Tous", label: "Tous types" }, ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))]}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      {header}
      {error ? (
        <ErrorBox message={error} onRetry={() => load()} />
      ) : !docs ? (
        <Loading />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(d) => String(d.id)}
          renderItem={({ item }) => <BookRow book={item} />}
          ItemSeparatorComponent={() => <Divider inset={88} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[c.brand]} tintColor={c.brand} />}
          ListHeaderComponent={
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
              <Txt v="small" muted>{`${shown.length} résultat${shown.length > 1 ? "s" : ""}`}</Txt>
              <Pressable onPress={() => setOnlyAvailable((x) => !x)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessibilityRole="switch" accessibilityState={{ checked: onlyAvailable }}>
                <Txt v="smallStrong">Disponibles seulement</Txt>
                <Toggle on={onlyAvailable} />
              </Pressable>
            </View>
          }
          ListEmptyComponent={<Empty icon="search" title="Aucun ouvrage trouvé" text="Essayez un autre mot-clé ou retirez un filtre." />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}
