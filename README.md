# MeetSpace

MeetSpace est une plateforme de réservation pour un centre de conférences à Bruxelles. Elle réunit dans une même application les salles professionnelles, les événements B2B et le parking associé.

Le produit couvre quatre usages distincts : la consultation publique, la réservation par un client, l’organisation d’événements et l’administration opérationnelle et financière de la plateforme.

## Fonctionnalités

- catalogue public des salles et événements avec recherche, filtres et disponibilités ;
- calendrier centralisé des salles avec détection et verrouillage des chevauchements ;
- réservation de salles standard ou demande de salle premium soumise à validation ;
- inscription aux événements, capacité, liste d’attente et billet QR individuel ;
- parking partagé de 150 places, réparti entre les événements simultanés, avec réservation par véhicule et QR code d’accès ;
- demandes de salles premium avec validation et échéance de paiement ;
- espace client pour les réservations, paiements, annulations et profil ;
- espace organisateur pour créer, soumettre et suivre ses événements, leurs participants, leurs revenus et les entrées ;
- contrôle des billets par caméra ou saisie manuelle, avec validation idempotente ;
- administration des utilisateurs, espaces, événements, parkings, validations et contrôles d’accès ;
- tableau financier global pour l’administrateur et synthèse simplifiée pour l’organisateur ;
- authentification JWT, révocation des sessions et états de compte ;
- paiement Stripe, registre interne des paiements et mode simulé strictement réservé au développement ;
- notifications persistantes, e-mails configurables et journal d’audit ;
- interface responsive et installable en français, anglais et néerlandais, avec thèmes clair et sombre.

Les sections salles et événements de l’accueil se chargent indépendamment. Les lectures des catalogues publics et du calendrier des salles sont limitées à 15 secondes ; les appels identiques simultanés sont regroupés, sans conserver les disponibilités en cache après leur réponse. Un échec de chargement de l’accueil ou du parking affiche un message et permet de réessayer.

L’accueil présente une salle du catalogue avec un lien vers sa fiche, le nombre de salles et la capacité de la plus grande salle. Les descriptions des salles sont communes au catalogue et aux fiches. La présence d’une salle au catalogue ne garantit pas un créneau libre ; ses dates sont vérifiées dans le calendrier. L’accès organisateur se demande depuis la page Contact.

Les deux thèmes utilisent les verts, les tons ivoire et les accents brique de MeetSpace. Les fonds des formulaires, calendriers, menus et espaces de gestion suivent les mêmes variables de couleur ; les textes des boutons et des sélections s’adaptent au thème. Les champs des formulaires de gestion et d’inscription sont associés à leurs libellés.

### Disponibilités et conservation des réservations

Les réservations annulées ou refusées libèrent la salle. Les autres statuts continuent à bloquer les chevauchements. Le calendrier vérifie les horaires à la minute, conserve la durée exacte lors d'un déplacement et désactive la validation tant que les disponibilités du mois affiché ne sont pas chargées. Un chargement invalide affiche une erreur avec possibilité de réessayer.

Une publication administrative respecte aussi l'acompte requis pour les événements payants créés par un organisateur. Le paiement du solde exige un événement publié. La suppression d'un événement avec des inscriptions ou des paiements est refusée pour préserver son historique ; un créneau de parking avec des réservations clientes est également conservé. Les seuls accès organisateur gratuits, sans paiement, peuvent être supprimés avec leur créneau.

## Rôles

| Rôle | Responsabilités |
| --- | --- |
| Visiteur | Consulter le catalogue et les disponibilités |
| Client | Réserver, s’inscrire, payer et gérer ses demandes |
| Organisateur | Créer des événements et suivre inscriptions et revenus |
| Administrateur | Valider, superviser, administrer et analyser la plateforme |

## Règles métier principales

- Les prix, capacités et montants à payer sont recalculés côté serveur : le frontend ne constitue jamais la source de vérité.
- Une salle ne peut pas accueillir deux réservations ou événements qui se chevauchent. Les opérations sensibles verrouillent la salle avant le contrôle.
- Un événement soumis par un organisateur doit être approuvé par un administrateur avant sa publication.
- Les 150 places de parking forment un stock physique commun. MeetSpace répartit la capacité entre les événements simultanés, conserve une réserve partagée à plus de 48 heures et libère le reliquat à l’approche de l’événement.
- Le calcul des disponibilités du catalogue inclut aussi les créneaux ouverts qui se chevauchent mais ne sont pas affichés, notamment ceux déjà commencés et les parkings indépendants.
- Une place est incluse pour l’équipe organisatrice ; les participants réservent ensuite leurs propres véhicules dans la limite du quota disponible.
- Un billet d’événement et une réservation de parking possèdent chacun un code d’accès unique. Un second scan ne crée jamais une seconde entrée.
- Les remboursements sont calculés selon l’échéance d’annulation : 100 % au moins 48 heures avant, 50 % entre 24 et 48 heures, puis aucun remboursement à moins de 24 heures.
- Les projections financières sont indicatives et ne remplacent ni une facture ni une comptabilité légale.

