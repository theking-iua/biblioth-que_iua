/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Palette MyIUA — bleu royal institutionnel
        iua: {
          blue: "#2463EB",       // bleu principal (boutons actifs, liens)
          "blue-dark": "#1D4ED8", // bleu foncé (hover)
          "blue-light": "#EFF6FF", // fond léger bleu
          "blue-mid": "#DBEAFE",  // fond médium bleu (badges)
          sidebar: "#FFFFFF",    // sidebar blanche
          "sidebar-active": "#EFF6FF", // item actif sidebar
          label: "#6B7280",      // labels gris
          border: "#E5E7EB",     // bordures légères
          bg: "#F9FAFB",         // fond principal
          text: "#111827",       // texte principal
          muted: "#6B7280",      // texte secondaire
          orange: "#F97316",     // badge orange (AFFECTÉ)
          green: "#16A34A",      // succès/vert
          red: "#DC2626",        // erreur/retard
          amber: "#D97706",      // avertissement
        },
        // Conserver les anciens pour la compat des composants publics
        navy: {
          950: "#050d1f",
          900: "#0b1324",
          800: "#101B33",
          700: "#1B2C4E",
          600: "#2A3C60",
        },
        sky: {
          brand: "#2463EB",
          deep: "#1D4ED8",
          pale: "#EFF6FF",
        },
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        "card": "0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)",
        "card-md": "0 4px 12px 0 rgba(0,0,0,0.08)",
        "glow": "0 10px 40px -10px rgba(36,99,235,0.55)",
        "lift": "0 20px 40px -18px rgba(16,27,51,0.35)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-down": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateX(24px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(0,-14px,0)" },
        },
        "ken-burns": {
          "0%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1.12)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.5s ease-out both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "slide-down": "slide-down 0.25s ease-out both",
        "toast-in": "toast-in 0.4s cubic-bezier(0.16,1,0.3,1) both",
        float: "float 7s ease-in-out infinite",
        "float-slow": "float 11s ease-in-out infinite",
        "ken-burns": "ken-burns 22s ease-in-out infinite alternate",
        "gradient-x": "gradient-x 6s ease infinite",
      },
    },
  },
  plugins: [],
};
