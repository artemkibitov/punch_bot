import { Telegraf } from 'telegraf';
import { env } from '../../infrastructure/config/env.js';
import { SessionRepository } from '../../infrastructure/repositories/sessionRepository.js';
import { DialogService } from '../../application/services/dialogService.js';
import { registerSessionMiddleware } from './middleware/session.js';
import { routeCallback } from './ui/router.js';

const sessionRepository = new SessionRepository();
const dialogService = new DialogService({ sessionRepository });

export const bot = new Telegraf(env.BOT_TOKEN);

bot.use(
  registerSessionMiddleware({
    dialogService
  })
);

// временно: базовый хэндлер
bot.on('text', async (ctx) => {
  const { session } = ctx.state;

  await ctx.reply(
    `Текущее состояние: ${session.state ?? 'IDLE'}`
  );
});

bot.on('callback_query', async (ctx) => {
  await routeCallback(ctx);
});