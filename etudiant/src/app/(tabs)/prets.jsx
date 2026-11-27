import React, { useState } from "react";
import { View, Pressable, RefreshControl, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useApp } from "../../context/AppContext";
import { api } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { syncReminders } from "../../lib/reminders";
import { Txt, Segmented, Loading, Empty, ErrorBox, Divider, Btn, toast } from "../../components/ui";
import { BookCover } from "../../components/Books";
import { daysUntil, dueLabel, shortDate, longDate, dateTime } from "../../lib/format";

const REQ = {
  en_attente: ["En attente de validation", "ochre"],
  validee: ["Validée, à retirer à l'accueil", "ok"],
  refusee: ["Refusée", "late"],
};

function Row({ doc, children }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: "row", gap: 16, paddingVertical: 16, paddingHorizontal: 16 }}>
      <Pressable onPress={() => router.push(`/livre/${doc.document_id}`)} accessibilityLabel={`Fiche de ${doc.titre}`}>
        <BookCover book={doc} size="sm" />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Txt v="strong" numberOfLines={2} onPress={() => router.push(`/livre/${doc.document_id}`)}>{doc.titre}</Txt>
        <Txt v="small" muted numberOfLines={1}>{doc.auteur}</Txt>
        {children}
      </View>
    </View>
  );
}

function Action({ label, onPress, busy, color, icon, disabled }) {
  const { c } = useApp();
  const tone = disabled ? c.muted : color || c.brand;
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} hitSlop={8} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start" }}>
      {busy ? <ActivityIndicator size="small" color={tone} /> : icon ? <Feather name={icon} size={15} color={tone} /> : null}
      <Txt v="smallStrong" color={tone}>{label}</Txt>
    </Pressable>
  );
}

