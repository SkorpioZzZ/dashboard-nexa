import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { api } from './lib/api.js'
import { readSaved } from './lib/storage.js'
import { useWorkspaceData } from './hooks/useWorkspaceData.js'
import { Sidebar } from './components/shared.jsx'
import { AuthPage } from './pages/AuthPage.jsx'
import { CalendarPage } from './pages/CalendarPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { EmailPage } from './pages/EmailPage.jsx'
import { ProjectPage } from './pages/ProjectPage.jsx'
import { ProjectsPage } from './pages/ProjectsPage.jsx'
import { SettingsPage } from './pages/SettingsPage.jsx'
import { ShortcutsPage } from './pages/ShortcutsPage.jsx'
import { TasksPage } from './pages/TasksPage.jsx'
import { TeamPage } from './pages/TeamPage.jsx'
import './App.css'
import './kanban.css'
import './management.css'

function LoadingScreen() {
  return (
    <main className="auth-screen">
      <p>Chargement de votre espace…</p>
    </main>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)
  const {
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
  } = useWorkspaceData()

  useEffect(() => {
    let active = true
    api('/auth/me')
      .then(({ user: currentUser }) => {
        if (!active) return
        setUser(currentUser)
        return refreshWorkspace()
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setReady(true)
      })
    return () => {
      active = false
    }
  }, [refreshWorkspace])

  const signIn = async (credentials, mode) => {
    const result = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(credentials) })
    setUser(result.user)
    await refreshWorkspace()
  }

  const signOut = async () => {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
    clearWorkspace()
  }

  if (!ready) return <LoadingScreen />
  if (!user) return <AuthPage onSubmit={signIn} />

  const settings = {
    language: 'fr',
    timezone: 'Europe/Paris',
    dateFormat: 'fr-FR',
    weekStart: 'monday',
    defaultPage: '/',
    ...readSaved('nexa-settings', {}).general,
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar
          user={user}
          onLogout={() => signOut().catch((error) => window.alert(error.message))}
        />
        <div className="main-area">
          <Routes>
            <Route
              path="/"
              element={
                settings.defaultPage === '/' ? (
                  <DashboardPage
                    projects={projects}
                    tasks={tasks}
                    activity={activity}
                    user={user}
                    onCreateProject={createProject}
                    onDeleteProject={deleteProject}
                  />
                ) : (
                  <Navigate to={settings.defaultPage} replace />
                )
              }
            />
            <Route
              path="/projets"
              element={<ProjectsPage projects={projects} tasks={tasks} onCreate={createProject} />}
            />
            <Route
              path="/projets/:id"
              element={
                <ProjectPage
                  projects={projects}
                  tasks={tasks}
                  onCreateTask={createTask}
                  onUpdateTask={updateTask}
                  onDeleteTask={deleteTask}
                  onUpdateProject={updateProject}
                  onDeleteProject={deleteProject}
                  onRefresh={refreshWorkspace}
                />
              }
            />
            <Route path="/taches" element={<TasksPage projects={projects} tasks={tasks} />} />
            <Route
              path="/activite"
              element={
                <DashboardPage
                  projects={projects}
                  tasks={tasks}
                  activity={activity}
                  showAllActivity
                />
              }
            />
            <Route path="/equipe" element={<TeamPage />} />
            <Route
              path="/calendrier"
              element={<CalendarPage projects={projects} tasks={tasks} />}
            />
            <Route path="/email" element={<EmailPage />} />
            <Route path="/raccourcis" element={<ShortcutsPage />} />
            <Route
              path="/parametres"
              element={
                <SettingsPage
                  user={user}
                  onUserUpdated={setUser}
                  onAccountDeleted={() => setUser(null)}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
