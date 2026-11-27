import React, { useState } from "react";
import { View, Pressable, Share, RefreshControl, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { Txt, Header, IconBtn, Btn, Screen, Loading, ErrorBox, Card, Divider, toast } from "../../components/ui";
import { BookCover, Availability } from "../../components/Books";
import { TYPE_LABELS, dueLabel, shortDate } from "../../lib/format";
import { alpha } from "../../lib/theme";

function Fact({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 10 }}>
      <Txt v="small" muted>{label}</Txt>
      <Txt v="smallStrong" style={{ flexShrink: 1, textAlign: "right" }}>{String(value)}</Txt>
    </View>
  );
}

function Status({ icon, tone, title, text }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, padding: 16, borderRadius: 16, backgroundColor: alpha(tone, 0.12) }}>
      <Feather name={icon} size={20} color={tone} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Txt v="strong" color={tone}>{title}</Txt>
        <Txt v="small" style={{ marginTop: 2 }}>{text}</Txt>
      </View>
    </View>
  );
}

export default function BookDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { c, isAuthenticated } = useApp();
  const [busy, setBusy] = useState(false);

  const { data, error, reload, refreshing, onRefresh } = useLoad(async () => {
    const book = await api.document(id);
    const docId = Number(id);
    let mine = { loan: null, request: null, reservation: null, favorite: false };
    if (isAuthenticated) {
      const [loans, reqs, res, favs] = await Promise.all([api.loans(), api.requests(), api.reservations(), api.favorites()]);
      mine = {
        loan: loans.find((l) => l.document_id === docId && l.statut !== "retourne") || null,
        request: reqs.find((r) => r.document_id === docId && r.statut === "en_attente") || null,
        reservation: res.find((r) => r.document_id === docId && ["en_attente", "disponible"].includes(r.statut)) || null,
        favorite: favs.some((f) => f.id === docId),
      };
    }
    return { book, mine };
  }, [id, isAuthenticated]);

  const needLogin = () => router.push({ pathname: "/connexion", params: { suite: `/livre/${id}` } });

  const run = async (fn, okMsg) => {
    if (!isAuthenticated) return needLogin();
    setBusy(true);
    try {
      const out = await fn();
      toast(typeof okMsg === "function" ? okMsg(out) : okMsg);
      await reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return (<View style={{ flex: 1, backgroundColor: c.paper }}><Header title="Ouvrage" /><ErrorBox message={error} onRetry={reload} /></View>);
  if (!data) return (<View style={{ flex: 1, backgroundColor: c.paper }}><Header title="" /><Loading /></View>);

  const { book, mine } = data;
  const available = Number(book.copies_disponibles) > 0;
  const queue = book.reservations?.length || 0;

  let action = null;
  if (mine.loan) {
    action = <Status icon="book-open" tone={c.brand} title="Vous avez ce livre" text={`${dueLabel(mine.loan.date_retour_prevue)} (${shortDate(mine.loan.date_retour_prevue)})`} />;
  } else if (mine.request) {
    action = <Status icon="clock" tone={c.ochre} title="Demande envoyée" text="La bibliothèque doit la valider. Vous serez prévenu." />;
  } else if (mine.reservation) {
    action =
      mine.reservation.statut === "disponible" ? (
        <Status icon="check-circle" tone={c.ok} title="Un exemplaire vous attend" text={`À retirer à l'accueil avant le ${shortDate(mine.reservation.date_expiration)}.`} />
      ) : (
        <Status icon="clock" tone={c.muted} title="Réservé" text={`Vous êtes en position ${mine.reservation.rang_file} dans la file d'attente.`} />
      );
  } else if (available) {
    action = <Btn title="Demander l'emprunt" loading={busy} onPress={() => run(() => api.createRequest(book.id), "Demande envoyée. Vous serez prévenu dès qu'elle est validée.")} />;
  } else if (Number(book.total_copies) > 0) {
    action = (
      <View style={{ gap: 8 }}>
        <Btn title="Réserver" loading={busy} onPress={() => run(() => api.reserve(book.id), (o) => `Réservation enregistrée : vous êtes en position ${o.rang}.`)} />
        <Txt v="small" muted style={{ textAlign: "center" }}>
          {queue === 0 ? "Personne n'attend : vous serez le premier prévenu." : `${queue} lecteur${queue > 1 ? "s" : ""} déjà dans la file.`}
        </Txt>
      </View>
    );
  }

  const share = () => Share.share({ message: `${book.titre}, ${book.auteur} : disponible à la bibliothèque de l'IUA (cote ${book.cote || "n.c."}).` }).catch(() => {});
  const toggleFav = () =>
    run(() => (mine.favorite ? api.removeFavorite(book.id) : api.addFavorite(book.id)), mine.favorite ? "Retiré de vos favoris" : "Ajouté à vos favoris");

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <Header
        title=""
        right={
          <View style={{ flexDirection: "row" }}>
            <IconBtn name="share-2" label="Partager" onPress={share} />
            <Pressable onPress={toggleFav} accessibilityRole="button" accessibilityLabel={mine.favorite ? "Retirer des favoris" : "Ajouter aux favoris"} accessibilityState={{ selected: mine.favorite }} hitSlop={6} style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center" }}>
              <Feather name="heart" size={21} color={mine.favorite ? c.late : c.ink} />
              {mine.favorite && <View style={{ position: "absolute", bottom: 9, width: 5, height: 5, borderRadius: 3, backgroundColor: c.late }} />}
            </Pressable>
          </View>
        }
      />
      <Screen edges={[]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.brand]} tintColor={c.brand} />}>
        <View style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", gap: 18, alignItems: "flex-end" }}>
            <BookCover book={book} size="lg" />
            <View style={{ flex: 1, paddingBottom: 4 }}>
              {book.type_document !== "livre" && <Txt v="smallStrong" color={c.brand} style={{ marginBottom: 4 }}>{TYPE_LABELS[book.type_document]}</Txt>}
              <Txt v="h2">{book.titre}</Txt>
              <Txt muted style={{ marginTop: 4 }}>{book.auteur}</Txt>
              <Availability book={book} style={{ marginTop: 12 }} />
            </View>
          </View>

          {action && <View style={{ marginTop: 24 }}>{action}</View>}

          {!!book.fichier_numerique && (
            <Btn
              title="Ouvrir la version numérique"
              icon="external-link"
              kind="quiet"
              style={{ marginTop: 12 }}
              onPress={() => Linking.openURL(api.fileUrl(book.fichier_numerique)).catch(() => toast("Impossible d'ouvrir ce document sur ce téléphone.", "error"))}
            />
          )}

          {!!book.localisation && (
            <Card style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}>
              <Feather name="map-pin" size={20} color={c.brand} />
              <View style={{ flex: 1 }}>
                <Txt v="small" muted>Emplacement</Txt>
                <Txt v="strong">{book.localisation}{book.cote ? `, cote ${book.cote}` : ""}</Txt>
              </View>
            </Card>
          )}

          {!!book.resume && (
            <View style={{ marginTop: 24 }}>
              <Txt v="strong" style={{ marginBottom: 6 }}>Résumé</Txt>
              <Txt style={{ lineHeight: 23 }}>{book.resume}</Txt>
            </View>
          )}

          {!!book.mots_cles && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              {book.mots_cles.split(",").map((k) => k.trim()).filter(Boolean).map((k) => (
                <Pressable key={k} onPress={() => router.push({ pathname: "/catalogue", params: { q: k } })} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: alpha(c.ink, 0.06) }}>
                  <Txt v="small">{k}</Txt>
                </Pressable>
              ))}
            </View>
          )}

          <View style={{ marginTop: 24 }}>
            <Txt v="strong" style={{ marginBottom: 2 }}>Détails</Txt>
            <Fact label="Éditeur" value={book.editeur} />
            <Divider />
            <Fact label="Année" value={book.annee} />
            <Divider />
            <Fact label="Langue" value={book.langue} />
            <Divider />
            <Fact label="Pages" value={book.nb_pages} />
            <Divider />
            <Fact label="ISBN" value={book.isbn} />
            <Divider />
            <Fact label="Domaine" value={book.categorie} />
            <Divider />
            <Fact label="Exemplaires" value={Number(book.total_copies) > 0 ? `${book.copies_disponibles} disponible${book.copies_disponibles > 1 ? "s" : ""} sur ${book.total_copies}` : null} />
          </View>
        </View>
      </Screen>
    </View>
  );
}
