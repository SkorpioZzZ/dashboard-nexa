const request = require('supertest')
const app = require('../src/server')
const { users, password } = require('./setup')

function getCookie(response) {
  return response.headers['set-cookie'][0].split(';')[0]
}

describe('rate limit route integration', () => {
  test('applies the configured IP limits to login and registration routes', async () => {
    const loginResponses = []
    for (let attempt = 0; attempt < 21; attempt += 1) {
      loginResponses.push(await request(app).post('/api/auth/login').send({}))
    }
    expect(loginResponses.filter(({ status }) => status === 400)).toHaveLength(20)
    const limitedLogin = loginResponses.find(({ status }) => status === 429)
    expect(limitedLogin).toBeDefined()
    expect(Number(limitedLogin.headers['retry-after'])).toBeGreaterThanOrEqual(1)

    const registrationResponses = []
    for (let attempt = 0; attempt < 6; attempt += 1) {
      registrationResponses.push(await request(app).post('/api/auth/register').send({}))
    }
    expect(registrationResponses.filter(({ status }) => status === 400)).toHaveLength(5)
    const limitedRegistration = registrationResponses.find(({ status }) => status === 429)
    expect(limitedRegistration).toBeDefined()
    expect(Number(limitedRegistration.headers['retry-after'])).toBeGreaterThanOrEqual(1)
  })

  test('scopes password change attempts to the authenticated user and IP', async () => {
    const ownerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: users.owner.email, password })
    const ownerCookie = getCookie(ownerLogin)
    const ownerAttempts = []
    for (let attempt = 0; attempt < 6; attempt += 1) {
      ownerAttempts.push(
        await request(app)
          .post('/api/auth/change-password')
          .set('Cookie', ownerCookie)
          .send({ currentPassword: 'incorrect-password', newPassword: 'new-password-456' })
      )
    }
    expect(ownerAttempts.filter(({ status }) => status === 400)).toHaveLength(5)
    expect(ownerAttempts.find(({ status }) => status === 429)).toBeDefined()

    const readerLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: users.reader.email, password })
    const readerAttempt = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', getCookie(readerLogin))
      .send({ currentPassword: 'incorrect-password', newPassword: 'new-password-456' })

    expect(readerAttempt.status).toBe(400)
  })
})