## Architecture

| Couche | Technologies |
| --- | --- |
| Backend | Java 17, Spring Boot, Spring Security, Spring Data JPA, Flyway |
| Frontend | React 19, Vite, React Router, i18next |
| Base de données | MySQL 8 |
| Paiement | Stripe |
| Qualité | JUnit, Mockito, ESLint, Playwright, axe-core |
| Exécution | Docker Compose, Vercel, Railway |

```text
.
├── .github/workflows/ci.yml
├── meetspace-backend/
│   ├── src/main/java/
│   ├── src/main/resources/db/migration/
│   ├── src/main/resources/demo/seed-data.sql
│   └── src/test/
├── meetspace-frontend/
│   ├── src/
│   ├── tests/api/
│   └── tests/e2e-browser/
├── docker-compose.yml
└── README.md
```

## Prérequis

- Java 17 ou plus récent ;
- Node.js 20 ou plus récent ;
- MySQL 8 ;
- Maven, ou le wrapper fourni avec le backend ;
- Docker Desktop si le lancement conteneurisé est utilisé.

## Configuration locale

Copier les exemples sans jamais versionner les fichiers réels :

```bat
copy meetspace-backend\.env.example meetspace-backend\.env
copy meetspace-frontend\.env.example meetspace-frontend\.env
```

Le backend local utilise notamment :

```env
SPRING_PROFILES_ACTIVE=dev
DB_URL=jdbc:mysql://localhost:3306/meetspace?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Europe/Brussels
DB_USERNAME=root
DB_PASSWORD=
JWT_SECRET=votre-cle-secrete-minimum-32-caracteres-ici
CORS_ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
APP_DEMO_SEED_ENABLED=true
APP_MAIL_ENABLED=false
APP_TESTING_ALLOWFAKEPAYMENTS=true
```

Le frontend local utilise :

```env
VITE_API_URL=http://localhost:8080
VITE_ALLOW_LOCAL_PAYMENTS=true
```


La clé publique Stripe est fournie à l’exécution par le backend authentifié. Le frontend ne conserve donc aucune clé Stripe figée dans son build.
## Base de données

Flyway est l’unique source de vérité du schéma. Une base MySQL vide est automatiquement reconstruite par les migrations de `meetspace-backend/src/main/resources/db/migration` ; Hibernate valide ensuite le résultat avec `ddl-auto=validate`.

Le jeu de démonstration est séparé dans `meetspace-backend/src/main/resources/demo/seed-data.sql`. Il est :

- idempotent ;
- désactivé par défaut ;
- chargé uniquement si `APP_DEMO_SEED_ENABLED=true` ;
- refusé par le chargeur automatique avec le profil `prod` ;
- composé de comptes réservés au domaine `meetspace-demo.test`.

Il contient 31 comptes, 35 événements répartis de janvier à décembre 2026, 8 salles, des créneaux de parking, des réservations, des inscriptions, des paiements, quelques remboursements de démonstration, des notifications et des éléments en attente de validation. Plusieurs événements partagent une même date dans des salles différentes afin de représenter une programmation réaliste et de vérifier les conflits de planning.

### Comptes du seed local étendu

| Rôle | Adresse | Mot de passe |
| --- | --- | --- |
| Administrateur | `admin.demo@meetspace-demo.test` | `MeetSpaceDemo!2026` |
| Organisateur | `ines.peeters@meetspace-demo.test` | `MeetSpaceDemo!2026` |
| Client | `alice.moreau@meetspace-demo.test` | `MeetSpaceDemo!2026` |

Ces identifiants sont exclusivement destinés au développement et à la démonstration locale.

### Comptes officiels de présentation

Trois comptes actifs couvrent les rôles client, organisateur et administrateur pendant la soutenance. Leur connexion a été vérifiée sur le frontend et l’API de production.

Les identifiants et le mot de passe commun sont consignés dans le manuel d’utilisation remis avec le projet. Ils sont volontairement absents du dépôt public et ne doivent être diffusés que dans le cadre de la démonstration.

## Lancement

Créer une base vide une seule fois :

```bat
mysql -h 127.0.0.1 -P 3306 -u root -e "CREATE DATABASE IF NOT EXISTS meetspace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Backend :

```bat
cd meetspace-backend
mvnw.cmd spring-boot:run
```

Frontend :

```bat
cd meetspace-frontend
npm install
npm run dev -- --port 5174
```

Accès locaux :

```text
Frontend : http://localhost:5174
Backend  : http://localhost:8080
Santé    : http://localhost:8080/actuator/health
```

## Docker Compose

```bat
docker compose up --build
```

Docker Compose crée une base vide, laisse Flyway construire le schéma et active le seed local. Le frontend est exposé sur `http://localhost:5173`. Aucun dump SQL manuel n’est nécessaire.

