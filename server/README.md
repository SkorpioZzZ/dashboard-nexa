# Nexa — API et comptes

Pour les instructions destinées aux utilisateurs — démarrage, création de compte, connexion et dépannage — consulte le [README principal](../README.md).

L’API utilise PostgreSQL local et gère les comptes, les sessions, les projets et les tâches. Elle est démarrée avec l’interface par la commande `npm run dev` depuis la racine du projet.

## Routes API

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` et `POST /api/auth/logout` gèrent les comptes et les sessions.
- `/api/projects` et `/api/tasks` permettent de lire, créer, modifier et supprimer les données du compte connecté.
- `GET /api/health` vérifie que l’API répond.

Les mots de passe sont hachés avec scrypt. La session utilise un cookie signé, HttpOnly et SameSite=Lax, valable sept jours.
