import React, { useEffect, useState } from "react";
import { BellOff, AlertTriangle, BookMarked, Clock, Info, RefreshCw } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ScreenHeader, Loading, Empty, ErrorBox, toast } from "../components/ui";
import { relative } from "../lib/format";

const ICONS = { retard: AlertTriangle, emprunt: BookMarked, reservation: Clock, rappel: RefreshCw, info: Info, systeme: Info };
const TONES = { retard: "bg-late/10 text-late", reservation: "bg-ok/10 text-ok", rappel: "bg-ochre/10 text-ochre" };

export default function NotificationsPage() {
  const { setUnread } = useAuth();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    api
      .getNotifications()
      .then((d) => {
        setList(d.notifications);
        setUnread(d.unread_count);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markOne = async (n) => {
    if (Number(n.lu) === 1) return;
    setList((l) => l.map((x) => (x.id === n.id ? { ...x, lu: 1 } : x)));
    setUnread((u) => Math.max(0, u - 1));
    api.markNotificationRead(n.id).catch(() => {});
  };

  const markAll = async () => {
    try {
      await api.markAllNotificationsRead();
      setList((l) => l.map((x) => ({ ...x, lu: 1 })));
      setUnread(0);
      toast("Toutes les notifications sont lues");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const hasUnread = list?.some((n) => Number(n.lu) === 0);

  return (
    <div>
      <ScreenHeader
        title="Notifications"
        right={hasUnread && <button onClick={markAll} className="px-3 h-10 text-sm font-semibold text-brand">Tout marquer lu</button>}
      />
      {error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !list ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty icon={BellOff} title="Rien de nouveau" text="Vous serez prévenu ici quand une demande est validée ou qu'un livre réservé vous attend." />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((n) => {
            const Icon = ICONS[n.type] || Info;
            const unread = Number(n.lu) === 0;
            return (
              <li key={n.id}>
                <button onClick={() => markOne(n)} className={`w-full text-left flex gap-3 px-4 py-4 ${unread ? "bg-brand/[0.05]" : ""}`}>
                  <span className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${TONES[n.type] || "bg-brand/10 text-brand"}`}>
                    <Icon size={19} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-start justify-between gap-2">
                      <span className={`leading-snug ${unread ? "font-semibold" : "font-medium"}`}>{n.titre}</span>
                      {unread && <span className="w-2 h-2 rounded-full bg-brand mt-1.5 shrink-0" aria-label="Non lue" />}
                    </span>
                    <span className="block text-sm text-muted mt-0.5 leading-snug">{n.message}</span>
                    <span className="block text-xs text-muted mt-1.5">{relative(n.date_creation)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
