import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Heart, MapPin, Share2, CheckCircle2, Clock, BookOpen, ExternalLink } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import BookCover from "../components/BookCover";
import { Availability } from "../components/BookRow";
import { ScreenHeader, Loading, ErrorBox, toast } from "../components/ui";
import { TYPE_LABELS, dueLabel, shortDate } from "../lib/format";

function Fact({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="text-sm font-medium text-right">{value}</dd>
    </div>
  );
}

export default function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [book, setBook] = useState(null);
  const [error, setError] = useState("");
  const [mine, setMine] = useState({ loan: null, request: null, reservation: null, favorite: false });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError("");
    try {
      const b = await api.getDocumentById(id);
      setBook(b);
      if (isAuthenticated) {
        const [loans, reqs, res, favs] = await Promise.all([
          api.getLoans(), api.getBorrowRequests(), api.getReservations(), api.getFavorites(),
        ]);
        const docId = Number(id);
        setMine({
          loan: loans.find((l) => l.document_id === docId && l.statut !== "retourne") || null,
          request: reqs.find((r) => r.document_id === docId && r.statut === "en_attente") || null,
          reservation: res.find((r) => r.document_id === docId && ["en_attente", "disponible"].includes(r.statut)) || null,
          favorite: favs.some((f) => f.id === docId),
        });
      }
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, [id, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const needLogin = () => {
    navigate(`/connexion?suite=${encodeURIComponent(`/livre/${id}`)}`);
  };

  const run = async (fn, okMsg) => {
    if (!isAuthenticated) return needLogin();
    setBusy(true);
    try {
      const out = await fn();
      toast(typeof okMsg === "function" ? okMsg(out) : okMsg);
      await load();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = () =>
    run(
      () => (mine.favorite ? api.removeFavorite(null, book.id) : api.addFavorite(null, book.id)),
      mine.favorite ? "Retiré de vos favoris" : "Ajouté à vos favoris"
    );

  const share = async () => {
    const data = { title: book.titre, text: `${book.titre}, ${book.auteur} (Bibliothèque IUA)`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        toast("Lien copié", "info");
      }
    } catch { /* partage annulé */ }
  };

  if (error) return (<><ScreenHeader title="Ouvrage" /><ErrorBox message={error} onRetry={load} /></>);
  if (!book) return (<><ScreenHeader title="" /><Loading /></>);

  const available = Number(book.copies_disponibles) > 0;
  const queue = book.reservations?.length || 0;

  // Action principale selon la situation du lecteur
  let action;
  if (mine.loan) {
    action = (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-brand/10 text-brand">
        <BookOpen size={20} />
        <div>
          <p className="font-semibold">Vous avez ce livre</p>
          <p className="text-sm text-ink/80">{dueLabel(mine.loan.date_retour_prevue)} ({shortDate(mine.loan.date_retour_prevue)})</p>
        </div>
      </div>
    );
  } else if (mine.request) {
    action = (
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-ochre/10 text-ochre">
        <Clock size={20} />
        <div>
          <p className="font-semibold">Demande envoyée</p>
          <p className="text-sm text-ink/80">La bibliothèque doit la valider. Vous serez prévenu.</p>
        </div>
      </div>
    );
  } else if (mine.reservation) {
    action =
      mine.reservation.statut === "disponible" ? (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-ok/10 text-ok">
          <CheckCircle2 size={20} />
          <div>
            <p className="font-semibold">Un exemplaire vous attend</p>
            <p className="text-sm text-ink/80">À retirer à l'accueil avant le {shortDate(mine.reservation.date_expiration)}.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-ink/5">
          <Clock size={20} className="text-muted" />
          <div>
            <p className="font-semibold">Réservé</p>
            <p className="text-sm text-muted">Vous êtes en position {mine.reservation.rang_file} dans la file d'attente.</p>
          </div>
        </div>
      );
  } else if (available) {
    action = (
      <button
        disabled={busy}
        onClick={() => run(() => api.createBorrowRequest({ document_id: book.id }), "Demande envoyée. Vous serez prévenu dès qu'elle est validée.")}
        className="btn-primary w-full py-3.5"
      >
        Demander l'emprunt
      </button>
    );
  } else if (Number(book.total_copies) > 0) {
    action = (
      <div className="space-y-2">
        <button
          disabled={busy}
          onClick={() => run(() => api.createReservation({ document_id: book.id }), (o) => `Réservation enregistrée : vous êtes en position ${o.rang}.`)}
          className="btn-primary w-full py-3.5"
        >
          Réserver
        </button>
        <p className="text-center text-sm text-muted">
          {queue === 0 ? "Personne n'attend : vous serez le premier prévenu." : `${queue} lecteur${queue > 1 ? "s" : ""} déjà dans la file.`}
        </p>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <ScreenHeader
        title=""
        right={
          <div className="flex">
            <button onClick={share} className="w-10 h-10 grid place-items-center rounded-full active:bg-ink/5" aria-label="Partager">
              <Share2 size={20} />
            </button>
            <button onClick={toggleFavorite} className="w-10 h-10 grid place-items-center rounded-full active:bg-ink/5" aria-label={mine.favorite ? "Retirer des favoris" : "Ajouter aux favoris"} aria-pressed={mine.favorite}>
              <Heart size={21} className={mine.favorite ? "fill-late text-late" : ""} />
            </button>
          </div>
        }
      />

      <div className="px-5">
        <div className="flex gap-5 items-end">
          <BookCover book={book} size="lg" />
          <div className="pb-1 min-w-0">
            {book.type_document !== "livre" && <p className="text-sm font-semibold text-brand mb-1">{TYPE_LABELS[book.type_document]}</p>}
            <h1 className="text-[22px] font-bold leading-tight">{book.titre}</h1>
            <p className="mt-1 text-muted">{book.auteur}</p>
            <Availability book={book} className="mt-3" />
          </div>
        </div>

        <div className="mt-6">{action}</div>

        {book.fichier_numerique && (
          <a href={api.getFileUrl(book.fichier_numerique)} target="_blank" rel="noopener noreferrer" className="btn-quiet w-full mt-3">
            <ExternalLink size={18} /> Ouvrir la version numérique
          </a>
        )}

        {book.localisation && (
          <div className="mt-5 flex items-center gap-3 p-4 rounded-2xl bg-surface border border-line">
            <MapPin size={20} className="text-brand shrink-0" />
            <div>
              <p className="text-sm text-muted">Emplacement</p>
              <p className="font-semibold">
                {book.localisation}
                {book.cote ? `, cote ${book.cote}` : ""}
              </p>
            </div>
          </div>
        )}

        {book.resume && (
          <section className="mt-6">
            <h2 className="font-semibold mb-1.5">Résumé</h2>
            <p className="text-[15px] leading-relaxed text-ink/90">{book.resume}</p>
          </section>
        )}

        {book.mots_cles && (
          <div className="mt-4 flex flex-wrap gap-2">
            {book.mots_cles.split(",").map((k) => k.trim()).filter(Boolean).map((k) => (
              <Link key={k} to={`/catalogue?q=${encodeURIComponent(k)}`} className="px-3 py-1 rounded-full bg-ink/5 text-sm">
                {k}
              </Link>
            ))}
          </div>
        )}

        <section className="mt-6">
          <h2 className="font-semibold mb-1">Détails</h2>
          <dl className="divide-y divide-line">
            <Fact label="Éditeur" value={book.editeur} />
            <Fact label="Année" value={book.annee} />
            <Fact label="Langue" value={book.langue} />
            <Fact label="Pages" value={book.nb_pages} />
            <Fact label="ISBN" value={book.isbn} />
            <Fact label="Domaine" value={book.categorie} />
            <Fact label="Exemplaires" value={Number(book.total_copies) > 0 ? `${book.copies_disponibles} disponible${book.copies_disponibles > 1 ? "s" : ""} sur ${book.total_copies}` : null} />
          </dl>
        </section>
      </div>
    </div>
  );
}
