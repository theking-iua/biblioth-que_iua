-- Données de démonstration (facultatif) : quelques ouvrages avec 2 exemplaires chacun.
-- Chargées uniquement par « npm run db:demo », et seulement si le catalogue est vide.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM documents) THEN
    RAISE NOTICE 'Catalogue déjà rempli : données de démonstration ignorées.';
    RETURN;
  END IF;

  INSERT INTO documents (titre, isbn, auteur, editeur, annee, langue, categorie, cote, localisation, resume, mots_cles, couleur, type_document, nb_pages) VALUES
  ('Clean Code', '978-0132350884', 'Robert C. Martin', 'Prentice Hall', 2008, 'Anglais', 'Informatique & Génie Logiciel', 'INF-MAR-01', 'Rayon C — Étagère 3',
   'Ouvrage de référence pour tous les développeurs : principes fondamentaux pour écrire du code lisible, testable et maintenable.', 'génie logiciel, clean code, refactoring, bonnes pratiques', '#1D4ED8', 'livre', 464),
  ('Design Patterns', '978-0201633610', 'Erich Gamma', 'Addison-Wesley', 1994, 'Anglais', 'Informatique & Génie Logiciel', 'INF-GAM-01', 'Rayon C — Étagère 4',
   'Les 23 patrons de conception incontournables de la programmation orientée objet : singleton, factory, observer, etc.', 'design patterns, POO, architecture logicielle, uml', '#0F766E', 'livre', 395),
  ('Réseaux informatiques', '978-2744075353', 'Andrew Tanenbaum', 'Pearson', 2011, 'Français', 'Réseaux & Cybersécurité', 'RES-TAN-01', 'Rayon C — Étagère 3',
   'Le manuel de référence sur l''architecture des réseaux, des couches physiques aux applications.', 'réseaux, tcp/ip, protocoles', '#7C3AED', 'livre', 950),
  ('Sécurité informatique — Ethical Hacking', '978-2409039751', 'ACISSI', 'ENI', 2023, 'Français', 'Réseaux & Cybersécurité', 'RES-ACI-01', 'Rayon C — Étagère 4',
   'Apprendre l''attaque pour mieux se défendre : tests d''intrusion, failles web, réseaux et systèmes.', 'cybersécurité, pentest, hacking éthique', '#B91C1C', 'livre', 880),
  ('Droit des sociétés commerciales OHADA', '978-2911968600', 'Paul-Gérard Pougoué', 'Juriscope', 2018, 'Français', 'Droit Privé & Droit des Affaires', 'DRT-POU-01', 'Rayon B — Étagère 4',
   'Commentaire de l''Acte uniforme relatif au droit des sociétés commerciales et du GIE.', 'ohada, sociétés, droit des affaires', '#92400E', 'livre', 610),
  ('Principes d''économie', '978-2804163037', 'N. Gregory Mankiw', 'De Boeck', 2019, 'Français', 'Sciences Économiques & Gestion', 'ECO-MAN-01', 'Rayon B — Étagère 4',
   'Introduction claire à la micro et à la macroéconomie, illustrée par de nombreux exemples.', 'économie, microéconomie, macroéconomie', '#065F46', 'livre', 1000),
  ('Finance d''entreprise', '978-2247190379', 'Pierre Vernimmen', 'Dalloz', 2023, 'Français', 'Finance, Banque & Assurance', 'FIN-VER-01', 'Rayon B — Étagère 4',
   'La référence en finance d''entreprise : diagnostic financier, évaluation, financement et gouvernance.', 'finance, analyse financière, évaluation', '#1E3A8A', 'livre', 1200),
  ('Marketing Management', '978-2326002005', 'Philip Kotler', 'Pearson', 2019, 'Français', 'Marketing, Commerce & Communication', 'MKT-KOT-01', 'Rayon B — Étagère 4',
   'Le manuel de marketing le plus utilisé au monde : stratégie, marque, relation client et digital.', 'marketing, stratégie, marque', '#BE185D', 'livre', 880),
  ('L''Étranger', '978-2070360024', 'Albert Camus', 'Gallimard', 1942, 'Français', 'Littérature, Culture & Histoire', 'ROM-CAM-01', 'Rayon A — Étagère 1',
   'Un classique de la littérature française traitant de l''absurdité du monde à travers le destin de Meursault en Algérie.', 'roman, littérature, absurde, existentialisme', '#101B33', 'livre', 184),
  ('Les Soleils des indépendances', '978-2020259798', 'Ahmadou Kourouma', 'Seuil', 1970, 'Français', 'Littérature, Culture & Histoire', 'ROM-KOU-01', 'Rayon A — Étagère 2',
   'Le chef-d''œuvre de l''écrivain ivoirien : la chute de Fama, prince malinké, dans l''Afrique des indépendances.', 'roman africain, côte d''ivoire, indépendances', '#C2410C', 'livre', 208),
  ('Analyse — Cours et exercices', '978-2100801084', 'Jean-Marie Monier', 'Dunod', 2019, 'Français', 'Sciences Générales & Mathématiques', 'MAT-MON-01', 'Rayon A — Étagère 2',
   'Cours complet d''analyse pour la licence avec exercices corrigés.', 'mathématiques, analyse, exercices', '#4338CA', 'cours', 520),
  ('Revue Ivoirienne de Droit — n° 52', NULL, 'Collectif', 'Université FHB', 2022, 'Français', 'Droit Public & Relations Internationales', 'REV-RID-52', 'Rayon B — Étagère 4',
   'Numéro consacré aux réformes constitutionnelles et à la décentralisation en Côte d''Ivoire.', 'droit public, constitution, revue', '#475569', 'revue', 240);

  INSERT INTO document_copies (document_id, code_barre, numero_exemplaire, etat, statut)
  SELECT d.id, 'IUA-EX-' || lpad(d.id::text, 4, '0') || '-' || lpad(n::text, 2, '0'), n,
         CASE WHEN n = 1 THEN 'bon' ELSE 'neuf' END, 'disponible'
  FROM documents d CROSS JOIN generate_series(1, 2) AS n;
END $$;
