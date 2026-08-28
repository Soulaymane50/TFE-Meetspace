-- Rich, deterministic MeetSpace demonstration dataset.
-- This script is executed only when APP_DEMO_SEED_ENABLED=true outside prod.
-- All identities use the reserved .test domain and cannot receive email.
-- Demo password for every account: MeetSpaceDemo!2026

INSERT INTO utilisateur (
    id, first_name, last_name, email, password_hash, role, status,
    created_at, updated_at, token_version, pending_email,
    password_reset_token_hash, password_reset_expires_at,
    account_deletion_token_hash, account_deletion_expires_at,
    email_change_token_hash, email_change_expires_at
) VALUES
    (9001, 'Nora', 'Lambert', 'admin.demo@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'ADMIN', 'ACTIVE', '2025-11-03 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9010, 'Ines', 'Peeters', 'ines.peeters@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'ORGANIZER', 'ACTIVE', '2025-11-10 10:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9011, 'Yassine', 'Boulanger', 'yassine.boulanger@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'ORGANIZER', 'ACTIVE', '2025-11-12 10:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9012, 'Emma', 'Jacobs', 'emma.jacobs@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'ORGANIZER', 'ACTIVE', '2025-11-18 10:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9013, 'Rayan', 'Diallo', 'rayan.diallo@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'ORGANIZER', 'ACTIVE', '2025-12-02 10:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9014, 'Julie', 'Van den Broeck', 'julie.vdb@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'ORGANIZER', 'ACTIVE', '2025-12-08 10:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9015, 'Karim', 'El Amrani', 'karim.elamrani@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'ORGANIZER', 'ACTIVE', '2025-12-15 10:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9101, 'Alice', 'Moreau', 'alice.moreau@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2025-12-20 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9102, 'Adam', 'Vermeulen', 'adam.vermeulen@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2025-12-21 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9103, 'Sarah', 'Nguyen', 'sarah.nguyen@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2025-12-22 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9104, 'Thomas', 'Leroy', 'thomas.leroy@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-01-04 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9105, 'Lina', 'Ait Benali', 'lina.aitbenali@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-01-06 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9106, 'Victor', 'Maes', 'victor.maes@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-01-09 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9107, 'Chloe', 'Dumont', 'chloe.dumont@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-01-12 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9108, 'Bilal', 'Ouali', 'bilal.ouali@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-01-15 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9109, 'Laura', 'Claes', 'laura.claes@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-01-18 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9110, 'Noah', 'Martin', 'noah.martin@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-02-01 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9111, 'Camille', 'Simon', 'camille.simon@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-02-04 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9112, 'Mehdi', 'Haddad', 'mehdi.haddad@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-02-08 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9113, 'Eva', 'Willems', 'eva.willems@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-02-12 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9114, 'Louis', 'Renard', 'louis.renard@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-02-16 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9115, 'Maya', 'Cisse', 'maya.cisse@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-03-02 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9116, 'Arthur', 'Devos', 'arthur.devos@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-03-07 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9117, 'Nina', 'Rossi', 'nina.rossi@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-03-11 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9118, 'Elias', 'Bernard', 'elias.bernard@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-03-15 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9119, 'Lea', 'Mertens', 'lea.mertens@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-04-01 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9120, 'Hugo', 'Petit', 'hugo.petit@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-04-05 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9121, 'Manon', 'Janssens', 'manon.janssens@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-04-10 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9122, 'Samir', 'Kaya', 'samir.kaya@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'ACTIVE', '2026-04-14 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9123, 'Compte', 'Inactif', 'inactive@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'INACTIVE', '2026-04-18 09:00:00', NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    (9124, 'Compte', 'Suspendu', 'suspended@meetspace-demo.test', '$2a$10$m76oj29dOzzratcPCuvIUe5HxOh3tv/vNo4KW0XbvOshrbv3bPG2y', 'MEMBER', 'BANNED', '2026-04-20 09:00:00', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON DUPLICATE KEY UPDATE
    first_name = VALUES(first_name), last_name = VALUES(last_name),
    password_hash = VALUES(password_hash), role = VALUES(role), status = VALUES(status),
    updated_at = VALUES(updated_at), token_version = VALUES(token_version);

INSERT INTO espace (id, name, type, capacity, base_price, status) VALUES
    (1, 'Salle Premium Orion', 'PREMIUM_ROOM', 500, 320.00, 'AVAILABLE'),
    (2, 'Salle Premium Executive', 'PREMIUM_ROOM', 300, 260.00, 'AVAILABLE'),
    (3, 'Salle Atlas', 'SALLE', 100, 130.00, 'AVAILABLE'),
    (4, 'Salle Horizon', 'SALLE', 50, 90.00, 'AVAILABLE'),
    (5, 'Salle Conseil Executive', 'PREMIUM_ROOM', 20, 190.00, 'AVAILABLE'),
    (6, 'Studio Sablon', 'SALLE', 30, 75.00, 'AVAILABLE'),
    (7, 'Atelier Canal', 'SALLE', 60, 110.00, 'AVAILABLE'),
    (8, 'Auditorium Europe', 'PREMIUM_ROOM', 220, 240.00, 'AVAILABLE')
ON DUPLICATE KEY UPDATE
    name = VALUES(name), type = VALUES(type), capacity = VALUES(capacity),
    base_price = VALUES(base_price), status = VALUES(status);

INSERT INTO event (
    id, title, description, start_date_time, end_date_time, location,
    location_type, space_id, external_address, capacity, price, status,
    version, created_by, created_at, approved_at, approved_by,
    rejection_reason, parking_required
) VALUES
    (9501, 'Gouvernance IA responsable', 'Une journée pour traduire les exigences de gouvernance IA en décisions opérationnelles.', '2026-01-22 09:00:00', '2026-01-22 17:30:00', 'Salle Premium Executive', 'EXISTING_SPACE', 2, NULL, 180, 95.00, 'PUBLISHED', 0, 9010, '2025-11-28 10:00:00', '2025-11-29 11:00:00', 9001, NULL, 1),
    (9502, 'Future of Work Brussels', 'Management hybride, nouveaux espaces de travail et pratiques de collaboration.', '2026-02-10 09:30:00', '2026-02-10 16:30:00', 'Salle Atlas', 'EXISTING_SPACE', 3, NULL, 90, 65.00, 'PUBLISHED', 0, 9011, '2025-12-05 10:00:00', '2025-12-06 11:00:00', 9001, NULL, 1),
    (9503, 'Cyber Resilience Forum', 'Retours d experience sur la continuité, les incidents et la gouvernance cyber.', '2026-03-05 08:45:00', '2026-03-05 18:00:00', 'Salle Premium Orion', 'EXISTING_SPACE', 1, NULL, 420, 135.00, 'PUBLISHED', 0, 9012, '2025-12-12 10:00:00', '2025-12-13 11:00:00', 9001, NULL, 1),
    (9504, 'PME durables et rentables', 'Atelier concret sur la transition durable et son financement.', '2026-03-26 13:30:00', '2026-03-26 18:00:00', 'Salle Horizon', 'EXISTING_SPACE', 4, NULL, 45, 39.00, 'PUBLISHED', 0, 9013, '2026-01-15 10:00:00', '2026-01-16 11:00:00', 9001, NULL, 0),
    (9505, 'HR Tech Experience', 'Démonstrations et retours terrain autour des outils RH et de l expérience collaborateur.', '2026-04-16 09:00:00', '2026-04-16 17:00:00', 'Salle Atlas', 'EXISTING_SPACE', 3, NULL, 85, 72.00, 'PUBLISHED', 0, 9014, '2026-01-22 10:00:00', '2026-01-23 11:00:00', 9001, NULL, 1),
    (9506, 'Cloud Native Operations', 'Architecture, observabilité, coûts et fiabilité des plateformes cloud.', '2026-05-07 09:00:00', '2026-05-07 17:30:00', 'Salle Premium Executive', 'EXISTING_SPACE', 2, NULL, 240, 110.00, 'PUBLISHED', 0, 9015, '2026-02-02 10:00:00', '2026-02-03 11:00:00', 9001, NULL, 1),
    (9507, 'Product Leadership Day', 'Une journée entre responsables produit autour des arbitrages, équipes et indicateurs.', '2026-06-18 09:00:00', '2026-06-18 18:00:00', 'Salle Premium Orion', 'EXISTING_SPACE', 1, NULL, 450, 145.00, 'PUBLISHED', 0, 9010, '2026-03-01 10:00:00', '2026-03-02 11:00:00', 9001, NULL, 1),
    (9508, 'Finance pour équipes produit', 'Comprendre marge, prévisions, pricing et rentabilité sans jargon comptable.', '2026-07-09 14:00:00', '2026-07-09 18:00:00', 'Salle Atlas', 'EXISTING_SPACE', 3, NULL, 95, 55.00, 'PUBLISHED', 0, 9011, '2026-04-04 10:00:00', '2026-04-05 11:00:00', 9001, NULL, 1),
    (9509, 'Brussels Digital Summit 2026', 'Le rendez-vous bruxellois des équipes numériques, de la donnée et de l innovation.', '2026-08-21 09:00:00', '2026-08-21 18:00:00', 'Salle Premium Orion', 'EXISTING_SPACE', 1, NULL, 480, 150.00, 'PUBLISHED', 0, 9012, '2026-05-02 10:00:00', '2026-05-03 11:00:00', 9001, NULL, 1),
    (9510, 'Startup Sales Clinic', 'Sessions courtes et cas pratiques pour structurer un cycle de vente B2B.', '2026-08-28 13:00:00', '2026-08-28 18:00:00', 'Atelier Canal', 'EXISTING_SPACE', 7, NULL, 55, 42.00, 'PUBLISHED', 0, 9013, '2026-06-01 10:00:00', '2026-06-02 11:00:00', 9001, NULL, 0),
    (9511, 'Data Platform Conference', 'Architecture analytique, qualité, gouvernance et usages métiers de la donnée.', '2026-09-10 09:00:00', '2026-09-10 17:30:00', 'Salle Premium Executive', 'EXISTING_SPACE', 2, NULL, 260, 125.00, 'PUBLISHED', 0, 9014, '2026-06-10 10:00:00', '2026-06-11 11:00:00', 9001, NULL, 1),
    (9512, 'UX Research en pratique', 'Méthodes légères pour apprendre vite sans sacrifier la qualité de recherche.', '2026-09-17 13:30:00', '2026-09-17 17:30:00', 'Studio Sablon', 'EXISTING_SPACE', 6, NULL, 28, 35.00, 'PUBLISHED', 0, 9015, '2026-06-16 10:00:00', '2026-06-17 11:00:00', 9001, NULL, 0),
    (9513, 'Green Tech Belgium', 'Solutions belges pour réduire énergie, déchets et émissions dans les entreprises.', '2026-09-24 09:30:00', '2026-09-24 17:00:00', 'Auditorium Europe', 'EXISTING_SPACE', 8, NULL, 210, 88.00, 'PUBLISHED', 0, 9010, '2026-06-22 10:00:00', '2026-06-23 11:00:00', 9001, NULL, 1),
    (9514, 'Legal Tech & Compliance', 'Automatisation documentaire, conformité et responsabilité numérique.', '2026-10-01 09:00:00', '2026-10-01 13:00:00', 'Salle Atlas', 'EXISTING_SPACE', 3, NULL, 90, 58.00, 'PUBLISHED', 0, 9011, '2026-07-01 10:00:00', '2026-07-02 11:00:00', 9001, NULL, 1),
    (9515, 'Security Engineering Workshop', 'Threat modeling, secrets, dépendances et incidents dans un atelier technique.', '2026-10-08 09:00:00', '2026-10-08 17:00:00', 'Atelier Canal', 'EXISTING_SPACE', 7, NULL, 55, 79.00, 'PUBLISHED', 0, 9012, '2026-07-05 10:00:00', '2026-07-06 11:00:00', 9001, NULL, 0),
    (9516, 'Leadership sans surcharge', 'Prioriser, déléguer et maintenir un rythme durable dans les équipes.', '2026-10-15 13:00:00', '2026-10-15 17:30:00', 'Salle Horizon', 'EXISTING_SPACE', 4, NULL, 45, 45.00, 'PUBLISHED', 0, 9013, '2026-07-10 10:00:00', '2026-07-11 11:00:00', 9001, NULL, 1),
    (9517, 'Public Sector Innovation', 'Services publics numériques, accessibilité et simplification des démarches.', '2026-10-29 09:00:00', '2026-10-29 17:30:00', 'Auditorium Europe', 'EXISTING_SPACE', 8, NULL, 200, 75.00, 'PUBLISHED', 0, 9014, '2026-07-18 10:00:00', '2026-07-19 11:00:00', 9001, NULL, 1),
    (9518, 'E-commerce Operations Day', 'Paiement, logistique, service client et pilotage d une activité e-commerce.', '2026-11-05 09:00:00', '2026-11-05 17:00:00', 'Salle Premium Executive', 'EXISTING_SPACE', 2, NULL, 250, 115.00, 'PUBLISHED', 0, 9015, '2026-08-01 10:00:00', '2026-08-02 11:00:00', 9001, NULL, 1),
    (9519, 'Applied AI Builders', 'Retours concrets sur la construction et la mise en production de produits IA.', '2026-11-12 09:00:00', '2026-11-12 18:00:00', 'Salle Premium Orion', 'EXISTING_SPACE', 1, NULL, 470, 155.00, 'PUBLISHED', 0, 9010, '2026-08-05 10:00:00', '2026-08-06 11:00:00', 9001, NULL, 1),
    (9520, 'CFO & Growth Roundtable', 'Table ronde confidentielle sur financement, marge et scénarios de croissance.', '2026-11-19 17:30:00', '2026-11-19 21:00:00', 'Salle Conseil Executive', 'EXISTING_SPACE', 5, NULL, 20, 95.00, 'PUBLISHED', 0, 9011, '2026-08-08 10:00:00', '2026-08-09 11:00:00', 9001, NULL, 0),
    (9521, 'Women in Tech Brussels', 'Rencontres, parcours et actions concrètes pour des équipes plus inclusives.', '2026-11-26 13:00:00', '2026-11-26 18:00:00', 'Salle Atlas', 'EXISTING_SPACE', 3, NULL, 95, 25.00, 'PUBLISHED', 0, 9012, '2026-08-10 10:00:00', '2026-08-11 11:00:00', 9001, NULL, 1),
    (9522, 'Product Strategy 2027', 'Construire une stratégie produit lisible avant la planification annuelle.', '2026-12-03 09:00:00', '2026-12-03 17:00:00', 'Auditorium Europe', 'EXISTING_SPACE', 8, NULL, 215, 105.00, 'PUBLISHED', 0, 9013, '2026-08-12 10:00:00', '2026-08-13 11:00:00', 9001, NULL, 1),
    (9523, 'MeetSpace Year End Forum', 'Bilan de l année et perspectives 2027 avec les communautés professionnelles.', '2026-12-10 15:00:00', '2026-12-10 21:00:00', 'Salle Premium Orion', 'EXISTING_SPACE', 1, NULL, 490, 80.00, 'PUBLISHED', 0, 9014, '2026-08-14 10:00:00', '2026-08-15 11:00:00', 9001, NULL, 1),
    (9524, 'Innovation Procurement Lab', 'Atelier pour mieux acheter, tester et déployer des solutions innovantes.', '2026-12-17 09:30:00', '2026-12-17 16:30:00', 'Atelier Canal', 'EXISTING_SPACE', 7, NULL, 58, 49.00, 'PUBLISHED', 0, 9015, '2026-08-16 10:00:00', '2026-08-17 11:00:00', 9001, NULL, 0),
    (9528, 'Design Systems Clinic', 'Atelier pratique consacré aux composants, aux règles d interface et à la collaboration produit.', '2026-09-10 09:30:00', '2026-09-10 12:30:00', 'Atelier Canal', 'EXISTING_SPACE', 7, NULL, 50, 35.00, 'PUBLISHED', 0, 9012, '2026-08-20 09:00:00', '2026-08-20 10:00:00', 9001, NULL, 0),
    (9529, 'Data Governance Roundtable', 'Échanges en petit comité sur la qualité, la responsabilité et le pilotage des données.', '2026-09-10 14:00:00', '2026-09-10 17:00:00', 'Salle Conseil Executive', 'EXISTING_SPACE', 5, NULL, 20, 75.00, 'PUBLISHED', 0, 9013, '2026-08-20 09:10:00', '2026-08-20 10:10:00', 9001, NULL, 1),
    (9530, 'Brussels Accessibility Lab', 'Laboratoire gratuit pour tester des parcours numériques plus accessibles.', '2026-10-15 09:00:00', '2026-10-15 12:30:00', 'Studio Sablon', 'EXISTING_SPACE', 6, NULL, 26, 0.00, 'PUBLISHED', 0, 9014, '2026-08-21 09:00:00', '2026-08-21 10:00:00', 9001, NULL, 0),
    (9531, 'B2B Revenue Operations', 'Cas pratiques sur l alignement marketing, ventes, données et prévisions.', '2026-10-15 14:00:00', '2026-10-15 18:00:00', 'Salle Atlas', 'EXISTING_SPACE', 3, NULL, 90, 59.00, 'PUBLISHED', 0, 9015, '2026-08-21 09:10:00', '2026-08-21 10:10:00', 9001, NULL, 1),
    (9532, 'Responsible AI Legal Clinic', 'Questions juridiques et opérationnelles autour des systèmes d intelligence artificielle.', '2026-11-12 09:30:00', '2026-11-12 12:30:00', 'Studio Sablon', 'EXISTING_SPACE', 6, NULL, 28, 49.00, 'PUBLISHED', 0, 9010, '2026-08-22 09:00:00', '2026-08-22 10:00:00', 9001, NULL, 0),
    (9533, 'Tech Talent Meetup', 'Rencontre de fin de journée pour recruteurs, responsables techniques et candidats.', '2026-11-12 18:30:00', '2026-11-12 21:00:00', 'Salle Atlas', 'EXISTING_SPACE', 3, NULL, 95, 15.00, 'PUBLISHED', 0, 9011, '2026-08-22 09:10:00', '2026-08-22 10:10:00', 9001, NULL, 1),
    (9534, 'Customer Success Forum', 'Méthodes concrètes pour suivre l adoption, la satisfaction et la fidélisation.', '2026-12-10 09:00:00', '2026-12-10 13:00:00', 'Salle Atlas', 'EXISTING_SPACE', 3, NULL, 90, 52.00, 'PUBLISHED', 0, 9012, '2026-08-23 09:00:00', '2026-08-23 10:00:00', 9001, NULL, 1),
    (9535, 'Open Source Brussels', 'Contributions, maintenance et modèles économiques autour des logiciels libres.', '2026-12-10 14:00:00', '2026-12-10 18:00:00', 'Auditorium Europe', 'EXISTING_SPACE', 8, NULL, 200, 25.00, 'PUBLISHED', 0, 9013, '2026-08-23 09:10:00', '2026-08-23 10:10:00', 9001, NULL, 1),
    (9525, 'Mobility Data Exchange', 'Proposition d événement autour des données de mobilité, à valider par MeetSpace.', '2026-12-08 09:30:00', '2026-12-08 16:00:00', 'Salle Atlas', 'EXISTING_SPACE', 3, NULL, 90, 62.00, 'PENDING_APPROVAL', 0, 9010, '2026-08-18 10:00:00', NULL, NULL, NULL, 1),
    (9526, 'Web3 Corporate Briefing', 'Proposition refusée car le contenu et le format n étaient pas assez détaillés.', '2026-11-30 14:00:00', '2026-11-30 17:00:00', 'Studio Sablon', 'EXISTING_SPACE', 6, NULL, 25, 120.00, 'REJECTED', 0, 9011, '2026-08-10 12:00:00', NULL, 9001, 'Programme insuffisamment détaillé pour publication.', 0),
    (9527, 'Retail Data Breakfast', 'Édition annulée et conservée pour illustrer le suivi historique.', '2026-07-22 08:30:00', '2026-07-22 11:00:00', 'Salle Horizon', 'EXISTING_SPACE', 4, NULL, 40, 30.00, 'CANCELLED', 0, 9012, '2026-05-15 10:00:00', '2026-05-16 11:00:00', 9001, NULL, 0)
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description),
    start_date_time = VALUES(start_date_time), end_date_time = VALUES(end_date_time),
    location = VALUES(location), location_type = VALUES(location_type), space_id = VALUES(space_id),
    capacity = VALUES(capacity), price = VALUES(price), status = VALUES(status),
    created_by = VALUES(created_by), created_at = VALUES(created_at),
    approved_at = VALUES(approved_at), approved_by = VALUES(approved_by),
    rejection_reason = VALUES(rejection_reason), parking_required = VALUES(parking_required);

INSERT INTO parking_slot (
    id, title, description, session_date, start_time, end_time,
    capacity, parking_rate, status, version, created_at, event_id
)
SELECT
    9800 + (e.id - 9500),
    CONCAT('Parking - ', e.title),
    'Places réservées aux participants de l événement. Paiement séparé via MeetSpace.',
    DATE(e.start_date_time),
    TIME(DATE_SUB(e.start_date_time, INTERVAL 1 HOUR)),
    TIME(DATE_ADD(e.end_date_time, INTERVAL 1 HOUR)),
    LEAST(150, GREATEST(12, ROUND(e.capacity * 0.30))),
    CASE
        WHEN TIMESTAMPDIFF(MINUTE, e.start_date_time, e.end_date_time) >= 420 AND e.capacity >= 300 THEN 15.00
        WHEN TIMESTAMPDIFF(MINUTE, e.start_date_time, e.end_date_time) >= 240 OR e.capacity >= 300 THEN 12.00
        ELSE 8.00
    END,
    'OPEN', 0, DATE_SUB(e.created_at, INTERVAL 1 DAY), e.id
FROM event e
WHERE e.id BETWEEN 9501 AND 9535
  AND e.status = 'PUBLISHED'
  AND e.parking_required = TRUE
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description), session_date = VALUES(session_date),
    start_time = VALUES(start_time), end_time = VALUES(end_time), capacity = VALUES(capacity),
    parking_rate = VALUES(parking_rate), status = VALUES(status), event_id = VALUES(event_id);

