const crypto = require('node:crypto')
const express = require('express')
const request = require('supertest')
const { pool } = require('../src/db')
const { createRateLimiter } = require('../src/rateLimit')

const secret = 'nexa-test-session-secret-only-32-characters'

function createHarness({
  db = pool,
  operation = 'rate-limit-test',
  maxRequests = 2,
  windowSeconds = 60,
  getIdentifier = (req) => req.query.id,
  cleanupIntervalMs = 60_000,
}) {
  const app = express()
  app.get(
    '/limited',
    createRateLimiter({
      pool: db,
      secret,
      operation,
      maxRequests,
      windowSeconds,
      getIdentifier,
      cleanupIntervalMs,
    }),
    (req, res) => res.json({ ok: true })
  )
  return app
}

function bucketKey(operation, identifier) {
  return crypto.createHmac('sha256', secret).update(`${operation}\0${identifier}`).digest('hex')
}

describe('PostgreSQL rate limits', () => {
  test('returns 429 and Retry-After after the configured number of requests', async () => {
    const app = createHarness({ maxRequests: 2, windowSeconds: 60 })

    expect((await request(app).get('/limited?id=client-a')).status).toBe(200)
    expect((await request(app).get('/limited?id=client-a')).status).toBe(200)
    const limited = await request(app).get('/limited?id=client-a')

    expect(limited.status).toBe(429)
    expect(Number(limited.headers['retry-after'])).toBeGreaterThanOrEqual(1)
    expect(Number(limited.headers['retry-after'])).toBeLessThanOrEqual(60)
    expect(limited.body.error).toMatch(/Trop de tentatives/)

    const { rows } = await pool.query(
      'SELECT request_count FROM rate_limit_buckets WHERE bucket_key=$1',
      [bucketKey('rate-limit-test', 'client-a')]
    )
    expect(Number(rows[0].request_count)).toBe(3)
  })

  test('starts a fresh fixed window after expiry and cleans expired buckets', async () => {
    const operation = 'rate-limit-expiry-test'
    const identifier = 'expired-client'
    const app = createHarness({ operation, maxRequests: 1, windowSeconds: 60 })
    expect((await request(app).get(`/limited?id=${identifier}`)).status).toBe(200)
    expect((await request(app).get(`/limited?id=${identifier}`)).status).toBe(429)

    await pool.query(
      `UPDATE rate_limit_buckets
       SET window_id=window_id-100, expires_at=statement_timestamp()-interval '1 second'
       WHERE bucket_key=$1`,
      [bucketKey(operation, identifier)]
    )

    const nextWindow = createHarness({ operation, maxRequests: 1, windowSeconds: 60 })
    expect((await request(nextWindow).get(`/limited?id=${identifier}`)).status).toBe(200)
    const { rows } = await pool.query(
      'SELECT expires_at > statement_timestamp() AS active FROM rate_limit_buckets WHERE bucket_key=$1',
      [bucketKey(operation, identifier)]
    )
    expect(rows[0].active).toBe(true)
    const { rows: expiredRows } = await pool.query(
      'SELECT count(*)::integer AS count FROM rate_limit_buckets WHERE expires_at <= statement_timestamp()'
    )
    expect(expiredRows[0].count).toBe(0)
  })

  test('counts concurrent requests atomically without exceeding the limit', async () => {
    const app = createHarness({ operation: 'rate-limit-concurrent-test', maxRequests: 3 })
    const responses = await Promise.all(
      Array.from({ length: 12 }, () => request(app).get('/limited?id=concurrent-client'))
    )

    expect(responses.filter((response) => response.status === 200)).toHaveLength(3)
    expect(responses.filter((response) => response.status === 429)).toHaveLength(9)
  })

  test('isolates counters by identifier and operation', async () => {
    const firstOperation = createHarness({ operation: 'rate-limit-isolation-a', maxRequests: 1 })
    const secondOperation = createHarness({ operation: 'rate-limit-isolation-b', maxRequests: 1 })

    expect((await request(firstOperation).get('/limited?id=user-a')).status).toBe(200)
    expect((await request(firstOperation).get('/limited?id=user-a')).status).toBe(429)
    expect((await request(firstOperation).get('/limited?id=user-b')).status).toBe(200)
    expect((await request(secondOperation).get('/limited?id=user-a')).status).toBe(200)
  })

  test('ignores forwarded IP headers when Express proxy trust is not configured', async () => {
    const app = createHarness({
      operation: 'rate-limit-forwarded-ip-test',
      maxRequests: 1,
      getIdentifier: (req) => req.ip,
    })

    expect(
      (await request(app).get('/limited').set('X-Forwarded-For', '198.51.100.10')).status
    ).toBe(200)
    expect((await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.20')).status).toBe(
      429
    )
  })

  test('fails closed with a generic response when PostgreSQL is unavailable', async () => {
    const unavailablePool = {
      query: jest.fn().mockRejectedValue(new Error('sensitive database detail')),
    }
    const app = createHarness({ db: unavailablePool, operation: 'rate-limit-db-error-test' })
    const response = await request(app).get('/limited?id=client-a')

    expect(response.status).toBe(503)
    expect(response.body.error).toBe('Service temporairement indisponible.')
    expect(response.text).not.toContain('sensitive database detail')
  })
})
