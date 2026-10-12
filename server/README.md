# Nexa — API et comptes

Pour les instructions destinées aux utilisateurs — démarrage, création de compte, connexion et dépannage — consulte le [README principal](../README.md).

L’API utilise PostgreSQL local et gère les comptes, les sessions, les projets et les tâches. Elle est démarrée avec l’interface par la commande `npm run dev` depuis la racine du projet.

## Routes API

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` et `POST /api/auth/logout` gèrent les comptes et les sessions.
- `/api/projects` et `/api/tasks` permettent de lire, créer, modifier et supprimer les données du compte connecté.
- `GET /api/health` vérifie que l’API répond.

Les mots de passe sont hachés avec scrypt. La session utilise un cookie signé, HttpOnly et SameSite=Lax, valable sept jours et vérifié avec la version de session stockée sur le compte. La déconnexion et le changement de mot de passe révoquent les anciens cookies. Les cookies émis avant la migration du schéma doivent être renouvelés en se reconnectant.

## Limitation des tentatives

Les compteurs sont partagés entre les processus API dans PostgreSQL. La connexion est limitée à 20 tentatives par adresse IP sur une fenêtre fixe de 15 minutes, l’inscription à 5 par IP sur une heure, et le changement de mot de passe ainsi que la suppression de compte à 5 tentatives par utilisateur et IP sur 15 minutes. Une limite atteinte renvoie `429` avec `Retry-After`. Les compteurs sont pseudonymisés avec le secret de session et les entrées expirées sont nettoyées périodiquement. Une panne de PostgreSQL bloque temporairement ces opérations avec `503`, sans révéler le détail de l’erreur.

Par défaut, Express ignore `X-Forwarded-For` et utilise l’adresse observée directement par le serveur. Si l’API est derrière un proxy, configure `TRUSTED_PROXIES` avec les adresses IP ou plages CIDR exactes des proxys de confiance, séparées par des virgules. Ne configure pas cette variable pour faire confiance à des proxys que tu ne contrôles pas.
