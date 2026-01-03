import { STATES } from '../../../domain/fsm/states.js';
import { resolveStartFlow } from '../../../application/start/resolveStartFlow.js';

export async function startCommand(ctx) {
  const { dialog, session } = ctx.state;

  const nextState = await resolveStartFlow(ctx);

  await dialog.reset(session);
  await dialog.setState(session, nextState, { force: true });

  // Добавляем логику ответов в зависимости от того, куда нас направил resolveStartFlow
  switch (nextState) {
    case STATES.ONBOARDING_START:
      // Переводим сразу на ввод пина, чтобы диалог начался
      await dialog.setState(session, STATES.ENTER_MANAGER_PIN); 
      return await ctx.reply('Добро пожаловать! Введите секретный PIN для регистрации менеджера:');

    case STATES.MANAGER_MENU:
      return await ctx.reply('Главное меню менеджера:', managerMenu());

    case STATES.EMPLOYEE_MENU:
      return await ctx.reply('Главное меню сотрудника:', employeeMenu());

    default:
      return await ctx.reply('Система инициализирована. Напишите что-нибудь.');
  }
}

