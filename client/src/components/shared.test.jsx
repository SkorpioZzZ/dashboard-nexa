import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { Sidebar, TaskTable } from './shared.jsx'

afterEach(cleanup)

describe('workspace navigation', () => {
  it.each([
    ['/parametres', 'Paramètres'],
    ['/activite', 'Historique'],
  ])('marks %s active when opened directly', (path, label) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Sidebar user={{ name: 'Ada Lovelace', email: 'ada@example.test' }} onLogout={() => {}} />
      </MemoryRouter>
    )

    expect(screen.getByRole('link', { name: label })).toHaveClass('active')
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
  })
})

it('shows the task assignee name alongside their avatar', () => {
  render(
    <MemoryRouter>
      <TaskTable
        tasks={[
          {
            id: 'task-1',
            title: 'Préparer la revue',
            projectId: 'project-1',
            person: 'Camille Bernard',
            due: null,
            status: 'À faire',
          },
        ]}
        projects={[{ id: 'project-1', name: 'Projet Nexa' }]}
      />
    </MemoryRouter>
  )

  expect(screen.getByText('Camille Bernard')).toBeInTheDocument()
  expect(screen.getByText('CB')).toBeInTheDocument()
})
