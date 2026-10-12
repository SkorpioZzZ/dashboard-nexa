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
    ['contributor', 'contributeur'],
    ['editor', 'editeur'],
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

  test('restricts project modification and deletion to its owner', async () => {
    for (const key of ['reader', 'contributor', 'editor']) {
      expect(
        (
          await authenticated(users[key], 'patch', `/api/projects/${projectIds.shared}`).send(
            projectBody
          )
        ).status
      ).toBe(404)
      expect(
        (await authenticated(users[key], 'delete', `/api/projects/${projectIds.shared}`)).status
      ).toBe(404)
    }
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

  test('restricts sharing and member management to the owner and applies role changes', async () => {
    const readerShare = await authenticated(
      users.reader,
      'post',
      `/api/projects/${projectIds.shared}/members`
    ).send({ email: users.outsider.email, role: 'editeur' })
    expect(readerShare.status).toBe(404)

    const shared = await authenticated(
      users.owner,
      'post',
      `/api/projects/${projectIds.shared}/members`
    ).send({ email: users.outsider.email, role: 'lecteur' })
    expect(shared.status).toBe(201)
    expect(shared.body.role).toBe('lecteur')

    const updated = await authenticated(
      users.owner,
      'patch',
      `/api/projects/${projectIds.shared}/members/${users.outsider.id}`
    ).send({ role: 'contributeur' })
    expect(updated.status).toBe(200)
    expect(updated.body.role).toBe('contributeur')
    expect((await authenticated(users.outsider, 'post', '/api/tasks').send(newTask)).status).toBe(
      201
    )

    const downgraded = await authenticated(
      users.owner,
      'patch',
      `/api/projects/${projectIds.shared}/members/${users.outsider.id}`
    ).send({ role: 'lecteur' })
    expect(downgraded.status).toBe(200)
    expect((await authenticated(users.outsider, 'post', '/api/tasks').send(newTask)).status).toBe(
      403
    )

    expect(
      (
        await authenticated(
          users.reader,
          'patch',
          `/api/projects/${projectIds.shared}/members/${users.editor.id}`
        ).send({ role: 'lecteur' })
      ).status
    ).toBe(404)
    expect(
      (
        await authenticated(
          users.reader,
          'delete',
          `/api/projects/${projectIds.shared}/members/${users.editor.id}`
        )
      ).status
    ).toBe(404)
    expect(
      (
        await authenticated(
          users.owner,
          'delete',
          `/api/projects/${projectIds.shared}/members/${users.outsider.id}`
        )
      ).status
    ).toBe(204)
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
      [users.owner.id, projectIds.destination, users.contributor.id, 'contributeur']
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
    ).toBe(404)
    expect(
      (await authenticated(users.owner, 'delete', '/api/projects/missing-project')).status
    ).toBe(404)
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
    ).toBe(404)
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
