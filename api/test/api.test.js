// Tests de bout en bout de l'API (nécessite une base de test initialisée avec npm run db:demo
// et l'API démarrée). Lancer : API_URL=http://localhost:4000/api npm test
// ⚠ Ces tests créent et modifient des données : ne jamais les lancer sur la base de production.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const BASE = process.env.API_URL || "http://localhost:4000/api";
const PASS = "iuabibliotheque";
const pgc = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
const ok = async (...a) => {
  const r = await call(...a);
  assert.ok(r.status < 300, `${a[0]} ${a[1]} → ${r.status} ${JSON.stringify(r.data)}`);
  return r.data;
};
const login = async (email, password = PASS) => (await ok("POST", "/login", { body: { email, password } })).token;

let admin, lib, reader, reader2, reader2Id, readerId;
const uniq = Date.now().toString(36);

before(async () => {
  await pgc.connect();
  admin = await login("iuapmb@iua.ci");
  lib = await login("bibliothecaire@iua.ci");
  reader = await login("adherent@iua.ci");
  readerId = (await ok("GET", "/me", { token: reader })).id;
  const reg = await ok("POST", "/members", { body: { nom: "Test", prenom: "Deux", email: `lecteur2.${uniq}@iua.ci`, mot_de_passe: "secret123" } });
  reader2Id = reg.id;
  reader2 = await login(`lecteur2.${uniq}@iua.ci`, "secret123");
  // Base propre pour le lecteur de démo
  await pgc.query("UPDATE users SET statut = 'actif' WHERE id = $1", [readerId]);
});

test("connexion : identifiants, matricule, échec, rôle visiteur à l'inscription", async () => {
  assert.equal((await call("POST", "/login", { body: { email: "adherent@iua.ci", password: "faux" } })).status, 401);
  const byMatricule = await ok("POST", "/login", { body: { email: "IUA-2024-0482", password: PASS } });
  assert.equal(byMatricule.user.role, "adherent");
  const me2 = await ok("GET", "/me", { token: reader2 });
  assert.equal(me2.role, "visiteur");
});

test("contrôle d'accès", async () => {
  assert.equal((await call("GET", "/members")).status, 401);
  assert.equal((await call("GET", "/members", { token: reader })).status, 403);
  assert.equal((await call("GET", "/admin-users", { token: lib })).status, 403);
  assert.equal((await call("POST", "/catalogue", { token: reader, body: { titre: "x" } })).status, 403);
  assert.equal((await call("GET", "/members", { token: lib })).status, 200);
  assert.equal((await call("GET", "/loans", { token: "jeton.falsifie.xx" })).status, 401);
});

test("catalogue + exemplaires : création, détail, mise à jour, suppression", async () => {
  const { id } = await ok("POST", "/catalogue", { token: lib, body: { titre: `Livre ${uniq}`, auteur: "Auteur", categorie: "Informatique & Génie Logiciel", nb_exemplaires: 2 } });
  const doc = await ok("GET", `/catalogue?id=${id}`);
  assert.equal(doc.total_copies, 2);
  assert.equal(doc.copies[0].code_barre, `IUA-EX-${String(id).padStart(4, "0")}-01`);
  const cp = await ok("POST", "/copies", { token: lib, body: { document_id: id, etat: "bon" } });
  assert.equal(cp.numero, 3);
  await ok("PUT", "/copies", { token: lib, body: { id: cp.id, etat: "abime", statut: "maintenance" } });
  await ok("DELETE", `/copies?id=${cp.id}`, { token: lib });
  await ok("PUT", "/catalogue", { token: lib, body: { id, titre: `Livre ${uniq} (2e éd.)`, auteur: "Auteur", categorie: "Informatique & Génie Logiciel" } });
  assert.equal((await ok("GET", `/catalogue?id=${id}`)).titre, `Livre ${uniq} (2e éd.)`);
  const list = await ok("GET", `/catalogue?q=${encodeURIComponent("2E ED")}`);
  assert.ok(list.some((d) => d.id === id), "recherche insensible casse/accents");
  await ok("DELETE", `/catalogue?id=${id}`, { token: lib });
  assert.equal((await call("GET", `/catalogue?id=${id}`)).status, 404);
});

