import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../lib/api.js'
import { ProjectPage } from './ProjectPage.jsx'

vi.mock('../lib/api.js', () => ({ api: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('shares a project using the selected permission role', async () => {
  api.mockResolvedValueOnce({ id: 'member-1' })
  const onRefresh = vi.fn()

  render(
    <MemoryRouter initialEntries={['/projets/project-1']}>
      <Routes>
        <Route
          path="/projets/:id"
          element={
            <ProjectPage
              projects={[
                {
                  id: 'project-1',
                  name: 'Projet Nexa',
                  client: 'Nexa',
                  color: 'purple',
                  isOwner: true,
                  members: [],
                },
              ]}
              tasks={[]}
              onCreateTask={vi.fn()}
              onUpdateTask={vi.fn()}
              onDeleteTask={vi.fn()}
              onUpdateProject={vi.fn()}
              onDeleteProject={vi.fn()}
              onRefresh={onRefresh}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  )

  expect(screen.getByRole('option', { name: 'Lecteur' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Contributeur' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Éditeur' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Rôle'), { target: { value: 'contributeur' } })
  fireEvent.change(screen.getByLabelText('Adresse e-mail'), {
    target: { value: 'camille@example.test' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Partager' }))

  await waitFor(() => {
    expect(api).toHaveBeenCalledWith('/projects/project-1/members', {
      method: 'POST',
      body: JSON.stringify({ email: 'camille@example.test', role: 'contributeur' }),
    })
  })
  expect(await screen.findByRole('status')).toHaveTextContent('Accès partagé avec succès.')
  expect(onRefresh).toHaveBeenCalledOnce()
})

it('keeps the keyboard-accessible status selector and does not render it for a reader', () => {
  const task = {
    id: 'task-1',
    title: 'Préparer la revue',
    projectId: 'project-1',
    person: 'Camille Bernard',
    status: 'À faire',
  }
  const project = {
    id: 'project-1',
    name: 'Projet Nexa',
    isOwner: false,
    role: 'contributeur',
    members: [],
  }
  const onUpdateTask = vi.fn().mockResolvedValue(null)
  const page = (selectedProject) => (
    <MemoryRouter initialEntries={['/projets/project-1']}>
      <Routes>
        <Route
          path="/projets/:id"
          element={
            <ProjectPage
              projects={[selectedProject]}
              tasks={[task]}
              onCreateTask={vi.fn()}
              onUpdateTask={onUpdateTask}
              onDeleteTask={vi.fn()}
              onUpdateProject={vi.fn()}
              onDeleteProject={vi.fn()}
              onRefresh={vi.fn()}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  )

  const { rerender } = render(page(project))
  expect(
    screen.getByRole('button', { name: 'Déplacer la tâche Préparer la revue' })
  ).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Statut de Préparer la revue'), {
    target: { value: 'En cours' },
  })
  expect(onUpdateTask).toHaveBeenCalledWith('task-1', { status: 'En cours' })

  rerender(page({ ...project, role: 'lecteur' }))
  expect(screen.queryByLabelText('Statut de Préparer la revue')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Déplacer la tâche Préparer la revue' })
  ).not.toBeInTheDocument()
  expect(screen.getByText('À faire')).toBeInTheDocument()
})
