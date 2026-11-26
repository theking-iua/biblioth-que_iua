import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, SearchX } from "lucide-react";
import api from "../services/api";
import BookRow from "../components/BookRow";
import { Chips, Loading, Empty, ErrorBox } from "../components/ui";
import { TYPE_LABELS } from "../lib/format";

export default function CataloguePage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const categorie = params.get("categorie") || "Toutes";
  const type = params.get("type") || "Tous";
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);
  const debounce = useRef();

  useEffect(() => {
    api.getTaxonomies("categories").then((c) => setCategories(c.map((x) => x.nom))).catch(() => {});
  }, []);

  const load = () => {
    setError("");
    api
      .getDocuments({ q: params.get("q") || "", categorie, type })
      .then(setDocs)
      .catch((e) => setError(e.message));
  };
  useEffect(load, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const setParam = (key, value, def) => {
    const next = new URLSearchParams(params);
    if (!value || value === def) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const onType = (v) => {
    setQ(v);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setParam("q", v.trim()), 350);
  };

  const shown = useMemo(
    () => (docs || []).filter((d) => !onlyAvailable || Number(d.copies_disponibles) > 0),
    [docs, onlyAvailable]
  );

  return (
    <div>
      <header className="sticky top-0 z-30 bg-paper/95 backdrop-blur pt-safe border-b border-line">
        <div className="px-4 pt-4 pb-3 space-y-3">
          <h1 className="text-2xl font-bold">Catalogue</h1>
          <div className="relative" role="search">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => onType(e.target.value)}
              type="search"
              enterKeyHint="search"
              placeholder="Titre, auteur, ISBN, cote, mot-clé"
              className="field pl-10 pr-10"
              aria-label="Rechercher"
            />
            {q && (
              <button onClick={() => onType("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-muted" aria-label="Effacer">
                <X size={18} />
              </button>
            )}
          </div>
          <Chips value={categorie} onChange={(v) => setParam("categorie", v, "Toutes")} options={["Toutes", ...categories]} />
          <div className="flex items-center gap-2">
            <Chips
              value={type}
              onChange={(v) => setParam("type", v, "Tous")}
              options={[{ value: "Tous", label: "Tous types" }, ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))]}
            />
          </div>
        </div>
      </header>

      <div className="px-4">
        <div className="flex items-center justify-between py-3">
          <p className="text-sm text-muted">{docs ? `${shown.length} résultat${shown.length > 1 ? "s" : ""}` : " "}</p>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} className="w-4 h-4 accent-[rgb(var(--brand))]" />
            Disponibles seulement
          </label>
        </div>

        {error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : !docs ? (
          <Loading />
        ) : shown.length === 0 ? (
          <Empty icon={SearchX} title="Aucun ouvrage trouvé" text="Essayez un autre mot-clé ou retirez un filtre." />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((d) => (
              <li key={d.id}>
                <BookRow book={d} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