INSERT INTO event_registration (
    id, utilisateur_id, event_id, number_of_participants, total_price,
    status, version, payment_intent_id, created_at
)
SELECT
    50000 + ((e.id - 9500) * 100) + (u.id - 9100),
    u.id,
    e.id,
    1 + MOD(u.id + e.id, 3),
    ROUND(COALESCE(e.price, 0) * (1 + MOD(u.id + e.id, 3)), 2),
    CASE WHEN MOD(u.id + e.id, 17) = 0 THEN 'CANCELLED' ELSE 'CONFIRMED' END,
    0,
    CONCAT('demo_event_', 50000 + ((e.id - 9500) * 100) + (u.id - 9100)),
    DATE_SUB(e.start_date_time, INTERVAL (20 + MOD(u.id, 60)) DAY)
FROM utilisateur u
CROSS JOIN event e
WHERE u.id BETWEEN 9101 AND 9122
  AND u.status = 'ACTIVE'
  AND e.id BETWEEN 9501 AND 9524
  AND e.status = 'PUBLISHED'
  AND MOD(u.id + e.id, 2) = 0
ON DUPLICATE KEY UPDATE
    number_of_participants = VALUES(number_of_participants), total_price = VALUES(total_price),
    status = VALUES(status), payment_intent_id = VALUES(payment_intent_id),
    created_at = VALUES(created_at);