export default function Prets() {
  const { c, isAuthenticated, refreshUnread } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [tab, setTab] = useState(params.onglet || "en-cours");
  const [busy, setBusy] = useState(null);
  // Onglet demandé depuis l'accueil (« Votre réservation vous attend »)
  const [seenTab, setSeenTab] = useState(params.onglet);
  if (params.onglet !== seenTab) {
    setSeenTab(params.onglet);
    if (params.onglet) setTab(params.onglet);
  }

  const { data, error, refreshing, onRefresh, reload } = useLoad(async () => {
    if (!isAuthenticated) return null;
    const [loans, requests, reservations, rules] = await Promise.all([api.loans(), api.requests(), api.reservations(), api.settings()]);
    syncReminders(loans);
    return { loans, requests, reservations, rules };
  }, [isAuthenticated]);

  const act = async (key, fn, msg) => {
    setBusy(key);
    try {
      const out = await fn();
      toast(typeof msg === "function" ? msg(out) : msg);
      await reload();
      refreshUnread();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const title = (
    <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.line, gap: 12 }}>
      <Txt v="h2">Mes prêts</Txt>
      {data && (
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "en-cours", label: "En cours", count: data.loans.filter((l) => l.statut !== "retourne").length },
            { value: "demandes", label: "Demandes", count: data.requests.filter((r) => r.statut === "en_attente").length },
            { value: "reservations", label: "Réservations", count: data.reservations.filter((r) => ["en_attente", "disponible"].includes(r.statut)).length },
            { value: "historique", label: "Rendus" },
          ]}
        />
      )}
    </View>
  );

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        {title}
        <Empty icon="bookmark" title="Connectez-vous pour voir vos prêts" text="Vos emprunts, demandes et réservations apparaîtront ici, avec un rappel avant chaque date de retour.">
          <Btn title="Se connecter" onPress={() => router.push({ pathname: "/connexion", params: { suite: "/prets" } })} style={{ width: 220 }} />
        </Empty>
      </View>
    );
  }
  if (error) return (<View style={{ flex: 1, backgroundColor: c.paper }}>{title}<ErrorBox message={error} onRetry={reload} /></View>);
  if (!data) return (<View style={{ flex: 1, backgroundColor: c.paper }}>{title}<Loading /></View>);

  const rules = data.rules || {};
  const maxRenew = Number(rules.max_renouvellements ?? 2);
  const active = data.loans.filter((l) => l.statut !== "retourne").sort((a, b) => a.date_retour_prevue.localeCompare(b.date_retour_prevue));
  const past = data.loans.filter((l) => l.statut === "retourne");
  const reservations = data.reservations.filter((r) => ["en_attente", "disponible"].includes(r.statut));

  let body;
  if (tab === "en-cours") {
    body = active.length === 0 ? (
      <Empty icon="bookmark" title="Aucun livre emprunté" text={`Vous pouvez emprunter jusqu'à ${rules.max_emprunts_simultanes || 3} documents pendant ${rules.duree_pret_jours || 14} jours.`}>
        <Btn title="Chercher un livre" onPress={() => router.push("/catalogue")} style={{ width: 220 }} />
      </Empty>
    ) : (
      active.map((l, i) => {
        const n = daysUntil(l.date_retour_prevue);
        const late = l.statut === "en_retard" || n < 0;
        const canRenew = !late && l.statut === "en_cours" && l.renouvellements_count < maxRenew;
        return (
          <View key={l.id}>
            {i > 0 && <Divider inset={16} />}
            <Row doc={l}>
              <Txt v="smallStrong" color={late ? c.late : n <= 3 ? c.ochre : c.ink} style={{ marginTop: 8 }}>{dueLabel(l.date_retour_prevue)}</Txt>
              <Txt v="tiny" muted style={{ fontSize: 12 }}>Retour prévu le {longDate(l.date_retour_prevue)}</Txt>
              {late ? (
                <Txt v="tiny" color={c.late} style={{ marginTop: 8, fontSize: 12 }}>Rapportez ce livre à l'accueil : les retards bloquent les nouveaux emprunts.</Txt>
              ) : (
                <Action
                  icon="refresh-cw"
                  disabled={!canRenew}
                  busy={busy === `r${l.id}`}
                  label={canRenew ? `Prolonger de ${rules.jours_prolongation || 7} jours (${l.renouvellements_count}/${maxRenew})` : "Prolongations épuisées"}
                  onPress={() => act(`r${l.id}`, () => api.renew(l.id), (o) => `Prolongé jusqu'au ${longDate(o.new_date_retour)}.`)}
                />
              )}
            </Row>
          </View>
        );
      })
    );
  } else if (tab === "demandes") {
    body = data.requests.length === 0 ? (
      <Empty icon="inbox" title="Aucune demande" text="Depuis la fiche d'un livre disponible, touchez « Demander l'emprunt »." />
    ) : (
      data.requests.map((r, i) => {
        const [label, tone] = REQ[r.statut] || [r.statut, "muted"];
        return (
          <View key={r.id}>
            {i > 0 && <Divider inset={16} />}
            <Row doc={r}>
              <Txt v="smallStrong" color={c[tone]} style={{ marginTop: 8 }}>{label}</Txt>
              <Txt v="tiny" muted style={{ fontSize: 12 }}>Envoyée le {dateTime(r.date_demande)}</Txt>
              {r.statut === "refusee" && !!r.motif_refus && <Txt v="tiny" style={{ marginTop: 4, fontSize: 12 }}>Motif : {r.motif_refus}</Txt>}
              {r.statut === "en_attente" && (
                <Action label="Annuler la demande" color={c.late} busy={busy === `d${r.id}`} onPress={() => act(`d${r.id}`, () => api.cancelRequest(r.id), "Demande annulée")} />
              )}
            </Row>
          </View>
        );
      })
    );
  } else if (tab === "reservations") {
    body = reservations.length === 0 ? (
      <Empty icon="clock" title="Aucune réservation" text="Quand tous les exemplaires d'un livre sont empruntés, réservez-le : vous serez prévenu à son retour." />
    ) : (
      reservations.map((r, i) => (
        <View key={r.id}>
          {i > 0 && <Divider inset={16} />}
          <Row doc={r}>
            {r.statut === "disponible" ? (
              <>
                <Txt v="smallStrong" color={c.ok} style={{ marginTop: 8 }}>Disponible, vous attend à l'accueil</Txt>
                <Txt v="tiny" muted style={{ fontSize: 12 }}>À retirer avant le {dateTime(r.date_expiration)}</Txt>
              </>
            ) : (
              <>
                <Txt v="smallStrong" style={{ marginTop: 8 }}>Position {r.rang_file} dans la file</Txt>
                <Txt v="tiny" muted style={{ fontSize: 12 }}>Réservé le {shortDate(r.date_reservation)}</Txt>
              </>
            )}
            <Action label="Annuler la réservation" color={c.late} busy={busy === `c${r.id}`} onPress={() => act(`c${r.id}`, () => api.cancelReservation(r.id), "Réservation annulée")} />
          </Row>
        </View>
      ))
    );
  } else {
    body = past.length === 0 ? (
      <Empty icon="rotate-ccw" title="Pas encore d'historique" text="Les livres que vous avez rendus apparaîtront ici." />
    ) : (
      past.map((l, i) => (
        <View key={l.id}>
          {i > 0 && <Divider inset={16} />}
          <Row doc={l}>
            <Txt v="tiny" muted style={{ marginTop: 8, fontSize: 12 }}>Emprunté le {shortDate(l.date_emprunt)}, rendu le {shortDate(l.date_retour_reelle)}</Txt>
          </Row>
        </View>
      ))
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      {title}
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.brand]} tintColor={c.brand} />} contentContainerStyle={{ paddingBottom: 24 }}>
        {body}
      </ScrollView>
    </View>
  );
}
