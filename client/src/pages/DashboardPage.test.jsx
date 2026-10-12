import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage.jsx'

function CurrentPath() {
  const location = useLocation()
  return <output data-testid="path">{location.pathname}</output>
}

const project = {
  id: 'project-1',
  name: 'Projet Nexa',
  client: 'Nexa',
  color: 'purple',
  isOwner: true,
}

function renderDashboard(props = {}) {
  return render(
    <MemoryRouter>
      <DashboardPage
        projects={[project]}
        tasks={[]}
        activity={[]}
        user={{ name: 'Ada Lovelace' }}
        {...props}
      />
      <CurrentPath />
    </MemoryRouter>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('greets the signed-in user and opens the existing project form in a modal', async () => {
    const onCreateProject = vi.fn().mockResolvedValue({ id: 'project-2' })
    renderDashboard({ onCreateProject })

    expect(screen.getByRole('heading', { name: 'Bienvenue, Ada Lovelace' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau projet' }))
    expect(screen.getByRole('dialog', { name: 'Nouveau projet' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Projet portfolio' } })
    fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'Nexa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le projet' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onCreateProject).toHaveBeenCalledWith({
      name: 'Projet portfolio',
      client: 'Nexa',
      due: null,
    })
  })

  it('links to existing Mail and Raccourcis pages', () => {
    renderDashboard()

    expect(screen.getByRole('heading', { name: 'Derniers e-mails' })).toBeInTheDocument()
    expect(screen.getByText(/ne sont pas synchronisés/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir Mail →' })).toHaveAttribute('href', '/email')
    expect(screen.getByRole('link', { name: 'Gérer →' })).toHaveAttribute('href', '/raccourcis')
    expect(screen.getByRole('heading', { name: 'Raccourcis' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Historique →' })).toHaveAttribute('href', '/activite')
  })

  it('closes the project modal without creating a project when cancelled', () => {
    const onCreateProject = vi.fn()
    renderDashboard({ onCreateProject })

    fireEvent.click(screen.getByRole('button', { name: 'Nouveau projet' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onCreateProject).not.toHaveBeenCalled()
  })

  it('keeps the modal open and reports an API failure', async () => {
    renderDashboard({ onCreateProject: vi.fn().mockResolvedValue(null) })

    fireEvent.click(screen.getByRole('button', { name: 'Nouveau projet' }))
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Projet indisponible' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le projet' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Le projet n’a pas été créé')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows project management actions only to the owner', () => {
    const onDeleteProject = vi.fn()
    const { rerender } = renderDashboard({ onDeleteProject })

    expect(screen.getByRole('link', { name: 'Modifier' })).toHaveAttribute(
      'href',
      '/projets/project-1'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(onDeleteProject).toHaveBeenCalledWith('project-1')

    rerender(
      <MemoryRouter>
        <DashboardPage
          projects={[{ ...project, isOwner: false }]}
          tasks={[]}
          activity={[]}
          onDeleteProject={onDeleteProject}
        />
      </MemoryRouter>
    )
    expect(screen.queryByRole('link', { name: 'Modifier' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
  })
})
