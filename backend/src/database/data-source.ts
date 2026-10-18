import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'node:path';

config({ path: ['.env', '../.env'], quiet: true });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '../modules/**/*.orm-entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  migrationsTableName: 'support_migrations',
  installExtensions: false,
  synchronize: false,
  logging: false,
});