INSERT INTO parking_reservation (
    id, user_id, parking_slot_id, event_registration_id, reserved_spaces,
    total_price, status, version, payment_intent_id, created_at
)
SELECT
    80000 + (r.id - 50000),
    r.utilisateur_id,
    p.id,
    r.id,
    LEAST(2, r.number_of_participants),
    ROUND(p.parking_rate * LEAST(2, r.number_of_participants), 2),
    CASE WHEN r.status = 'CANCELLED' THEN 'CANCELLED' ELSE 'CONFIRMED' END,
    0,
    CONCAT('demo_parking_', 80000 + (r.id - 50000)),
    DATE_ADD(r.created_at, INTERVAL 10 MINUTE)
FROM event_registration r
JOIN parking_slot p ON p.event_id = r.event_id
WHERE r.id BETWEEN 50000 AND 60000
  AND MOD(r.id, 3) <> 0
ON DUPLICATE KEY UPDATE
    reserved_spaces = VALUES(reserved_spaces), total_price = VALUES(total_price),
    status = VALUES(status), payment_intent_id = VALUES(payment_intent_id),
    event_registration_id = VALUES(event_registration_id), created_at = VALUES(created_at);

INSERT INTO espace_reservation (
    id, utilisateur_id, espace_id, start_date_time, end_date_time,
    total_price, status, version, payment_intent_id, justification,
    rejection_reason, approved_by, approved_at, payment_due_at, created_at
) VALUES
    (70001, 9101, 3, '2026-01-12 09:00:00', '2026-01-12 11:00:00', 260.00, 'CONFIRMED', 0, 'demo_space_70001', 'Atelier trimestriel de l équipe produit.', NULL, NULL, NULL, NULL, '2025-12-18 09:00:00'),
    (70002, 9102, 4, '2026-02-06 13:00:00', '2026-02-06 17:00:00', 331.20, 'CONFIRMED', 0, 'demo_space_70002', 'Réunion commerciale élargie.', NULL, NULL, NULL, NULL, '2026-01-12 09:00:00'),
    (70003, 9103, 6, '2026-02-20 09:00:00', '2026-02-20 17:00:00', 510.00, 'CONFIRMED', 0, 'demo_space_70003', 'Journée de cadrage stratégique.', NULL, NULL, NULL, NULL, '2026-01-22 09:00:00'),
    (70004, 9104, 7, '2026-03-13 09:00:00', '2026-03-13 13:00:00', 404.80, 'CONFIRMED', 0, 'demo_space_70004', 'Formation interne des responsables d équipe.', NULL, NULL, NULL, NULL, '2026-02-02 09:00:00'),
    (70005, 9105, 3, '2026-03-30 14:00:00', '2026-03-30 17:00:00', 390.00, 'CANCELLED', 0, 'demo_space_70005', 'Comité de pilotage annulé.', NULL, NULL, NULL, NULL, '2026-02-18 09:00:00'),
    (70006, 9106, 4, '2026-04-10 09:00:00', '2026-04-10 11:00:00', 180.00, 'CONFIRMED', 0, 'demo_space_70006', 'Entretien collectif et débrief.', NULL, NULL, NULL, NULL, '2026-03-08 09:00:00'),
    (70007, 9107, 6, '2026-04-24 13:00:00', '2026-04-24 17:00:00', 404.80, 'CONFIRMED', 0, 'demo_space_70007', 'Workshop expérience client.', NULL, NULL, NULL, NULL, '2026-03-12 09:00:00'),
    (70008, 9108, 3, '2026-05-11 09:00:00', '2026-05-11 17:00:00', 884.00, 'CONFIRMED', 0, 'demo_space_70008', 'Séminaire opérationnel de printemps.', NULL, NULL, NULL, NULL, '2026-03-30 09:00:00'),
    (70009, 9109, 5, '2026-05-22 14:00:00', '2026-05-22 17:00:00', 570.00, 'CONFIRMED', 0, 'demo_space_70009', 'Conseil de direction mensuel.', NULL, 9001, '2026-04-12 10:00:00', NULL, '2026-04-10 09:00:00'),
    (70010, 9110, 7, '2026-06-05 09:00:00', '2026-06-05 13:00:00', 404.80, 'CONFIRMED', 0, 'demo_space_70010', 'Atelier budget du second semestre.', NULL, NULL, NULL, NULL, '2026-04-28 09:00:00'),
    (70011, 9111, 4, '2026-06-26 13:00:00', '2026-06-26 17:00:00', 331.20, 'CONFIRMED', 0, 'demo_space_70011', 'Rétrospective programme et plan d action.', NULL, NULL, NULL, NULL, '2026-05-02 09:00:00'),
    (70012, 9112, 3, '2026-07-17 09:00:00', '2026-07-17 12:00:00', 390.00, 'CONFIRMED', 0, 'demo_space_70012', 'Présentation des résultats semestriels.', NULL, NULL, NULL, NULL, '2026-05-28 09:00:00'),
    (70013, 9113, 6, '2026-08-07 09:00:00', '2026-08-07 17:00:00', 510.00, 'CONFIRMED', 0, 'demo_space_70013', 'Journée équipe avant la rentrée.', NULL, NULL, NULL, NULL, '2026-06-14 09:00:00'),
    (70014, 9114, 2, '2026-08-26 09:00:00', '2026-08-26 17:00:00', 1768.00, 'APPROVED', 0, NULL, 'Convention annuelle avec accueil premium.', NULL, 9001, '2026-08-02 10:00:00', '2026-08-28 10:00:00', '2026-07-20 09:00:00'),
    (70015, 9115, 4, '2026-09-04 13:00:00', '2026-09-04 17:00:00', 331.20, 'CONFIRMED', 0, 'demo_space_70015', 'Réunion de lancement de projet.', NULL, NULL, NULL, NULL, '2026-07-22 09:00:00'),
    (70016, 9116, 7, '2026-09-25 09:00:00', '2026-09-25 17:00:00', 748.00, 'CONFIRMED', 0, 'demo_space_70016', 'Formation de facilitateurs internes.', NULL, NULL, NULL, NULL, '2026-08-01 09:00:00'),
    (70017, 9117, 5, '2026-10-16 14:00:00', '2026-10-16 18:00:00', 699.20, 'PENDING_APPROVAL', 0, NULL, 'Conseil stratégique avec confidentialité renforcée.', NULL, NULL, NULL, NULL, '2026-08-10 09:00:00'),
    (70018, 9118, 3, '2026-11-06 09:00:00', '2026-11-06 13:00:00', 478.40, 'CONFIRMED', 0, 'demo_space_70018', 'Revue annuelle des opérations.', NULL, NULL, NULL, NULL, '2026-08-12 09:00:00'),
    (70019, 9119, 8, '2026-11-27 09:00:00', '2026-11-27 17:00:00', 1632.00, 'APPROVED', 0, NULL, 'Assemblée annuelle des partenaires.', NULL, 9001, '2026-08-18 10:00:00', '2026-11-01 10:00:00', '2026-08-15 09:00:00'),
    (70020, 9120, 6, '2026-12-04 13:00:00', '2026-12-04 17:00:00', 276.00, 'CONFIRMED', 0, 'demo_space_70020', 'Clôture de programme et retour d expérience.', NULL, NULL, NULL, NULL, '2026-08-17 09:00:00'),
    (70021, 9121, 4, '2026-12-11 09:00:00', '2026-12-11 12:00:00', 270.00, 'CONFIRMED', 0, 'demo_space_70021', 'Préparation du plan commercial 2027.', NULL, NULL, NULL, NULL, '2026-08-18 09:00:00'),
    (70022, 9122, 3, '2026-12-18 09:00:00', '2026-12-18 17:00:00', 884.00, 'CONFIRMED', 0, 'demo_space_70022', 'Séminaire de clôture de l année.', NULL, NULL, NULL, NULL, '2026-08-19 09:00:00')
