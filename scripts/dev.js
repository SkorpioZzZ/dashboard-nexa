const { spawn } = require('node:child_process')
const path = require('node:path')

const children = []
let stopping = false
const projectRoot = path.join(__dirname, '..')
const serverRoot = path.join(projectRoot, 'server')

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

function checkDatabaseConnection() {
  const check = spawn(process.execPath, ['scripts/check-database.js'], {
    cwd: serverRoot,
    stdio: 'inherit',
  })
  children.push(check)
  check.on('error', () => {
    console.error('Impossible de vérifier la connexion à PostgreSQL.')
    stopAll(1)
  })
  check.on('exit', (code) => {
    if (stopping) return
    if (code !== 0) {
      console.error('L’API et le dashboard ne seront pas démarrés.')
      stopAll(code || 1)
      return
    }
    startServices()
  })
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))

console.log('Démarrage de PostgreSQL…')
const database = spawn('docker', ['compose', 'up', '-d', '--wait', 'postgres'], {
  cwd: projectRoot,
  stdio: 'inherit',
})
children.push(database)
database.on('error', (error) => {
  console.error(
    `Impossible de démarrer PostgreSQL : ${error.message}. Vérifie que Docker est installé et démarré.`
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
  checkDatabaseConnection()
})
