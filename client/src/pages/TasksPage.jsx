import { useState } from 'react'
import { Header, TaskTable } from '../components/shared.jsx'
import { dateOffset } from '../lib/projects.js'

export function TasksPage({ projects, tasks }) {
  const [filter, setFilter] = useState('Toutes')
  const shown =
    filter === 'Terminées'
      ? tasks.filter((task) => task.status === 'Terminé')
      : filter === 'En retard'
        ? tasks.filter((task) => task.due && task.due < dateOffset(0) && task.status !== 'Terminé')
        : tasks
  return (
    <>
      <Header eyebrow="ESPACE DE TRAVAIL" title="Tâches" />
      <main className="page-content">
        <div className="tabs">
          {['Toutes', 'Terminées', 'En retard'].map((value) => (
            <button
              key={value}
              className={`tab ${filter === value ? 'active' : ''}`}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <section className="panel task-panel full">
          <TaskTable tasks={shown} projects={projects} />
        </section>
      </main>
    </>
  )
}