ON DUPLICATE KEY UPDATE
    utilisateur_id = VALUES(utilisateur_id), espace_id = VALUES(espace_id),
    start_date_time = VALUES(start_date_time), end_date_time = VALUES(end_date_time),
    total_price = VALUES(total_price), status = VALUES(status),
    payment_intent_id = VALUES(payment_intent_id), justification = VALUES(justification),
    rejection_reason = VALUES(rejection_reason), approved_by = VALUES(approved_by),
    approved_at = VALUES(approved_at), payment_due_at = VALUES(payment_due_at),
    created_at = VALUES(created_at);

INSERT INTO payment_record (
    id, payment_intent_id, user_id, type, amount_cents, currency, status,
    resource_id, booking_hold_id, booking_entity_id, refunded_amount_cents,
    created_at, updated_at, consumed_at, refunded_at, version
)
SELECT
    150000 + r.id,
    r.payment_intent_id,
    r.utilisateur_id,
    'EVENT',
    ROUND(r.total_price * 100),
    'eur',
    CASE WHEN r.status = 'CANCELLED' THEN 'REFUNDED' ELSE 'CONSUMED' END,
    r.event_id,
    NULL,
    r.id,
    CASE WHEN r.status = 'CANCELLED' THEN ROUND(r.total_price * 100) ELSE 0 END,
    r.created_at,
    CASE WHEN r.status = 'CANCELLED' THEN DATE_ADD(r.created_at, INTERVAL 5 DAY) ELSE r.created_at END,
    r.created_at,
    CASE WHEN r.status = 'CANCELLED' THEN DATE_ADD(r.created_at, INTERVAL 5 DAY) ELSE NULL END,
    0
