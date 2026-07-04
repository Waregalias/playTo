import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Auth } from '../auth.js';
import { AppError } from '../lib/app-error.js';

/** Rebuilds a Web API Request from a Fastify request for better-auth. */
function toWebRequest(request: FastifyRequest): Request {
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    headers.append(key, Array.isArray(value) ? value.join(', ') : value.toString());
  }
  return new Request(url.toString(), {
    method: request.method,
    headers,
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : JSON.stringify(request.body ?? {}),
  });
}

export function requestHeaders(request: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    headers.append(key, Array.isArray(value) ? value.join(', ') : value.toString());
  }
  return headers;
}

/** Mounts the better-auth handler on /api/auth/*. */
export function registerAuthRoutes(app: FastifyInstance, auth: Auth): void {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const response = await auth.handler(toWebRequest(request));
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      reply.send(response.body ? await response.text() : null);
    },
  });
}

export interface SessionUser {
  userId: string;
}

/** Resolves the authenticated user or throws 401 (API-SPEC §2). */
export async function requireUser(auth: Auth, request: FastifyRequest): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: requestHeaders(request) });
  if (!session) {
    throw new AppError('UNAUTHENTICATED', 401);
  }
  return { userId: session.user.id };
}
