import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, CheckCircle2, AlertCircle, Info, X } from "lucide-react";

// ---------------------------------------------------------------- Messages éphémères
let pushToast = () => {};
export const toast = (message, type = "success") => pushToast({ message, type, id: Math.random() });

export function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    pushToast = (t) => {
      setItems((list) => [...list.slice(-2), t]);
      setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), 3800);
    };
  }, []);
  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  const tone = { success: "text-ok", error: "text-late", info: "text-brand" };
  return (
    <div className="fixed top-0 inset-x-0 z-[70] pt-safe pointer-events-none" aria-live="polite">
      <div className="max-w-[480px] mx-auto px-3 pt-3 space-y-2">
        {items.map((t) => {
          const Icon = icons[t.type] || Info;
          return (
            <div key={t.id} className="pointer-events-auto animate-toast flex items-start gap-3 rounded-2xl bg-surface border border-line shadow-lg shadow-ink/10 px-4 py-3">
              <Icon size={20} className={`${tone[t.type]} shrink-0 mt-px`} />
              <p className="text-sm leading-snug text-ink">{t.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- En-tête d'un écran secondaire
export function ScreenHeader({ title, back = true, right = null }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur pt-safe">
      <div className="h-14 flex items-center gap-1 px-2">
        {back && (
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            className="w-10 h-10 grid place-items-center rounded-full active:bg-ink/5"
            aria-label="Retour"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <h1 className={`flex-1 text-lg font-semibold truncate ${back ? "" : "pl-3"}`}>{title}</h1>
        {right}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- Feuille qui monte du bas
export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/40 animate-fade" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-w-[480px] mx-auto animate-sheet-up">
        <div className="bg-surface rounded-t-3xl max-h-[88vh] overflow-y-auto pb-safe">
          <div className="sticky top-0 bg-surface/95 backdrop-blur px-5 pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-line mx-auto mb-3" />
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold leading-tight">{title}</h2>
              <button onClick={onClose} className="w-9 h-9 grid place-items-center rounded-full bg-ink/5" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="px-5 pb-6 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Sélecteur segmenté
export function Segmented({ value, onChange, options }) {
  return (
    <div className="flex gap-1 p-1 rounded-2xl bg-ink/5 overflow-x-auto no-scrollbar" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 whitespace-nowrap px-2 py-2 rounded-xl text-[13px] font-semibold transition ${
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted"
          }`}
        >
          {o.label}
          {o.count > 0 && <span className={`ml-1 tabular-nums ${value === o.value ? "text-brand" : ""}`}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Puces de filtre
export function Chips({ value, onChange, options }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const on = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
              on ? "bg-ink text-paper border-ink" : "bg-surface text-ink border-line"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Spinner({ className = "" }) {
  return <div className={`w-7 h-7 rounded-full border-[3px] border-brand/25 border-t-brand animate-spin ${className}`} role="status" aria-label="Chargement" />;
}

export function Loading() {
  return (
    <div className="py-16 grid place-items-center">
      <Spinner />
    </div>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="py-12 px-6 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-ink/5 grid place-items-center mx-auto mb-4">
          <Icon size={26} className="text-muted" />
        </div>
      )}
      <p className="font-semibold">{title}</p>
      {text && <p className="text-sm text-muted mt-1 max-w-[30ch] mx-auto">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="m-4 p-4 rounded-2xl bg-late/10 text-late text-sm">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 font-semibold underline">
          Réessayer
        </button>
      )}
    </div>
  );
}
