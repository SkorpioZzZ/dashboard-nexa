import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api.js'
import { useWorkspaceData } from './useWorkspaceData.js'

vi.mock('../lib/api.js', () => ({
  api: vi.fn(),
}))

const projects = [{ id: 'project-1', name: 'Projet test' }]
const tasks = [{ id: 'task-1', title: 'Tâche test', projectId: 'project-1' }]
const activity = [{ id: 1, entityName: 'Projet test', action: 'a créé le projet' }]
const mutationResult = { id: 'created-1' }

function mockWorkspaceRefresh() {
  api.mockResolvedValueOnce(projects).mockResolvedValueOnce(tasks).mockResolvedValueOnce(activity)
}

describe('useWorkspaceData', () => {
  beforeEach(() => {
    api.mockReset()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('charge les projets, tâches et activités lorsque refreshWorkspace est appelé', async () => {
    const { result } = renderHook(() => useWorkspaceData())

    expect(result.current.projects).toEqual([])
    expect(result.current.tasks).toEqual([])
    expect(result.current.activity).toEqual([])

    api.mockResolvedValueOnce(projects).mockResolvedValueOnce(tasks).mockResolvedValueOnce(activity)
    await act(async () => {
      await result.current.refreshWorkspace()
    })

    expect(result.current.projects).toEqual(projects)
    expect(result.current.tasks).toEqual(tasks)
    expect(result.current.activity).toEqual(activity)
    expect(api.mock.calls).toEqual([['/projects'], ['/tasks'], ['/activity']])
  })

  it.each([
    {
      name: 'crée un projet',
      operation: (workspace) => workspace.createProject({ name: 'Nouveau projet' }),
      request: ['/projects', { method: 'POST', body: JSON.stringify({ name: 'Nouveau projet' }) }],
    },
    {
      name: 'modifie un projet',
      operation: (workspace) => workspace.updateProject('project 1', { name: 'Projet modifié' }),
      request: [
        '/projects/project%201',
        { method: 'PATCH', body: JSON.stringify({ name: 'Projet modifié' }) },
      ],
    },
    {
      name: 'supprime un projet',
      operation: (workspace) => workspace.deleteProject('project 1'),
      request: ['/projects/project%201', { method: 'DELETE' }],
      response: null,
      result: true,
    },
    {
      name: 'crée une tâche',
      operation: (workspace) => workspace.createTask({ title: 'Nouvelle tâche' }),
      request: ['/tasks', { method: 'POST', body: JSON.stringify({ title: 'Nouvelle tâche' }) }],
    },
    {
      name: 'modifie une tâche',
      operation: (workspace) => workspace.updateTask('task 1', { title: 'Tâche modifiée' }),
      request: [
        '/tasks/task%201',
        { method: 'PATCH', body: JSON.stringify({ title: 'Tâche modifiée' }) },
      ],
    },
    {
      name: 'supprime une tâche',
      operation: (workspace) => workspace.deleteTask('task 1'),
      request: ['/tasks/task%201', { method: 'DELETE' }],
      response: null,
      result: true,
    },
  ])(
    '$name puis rafraîchit les données',
    async ({ operation, request, response, result: expectedResult }) => {
      const { result } = renderHook(() => useWorkspaceData())
      api.mockResolvedValueOnce(response === undefined ? mutationResult : response)
      mockWorkspaceRefresh()

      let operationResult
      await act(async () => {
        operationResult = await operation(result.current)
      })

      expect(operationResult).toEqual(expectedResult ?? mutationResult)
      expect(api.mock.calls).toEqual([request, ['/projects'], ['/tasks'], ['/activity']])
      expect(result.current.projects).toEqual(projects)
      expect(result.current.tasks).toEqual(tasks)
      expect(result.current.activity).toEqual(activity)
    }
  )

  it('vide les trois collections avec clearWorkspace', async () => {
    const { result } = renderHook(() => useWorkspaceData())
    mockWorkspaceRefresh()
    await act(async () => {
      await result.current.refreshWorkspace()
    })

    act(() => {
      result.current.clearWorkspace()
    })

    expect(result.current.projects).toEqual([])
    expect(result.current.tasks).toEqual([])
    expect(result.current.activity).toEqual([])
  })

  it('alerte et renvoie null si la mutation échoue sans rafraîchir les données', async () => {
    const { result } = renderHook(() => useWorkspaceData())
    const error = new Error('Mutation refusée')
    api.mockRejectedValueOnce(error)

    let operationResult
    await act(async () => {
      operationResult = await result.current.createProject({ name: 'Projet refusé' })
    })

    expect(operationResult).toBeNull()
    expect(window.alert).toHaveBeenCalledWith('Mutation refusée')
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('renvoie null et alerte si le rafraîchissement échoue après une mutation réussie', async () => {
    const { result } = renderHook(() => useWorkspaceData())
    const error = new Error('Rafraîchissement indisponible')
    api
      .mockResolvedValueOnce(mutationResult)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(tasks)
      .mockResolvedValueOnce(activity)

    let operationResult
    await act(async () => {
      operationResult = await result.current.createTask({ title: 'Tâche créée' })
    })

    expect(operationResult).toBeNull()
    expect(window.alert).toHaveBeenCalledWith('Rafraîchissement indisponible')
    expect(api.mock.calls).toEqual([
      ['/tasks', { method: 'POST', body: JSON.stringify({ title: 'Tâche créée' }) }],
      ['/projects'],
      ['/tasks'],
      ['/activity'],
    ])
    expect(result.current.projects).toEqual([])
    expect(result.current.tasks).toEqual([])
    expect(result.current.activity).toEqual([])
  })

  it('laisse remonter une erreur lorsque refreshWorkspace échoue directement', async () => {
    const { result } = renderHook(() => useWorkspaceData())
    const error = new Error('API indisponible')
    api.mockRejectedValueOnce(error)

    await expect(
      act(async () => {
        await result.current.refreshWorkspace()
      })
    ).rejects.toBe(error)

    expect(window.alert).not.toHaveBeenCalled()
    expect(result.current.projects).toEqual([])
    expect(result.current.tasks).toEqual([])
    expect(result.current.activity).toEqual([])
  })
})
