-- =====================================================================
--  PMB IUA — schéma PostgreSQL (Neon)
--  Équivalent de schema.sql + schema_update.sql + migration_2026_11.sql (MySQL).
--  Idempotent : peut être rejoué sans risque (npm run db:init).
--  Les dates sont des TIMESTAMP sans fuseau, à l'heure de la bibliothèque
--  (Abidjan = UTC+0), comme dans l'ancienne base MySQL.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Recherche insensible à la casse ET aux accents (comme utf8mb4_unicode_ci sous MySQL)
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, $1)) $$;

-- Heure de la bibliothèque (fuseau injecté par scripts/db-init.js depuis APP_TIMEZONE).
-- Utilisée à la place de NOW() : fonctionne aussi derrière le pooler Neon (PgBouncer).
CREATE OR REPLACE FUNCTION app_now() RETURNS timestamp(0)
  LANGUAGE sql STABLE
  AS $$ SELECT (now() AT TIME ZONE '__APP_TIMEZONE__')::timestamp(0) $$;

-- ---------------------------------------------------------------- Utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  nom           VARCHAR(255) NOT NULL,
  prenom        VARCHAR(100),
  email         VARCHAR(255) NOT NULL,
  telephone     VARCHAR(50),
  matricule     VARCHAR(50),
  filiere       VARCHAR(100),
  photo         VARCHAR(255),
  mot_de_passe  VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'adherent'
                CHECK (role IN ('admin','bibliothecaire','adherent','visiteur')),
  statut        VARCHAR(20) NOT NULL DEFAULT 'actif'
                CHECK (statut IN ('actif','suspendu','en_attente')),
  date_creation TIMESTAMP(0) NOT NULL DEFAULT app_now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_matricule ON users (matricule);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- ---------------------------------------------------------------- Journal d'audit
CREATE TABLE IF NOT EXISTS activity_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name   VARCHAR(255),
  user_role   VARCHAR(50),
  action      VARCHAR(255) NOT NULL,
  cible_type  VARCHAR(100),
  cible_id    INTEGER,
  details     TEXT,
  ip_address  VARCHAR(45),
  date        TIMESTAMP(0) NOT NULL DEFAULT app_now()
);
CREATE INDEX IF NOT EXISTS idx_logs_date ON activity_logs (date);
CREATE INDEX IF NOT EXISTS idx_logs_user ON activity_logs (user_id);

-- ---------------------------------------------------------------- Anti brute-force
CREATE TABLE IF NOT EXISTS login_attempts (
  id          SERIAL PRIMARY KEY,
  ip_address  VARCHAR(45) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  date        TIMESTAMP(0) NOT NULL DEFAULT app_now()
);
CREATE INDEX IF NOT EXISTS idx_login_ip_email_date ON login_attempts (ip_address, email, date);

-- ---------------------------------------------------------------- Référentiels
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL UNIQUE,
  code        VARCHAR(50),
  description TEXT
);

