/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: v("ink"),         // texte principal
        muted: v("muted"),     // texte secondaire
        paper: v("paper"),     // fond de l'appli
        surface: v("surface"), // fonds des blocs
        line: v("line"),       // séparateurs
        brand: v("brand"),     // bleu IUA : actions
        ochre: v("ochre"),     // échéances proches
        ok: v("ok"),           // disponible
        late: v("late"),       // retard
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', "system-ui", "sans-serif"],
        body: ['"Inter Variable"', "system-ui", "sans-serif"],
      },
      keyframes: {
        "sheet-up": { "0%": { transform: "translateY(100%)" }, "100%": { transform: "translateY(0)" } },
        "fade": { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        "toast": { "0%": { opacity: 0, transform: "translateY(-8px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
      },
      animation: {
        "sheet-up": "sheet-up .28s cubic-bezier(.2,.8,.2,1) both",
        fade: "fade .2s ease-out both",
        toast: "toast .25s ease-out both",
      },
    },
  },
  plugins: [],
};
