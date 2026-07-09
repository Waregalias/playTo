import { buildApp } from './app.js';
import { loadEnv } from './env.js';
import { startResolver } from './worker/resolver.js';

const env = loadEnv();

const app = await buildApp(env);

const stopResolver = startResolver(
  app.db,
  () => new Date(),
  (err) => app.log.error(err),
);
app.addHook('onClose', async () => stopResolver());

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`API listening on :${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
