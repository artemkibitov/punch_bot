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
import './application/fsm/states/adminMenu.js';
import './application/fsm/states/adminObjectsList.js';
import './application/fsm/states/adminObjectDetails.js';
import './application/fsm/states/adminEmployeesList.js';
import './application/fsm/states/managerObjectsList.js';
import './application/fsm/states/objectCreateEnterName.js';
import './application/fsm/states/objectCreateEnterSchedule.js';
import './application/fsm/states/objectDetails.js';
import './application/fsm/states/objectEdit.js';
import './application/fsm/states/objectEditSchedule.js';
import './application/fsm/states/objectEditStatus.js';
import './application/fsm/states/objectEmployeesList.js';
import './application/fsm/states/employeeCreateEnterName.js';
import './application/fsm/states/employeeRefLinkActivate.js';
// Регистрация callbacks
import './transport/telegram/callbacks/pin.js';
import './transport/telegram/callbacks/manager.js';
import './transport/telegram/callbacks/admin.js';

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