CREATE TABLE IF NOT EXISTS authors (
  id          SERIAL PRIMARY KEY,
  nom         VARCHAR(255) NOT NULL UNIQUE,
  biographie  TEXT,
  nationalite VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS publishers (
  id    SERIAL PRIMARY KEY,
  nom   VARCHAR(255) NOT NULL UNIQUE,
  ville VARCHAR(100),
  pays  VARCHAR(100) DEFAULT 'Côte d''Ivoire'
);

CREATE TABLE IF NOT EXISTS locations (
  id       SERIAL PRIMARY KEY,
  nom      VARCHAR(150) NOT NULL UNIQUE,
  batiment VARCHAR(100),
  salle    VARCHAR(100),
  rayon    VARCHAR(50),
  etagere  VARCHAR(50)
);

-- ---------------------------------------------------------------- Notices
CREATE TABLE IF NOT EXISTS documents (
  id                SERIAL PRIMARY KEY,
  titre             VARCHAR(255) NOT NULL,
  isbn              VARCHAR(50),
  auteur            VARCHAR(255) NOT NULL,
  editeur           VARCHAR(255),
  annee             INTEGER DEFAULT 2024,
  langue            VARCHAR(50) NOT NULL DEFAULT 'Français',
  categorie         VARCHAR(100) NOT NULL,
  cote              VARCHAR(50),
  localisation      VARCHAR(100) DEFAULT 'Rayon B — Étagère 4',
  resume            TEXT,
  mots_cles         VARCHAR(255),
  disponible        SMALLINT NOT NULL DEFAULT 1,
  couleur           VARCHAR(50) DEFAULT '#101B33',
  couverture_url    VARCHAR(255),
  type_document     VARCHAR(20) NOT NULL DEFAULT 'livre'
                    CHECK (type_document IN ('livre','memoire','these','revue','cours')),
  nb_pages          INTEGER DEFAULT 320,
  fichier_numerique VARCHAR(255),
  date_ajout        TIMESTAMP(0) NOT NULL DEFAULT app_now()
);
CREATE INDEX IF NOT EXISTS idx_documents_categorie ON documents (categorie);

-- ---------------------------------------------------------------- Exemplaires
CREATE TABLE IF NOT EXISTS document_copies (
  id                SERIAL PRIMARY KEY,
  document_id       INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  code_barre        VARCHAR(100) NOT NULL UNIQUE,
  numero_exemplaire INTEGER NOT NULL DEFAULT 1,
  etat              VARCHAR(10) NOT NULL DEFAULT 'bon'
                    CHECK (etat IN ('neuf','bon','moyen','abime')),
  statut            VARCHAR(15) NOT NULL DEFAULT 'disponible'
                    CHECK (statut IN ('disponible','emprunte','reserve','maintenance','perdu')),
  date_acquisition  TIMESTAMP(0) NOT NULL DEFAULT app_now()
);
CREATE INDEX IF NOT EXISTS idx_copies_document ON document_copies (document_id);

-- ---------------------------------------------------------------- Prêts
CREATE TABLE IF NOT EXISTS loans (
  id                    SERIAL PRIMARY KEY,
  document_id           INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  copy_id               INTEGER REFERENCES document_copies(id) ON DELETE SET NULL,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_emprunt          TIMESTAMP(0) NOT NULL DEFAULT app_now(),
  date_retour_prevue    TIMESTAMP(0) NOT NULL,
  date_retour_reelle    TIMESTAMP(0),
  statut                VARCHAR(15) NOT NULL DEFAULT 'en_cours'
                        CHECK (statut IN ('en_cours','en_retard','retourne')),
  renouvellements_count INTEGER NOT NULL DEFAULT 0,
  notes                 VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_loans_document ON loans (document_id);
CREATE INDEX IF NOT EXISTS idx_loans_user ON loans (user_id);
CREATE INDEX IF NOT EXISTS idx_loans_statut_retour ON loans (statut, date_retour_prevue);

-- ---------------------------------------------------------------- Demandes d'emprunt
CREATE TABLE IF NOT EXISTS borrow_requests (
  id                SERIAL PRIMARY KEY,
  document_id       INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_demande      TIMESTAMP(0) NOT NULL DEFAULT app_now(),
  statut            VARCHAR(15) NOT NULL DEFAULT 'en_attente'
                    CHECK (statut IN ('en_attente','validee','refusee')),
  motif_refus       VARCHAR(255),
  date_traitement   TIMESTAMP(0),
  bibliothecaire_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_requests_user ON borrow_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_requests_statut ON borrow_requests (statut);

-- ---------------------------------------------------------------- Réservations
CREATE TABLE IF NOT EXISTS reservations (
  id               SERIAL PRIMARY KEY,
  document_id      INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_reservation TIMESTAMP(0) NOT NULL DEFAULT app_now(),
  date_expiration  TIMESTAMP(0),
  rang_file        INTEGER NOT NULL DEFAULT 1,
  statut           VARCHAR(15) NOT NULL DEFAULT 'en_attente'
                   CHECK (statut IN ('en_attente','disponible','annulee','honoree'))
);
CREATE INDEX IF NOT EXISTS idx_reservations_doc ON reservations (document_id, statut);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations (user_id);

-- ---------------------------------------------------------------- Mémoires & thèses
CREATE TABLE IF NOT EXISTS digital_resources (
  id                  SERIAL PRIMARY KEY,
  document_id         INTEGER,
  titre               VARCHAR(255) NOT NULL,
  auteur              VARCHAR(255) NOT NULL,
  directeur_recherche VARCHAR(255),
  filiere             VARCHAR(150) NOT NULL,
  cycle               VARCHAR(20) NOT NULL DEFAULT 'Master'
                      CHECK (cycle IN ('Licence','Master','Doctorat','Recherche')),
  annee_academique    VARCHAR(20) NOT NULL DEFAULT '2023-2024',
  session_soutenance  VARCHAR(50) DEFAULT 'Session de Juillet',
  note_mention        VARCHAR(50) DEFAULT 'Très Bien',
  resume              TEXT,
  mots_cles           VARCHAR(255),
  fichier_path        VARCHAR(255),
  contenu_texte       TEXT,
  telechargeable      SMALLINT NOT NULL DEFAULT 1,
  nb_vues             INTEGER NOT NULL DEFAULT 0,
  nb_telechargements  INTEGER NOT NULL DEFAULT 0,
  date_publication    TIMESTAMP(0) NOT NULL DEFAULT app_now()
);

-- ---------------------------------------------------------------- Favoris
CREATE TABLE IF NOT EXISTS favorites (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  date_ajout  TIMESTAMP(0) NOT NULL DEFAULT app_now(),
  UNIQUE (user_id, document_id)
);

-- ---------------------------------------------------------------- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titre         VARCHAR(255) NOT NULL,
  message       TEXT NOT NULL,
  type          VARCHAR(15) NOT NULL DEFAULT 'systeme'
                CHECK (type IN ('rappel','retard','reservation','emprunt','systeme','info')),
  lu            SMALLINT NOT NULL DEFAULT 0,
  date_creation TIMESTAMP(0) NOT NULL DEFAULT app_now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, lu);

-- ---------------------------------------------------------------- Paramètres
CREATE TABLE IF NOT EXISTS settings (
  id          SERIAL PRIMARY KEY,
  cle         VARCHAR(50) NOT NULL UNIQUE,
  valeur      VARCHAR(255) NOT NULL,
  description VARCHAR(255)
);
