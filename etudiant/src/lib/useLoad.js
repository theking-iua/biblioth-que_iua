// Chargement de données : état, erreur, « tirer pour actualiser » et rechargement quand l'écran revient au premier plan.
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  // Les états ne sont modifiés qu'une fois la réponse reçue
  const load = useCallback(
    () =>
      fnRef
        .current()
        .then((d) => {
          setData(d);
          setError("");
        })
        .catch((e) => setError(e.message))
        .finally(() => setRefreshing(false)),
    []
  );

  // Rechargement quand les dépendances changent (ex. connexion / déconnexion)
  const key = JSON.stringify(deps);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) load();
    mounted.current = true;
  }, [key, load]);

  // Rechargement à chaque retour sur l'écran (données toujours à jour)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return { data, setData, error, refreshing, reload: load, onRefresh };
}
