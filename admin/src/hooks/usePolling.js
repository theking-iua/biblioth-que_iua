import { useEffect, useRef } from "react";

/**
 * Hook de polling réutilisable.
 * Lance callback() immédiatement, puis toutes les intervalMs ms.
 * Se nettoie automatiquement au démontage du composant.
 *
 * @param {Function} callback - Fonction async à appeler
 * @param {number} intervalMs - Intervalle en millisecondes
 * @param {boolean} enabled - Si false, le polling est mis en pause
 */
export default function usePolling(callback, intervalMs = 30000, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    // Appel immédiat
    callbackRef.current();

    const id = setInterval(() => {
      callbackRef.current();
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
