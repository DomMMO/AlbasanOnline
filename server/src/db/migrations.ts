import { pool } from "./pool";

// Schema changes, applied in order on server start. Never edit a migration that
// has already run somewhere: add a new one instead.

const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: "accounts, sessions, characters",
    sql: `
      CREATE TABLE accounts (
        id            SERIAL PRIMARY KEY,
        username      TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX accounts_username_unique ON accounts (lower(username));

      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX sessions_account ON sessions (account_id);

      CREATE TABLE characters (
        id         SERIAL PRIMARY KEY,
        account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        class      TEXT NOT NULL DEFAULT 'warrior',
        color      INT NOT NULL,
        level      INT NOT NULL DEFAULT 1,
        xp         INT NOT NULL DEFAULT 0,
        -- NULL = not placed yet / place at spawn
        hp         INT,
        x          DOUBLE PRECISION,
        y          DOUBLE PRECISION,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX characters_name_unique ON characters (lower(name));
      CREATE INDEX characters_account ON characters (account_id);
    `,
  },
  {
    version: 2,
    name: "gold and items",
    sql: `
      ALTER TABLE characters ADD COLUMN gold INT NOT NULL DEFAULT 0 CHECK (gold >= 0);

      -- One row per item instance. Instances matter: +N upgrades (Phase 3) live on the instance.
      CREATE TABLE items (
        uid          UUID PRIMARY KEY,
        character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        def_id       TEXT NOT NULL,
        qty          INT NOT NULL CHECK (qty > 0),
        enhance      INT NOT NULL DEFAULT 0,
        container    TEXT NOT NULL CHECK (container IN ('inventory', 'equipment')),
        -- inventory: slot index; equipment: slot name
        position     TEXT NOT NULL,
        UNIQUE (character_id, container, position)
      );
      CREATE INDEX items_character ON items (character_id);
    `,
  },
  {
    version: 3,
    name: "admin accounts and GM audit log",
    sql: `
      ALTER TABLE accounts ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

      -- Every GM action, so changes to the economy can be traced later.
      CREATE TABLE admin_log (
        id           BIGSERIAL PRIMARY KEY,
        admin_id     INT NOT NULL REFERENCES accounts(id),
        character_id INT REFERENCES characters(id) ON DELETE SET NULL,
        action       TEXT NOT NULL,
        details      JSONB NOT NULL DEFAULT '{}',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX admin_log_character ON admin_log (character_id);
    `,
  },
  {
    version: 4,
    name: "pvp stats",
    sql: `
      ALTER TABLE characters
        ADD COLUMN pvp_rating INT NOT NULL DEFAULT 1000,
        ADD COLUMN pvp_kills INT NOT NULL DEFAULT 0,
        ADD COLUMN pvp_deaths INT NOT NULL DEFAULT 0;
      CREATE INDEX characters_pvp_rating ON characters (pvp_rating DESC);
    `,
  },
  {
    version: 5,
    name: "saved zone (main town + hunting grounds)",
    sql: `
      -- Which persistent zone x/y belong to. Everyone starts over in the new town.
      ALTER TABLE characters ADD COLUMN zone TEXT NOT NULL DEFAULT 'town';
      UPDATE characters SET x = NULL, y = NULL;
    `,
  },
  {
    version: 6,
    name: "quests",
    sql: `
      CREATE TABLE character_quests (
        character_id INT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        quest_id     TEXT NOT NULL,
        status       TEXT NOT NULL CHECK (status IN ('active', 'done')),
        -- kill counts per objective
        kills        INT[] NOT NULL DEFAULT '{}',
        PRIMARY KEY (character_id, quest_id)
      );
    `,
  },
  {
    version: 7,
    name: "item modifiers, world settings (day/night clock)",
    sql: `
      -- Random equipment modifiers: [{ "id": "attack", "value": 7 }, ...]
      ALTER TABLE items ADD COLUMN affixes JSONB NOT NULL DEFAULT '[]';
      CREATE TABLE world_settings (
        key        TEXT PRIMARY KEY,
        value      JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    version: 8,
    name: "passive tree jewels",
    sql: `
      ALTER TABLE items DROP CONSTRAINT items_container_check;
      ALTER TABLE items ADD CONSTRAINT items_container_check CHECK (container IN ('inventory', 'equipment', 'passive'));
    `,
  },
  {
    version: 9,
    name: "skill ranks and daily fortune",
    sql: `
      -- skill / passive id -> rank (see shared/src/data/talents.ts); {} = default allocation
      ALTER TABLE characters ADD COLUMN skill_ranks JSONB NOT NULL DEFAULT '{}';
      -- Ayşe Teyze's fortune for one day: { "day": "2026-10-13", "good": true, "line": 2 }
      ALTER TABLE characters ADD COLUMN fortune JSONB;
    `,
  },
];

export async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const { rows } = await pool.query<{ version: number }>("SELECT version FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.version));

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [migration.version]);
      await client.query("COMMIT");
      console.log(`[db] applied migration ${migration.version}: ${migration.name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
