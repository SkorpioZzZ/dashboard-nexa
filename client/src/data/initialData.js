// Données initiales et options partagées par les différents écrans.
export const team = [
  { name: 'Alexandre Zapolski', initials: 'AZ', role: 'Administrateur', email: 'alexandre@nexa.fr', color: 'lilac' },
  { name: 'Ousmane Kane', initials: 'OK', role: 'Chef de projet', email: 'ousmane@nexa.fr', color: 'blue' },
  { name: 'Camille Bernard', initials: 'CB', role: 'Designer', email: 'camille@nexa.fr', color: 'orange' },
  { name: 'Lina Moreau', initials: 'LM', role: 'Développeuse', email: 'lina@nexa.fr', color: 'green' },
]
export const statuses = ['À faire', 'En cours', 'En revue', 'Terminé']
export const recentEmails = [
  { sender: 'Camille Bernard', initials: 'CB', color: 'orange', subject: 'Maquettes de la page d’accueil', preview: 'Je viens de partager la dernière version des maquettes.', time: '09:42', unread: true },
  { sender: 'Ousmane Kane', initials: 'OK', color: 'blue', subject: 'Point projet — refonte du site', preview: 'Peux-tu valider les prochaines étapes avant notre point ?', time: 'Hier', unread: true },
  { sender: 'Lina Moreau', initials: 'LM', color: 'green', subject: 'Mise à jour de la branche de test', preview: 'Les corrections sont disponibles pour relecture.', time: 'Hier', unread: false },
]
export const developmentApps = [
  { name: 'GitHub', description: 'Code et dépôts', icon: 'GH', url: 'https://github.com', tone: 'dark' },
  { name: 'Figma', description: 'Design et maquettes', icon: 'F', url: 'https://www.figma.com', tone: 'pink' },
  { name: 'Linear', description: 'Suivi des tickets', icon: 'L', url: 'https://linear.app', tone: 'violet' },
  { name: 'Vercel', description: 'Déploiements', icon: 'V', url: 'https://vercel.com', tone: 'slate' },
]
export const navItems = [
  { to: '/', label: 'Vue d’ensemble', icon: 'grid', end: true }, { to: '/projets', label: 'Projets', icon: 'folder' },
  { to: '/taches', label: 'Tâches', icon: 'check-square' }, { to: '/equipe', label: 'Équipe', icon: 'users' },
  { to: '/calendrier', label: 'Calendrier', icon: 'calendar' }, { to: '/email', label: 'Email', icon: 'mail' },
  { to: '/raccourcis', label: 'Raccourcis', icon: 'external' },
]
// Petits composants communs : icônes, navigation, avatars et indicateurs.
