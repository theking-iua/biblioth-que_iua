import React from "react";

// Couverture d'un ouvrage : l'image si elle existe, sinon un « dos de livre » à la couleur de la notice,
// avec l'étiquette de cote blanche collée en bas, comme sur les rayons de la bibliothèque.
const sizes = {
  sm: { box: "w-14 h-20 rounded-md", title: "text-[9px] leading-[1.1] line-clamp-3", label: "text-[7px] px-1 py-px", pad: "p-1.5" },
  md: { box: "w-24 h-36 rounded-lg", title: "text-[13px] leading-tight line-clamp-4", label: "text-[9px] px-1.5 py-0.5", pad: "p-2.5" },
  lg: { box: "w-36 h-52 rounded-xl", title: "text-lg leading-tight line-clamp-5", label: "text-[11px] px-2 py-0.5", pad: "p-3.5" },
};

export default function BookCover({ book, size = "md", className = "" }) {
  const s = sizes[size];
  const color = /^#[0-9a-f]{3,8}$/i.test(book?.couleur || "") ? book.couleur : "#14213D";

  if (book?.couverture_url && /^https?:\/\//.test(book.couverture_url)) {
    return (
      <img
        src={book.couverture_url}
        alt=""
        loading="lazy"
        className={`${s.box} object-cover shadow-md shadow-ink/20 shrink-0 bg-line ${className}`}
      />
    );
  }

  return (
    <div
      className={`${s.box} ${s.pad} relative shrink-0 overflow-hidden shadow-md shadow-ink/20 flex flex-col text-white ${className}`}
      style={{ background: `linear-gradient(100deg, rgba(0,0,0,.28) 0, rgba(0,0,0,0) 9%, rgba(255,255,255,.08) 11%, rgba(0,0,0,0) 14%), ${color}` }}
      aria-hidden="true"
    >
      <p lang="fr" className={`font-display font-semibold ${s.title} pl-[8%] hyphens-auto [overflow-wrap:anywhere]`}>{book?.titre}</p>
      {book?.cote && (
        <span className={`mt-auto ml-auto bg-white text-[#14213D] font-semibold tabular-nums rounded-sm ${s.label}`}>
          {book.cote}
        </span>
      )}
    </div>
  );
}
