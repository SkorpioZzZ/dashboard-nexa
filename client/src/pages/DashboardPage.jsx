import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ActivityRows,
  EmailRows,
  Header,
  Icon,
  ProjectRow,
  StatCard,
  TaskTable,
} from '../components/shared.jsx'
import { ProjectForm } from '../components/ProjectForm.jsx'
import { developmentApps, recentEmails } from '../data/initialData.js'
import { getProjectsWithProgress } from '../lib/projects.js'

export function DashboardPage({
  projects,
  tasks,
  activity,
  user,
  showAllActivity = false,
  onDeleteProject,
  onCreateProject,
}) {
  const [isProjectModalOpen, setProjectModalOpen] = useState(false)
  const calculatedProjects = getProjectsWithProgress(projects, tasks)
  const completedProjects = calculatedProjects.filter((project) => project.status === 'Terminé')
  const completedTasks = tasks.filter((task) => task.status === 'Terminé').length
  const displayName =
    user?.name?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.username?.trim() ||
    user?.email?.split('@')[0] ||
    ''

  useEffect(() => {
    if (!isProjectModalOpen) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setProjectModalOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isProjectModalOpen])
  return (
    <>
      <Header
        eyebrow={showAllActivity ? 'HISTORIQUE' : 'ESPACE DE TRAVAIL'}
        title={showAllActivity ? 'Activité récente' : 'Vue d’ensemble'}
        welcome={displayName ? `Bienvenue, ${displayName}` : 'Bienvenue sur votre espace Nexa'}
        action={
          !showAllActivity
            ? { label: 'Nouveau projet', onClick: () => setProjectModalOpen(true) }
            : undefined
        }
      />
      <main className="page-content">
        {!showAllActivity && (
          <section className="stats-grid dashboard-stats">
            <StatCard
              to="/projets"
              label="Projets terminés"
              value={completedProjects.length}
              note="projets complétés"
              icon="folder"
              tone="purple"
            />
            <StatCard
              to="/taches"
              label="Tâches terminées"
              value={`${completedTasks}/${tasks.length}`}
              note="tâches complétées"
              icon="check"
              tone="green"
            />
          </section>
        )}
        <section className="panel project-panel">
          <div className="panel-header">
            <div>
              <h2>{showAllActivity ? 'Activité' : 'Projets en cours'}</h2>
              <p>
                {showAllActivity
                  ? 'Dernières actions sur vos projets et tâches.'
                  : 'Avancement calculé à partir des tâches.'}
              </p>
            </div>
            <NavLink className="text-link" to={showAllActivity ? '/projets' : '/projets'}>
              {showAllActivity ? 'Voir les projets →' : 'Tous les projets →'}
            </NavLink>
          </div>
          {showAllActivity ? (
            <div className="activity-list">
              {activity.length ? (
                <ActivityRows activity={activity} />
              ) : (
                <p>Aucune activité pour le moment.</p>
              )}
            </div>
          ) : (
            <div className="project-list">
              {calculatedProjects
                .filter((project) => project.status !== 'Terminé')
                .map((project) => (
                  <div className="dashboard-project-item" key={project.id}>
                    <ProjectRow project={project} />
                    {project.isOwner !== false && (
                      <div className="dashboard-project-actions">
                        <NavLink
                          className="project-action-button edit"
                          to={`/projets/${project.id}`}
                        >
                          <Icon name="edit" />
                          Modifier
                        </NavLink>
                        <button
                          className="project-action-button remove"
                          onClick={() => {
                            if (window.confirm(`Supprimer « ${project.name} » et ses tâches ?`))
                              onDeleteProject?.(project.id)
                          }}
                        >
                          <Icon name="trash" />
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              {!calculatedProjects.some((project) => project.status !== 'Terminé') && (
                <p className="dashboard-empty">Aucun projet en cours.</p>
              )}
            </div>
          )}
        </section>
        {!showAllActivity && (
          <>
            <section className="dashboard-overview-grid dashboard-main-grid">
              <section className="panel dashboard-overview-panel dashboard-task-panel">
                <div className="panel-header">
                  <div>
                    <h2>Tâches récentes</h2>
                    <p>Les tâches de tous vos projets.</p>
                  </div>
                  <NavLink to="/taches" className="text-link">
                    Toutes les tâches →
                  </NavLink>
                </div>
                <TaskTable tasks={tasks.slice(0, 8)} projects={projects} />
              </section>
              <section className="panel dashboard-overview-panel">
                <div className="panel-header">
                  <div>
                    <h2>Activité récente</h2>
                    <p>Dernières actions sur vos projets et tâches.</p>
                  </div>
                  <NavLink className="text-link" to="/activite">
                    Historique →
                  </NavLink>
                </div>
                <div className="activity-list">
                  {activity.length ? (
                    <ActivityRows activity={activity.slice(0, 4)} />
                  ) : (
                    <p>Aucune activité pour le moment.</p>
                  )}
                </div>
              </section>
            </section>
            <section className="dashboard-overview-grid dashboard-secondary-grid">
              <section className="panel dashboard-overview-panel">
                <div className="panel-header">
                  <div>
                    <h2>Derniers e-mails</h2>
                    <p>Exemples de messages de démonstration.</p>
                  </div>
                  <NavLink className="text-link" to="/email">
                    Voir Mail →
                  </NavLink>
                </div>
                <EmailRows emails={recentEmails.slice(0, 3)} />
                <small className="demo-note">
                  Ces messages ne sont pas synchronisés avec une boîte e-mail.
                </small>
              </section>
              <section className="panel dashboard-overview-panel">
                <div className="panel-header">
                  <div>
                    <h2>Raccourcis</h2>
                    <p>Vos outils de travail favoris.</p>
                  </div>
                  <NavLink className="text-link" to="/raccourcis">
                    Gérer →
                  </NavLink>
                </div>
                <div className="shortcut-grid">
                  {developmentApps.map((app) => (
                    <a
                      className="app-shortcut"
                      href={app.url}
                      target="_blank"
                      rel="noreferrer"
                      key={app.name}
                    >
                      <span className={`app-icon ${app.tone}`}>{app.icon}</span>
                      <span>
                        <strong>{app.name}</strong>
                        <small>{app.description}</small>
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            </section>
          </>
        )}
      </main>
      {isProjectModalOpen && (
        <div
          className="modal-backdrop project-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setProjectModalOpen(false)
          }}
        >
          <section
            className="modal project-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-modal-title"
            aria-describedby="project-modal-description"
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Fermer"
              onClick={() => setProjectModalOpen(false)}
            >
              ×
            </button>
            <h2 id="project-modal-title">Nouveau projet</h2>
            <p id="project-modal-description">Ajoutez un projet à votre espace.</p>
            <ProjectForm
              onCreate={onCreateProject}
              onCreated={() => setProjectModalOpen(false)}
              onCancel={() => setProjectModalOpen(false)}
              autoFocus
            />
          </section>
        </div>
      )}
    </>
  )
}
