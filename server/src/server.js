if (process.env.NODE_ENV !== 'test') require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const crypto = require('node:crypto')
const path = require('node:path')
const { promisify } = require('node:util')
const { z } = require('zod')
const { pool, initializeDatabase } = require('./db')
const { createRateLimiter } = require('./rateLimit')

const app = express()
const scrypt = promisify(crypto.scrypt)
const COOKIE = 'nexa_session'
const SESSION_DAYS = 7
const secret = process.env.SESSION_SECRET
const trustedProxies = (process.env.TRUSTED_PROXIES || '')
  .split(',')
  .map((proxy) => proxy.trim())
  .filter(Boolean)

if (trustedProxies.length) app.set('trust proxy', trustedProxies)

app.use(helmet())
app.use(
  cors({
    origin: [process.env.CLIENT_URL || 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  })
)
app.use(express.json({ limit: '100kb' }))
app.use(morgan('dev'))

const loginRateLimit = createRateLimiter({
  pool,
  secret,
  operation: 'auth-login-ip',
  maxRequests: 20,
  windowSeconds: 15 * 60,
  getIdentifier: (req) => req.ip,
})
const registrationRateLimit = createRateLimiter({
  pool,
  secret,
  operation: 'auth-register-ip',
  maxRequests: 5,
  windowSeconds: 60 * 60,
  getIdentifier: (req) => req.ip,
})
const passwordChangeRateLimit = createRateLimiter({
  pool,
  secret,
  operation: 'auth-change-password-user-ip',
  maxRequests: 5,
  windowSeconds: 15 * 60,
  getIdentifier: (req) => `${req.userId}:${req.ip}`,
})
const accountDeletionRateLimit = createRateLimiter({
  pool,
  secret,
  operation: 'auth-delete-account-user-ip',
  maxRequests: 5,
  windowSeconds: 15 * 60,
  getIdentifier: (req) => `${req.userId}:${req.ip}`,
})

function cookieOptions() {
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}
function clearCookieOptions() {
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${signature}`
}
function verify(token) {
  if (!token) return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null
  const expected = crypto.createHmac('sha256', secret).update(body).digest()
  let supplied
  try {
    supplied = Buffer.from(signature, 'base64url')
  } catch {
    return null
  }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected))
    return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    return payload.exp > Date.now() && Number.isInteger(payload.sessionVersion) ? payload : null
  } catch {
    return null
  }
}
function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split(/=(.*)/s).slice(0, 2))
      .filter(([key, value]) => key && value)
  )
}
function requireAuth(req, res, next) {
  const session = verify(parseCookies(req.headers.cookie)[COOKIE])
  if (!session || !z.string().uuid().safeParse(session.sub).success)
    return res.status(401).json({ error: 'Connectez-vous pour continuer.' })
  pool
    .query('SELECT session_version FROM users WHERE id=$1', [session.sub])
    .then(({ rows }) => {
      if (!rows[0] || rows[0].session_version !== session.sessionVersion) {
        return res.status(401).json({ error: 'Connectez-vous pour continuer.' })
      }
      req.userId = session.sub
      req.sessionVersion = session.sessionVersion
      next()
    })
    .catch(next)
}
function sessionCookie(user) {
  const token = sign({
    sub: user.id,
    sessionVersion: user.session_version,
    exp: Date.now() + SESSION_DAYS * 86400000,
  })
  return `${COOKIE}=${token}; ${cookieOptions()}`
}
function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}
async function recordActivity(userId, actorId, projectId, entityName, action) {
  await pool.query(
    'INSERT INTO activity_events(user_id,actor_user_id,project_id,entity_name,action) VALUES($1,$2,$3,$4,$5)',
    [userId, actorId, projectId, entityName, action]
  )
}
const credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
})
const projectInput = z.object({
  name: z.string().trim().min(1).max(160),
  client: z.string().max(160).default(''),
  description: z.string().max(2000).default(''),
  due: z.string().date().nullable().optional(),
  color: z.string().max(32).default('purple'),
})
const taskInput = z.object({
  title: z.string().trim().min(1).max(300),
  projectId: z.string().min(1).max(100),
  person: z.string().max(160).default(''),
  due: z.string().date().nullable().optional(),
  status: z.enum(['À faire', 'En cours', 'En revue', 'Terminé']).default('À faire'),
  color: z.string().max(32).default('purple'),
})
const projectRole = z.enum(['lecteur', 'contributeur', 'editeur'])
const entityId = z.string().trim().min(1).max(100)
async function hasProjectPermission(userId, projectId, permission) {
  const roles = {
    can_create_tasks: ['contributeur', 'editeur'],
    can_edit_tasks: ['contributeur', 'editeur'],
    can_delete_tasks: ['editeur'],
  }
  const allowedRoles = roles[permission] || []
  const { rows } = await pool.query(
    `SELECT (p.user_id=$1 OR pm.role=ANY($3::text[])) AS allowed FROM projects p LEFT JOIN project_members pm ON pm.owner_user_id=p.user_id AND pm.project_id=p.id AND pm.member_user_id=$1 WHERE p.id=$2 AND (p.user_id=$1 OR pm.member_user_id=$1)`,
    [userId, projectId, allowedRoles]
  )
  return rows[0]?.allowed === true
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.post(
  '/api/auth/register',
  registrationRateLimit,
  asyncRoute(async (req, res) => {
    const input = credentials
      .extend({
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().min(1).max(80),
        username: z
          .string()
          .trim()
          .min(3)
          .max(30)
          .regex(/^[a-zA-Z0-9_.-]+$/),
      })
      .safeParse(req.body)
    if (!input.success)
      return res.status(400).json({
        error:
          'Vérifiez votre prénom, votre nom, votre nom d’utilisateur (3 à 30 caractères) et votre mot de passe (8 caractères minimum).',
      })
    const { firstName, lastName, username, email, password } = input.data
    const name = `${firstName} ${lastName}`
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = (await scrypt(password, salt, 64)).toString('hex')
    try {
      const { rows } = await pool.query(
        'INSERT INTO users(name,first_name,last_name,username,email,password_hash) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,first_name AS "firstName",last_name AS "lastName",username,email,session_version',
        [name, firstName, lastName, username, email.toLowerCase(), `${salt}:${hash}`]
      )
      const user = rows[0]
      const publicUser = {
        id: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
      }
      res.setHeader('Set-Cookie', sessionCookie(user))
      res.status(201).json({ user: publicUser })
    } catch (error) {
      if (error.code === '23505') {
        if (error.constraint === 'users_username_lower_unique_idx')
          return res.status(409).json({ error: 'Ce nom d’utilisateur est déjà utilisé.' })
        return res.status(409).json({ error: 'Cette adresse e-mail possède déjà un compte.' })
      }
      throw error
    }
  })
)
app.post(
  '/api/auth/login',
  loginRateLimit,
  asyncRoute(async (req, res) => {
    const input = credentials.safeParse(req.body)
    if (!input.success)
      return res.status(400).json({ error: 'Adresse e-mail ou mot de passe invalide.' })
    const { rows } = await pool.query(
      'SELECT id,name,first_name AS "firstName",last_name AS "lastName",username,email,password_hash,session_version FROM users WHERE email=$1',
      [input.data.email.toLowerCase()]
    )
    const user = rows[0]
    const [salt, stored] = (user?.password_hash || ':').split(':')
    const candidate = await scrypt(input.data.password, salt || 'invalid', 64)
    const valid =
      stored &&
      Buffer.from(stored, 'hex').length === candidate.length &&
      crypto.timingSafeEqual(Buffer.from(stored, 'hex'), candidate)
    if (!valid) return res.status(401).json({ error: 'Adresse e-mail ou mot de passe incorrect.' })
    res.setHeader('Set-Cookie', sessionCookie(user))
    res.json({
      user: {
        id: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
      },
    })
  })
)
app.post(
  '/api/auth/change-password',
  requireAuth,
  passwordChangeRateLimit,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(8).max(128),
      })
      .safeParse(req.body)
    if (!input.success)
      return res
        .status(400)
        .json({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' })
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.userId])
    if (!rows[0]) return res.status(401).json({ error: 'Session invalide.' })
    const [salt, stored] = rows[0].password_hash.split(':')
    const candidate = await scrypt(input.data.currentPassword, salt, 64)
    const storedHash = Buffer.from(stored, 'hex')
    if (storedHash.length !== candidate.length || !crypto.timingSafeEqual(storedHash, candidate)) {
      return res.status(400).json({ error: 'Le mot de passe actuel est incorrect.' })
    }
    const newSalt = crypto.randomBytes(16).toString('hex')
    const newHash = (await scrypt(input.data.newPassword, newSalt, 64)).toString('hex')
    const updated = await pool.query(
      'UPDATE users SET password_hash=$2,session_version=session_version+1 WHERE id=$1 AND session_version=$3 RETURNING session_version',
      [req.userId, `${newSalt}:${newHash}`, req.sessionVersion]
    )
    if (!updated.rows[0]) return res.status(401).json({ error: 'Session invalide.' })
    res.setHeader(
      'Set-Cookie',
      sessionCookie({ id: req.userId, session_version: updated.rows[0].session_version })
    )
    res.json({ message: 'Mot de passe modifié avec succès.' })
  })
)
const profileInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  username: z
    .string()
    .trim()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_.-]+$/),
})
app.patch(
  '/api/auth/profile',
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = profileInput.safeParse(req.body)
    if (!input.success)
      return res.status(400).json({
        error: 'Vérifiez votre prénom, votre nom et votre nom d’utilisateur (3 à 30 caractères).',
      })
    const { firstName, lastName, username } = input.data
    try {
      const { rows } = await pool.query(
        'UPDATE users SET first_name=$2,last_name=$3,username=$4,name=$5 WHERE id=$1 RETURNING id,name,first_name AS "firstName",last_name AS "lastName",username,email',
        [req.userId, firstName, lastName, username, `${firstName} ${lastName}`]
      )
      if (!rows[0]) return res.status(401).json({ error: 'Session invalide.' })
      res.json({ user: rows[0] })
    } catch (error) {
      if (error.code === '23505' && error.constraint === 'users_username_lower_unique_idx')
        return res.status(409).json({ error: 'Ce nom d’utilisateur est déjà utilisé.' })
      throw error
    }
  })
)
app.delete(
  '/api/auth/account',
  requireAuth,
  accountDeletionRateLimit,
  asyncRoute(async (req, res) => {
    const input = z.object({ password: z.string().min(1).max(128) }).safeParse(req.body)
    if (!input.success)
      return res
        .status(400)
        .json({ error: 'Saisissez votre mot de passe pour confirmer la suppression.' })
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.userId])
    if (!rows[0]) return res.status(401).json({ error: 'Session invalide.' })
    const [salt, stored] = rows[0].password_hash.split(':')
    const candidate = await scrypt(input.data.password, salt, 64)
    const storedHash = Buffer.from(stored, 'hex')
    if (storedHash.length !== candidate.length || !crypto.timingSafeEqual(storedHash, candidate))
      return res.status(400).json({ error: 'Le mot de passe est incorrect.' })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM activity_events WHERE actor_user_id=$1 OR user_id=$1', [
        req.userId,
      ])
      await client.query('DELETE FROM users WHERE id=$1', [req.userId])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    res.setHeader('Set-Cookie', `${COOKIE}=; ${clearCookieOptions()}`)
    res.status(204).end()
  })
)
app.post(
  '/api/auth/logout',
  asyncRoute(async (req, res) => {
    const session = verify(parseCookies(req.headers.cookie)[COOKIE])
    if (session && z.string().uuid().safeParse(session.sub).success) {
      await pool.query(
        'UPDATE users SET session_version=session_version+1 WHERE id=$1 AND session_version=$2',
        [session.sub, session.sessionVersion]
      )
    }
    res.setHeader('Set-Cookie', `${COOKIE}=; ${clearCookieOptions()}`)
    res.status(204).end()
  })
)
app.get(
  '/api/auth/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id,name,first_name AS "firstName",last_name AS "lastName",username,email FROM users WHERE id=$1',
      [req.userId]
    )
    if (!rows[0]) return res.status(401).json({ error: 'Session invalide.' })
    res.json({ user: rows[0] })
  })
)

app.get(
  '/api/projects',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT p.id,p.name,p.client,p.description,to_char(p.due,'YYYY-MM-DD') AS due,p.color,p.user_id=$1 AS "isOwner",COALESCE(my.role,'lecteur') AS role,
    COALESCE((SELECT json_agg(json_build_object('id',u.id,'name',u.name,'email',u.email,'role',pm.role) ORDER BY u.name) FROM project_members pm JOIN users u ON u.id=pm.member_user_id WHERE pm.owner_user_id=p.user_id AND pm.project_id=p.id),'[]'::json) AS members
    FROM projects p LEFT JOIN project_members my ON my.owner_user_id=p.user_id AND my.project_id=p.id AND my.member_user_id=$1 WHERE p.user_id=$1 OR my.member_user_id=$1 ORDER BY p.created_at,p.id`,
      [req.userId]
    )
    res.json(rows)
  })
)
app.get(
  '/api/activity',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT e.id,e.entity_name AS "entityName",e.action,e.project_id AS "projectId",u.name AS "actorName",e.created_at AS "createdAt"
    FROM activity_events e JOIN users u ON u.id=e.actor_user_id
    WHERE e.user_id=$1 OR (e.project_id IS NOT NULL AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.owner_user_id=e.user_id AND pm.project_id=e.project_id AND pm.member_user_id=$1))
    ORDER BY e.created_at DESC,e.id DESC`,
      [req.userId]
    )
    res.json(rows)
  })
)
app.post(
  '/api/projects',
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = projectInput.safeParse(req.body)
    if (!input.success) return res.status(400).json({ error: 'Informations du projet invalides.' })
    const suppliedId = req.body.id === undefined ? null : entityId.safeParse(req.body.id)
    if (suppliedId && !suppliedId.success)
      return res.status(400).json({ error: 'Identifiant du projet invalide.' })
    const project = { id: suppliedId?.data || crypto.randomUUID(), ...input.data }
    const { rows } = await pool.query(
      "INSERT INTO projects(user_id,id,name,client,description,due,color) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,client,description,to_char(due,'YYYY-MM-DD') AS due,color",
      [
        req.userId,
        project.id,
        project.name,
        project.client,
        project.description,
        project.due || null,
        project.color,
      ]
    )
    await recordActivity(req.userId, req.userId, project.id, project.name, 'a créé le projet')
    res.status(201).json(rows[0])
  })
)
app.patch(
  '/api/projects/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = projectInput.partial().safeParse(req.body)
    if (!input.success || Object.keys(input.data || {}).length === 0)
      return res.status(400).json({ error: 'Informations du projet invalides.' })
    const current = await pool.query(
      "SELECT id,name,client,description,to_char(due,'YYYY-MM-DD') AS due,color FROM projects WHERE user_id=$1 AND id=$2",
      [req.userId, req.params.id]
    )
    if (!current.rows[0]) return res.status(404).json({ error: 'Projet introuvable.' })
    const value = { ...current.rows[0], ...input.data }
    const { rows } = await pool.query(
      "UPDATE projects SET name=$3,client=$4,description=$5,due=$6,color=$7 WHERE user_id=$1 AND id=$2 RETURNING id,name,client,description,to_char(due,'YYYY-MM-DD') AS due,color",
      [
        req.userId,
        req.params.id,
        value.name,
        value.client,
        value.description,
        value.due || null,
        value.color,
      ]
    )
    await recordActivity(req.userId, req.userId, req.params.id, value.name, 'a modifié le projet')
    res.json(rows[0])
  })
)
app.delete(
  '/api/projects/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const project = await pool.query('SELECT name FROM projects WHERE user_id=$1 AND id=$2', [
      req.userId,
      req.params.id,
    ])
    const { rowCount } = await pool.query('DELETE FROM projects WHERE user_id=$1 AND id=$2', [
      req.userId,
      req.params.id,
    ])
    if (!rowCount) return res.status(404).json({ error: 'Projet introuvable.' })
    await recordActivity(
      req.userId,
      req.userId,
      req.params.id,
      project.rows[0].name,
      'a supprimé le projet'
    )
    res.status(204).end()
  })
)
app.post(
  '/api/projects/:id/members',
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = z
      .object({ email: z.string().trim().email().max(254), role: projectRole.default('lecteur') })
      .safeParse(req.body)
    if (!input.success)
      return res.status(400).json({ error: 'Saisissez une adresse e-mail valide.' })
    const project = await pool.query('SELECT id FROM projects WHERE user_id=$1 AND id=$2', [
      req.userId,
      req.params.id,
    ])
    if (!project.rowCount)
      return res
        .status(404)
        .json({ error: 'Projet introuvable ou vous n’en êtes pas propriétaire.' })
    const user = await pool.query('SELECT id,name,email FROM users WHERE email=$1', [
      input.data.email.toLowerCase(),
    ])
    if (!user.rowCount)
      return res
        .status(404)
        .json({ error: 'Aucun compte Nexa ne correspond à cette adresse e-mail.' })
    if (user.rows[0].id === req.userId)
      return res.status(400).json({ error: 'Vous êtes déjà propriétaire de ce projet.' })
    await pool.query(
      'INSERT INTO project_members(owner_user_id,project_id,member_user_id,role,can_create_tasks,can_edit_tasks,can_delete_tasks) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (owner_user_id,project_id,member_user_id) DO UPDATE SET role=$4,can_create_tasks=$5,can_edit_tasks=$6,can_delete_tasks=$7',
      [
        req.userId,
        req.params.id,
        user.rows[0].id,
        input.data.role,
        input.data.role !== 'lecteur',
        input.data.role !== 'lecteur',
        input.data.role === 'editeur',
      ]
    )
    res.status(201).json({ ...user.rows[0], role: input.data.role })
  })
)
app.patch(
  '/api/projects/:id/members/:memberId',
  requireAuth,
  asyncRoute(async (req, res) => {
    const memberId = z.string().uuid().safeParse(req.params.memberId)
    if (!memberId.success) return res.status(400).json({ error: 'Identifiant du membre invalide.' })
    const input = z.object({ role: projectRole }).safeParse(req.body)
    if (!input.success) return res.status(400).json({ error: 'Rôle invalide.' })
    const { rows } = await pool.query(
      'UPDATE project_members SET role=$4,can_create_tasks=$5,can_edit_tasks=$5,can_delete_tasks=$6 WHERE owner_user_id=$1 AND project_id=$2 AND member_user_id=$3 RETURNING role',
      [
        req.userId,
        req.params.id,
        memberId.data,
        input.data.role,
        input.data.role !== 'lecteur',
        input.data.role === 'editeur',
      ]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Membre du projet introuvable.' })
    res.json(rows[0])
  })
)
app.delete(
  '/api/projects/:id/members/:memberId',
  requireAuth,
  asyncRoute(async (req, res) => {
    const memberId = z.string().uuid().safeParse(req.params.memberId)
    if (!memberId.success) return res.status(400).json({ error: 'Identifiant du membre invalide.' })
    const { rowCount } = await pool.query(
      'DELETE FROM project_members WHERE owner_user_id=$1 AND project_id=$2 AND member_user_id=$3',
      [req.userId, req.params.id, memberId.data]
    )
    if (!rowCount) return res.status(404).json({ error: 'Membre du projet introuvable.' })
    res.status(204).end()
  })
)
app.get(
  '/api/tasks',
  requireAuth,
  asyncRoute(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT t.id,t.title,t.project_id AS "projectId",t.person,to_char(t.due,'YYYY-MM-DD') AS due,t.status,t.color FROM tasks t
    WHERE EXISTS (SELECT 1 FROM projects p WHERE p.user_id=t.user_id AND p.id=t.project_id AND (p.user_id=$1 OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.owner_user_id=p.user_id AND pm.project_id=p.id AND pm.member_user_id=$1))) ORDER BY t.created_at,t.id`,
      [req.userId]
    )
    res.json(rows)
  })
)
app.post(
  '/api/tasks',
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = taskInput.safeParse(req.body)
    if (!input.success)
      return res.status(400).json({ error: 'Informations de la tâche invalides.' })
    const suppliedId = req.body.id === undefined ? null : entityId.safeParse(req.body.id)
    if (suppliedId && !suppliedId.success)
      return res.status(400).json({ error: 'Identifiant de la tâche invalide.' })
    const task = { id: suppliedId?.data || crypto.randomUUID(), ...input.data }
    if (!(await hasProjectPermission(req.userId, task.projectId, 'can_create_tasks')))
      return res
        .status(403)
        .json({ error: 'Vous n’avez pas l’autorisation de créer des tâches dans ce projet.' })
    const owner = await pool.query(
      'SELECT user_id FROM projects WHERE id=$1 AND (user_id=$2 OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.owner_user_id=projects.user_id AND pm.project_id=projects.id AND pm.member_user_id=$2))',
      [task.projectId, req.userId]
    )
    if (!owner.rowCount) return res.status(404).json({ error: 'Projet introuvable.' })
    const { rows } = await pool.query(
      `INSERT INTO tasks(user_id,id,project_id,title,person,due,status,color)
    SELECT $1,$2,$3,$4,u.name,$5,$6,$7 FROM users u WHERE u.id=$8
    RETURNING id,title,project_id AS "projectId",person,to_char(due,'YYYY-MM-DD') AS due,status,color`,
      [
        owner.rows[0].user_id,
        task.id,
        task.projectId,
        task.title,
        task.due || null,
        task.status,
        task.color,
        req.userId,
      ]
    )
    await recordActivity(
      owner.rows[0].user_id,
      req.userId,
      task.projectId,
      task.title,
      'a créé la tâche'
    )
    res.status(201).json(rows[0])
  })
)
app.patch(
  '/api/tasks/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const input = taskInput.partial().safeParse(req.body)
    if (!input.success || Object.keys(input.data || {}).length === 0)
      return res.status(400).json({ error: 'Informations de la tâche invalides.' })
    const current = await pool.query(
      `SELECT t.id,t.user_id AS "ownerId",t.title,t.project_id AS "projectId",t.person,to_char(t.due,'YYYY-MM-DD') AS due,t.status,t.color FROM tasks t WHERE t.id=$1 AND (t.user_id=$2 OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.owner_user_id=t.user_id AND pm.project_id=t.project_id AND pm.member_user_id=$2))`,
      [req.params.id, req.userId]
    )
    if (!current.rows[0]) return res.status(404).json({ error: 'Tâche introuvable.' })
    if (!(await hasProjectPermission(req.userId, current.rows[0].projectId, 'can_edit_tasks')))
      return res
        .status(403)
        .json({ error: 'Vous n’avez pas l’autorisation de modifier les tâches de ce projet.' })
    const value = { ...current.rows[0], ...input.data }
    if (!(await hasProjectPermission(req.userId, value.projectId, 'can_edit_tasks')))
      return res
        .status(403)
        .json({ error: 'Vous n’avez pas l’autorisation de modifier les tâches de ce projet.' })
    const { rows } = await pool.query(
      'UPDATE tasks SET project_id=$3,title=$4,person=$5,due=$6,status=$7,color=$8 WHERE user_id=$1 AND id=$2 RETURNING id,title,project_id AS "projectId",person,to_char(due,\'YYYY-MM-DD\') AS due,status,color',
      [
        current.rows[0].ownerId,
        req.params.id,
        value.projectId,
        value.title,
        value.person,
        value.due || null,
        value.status,
        value.color,
      ]
    )
    await recordActivity(
      current.rows[0].ownerId,
      req.userId,
      value.projectId,
      value.title,
      'a modifié la tâche'
    )
    res.json(rows[0])
  })
)
app.delete(
  '/api/tasks/:id',
  requireAuth,
  asyncRoute(async (req, res) => {
    const task = await pool.query(
      `SELECT t.user_id AS "ownerId",t.title,t.project_id AS "projectId" FROM tasks t WHERE t.id=$1 AND (t.user_id=$2 OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.owner_user_id=t.user_id AND pm.project_id=t.project_id AND pm.member_user_id=$2))`,
      [req.params.id, req.userId]
    )
    if (
      task.rows[0] &&
      !(await hasProjectPermission(req.userId, task.rows[0].projectId, 'can_delete_tasks'))
    )
      return res
        .status(403)
        .json({ error: 'Vous n’avez pas l’autorisation de supprimer les tâches de ce projet.' })
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE user_id=$1 AND id=$2', [
      task.rows[0]?.ownerId || req.userId,
      req.params.id,
    ])
    if (!rowCount) return res.status(404).json({ error: 'Tâche introuvable.' })
    await recordActivity(
      task.rows[0].ownerId,
      req.userId,
      task.rows[0].projectId,
      task.rows[0].title,
      'a supprimé la tâche'
    )
    res.status(204).end()
  })
)

const clientDist = path.join(__dirname, '../../client/dist')

app.use(express.static(clientDist))

app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
  res.sendFile(path.join(clientDist, 'index.html'), (error) => {
    if (error) next(error)
  })
})

app.use((error, req, res, next) => {
  console.error(error)
  if (error.code === '23503')
    return res.status(400).json({ error: 'Le projet associé est introuvable.' })
  res.status(500).json({ error: 'Une erreur serveur est survenue.' })
})

if (require.main === module) {
  if (!process.env.DATABASE_URL || !secret || secret.length < 32) {
    console.error('Configurez DATABASE_URL et un SESSION_SECRET d’au moins 32 caractères.')
    process.exit(1)
  }
  initializeDatabase()
    .then(() => {
      const port = process.env.PORT || 3000
      app.listen(port, () => console.log(`API Nexa disponible sur http://localhost:${port}`))
    })
    .catch((error) => {
      console.error(
        'Connexion ou initialisation PostgreSQL impossible. Vérifie la configuration locale.'
      )
      process.exit(1)
    })
}

module.exports = app