test("demande d'emprunt → validation → prêt → prolongation → retour", async () => {
  const { id: docId } = await ok("POST", "/catalogue", { token: lib, body: { titre: `Circ ${uniq}`, auteur: "A", categorie: "Informatique & Génie Logiciel", nb_exemplaires: 1 } });
  const rq = await ok("POST", "/borrow-requests", { token: reader, body: { document_id: docId } });
  assert.equal((await call("POST", "/borrow-requests", { token: reader, body: { document_id: docId } })).status, 400, "pas de double demande");
  const mine = await ok("GET", "/borrow-requests", { token: reader });
  assert.ok(mine.every((r) => r.user_id === readerId), "un lecteur ne voit que ses demandes");
  await ok("PUT", "/borrow-requests", { token: lib, body: { id: rq.id, action: "approve" } });
  const loans = await ok("GET", "/loans", { token: reader });
  const loan = loans.find((l) => l.document_id === docId && l.statut === "en_cours");
  assert.ok(loan, "prêt créé");
  assert.match(loan.date_retour_prevue, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(loan.jours_restants, 14);
  assert.equal((await ok("GET", `/catalogue?id=${docId}`)).disponible, 0);

  const ren = await ok("POST", "/renewals", { token: reader, body: { loan_id: loan.id } });
  assert.equal(ren.renouvellements_count, 1);
  assert.equal((await call("POST", "/renewals", { token: reader2, body: { loan_id: loan.id } })).status, 403);

  const ret = await ok("PUT", "/loans", { token: lib, body: { code_barre: loan.code_barre } });
  assert.equal(ret.already, false);
  assert.equal((await ok("GET", `/catalogue?id=${docId}`)).disponible, 1);
  const notifs = await ok("GET", "/notifications", { token: reader });
  assert.ok(notifs.notifications.some((n) => n.titre === "Retour enregistré"));
  assert.ok(notifs.unread_count > 0);
  await ok("PUT", "/notifications", { token: reader, body: { action: "mark_all_read" } });
  assert.equal((await ok("GET", "/notifications", { token: reader })).unread_count, 0);
});

test("refus de demande, annulation par le lecteur", async () => {
  const { id: docId } = await ok("POST", "/catalogue", { token: lib, body: { titre: `Refus ${uniq}`, auteur: "A", categorie: "Informatique & Génie Logiciel", nb_exemplaires: 1 } });
  const rq = await ok("POST", "/borrow-requests", { token: reader2, body: { document_id: docId } });
  await ok("PUT", "/borrow-requests", { token: lib, body: { id: rq.id, action: "reject", motif_refus: "Réservé aux examens" } });
  const r = (await ok("GET", "/borrow-requests", { token: reader2 })).find((x) => x.id === rq.id);
  assert.equal(r.statut, "refusee");
  assert.equal(r.motif_refus, "Réservé aux examens");
  const rq2 = await ok("POST", "/borrow-requests", { token: reader2, body: { document_id: docId } });
  assert.equal((await call("DELETE", `/borrow-requests?id=${rq2.id}`, { token: reader })).status, 403);
  await ok("DELETE", `/borrow-requests?id=${rq2.id}`, { token: reader2 });
});

test("réservation : file d'attente, mise de côté au retour, prêt de l'exemplaire réservé", async () => {
  const { id: docId } = await ok("POST", "/catalogue", { token: lib, body: { titre: `Résa ${uniq}`, auteur: "A", categorie: "Informatique & Génie Logiciel", nb_exemplaires: 1 } });
  const loan = await ok("POST", "/loans", { token: lib, body: { document_id: docId, lecteur: "IUA-2024-0482" } });
  // Plus d'exemplaire : demande impossible, réservation possible
  assert.equal((await call("POST", "/borrow-requests", { token: reader2, body: { document_id: docId } })).status, 400);
  const res = await ok("POST", "/reservations", { token: reader2, body: { document_id: docId } });
  assert.equal(res.rang, 1);
  assert.equal((await call("POST", "/reservations", { token: reader, body: { document_id: docId } })).status, 400, "déjà en prêt");
  // Prolongation refusée car réservé
  assert.equal((await call("POST", "/renewals", { token: reader, body: { loan_id: loan.id } })).status, 400);
  // Retour → exemplaire mis de côté pour reader2
  const ret = await ok("PUT", "/loans", { token: lib, body: { id: loan.id } });
  assert.equal(ret.reserve_pour, reader2Id);
  const doc = await ok("GET", `/catalogue?id=${docId}`);
  assert.equal(doc.copies[0].statut, "reserve");
  assert.equal(doc.disponible, 0);
  // Un autre lecteur ne peut pas l'emprunter
  assert.equal((await call("POST", "/loans", { token: lib, body: { document_id: docId, user_id: readerId } })).status, 400);
  // Le réservataire, oui ; sa réservation est honorée
  await ok("POST", "/loans", { token: lib, body: { document_id: docId, user_id: reader2Id } });
  const resas = await ok("GET", `/reservations?document_id=${docId}`, { token: lib });
  assert.equal(resas.find((r) => r.id === res.id).statut, "honoree");
});

test("annulation d'une réservation disponible : l'exemplaire redevient disponible", async () => {
  const { id: docId } = await ok("POST", "/catalogue", { token: lib, body: { titre: `Annul ${uniq}`, auteur: "A", categorie: "Informatique & Génie Logiciel", nb_exemplaires: 1 } });
  const loan = await ok("POST", "/loans", { token: lib, body: { document_id: docId, user_id: readerId } });
  const res = await ok("POST", "/reservations", { token: lib, body: { document_id: docId, user_id: reader2Id } });
  await ok("PUT", "/loans", { token: lib, body: { id: loan.id } });
  await ok("DELETE", `/reservations?id=${res.id}`, { token: reader2 });
  const doc = await ok("GET", `/catalogue?id=${docId}`);
  assert.equal(doc.copies[0].statut, "disponible");
  assert.equal(doc.disponible, 1);
});

test("retard → suspension automatique → levée au retour ; quota", async () => {
  const { id: docId } = await ok("POST", "/catalogue", { token: lib, body: { titre: `Retard ${uniq}`, auteur: "A", categorie: "Informatique & Génie Logiciel", nb_exemplaires: 1 } });
  const loan = await ok("POST", "/loans", { token: lib, body: { document_id: docId, user_id: reader2Id } });
  await pgc.query("UPDATE loans SET date_retour_prevue = date_retour_prevue - interval '30 days' WHERE id = $1", [loan.id]);
  const out = await ok("POST", "/daily-processing", { token: admin });
  assert.match(out.message, /compte\(s\) suspendu/);
  assert.equal((await pgc.query("SELECT statut FROM users WHERE id = $1", [reader2Id])).rows[0].statut, "suspendu");
  assert.equal((await call("POST", "/login", { body: { email: `lecteur2.${uniq}@iua.ci`, password: "secret123" } })).status, 403);
  const late = await ok("GET", `/loans?statut=en_retard&user_id=${reader2Id}`, { token: lib });
  assert.equal(late[0].jours_retard, 16);
  await ok("PUT", "/loans", { token: lib, body: { id: loan.id } });
  assert.equal((await pgc.query("SELECT statut FROM users WHERE id = $1", [reader2Id])).rows[0].statut, "actif");

  // Quota (3 par défaut)
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push((await ok("POST", "/catalogue", { token: lib, body: { titre: `Q${i} ${uniq}`, auteur: "A", categorie: "Informatique & Génie Logiciel", nb_exemplaires: 1 } })).id);
  const active = (await ok("GET", `/loans?user_id=${reader2Id}`, { token: lib })).filter((l) => l.statut !== "retourne").length;
  for (let i = 0; i < 3 - active; i++) await ok("POST", "/loans", { token: lib, body: { document_id: ids[i], user_id: reader2Id } });
  const r = await call("POST", "/loans", { token: lib, body: { document_id: ids[3], user_id: reader2Id } });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /Quota/);
});

