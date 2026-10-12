import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './lib/api.js'
import App from './App.jsx'

vi.mock('./lib/api.js', () => ({
  api: vi.fn(),
}))

vi.mock('./pages/DashboardPage.jsx', () => ({
  DashboardPage: ({ projects, tasks, activity, showAllActivity = false }) =>
    `Dashboard|projects=${projects.map((project) => project.name).join(',')}|tasks=${tasks
      .map((task) => task.title)
      .join(
        ','
      )}|activity=${activity.map((item) => item.entityName).join(',')}|all=${showAllActivity}`,
}))

const user = {
  id: 'user-1',
  name: 'Ada Lovelace',
  firstName: 'Ada',
  lastName: 'Lovelace',
  username: 'ada',
  email: 'ada@example.test',
}
const projects = [{ id: 'project-1', name: 'Projet Nexa' }]
const tasks = [{ id: 'task-1', title: 'Vérifier le tableau', projectId: 'project-1' }]
const activity = [{ id: 1, entityName: 'Projet Nexa', action: 'a créé le projet' }]

function queueWorkspace(userData = user) {
  api
    .mockResolvedValueOnce({ user: userData })
    .mockResolvedValueOnce(projects)
    .mockResolvedValueOnce(tasks)
    .mockResolvedValueOnce(activity)
}

function fillLoginForm(email = user.email, password = 'password123') {
  fireEvent.change(screen.getByLabelText('Adresse e-mail'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
}

function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('session integration in App', () => {
  beforeEach(() => {
    api.mockReset()
    window.history.replaceState({}, '', '/')
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('restores a valid session and then loads projects, tasks and activity', async () => {
    window.history.replaceState({}, '', '/activite')
    queueWorkspace()
    render(<App />)

    expect(await screen.findByText(/Dashboard\|projects=Projet Nexa/)).toHaveTextContent(
      'tasks=Vérifier le tableau|activity=Projet Nexa|all=true'
    )
    expect(api.mock.calls).toEqual([['/auth/me'], ['/projects'], ['/tasks'], ['/activity']])
  })

  it('shows the authentication screen when the session is absent or refused', async () => {
    api.mockRejectedValueOnce(new Error('Connectez-vous pour continuer.'))
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Bienvenue sur Nexa' })).toBeInTheDocument()
    expect(api).toHaveBeenCalledWith('/auth/me')
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('shows authentication if initial workspace loading fails for a valid session', async () => {
    api
      .mockResolvedValueOnce({ user })
      .mockRejectedValueOnce(new Error('API indisponible'))
      .mockResolvedValueOnce(tasks)
      .mockResolvedValueOnce(activity)
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Bienvenue sur Nexa' })).toBeInTheDocument()
    expect(api.mock.calls.map(([path]) => path)).toEqual([
      '/auth/me',
      '/projects',
      '/tasks',
      '/activity',
    ])
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('logs in and loads the workspace after an absent session', async () => {
    api.mockRejectedValueOnce(new Error('Session absente'))
    render(<App />)
    await screen.findByRole('heading', { name: 'Bienvenue sur Nexa' })
    api
      .mockResolvedValueOnce({ user })
      .mockResolvedValueOnce(projects)
      .mockResolvedValueOnce(tasks)
      .mockResolvedValueOnce(activity)

    fillLoginForm()

    expect(await screen.findByText(/Dashboard\|projects=Projet Nexa/)).toBeInTheDocument()
    expect(api.mock.calls.slice(1)).toEqual([
      [
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email: user.email, password: 'password123' }) },
      ],
      ['/projects'],
      ['/tasks'],
      ['/activity'],
    ])
  })

  it('shows an authentication error when login is refused', async () => {
    api.mockRejectedValueOnce(new Error('Session absente'))
    render(<App />)
    await screen.findByRole('heading', { name: 'Bienvenue sur Nexa' })
    api.mockRejectedValueOnce(new Error('Adresse e-mail ou mot de passe incorrect.'))

    fillLoginForm()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Adresse e-mail ou mot de passe incorrect.'
    )
    expect(api.mock.calls.at(-1)).toEqual([
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email: user.email, password: 'password123' }) },
    ])
  })

  it('logs out and clears workspace data before a later workspace refresh', async () => {
    queueWorkspace()
    render(<App />)
    expect(await screen.findByText(/Dashboard\|projects=Projet Nexa/)).toBeInTheDocument()
    api.mockResolvedValueOnce(null)

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))

    expect(await screen.findByRole('heading', { name: 'Bienvenue sur Nexa' })).toBeInTheDocument()
    expect(api.mock.calls.at(-1)).toEqual(['/auth/logout', { method: 'POST' }])

    const delayedProjects = deferred()
    const delayedTasks = deferred()
    const delayedActivity = deferred()
    api
      .mockResolvedValueOnce({ user: { ...user, id: 'user-2' } })
      .mockReturnValueOnce(delayedProjects.promise)
      .mockReturnValueOnce(delayedTasks.promise)
      .mockReturnValueOnce(delayedActivity.promise)

    fillLoginForm()

    expect(
      await screen.findByText('Dashboard|projects=|tasks=|activity=|all=false')
    ).toBeInTheDocument()

    delayedProjects.resolve(projects)
    delayedTasks.resolve(tasks)
    delayedActivity.resolve(activity)
    await waitFor(() => {
      expect(screen.getByText(/Dashboard\|projects=Projet Nexa/)).toBeInTheDocument()
    })
  })

  it('alerts and keeps the session when logout fails', async () => {
    queueWorkspace()
    render(<App />)
    expect(await screen.findByText(/Dashboard\|projects=Projet Nexa/)).toBeInTheDocument()
    api.mockRejectedValueOnce(new Error('Déconnexion impossible'))

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Déconnexion impossible')
    })
    expect(screen.getByText(/Dashboard\|projects=Projet Nexa/)).toBeInTheDocument()
    expect(api.mock.calls.at(-1)).toEqual(['/auth/logout', { method: 'POST' }])
  })
})
