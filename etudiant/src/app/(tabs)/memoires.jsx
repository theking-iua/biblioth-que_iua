import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, FlatList, TextInput, Pressable, Linking, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import { Txt, Chips, Loading, Empty, ErrorBox, Divider, Sheet, Btn, toast } from "../../components/ui";
import { font, alpha } from "../../lib/theme";

const CYCLES = ["Tous", "Licence", "Master", "Doctorat", "Recherche"];

export default function Memoires() {
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [cycle, setCycle] = useState("Tous");
  const [filiere, setFiliere] = useState("Toutes");
  const [items, setItems] = useState(null);
  const [allFilieres, setAllFilieres] = useState([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(null);
  const timer = useRef();

  const fetchItems = useCallback(
    () =>
      api
        .memoires({ q: query, cycle, filiere })
        .then((d) => { setItems(d); setError(""); })
        .catch((e) => setError(e.message))
        .finally(() => setRefreshing(false)),
    [query, cycle, filiere]
  );
  useEffect(() => { fetchItems(); }, [fetchItems]);
  const load = (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    fetchItems();
  };
  useEffect(() => {
    api.memoires().then((all) => setAllFilieres([...new Set(all.map((m) => m.filiere))].sort())).catch(() => {});
  }, []);

  const onType = (v) => {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setQuery(v.trim()), 350);
  };

  const openPdf = async (m, download = false) => {
    const url = api.fileUrl(m.fichier_path);
    if (!url) return toast("Le PDF de ce mémoire n'est pas encore en ligne. Il est consultable à la bibliothèque.", "info");
    try {
      await Linking.openURL(url);
      (download ? api.memoireDownload(m.id) : api.memoireView(m.id)).catch(() => {});
    } catch {
      toast("Impossible d'ouvrir le PDF sur ce téléphone.", "error");
    }
  };

  const filieres = useMemo(() => ["Toutes", ...allFilieres], [allFilieres]);

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.line, gap: 12 }}>
        <Txt v="h2">Mémoires et thèses</Txt>
        <View style={{ justifyContent: "center" }}>
          <Feather name="search" size={18} color={c.muted} style={{ position: "absolute", left: 14, zIndex: 1 }} />
          <TextInput
            value={q}
            onChangeText={onType}
            returnKeyType="search"
            placeholder="Sujet, auteur, directeur, mot du texte"
            placeholderTextColor={c.muted}
            accessibilityLabel="Rechercher un mémoire"
            style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingLeft: 42, paddingRight: 16, paddingVertical: 11, color: c.ink, fontFamily: font.regular, fontSize: 15 }}
          />
        </View>
        <Chips value={cycle} onChange={setCycle} options={CYCLES.map((x) => ({ value: x, label: x === "Tous" ? "Tous cycles" : x }))} />
        {filieres.length > 2 && <Chips value={filiere} onChange={setFiliere} options={filieres} />}
      </View>

      {error ? (
        <ErrorBox message={error} onRetry={() => load()} />
      ) : !items ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => String(m.id)}
          ItemSeparatorComponent={() => <Divider inset={16} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[c.brand]} tintColor={c.brand} />}
          keyboardDismissMode="on-drag"
          renderItem={({ item: m }) => (
            <Pressable onPress={() => setOpen(m)} style={({ pressed }) => [{ paddingHorizontal: 16, paddingVertical: 16 }, pressed && { backgroundColor: alpha(c.ink, 0.03) }]} accessibilityRole="button">
              <Txt v="tiny" color={c.brand} style={{ fontFamily: font.semibold, fontSize: 12 }}>{m.cycle}, {m.annee_academique}</Txt>
              <Txt v="strong" numberOfLines={3} style={{ marginTop: 4 }}>{m.titre}</Txt>
              <Txt v="small" muted numberOfLines={1} style={{ marginTop: 4 }}>{m.auteur}</Txt>
              <Txt v="small" muted numberOfLines={1}>{m.filiere}</Txt>
            </Pressable>
          )}
          ListEmptyComponent={<Empty icon="file-text" title="Aucun mémoire trouvé" text="Essayez un autre sujet ou un autre cycle." />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} title="Mémoire">
        {open && (
          <View>
            <Txt v="smallStrong" color={c.brand}>{open.cycle}, {open.filiere}</Txt>
            <Txt v="title" style={{ marginTop: 4, fontSize: 20, lineHeight: 26 }}>{open.titre}</Txt>
            <View style={{ marginTop: 14, gap: 6 }}>
              {[
                ["Auteur", open.auteur],
                ["Directeur", open.directeur_recherche],
                ["Soutenance", open.session_soutenance || open.annee_academique],
                ["Mention", open.note_mention],
                ["Consultations", String(open.nb_vues)],
              ].filter(([, v]) => v).map(([k, v]) => (
                <View key={k} style={{ flexDirection: "row", gap: 12 }}>
                  <Txt v="small" muted style={{ width: 96 }}>{k}</Txt>
                  <Txt v="smallStrong" style={{ flex: 1 }}>{v}</Txt>
                </View>
              ))}
            </View>
            {!!open.resume && <Txt style={{ marginTop: 16, lineHeight: 23 }}>{open.resume}</Txt>}
            {!!open.mots_cles && <Txt v="small" muted style={{ marginTop: 10 }}>Mots-clés : {open.mots_cles}</Txt>}
            <View style={{ marginTop: 20, gap: 8 }}>
              {open.fichier_path ? (
                <>
                  <Btn title="Lire le PDF" icon="eye" onPress={() => openPdf(open)} />
                  {Number(open.telechargeable) === 1 && <Btn title="Télécharger" icon="download" kind="quiet" onPress={() => openPdf(open, true)} />}
                </>
              ) : (
                <View style={{ flexDirection: "row", gap: 12, padding: 16, borderRadius: 16, backgroundColor: alpha(c.ink, 0.06) }}>
                  <Feather name="file-text" size={20} color={c.muted} />
                  <Txt v="small" style={{ flex: 1 }}>La version PDF n'est pas encore en ligne. L'exemplaire papier est consultable sur place, à la bibliothèque.</Txt>
                </View>
              )}
            </View>
          </View>
        )}
      </Sheet>
    </View>
  );
}
