import React, { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import api from "../services/api";
import usePolling from "../hooks/usePolling";
import { showToast } from "../components/common/Toast";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { isStaff, isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState({
    demandes_en_attente: 0,
    retards_critiques: 0,
    reservations_actives: 0,
    emprunts_en_cours: 0,
    nouvelles_demandes: 0,
    last_events: [],
  });
  const [prevDemandes, setPrevDemandes] = useState(null);

  const fetchAlerts = useCallback(async () => {
    if (!isStaff || !isAuthenticated) return;
    try {
      const data = await api.getRealtimeAlerts();
      setAlerts(data);

      // Toast si une nouvelle demande est arrivée depuis la dernière vérification
      if (prevDemandes !== null && data.demandes_en_attente > prevDemandes) {
        const diff = data.demandes_en_attente - prevDemandes;
        showToast(
          `📥 ${diff} nouvelle${diff > 1 ? "s" : ""} demande${diff > 1 ? "s" : ""} d'emprunt en attente !`,
          "info"
        );
      }
      setPrevDemandes(data.demandes_en_attente);
    } catch (e) {
      // Silencieux — le polling doit être robuste
    }
  }, [isStaff, isAuthenticated, prevDemandes]);

  // Polling toutes les 30 secondes pour le staff uniquement
  usePolling(fetchAlerts, 30000, isStaff && isAuthenticated);

  return (
    <NotificationContext.Provider value={{ alerts, refreshAlerts: fetchAlerts }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
}