## Vérification

Backend :

```bat
cd meetspace-backend
mvnw.cmd test
```

Frontend :

```bat
cd meetspace-frontend
node --test tests/public-read.test.mjs
npm run lint
npm run build
```

Recette API, navigateur et accessibilité :

```bat
cd meetspace-frontend
set FRONT_URL=http://127.0.0.1:5174
set API_URL=http://127.0.0.1:8080
set E2E_ADMIN_EMAIL=admin.demo@meetspace-demo.test
set E2E_ADMIN_PASSWORD=MeetSpaceDemo!2026
npm test
```

La CI répète ces contrôles sur une base MySQL vide : tests backend, reconstruction Flyway, lint, build et recette Playwright. La suite comprend 186 tests backend et 71 cas Playwright : 7 scénarios API et 64 scénarios navigateur, parcours métier et accessibilité. Les tests Node complètent la validation des lectures HTTP, des disponibilités et du paiement. Les scénarios financiers utilisent un adaptateur de paiement simulé ; leur réussite ne remplace pas une recette Stripe en mode test.

## Disponibilités, statuts et remboursements

Une journée disponible contient au moins un départ possible pour la durée sélectionnée ; elle peut aussi contenir des périodes occupées. Le calendrier distingue les réservations et événements bloquants, les créneaux limités et les réponses indisponibles. Une réponse invalide ne devient pas une journée libre. Les lectures privées et la sonde de santé disposent également d'un délai et d'une issue explicite.

Le calendrier public des salles et la vérification d'un créneau incluent les blocages temporaires actifs de paiement, sans exposer de jeton ou d'identité du payeur. Les blocages expirés, annulés ou consommés ne sont plus affichés. Un blocage reste distinct d'une réservation, y compris lorsque leurs identifiants numériques sont identiques.

Les écritures HTTP ont également un délai maximal de 15 secondes. Une réponse trop lente indique que l'action a peut-être été enregistrée et invite à vérifier son état avant de la recommencer. Les exports d'agenda interprètent les horaires sans fuseau comme des horaires de Bruxelles, indépendamment du fuseau du navigateur. Les justificatifs se rechargent lors d'un changement de réservation et s'impriment sur fond blanc dans les deux thèmes.

Un changement de rôle ou de statut, un bannissement ou une désactivation invalide les sessions existantes ; une réactivation ne restaure pas les anciens jetons. Le bannissement annule les réservations futures selon leurs conditions de remboursement et désactive les accès parking correspondants, tout en conservant les réservations passées. Une salle liée à des réservations, des événements ou un paiement en cours ne peut pas être supprimée : elle peut être rendue indisponible pour conserver l'historique. Les offres de liste d'attente concernent uniquement les événements publiés et les comptes actifs.

Le formulaire administrateur crée par défaut un événement en attente d'approbation. Son statut est transmis lors de la création et de la modification, avec les mêmes contrôles que la route dédiée. Une annulation est définitive ; un événement publié ne retourne pas en attente. La publication d'un événement organisateur respecte son approbation et son acompte. Les champs financiers détaillés ne sont pas exposés dans les réponses publiques.

Les réservations et les blocages temporaires de paiement partagent l'inventaire de parking. La finalisation exclut uniquement le blocage correspondant au paiement, à son propriétaire et au créneau exact. Le contrôle des QR et les annulations prennent le même premier verrou afin de terminer sans conflit circulaire. Un créneau déjà vendu ne peut pas être déplacé ; les modifications d'allocation pendant un paiement actif sont refusées. Le parking d'un événement interne reste limité à une journée.

La migration Flyway V11 ajoute un journal durable des remboursements. Une tentative conserve sa clé d'opération et son état même si l'écriture de réservation échoue. Les montants remboursés correspondent aux confirmations du prestataire ; une demande en cours ou échouée reste identifiable. L'annulation par le prestataire vise le remboursement complet restant, sans appliquer de nouveau le barème d'annulation du client. Les reprises ne dépassent pas le montant payé.

Le point d'entrée Stripe vérifie les signatures et traite aussi `refund.created`, `refund.updated` et `refund.failed`. Ces événements doivent être configurés sur le webhook de l'environnement utilisé. La compensation des paiements réussis sans réservation et les reprises sont idempotentes. Aucun mode de paiement fictif ne doit être activé en production.

## Déploiement

