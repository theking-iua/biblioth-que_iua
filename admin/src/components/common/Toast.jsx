import React, { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

let toastDispatcher = null;

export function showToast(message, type = "success") {
  if (toastDispatcher) {
    toastDispatcher({ message, type, id: Date.now() });
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastDispatcher = (newToast) => {
      setToasts(prev => [...prev, newToast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 4000);
    };
    return () => { toastDispatcher = null; };
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium transition-all animate-toast-in backdrop-blur-md ${
            t.type === "success"
              ? "bg-white dark:bg-navy-800 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              : t.type === "error"
              ? "bg-white dark:bg-navy-800 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
              : "bg-white dark:bg-navy-800 text-sky-deep dark:text-sky-brand border-sky-200 dark:border-sky-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {t.type === "success" && <CheckCircle2 size={18} className="text-emerald-500" />}
            {t.type === "error" && <AlertTriangle size={18} className="text-rose-500" />}
            {t.type === "info" && <Info size={18} className="text-sky-500" />}
            <span>{t.message}</span>
          </div>
          <button onClick={() => removeToast(t.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
