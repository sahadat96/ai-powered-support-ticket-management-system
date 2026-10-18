const { config } = require('dotenv');
const { Client } = require('pg');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const root = join(__dirname, '..');
config({ path: [join(root, '.env'), join(root, '../.env')], quiet: true });
const baseline = '0_init';
const tables = ['users', 'tickets', 'comments', 'ticket_events'];
const columns = {
  users: {
    id: 'uuid',
    email: 'character varying(254)',
    name: 'character varying(100)',
    password_hash: 'character varying(255)',
    role: 'character varying(20)',
    created_at: 'timestamp with time zone',
    updated_at: 'timestamp with time zone',
  },
  tickets: {
    id: 'uuid',
    number: 'integer',
    title: 'character varying(160)',
    description: 'text',
    status: 'character varying(20)',
    priority: 'character varying(20)',
    category: 'character varying(20)',
    requester_id: 'uuid',
    assignee_id: 'uuid',
    ai: 'jsonb',
    version: 'integer',
    created_at: 'timestamp with time zone',
    updated_at: 'timestamp with time zone',
    resolved_at: 'timestamp with time zone',
    deleted_at: 'timestamp with time zone',
  },
  comments: {
    id: 'uuid',
    ticket_id: 'uuid',
    author_id: 'uuid',
    body: 'text',
    internal: 'boolean',
    created_at: 'timestamp with time zone',
  },
  ticket_events: {
    id: 'uuid',
    ticket_id: 'uuid',
    actor_id: 'uuid',
    action: 'character varying(40)',
    detail: 'text',
    created_at: 'timestamp with time zone',
  },
};
const requiredConstraints = {
  users: [
    'users_pkey',
    'users_email_key',
    'users_role_check',
    'users_email_normalized',
    'users_name_nonempty',
  ],
  tickets: [
    'tickets_pkey',
    'tickets_number_key',
    'tickets_title_check',
    'tickets_description_check',
    'tickets_status_check',
    'tickets_priority_check',
    'tickets_category_check',
    'tickets_ai_check',
    'tickets_version_check',
    'tickets_active_work_assigned',
    'tickets_requester_id_fkey',
    'tickets_assignee_id_fkey',
  ],
  comments: [
    'comments_pkey',
    'comments_ticket_id_fkey',
    'comments_author_id_fkey',
    'comments_body_check',
  ],
  ticket_events: [
    'ticket_events_pkey',
    'ticket_events_ticket_id_fkey',
    'ticket_events_actor_id_fkey',
  ],
};
const indexes = [
  'tickets_recent_idx',
  'tickets_requester_idx',
  'tickets_assignee_idx',
  'tickets_status_idx',
  'comments_ticket_idx',
  'ticket_events_ticket_idx',
];

function refuse(detail) {
  throw new Error(
    `Existing support schema is not a verified legacy baseline (${detail}). No baseline was adopted. Review its migrations before continuing.`,
  );
}

async function verifyLegacySchema(client) {
  const marker = await client.query("SELECT to_regclass('public.support_migrations') AS name");
  if (!marker.rows[0].name) refuse('missing legacy history');
  const history = await client.query('SELECT name FROM public.support_migrations ORDER BY id');
  if (history.rows.length !== 1 || history.rows[0].name !== 'InitialSupportSchema1792281600000')
    refuse('unrecognized legacy history');
  const metadata = await client.query(
    `
    SELECT c.relname AS table_name, a.attname AS column_name,
      format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS required,
      a.attidentity AS identity, pg_get_expr(d.adbin, d.adrelid) AS default_value
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    WHERE n.nspname = 'support' AND c.relname = ANY($1::text[])
      AND a.attnum > 0 AND NOT a.attisdropped
  `,
    [tables],
  );
  for (const table of tables) {
    const actual = metadata.rows.filter((row) => row.table_name === table);
    if (actual.length !== Object.keys(columns[table]).length) refuse(`${table} columns`);
    for (const [name, type] of Object.entries(columns[table])) {
      const column = actual.find((row) => row.column_name === name);
      const nullable =
        table === 'tickets' && ['assignee_id', 'resolved_at', 'deleted_at'].includes(name);
      if (!column || column.type !== type || column.required === nullable)
        refuse(`${table}.${name}`);
      if (name === 'id' && !/gen_random_uuid\(\)/.test(column.default_value ?? ''))
        refuse(`${table} UUID default`);
      if (
        ['created_at', 'updated_at'].includes(name) &&
        !/now\(\)/.test(column.default_value ?? '')
      )
        refuse(`${table} timestamp default`);
      if (table === 'tickets' && name === 'number' && column.identity !== 'd')
        refuse('ticket identity');
    }
  }
  const constraints = await client.query(`
    SELECT t.relname AS table_name, c.conname AS name, c.contype AS kind,
      c.confdeltype AS on_delete, c.confupdtype AS on_update, rn.nspname AS referenced_schema,
      pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    LEFT JOIN pg_class r ON r.oid = c.confrelid
    LEFT JOIN pg_namespace rn ON rn.oid = r.relnamespace
    WHERE n.nspname = 'support'
  `);
  for (const table of tables) {
    const actual = constraints.rows.filter((row) => row.table_name === table);
    if (requiredConstraints[table].some((name) => !actual.some((row) => row.name === name)))
      refuse(`${table} constraints`);
    if (
      actual.some(
        (row) =>
          row.kind === 'f' &&
          (row.on_delete !== 'a' || row.on_update !== 'a' || row.referenced_schema !== 'support'),
      )
    )
      refuse(`${table} foreign keys`);
  }
  const indexed = await client.query(
    "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'support'",
  );
  for (const name of indexes) {
    const index = indexed.rows.find((row) => row.indexname === name);
    if (
      !index ||
      (name.startsWith('tickets_') && !/WHERE \(deleted_at IS NULL\)/.test(index.indexdef))
    )
      refuse(`${name} index`);
  }
}

function runPrisma(args, url) {
  const result = spawnSync(
    process.execPath,
    [join(root, 'node_modules/prisma/build/index.js'), ...args],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: url },
    },
  );
  if (result.error || result.status !== 0)
    throw new Error('Prisma migration command failed. See the CLI output above.');
}

async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol))
    throw new Error('DATABASE_URL must use PostgreSQL');
  url.searchParams.set('schema', 'support');
  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    // Serialize wrapper invocations; Prisma also takes its own migration lock.
    await client.query("SELECT pg_advisory_lock(hashtext('relay-prisma-migrations'))");
    const found = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'support' AND tablename <> '_prisma_migrations'",
    );
    const prior = await client.query("SELECT to_regclass('support._prisma_migrations') AS name");
    const prismaHistory = prior.rows[0].name
      ? (await client.query('SELECT migration_name FROM support._prisma_migrations')).rows
      : [];
    if (found.rows.length && !prismaHistory.length) {
      if (
        found.rows.length !== tables.length ||
        tables.some((name) => !found.rows.some((row) => row.tablename === name))
      )
        refuse('unexpected tables');
      await verifyLegacySchema(client);
      console.log(
        'Verified existing support schema; recording the Prisma baseline without rewriting tables.',
      );
      runPrisma(['migrate', 'resolve', '--applied', baseline], url.toString());
    }
    runPrisma(['migrate', 'deploy'], url.toString());
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Database migration failed');
  process.exitCode = 1;
});
