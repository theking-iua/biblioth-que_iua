import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "../context/AuthContext";
import { ScreenHeader } from "../components/ui";
import { Avatar } from "./ProfilePage";
import { fullName } from "../lib/format";

// Carte de lecteur : le QR code contient le matricule, que la douchette du comptoir saisit
// directement dans le champ « lecteur » du prêt rapide. Généré sur le téléphone (aucun service externe).
export default function CardPage() {
  const { user } = useAuth();
  const [qr, setQr] = useState("");
  const code = user.matricule || user.email;

  useEffect(() => {
    QRCode.toDataURL(code, { margin: 1, width: 480, color: { dark: "#14213D", light: "#FFFFFF" } }).then(setQr);
  }, [code]);

  // Écran plus lumineux pour faciliter la lecture : on force le thème clair sur cette carte
  return (
    <div className="min-h-full bg-paper">
      <ScreenHeader title="Carte de lecteur" />
      <div className="px-5 pt-2 pb-8">
        <div className="rounded-3xl overflow-hidden shadow-xl shadow-ink/15 bg-white text-[#14213D]">
          <div className="bg-[#2463EB] text-white px-5 py-4 flex items-center gap-3">
            <img src="/logo-iua.png" alt="" className="w-10 h-10 rounded-xl bg-white p-1" />
            <div>
              <p className="font-display font-semibold leading-tight">Institut Universitaire d'Abidjan</p>
              <p className="text-sm text-white/80">Carte de la bibliothèque</p>
            </div>
          </div>
          <div className="px-5 pt-5 flex items-center gap-4">
            <Avatar user={user} size="w-16 h-16 text-xl" />
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold leading-tight">{fullName(user)}</p>
              <p className="text-sm text-[#5C6880] truncate">{user.filiere || "Lecteur"}</p>
            </div>
          </div>
          <div className="p-5">
            <div className="aspect-square w-full max-w-[260px] mx-auto">
              {qr && <img src={qr} alt={`QR code du matricule ${code}`} className="w-full h-full" />}
            </div>
            <p className="mt-3 text-center font-display text-xl font-semibold tracking-wide tabular-nums">{code}</p>
            <p className={`mt-1 text-center text-sm font-semibold ${user.statut === "actif" ? "text-[#12805C]" : "text-[#C2362B]"}`}>
              {user.statut === "actif" ? "Carte valide" : user.statut === "suspendu" ? "Compte suspendu" : "En attente de validation"}
            </p>
          </div>
        </div>
        <p className="mt-5 text-sm text-muted text-center max-w-[32ch] mx-auto">
          Présentez ce code au comptoir pour emprunter ou retirer une réservation.
        </p>
      </div>
    </div>
  );
}
