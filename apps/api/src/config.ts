export function validateEnvironment(env: Record<string, unknown>) {
  const secret = String(env.JWT_SECRET ?? '');
  if (secret.length < 32 || secret.startsWith('replace-')) throw new Error('JWT_SECRET must be a unique secret of at least 32 characters.');
  if (!String(env.DATABASE_URL ?? '').startsWith('postgresql://')) throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port.');
  const expiry = Number(env.JWT_EXPIRES_IN_SECONDS ?? 28800);
  if (!Number.isInteger(expiry) || expiry < 60 || expiry > 86400) throw new Error('JWT expiry must be between 60 and 86400 seconds.');
  const origin = String(env.WEB_ORIGIN ?? 'http://localhost:3000');
  if (!/^https?:\/\/[^/]+$/.test(origin)) throw new Error('WEB_ORIGIN must be a single HTTP(S) origin without a trailing slash.');
  return { ...env, PORT: port, JWT_EXPIRES_IN_SECONDS: expiry, WEB_ORIGIN: origin };
}
