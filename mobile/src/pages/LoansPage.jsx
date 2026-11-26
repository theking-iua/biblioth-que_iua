import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookMarked, Inbox, Clock, History, RefreshCw } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import BookCover from "../components/BookCover";
import { Segmented, Loading, Empty, ErrorBox, toast } from "../components/ui";
import { daysUntil, dueLabel, shortDate, longDate, dateTime } from "../lib/format";

const REQ_STATUS = {
  en_attente: { label: "En attente de validation", tone: "text-ochre" },
  validee: { label: "Validée, à retirer à l'accueil", tone: "text-ok" },
  refusee: { label: "Refusée", tone: "text-late" },
};

function Row({ doc, children, to }) {
  return (
    <li className="flex gap-4 py-4">
      <Link to={to || `/livre/${doc.document_id}`} className="shrink-0">
        <BookCover book={doc} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={to || `/livre/${doc.document_id}`} className="font-semibold leading-snug line-clamp-2">{doc.titre}</Link>
        <p className="text-sm text-muted truncate">{doc.auteur}</p>
        {children}
      </div>
    </li>
  );
}

export default function LoansPage() {
  const { refreshUnread } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("onglet") || "en-cours";
  const setTab = (t) => setParams(t === "en-cours" ? {} : { onglet: t }, { replace: true });

  const [data, setData] = useState(null);
  const [rules, setRules] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setError("");
    try {
      const [loans, requests, reservations, settings] = await Promise.all([
        api.getLoans(), api.getBorrowRequests(), api.getReservations(), api.getSettings(),
      ]);
      setData({ loans, requests, reservations });
      setRules(settings);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const act = async (key, fn, msg) => {
    setBusy(key);
    try {
      const out = await fn();
      toast(typeof msg === "function" ? msg(out) : msg);
      await load();
      refreshUnread();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(null);
    }
  };

  if (error) return (<><Header /><ErrorBox message={error} onRetry={load} /></>);
  if (!data) return (<><Header /><Loading /></>);

  const active = data.loans.filter((l) => l.statut !== "retourne").sort((a, b) => a.date_retour_prevue.localeCompare(b.date_retour_prevue));
  const past = data.loans.filter((l) => l.statut === "retourne");
  const requests = data.requests;
  const pendingReq = requests.filter((r) => r.statut === "en_attente").length;
  const reservations = data.reservations.filter((r) => ["en_attente", "disponible"].includes(r.statut));
  const maxRenew = Number(rules.max_renouvellements ?? 2);

  return (
    <div>
      <Header>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "en-cours", label: "En cours", count: active.length },
            { value: "demandes", label: "Demandes", count: pendingReq },
            { value: "reservations", label: "Réservations", count: reservations.length },
            { value: "historique", label: "Historique" },
          ]}
        />
      </Header>

      <div className="px-4">
        {tab === "en-cours" &&
          (active.length === 0 ? (
            <Empty
              icon={BookMarked}
              title="Aucun livre emprunté"
              text={`Vous pouvez emprunter jusqu'à ${rules.max_emprunts_simultanes || 3} documents pendant ${rules.duree_pret_jours || 14} jours.`}
              action={<Link to="/catalogue" className="btn-primary">Chercher un livre</Link>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {active.map((l) => {
                const n = daysUntil(l.date_retour_prevue);
                const late = l.statut === "en_retard" || n < 0;
                const canRenew = !late && l.statut === "en_cours" && l.renouvellements_count < maxRenew;
                return (
                  <Row key={l.id} doc={l}>
                    <p className={`mt-2 text-sm font-semibold ${late ? "text-late" : n <= 3 ? "text-ochre" : "text-ink"}`}>{dueLabel(l.date_retour_prevue)}</p>
                    <p className="text-xs text-muted">Retour prévu le {longDate(l.date_retour_prevue)}</p>
                    {late ? (
                      <p className="mt-2 text-xs text-late">Rapportez ce livre à l'accueil : les retards bloquent les nouveaux emprunts.</p>
                    ) : (
                      <button
                        disabled={!canRenew || busy === `r${l.id}`}
                        onClick={() => act(`r${l.id}`, () => api.renewLoan(l.id), (o) => `Prolongé jusqu'au ${longDate(o.new_date_retour)}.`)}
                        className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand disabled:text-muted"
                      >
                        <RefreshCw size={15} className={busy === `r${l.id}` ? "animate-spin" : ""} />
                        {canRenew
                          ? `Prolonger de ${rules.jours_prolongation || 7} jours (${l.renouvellements_count}/${maxRenew})`
                          : "Prolongations épuisées"}
                      </button>
                    )}
                  </Row>
                );
              })}
            </ul>
          ))}

        {tab === "demandes" &&
          (requests.length === 0 ? (
            <Empty icon={Inbox} title="Aucune demande" text="Depuis la fiche d'un livre disponible, touchez « Demander l'emprunt »." />
          ) : (
            <ul className="divide-y divide-line">
              {requests.map((r) => {
                const st = REQ_STATUS[r.statut];
                return (
                  <Row key={r.id} doc={r}>
                    <p className={`mt-2 text-sm font-semibold ${st.tone}`}>{st.label}</p>
                    <p className="text-xs text-muted">Envoyée {dateTime(r.date_demande)}</p>
                    {r.statut === "refusee" && r.motif_refus && <p className="mt-1 text-xs">Motif : {r.motif_refus}</p>}
                    {r.statut === "en_attente" && (
                      <button
                        disabled={busy === `d${r.id}`}
                        onClick={() => act(`d${r.id}`, () => api.cancelBorrowRequest(r.id), "Demande annulée")}
                        className="mt-2 text-sm font-semibold text-late"
                      >
                        Annuler la demande
                      </button>
                    )}
                  </Row>
                );
              })}
            </ul>
          ))}

        {tab === "reservations" &&
          (reservations.length === 0 ? (
            <Empty icon={Clock} title="Aucune réservation" text="Quand tous les exemplaires d'un livre sont empruntés, réservez-le : vous serez prévenu à son retour." />
          ) : (
            <ul className="divide-y divide-line">
              {reservations.map((r) => (
                <Row key={r.id} doc={r}>
                  {r.statut === "disponible" ? (
                    <>
                      <p className="mt-2 text-sm font-semibold text-ok">Disponible, vous attend à l'accueil</p>
                      <p className="text-xs text-muted">À retirer avant le {dateTime(r.date_expiration)}</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-sm font-semibold">Position {r.rang_file} dans la file</p>
                      <p className="text-xs text-muted">Réservé le {shortDate(r.date_reservation)}</p>
                    </>
                  )}
                  <button
                    disabled={busy === `c${r.id}`}
                    onClick={() => act(`c${r.id}`, () => api.cancelReservation(r.id), "Réservation annulée")}
                    className="mt-2 text-sm font-semibold text-late"
                  >
                    Annuler la réservation
                  </button>
                </Row>
              ))}
            </ul>
          ))}

        {tab === "historique" &&
          (past.length === 0 ? (
            <Empty icon={History} title="Pas encore d'historique" text="Les livres que vous avez rendus apparaîtront ici." />
          ) : (
            <ul className="divide-y divide-line">
              {past.map((l) => (
                <Row key={l.id} doc={l}>
                  <p className="mt-2 text-xs text-muted">
                    Emprunté le {shortDate(l.date_emprunt)}, rendu le {shortDate(l.date_retour_reelle)}
                  </p>
                </Row>
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}

function Header({ children }) {
  return (
    <header className="sticky top-0 z-30 bg-paper/95 backdrop-blur pt-safe border-b border-line">
      <div className="px-4 pt-4 pb-3 space-y-3">
        <h1 className="text-2xl font-bold">Mes prêts</h1>
        {children}
      </div>
    </header>
  );
}
