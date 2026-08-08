# MeetSpace

MeetSpace est une application web de reservation pour un centre de conferences : salles professionnelles, evenements B2B et parking associe.

Le projet couvre le parcours complet d'un visiteur, d'un client connecte, d'un organisateur et d'un administrateur. L'objectif est de proposer une plateforme claire pour consulter les disponibilites, reserver une salle, s'inscrire a un evenement, gerer des places de parking et suivre l'activite du centre.

## Fonctionnalites principales

- consultation publique des salles, evenements et creneaux de parking ;
- reservation de salles avec planning de disponibilite ;
- inscription a des evenements professionnels ;
- reservation de parking liee aux venues ;
- authentification JWT et gestion des roles ;
- espace client pour les reservations, inscriptions et profil ;
- espace organisateur pour creer et suivre des evenements ;
- dashboard admin pour valider, superviser et analyser les donnees ;
- paiement Stripe avec configuration locale securisee ;
- interface multilingue FR / EN / NL ;
- theme clair / sombre responsive.

## Roles

| Role | Objectif |
| --- | --- |
| Visiteur | Consulter les salles, evenements et parkings disponibles |
| Client | Reserver une salle, s'inscrire a un evenement, reserver du parking |
| Organisateur | Creer et suivre des evenements professionnels |
| Admin | Valider, gerer la plateforme et analyser l'activite |

## Stack technique

| Partie | Technologies |
| --- | --- |
| Backend | Java 17, Spring Boot, Spring Security, Spring Data JPA |
| Frontend | React 19, Vite, React Router, i18next |
| Base de donnees | MySQL 8 |
| Paiement | Stripe |
| Tests frontend | ESLint, Playwright |
| Conteneurs | Docker Compose |

## Structure du projet

```text
.
├── init/
│   └── Dump_meetspace.sql
├── meetspace-backend/
│   ├── src/
│   ├── .env.example
│   └── pom.xml
├── meetspace-frontend/
│   ├── src/
│   ├── .env.example
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Prerequis

- Java 17
- Node.js 20+
- MySQL 8
- Maven Wrapper fourni avec le backend
- Docker Desktop, optionnel

## Configuration locale

Creer les fichiers d'environnement a partir des exemples :

```bat
copy meetspace-backend\.env.example meetspace-backend\.env
copy meetspace-frontend\.env.example meetspace-frontend\.env
```

Variables importantes cote backend :

```env
SPRING_PROFILES_ACTIVE=prod
DB_URL=jdbc:mysql://localhost:3306/meetspace?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Europe/Brussels
DB_USERNAME=root
DB_PASSWORD=
JWT_SECRET=votre-cle-secrete-minimum-32-caracteres-ici
CORS_ALLOWED_ORIGINS=http://localhost:5174
APP_TESTING_ALLOWFAKEPAYMENTS=false
```

Variables importantes cote frontend :

```env
VITE_API_URL=http://localhost:8080
VITE_STRIPE_PUBLIC_KEY=
VITE_ALLOW_LOCAL_PAYMENTS=true
```

Les vrais fichiers `.env` ne doivent jamais etre versionnes.

## Base de donnees

Le dump de demonstration se trouve dans :

```text
init/Dump_meetspace.sql
```

Import local :

```bat
mysql -h 127.0.0.1 -P 3306 -u root -e "DROP DATABASE IF EXISTS meetspace; CREATE DATABASE meetspace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -h 127.0.0.1 -P 3306 -u root meetspace < init\Dump_meetspace.sql
```

Tables principales :

- `event`
- `event_registration`
- `espace`
- `espace_reservation`
- `parking_slot`
- `parking_reservation`
- `utilisateur`

## Lancement local

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

URLs locales :

```text
Frontend : http://localhost:5174 avec la commande Vite ci-dessus
Backend  : http://localhost:8080
```

## Lancement avec Docker

```bat
docker compose up --build
```

Docker Compose lance MySQL, le backend et le frontend sur `http://localhost:5173`. Le dump SQL du dossier `init/` est importe automatiquement au premier demarrage du volume MySQL.

Pour un deploiement separe, le frontend doit recevoir `VITE_API_URL` au moment du build (URL publique du backend Railway). Le backend doit recevoir `APP_FRONTEND_URL` et `CORS_ALLOWED_ORIGINS` avec l'URL publique exacte du frontend, actuellement `https://tfe-meetspace.vercel.app`.

## Endpoints utiles

```text
GET /api/public/events
GET /api/public/espaces
GET /api/public/parking/sessions
```

Les endpoints admin et organizer sont proteges par JWT et par role.

## Verification

Backend :

```bat
cd meetspace-backend
mvnw.cmd -DskipTests compile
```

Frontend :

```bat
cd meetspace-frontend
npm run lint
npm run build
```

Tests Playwright :

```bat
cd meetspace-frontend
npm run test
```

## Notes de securite

- aucune vraie cle Stripe, JWT ou base de donnees ne doit etre committee ;
- le mode fake payment doit rester reserve au local/test ;
- en production, `APP_TESTING_ALLOWFAKEPAYMENTS=false` ;
- le backend utilise `ddl-auto=validate` et `show-sql=false` via configuration d'environnement ;
- les fichiers generes (`node_modules`, `dist`, `target`, logs, caches) sont exclus du versionnement.

## Objectif produit

MeetSpace doit rester une plateforme simple a comprendre :

- un client reserve ou participe ;
- un organisateur cree des evenements ;
- un administrateur valide, controle et analyse ;
- le parking reste un service complementaire lie aux venues.

La logique economique affichee dans l'application est indicative : elle sert au suivi et a la demonstration, sans remplacer une comptabilite officielle.
