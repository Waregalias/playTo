import { buildApp } from './app.js';
import { loadEnv } from './env.js';

const env = loadEnv();

const app = await buildApp(env);

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`API listening on :${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
