import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { ERROR_MESSAGES_FR } from '@aldenfer/shared/content/fr';
import type { Env } from './env.js';
import { createDb, type Db } from './db/client.js';
import { AppError } from './lib/app-error.js';
import { createAuth, type Auth } from './auth.js';
import { registerAuthRoutes } from './plugins/auth.js';
import { registerCharacterRoutes } from './modules/characters/routes.js';
import { registerActionRoutes } from './modules/actions/routes.js';
import { registerMapRoutes } from './modules/map/routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    env: Env;
    auth: Auth;
  }
}

export interface BuildOptions {
  db?: Db;
  /** Injected clock — never `new Date()` inline in services (SPEC-M1). */
  now?: () => Date;
}

export async function buildApp(env: Env, options: BuildOptions = {}) {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const db = options.db ?? createDb(env.DATABASE_URL);
  const now = options.now ?? (() => new Date());
  const auth = createAuth(db, {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    webOrigins: env.WEB_ORIGIN,
  });

  app.decorate('env', env);
  app.decorate('db', db);
  app.decorate('auth', auth);

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });

  // Single error envelope (API-SPEC §2)
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: ERROR_MESSAGES_FR[error.code],
          ...(error.details ? { details: error.details } : {}),
        },
      });
    }
    const fastifyError = error as { code?: string; validation?: unknown };
    if (error instanceof ZodError || fastifyError.code === 'FST_ERR_VALIDATION') {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: ERROR_MESSAGES_FR.VALIDATION_ERROR,
          details: {
            issues: error instanceof ZodError ? error.issues : fastifyError.validation,
          },
        },
      });
    }
    app.log.error(error);
    return reply.status(500).send({
      error: { code: 'INTERNAL', message: 'Le bastion tremble — réessaie dans un instant.' },
    });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  registerAuthRoutes(app, auth);
  registerCharacterRoutes(app, auth, now);
  registerActionRoutes(app, auth, now);
  registerMapRoutes(app, auth, now);

  return app;
}
