import { useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { ActivityRows, Avatar, Header, ProgressBar, ProjectRow, StatCard, TaskTable } from '../components/shared.jsx'
import { dateOffset, displayDate, getProjectProgress, getProjectStatus } from '../lib/projects.js'
import { developmentApps, recentEmails, statuses, team as defaultTeam } from '../data/initialData.js'
import { api } from '../lib/api.js'
import { readSaved } from '../lib/storage.js'

const withProgress = (projects, tasks) => projects.map((project) => ({
  ...project,
  progress: getProjectProgress(project.id, tasks),
  status: getProjectStatus(project.id, tasks),
}))

export function DashboardPage({ projects, tasks, activity, showAllActivity = false }) {
  const calculatedProjects = withProgress(projects, tasks)
  const completedTasks = tasks.filter((task) => task.status === 'Terminé').length
  return <>
    <Header eyebrow={showAllActivity ? 'HISTORIQUE' : 'ESPACE DE TRAVAIL'} title={showAllActivity ? 'Activité récente' : 'Vue d’ensemble'} />
    <main className="page-content">
      {!showAllActivity && <section className="stats-grid">
        <StatCard to="/projets" label="Projets" value={projects.length} note="dans votre espace" icon="folder" tone="purple" />
        <StatCard to="/taches" label="Tâches terminées" value={`${completedTasks}/${tasks.length}`} note="tâches complétées" icon="check" tone="green" />
      </section>}
      <section className="panel project-panel">
        <div className="panel-header"><div><h2>{showAllActivity ? 'Activité' : 'Projets en cours'}</h2><p>{showAllActivity ? 'Dernières actions sur vos projets et tâches.' : 'Avancement calculé à partir des tâches.'}</p></div><NavLink className="text-link" to={showAllActivity ? '/projets' : '/projets'}>{showAllActivity ? 'Voir les projets →' : 'Tous les projets →'}</NavLink></div>
        {showAllActivity ? <div className="activity-list">{activity.length ? <ActivityRows activity={activity} /> : <p>Aucune activité pour le moment.</p>}</div> : <div className="project-list">{calculatedProjects.map((project) => <ProjectRow key={project.id} project={project} />)}</div>}
      </section>
      {!showAllActivity && <section className="panel task-panel"><div className="panel-header"><div><h2>Tâches récentes</h2><p>Les tâches de tous vos projets.</p></div><NavLink to="/taches" className="text-link">Toutes les tâches →</NavLink></div><TaskTable tasks={tasks.slice(0, 8)} projects={projects} /></section>}
    </main>
  </>
}

export function ProjectsPage({ projects, tasks, onCreate }) {
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [due, setDue] = useState('')
  async function submit(event) {
    event.preventDefault()
    const created = await onCreate({ name: name.trim(), client: client.trim(), due: due || null })
    if (created) { setName(''); setClient(''); setDue('') }
  }
  return <>
    <Header eyebrow="ESPACE DE TRAVAIL" title="Projets" />
    <main className="page-content">
      <section className="panel"><div className="panel-header"><div><h2>Nouveau projet</h2><p>Ajoutez un projet à votre espace.</p></div></div>
        <form className="shortcut-form" onSubmit={submit}><label>Nom<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Client<input value={client} onChange={(event) => setClient(event.target.value)} /></label><label>Échéance<input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></label><button className="primary-button">Créer le projet</button></form>
      </section>
      <div className="projects-cards">{withProgress(projects, tasks).map((project) => <NavLink to={`/projets/${project.id}`} className="project-card clickable" key={project.id}><div className="project-card-top"><span className={`project-logo large ${project.color}`}>{project.name.charAt(0)}</span><span className="status">{project.status}</span></div><h2>{project.name}</h2><p>{project.client}</p><div className="card-progress-label"><span>Avancement</span><strong>{project.progress}%</strong></div><ProgressBar value={project.progress} color={project.color} /><div className="project-card-footer"><span>Ouvrir le projet →</span><span>{displayDate(project.due)}</span></div></NavLink>)}</div>
      {!projects.length && <p>Aucun projet pour le moment.</p>}
    </main>
  </>
}

export function ProjectPage({ projects, tasks, onCreateTask, onUpdateTask, onDeleteTask, onUpdateProject, onDeleteProject, onRefresh }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const project = projects.find((item) => item.id === id)
  const projectTasks = tasks.filter((task) => task.projectId === id)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState('lecteur')
  const [memberMessage, setMemberMessage] = useState('')

  if (!project) return <><Header eyebrow="PROJET" title="Projet introuvable" /><main className="page-content"><NavLink to="/projets">← Retour aux projets</NavLink></main></>

  async function addTask(event) {
    event.preventDefault()
    const result = await onCreateTask({ title: title.trim(), projectId: id, due: due || null, status: statuses[0] })
    if (result) { setTitle(''); setDue('') }
  }
  async function share(event) {
    event.preventDefault()
    setMemberMessage('')
    try {
      await api(`/projects/${encodeURIComponent(id)}/members`, { method: 'POST', body: JSON.stringify({ email: memberEmail, role: memberRole }) })
      setMemberEmail('')
      setMemberRole('lecteur')
      setMemberMessage('Accès partagé avec succès.')
      await onRefresh()
    } catch (error) { setMemberMessage(error.message) }
  }

  const canEditTasks = project?.isOwner !== false || ['contributeur', 'editeur'].includes(project?.role)
  const canDeleteTasks = project?.isOwner !== false || project?.role === 'editeur'

  return <>
    <Header eyebrow="PROJET" title={project.name} />
    <main className="page-content">
      <section className="panel"><div className="panel-header"><div><p>{project.client || 'Projet'} · {projectTasks.length} tâche(s)</p><ProgressBar value={getProjectProgress(id, tasks)} color={project.color} /></div></div>
        {project.isOwner !== false && <div className="project-actions"><button className="danger-button" onClick={async () => { if (window.confirm(`Supprimer « ${project.name} » et ses tâches ?`) && await onDeleteProject(id)) navigate('/projets') }}>Supprimer le projet</button></div>}
      </section>
      {project.isOwner !== false && <section className="panel"><div className="panel-header"><div><h2>Partager le projet</h2><p>La personne doit déjà avoir un compte Nexa.</p></div></div><form className="shortcut-form" onSubmit={share}><label>Adresse e-mail<input type="email" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} required /></label><label>Rôle<select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}><option value="lecteur">Lecteur</option><option value="contributeur">Contributeur</option><option value="editeur">Éditeur</option></select></label><button className="primary-button">Partager</button></form>{memberMessage && <p role="status">{memberMessage}</p>}{project.members?.map((member) => <p key={member.id}>{member.name} — {member.role}</p>)}</section>}
      {canEditTasks && <form className="add-task-form" onSubmit={addTask}><input aria-label="Titre de la tâche" placeholder="Ajouter une tâche…" value={title} onChange={(event) => setTitle(event.target.value)} required /><input aria-label="Échéance" type="date" value={due} onChange={(event) => setDue(event.target.value)} /><button className="primary-button">Ajouter</button></form>}
      <section className="kanban-board">{statuses.map((status) => {
        const column = projectTasks.filter((task) => task.status === status)
        return <div className="kanban-column" key={status}><div className="kanban-column-header"><h2>{status}</h2><span>{column.length}</span></div><div className="kanban-cards">{column.map((task) => <article className="kanban-card" key={task.id}><strong>{task.title}</strong><div className="kanban-card-meta"><Avatar initials={(task.person || '?').split(/\s+/).map((part) => part[0]).join('')} color={task.color} /><span>{task.person || 'Sans responsable'}</span></div><div className="kanban-card-footer"><small>{displayDate(task.due)}</small>{canEditTasks ? <select aria-label={`Statut de ${task.title}`} value={task.status} onChange={(event) => onUpdateTask(task.id, { status: event.target.value })}>{statuses.map((item) => <option key={item}>{item}</option>)}</select> : <span>{task.status}</span>}</div>{canEditTasks && <button className="text-link" onClick={() => { const nextTitle = window.prompt('Modifier le titre de la tâche', task.title); if (nextTitle?.trim()) onUpdateTask(task.id, { title: nextTitle.trim() }) }}>Modifier</button>}{canDeleteTasks && <button className="danger-text" onClick={() => window.confirm(`Supprimer « ${task.title} » ?`) && onDeleteTask(task.id)}>Supprimer</button>}</article>)}</div></div>
      })}</section>
      {project.isOwner !== false && <section className="panel"><h2>Modifier le projet</h2><form className="shortcut-form" onSubmit={(event) => { event.preventDefault(); onUpdateProject(id, { name: event.currentTarget.elements.name.value, client: event.currentTarget.elements.client.value }) }}><label>Nom<input name="name" defaultValue={project.name} required /></label><label>Client<input name="client" defaultValue={project.client} /></label><button className="secondary-button">Enregistrer</button></form></section>}
    </main>
  </>
}

