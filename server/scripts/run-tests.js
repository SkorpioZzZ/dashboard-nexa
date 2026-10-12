const { spawnSync } = require('node:child_process')

const testDatabaseUrl = 'postgresql://nexa_test:nexa_test_only@127.0.0.1:55432/nexa_dashboard_test'
const configuredDatabaseUrl = process.env.DATABASE_URL

if (configuredDatabaseUrl && configuredDatabaseUrl !== testDatabaseUrl) {
  console.error('Tests refusés : DATABASE_URL ne désigne pas la base PostgreSQL de test dédiée.')
  process.exit(1)
}

const parsedUrl = new URL(testDatabaseUrl)
if (
  parsedUrl.hostname !== '127.0.0.1' ||
  parsedUrl.port !== '55432' ||
  parsedUrl.pathname !== '/nexa_dashboard_test' ||
  parsedUrl.username !== 'nexa_test'
) {
  console.error('Tests refusés : la configuration PostgreSQL de test ne passe pas les garde-fous.')
  process.exit(1)
}

const jestPath = require.resolve('jest/bin/jest')
const result = spawnSync(process.execPath, [jestPath, '--runInBand'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    NODE_ENV: 'test',
    SESSION_SECRET: 'nexa-test-session-secret-only-32-characters',
    CLIENT_URL: 'http://127.0.0.1:5173',
  },
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)
