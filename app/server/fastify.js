import Fastify from 'fastify';
import { env } from '../infrastructure/config/env.js';
import { registerWebhook } from './webhook.js';
import { registerTelegramWebhook } from '../transport/telegram/registerWebhook.js';


const fastify = Fastify({
  logger: env.NODE_ENV == 'dev'
});

fastify.get('/health', async () => {
  return { status: 'ok' };
});

await registerWebhook(fastify);
await registerTelegramWebhook();

const port = env.NODE_ENV === 'prod' ? 3000 : 3000;

try {
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`Server started on port ${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