| Service | URL |
| --- | --- |
| Frontend Vercel | [tfe-meetspace.vercel.app](https://tfe-meetspace.vercel.app) |
| Backend Railway | [tfe-meetspace-production.up.railway.app](https://tfe-meetspace-production.up.railway.app) |
| Santé backend | [actuator/health](https://tfe-meetspace-production.up.railway.app/actuator/health) |

État vérifié le 1er septembre 2026 : frontend accessible, backend `UP`, schéma Flyway validé et communication Vercel-Railway opérationnelle.

La production utilise au minimum les garde-fous suivants :

```env
SPRING_PROFILES_ACTIVE=prod
DDL_AUTO=validate
APP_DEMO_SEED_ENABLED=false
APP_TESTING_ALLOWFAKEPAYMENTS=false
APP_MAIL_ENABLED=true
APP_FRONTEND_URL=https://tfe-meetspace.vercel.app
CORS_ALLOWED_ORIGINS=https://tfe-meetspace.vercel.app
STRIPE_SECRET_KEY=<clé privée Stripe>
STRIPE_PUBLIC_KEY=<clé publique Stripe du même mode>
STRIPE_WEBHOOK_SECRET=<secret du webhook Railway>
BREVO_API_KEY=<clé privée Brevo>
BREVO_FROM_EMAIL=<adresse d’expédition vérifiée dans Brevo>
SUPPORT_ADMIN_EMAIL=<adresse qui reçoit les demandes du formulaire Contact>

```
En production Railway, l’envoi passe en priorité par l’API HTTPS de Brevo. Resend reste disponible pour un domaine vérifié et SMTP sert de dernier recours en local ou sur une offre autorisant ces connexions.

Les valeurs MySQL, JWT, Stripe, Brevo, Resend et SMTP restent exclusivement dans les variables privées des plateformes. Le build Vercel reçoit uniquement `VITE_API_URL` avec l’URL Railway active ; aucune valeur sensible n’est stockée dans le dépôt.

Points de contrôle après chaque déploiement :

- Flyway applique toutes les migrations versionnées disponibles ainsi que les migrations répétables de correction de données ;
- Vercel autorise la caméra pour le contrôle des billets (`Permissions-Policy: camera=(self)`) ;
- les clés Stripe publique et privée appartiennent au même mode (`test` ou `live`) ;
- le webhook Stripe cible `https://tfe-meetspace-production.up.railway.app/api/payments/webhook` ;
- `APP_MAIL_ENABLED=true` n’est activé qu’avec une configuration Brevo, Resend ou SMTP complète ;
- `BREVO_FROM_EMAIL` correspond à un expéditeur vérifié dans Brevo ;
- `SUPPORT_ADMIN_EMAIL` contient une adresse distribuable ;
- Brevo est prioritaire, puis Resend, puis SMTP ;
- une configuration Resend sans domaine vérifié reste limitée à l’adresse du compte Resend ;
- les comptes de démonstration en `.test` ne reçoivent volontairement aucun e-mail ;
- le frontend charge la configuration de paiement depuis `GET /api/payments/config` après connexion ;
- un même billet peut être scanné plusieurs fois sans créer plusieurs entrées : le contrôle est idempotent.
- une même réservation de parking conserve un QR code unique, contrôlable depuis l’espace administrateur.

Lors de la vérification du 1er septembre 2026, les catalogues publics de production exposaient 8 espaces, 22 événements et 22 sessions de parking. Les dates de démonstration enrichies comportent plusieurs événements dans des salles différentes. Aucun chevauchement salle-événement ni salle-réservation n’a été détecté.

## Limites connues

- Les versements automatiques aux organisateurs par Stripe Connect ne sont pas encore activés.
- Les tableaux financiers servent au pilotage et à la démonstration ; ils ne constituent pas une comptabilité certifiée.
- Les comptes de démonstration utilisant le domaine `.test` ne peuvent pas recevoir de véritables e-mails.
- Les faux paiements sont réservés au profil local et restent bloqués en production.

## Sécurité et règles de dépôt

- aucun secret, fichier `.env`, log, sauvegarde locale ou résultat de test ne doit être versionné ;
- les routes de catalogue sont publiques, les réservations et données personnelles exigent un JWT valide ;
- les routes organisateur et administrateur vérifient le rôle ;
- le chargement automatique du seed et les faux paiements restent interdits en production ;
- Swagger est désactivé avec le profil `prod` ;
- les montants de paiement sont calculés côté serveur et stockés en centimes dans le registre de paiement ;
- la création, la modification, la validation et le déplacement d’un événement verrouillent la salle avant de contrôler les chevauchements ;
- les contraintes MySQL protègent capacités, périodes, quantités et montants négatifs.

Les indicateurs financiers servent au pilotage et à la démonstration. Ils ne remplacent pas une comptabilité légale.
