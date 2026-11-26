import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, FileText, Download, Eye, GraduationCap } from "lucide-react";
import api from "../services/api";
import { Chips, Loading, Empty, ErrorBox, Sheet, toast } from "../components/ui";

const CYCLES = ["Tous", "Licence", "Master", "Doctorat", "Recherche"];

export default function MemoiresPage() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [cycle, setCycle] = useState("Tous");
  const [filiere, setFiliere] = useState("Toutes");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);
  const debounce = useRef();

  const load = () => {
    setError("");
    api.getDigitalResources({ q: query, cycle, filiere }).then(setItems).catch((e) => setError(e.message));
  };
  useEffect(load, [query, cycle, filiere]); // eslint-disable-line react-hooks/exhaustive-deps

  // Les filières proposées sont celles des mémoires existants
  const [allFilieres, setAllFilieres] = useState([]);
  useEffect(() => {
    api.getDigitalResources().then((all) => setAllFilieres([...new Set(all.map((m) => m.filiere))].sort())).catch(() => {});
  }, []);

  const onType = (v) => {
    setQ(v);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setQuery(v.trim()), 350);
  };

  const openMemoire = (m) => {
    setOpen(m);
  };

  const read = async (m, download = false) => {
    const url = api.getFileUrl(m.fichier_path);
    if (!url) return toast("Le PDF de ce mémoire n'est pas encore en ligne. Il est consultable à la bibliothèque.", "info");
    window.open(url, "_blank", "noopener");
    try {
      await (download ? api.incrementDigitalDownload(m.id) : api.incrementDigitalView(m.id));
    } catch { /* statistique facultative */ }
  };

  const filieres = useMemo(() => ["Toutes", ...allFilieres], [allFilieres]);

  return (
    <div>
      <header className="sticky top-0 z-30 bg-paper/95 backdrop-blur pt-safe border-b border-line">
        <div className="px-4 pt-4 pb-3 space-y-3">
          <h1 className="text-2xl font-bold">Mémoires et thèses</h1>
          <div className="relative" role="search">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => onType(e.target.value)}
              type="search"
              enterKeyHint="search"
              placeholder="Sujet, auteur, directeur, mot du texte"
              className="field pl-10 pr-10"
              aria-label="Rechercher un mémoire"
            />
            {q && (
              <button onClick={() => onType("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-muted" aria-label="Effacer">
                <X size={18} />
              </button>
            )}
          </div>
          <Chips value={cycle} onChange={setCycle} options={CYCLES.map((c) => ({ value: c, label: c === "Tous" ? "Tous cycles" : c }))} />
          {filieres.length > 2 && <Chips value={filiere} onChange={setFiliere} options={filieres} />}
        </div>
      </header>

      <div className="px-4 pt-2">
        {error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : !items ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty icon={GraduationCap} title="Aucun mémoire trouvé" text="Essayez un autre sujet ou un autre cycle." />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((m) => (
              <li key={m.id}>
                <button onClick={() => openMemoire(m)} className="w-full text-left py-4 active:bg-ink/[0.03] -mx-4 px-4 block">
                  <p className="text-xs font-semibold text-brand">
                    {m.cycle}, {m.annee_academique}
                  </p>
                  <p className="mt-1 font-semibold leading-snug line-clamp-3">{m.titre}</p>
                  <p className="mt-1 text-sm text-muted truncate">{m.auteur}</p>
                  <p className="mt-0.5 text-sm text-muted truncate">{m.filiere}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title="Mémoire">
        {open && (
          <div>
            <p className="text-sm font-semibold text-brand">
              {open.cycle}, {open.filiere}
            </p>
            <h3 className="mt-1 text-xl font-bold leading-snug">{open.titre}</h3>
            <dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted">Auteur</dt><dd className="font-medium">{open.auteur}</dd>
              {open.directeur_recherche && (<><dt className="text-muted">Directeur</dt><dd className="font-medium">{open.directeur_recherche}</dd></>)}
              <dt className="text-muted">Soutenance</dt><dd className="font-medium">{open.session_soutenance || open.annee_academique}</dd>
              {open.note_mention && (<><dt className="text-muted">Mention</dt><dd className="font-medium">{open.note_mention}</dd></>)}
              <dt className="text-muted">Consultations</dt><dd className="font-medium tabular-nums">{open.nb_vues}</dd>
            </dl>
            {open.resume && <p className="mt-4 text-[15px] leading-relaxed">{open.resume}</p>}
            {open.mots_cles && <p className="mt-3 text-sm text-muted">Mots-clés : {open.mots_cles}</p>}

            <div className="mt-6 grid gap-2">
              {open.fichier_path ? (
                <>
                  <button onClick={() => read(open)} className="btn-primary"><Eye size={18} /> Lire le PDF</button>
                  {Number(open.telechargeable) === 1 && (
                    <button onClick={() => read(open, true)} className="btn-quiet"><Download size={18} /> Télécharger</button>
                  )}
                </>
              ) : (
                <div className="flex gap-3 p-4 rounded-2xl bg-ink/5 text-sm">
                  <FileText size={20} className="text-muted shrink-0" />
                  <p>La version PDF n'est pas encore en ligne. L'exemplaire papier est consultable sur place, à la bibliothèque.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
