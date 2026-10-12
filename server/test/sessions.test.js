const crypto = require('node:crypto')
const request = require('supertest')
const app = require('../src/server')
const { pool, initializeDatabase } = require('../src/db')
const { users, password } = require('./setup')

const testSessionSecret = 'nexa-test-session-secret-only-32-characters'

function getCookie(response) {
  return response.headers['set-cookie'][0].split(';')[0]
}

async function login(user, userPassword = password) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: userPassword })
  expect(response.status).toBe(200)
  return getCookie(response)
}

describe('session revocation', () => {
  test('registration creates a versioned session without exposing its version', async () => {
    const response = await request(app).post('/api/auth/register').send({
      firstName: 'New',
      lastName: 'Account',
      username: 'new_account',
      email: 'new-account@example.test',
      password,
    })

    expect(response.status).toBe(201)
    expect(response.body.user).not.toHaveProperty('session_version')
    const cookie = getCookie(response)
    const session = await request(app).get('/api/auth/me').set('Cookie', cookie)
    expect(session.status).toBe(200)
    expect(session.body.user.email).toBe('new-account@example.test')
  })

  test('logout revokes a replayed cookie and remains idempotent without a cookie', async () => {
    const cookie = await login(users.owner)
    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie)
    expect(logout.status).toBe(204)
    expect(logout.headers['set-cookie'][0]).toContain('Max-Age=0')
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401)
    expect((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status).toBe(204)
    expect((await request(app).post('/api/auth/logout')).status).toBe(204)

    const expiredPayload = Buffer.from(
      JSON.stringify({
        sub: users.owner.id,
        sessionVersion: 1,
        exp: Date.now() - 60_000,
      })
    ).toString('base64url')
    const expiredSignature = crypto
      .createHmac('sha256', testSessionSecret)
      .update(expiredPayload)
      .digest('base64url')
    const expiredCookie = `nexa_session=${expiredPayload}.${expiredSignature}`
    expect((await request(app).post('/api/auth/logout').set('Cookie', expiredCookie)).status).toBe(
      204
    )
  })

  test('concurrent logout requests increment the version once', async () => {
    const cookie = await login(users.owner)
    const responses = await Promise.all([
      request(app).post('/api/auth/logout').set('Cookie', cookie),
      request(app).post('/api/auth/logout').set('Cookie', cookie),
    ])
    const version = await pool.query('SELECT session_version FROM users WHERE id=$1', [
      users.owner.id,
    ])

    expect(responses.map(({ status }) => status)).toEqual([204, 204])
    expect(version.rows[0].session_version).toBe(2)
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401)
  })

  test('password change revokes other sessions and renews the current session', async () => {
    const currentCookie = await login(users.owner)
    const otherCookie = await login(users.owner)
    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', currentCookie)
      .send({ currentPassword: password, newPassword: 'new-password-456' })

    expect(response.status).toBe(200)
    const renewedCookie = getCookie(response)
    expect((await request(app).get('/api/auth/me').set('Cookie', currentCookie)).status).toBe(401)
    expect((await request(app).get('/api/auth/me').set('Cookie', otherCookie)).status).toBe(401)
    expect((await request(app).get('/api/auth/me').set('Cookie', renewedCookie)).status).toBe(200)
    expect(
      (await request(app).post('/api/auth/login').send({ email: users.owner.email, password }))
        .status
    ).toBe(401)
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: users.owner.email, password: 'new-password-456' })
      ).status
    ).toBe(200)
  })

  test('an incorrect current password leaves the password and session version unchanged', async () => {
    const cookie = await login(users.owner)
    const before = await pool.query('SELECT session_version FROM users WHERE id=$1', [
      users.owner.id,
    ])
    const response = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'incorrect-password', newPassword: 'new-password-456' })
    const after = await pool.query('SELECT session_version FROM users WHERE id=$1', [
      users.owner.id,
    ])

    expect(response.status).toBe(400)
    expect(after.rows[0].session_version).toBe(before.rows[0].session_version)
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200)
    expect(
      (await request(app).post('/api/auth/login').send({ email: users.owner.email, password }))
        .status
    ).toBe(200)
  })

  test('account deletion makes every existing cookie unusable', async () => {
    const currentCookie = await login(users.outsider)
    const otherCookie = await login(users.outsider)
    const response = await request(app)
      .delete('/api/auth/account')
      .set('Cookie', currentCookie)
      .send({ password })

    expect(response.status).toBe(204)
    expect((await request(app).get('/api/auth/me').set('Cookie', currentCookie)).status).toBe(401)
    expect((await request(app).get('/api/auth/me').set('Cookie', otherCookie)).status).toBe(401)
    const deletedUser = await pool.query('SELECT id FROM users WHERE id=$1', [users.outsider.id])
    expect(deletedUser.rowCount).toBe(0)
  })

  test('rejects a previously issued token without a session version', async () => {
    const payload = Buffer.from(
      JSON.stringify({ sub: users.owner.id, exp: Date.now() + 60_000 })
    ).toString('base64url')
    const signature = crypto
      .createHmac('sha256', testSessionSecret)
      .update(payload)
      .digest('base64url')
    const legacyCookie = `nexa_session=${payload}.${signature}`

    expect((await request(app).get('/api/auth/me').set('Cookie', legacyCookie)).status).toBe(401)
  })

  test('adds the session version repeatedly without changing existing account data', async () => {
    const before = await pool.query('SELECT name,email,password_hash FROM users WHERE id=$1', [
      users.owner.id,
    ])

    await pool.query('ALTER TABLE users DROP COLUMN session_version')
    await initializeDatabase()
    await initializeDatabase()

    const after = await pool.query(
      'SELECT name,email,password_hash,session_version FROM users WHERE id=$1',
      [users.owner.id]
    )
    expect(after.rows[0]).toMatchObject({
      name: before.rows[0].name,
      email: before.rows[0].email,
      password_hash: before.rows[0].password_hash,
      session_version: 1,
    })
  })

  test('concurrent password changes increment the version exactly once', async () => {
    const cookie = await login(users.owner)
    const requests = ['new-password-111', 'new-password-222'].map((newPassword) =>
      request(app)
        .post('/api/auth/change-password')
        .set('Cookie', cookie)
        .send({ currentPassword: password, newPassword })
    )
    const responses = await Promise.all(requests)
    const statuses = responses.map(({ status }) => status).sort()
    const version = await pool.query('SELECT session_version FROM users WHERE id=$1', [
      users.owner.id,
    ])
    const winner = responses.find(({ status }) => status === 200)
    const renewedCookie = getCookie(winner)

    expect(statuses).toEqual([200, 401])
    expect(version.rows[0].session_version).toBe(2)
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401)
    expect((await request(app).get('/api/auth/me').set('Cookie', renewedCookie)).status).toBe(200)
  })
})