FROM event_registration r
WHERE r.id BETWEEN 50000 AND 60000 AND r.total_price > 0
ON DUPLICATE KEY UPDATE
    amount_cents = VALUES(amount_cents), status = VALUES(status),
    refunded_amount_cents = VALUES(refunded_amount_cents), updated_at = VALUES(updated_at),
    consumed_at = VALUES(consumed_at), refunded_at = VALUES(refunded_at);

INSERT INTO payment_record (
    id, payment_intent_id, user_id, type, amount_cents, currency, status,
    resource_id, booking_hold_id, booking_entity_id, refunded_amount_cents,
    created_at, updated_at, consumed_at, refunded_at, version
)
SELECT
    250000 + r.id,
    r.payment_intent_id,
    r.user_id,
    'PARKING',
    ROUND(r.total_price * 100),
    'eur',
    CASE WHEN r.status = 'CANCELLED' THEN 'REFUNDED' ELSE 'CONSUMED' END,
    r.parking_slot_id,
    NULL,
    r.id,
    CASE WHEN r.status = 'CANCELLED' THEN ROUND(r.total_price * 100) ELSE 0 END,
    r.created_at,
    CASE WHEN r.status = 'CANCELLED' THEN DATE_ADD(r.created_at, INTERVAL 5 DAY) ELSE r.created_at END,
    r.created_at,
    CASE WHEN r.status = 'CANCELLED' THEN DATE_ADD(r.created_at, INTERVAL 5 DAY) ELSE NULL END,
    0
