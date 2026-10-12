import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { Avatar, Header, ProgressBar } from '../components/shared.jsx'
import { displayDate, getProjectProgress } from '../lib/projects.js'
import { statuses } from '../data/initialData.js'
import { api } from '../lib/api.js'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'

function KanbanTaskCard({
  task,
  canEditTasks,
  canDeleteTasks,
  onUpdateTask,
  onDeleteTask,
  pending,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canEditTasks || pending,
  })
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.55 : 1,
  }

  return (
    <article
      ref={setNodeRef}
      className={`kanban-card${pending ? ' saving' : ''}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div className="kanban-card-title-row">
        <strong>{task.title}</strong>
        {canEditTasks && (
          <button
            className="kanban-drag-handle"
            type="button"
            aria-label={`Déplacer la tâche ${task.title}`}
            title="Faire glisser pour changer de colonne"
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
        )}
      </div>
      <div className="kanban-card-meta">
        <Avatar
          initials={(task.person || '?')
            .split(/\s+/)
            .map((part) => part[0])
            .join('')}
          color={task.color}
        />
        <span>
          <small>Responsable</small>
          {task.person || 'Non renseigné'}
        </span>
      </div>
      <div className="kanban-card-footer">
        <small>{displayDate(task.due)}</small>
        {canEditTasks ? (
          <select
            aria-label={`Statut de ${task.title}`}
            value={task.status}
            disabled={pending}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => onUpdateTask(task.id, { status: event.target.value })}
          >
            {statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        ) : null}
      </div>
      {pending && (
        <span className="kanban-saving" role="status">
          Enregistrement…
        </span>
      )}
      {canEditTasks && (
        <button
          className="text-link"
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => {
            const nextTitle = window.prompt('Modifier le titre de la tâche', task.title)
            if (nextTitle?.trim()) onUpdateTask(task.id, { title: nextTitle.trim() })
          }}
        >
          Modifier
        </button>
      )}
      {canDeleteTasks && (
        <button
          className="danger-text"
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => window.confirm(`Supprimer « ${task.title} » ?`) && onDeleteTask(task.id)}
        >
          Supprimer
        </button>
      )}
    </article>
  )
}

function KanbanColumn({ status, tasks, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div ref={setNodeRef} className={`kanban-column${isOver ? ' drop-ready' : ''}`}>
      <div className="kanban-column-header">
        <h2>{status}</h2>
        <span>{tasks.length}</span>
      </div>
      <div className="kanban-cards">{children}</div>
    </div>
  )
}

export function ProjectPage({
  projects,
  tasks,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onUpdateProject,
  onDeleteProject,
  onRefresh,
}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const project = projects.find((item) => item.id === id)
  const projectTasks = tasks.filter((task) => task.projectId === id)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState('lecteur')
  const [memberMessage, setMemberMessage] = useState('')
  const [pendingTaskId, setPendingTaskId] = useState(null)
  const [isManageModalOpen, setManageModalOpen] = useState(false)
  const [projectForm, setProjectForm] = useState({ name: '', client: '', description: '' })
  const [projectFormError, setProjectFormError] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )
  useEffect(() => {
    if (!isManageModalOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setManageModalOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isManageModalOpen])

  if (!project)
    return (
      <>
        <Header eyebrow="PROJET" title="Projet introuvable" />
        <main className="page-content">
          <NavLink to="/projets">← Retour aux projets</NavLink>
        </main>
      </>
    )

  async function addTask(event) {
    event.preventDefault()
    const result = await onCreateTask({
      title: title.trim(),
      projectId: id,
      due: due || null,
      status: statuses[0],
    })
    if (result) {
      setTitle('')
      setDue('')
    }
  }
  function openManageModal() {
    setProjectForm({
      name: project.name || '',
      client: project.client || '',
      description: project.description || '',
    })
    setProjectFormError('')
    setManageModalOpen(true)
  }
  async function saveProject(event) {
    event.preventDefault()
    setProjectFormError('')
    const result = await onUpdateProject(id, {
      name: projectForm.name.trim(),
      client: projectForm.client.trim(),
      description: projectForm.description.trim(),
    })
    if (!result) {
      setProjectFormError('Le projet n’a pas été modifié. Réessayez.')
      return
    }
    setManageModalOpen(false)
  }
  async function share(event) {
    event.preventDefault()
    setMemberMessage('')
    try {
      await api(`/projects/${encodeURIComponent(id)}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: memberEmail, role: memberRole }),
      })
      setMemberEmail('')
      setMemberRole('lecteur')
      setMemberMessage('Accès partagé avec succès.')
      await onRefresh()
    } catch (error) {
      setMemberMessage(error.message)
    }
  }

  const canEditTasks =
    project?.isOwner !== false || ['contributeur', 'editeur'].includes(project?.role)
  const canDeleteTasks = project?.isOwner !== false || project?.role === 'editeur'

  async function moveTask(event) {
    const task = projectTasks.find((item) => String(item.id) === String(event.active.id))
    const nextStatus = String(event.over?.id || '')
    if (!canEditTasks || !task || !statuses.includes(nextStatus) || task.status === nextStatus)
      return

    setPendingTaskId(task.id)
    try {
      // The workspace hook refreshes server data on success and returns null on failure.
      // Keeping the prop as the rendered source avoids leaving a failed optimistic status behind.
      await onUpdateTask(task.id, { status: nextStatus })
    } finally {
      setPendingTaskId(null)
    }
  }

  const kanbanBoard = (
    <section className="kanban-board" aria-label="Tableau Kanban des tâches">
      {statuses.map((status) => {
        const column = projectTasks.filter((task) => task.status === status)
        return (
          <KanbanColumn key={status} status={status} tasks={column}>
            {column.map((task) => (
              <KanbanTaskCard
                key={task.id}
                task={task}
                canEditTasks={canEditTasks}
                canDeleteTasks={canDeleteTasks}
                onUpdateTask={onUpdateTask}
                onDeleteTask={onDeleteTask}
                pending={pendingTaskId === task.id}
              />
            ))}
          </KanbanColumn>
        )
      })}
    </section>
  )

  return (
    <>
      <Header eyebrow="PROJET" title={project.name} />
      <main className="page-content project-page">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p>
                {project.client || 'Projet'} · {projectTasks.length} tâche(s)
              </p>
              {project.description && (
                <p className="project-detail-description">{project.description}</p>
              )}
              <ProgressBar value={getProjectProgress(id, tasks)} color={project.color} />
            </div>
          </div>
          {project.isOwner !== false && (
            <div className="project-actions">
              <button className="secondary-button" onClick={openManageModal}>
                Gérer le projet
              </button>
            </div>
          )}
        </section>
        {project.isOwner !== false && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Partager le projet</h2>
                <p>La personne doit déjà avoir un compte Nexa.</p>
              </div>
            </div>
            <form className="shortcut-form" onSubmit={share}>
              <label>
                Adresse e-mail
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  required
                />
              </label>
              <label>
                Rôle
                <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>
                  <option value="lecteur">Lecteur</option>
                  <option value="contributeur">Contributeur</option>
                  <option value="editeur">Éditeur</option>
                </select>
              </label>
              <button className="primary-button">Partager</button>
            </form>
            {memberMessage && <p role="status">{memberMessage}</p>}
            <div className="project-member-list">
              {project.members?.map((member) => (
                <div className="project-member" key={member.id}>
                  <Avatar
                    initials={member.name
                      .split(/\s+/)
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  />
                  <span>
                    <strong>{member.name}</strong>
                    <small>{member.role}</small>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
        {canEditTasks && (
          <form className="add-task-form" onSubmit={addTask}>
            <input
              aria-label="Titre de la tâche"
              placeholder="Ajouter une tâche…"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
            <input
              aria-label="Échéance"
              type="date"
              value={due}
              onChange={(event) => setDue(event.target.value)}
            />
            <button className="primary-button">Ajouter</button>
          </form>
        )}
        {canEditTasks && projectTasks.length ? (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={moveTask}>
            {kanbanBoard}
          </DndContext>
        ) : (
          kanbanBoard
        )}
      </main>
      {isManageModalOpen && (
        <div
          className="modal-backdrop project-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setManageModalOpen(false)
          }}
        >
          <section
            className="modal project-manage-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-manage-title"
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Fermer"
              onClick={() => setManageModalOpen(false)}
            >
              ×
            </button>
            <h2 id="project-manage-title">Gérer le projet</h2>
            <p>Modifiez les informations du projet ou supprimez-le.</p>
            <form className="project-manage-form" onSubmit={saveProject}>
              <label>
                Nom
                <input
                  value={projectForm.name}
                  onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}
                  required
                />
              </label>
              <label>
                Client
                <input
                  value={projectForm.client}
                  onChange={(event) =>
                    setProjectForm({ ...projectForm, client: event.target.value })
                  }
                />
              </label>
              <label>
                Description
                <textarea
                  value={projectForm.description}
                  onChange={(event) =>
                    setProjectForm({ ...projectForm, description: event.target.value })
                  }
                  rows="4"
                  maxLength="2000"
                />
              </label>
              {projectFormError && (
                <p className="project-form-error" role="alert">
                  {projectFormError}
                </p>
              )}
              <div className="project-form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setManageModalOpen(false)}
                >
                  Annuler
                </button>
                <button className="primary-button">Enregistrer</button>
              </div>
            </form>
            <div className="project-delete-zone">
              <p>Cette action supprime définitivement le projet et ses tâches.</p>
              <button
                className="danger-button"
                type="button"
                onClick={async () => {
                  if (!window.confirm(`Supprimer « ${project.name} » et ses tâches ?`)) return
                  if (await onDeleteProject(id)) navigate('/projets')
                }}
              >
                Supprimer le projet
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
