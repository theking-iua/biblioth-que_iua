import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import api from "../services/api";
import BookRow from "../components/BookRow";
import { ScreenHeader, Loading, Empty, ErrorBox, toast } from "../components/ui";

export default function FavoritesPage() {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    api.getFavorites().then(setList).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const remove = async (id) => {
    try {
      await api.removeFavorite(null, id);
      setList((l) => l.filter((x) => x.id !== id));
      toast("Retiré de vos favoris");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <div>
      <ScreenHeader title="Mes favoris" />
      <div className="px-4">
        {error ? (
          <ErrorBox message={error} onRetry={load} />
        ) : !list ? (
          <Loading />
        ) : list.length === 0 ? (
          <Empty
            icon={Heart}
            title="Aucun favori"
            text="Touchez le cœur sur la fiche d'un livre pour le retrouver ici."
            action={<Link to="/catalogue" className="btn-primary">Parcourir le catalogue</Link>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((b) => (
              <li key={b.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0"><BookRow book={b} /></div>
                <button onClick={() => remove(b.id)} className="w-10 h-10 grid place-items-center shrink-0" aria-label={`Retirer ${b.titre} des favoris`}>
                  <Heart size={20} className="fill-late text-late" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