export function TasksPage({ projects, tasks }) {
  const [filter, setFilter] = useState('Toutes')
  const shown = filter === 'Terminées' ? tasks.filter((task) => task.status === 'Terminé') : filter === 'En retard' ? tasks.filter((task) => task.due && task.due < dateOffset(0) && task.status !== 'Terminé') : tasks
  return <><Header eyebrow="ESPACE DE TRAVAIL" title="Tâches" /><main className="page-content"><div className="tabs">{['Toutes', 'Terminées', 'En retard'].map((value) => <button key={value} className={`tab ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>{value}</button>)}</div><section className="panel task-panel full"><TaskTable tasks={shown} projects={projects} /></section></main></>
}

export function CalendarPage({ projects, tasks }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const year = month.getFullYear()
  const index = month.getMonth()
  const offset = (new Date(year, index, 1).getDay() + 6) % 7
  const days = new Date(year, index + 1, 0).getDate()
  const events = [...tasks.map((task) => ({ due: task.due, title: task.title })), ...projects.map((project) => ({ due: project.due, title: project.name }))]
  return <><Header eyebrow="ESPACE DE TRAVAIL" title="Calendrier" /><main className="page-content"><section className="panel calendar-panel"><div className="calendar-heading"><button className="secondary-button" onClick={() => setMonth(new Date(year, index - 1, 1))}>←</button><h2>{new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(month)}</h2><button className="secondary-button" onClick={() => setMonth(new Date(year, index + 1, 1))}>→</button></div><div className="calendar-grid">{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}{Array.from({ length: offset }, (_, i) => <div className="calendar-day blank" key={`blank-${i}`} />)}{Array.from({ length: days }, (_, i) => { const date = `${year}-${String(index + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`; return <div className="calendar-day" key={date}><span>{i + 1}</span>{events.filter((event) => event.due === date).map((event, eventIndex) => <div className="calendar-event task" title={event.title} key={`${date}-${eventIndex}`}>{event.title}</div>)}</div> })}</div></section></main></>
}

export function TeamPage() {
  const [members, setMembers] = useState(() => readSaved('nexa-team', defaultTeam).map((member, index) => ({ ...member, id: member.id || `local-${index}` })))
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('Membre')
  function save(event) {
    event.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (members.some((member) => member.email.toLowerCase() === cleanEmail)) return window.alert('Cette adresse e-mail est déjà dans votre équipe.')
    const cleanName = name.trim()
    const next = [...members, { id: `member-${Date.now()}`, name: cleanName, email: cleanEmail, role: role.trim(), initials: cleanName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(), color: 'blue' }]
    setMembers(next)
    localStorage.setItem('nexa-team', JSON.stringify(next))
    setName(''); setEmail('')
  }
  function remove(id) {
    const next = members.filter((member) => member.id !== id)
    setMembers(next)
    localStorage.setItem('nexa-team', JSON.stringify(next))
  }
  return <><Header eyebrow="ESPACE DE TRAVAIL" title="Équipe" /><main className="page-content"><section className="panel"><div className="panel-header"><div><h2>Ajouter une personne</h2><p>Ce carnet est enregistré dans ce navigateur.</p></div></div><form className="shortcut-form" onSubmit={save}><label>Nom<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Rôle<input value={role} onChange={(event) => setRole(event.target.value)} /></label><button className="primary-button">Ajouter</button></form></section><div className="team-grid">{members.map((member) => <article className="team-card" key={member.id}><Avatar initials={member.initials} color={member.color} /><h2>{member.name}</h2><p>{member.role}</p><a href={`mailto:${member.email}`}>{member.email}</a><button className="team-remove-button" onClick={() => remove(member.id)}>Retirer</button></article>)}</div></main></>
}

export function EmailPage() {
  return <><Header eyebrow="ESPACE DE TRAVAIL" title="Email" /><main className="page-content"><section className="panel email-panel"><div className="panel-header"><div><h2>Boîte de réception</h2><p>Aperçu statique de messages récents</p></div><a className="text-link" href="https://mail.google.com" target="_blank" rel="noreferrer">Ouvrir Gmail ↗</a></div><div className="email-list">{recentEmails.map((email) => <article className={`email-item ${email.unread ? 'unread' : ''}`} key={email.subject}><Avatar initials={email.initials} color={email.color} /><span className="email-copy"><strong>{email.sender}</strong><b>{email.subject}</b><small>{email.preview}</small></span><time>{email.time}</time></article>)}</div><small className="demo-note">Ces exemples ne sont pas synchronisés avec une boîte e-mail.</small></section></main></>
}

export function ShortcutsPage() {
  const [shortcuts, setShortcuts] = useState(() => readSaved('nexa-shortcuts', developmentApps.map((item, index) => ({ ...item, id: `default-${index}` }))))
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  function add(event) {
    event.preventDefault()
    const href = /^https?:\/\//i.test(url) ? url.trim() : `https://${url.trim()}`
    try { new URL(href) } catch { return }
    const next = [...shortcuts, { id: `shortcut-${Date.now()}`, name: name.trim(), description: href, url: href, icon: name.trim()[0]?.toUpperCase(), tone: 'slate' }]
    setShortcuts(next); localStorage.setItem('nexa-shortcuts', JSON.stringify(next)); setName(''); setUrl('')
  }
  function remove(id) { const next = shortcuts.filter((item) => item.id !== id); setShortcuts(next); localStorage.setItem('nexa-shortcuts', JSON.stringify(next)) }
  return <><Header eyebrow="ESPACE DE TRAVAIL" title="Raccourcis" /><main className="page-content"><section className="panel shortcuts-panel"><form className="shortcut-form" onSubmit={add}><label>Nom<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Adresse web<input value={url} onChange={(event) => setUrl(event.target.value)} required /></label><button className="primary-button">Ajouter</button></form><div className="shortcut-grid">{shortcuts.map((item) => <div className="app-shortcut" key={item.id}><a className="shortcut-link" href={item.url} target="_blank" rel="noreferrer"><span className={`app-icon ${item.tone}`}>{item.icon}</span><span><strong>{item.name}</strong><small>{item.description}</small></span></a><button className="shortcut-remove" onClick={() => remove(item.id)} aria-label={`Retirer ${item.name}`}>×</button></div>)}</div></section></main></>
}

export function SettingsPage({ user, onUserUpdated, onAccountDeleted }) {
  const [settings, setSettings] = useState(() => readSaved('nexa-settings', { general: {}, preferences: {} }))
  const [message, setMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  function save(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const next = { ...settings, general: { ...settings.general, timezone: data.get('timezone'), dateFormat: data.get('dateFormat'), weekStart: data.get('weekStart'), defaultPage: data.get('defaultPage') } }
    localStorage.setItem('nexa-settings', JSON.stringify(next)); setSettings(next); setMessage('Préférences enregistrées.')
  }
  async function updateProfile(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    try { const result = await api('/auth/profile', { method: 'PATCH', body: JSON.stringify({ firstName: data.get('firstName'), lastName: data.get('lastName'), username: data.get('username') }) }); onUserUpdated(result.user); setMessage('Profil mis à jour.') } catch (error) { setMessage(error.message) }
  }
  async function updatePassword(event) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    if (data.get('newPassword') !== data.get('confirmPassword')) { setPasswordMessage('Les nouveaux mots de passe ne correspondent pas.'); return }
    try {
      await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword') }) })
      form.reset()
      setPasswordMessage('Mot de passe modifié.')
    } catch (error) { setPasswordMessage(error.message) }
  }
  return <><Header eyebrow="ESPACE DE TRAVAIL" title="Paramètres" /><main className="page-content"><section className="panel"><h2>Préférences</h2><form className="shortcut-form" onSubmit={save}><label>Fuseau horaire<input name="timezone" defaultValue={settings.general?.timezone || 'Europe/Paris'} /></label><label>Format de date<input name="dateFormat" defaultValue={settings.general?.dateFormat || 'fr-FR'} /></label><label>Début de semaine<select name="weekStart" defaultValue={settings.general?.weekStart || 'monday'}><option value="monday">Lundi</option><option value="sunday">Dimanche</option></select></label><label>Page d’accueil<select name="defaultPage" defaultValue={settings.general?.defaultPage || '/'}><option value="/">Vue d’ensemble</option><option value="/projets">Projets</option><option value="/taches">Tâches</option></select></label><button className="primary-button">Enregistrer</button></form></section><section className="panel"><h2>Profil</h2><form className="shortcut-form" onSubmit={updateProfile}><label>Prénom<input name="firstName" defaultValue={user.firstName || user.name.split(' ')[0]} required /></label><label>Nom<input name="lastName" defaultValue={user.lastName || user.name.split(' ').slice(1).join(' ')} required /></label><label>Nom d’utilisateur<input name="username" defaultValue={user.username || ''} required /></label><button className="primary-button">Mettre à jour</button></form></section>{message && <p role="status">{message}</p>}<section className="panel"><h2>Mot de passe</h2><form className="shortcut-form" onSubmit={updatePassword}><label>Mot de passe actuel<input name="currentPassword" type="password" required /></label><label>Nouveau mot de passe<input name="newPassword" type="password" minLength="8" required /></label><label>Confirmer le mot de passe<input name="confirmPassword" type="password" minLength="8" required /></label><button className="primary-button">Changer le mot de passe</button></form>{passwordMessage && <p role="status">{passwordMessage}</p>}</section><section className="panel"><h2>Zone sensible</h2><p>La suppression de votre compte efface vos projets et tâches associés.</p><button className="danger-button" onClick={async () => { const password = window.prompt('Saisissez votre mot de passe pour supprimer le compte.'); if (!password || !window.confirm('Confirmer la suppression définitive du compte ?')) return; try { await api('/auth/account', { method: 'DELETE', body: JSON.stringify({ password }) }); onAccountDeleted() } catch (error) { setMessage(error.message) } }}>Supprimer mon compte</button></section></main></>
}
