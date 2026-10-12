# Organisation de l’interface Nexa

## Démarrage

`main.jsx` monte React dans `index.html` et active le service worker en production. `App.jsx` gère la session, charge les données depuis l’API et déclare les routes. Les écrans sont regroupés dans `pages/WorkspacePages.jsx` ; l’inscription et la connexion sont dans `pages/AuthPage.jsx`.

## Modules

- `components/shared.jsx` contient les éléments visuels partagés : navigation, en-tête, indicateurs, avatars et tableaux.
- `lib/api.js` centralise les appels HTTP et les cookies de session.
- `lib/projects.js` rassemble le calcul d’avancement et les formats de date.
- `lib/storage.js` lit les préférences locales du navigateur.
- `data/initialData.js` fournit les statuts et exemples utilisés par les écrans locaux.
- `App.css`, `kanban.css` et `management.css` portent respectivement la mise en page générale, le Kanban et les écrans de gestion ; `index.css` définit les règles globales.

L’interface utilise l’API PostgreSQL pour les comptes, projets et tâches. Le carnet d’équipe, les raccourcis et les préférences restent dans le stockage local du navigateur. Les e-mails affichés sont des exemples.
