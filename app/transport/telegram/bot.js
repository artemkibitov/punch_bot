import { Telegraf } from 'telegraf';
import { env } from '../../infrastructure/config/env.js';
import { SessionRepository } from '../../infrastructure/repositories/sessionRepository.js';
import { DialogService } from '../../application/services/dialogService.js';
import { registerSessionMiddleware } from './middleware/session.js';
import { routeCallback } from './ui/router.js';
import { routeInput } from './input/inputRouter.js';
import { isCancel, handleCancel } from './input/cancel.js';
import { registerStartCommand } from './commands/start.js';

const sessionRepository = new SessionRepository();
const dialogService = new DialogService({ sessionRepository });

export const bot = new Telegraf(env.BOT_TOKEN);

registerStartCommand(bot);

bot.use(
  registerSessionMiddleware({
    dialogService
  })
);

bot.on('text', async (ctx) => {
  const text = ctx.message.text;

  if (isCancel(text)) {
    await handleCancel(ctx);
    return;
  }

  const handled = await routeInput(ctx);

  if (!handled) {
    await ctx.reply('Команда не распознана');
  }
});

bot.on('callback_query', async (ctx) => {
  await routeCallback(ctx);
});