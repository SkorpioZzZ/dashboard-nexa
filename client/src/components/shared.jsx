import { NavLink, useNavigate } from 'react-router-dom'
import { displayDate } from '../lib/projects.js'
import { navItems } from '../data/initialData.js'

const glyphs = {
  plus: '+',
  folder: '▰',
  check: '✓',
  settings: '⚙',
  history: '↶',
  edit: '✎',
  trash: '⌫',
  logout: '↪',
  grid: '▦',
  'check-square': '☑',
  users: '♧',
  calendar: '▦',
  mail: '✉',
  external: '↗',
}

const sidebarIconPaths = {
  grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  folder: ['M3 6h7l2 2h9v10H3z'],
  'check-square': ['M9 11l2 2 4-4', 'M5 4h14v16H5z'],
  users: [
    'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1',
    'M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M17 11a4 4 0 0 0 0-7.7',
  ],
  calendar: ['M5 4h14v16H5z', 'M8 2v4', 'M16 2v4', 'M5 9h14'],
  mail: ['M4 5h16v14H4z', 'm4 7 8 6 8-6'],
  external: ['M14 5h5v5', 'M19 5l-8 8', 'M19 13v6H5V5h6'],
  history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v6h6'],
  settings: [
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    'M4.9 4.9l1.4 1.4',
    'M17.7 17.7l1.4 1.4',
    'M12 2v2',
    'M12 20v2',
    'M2 12h2',
    'M20 12h2',
  ],
}

export function Icon({ name, size = 16, variant }) {
  if (variant === 'sidebar' && sidebarIconPaths[name]) {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
        {sidebarIconPaths[name].map((path) => (
          <path key={path} d={path} />
        ))}
      </svg>
    )
  }
  return (
    <span aria-hidden="true" style={{ display: 'inline-block', width: size, textAlign: 'center' }}>
      {glyphs[name] || '•'}
    </span>
  )
}

export function Header({ title, eyebrow, action, welcome }) {
  return (
    <header className="topbar">
      <div>
        {welcome && <h2 className="header-welcome">{welcome}</h2>}
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {action && (
        <button className="primary-button" onClick={action.onClick}>
          <Icon name="plus" />
          {action.label}
        </button>
      )}
    </header>
  )
}

export function Sidebar({ user, onLogout }) {
  const initials = (user.name || user.email)
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">N</span>
        <span>
          Nexa<span className="brand-dot">.</span>
        </span>
      </div>
      <nav className="main-nav">
        <span className="nav-caption">ESPACE DE TRAVAIL</span>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">
              <Icon name={item.icon} variant="sidebar" size={18} />
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <NavLink
          to="/parametres"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span className="nav-icon">
            <Icon name="settings" variant="sidebar" size={18} />
          </span>
          Paramètres
        </NavLink>
        <div className="user-card">
          <span className="avatar avatar-lilac">{initials}</span>
          <span>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </span>
          <button
            className="more logout-button"
            onClick={onLogout}
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <Icon name="logout" />
          </button>
        </div>
      </div>
    </aside>
  )
}

export function StatCard({ label, value, note, icon, tone = 'purple', to = '/' }) {
  return (
    <NavLink to={to} className="stat-card stat-card-link">
      <div className={`stat-icon ${tone}`}>
        <Icon name={icon} />
      </div>
      <div className="stat-content">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>
          <em>{note}</em>
        </small>
      </div>
    </NavLink>
  )
}

export function ProgressBar({ value = 0, color = 'purple' }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div className={`progress-fill ${color}`} style={{ width: `${safeValue}%` }} />
    </div>
  )
}

export function Avatar({ initials, color = 'lilac' }) {
  return <span className={`avatar avatar-${color}`}>{initials}</span>
}

function formatActivityTime(value) {
  const timestamp = new Date(value)
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp.getTime()) / 1000))
  if (seconds < 60) return 'À l’instant'
  if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export function ActivityRows({ activity }) {
  return activity.map((item) => {
    const initials = item.actorName
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    return (
      <div className="activity-item" key={item.id}>
        <Avatar initials={initials} />
        <p>
          <strong>{item.actorName}</strong> {item.action} <b>{item.entityName}</b>
          <small>{formatActivityTime(item.createdAt)}</small>
        </p>
      </div>
    )
  })
}

export function EmailRows({ emails }) {
  return (
    <div className="email-list">
      {emails.map((email) => (
        <article className={`email-item ${email.unread ? 'unread' : ''}`} key={email.subject}>
          <Avatar initials={email.initials} color={email.color} />
          <span className="email-copy">
            <strong>{email.sender}</strong>
            <b>{email.subject}</b>
            <small>{email.preview}</small>
          </span>
          <time>{email.time}</time>
        </article>
      ))}
    </div>
  )
}

export function ProjectRow({ project }) {
  const navigate = useNavigate()
  return (
    <button className="project-row clickable" onClick={() => navigate(`/projets/${project.id}`)}>
      <span className={`project-logo ${project.color}`}>{project.name.charAt(0)}</span>
      <span className="project-info">
        <strong>{project.name}</strong>
        <small>{project.client}</small>
      </span>
      <span className="project-progress">
        <span>{project.progress}%</span>
        <ProgressBar value={project.progress} color={project.color} />
      </span>
      <span className="status">{project.status}</span>
      <span className="row-arrow">→</span>
    </button>
  )
}

export function TaskTable({ tasks, projects }) {
  const navigate = useNavigate()
  return (
    <div className="task-table">
      <div className="task-head">
        <span>TÂCHE</span>
        <span>PROJET</span>
        <span>RESPONSABLE</span>
        <span>ÉCHÉANCE</span>
        <span>STATUT</span>
      </div>
      {tasks.map((task) => (
        <div className="task-row" key={task.id}>
          <button
            className="task-name task-link"
            onClick={() => navigate(`/projets/${task.projectId}`)}
          >
            <span className="checkbox" />
            {task.title}
          </button>
          <span className="task-project">
            {projects.find((project) => project.id === task.projectId)?.name || 'Projet supprimé'}
          </span>
          <span>
            <Avatar
              initials={(task.person || '?')
                .split(/\s+/)
                .map((part) => part[0])
                .join('')}
              color={task.color}
            />
            <span className="task-assignee-name">{task.person || 'Sans responsable'}</span>
          </span>
          <span className="task-date">{displayDate(task.due)}</span>
          <span className="task-status">{task.status}</span>
        </div>
      ))}
    </div>
  )
}
