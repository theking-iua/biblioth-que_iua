// Traitement quotidien de la circulation (à planifier chaque nuit) :
//  - passe en retard les prêts échus
//  - suspend les lecteurs dont un retard dépasse « jours_retard_suspension »
//  - expire les réservations non retirées à temps
// Utilisation : npm run cron   (Planificateur de tâches Windows, crontab, Render Cron Job, GitHub Actions…)
import { pool, tx } from "../src/db.js";
import { runDailyProcessing } from "../src/circulation.js";

try {
  const out = await tx((t) => runDailyProcessing(t, null));
  console.log(out.message);
} catch (e) {
  console.error("Échec du traitement quotidien :", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
