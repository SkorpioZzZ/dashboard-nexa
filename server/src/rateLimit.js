const crypto = require('node:crypto')

const cleanupSql = 'DELETE FROM rate_limit_buckets WHERE expires_at <= statement_timestamp()'

const consumeSql = `
  WITH current_window AS (
    SELECT floor(extract(epoch FROM statement_timestamp()) / $2::numeric)::bigint AS window_id
  )
  INSERT INTO rate_limit_buckets(bucket_key,window_id,request_count,expires_at,updated_at)
  SELECT
    $1,
    current_window.window_id,
    1,
    to_timestamp(((current_window.window_id + 1) * $2::bigint)::double precision),
    statement_timestamp()
  FROM current_window
  ON CONFLICT(bucket_key) DO UPDATE SET
    request_count = CASE
      WHEN rate_limit_buckets.window_id = EXCLUDED.window_id
        THEN LEAST(rate_limit_buckets.request_count + 1, $3::bigint + 1)
      ELSE 1
    END,
    window_id = EXCLUDED.window_id,
    expires_at = EXCLUDED.expires_at,
    updated_at = statement_timestamp()
  RETURNING request_count,
    GREATEST(1, CEIL(EXTRACT(EPOCH FROM expires_at - statement_timestamp())))::integer AS retry_after
`

function createRateLimiter({
  pool,
  secret,
  operation,
  maxRequests,
  windowSeconds,
  getIdentifier,
  cleanupIntervalMs = 5 * 60 * 1000,
}) {
  let nextCleanupAt = 0
  let cleanupInProgress

  async function cleanExpiredBuckets() {
    if (Date.now() < nextCleanupAt) return
    if (!cleanupInProgress) {
      cleanupInProgress = pool
        .query(cleanupSql)
        .then(() => {
          nextCleanupAt = Date.now() + cleanupIntervalMs
        })
        .finally(() => {
          cleanupInProgress = undefined
        })
    }
    await cleanupInProgress
  }

  return async function rateLimit(req, res, next) {
    try {
      const identifier = getIdentifier(req)
      if (!secret || !identifier) {
        return res.status(503).json({ error: 'Service temporairement indisponible.' })
      }

      await cleanExpiredBuckets()
      const bucketKey = crypto
        .createHmac('sha256', secret)
        .update(`${operation}\0${identifier}`)
        .digest('hex')
      const { rows } = await pool.query(consumeSql, [bucketKey, windowSeconds, maxRequests])
      const counter = rows[0]
      if (!counter) return res.status(503).json({ error: 'Service temporairement indisponible.' })

      if (Number(counter.request_count) > maxRequests) {
        res.setHeader('Retry-After', String(Math.max(1, Number(counter.retry_after))))
        return res
          .status(429)
          .json({ error: 'Trop de tentatives. Réessaie après le délai indiqué.' })
      }

      return next()
    } catch {
      return res.status(503).json({ error: 'Service temporairement indisponible.' })
    }
  }
}

module.exports = { createRateLimiter }
