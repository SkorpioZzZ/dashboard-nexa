const { spawn } = require('node:child_process')

const children = []
let stopping = false

function stopAll(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 300)
}

function run(command, args, label) {
  const child = spawn(command, args, { stdio: 'inherit' })
  children.push(child)
  child.on('error', (error) => {
    console.error(`[${label}] ${error.message}`)
    stopAll(1)
  })
  child.on('exit', (code) => {
    if (!stopping && code !== 0) {
      console.error(`[${label}] arrêté avec le code ${code ?? 'inconnu'}`)
      stopAll(code || 1)
    }
  })
}

function startServices() {
  console.log('\nDémarrage de l’API et du dashboard…')
  run('npm', ['run', 'dev', '--prefix', 'server'], 'API')
  run('npm', ['run', 'dev', '--prefix', 'client', '--', '--host', '127.0.0.1'], 'Dashboard')
  console.log('\nLe dashboard sera disponible sur http://localhost:5173')
  console.log('Pour tout arrêter, faites Ctrl+C dans ce terminal.\n')
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))

console.log('Démarrage de PostgreSQL…')
const database = spawn('docker', ['compose', 'up', '-d', 'postgres'], { stdio: 'inherit' })
database.on('error', (error) => {
  console.error(
    `Impossible de démarrer PostgreSQL : ${error.message}. Installe et démarre Docker, puis relance « npm run dev ».`
  )
  stopAll(1)
})
database.on('exit', (code) => {
  if (stopping) return
  if (code !== 0) {
    console.error(
      'Docker n’a pas pu démarrer PostgreSQL. Vérifie que Docker est installé et démarré.'
    )
    stopAll(code || 1)
    return
  }
  // A reused Docker volume keeps its original PostgreSQL password even if
  // docker-compose.yml changes. Set it to the local compose credential without
  // touching any database contents.
  const credentials = spawn(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      '-u',
      'postgres',
      'postgres',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-c',
      "ALTER ROLE postgres WITH PASSWORD 'postgres'",
    ],
    { stdio: 'inherit' }
  )
  credentials.on('error', (error) => {
    console.error(`Impossible de configurer l’accès local à PostgreSQL : ${error.message}`)
    stopAll(1)
  })
  credentials.on('exit', (passwordCode) => {
    if (stopping) return
    if (passwordCode !== 0) {
      console.error('Impossible de configurer le mot de passe local de PostgreSQL.')
      stopAll(passwordCode || 1)
      return
    }
    startServices()
  })
})
