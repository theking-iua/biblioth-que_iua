// Palette et typographie de Biblio IUA (identique à l'appli web des lecteurs).
export const light = {
  ink: "#14213D",
  muted: "#5C6880",
  paper: "#F5F6FA",
  surface: "#FFFFFF",
  line: "#E2E5EE",
  brand: "#2463EB",
  hero: "#2463EB",
  ochre: "#D99A1E",
  ok: "#12805C",
  late: "#C2362B",
  onBrand: "#FFFFFF",
};

export const dark = {
  ink: "#E8ECF5",
  muted: "#96A0B6",
  paper: "#0C1222",
  surface: "#161F36",
  line: "#283452",
  brand: "#6091FF",
  hero: "#1B3C8C",
  ochre: "#EBB242",
  ok: "#3CBE8C",
  late: "#F06E62",
  onBrand: "#FFFFFF",
};

/** Couleur avec transparence : alpha("#2463EB", 0.1) */
export function alpha(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  display: "BricolageGrotesque_700Bold",
  displaySemi: "BricolageGrotesque_600SemiBold",
};
