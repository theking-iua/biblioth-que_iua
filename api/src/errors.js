// errors.js : erreurs HTTP et gestion centralisée (pas de fuite d'informations techniques).

export class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Erreur métier de circulation (quota, retard, exemplaire indisponible…) → 400. */
export class CirculationError extends HttpError {
  constructor(message) {
    super(message, 400);
  }
}

export const fail = (message, status = 400) => {
  throw new HttpError(message, status);
};

/** Enveloppe un handler async pour transmettre ses erreurs à Express. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Corps de requête JSON invalide." });
  if ((err?.status === 404 || err?.statusCode === 404) && err?.expose) return res.status(404).json({ error: "Fichier introuvable" });
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "Fichier trop volumineux." });
  // Contraintes PostgreSQL : doublon (23505) ou élément encore référencé (23503)
  if (err?.code === "23505" || err?.code === "23503") {
    return res.status(409).json({ error: "Cet élément existe déjà (doublon) ou est encore utilisé ailleurs." });
  }
  if (err?.code === "23514" || err?.code === "22P02") {
    return res.status(400).json({ error: "Valeur invalide." });
  }
  console.error(`[PMB IUA] ${req.method} ${req.originalUrl} :`, err);
  res.status(500).json({ error: "Erreur interne du serveur. Réessayez ou contactez l'administrateur." });
}
