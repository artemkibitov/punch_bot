import { Telegraf } from 'telegraf';
import { env } from '../../infrastructure/config/env.js';
import { SessionRepository } from '../../infrastructure/repositories/sessionRepository.js';
import { DialogService } from '../../application/services/dialogService.js';
import { registerSessionMiddleware } from './middleware/session.js';
import { routeCallback } from './ui/router.js';
import { runState } from '../../application/fsm/router.js';
import { STATES } from '../../domain/fsm/states.js';
import { resolveStartFlow } from '../../application/start/resolveStartFlow.js';
import { isCancel, handleCancel } from './input/cancel.js';

const sessionRepository = new SessionRepository();
const dialogService = new DialogService({ sessionRepository });

export const bot = new Telegraf(env.BOT_TOKEN);

bot.use(
  registerSessionMiddleware({
    dialogService
  })
);

bot.start(async (ctx) => {
  try {
    const { dialog, session } = ctx.state;

    if (!session) {
      console.error('❌ No session in ctx.state');
      await ctx.reply('Ошибка: сессия не найдена');
      return;
    }

    const nextState = await resolveStartFlow(ctx);
    console.log(`📌 /start: resolved to state ${nextState}`);
    
    const updatedSession = await dialog.setState(session, nextState, { force: true });
    
    // Обновляем session в ctx.state после setState
    ctx.state.session = updatedSession;

    // Вызываем onEnter для нового состояния
    const handled = await runState(ctx, 'enter');
    
    if (!handled) {
      console.error(`❌ No handler for state ${nextState}`);
      await ctx.reply('Ошибка: обработчик состояния не найден');
    }
  } catch (error) {
    console.error('❌ Error in /start handler:', error);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
});

bot.on('text', async (ctx) => {
  // Проверяем на cancel
  if (isCancel(ctx.message.text)) {
    await handleCancel(ctx);
    return;
  }

  // Обрабатываем ввод через FSM
  const handled = await runState(ctx, 'input');
  if (!handled) {
    await ctx.reply('Я вас не понял');
  }
});

bot.on('callback_query', async (ctx) => {
  await routeCallback(ctx);
});