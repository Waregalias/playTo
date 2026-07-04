import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Db } from './db/client.js';
import * as schema from './db/schema.js';

export type Auth = ReturnType<typeof createAuth>;

export interface AuthConfig {
  secret: string;
  baseURL: string;
  webOrigins: string[];
}

export function createAuth(db: Db, config: AuthConfig) {
  return betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    basePath: '/api/auth',
    trustedOrigins: config.webOrigins,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: {
      enabled: true,
    },
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
      },
    },
  });
}
