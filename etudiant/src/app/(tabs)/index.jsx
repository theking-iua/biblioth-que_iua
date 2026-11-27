import React, { useState } from "react";
import { View, Image, Pressable, TextInput, ScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { syncReminders } from "../../lib/reminders";
import { Txt, Card, Divider, Btn } from "../../components/ui";
import { BookCover } from "../../components/Books";
import { daysUntil, dueLabel } from "../../lib/format";
import { font, alpha } from "../../lib/theme";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 || h >= 18 ? "Bonsoir" : "Bonjour";
};

// Compte à rebours d'un prêt : le chiffre est l'information principale
function DueBadge({ date }) {
  const { c } = useApp();
  const n = daysUntil(date);
  const bg = n < 0 ? c.late : n <= 3 ? c.ochre : alpha(c.ink, 0.06);
  const fg = n <= 3 ? "#fff" : c.ink;
  return (
    <View style={{ width: 56, paddingVertical: 8, borderRadius: 12, backgroundColor: bg, alignItems: "center" }}>
      <Txt style={{ fontFamily: font.display, fontSize: 24, lineHeight: 26, color: fg }}>{Math.abs(n)}</Txt>
      <Txt v="tiny" style={{ color: fg, fontFamily: font.semibold, fontSize: 10 }}>{n < 0 ? "j retard" : n === 0 ? "auj." : "jours"}</Txt>
    </View>
  );
}

