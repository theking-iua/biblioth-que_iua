import React from "react";
import { Link } from "react-router-dom";
import BookCover from "./BookCover";
import { TYPE_LABELS } from "../lib/format";

export function Availability({ book, className = "" }) {
  const n = Number(book.copies_disponibles ?? 0);
  const total = Number(book.total_copies ?? 0);
  if (total === 0) return <span className={`text-xs text-muted ${className}`}>Consultation sur place</span>;
  return n > 0 ? (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold text-ok ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-ok" /> {n} disponible{n > 1 ? "s" : ""}
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold text-ochre ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-ochre" /> Tous empruntés, réservable
    </span>
  );
}

export default function BookRow({ book }) {
  return (
    <Link to={`/livre/${book.id}`} className="flex gap-4 py-3 active:bg-ink/[0.03] -mx-4 px-4">
      <BookCover book={book} size="sm" />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="font-semibold leading-snug line-clamp-2">{book.titre}</p>
        <p className="text-sm text-muted truncate mt-0.5">
          {book.auteur}
          {book.annee ? `, ${book.annee}` : ""}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <Availability book={book} />
          {book.type_document && book.type_document !== "livre" && (
            <span className="text-[11px] px-1.5 py-px rounded bg-ink/5 text-muted">{TYPE_LABELS[book.type_document]}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
