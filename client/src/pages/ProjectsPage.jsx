import { NavLink } from 'react-router-dom'
import { Header, ProgressBar } from '../components/shared.jsx'
import { ProjectForm } from '../components/ProjectForm.jsx'
import { displayDate, getProjectsWithProgress } from '../lib/projects.js'

export function ProjectsPage({ projects, tasks, onCreate }) {
  return (
    <>
      <Header eyebrow="ESPACE DE TRAVAIL" title="Projets" />
      <main className="page-content">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Nouveau projet</h2>
              <p>Ajoutez un projet à votre espace.</p>
            </div>
          </div>
          <ProjectForm onCreate={onCreate} />
        </section>
        <div className="projects-cards">
          {getProjectsWithProgress(projects, tasks).map((project) => (
            <NavLink
              to={`/projets/${project.id}`}
              className="project-card clickable"
              key={project.id}
            >
              <div className="project-card-top">
                <span className={`project-logo large ${project.color}`}>
                  {project.name.charAt(0)}
                </span>
                <span className="status">{project.status}</span>
              </div>
              <h2>{project.name}</h2>
              <p>{project.client}</p>
              {project.description && <p className="project-description">{project.description}</p>}
              <div className="card-progress-label">
                <span>Avancement</span>
                <strong>{project.progress}%</strong>
              </div>
              <ProgressBar value={project.progress} color={project.color} />
              <div className="project-card-footer">
                <span>Ouvrir le projet →</span>
                <span>{displayDate(project.due)}</span>
              </div>
            </NavLink>
          ))}
        </div>
        {!projects.length && <p>Aucun projet pour le moment.</p>}
      </main>
    </>
  )
}