test("favoris, paramètres, référentiels, mémoires", async () => {
  await ok("POST", "/favorites", { token: reader, body: { document_id: 1 } });
  await ok("POST", "/favorites", { token: reader, body: { document_id: 1 } });
  assert.equal((await ok("GET", "/favorites", { token: reader })).filter((f) => f.id === 1).length, 1);
  await ok("DELETE", "/favorites?document_id=1", { token: reader });

  assert.equal((await call("PUT", "/settings", { token: admin, body: { duree_pret_jours: 999 } })).status, 400);
  await ok("PUT", "/settings", { token: admin, body: { duree_pret_jours: 21, alerte_retard_active: false } });
  const s = await ok("GET", "/settings");
  assert.equal(s.duree_pret_jours, "21");
  assert.equal(s.alerte_retard_active, "0");
  await ok("PUT", "/settings", { token: admin, body: { duree_pret_jours: 14, alerte_retard_active: true } });

  const t = await ok("POST", "/taxonomies?type=authors", { token: lib, body: { nom: `Auteur ${uniq}`, nationalite: "Ivoirienne" } });
  await ok("PUT", "/taxonomies?type=authors", { token: lib, body: { id: t.id, nom: `Auteur ${uniq} bis`, nationalite: "Ivoirienne" } });
  assert.equal((await call("POST", "/taxonomies?type=authors", { token: lib, body: { nom: `Auteur ${uniq} bis` } })).status, 409);
  await ok("DELETE", `/taxonomies?type=authors&id=${t.id}`, { token: lib });
  const all = await ok("GET", "/taxonomies?all=1");
  assert.ok(all.categories.length >= 9 && Array.isArray(all.locations));
  assert.equal((await call("GET", "/taxonomies?type=users")).status, 400);

  const m = await ok("GET", "/digital-resources?q=cryptographie");
  assert.equal(m.length, 1);
  await ok("GET", `/digital-resources?id=${m[0].id}&action=view`);
  assert.equal((await ok("GET", `/digital-resources?id=${m[0].id}`)).nb_vues, m[0].nb_vues + 1);
});

