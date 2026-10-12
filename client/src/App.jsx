import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { api } from './lib/api.js'
import { readSaved } from './lib/storage.js'
import { Sidebar } from './components/shared.jsx'
import { AuthPage } from './pages/AuthPage.jsx'
import { CalendarPage, DashboardPage, EmailPage, ProjectPage, ProjectsPage, SettingsPage, ShortcutsPage, TasksPage, TeamPage } from './pages/WorkspacePages.jsx'
import './App.css'
import './kanban.css'
import './management.css'

function LoadingScreen() {
  return <main className="auth-screen"><p>Chargement de votre espace…</p></main>
}

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [activity, setActivity] = useState([])

  const refreshWorkspace = useCallback(async () => {
    const [nextProjects, nextTasks, nextActivity] = await Promise.all([
      api('/projects'), api('/tasks'), api('/activity'),
    ])
    setProjects(nextProjects)
    setTasks(nextTasks)
    setActivity(nextActivity)
  }, [])

  useEffect(() => {
    let active = true
    api('/auth/me').then(({ user: currentUser }) => {
      if (!active) return
      setUser(currentUser)
      return refreshWorkspace()
    }).catch(() => {
      if (active) setUser(null)
    }).finally(() => {
      if (active) setReady(true)
    })
    return () => { active = false }
  }, [refreshWorkspace])

  const signIn = async (credentials, mode) => {
    const result = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(credentials) })
    setUser(result.user)
    await refreshWorkspace()
  }

  const signOut = async () => {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
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

  const createProject = (project) => run(() => api('/projects', {
    method: 'POST', body: JSON.stringify(project),
  }))
  const updateProject = (id, changes) => run(() => api(`/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(changes),
  }))
  const deleteProject = (id) => run(() => api(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }))
  const createTask = (task) => run(() => api('/tasks', {
    method: 'POST', body: JSON.stringify(task),
  }))
  const updateTask = (id, changes) => run(() => api(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(changes),
  }))
  const deleteTask = (id) => run(() => api(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }))

  if (!ready) return <LoadingScreen />
  if (!user) return <AuthPage onSubmit={signIn} />

  const settings = {
    language: 'fr', timezone: 'Europe/Paris', dateFormat: 'fr-FR', weekStart: 'monday', defaultPage: '/',
    ...readSaved('nexa-settings', {}).general,
  }

  return <BrowserRouter>
    <div className="app-shell">
      <Sidebar user={user} onLogout={() => signOut().catch((error) => window.alert(error.message))} />
      <div className="main-area">
        <Routes>
          <Route path="/" element={settings.defaultPage === '/' ? <DashboardPage projects={projects} tasks={tasks} activity={activity} /> : <Navigate to={settings.defaultPage} replace />} />
          <Route path="/projets" element={<ProjectsPage projects={projects} tasks={tasks} onCreate={createProject} />} />
          <Route path="/projets/:id" element={<ProjectPage projects={projects} tasks={tasks} onCreateTask={createTask} onUpdateTask={updateTask} onDeleteTask={deleteTask} onUpdateProject={updateProject} onDeleteProject={deleteProject} onRefresh={refreshWorkspace} />} />
          <Route path="/taches" element={<TasksPage projects={projects} tasks={tasks} />} />
          <Route path="/activite" element={<DashboardPage projects={projects} tasks={tasks} activity={activity} showAllActivity />} />
          <Route path="/equipe" element={<TeamPage />} />
          <Route path="/calendrier" element={<CalendarPage projects={projects} tasks={tasks} />} />
          <Route path="/email" element={<EmailPage />} />
          <Route path="/raccourcis" element={<ShortcutsPage />} />
          <Route path="/parametres" element={<SettingsPage user={user} onUserUpdated={setUser} onAccountDeleted={() => setUser(null)} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  </BrowserRouter>
}