export default function Home() {
  const { c, user, isAuthenticated, unread } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");

  const pub = useLoad(async () => {
    const [docs, stats, cats] = await Promise.all([api.documents(), api.stats().catch(() => null), api.categories().catch(() => [])]);
    return { recent: docs.slice(0, 10), stats, cats };
  }, []);

  const mine = useLoad(async () => {
    if (!isAuthenticated) return null;
    const [loans, res] = await Promise.all([api.loans(), api.reservations()]);
    syncReminders(loans);
    return { loans: loans.filter((l) => l.statut !== "retourne"), pickup: res.filter((r) => r.statut === "disponible") };
  }, [isAuthenticated]);

  const stats = pub.data?.stats;
  const loans = (mine.data?.loans || []).slice().sort((a, b) => a.date_retour_prevue.localeCompare(b.date_retour_prevue));
  const pickup = mine.data?.pickup || [];

  const search = () => router.push({ pathname: "/catalogue", params: q.trim() ? { q: q.trim() } : {} });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={pub.refreshing} onRefresh={() => { pub.onRefresh(); mine.reload(); }} tintColor="#fff" colors={[c.brand]} progressViewOffset={insets.top} />}
    >
      {/* En-tête bleu IUA */}
      <View style={{ backgroundColor: c.hero, paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Image source={require("../../../assets/logo.png")} style={{ width: 36, height: 36, borderRadius: 10 }} />
            <Txt style={{ fontFamily: font.displaySemi, fontSize: 15, color: "#fff" }}>Bibliothèque IUA</Txt>
          </View>
          {isAuthenticated && (
            <Pressable onPress={() => router.push("/notifications")} accessibilityLabel={`Notifications, ${unread} non lues`} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Feather name="bell" size={20} color="#fff" />
              {unread > 0 && <View style={{ position: "absolute", top: 9, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: c.ochre, borderWidth: 2, borderColor: c.hero }} />}
            </Pressable>
          )}
        </View>

        <Txt style={{ marginTop: 24, color: "#fff", fontFamily: font.display, fontSize: 28, lineHeight: 32 }}>
          {isAuthenticated ? `${greeting()}, ${user.prenom || user.nom}.` : "Que voulez-vous lire aujourd'hui ?"}
        </Txt>
        {stats && (
          <Txt v="small" style={{ color: "rgba(255,255,255,0.82)", marginTop: 6 }}>
            {stats.total_documents} ouvrages, {stats.copies_disponibles} exemplaires disponibles en rayon.
          </Txt>
        )}

        <View style={{ marginTop: 20, justifyContent: "center" }}>
          <Feather name="search" size={19} color={c.muted} style={{ position: "absolute", left: 16, zIndex: 1 }} />
          <TextInput
            value={q}
            onChangeText={setQ}
            onSubmitEditing={search}
            returnKeyType="search"
            placeholder="Titre, auteur, ISBN, mot-clé…"
            placeholderTextColor={c.muted}
            accessibilityLabel="Rechercher dans le catalogue"
            style={{ backgroundColor: c.surface, color: c.ink, borderRadius: 16, paddingLeft: 46, paddingRight: 16, paddingVertical: 14, fontFamily: font.regular, fontSize: 15 }}
          />
        </View>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        {pickup.length > 0 && (
          <Pressable onPress={() => router.push({ pathname: "/prets", params: { onglet: "reservations" } })} style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: alpha(c.ok, 0.12) }}>
            <BookCover book={pickup[0]} size="sm" />
            <View style={{ flex: 1 }}>
              <Txt v="strong" color={c.ok}>{pickup.length > 1 ? `${pickup.length} réservations vous attendent` : "Votre réservation vous attend"}</Txt>
              <Txt v="small" numberOfLines={1}>{pickup[0].titre}, à retirer à l'accueil</Txt>
            </View>
            <Feather name="chevron-right" size={20} color={c.ok} />
          </Pressable>
        )}

        {isAuthenticated && loans.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <SectionTitle title="Mes prêts" action="Tout voir" onAction={() => router.push("/prets")} />
            <Card>
              {loans.slice(0, 3).map((l, i) => (
                <View key={l.id}>
                  {i > 0 && <Divider />}
                  <Pressable onPress={() => router.push("/prets")} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
                    <DueBadge date={l.date_retour_prevue} />
                    <View style={{ flex: 1 }}>
                      <Txt v="strong" numberOfLines={1}>{l.titre}</Txt>
                      <Txt v="small" color={daysUntil(l.date_retour_prevue) < 0 ? c.late : c.muted}>{dueLabel(l.date_retour_prevue)}</Txt>
                    </View>
                  </Pressable>
                </View>
              ))}
            </Card>
          </View>
        )}

        <View style={{ marginTop: 28 }}>
          <SectionTitle title="Arrivés récemment" action="Catalogue" onAction={() => router.push("/catalogue")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingBottom: 6 }}>
            {(pub.data?.recent || [1, 2, 3, 4]).map((b) =>
              typeof b === "number" ? (
                <View key={b} style={{ width: 96, height: 144, borderRadius: 8, backgroundColor: alpha(c.ink, 0.06) }} />
              ) : (
                <Pressable key={b.id} onPress={() => router.push(`/livre/${b.id}`)} style={{ width: 96 }} accessibilityLabel={`${b.titre}, ${b.auteur}`}>
                  <BookCover book={b} size="md" />
                  <Txt v="smallStrong" numberOfLines={2} style={{ marginTop: 8 }}>{b.titre}</Txt>
                  <Txt v="tiny" muted numberOfLines={1}>{b.auteur}</Txt>
                </Pressable>
              )
            )}
          </ScrollView>
        </View>

        {pub.data?.cats?.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <SectionTitle title="Parcourir par domaine" />
            <Card>
              {pub.data.cats.map((cat, i) => (
                <View key={cat.id}>
                  {i > 0 && <Divider />}
                  <Pressable onPress={() => router.push({ pathname: "/catalogue", params: { categorie: cat.nom } })} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 }}>
                    <Txt style={{ flex: 1 }}>{cat.nom}</Txt>
                    <Feather name="chevron-right" size={18} color={c.muted} />
                  </Pressable>
                </View>
              ))}
            </Card>
          </View>
        )}

        <Pressable onPress={() => router.push("/memoires")} style={{ marginTop: 24, flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, backgroundColor: c.ink }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: alpha(c.paper, 0.12), alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="school-outline" size={24} color={c.paper} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="strong" color={c.paper}>Mémoires et thèses de l'IUA</Txt>
            <Txt v="small" color={alpha(c.paper, 0.72)}>{stats ? `${stats.total_memoires} travaux soutenus à lire en ligne` : "Travaux soutenus à lire en ligne"}</Txt>
          </View>
          <Feather name="chevron-right" size={20} color={c.paper} />
        </Pressable>

        {!isAuthenticated && (
          <Card style={{ marginTop: 20, padding: 20 }}>
            <Txt v="strong">Empruntez depuis votre téléphone</Txt>
            <Txt v="small" muted style={{ marginTop: 4 }}>Connectez-vous pour demander un livre, réserver un exemplaire et recevoir un rappel avant chaque date de retour.</Txt>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <Btn title="Se connecter" onPress={() => router.push("/connexion")} style={{ flex: 1 }} />
              <Btn title="Créer un compte" kind="quiet" onPress={() => router.push("/inscription")} style={{ flex: 1 }} />
            </View>
          </Card>
        )}
        {pub.error ? <Txt v="small" color={c.late} style={{ marginTop: 16 }}>{pub.error}</Txt> : null}
      </View>
    </ScrollView>
  );
}

function SectionTitle({ title, action, onAction }) {
  const { c } = useApp();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
      <Txt v="title">{title}</Txt>
      {action && (
        <Txt v="smallStrong" color={c.brand} onPress={onAction} accessibilityRole="link">
          {action}
        </Txt>
      )}
    </View>
  );
}