test("lecteurs et comptes du personnel", async () => {
  const c = await ok("POST", "/members", { token: lib, body: { nom: "Koné", prenom: "Ali", email: `ali.${uniq}@iua.ci`, mot_de_passe: "secret123", role: "adherent", matricule: `M-${uniq}` } });
  await ok("PUT", "/members", { token: lib, body: { id: c.id, statut: "suspendu" } });
  const found = await ok("GET", `/members?q=kone`, { token: lib });
  assert.ok(found.some((u) => u.id === c.id && u.statut === "suspendu"));
  // Profil : le lecteur doit confirmer son mot de passe actuel
  const tk = await (async () => { await ok("PUT", "/members", { token: lib, body: { id: c.id, statut: "actif" } }); return login(`ali.${uniq}@iua.ci`, "secret123"); })();
  assert.equal((await call("PUT", "/members", { token: tk, body: { id: c.id, nom: "Koné", email: `ali.${uniq}@iua.ci`, mot_de_passe: "nouveau123", ancien_mot_de_passe: "faux" } })).status, 403);
  await ok("PUT", "/members", { token: tk, body: { id: c.id, nom: "Koné", email: `ali.${uniq}@iua.ci`, telephone: "0707", mot_de_passe: "nouveau123", ancien_mot_de_passe: "secret123", role: "admin" } });
  assert.equal((await ok("POST", "/login", { body: { email: `ali.${uniq}@iua.ci`, password: "nouveau123" } })).user.role, "adherent", "un lecteur ne peut pas changer son rôle");
  await ok("DELETE", `/members?id=${c.id}`, { token: lib });

  const s = await ok("POST", "/admin-users", { token: admin, body: { nom: "Staff", email: `staff.${uniq}@iua.ci`, mot_de_passe: "motdepasse8", role: "bibliothecaire" } });
  await ok("PUT", "/admin-users", { token: admin, body: { id: s.id, nom: "Staff 2", email: `staff.${uniq}@iua.ci`, role: "bibliothecaire" } });
  const adminId = (await ok("GET", "/me", { token: admin })).id;
  assert.equal((await call("DELETE", `/admin-users?id=${adminId}`, { token: admin })).status, 400);
  await ok("DELETE", `/admin-users?id=${s.id}`, { token: admin });
});