FROM parking_reservation r
WHERE r.id BETWEEN 80000 AND 90000 AND r.total_price > 0
ON DUPLICATE KEY UPDATE
    amount_cents = VALUES(amount_cents), status = VALUES(status),
    refunded_amount_cents = VALUES(refunded_amount_cents), updated_at = VALUES(updated_at),
    consumed_at = VALUES(consumed_at), refunded_at = VALUES(refunded_at);

INSERT INTO payment_record (
    id, payment_intent_id, user_id, type, amount_cents, currency, status,
    resource_id, booking_hold_id, booking_entity_id, refunded_amount_cents,
    created_at, updated_at, consumed_at, refunded_at, version
)
SELECT
    350000 + r.id,
    r.payment_intent_id,
    r.utilisateur_id,
    'SPACE',
    ROUND(r.total_price * 100),
    'eur',
    CASE WHEN r.status = 'CANCELLED' THEN 'REFUNDED' ELSE 'CONSUMED' END,
    r.espace_id,
    NULL,
    r.id,
    CASE WHEN r.status = 'CANCELLED' THEN ROUND(r.total_price * 100) ELSE 0 END,
    r.created_at,
    CASE WHEN r.status = 'CANCELLED' THEN DATE_ADD(r.created_at, INTERVAL 4 DAY) ELSE r.created_at END,
    r.created_at,
    CASE WHEN r.status = 'CANCELLED' THEN DATE_ADD(r.created_at, INTERVAL 4 DAY) ELSE NULL END,
    0
