import { Telegraf } from 'telegraf';
import { env } from '../../infrastructure/config/env.js';
import { SessionRepository } from '../../infrastructure/repositories/sessionRepository.js';
import { DialogService } from '../../application/services/dialogService.js';
import { registerSessionMiddleware } from './middleware/session.js';
import { routeCallback } from './ui/router.js';
import { routeInput } from './input/inputRouter.js';
import { isCancel, handleCancel } from './input/cancel.js';
import { startCommand } from './commands/start.js';

const sessionRepository = new SessionRepository();
const dialogService = new DialogService({ sessionRepository });

export const bot = new Telegraf(env.BOT_TOKEN);

bot.use(
  registerSessionMiddleware({
    dialogService
  })
);


bot.command('start', startCommand);
bot.on('callback_query', routeCallback);

bot.on('text', async (ctx) => {
  const handled = await routeInput(ctx);
  if (!handled) {
    await ctx.reply('Я вас не понял');
  }
});