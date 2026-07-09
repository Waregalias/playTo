import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  contributeSchema,
  contributeResponseSchema,
  projectSchema,
  projectDetailSchema,
} from '@aldenfer/shared';
import type { Auth } from '../../auth.js';
import { requireCharacter } from '../../lib/require-character.js';
import { SlidingWindowRateLimiter } from '../../realtime/rate-limit.js';
import { listProjects, getProjectDetail, contribute } from './service.js';

export function registerProjectRoutes(app: FastifyInstance, auth: Auth, now: () => Date): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  // Leading-edge throttle: at most one project.progress per project per 10 s.
  const progressThrottle = new SlidingWindowRateLimiter(1, 10_000);

  typed.get(
    '/api/v1/projects',
    {
      schema: {
        querystring: z.object({ regionId: z.coerce.number().int().optional() }),
        response: { 200: z.object({ items: z.array(projectSchema) }) },
      },
    },
    async (request) => {
      await requireCharacter(app.db, auth, request);
      return listProjects(app.db, request.query.regionId);
    },
  );

  typed.get(
    '/api/v1/projects/:id',
    { schema: { params: z.object({ id: z.string() }), response: { 200: projectDetailSchema } } },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      return getProjectDetail(app.db, request.params.id, character.id);
    },
  );

  typed.post(
    '/api/v1/projects/:id/contribute',
    {
      schema: {
        params: z.object({ id: z.string() }),
        body: contributeSchema,
        response: { 200: contributeResponseSchema },
      },
    },
    async (request) => {
      const character = await requireCharacter(app.db, auth, request);
      const out = await contribute(app.db, character, request.params.id, request.body, now());

      if (out.credited) {
        const at = now().toISOString();
        if (out.completed || progressThrottle.tryConsume(request.params.id, now().getTime())) {
          app.realtime.publish(
            `region:${out.regionId}`,
            'project.progress',
            {
              projectId: request.params.id,
              progress: out.detail.progress,
              goals: out.detail.goals,
            },
            at,
          );
        }
        if (out.completed) {
          app.realtime.publish(
            'global',
            'announce',
            { kind: 'project.completed', projectId: request.params.id },
            at,
          );
        }
      }

      return { project: out.detail, character: out.character };
    },
  );
}
