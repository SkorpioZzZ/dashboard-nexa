const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      session_version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      client TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      due DATE,
      color TEXT NOT NULL DEFAULT 'purple',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      person TEXT NOT NULL DEFAULT '',
      due DATE,
      status TEXT NOT NULL DEFAULT 'À faire',
      color TEXT NOT NULL DEFAULT 'purple',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, id),
      FOREIGN KEY (user_id, project_id) REFERENCES projects(user_id, id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS project_members (
      owner_user_id UUID NOT NULL,
      project_id TEXT NOT NULL,
      member_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      can_create_tasks BOOLEAN NOT NULL DEFAULT false,
      can_edit_tasks BOOLEAN NOT NULL DEFAULT false,
      can_delete_tasks BOOLEAN NOT NULL DEFAULT false,
      role TEXT NOT NULL DEFAULT 'lecteur' CHECK (
        role IN ('lecteur', 'developpeur', 'responsable', 'administrateur')
      ),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_user_id, project_id, member_user_id),
      FOREIGN KEY (owner_user_id, project_id) REFERENCES projects(user_id, id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS team_members (
      owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      member_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'Membre',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_user_id, member_user_id),
      CHECK (owner_user_id <> member_user_id)
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT,
      entity_name TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS rate_limit_buckets (
      bucket_key TEXT PRIMARY KEY,
      window_id BIGINT NOT NULL,
      request_count BIGINT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS activity_events_user_created_idx ON activity_events(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS rate_limit_buckets_expiry_idx ON rate_limit_buckets(expires_at);
    CREATE INDEX IF NOT EXISTS tasks_user_project_idx ON tasks(user_id, project_id);
    CREATE INDEX IF NOT EXISTS project_members_member_idx ON project_members(member_user_id);
    CREATE INDEX IF NOT EXISTS team_members_member_idx ON team_members(member_user_id);
    ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS can_create_tasks BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS can_edit_tasks BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS can_delete_tasks BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'lecteur';

-- Retirer l'ancienne contrainte pour permettre la conversion des rôles.
    ALTER TABLE project_members
    DROP CONSTRAINT IF EXISTS project_members_role_check;

    -- Convertir les anciens rôles vers les quatre rôles actuels.
    -- Le choix de developpeur évite d'accorder automatiquement
    -- les droits supplémentaires de gestion du projet et des membres.
    UPDATE project_members
    SET role = CASE
      WHEN role = 'contributeur' THEN 'developpeur'
      WHEN role = 'editeur' THEN 'developpeur'
      WHEN role = 'lecteur'
        AND (can_create_tasks OR can_edit_tasks OR can_delete_tasks)
        THEN 'developpeur'
      WHEN role IN ('lecteur', 'developpeur', 'responsable', 'administrateur')
        THEN role
      ELSE 'lecteur'
    END;

    -- N'autoriser que les quatre rôles définis.
    ALTER TABLE project_members
    ADD CONSTRAINT project_members_role_check
    CHECK (
      role IN ('lecteur', 'developpeur', 'responsable', 'administrateur')
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
    UPDATE users SET
      first_name = COALESCE(NULLIF(first_name, ''), split_part(name, ' ', 1)),
      last_name = COALESCE(NULLIF(last_name, ''), NULLIF(trim(substr(name, length(split_part(name, ' ', 1)) + 1)), '')),
      username = COALESCE(NULLIF(username, ''), lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_.-]', '', 'g')) || substr(id::text, 1, 6))
      WHERE first_name IS NULL OR last_name IS NULL OR username IS NULL;
    ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
    ALTER TABLE users ALTER COLUMN username SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_unique_idx ON users (lower(username));
  `)
}

module.exports = { pool, initializeDatabase }
