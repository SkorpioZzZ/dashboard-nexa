const request = require('supertest')
const app = require('../src/server')
const { pool } = require('../src/db')
const { users, projectIds, taskIds, password } = require('./setup')

let authCookies

async function loginAs(user) {
  const response = await request(app).post('/api/auth/login').send({ email: user.email, password })
  expect(response.status).toBe(200)
  return response.headers['set-cookie'][0].split(';')[0]
}

function authenticated(user, method, path) {
  return request(app)[method](path).set('Cookie', authCookies[user.id])
}

beforeEach(async () => {
  if (!authCookies) {
    authCookies = {}
    for (const user of Object.values(users)) authCookies[user.id] = await loginAs(user)
  }
})

const projectBody = { name: 'Updated project' }
const taskBody = { title: 'Updated task' }
const newTask = { title: 'New task', projectId: projectIds.shared }

describe('permissions API', () => {
  test('requires a valid session for workspace and mutation routes', async () => {
    const responses = await Promise.all([
      request(app).get('/api/projects'),
      request(app).get('/api/tasks'),
      request(app).get('/api/activity'),
      request(app).post('/api/projects').send({ name: 'No session' }),
      request(app).post('/api/tasks').send(newTask),
      request(app).patch(`/api/projects/${projectIds.shared}`).send(projectBody),
      request(app).delete(`/api/tasks/${taskIds.shared}`),
    ])
    expect(responses.map((response) => response.status)).toEqual(Array(7).fill(401))
  })

  test('limits projects, tasks and activity to owned or shared data', async () => {
    const ownerCookie = await loginAs(users.owner)
    const outsiderCookie = await loginAs(users.outsider)
    const ownerProjects = await request(app).get('/api/projects').set('Cookie', ownerCookie)
    const outsiderProjects = await request(app).get('/api/projects').set('Cookie', outsiderCookie)
    const ownerTasks = await request(app).get('/api/tasks').set('Cookie', ownerCookie)
    const outsiderTasks = await request(app).get('/api/tasks').set('Cookie', outsiderCookie)
    const ownerActivity = await request(app).get('/api/activity').set('Cookie', ownerCookie)
    const outsiderActivity = await request(app).get('/api/activity').set('Cookie', outsiderCookie)

    expect(ownerProjects.body.map(({ id }) => id).sort()).toEqual(
      [projectIds.shared, projectIds.destination].sort()
    )
    expect(outsiderProjects.body.map(({ id }) => id)).toEqual(['private-project'])
    expect(ownerTasks.body.map(({ id }) => id)).toEqual([taskIds.shared])
    expect(outsiderTasks.body.map(({ id }) => id)).toEqual([taskIds.private])
    expect(ownerActivity.body).toHaveLength(1)
    expect(outsiderActivity.body).toHaveLength(1)
  })

  test.each([
    ['reader', 'lecteur'],
    ['contributor', 'developpeur'],
    ['editor', 'responsable'],
  ])('allows %s to read shared project and task', async (key, role) => {
    const cookie = await loginAs(users[key])
    const projects = await request(app).get('/api/projects').set('Cookie', cookie)
    const tasks = await request(app).get('/api/tasks').set('Cookie', cookie)
    expect(projects.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: projectIds.shared, role })])
    )
    expect(tasks.body).toEqual([expect.objectContaining({ id: taskIds.shared })])
  })

  test.each([
    ['owner', 201],
    ['reader', 403],
    ['contributor', 201],
    ['editor', 201],
    ['outsider', 403],
  ])('applies task creation permission for %s', async (key, status) => {
    const response = await authenticated(users[key], 'post', '/api/tasks').send(newTask)
    expect(response.status).toBe(status)
  })

  test.each([
    ['owner', 200],
    ['reader', 403],
    ['contributor', 200],
    ['editor', 200],
    ['outsider', 404],
  ])('applies task update permission for %s', async (key, status) => {
    const response = await authenticated(users[key], 'patch', `/api/tasks/${taskIds.shared}`).send(
      taskBody
    )
    expect(response.status).toBe(status)
  })

  test.each([
    ['owner', 204],
    ['reader', 403],
    ['contributor', 403],
    ['editor', 204],
    ['outsider', 404],
  ])('applies task deletion permission for %s', async (key, status) => {
    const response = await authenticated(users[key], 'delete', `/api/tasks/${taskIds.shared}`)
    expect(response.status).toBe(status)
  })

  test('applies project modification and deletion permissions by role', async () => {
    for (const key of ['reader', 'contributor']) {
      expect(
        (
          await authenticated(users[key], 'patch', `/api/projects/${projectIds.shared}`).send(
            projectBody
          )
        ).status
      ).toBe(403)

      expect(
        (await authenticated(users[key], 'delete', `/api/projects/${projectIds.shared}`)).status
      ).toBe(403)
    }

    expect(
      (
        await authenticated(users.editor, 'patch', `/api/projects/${projectIds.shared}`).send(
          projectBody
        )
      ).status
    ).toBe(200)

    expect(
      (await authenticated(users.editor, 'delete', `/api/projects/${projectIds.shared}`)).status
    ).toBe(403)

    expect(
      (
        await authenticated(users.owner, 'patch', `/api/projects/${projectIds.shared}`).send(
          projectBody
        )
      ).status
    ).toBe(200)

    expect(
      (await authenticated(users.owner, 'delete', `/api/projects/${projectIds.shared}`)).status
    ).toBe(204)
  })

  test('restricts role administration and project deletion to administrators', async () => {
    // Un responsable peut gérer les membres, mais pas attribuer le rôle administrateur.
    const forbiddenPromotion = await authenticated(
      users.editor,
      'patch',
      `/api/projects/${projectIds.shared}/members/${users.outsider.id}`
    ).send({ role: 'administrateur' })

    expect(forbiddenPromotion.status).toBe(403)

    // Un responsable ne peut pas supprimer le projet.
    const forbiddenDeletion = await authenticated(
      users.editor,
      'delete',
      `/api/projects/${projectIds.shared}`
    )

    expect(forbiddenDeletion.status).toBe(403)

    // L'administrateur ajoute d'abord l'utilisateur comme lecteur.
    const invitation = await authenticated(
      users.admin,
      'post',
      `/api/projects/${projectIds.shared}/members`
    ).send({
      email: users.outsider.email,
      role: 'lecteur',
    })

    expect(invitation.status).toBe(201)

    // L'administrateur peut ensuite modifier son rôle.
    const promotion = await authenticated(
      users.admin,
      'patch',
      `/api/projects/${projectIds.shared}/members/${users.outsider.id}`
    ).send({ role: 'developpeur' })

    expect(promotion.status).toBe(200)
    expect(promotion.body.role).toBe('developpeur')

    const deletion = await authenticated(
      users.admin,
      'delete',
      `/api/projects/${projectIds.shared}`
    )

    expect(deletion.status).toBe(204)
  })

  test('permits task moves only when the member has edit access to both projects', async () => {
    const contributorCookie = await loginAs(users.contributor)
    const forbiddenMove = await request(app)
      .patch(`/api/tasks/${taskIds.shared}`)
      .set('Cookie', contributorCookie)
      .send({ projectId: projectIds.destination })
    expect(forbiddenMove.status).toBe(403)

    await pool.query(
      'INSERT INTO project_members(owner_user_id,project_id,member_user_id,role,can_create_tasks,can_edit_tasks) VALUES($1,$2,$3,$4,true,true)',
      [users.owner.id, projectIds.destination, users.contributor.id, 'developpeur']
    )
    const allowedMove = await request(app)
      .patch(`/api/tasks/${taskIds.shared}`)
      .set('Cookie', contributorCookie)
      .send({ projectId: projectIds.destination })
    expect(allowedMove.status).toBe(200)
    expect(allowedMove.body.projectId).toBe(projectIds.destination)
  })

  test('returns the existing not-found responses for absent or inaccessible resources', async () => {
    expect(
      (await authenticated(users.owner, 'patch', '/api/tasks/missing-task').send(taskBody)).status
    ).toBe(404)
    expect((await authenticated(users.owner, 'delete', '/api/tasks/missing-task')).status).toBe(404)
    expect(
      (await authenticated(users.owner, 'patch', '/api/projects/missing-project').send(projectBody))
        .status
    ).toBe(403)
    expect(
      (await authenticated(users.owner, 'delete', '/api/projects/missing-project')).status
    ).toBe(403)
    expect(
      (await authenticated(users.outsider, 'patch', `/api/tasks/${taskIds.shared}`).send(taskBody))
        .status
    ).toBe(404)
    expect(
      (
        await authenticated(users.outsider, 'patch', `/api/projects/${projectIds.shared}`).send(
          projectBody
        )
      ).status
    ).toBe(403)
    expect(
      (
        await authenticated(
          users.owner,
          'patch',
          `/api/projects/${projectIds.shared}/members/not-a-uuid`
        ).send({ role: 'lecteur' })
      ).status
    ).toBe(400)
    expect(
      (
        await authenticated(
          users.owner,
          'delete',
          `/api/projects/${projectIds.shared}/members/not-a-uuid`
        )
      ).status
    ).toBe(400)
  })
})
