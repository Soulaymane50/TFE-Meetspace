# Guide des agents — MeetSpace

Ces règles s'appliquent à tout le dépôt. Un fichier `AGENTS.md` plus profond peut les compléter pour son dossier.

## Langue et objectif

- Communiquer avec l'utilisateur en français clair.
- Produire une application de démonstration crédible, cohérente avec la version réellement déployée et le rapport de TFE.
- Ne jamais présenter une fonctionnalité comme validée sans preuve proportionnée : test, build, appel API ou vérification visuelle.

## Avant toute modification

1. Lire la demande actuelle et ne pas reprendre aveuglément d'anciennes consignes.
2. Exécuter `git status --short --branch` et préserver toutes les modifications existantes.
3. Lire les fichiers concernés et rechercher les usages associés avec `rg`.
4. Délimiter le changement avant d'éditer. Ne pas lancer de refonte voisine sans demande explicite.
5. Pour un bug déployé, distinguer systématiquement : code local, commit Git, dépôt distant et déploiement actif.

## Architecture

- `meetspace-frontend/` : React 19, Vite, React Router, i18next et Playwright.
- `meetspace-backend/` : Spring Boot, API REST, Spring Security/JWT, JPA et Stripe.
- `meetspace-backend/src/main/resources/db/migration/` : migrations Flyway MySQL.
- Frontend public : Vercel. Backend et base de données : Railway.
- Le backend et la base constituent la source de vérité pour les prix, paiements, disponibilités, permissions et capacités.

Le code exécuté et les migrations priment sur les documents historiques. Quand un changement de produit est validé, mettre aussi à jour le README et la documentation explicitement concernés.

## Règles métier à protéger

- Une salle ne peut jamais être réservée par deux opérations qui se chevauchent. Utiliser des intervalles demi-ouverts `[début, fin)` et refaire la vérification côté serveur dans la transaction d'écriture.
- Le parking possède **150 places physiques au total par créneau simultané**. Ne jamais additionner des disponibilités de jours ou d'événements différents pour afficher une capacité globale.
- Les allocations de parking doivent tenir compte de tous les événements et réservations qui se chevauchent. Une place participante produit un accès et un QR code propre, contrôlable de façon idempotente.
- Un événement reste non publié tant que les conditions d'approbation et de paiement prévues ne sont pas remplies.
- Après approbation administrative, l'acompte est exigible immédiatement ; sa confirmation autorise la publication. Le solde suit la règle métier configurée, notamment l'échéance de 48 h après l'événement.
- La commission MeetSpace reste à 10 % tant qu'une demande explicite ne modifie pas ce choix documenté.
- Toute somme affichée côté client est indicative : le serveur recalcule le montant final à partir des données persistées.
- Les paiements doivent être idempotents. Ne jamais faire confiance à un statut fourni par le navigateur ; vérifier les événements Stripe côté serveur.
- Les QR codes et codes d'accès sont opaques, non prédictibles, limités au bon type de réservation et leur validation répétée ne doit pas doubler une entrée.
- Les contrôles de rôle et de propriété sont réalisés côté serveur même si l'interface masque déjà l'action.
- Les paiements fictifs et adresses en `.local`/`.test` restent réservés aux environnements de développement ou de démonstration explicitement identifiés.

## Interface et contenu

- Respecter la direction artistique MeetSpace actuelle : vert profond, fond ivoire, accent brique modéré. Ne pas réintroduire l'ancienne palette bleue.
- Ne jamais laisser apparaître `INTERNAL_ERROR`, `??`, une clé i18n, un texte illisible ou un squelette de chargement sans issue.
- Pour tout nouveau texte fonctionnel, mettre à jour `fr.json`, `en.json` et `nl.json`. Le français sert de référence sémantique.
- Les états de chargement doivent avoir un délai raisonnable, un message d'échec exploitable et une possibilité de réessayer quand elle a du sens.
- Préserver l'accessibilité clavier, les libellés, les contrastes et les zones tactiles.
- Optimiser les images et éviter les appels API séquentiels inutiles, les rafraîchissements complets et les calculs répétés au rendu.

## Base de données et migrations

- Créer une nouvelle migration Flyway numérotée pour toute évolution de schéma ou de données déployables.
- Ne jamais modifier une migration déjà exécutée en production.
- Rendre les migrations déterministes et compatibles avec les données existantes ; prévoir valeurs par défaut, reprise de données et contraintes dans le bon ordre.
- Les jeux de démonstration doivent rester crédibles : dates, capacités, prix, statuts et chevauchements cohérents jusqu'à fin 2026.

## Sécurité et secrets

- Ne jamais lire à voix haute, afficher, journaliser, committer ou copier dans un fichier suivi une clé Stripe, Brevo, Railway, Vercel, un mot de passe ou un jeton.
- Utiliser des variables d'environnement ; fournir uniquement des noms de variables et valeurs factices dans les exemples.
- Ne pas relâcher CORS, l'authentification, l'autorisation ou la validation pour contourner un test.
- Valider les entrées, limiter les informations des erreurs publiques et conserver les détails techniques dans les journaux serveur.

## Validation minimale

Choisir la validation proportionnée au changement, puis annoncer ce qui a réellement été exécuté.

Frontend :

```powershell
cd meetspace-frontend
npm run lint
npm run build
```

Backend :

```powershell
cd meetspace-backend
.\mvnw.cmd test
```

Parcours critique ou correction d'interface :

```powershell
cd meetspace-frontend
npm test
```

- Privilégier un test ciblé pendant l'itération, puis le lint/build et les tests de non-régression pertinents.
- Vérifier visuellement les parcours touchés sur desktop et sur une largeur mobile.
- Pour paiement, e-mail, QR code, calendrier, disponibilité ou rôle, tester le flux complet navigateur → API → base → réponse.
- Une compilation réussie ne prouve pas qu'un déploiement est à jour.

## Git et déploiement

- Ne jamais utiliser `git add .`, `git add -A`, `git reset --hard`, `git checkout --`, `git clean`, un stash global ou un force-push.
- Ajouter seulement les chemins explicitement vérifiés. Contrôler `git diff --cached` avant chaque commit.
- Ne pas committer, pousser, déployer, promouvoir ou modifier des variables distantes sans demande explicite de l'utilisateur.
- Les messages de commit doivent être en français et suivre le style déjà utilisé dans l'historique.
- Ne pas amender ou réécrire l'historique sans autorisation explicite.
- Après un push, vérifier le SHA distant. Après un déploiement, vérifier son état et un parcours de santé réel.

## Travail avec des sous-agents

- Déléguer des tâches bornées et indépendantes avec un résultat vérifiable.
- Éviter que deux agents modifient le même fichier en parallèle.
- Les sous-agents n'effectuent ni commit, ni push, ni déploiement et ne touchent pas aux secrets sauf instruction explicite du responsable principal.
- Le responsable principal relit les changements partagés, résout les interactions, exécute la validation finale et reste seul responsable du compte rendu.

## Compte rendu

Toujours terminer par : résultat obtenu, fichiers ou zones touchés, validations exécutées, état Git/commit/push/déploiement et limites restantes. Ne jamais confondre « corrigé localement » avec « visible en production ».
