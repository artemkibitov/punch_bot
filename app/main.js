// 1. Загрузка env (fail-fast)
import './infrastructure/config/env.js';

// 2. Поднимаем HTTP-сервер
import Fastify from 'fastify';
import { env } from './infrastructure/config/env.js';
import { registerWebhook } from './server/webhook.js';

// 3. DEV-only: регистрация Telegram webhook
import { registerTelegramWebhook } from './transport/telegram/registerWebhook.js';

// 4. (ВАЖНО) side-effect imports
// регистрируют handlers, input, callbacks и т.д.
import { bot } from './transport/telegram/bot.js';
// Регистрация FSM состояний
import './application/fsm/states/onboardingStart.js';
import './application/fsm/states/enterManagerPin.js';
import './application/fsm/states/onboardingEnterName.js';
import './application/fsm/states/managerMenu.js';
import './application/fsm/states/employeeMenu.js';
// Регистрация callbacks
import './transport/telegram/callbacks/pin.js';

async function bootstrap() {
  const fastify = Fastify({
    logger: env.NODE_ENV !== 'prod'
  });

  // healthcheck
  fastify.get('/health', async () => ({ status: 'ok' }));

  // webhook endpoint
  await registerWebhook(fastify);

  // запуск сервера
  const port = 3000;
  await fastify.listen({ port, host: '0.0.0.0' });

  console.log(`🚀 Server started on port ${port}`);

  // регистрация Telegram webhook (dev)
  await registerTelegramWebhook(bot);
}

bootstrap().catch(err => {
  console.error('❌ Bootstrap error:', err);
  process.exit(1);
});
