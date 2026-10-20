const crypto = require('node:crypto')
const { promisify } = require('node:util')
const { pool, initializeDatabase } = require('../src/db')

const scrypt = promisify(crypto.scrypt)
const password = 'test-password-123'
const fixedSalt = 'nexa-permission-test-salt'
const users = {
  owner: {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Owner Test',
    email: 'owner@example.test',
    firstName: 'Owner',
    lastName: 'Test',
    username: 'owner_test',
  },
  reader: {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'Reader Test',
    email: 'reader@example.test',
    firstName: 'Reader',
    lastName: 'Test',
    username: 'reader_test',
  },
  contributor: {
    id: '00000000-0000-4000-8000-000000000003',
    name: 'Contributor Test',
    email: 'contributor@example.test',
    firstName: 'Contributor',
    lastName: 'Test',
    username: 'contributor_test',
  },
  editor: {
    id: '00000000-0000-4000-8000-000000000004',
    name: 'Editor Test',
    email: 'editor@example.test',
    firstName: 'Editor',
    lastName: 'Test',
    username: 'editor_test',
  },
  admin: {
    id: '00000000-0000-4000-8000-000000000006',
    name: 'Admin Test',
    email: 'admin@example.test',
    firstName: 'Admin',
    lastName: 'Test',
    username: 'admin_test',
  },
  outsider: {
    id: '00000000-0000-4000-8000-000000000005',
    name: 'Outsider Test',
    email: 'outsider@example.test',
    firstName: 'Outsider',
    lastName: 'Test',
    username: 'outsider_test',
  },
}

const projectIds = {
  shared: 'test-shared-project',
  destination: 'test-destination-project',
}
const taskIds = { shared: 'test-shared-task', private: 'test-private-task' }

async function resetDatabase() {
  const passwordHash = `${fixedSalt}:${(await scrypt(password, fixedSalt, 64)).toString('hex')}`
  await pool.query(
    'TRUNCATE rate_limit_buckets, activity_events, tasks, project_members, projects, users RESTART IDENTITY CASCADE'
  )

  for (const user of Object.values(users)) {
    await pool.query(
      'INSERT INTO users(id,name,first_name,last_name,username,email,password_hash) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [user.id, user.name, user.firstName, user.lastName, user.username, user.email, passwordHash]
    )
  }

  await pool.query(
    "INSERT INTO projects(user_id,id,name) VALUES($1,$2,'Shared project'),($1,$3,'Destination project')",
    [users.owner.id, projectIds.shared, projectIds.destination]
  )
  await pool.query(
    "INSERT INTO projects(user_id,id,name) VALUES($1,'private-project','Private project')",
    [users.outsider.id]
  )

  for (const [key, role] of Object.entries({
    reader: 'lecteur',
    contributor: 'developpeur',
    editor: 'responsable',
    admin: 'administrateur',
  })) {
    await pool.query(
      'INSERT INTO project_members(owner_user_id,project_id,member_user_id,role,can_create_tasks,can_edit_tasks,can_delete_tasks) VALUES($1,$2,$3,$4,$5,$5,$6)',
      [
        users.owner.id,
        projectIds.shared,
        users[key].id,
        role,
        role !== 'lecteur',
        role === 'responsable' || role === 'administrateur',
      ]
    )
  }

  await pool.query(
    "INSERT INTO tasks(user_id,id,project_id,title,person) VALUES($1,$2,$3,'Shared task','Owner Test'),($4,$5,$6,'Private task','Outsider Test')",
    [
      users.owner.id,
      taskIds.shared,
      projectIds.shared,
      users.outsider.id,
      taskIds.private,
      'private-project',
    ]
  )
  await pool.query(
    "INSERT INTO activity_events(user_id,actor_user_id,project_id,entity_name,action) VALUES($1,$2,$3,'Shared task','created'),($4,$4,'private-project','Private task','created')",
    [users.owner.id, users.owner.id, projectIds.shared, users.outsider.id]
  )
}

beforeAll(async () => {
  if (
    process.env.DATABASE_URL !==
    'postgresql://nexa_test:nexa_test_only@127.0.0.1:55432/nexa_dashboard_test'
  ) {
    throw new Error('Tests refusés : DATABASE_URL ne désigne pas exclusivement la base de test.')
  }
  await initializeDatabase()
  const { rows } = await pool.query(
    'SELECT current_database() AS database, current_user AS username'
  )
  if (rows[0]?.database !== 'nexa_dashboard_test' || rows[0]?.username !== 'nexa_test') {
    throw new Error('Tests refusés : la connexion PostgreSQL ne correspond pas à la base de test.')
  }
})

beforeEach(resetDatabase)

afterAll(async () => {
  await pool.end()
})

module.exports = { users, projectIds, taskIds, password }
