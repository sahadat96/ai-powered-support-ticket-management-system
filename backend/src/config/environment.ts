export function validateEnvironment(env: Record<string, unknown>) {
  const mode = String(env.NODE_ENV ?? 'development');
  const database = String(env.DATABASE_URL ?? '');
  const secret = String(env.JWT_SECRET ?? '');
  const frontend = String(env.FRONTEND_URL ?? 'http://localhost:3000');
  const port = Number(env.PORT ?? 4000);
  if (!['development', 'test', 'production'].includes(mode)) throw new Error('Invalid NODE_ENV');
  if (!/^postgres(ql)?:\/\//.test(database)) throw new Error('DATABASE_URL must be a PostgreSQL URL');
  if (secret.length < 32 || secret.startsWith('replace-')) throw new Error('JWT_SECRET must contain at least 32 random characters');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  const origin = new URL(frontend);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== frontend) throw new Error('FRONTEND_URL must be an origin without a trailing slash');
  if (mode === 'production' && origin.protocol !== 'https:') throw new Error('Production FRONTEND_URL requires HTTPS');
  return {...env, NODE_ENV: mode, DATABASE_URL: database, JWT_SECRET: secret, FRONTEND_URL: frontend, PORT: port};
}