FROM espace_reservation r
WHERE r.id BETWEEN 70001 AND 70099
  AND r.payment_intent_id IS NOT NULL
  AND r.total_price > 0
ON DUPLICATE KEY UPDATE
    amount_cents = VALUES(amount_cents), status = VALUES(status),
    refunded_amount_cents = VALUES(refunded_amount_cents), updated_at = VALUES(updated_at),
    consumed_at = VALUES(consumed_at), refunded_at = VALUES(refunded_at);

INSERT INTO event_waitlist (
    id, event_id, user_id, participant_count, status, created_at, updated_at
) VALUES
    (99001, 9512, 9101, 2, 'WAITING', '2026-08-18 10:00:00', '2026-08-18 10:00:00'),
    (99002, 9520, 9101, 1, 'WAITING', '2026-08-19 11:00:00', '2026-08-19 11:00:00'),
    (99003, 9520, 9103, 2, 'WAITING', '2026-08-19 11:15:00', '2026-08-19 11:15:00')
ON DUPLICATE KEY UPDATE
    event_id = VALUES(event_id), user_id = VALUES(user_id),
    participant_count = VALUES(participant_count), status = VALUES(status),
    updated_at = VALUES(updated_at);

INSERT INTO user_notification (
    id, user_id, tone, title, message, path, source_type, source_id, created_at, read_at
) VALUES
    (99501, 9101, 'SUCCESS', 'Réservation confirmée', 'Votre réservation de salle est confirmée.', '/my-reservations?tab=spaces', 'Reservation', 70001, '2026-01-02 10:00:00', '2026-01-02 10:30:00'),
    (99502, 9114, 'ACTION', 'Paiement à finaliser', 'Votre demande premium a été approuvée. Finalisez le paiement avant l échéance.', '/my-reservations?tab=spaces', 'Reservation', 70014, '2026-08-02 10:05:00', NULL),
    (99503, 9117, 'INFO', 'Demande reçue', 'Votre demande de salle premium est en cours d examen.', '/my-reservations?tab=spaces', 'Reservation', 70017, '2026-08-10 09:05:00', NULL),
    (99504, 9101, 'ACTION', 'Liste d attente', 'Vous êtes sur liste d attente pour CFO & Growth Roundtable.', '/my-reservations?tab=events', 'EventWaitlist', 99002, '2026-08-19 11:00:00', NULL)
ON DUPLICATE KEY UPDATE
    user_id = VALUES(user_id), tone = VALUES(tone),
    title = VALUES(title), message = VALUES(message),
    path = VALUES(path), source_type = VALUES(source_type), source_id = VALUES(source_id),
    created_at = VALUES(created_at), read_at = VALUES(read_at);