test("statistiques, alertes, journal", async () => {
  const pub = await ok("GET", "/dashboard-stats");
  assert.equal(pub.top_documents, undefined);
  const st = await ok("GET", "/dashboard-stats", { token: lib });
  assert.ok(Array.isArray(st.top_documents) && Array.isArray(st.heures_affluence) && typeof st.retards === "number");
  const al = await ok("GET", "/realtime-alerts", { token: lib });
  assert.ok(Array.isArray(al.last_events));
  const logs = await ok("GET", "/activity-logs?limit=5&action=connexion", { token: admin });
  assert.ok(logs.length > 0 && logs.length <= 5);
});

test("fichiers : photo, PDF de mémoire, import CSV", async () => {
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4b70000000049454e44ae426082", "hex");
  const fd = new FormData();
  fd.append("photo", new Blob([png], { type: "image/png" }), "moi.png");
  const up = await ok("POST", "/photo-upload", { token: reader, form: fd });
  assert.match(up.photo, /^uploads\/photos\/user_\d+_[0-9a-f]+\.png$/);
  const img = await fetch(`${BASE}/${up.photo}`);
  assert.equal(img.status, 200);

  const bad = new FormData();
  bad.append("photo", new Blob(["<?php echo 1;"]), "x.php");
  assert.equal((await call("POST", "/photo-upload", { token: reader, form: bad })).status, 400);

  const pdf = new FormData();
  pdf.append("fichier", new Blob(["%PDF-1.4\n%%EOF"]), "Mémoire Test.pdf");
  const mp = await ok("POST", "/upload-memoire", { token: lib, form: pdf });
  assert.match(mp.fichier_path, /^\/uploads\/memoires\/memoire_test_[0-9a-f]+\.pdf$/);
  assert.equal((await fetch(`${BASE}${mp.fichier_path}`)).status, 200);
  assert.equal((await fetch(`${BASE}/uploads/../.env`)).status, 404);

  const csv = new FormData();
  const latin1 = Buffer.from(`nom;prenom;matricule;filiere;email;telephone\nN'Guessan;Aimé;CSV-${uniq};Droit;;0102\nSansMatricule;;;;;\n`, "latin1");
  csv.append("fichier", new Blob([latin1]), "etudiants.csv");
  const imp = await ok("POST", "/import-lecteurs", { token: lib, form: csv });
  assert.equal(imp.created, 1);
  assert.equal(imp.errors.length, 1);
  const created = await ok("POST", "/login", { body: { email: `CSV-${uniq}`, password: `CSV-${uniq}` } });
  assert.equal(created.user.prenom, "Aimé", "accents Windows-1252 décodés");
});

test("anti brute-force", async () => {
  const email = `bf.${uniq}@iua.ci`;
  for (let i = 0; i < 5; i++) await call("POST", "/login", { body: { email, password: "x" } });
  assert.equal((await call("POST", "/login", { body: { email, password: "x" } })).status, 429);
});

test.after(async () => { await pgc.end(); });
