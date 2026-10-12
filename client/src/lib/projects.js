import { readSaved } from './storage.js'

export const getGeneralSettings = () => ({
  language: 'fr',
  timezone: 'Europe/Paris',
  dateFormat: 'fr-FR',
  weekStart: 'monday',
  defaultPage: '/',
  ...readSaved('nexa-settings', {}).general,
})

export const dateOffset = (days) => {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: getGeneralSettings().timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(now)
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {})
  const date = new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + days)
  )
  return date.toISOString().slice(0, 10)
}

export const displayDate = (date) =>
  date
    ? new Intl.DateTimeFormat(
        getGeneralSettings().language === 'en'
          ? getGeneralSettings().dateFormat.replace('fr-FR', 'en-GB')
          : getGeneralSettings().dateFormat,
        { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }
      ).format(new Date(`${date}T00:00:00Z`))
    : 'Sans échéance'

export function getProjectProgress(projectId, tasks) {
  const projectTasks = tasks.filter((task) => task.projectId === projectId)
  if (!projectTasks.length) return 0
  const progressByStatus = { 'À faire': 0, 'En cours': 50, 'En revue': 80, Terminé: 100 }
  return Math.round(
    projectTasks.reduce((total, task) => total + (progressByStatus[task.status] ?? 0), 0) /
      projectTasks.length
  )
}

export function getProjectStatus(projectId, tasks) {
  const projectTasks = tasks.filter((task) => task.projectId === projectId)
  return projectTasks.length > 0 && projectTasks.every((task) => task.status === 'Terminé')
    ? 'Terminé'
    : 'En cours'
}

export const getProjectsWithProgress = (projects, tasks) =>
  projects.map((project) => ({
    ...project,
    progress: getProjectProgress(project.id, tasks),
    status: getProjectStatus(project.id, tasks),
  }))
