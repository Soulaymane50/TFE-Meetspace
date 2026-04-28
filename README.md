# MeetSpace

MeetSpace est une plateforme de reservation de salles, d'evenements professionnels et de parking.

## Fonctionnalites

- consultation et reservation de salles
- inscription a des evenements professionnels
- consultation et reservation de places de parking
- authentification JWT
- espace administrateur pour gerer les salles, evenements, utilisateurs, reservations et logs
- interface multilingue FR / EN / NL
- mode clair et mode sombre

## Stack

- Backend : Java 17, Spring Boot, Spring Security, JPA, MySQL
- Frontend : React, Vite, React Router, i18next
- Paiement : Stripe
- Tests frontend : Playwright

## Structure

```text
meetspace-backend/   API Spring Boot
meetspace-frontend/  application React
init/                dump SQL de depart
docker-compose.yml   services locaux
README.md            documentation projet
```

## Configuration

Le backend utilise des variables d'environnement. Un exemple est disponible ici :

```text
meetspace-backend/.env.example
```

Le frontend utilise aussi un fichier d'exemple :

```text
meetspace-frontend/.env.example
```

Les vrais fichiers `.env` ne doivent pas etre versionnes.

## Base de donnees

Le dump principal se trouve dans :

```text
init/Dump_meetspace.sql
```

Exemple d'import local :

```bat
mysql -h 127.0.0.1 -P 3306 -u root -e "DROP DATABASE IF EXISTS meetspace; CREATE DATABASE meetspace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -h 127.0.0.1 -P 3306 -u root meetspace < init\Dump_meetspace.sql
```

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
Frontend : http://localhost:5174
Backend  : http://localhost:8080
```

Endpoints publics utiles :

```text
GET /api/public/events
GET /api/public/espaces
GET /api/public/parking/sessions
```

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
