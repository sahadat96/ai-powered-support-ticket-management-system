import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: ['.env', '../.env'], quiet: true });
const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : undefined;
// Keep this project's migration history separate from the older public schema.
databaseUrl?.searchParams.set('schema', 'support');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'ts-node src/database/seed.ts' },
  datasource: { url: databaseUrl?.toString() },
});
