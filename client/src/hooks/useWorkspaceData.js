import { useCallback, useState } from 'react'
import { api } from '../lib/api.js'

export function useWorkspaceData() {
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [activity, setActivity] = useState([])

  const refreshWorkspace = useCallback(async () => {
    const [nextProjects, nextTasks, nextActivity] = await Promise.all([
      api('/projects'),
      api('/tasks'),
      api('/activity'),
    ])
    setProjects(nextProjects)
    setTasks(nextTasks)
    setActivity(nextActivity)
  }, [])

  const clearWorkspace = () => {
    setProjects([])
    setTasks([])
    setActivity([])
  }

  const run = async (operation) => {
    try {
      const result = await operation()
      await refreshWorkspace()
      return result ?? true
    } catch (error) {
      window.alert(error.message)
      return null
    }
  }

  const createProject = (project) =>
    run(() =>
      api('/projects', {
        method: 'POST',
        body: JSON.stringify(project),
      })
    )
  const updateProject = (id, changes) =>
    run(() =>
      api(`/projects/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      })
    )
  const deleteProject = (id) =>
    run(() => api(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  const createTask = (task) =>
    run(() =>
      api('/tasks', {
        method: 'POST',
        body: JSON.stringify(task),
      })
    )
  const updateTask = (id, changes) =>
    run(() =>
      api(`/tasks/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      })
    )
  const deleteTask = (id) =>
    run(() => api(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }))

  return {
    projects,
    tasks,
    activity,
    refreshWorkspace,
    clearWorkspace,
    createProject,
    updateProject,
    deleteProject,
    createTask,
    updateTask,
    deleteTask,
  }
}
