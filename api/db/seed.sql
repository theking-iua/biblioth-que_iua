-- Données de référence (idempotent). Les comptes par défaut sont créés par scripts/db-init.js.

INSERT INTO settings (cle, valeur, description) VALUES
('duree_pret_jours', '14', 'Durée standard d''un emprunt en jours'),
('max_emprunts_simultanes', '3', 'Nombre maximum de documents empruntés simultanément'),
('max_renouvellements', '2', 'Nombre maximum de prolongations par emprunt'),
('jours_prolongation', '7', 'Nombre de jours ajoutés lors d''un renouvellement'),
('delai_recuperation_reservation_heures', '48', 'Délai pour récupérer un document réservé'),
('jours_retard_suspension', '10', 'Jours de retard au-delà desquels le compte est suspendu automatiquement'),
('nom_bibliotheque', 'Bibliothèque — Institut Universitaire d''Abidjan', 'Nom affiché de la bibliothèque'),
('email_contact', 'bibliotheque@iua.ci', 'Adresse de contact de la bibliothèque'),
('alerte_retard_active', '1', 'Notifications automatiques de retard (1 = oui, 0 = non)')
ON CONFLICT (cle) DO NOTHING;

INSERT INTO categories (nom, code, description) VALUES
('Informatique & Génie Logiciel', 'INFO-GL', 'Développement web/mobile, architecture logicielle, bases de données'),
('Réseaux & Cybersécurité', 'INFO-SEC', 'Administration systèmes, cloud computing, sécurité informatique'),
('Droit Privé & Droit des Affaires', 'DROIT-PRV', 'Droit des sociétés, contrats commerciaux, droit social OHADA'),
('Droit Public & Relations Internationales', 'DROIT-PUB', 'Droit constitutionnel, finances publiques, diplomatie'),
('Sciences Économiques & Gestion', 'ECO-GEST', 'Microéconomie, macroéconomie, management stratégique'),
('Finance, Banque & Assurance', 'FIN-BNQ', 'Marchés financiers, analyse financière, fintech, microfinance'),
('Marketing, Commerce & Communication', 'MKT-COM', 'Marketing digital, stratégie de marque, relation client'),
('Sciences Générales & Mathématiques', 'SCI-MATH', 'Algèbre, analyse, statistiques, physique'),
('Littérature, Culture & Histoire', 'LIT-HIS', 'Romans classiques, histoire de l''Afrique et générale')
ON CONFLICT (nom) DO NOTHING;

INSERT INTO locations (nom, batiment, salle, rayon, etagere) VALUES
('Rayon A — Étagère 1', 'Bibliothèque centrale', 'Salle de lecture', 'A', '1'),
('Rayon A — Étagère 2', 'Bibliothèque centrale', 'Salle de lecture', 'A', '2'),
('Rayon B — Étagère 4', 'Bibliothèque centrale', 'Salle de lecture', 'B', '4'),
('Rayon C — Étagère 3', 'Bibliothèque centrale', 'Salle de lecture', 'C', '3'),
('Rayon C — Étagère 4', 'Bibliothèque centrale', 'Salle de lecture', 'C', '4')
ON CONFLICT (nom) DO NOTHING;

INSERT INTO digital_resources (titre, auteur, directeur_recherche, filiere, cycle, annee_academique, session_soutenance, note_mention, resume, mots_cles, fichier_path, telechargeable)
SELECT v.* FROM (VALUES
(
  'Conception et sécurisation d''une plateforme de vote électronique universitaire basée sur la cryptographie asymétrique',
  'KONE Abdoulaye', 'Dr. KOUAME Konan (Maître de Conférences)', 'Informatique & Génie Logiciel', 'Master', '2023-2024',
  'Session de Septembre 2024', 'Mention Très Bien (17.5/20)',
  'Ce mémoire propose une architecture complète et résiliente pour organiser les élections étudiantes et délibérations académiques de l''IUA avec intégrité cryptographique, anonymat des votes et auditabilité sans tiers de confiance.',
  'vote électronique, cryptographie, sécurité des systèmes, react, api rest, audit', NULL::varchar, 1::smallint
),
(
  'Mise en place d''un SOC (Security Operations Center) et détection d''intrusions par Machine Learning au sein d''un réseau universitaire',
  'TOURE Fatoumata', 'Pr. DIABATE Sékou', 'Réseaux & Cybersécurité', 'Master', '2023-2024',
  'Session de Juillet 2024', 'Mention Très Bien avec Félicitations (18.5/20)',
  'Étude approfondie de la cartographie des vulnérabilités de l''infrastructure informatique d''une université, déploiement d''un SIEM Wazuh couplé à un classifieur de trafic anormal pour neutraliser les attaques DDoS et exfiltrations.',
  'cybersécurité, SOC, SIEM, machine learning, IDS/IPS, réseau campus', NULL, 1
),
(
  'Le cadre juridique de la protection des données personnelles à l''ère de l''IA dans l''espace OHADA et en Côte d''Ivoire',
  'BAMBA Mariam', 'Dr. N''GUESSAN Yao (Agrégé des Facultés de Droit)', 'Droit Privé & Droit des Affaires', 'Master', '2022-2023',
  'Session de Décembre 2023', 'Mention Très Bien (17/20)',
  'Analyse comparative de la loi ivoirienne n° 2013-450 et des directives internationales face aux défis soulevés par les algorithmes prédictifs et les modèles de langage dans les entreprises et services bancaires.',
  'protection des données, droit ohada, rgpd, conformité juridique, intelligence artificielle', NULL, 1
),
(
  'Transformation digitale et résilience financière des banques de détail face à la concurrence des FinTechs dans l''UEMOA',
  'YAO Kouamé Jean-Christophe', 'Pr. CISSE Mamadou', 'Finance, Banque & Assurance', 'Master', '2023-2024',
  'Session de Septembre 2024', 'Mention Bien (15.5/20)',
  'Évaluation économétrique de l''adoption des services de mobile banking et des néobanques sur la rentabilité (ROA/ROE) et le taux de bancarisation des populations actives en Afrique de l''Ouest.',
  'fintech, mobile banking, inclusion financière, uemoa, rentabilité bancaire, bceao', NULL, 1
),
(
  'Optimisation de l''expérience utilisateur (UX/UI) et son impact sur la fidélisation des utilisateurs d''applications EdTech',
  'DIALLO Amadou', 'Mme KOFFI Patricia', 'Marketing, Commerce & Communication', 'Licence', '2023-2024',
  'Session de Juin 2024', 'Mention Très Bien (16.5/20)',
  'Enquête empirique auprès de 500 étudiants de l''IUA analysant les leviers d''ergonomie cognitive, le responsive design et la gamification pour accroître l''assiduité sur les plateformes de e-learning.',
  'UX/UI, e-learning, ergonomie cognitive, fidélisation, marketing digital', NULL, 1
)
) AS v(titre, auteur, directeur_recherche, filiere, cycle, annee_academique, session_soutenance, note_mention, resume, mots_cles, fichier_path, telechargeable)
WHERE NOT EXISTS (SELECT 1 FROM digital_resources d WHERE d.titre = v.titre);
