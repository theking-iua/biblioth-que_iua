import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

export default function DarkModeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
        isDark
          ? "bg-navy-800 border-navy-600 text-yellow-400 hover:bg-navy-700"
          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
      } ${className}`}
      title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun size={18} className="animate-spin-slow" /> : <Moon size={18} />}
    </button>
  );
}
