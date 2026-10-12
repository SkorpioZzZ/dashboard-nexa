# Nexa — tableau de suivi de projet

Nexa est une application web de suivi de projets et de tâches. Elle permet de créer des projets, de suivre leur avancement dans un tableau Kanban, de partager un projet avec d’autres comptes Nexa et de consulter les échéances et l’activité.

L’application est composée d’une interface React/Vite, d’une API Node.js/Express et d’une base PostgreSQL. Les projets, les tâches, les comptes et les événements d’activité sont stockés dans PostgreSQL.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Prérequis](#prérequis)
- [Installation et démarrage](#installation-et-démarrage)
- [Créer un compte et se connecter](#créer-un-compte-et-se-connecter)
- [Utiliser Nexa](#utiliser-nexa)
- [Partage et rôles](#partage-et-rôles)
- [Données et confidentialité locale](#données-et-confidentialité-locale)
- [Configuration](#configuration)
- [Commandes utiles](#commandes-utiles)
- [API](#api)
- [Dépannage](#dépannage)
- [Structure du projet](#structure-du-projet)

## Fonctionnalités

- Création de compte, connexion et déconnexion.
- Gestion du profil, changement de mot de passe et suppression du compte.
- Création, modification, suppression et partage de projets.
- Création, modification, suppression et déplacement des tâches entre les colonnes Kanban.
- Suivi des tâches par statut : **À faire**, **En cours**, **En revue** et **Terminé**.
- Calcul de l’avancement des projets à partir de leurs tâches.
- Liste des tâches et filtres pour les tâches terminées ou en retard.
- Calendrier des échéances de projets et de tâches.
- Historique des activités sur les projets et les tâches.
- Préférences d’affichage, paramètres de compte et raccourcis personnalisés.

## Prérequis

- **Node.js 22.22.2 ou plus récent dans la branche 22**, **24.15 ou plus récent dans la branche 24**, ou **26 ou plus récent**. Ces versions satisfont les exigences de Vite utilisées par le projet.
- **npm**, fourni avec Node.js.
- **Docker** avec Docker Compose, démarré et accessible depuis le terminal. Docker lance PostgreSQL pour le développement local.

Vérifie les outils avec :

```bash
node --version
npm --version
docker --version
docker compose version
```

## Installation et démarrage

Depuis la racine du projet — le dossier qui contient `package.json`, `client/`, `server/` et `docker-compose.yml` :

1. Installe les dépendances de l’interface et de l’API :

   ```bash
   npm ci --prefix client
   npm ci --prefix server
   ```

2. Crée le fichier de configuration local de l’API :

   ```bash
   cp server/.env.example server/.env
   ```

   Dans `server/.env`, remplace `SESSION_SECRET` par une valeur aléatoire privée d’au moins 32 caractères. Par exemple, génère une valeur avec :

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Copie le résultat après `SESSION_SECRET=`. Ne partage pas ce secret et ne le commite pas dans Git.

3. Démarre l’application depuis la racine :

   ```bash
   npm run dev
   ```

   Le script démarre PostgreSQL avec Docker Compose, puis l’API et le serveur de développement Vite.

4. Ouvre **http://127.0.0.1:5173** dans ton navigateur. Garde le terminal ouvert pendant l’utilisation de Nexa.

Au premier démarrage, l’API crée les tables PostgreSQL nécessaires. L’API répond à **http://localhost:3000** et son endpoint de santé est **http://localhost:3000/api/health**.

> Utilise toujours `http://127.0.0.1:5173` pour l’interface. La session est transmise par un cookie et l’API autorise les adresses locales configurées dans le projet.

## Créer un compte et se connecter

Sur la page d’accueil, sélectionne **Nouveau sur Nexa ? Créer un compte**, puis renseigne :

- ton prénom et ton nom ;
- un nom d’utilisateur de 3 à 30 caractères (lettres, chiffres, point, tiret ou tiret bas) ;
- une adresse e-mail ;
- un mot de passe d’au moins 8 caractères.

L’adresse e-mail et le nom d’utilisateur doivent être uniques. Lors des prochaines visites, connecte-toi avec l’adresse e-mail et le mot de passe du compte. Aucun compte ou mot de passe de démonstration n’est fourni.

Pour te déconnecter, utilise le bouton de déconnexion dans la navigation. Pour changer ton mot de passe ou supprimer ton compte, ouvre **Paramètres → Compte**. La suppression d’un compte nécessite le mot de passe et la saisie de `SUPPRIMER` ; elle supprime aussi ses projets, tâches et accès partagés.

## Utiliser Nexa

### Vue d’ensemble

La page **Vue d’ensemble** affiche les indicateurs des projets et des tâches, les projets suivis, les tâches à venir, l’activité récente et les raccourcis disponibles.

### Projets

Dans **Projets**, crée un projet avec un nom, un client et une échéance ; la description est facultative. La fiche d’un projet donne accès à son tableau Kanban, à ses tâches et au partage du projet. Son avancement est calculé depuis le nombre de tâches terminées.

### Tâches et tableau Kanban

Une tâche appartient à un projet et peut avoir un responsable, une échéance et un statut. Depuis le Kanban du projet, tu peux ajouter une tâche, la modifier, la supprimer ou la déplacer vers une autre colonne. La liste **Tâches** permet de consulter l’ensemble des tâches accessibles et de filtrer les tâches terminées ou en retard.

### Calendrier et activité

Le **Calendrier** rassemble les échéances des projets et des tâches. Les préférences permettent de choisir le premier jour de la semaine, le format des dates et le fuseau horaire. **Activité** conserve l’historique des actions effectuées sur les projets et les tâches.

### Équipe, e-mail et raccourcis

- **Équipe** est un carnet local à ce navigateur pour gérer des fiches de personnes (nom, e-mail et rôle libre). Ces fiches ne créent pas de comptes et ne donnent pas accès aux projets.
- **Email** affiche des exemples d’e-mails pour illustrer l’écran. Aucune boîte e-mail n’est connectée.
- **Raccourcis** ouvre des liens web, avec quelques raccourcis proposés par défaut. Les raccourcis ajoutés ou retirés sont conservés dans le navigateur.

### Paramètres

Les préférences générales, l’apparence et les options de notifications sont enregistrées localement dans le navigateur. Les réglages de notifications sont des préférences d’interface : l’application n’envoie pas actuellement d’e-mails ou de notifications.

## Partage et rôles

Le partage s’effectue depuis la fiche d’un projet, en renseignant l’adresse e-mail d’un compte Nexa existant. Le propriétaire peut retirer les membres et leur attribuer un rôle :

| Rôle | Autorisations sur les tâches du projet |
| --- | --- |
| Lecteur | Consulter le projet et ses tâches |
| Contributeur | Créer et modifier des tâches |
| Éditeur | Créer, modifier et supprimer des tâches |

Le propriétaire conserve la gestion du projet et de ses membres. Les projets partagés apparaissent dans l’espace des personnes invitées. L’interface actualise les projets, les tâches et l’activité partagés périodiquement.

## Données et confidentialité locale

En configuration de développement, PostgreSQL tourne dans un conteneur Docker. Le volume nommé `nexa-postgres` conserve les données lorsque le serveur ou le conteneur est arrêté. Les données sont stockées sur l’ordinateur où Docker fonctionne ; ce dépôt ne configure pas d’hébergement distant ni de sauvegarde externe.

Les préférences, les liens de raccourci et le carnet de l’équipe sont conservés dans le stockage local du navigateur. Ils ne sont pas synchronisés avec PostgreSQL et ne suivent pas automatiquement l’utilisateur vers un autre navigateur ou appareil. Les aperçus de la page Email sont des exemples statiques.

Les mots de passe des comptes sont hachés côté serveur avec scrypt. La session est conservée dans un cookie signé `HttpOnly`, valable sept jours. En production, l’API marque ce cookie `Secure` lorsque `NODE_ENV=production` ; la configuration et le déploiement de production restent à mettre en place séparément.

## Configuration

Le fichier `server/.env.example` documente les variables de l’API :

| Variable | Valeur locale indiquée | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port de l’API |
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:5433/project_dashboard` | Connexion à PostgreSQL publiée par Docker Compose |
| `CLIENT_URL` | `http://localhost:5173` | Origine de l’interface autorisée par CORS |
| `SESSION_SECRET` | À remplacer | Secret de signature des sessions, au moins 32 caractères aléatoires |

Docker Compose publie PostgreSQL sur le port **5433** de l’ordinateur et utilise le port **5432** à l’intérieur du conteneur. Modifie `DATABASE_URL` si tu changes le port, la base ou les identifiants.

## Commandes utiles

À exécuter depuis la racine du projet :

| Commande | Action |
| --- | --- |
| `npm run dev` | Démarre PostgreSQL, l’API et l’interface |
| `docker compose stop postgres` | Arrête PostgreSQL sans supprimer les données |
| `docker compose start postgres` | Redémarre le conteneur PostgreSQL existant |
| `docker compose down` | Arrête et retire le conteneur ; le volume de données est conservé |
| `npm run build --prefix client` | Génère la version de production de l’interface dans `client/dist/` |
| `npm run lint --prefix client` | Lance Oxlint sur l’interface |
| `npm start --prefix server` | Lance l’API sans le mode de développement Nodemon |
| `npm test --prefix server` | Lance Jest côté serveur (aucune suite de tests n’est actuellement fournie dans le dépôt) |

Pour arrêter l’ensemble des processus lancés par `npm run dev`, fais **Ctrl+C** dans le terminal.

> `docker compose down -v` supprime aussi le volume PostgreSQL et donc les comptes, projets et tâches stockés. N’utilise cette commande que si tu veux réellement effacer ces données.

## API

Toutes les routes de données et de compte nécessitent une session valide, sauf l’inscription, la connexion et la vérification de santé.

| Méthode et route | Usage |
| --- | --- |
| `GET /api/health` | Vérifier que l’API répond |
| `POST /api/auth/register` | Créer un compte |
| `POST /api/auth/login` | Ouvrir une session |
| `GET /api/auth/me` | Lire le compte connecté |
| `POST /api/auth/logout` | Fermer la session |
| `PATCH /api/auth/profile` | Modifier le profil |
| `POST /api/auth/change-password` | Changer le mot de passe |
| `DELETE /api/auth/account` | Supprimer le compte après vérification du mot de passe |
| `GET /api/projects` | Lister les projets accessibles |
| `POST /api/projects` | Créer un projet |
| `PATCH /api/projects/:id` | Modifier un projet |
| `DELETE /api/projects/:id` | Supprimer un projet |
| `POST /api/projects/:id/members` | Partager un projet avec un compte existant |
| `PATCH /api/projects/:id/members/:memberId` | Modifier le rôle d’un membre |
| `DELETE /api/projects/:id/members/:memberId` | Retirer un membre |
| `GET /api/tasks` | Lister les tâches accessibles |
| `POST /api/tasks` | Créer une tâche |
| `PATCH /api/tasks/:id` | Modifier une tâche |
| `DELETE /api/tasks/:id` | Supprimer une tâche |
| `GET /api/activity` | Consulter l’historique d’activité |

Les réponses sont au format JSON. Les requêtes d’authentification et les opérations avec cookie doivent transmettre les identifiants (`credentials: 'include'` côté navigateur).

## Dépannage

### Docker ne démarre pas

Démarre Docker Desktop ou le service Docker, puis vérifie que ton compte peut exécuter `docker compose`. Relance ensuite `npm run dev`.

### Le port 5433 est déjà utilisé

Le projet publie PostgreSQL sur `5433` pour limiter les conflits avec une installation PostgreSQL locale utilisant `5432`. Libère le port ou modifie ensemble le port publié dans `docker-compose.yml` et `DATABASE_URL` dans `server/.env`.

### L’interface ne peut pas joindre l’API

Vérifie que les deux messages de démarrage de l’API et de Vite apparaissent dans le terminal, que PostgreSQL est lancé, et que le fichier `server/.env` existe avec un `SESSION_SECRET` renseigné. Ouvre l’interface à l’adresse **http://127.0.0.1:5173**. Ne mélange pas `localhost` et `127.0.0.1` dans les adresses de l’interface et les réglages locaux.

### « Initialisation PostgreSQL impossible »

L’API n’a pas pu se connecter à PostgreSQL ou créer ses tables. Vérifie que le conteneur est actif (`docker compose ps`), que `DATABASE_URL` correspond au port et aux identifiants configurés, puis relance `npm run dev`. Consulte l’erreur complète affichée dans le terminal.

### L’adresse e-mail ou le nom d’utilisateur est déjà utilisé

Chaque adresse e-mail et chaque nom d’utilisateur ne peuvent être associés qu’à un seul compte. Connecte-toi avec le compte existant ou choisis une autre adresse/un autre nom d’utilisateur.

### Retrouver ou effacer les données

Les données PostgreSQL restent dans le volume Docker `nexa-postgres` après un arrêt normal. Pour effacer toutes les données locales du projet, arrête les services et supprime volontairement ce volume avec `docker compose down -v`.

## Structure du projet

```text
.
├── client/                 # Interface React et configuration Vite
│   └── src/                # Pages, composants et styles
├── server/                 # API Express et accès PostgreSQL
│   ├── src/server.js       # Routes API et authentification
│   ├── src/db.js           # Connexion et initialisation de la base
│   └── .env.example        # Exemple de configuration locale
├── scripts/dev.js          # Démarrage coordonné de Docker, API et interface
├── docker-compose.yml      # Service PostgreSQL de développement
└── package.json            # Commande de développement à la racine
```

Pour des précisions sur l’API et l’interface, consulte aussi [server/README.md](server/README.md) et [client/README.md](client/README.md).
