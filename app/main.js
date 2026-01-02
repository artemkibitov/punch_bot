import { createServer } from './server/fastify.js';
import { createBot } from './server/telegraf.js';
import { registerWebhookRoute } from './server/webhook.js';
import { registerTelegramWebhook } from './server/webhook-register.js';

const app = await createServer();
const bot = createBot();

registerWebhookRoute(app, bot);

await registerTelegramWebhook(bot);

await app.listen({ port: 3000, host: '0.0.0.0' });
