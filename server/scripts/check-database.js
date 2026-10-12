require('dotenv').config({ quiet: true })
const { Pool } = require('pg')

async function checkDatabase() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL est absent de la configuration locale du serveur.')
    process.exitCode = 1
    return
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  })

  try {
    await pool.query('SELECT 1')
  } catch {
    console.error(
      'Connexion à PostgreSQL impossible avec la configuration locale. Vérifie que DATABASE_URL correspond aux identifiants déjà associés au volume. Aucun mot de passe n’a été modifié.'
    )
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

checkDatabase().catch(() => {
  console.error('Impossible de vérifier la connexion à PostgreSQL avec la configuration locale.')
  process.exitCode = 1
})
