# MeetSpace

MeetSpace est une plateforme de réservation pour un centre de conférences à Bruxelles. Elle réunit dans une même application les salles professionnelles, les événements B2B et le parking associé.

Le produit couvre quatre usages distincts : la consultation publique, la réservation par un client, l’organisation d’événements et l’administration opérationnelle et financière de la plateforme.

## Fonctionnalités

- catalogue public des salles, événements et créneaux de parking ;
- disponibilité des salles et réservation par créneau ;
- inscription aux événements, capacité, liste d’attente et parking lié ;
- demandes de salles premium avec validation et échéance de paiement ;
- espace client pour les réservations, paiements, annulations et profil ;
- espace organisateur pour créer, soumettre et suivre ses événements ;
- administration des utilisateurs, espaces, événements, parkings et validations ;
- suivi financier distinct pour l’administrateur et l’organisateur ;
- authentification JWT, révocation des sessions et états de compte ;
- paiement Stripe avec mode local strictement réservé au développement ;
- notifications persistantes, e-mails configurables et journal d’audit ;
- interface responsive en français, anglais et néerlandais, avec thèmes clair et sombre.

## Rôles

| Rôle | Responsabilités |
| --- | --- |
| Visiteur | Consulter le catalogue et les disponibilités |
| Client | Réserver, s’inscrire, payer et gérer ses demandes |
| Organisateur | Créer des événements et suivre inscriptions et revenus |
| Administrateur | Valider, superviser, administrer et analyser la plateforme |

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
VITE_STRIPE_PUBLIC_KEY=
VITE_ALLOW_LOCAL_PAYMENTS=true
```

## Base de données

Flyway est l’unique source de vérité du schéma. Une base MySQL vide est automatiquement reconstruite par les migrations de `meetspace-backend/src/main/resources/db/migration` ; Hibernate valide ensuite le résultat avec `ddl-auto=validate`.

Le jeu de démonstration est séparé dans `meetspace-backend/src/main/resources/demo/seed-data.sql`. Il est :

- idempotent ;
- désactivé par défaut ;
- chargé uniquement si `APP_DEMO_SEED_ENABLED=true` ;
- refusé par le chargeur automatique avec le profil `prod` ;
- composé de comptes réservés au domaine `meetspace-demo.test`.

Il contient 31 comptes, 27 événements répartis de janvier à décembre 2026, 8 salles, des créneaux de parking, des réservations, des inscriptions, des paiements, quelques remboursements de démonstration, des notifications et des éléments en attente de validation.

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

La CI répète ces contrôles sur une base MySQL vide : tests backend, reconstruction Flyway, lint, build et recette Playwright. La dernière validation complète comporte 28 tests backend et 42 scénarios API, navigateur et accessibilité ; une recette complémentaire de 15 scénarios a également été exécutée sur la production.

## Déploiement

| Service | URL |
| --- | --- |
| Frontend Vercel | [tfe-meetspace.vercel.app](https://tfe-meetspace.vercel.app) |
| Backend Railway | [tfe-meetspace-production.up.railway.app](https://tfe-meetspace-production.up.railway.app) |
| Santé backend | [actuator/health](https://tfe-meetspace-production.up.railway.app/actuator/health) |

État vérifié le 22 août 2026 : frontend accessible, backend `UP`, schéma Flyway validé et communication Vercel-Railway opérationnelle.

La production utilise au minimum les garde-fous suivants :

```env
SPRING_PROFILES_ACTIVE=prod
DDL_AUTO=validate
APP_DEMO_SEED_ENABLED=false
APP_TESTING_ALLOWFAKEPAYMENTS=false
APP_MAIL_ENABLED=false
APP_FRONTEND_URL=https://tfe-meetspace.vercel.app
CORS_ALLOWED_ORIGINS=https://tfe-meetspace.vercel.app
```

Les valeurs MySQL, JWT, Stripe et SMTP restent exclusivement dans les variables privées des plateformes. Le build Vercel reçoit `VITE_API_URL` avec l’URL Railway active ; aucune valeur sensible n’est stockée dans le dépôt.

Lors de la dernière vérification, les catalogues publics de production exposaient 8 espaces, 15 événements futurs et 10 sessions de parking.

## Sécurité et règles de dépôt

- aucun secret, fichier `.env`, log, sauvegarde locale ou résultat de test ne doit être versionné ;
- les routes de catalogue sont publiques, les réservations et données personnelles exigent un JWT valide ;
- les routes organisateur et administrateur vérifient le rôle ;
- le chargement automatique du seed et les faux paiements restent interdits en production ;
- Swagger est désactivé avec le profil `prod` ;
- les montants de paiement sont calculés côté serveur et stockés en centimes dans le registre de paiement ;
- les contraintes MySQL protègent capacités, périodes, quantités et montants négatifs.

Les indicateurs financiers servent au pilotage et à la démonstration. Ils ne remplacent pas une comptabilité légale.
