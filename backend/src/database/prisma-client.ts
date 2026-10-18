import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

export function prismaOptions(connectionString: string) {
  const url = new URL(connectionString);
  url.searchParams.set('schema', 'support');
  const adapter = new PrismaPg(
    { connectionString: url.toString(), connectionTimeoutMillis: 5000, max: 10 },
    { schema: 'support' },
  );
  return { adapter, errorFormat: 'minimal' as const };
}

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient(prismaOptions(connectionString));
}
