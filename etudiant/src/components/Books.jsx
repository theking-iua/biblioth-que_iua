import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "../context/AppContext";
import { Txt, shadow } from "./ui";
import { font, alpha } from "../lib/theme";
import { TYPE_LABELS } from "../lib/format";
import { api } from "../lib/api";

// Couverture : l'image si elle existe, sinon un « dos de livre » à la couleur de la notice
// avec l'étiquette de cote blanche collée en bas, comme sur les rayons de la bibliothèque.
const SIZES = {
  sm: { w: 56, h: 80, r: 6, pad: 6, title: 9, lines: 3, label: 7 },
  md: { w: 96, h: 144, r: 8, pad: 10, title: 13, lines: 4, label: 9 },
  lg: { w: 132, h: 192, r: 12, pad: 14, title: 17, lines: 5, label: 11 },
};

export function BookCover({ book, size = "md" }) {
  const z = SIZES[size];
  const color = /^#[0-9a-f]{3,8}$/i.test(book?.couleur || "") ? book.couleur : "#14213D";
  // Pas de césure en React Native : on réduit le titre pour que son mot le plus long tienne sur une ligne
  const longest = Math.max(4, ...String(book?.titre || "").split(/\s+/).map((w) => w.length));
  const avail = z.w - 2 * z.pad - z.w * 0.08;
  const titleSize = Math.max(z.title * 0.62, Math.min(z.title, avail / (longest * 0.6)));
  const box = { width: z.w, height: z.h, borderRadius: z.r, ...shadow(size === "lg" ? 4 : 2) };

  // Couverture : lien externe (http…) ou image hébergée par l'API (/uploads/…)
  if (book?.couverture_url && /^(https?:\/\/|\/uploads\/)/.test(book.couverture_url)) {
    return <Image source={{ uri: api.fileUrl(book.couverture_url) }} style={[box, { backgroundColor: "#E2E5EE" }]} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[box, { backgroundColor: color, padding: z.pad, overflow: "hidden" }]} accessible={false} importantForAccessibility="no-hide-descendants">
      {/* reliure */}
      <View style={[StyleSheet.absoluteFill, { width: z.w * 0.09, backgroundColor: "rgba(0,0,0,0.22)" }]} />
      <View style={{ position: "absolute", left: z.w * 0.1, top: 0, bottom: 0, width: 2, backgroundColor: "rgba(255,255,255,0.10)" }} />
      <Text numberOfLines={z.lines} style={{ color: "#fff", fontFamily: font.displaySemi, fontSize: titleSize, lineHeight: titleSize * 1.15, marginLeft: z.w * 0.08 }}>
        {book?.titre}
      </Text>
      {!!book?.cote && (
        <View style={{ marginTop: "auto", alignSelf: "flex-end", backgroundColor: "#fff", borderRadius: 2, paddingHorizontal: z.label * 0.6, paddingVertical: 1 }}>
          <Text numberOfLines={2} style={{ color: "#14213D", fontFamily: font.semibold, fontSize: z.label, fontVariant: ["tabular-nums"] }}>{book.cote}</Text>
        </View>
      )}
    </View>
  );
}

export function Availability({ book, style }) {
  const { c } = useApp();
  const n = Number(book.copies_disponibles ?? 0);
  const total = Number(book.total_copies ?? 0);
  if (total === 0) {
    return book.fichier_numerique ? (
      <View style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, style]}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.brand }} />
        <Txt v="smallStrong" color={c.brand} style={{ fontSize: 12 }}>Version numérique en ligne</Txt>
      </View>
    ) : (
      <Txt v="small" muted style={style}>Consultation sur place</Txt>
    );
  }
  const ok = n > 0;
  const tone = ok ? c.ok : c.ochre;
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, style]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} />
      <Txt v="smallStrong" color={tone} style={{ fontSize: 12 }}>
        {ok ? `${n} disponible${n > 1 ? "s" : ""}` : "Tous empruntés, réservable"}
      </Txt>
    </View>
  );
}

export function BookRow({ book, right }) {
  const { c } = useApp();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/livre/${book.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${book.titre}, ${book.auteur}`}
      style={({ pressed }) => [{ flexDirection: "row", gap: 16, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center" }, pressed && { backgroundColor: alpha(c.ink, 0.03) }]}
    >
      <BookCover book={book} size="sm" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="strong" numberOfLines={2}>{book.titre}</Txt>
        <Txt v="small" muted numberOfLines={1} style={{ marginTop: 2 }}>
          {book.auteur}
          {book.annee ? `, ${book.annee}` : ""}
        </Txt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          <Availability book={book} />
          {book.type_document && book.type_document !== "livre" && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: alpha(c.ink, 0.06) }}>
              <Txt v="tiny" muted>{TYPE_LABELS[book.type_document]}</Txt>
            </View>
          )}
        </View>
      </View>
      {right}
    </Pressable>
  );
}
