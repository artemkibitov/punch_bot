import { STATES } from '../../../domain/fsm/states.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { managerMenu } from '../ui/menus.js';
import { pinKeyboard } from '../ui/pinKeyboard.js';

const employeeRepository = new EmployeeRepository();

export function registerStartCommand(bot) {
  bot.start(async (ctx) => {
    const telegramUserId = ctx.from.id;
    const { dialog, session } = ctx.state;

    const employee =
      await employeeRepository.findByTelegramUserId(telegramUserId);

    if (!employee) {
      // await dialog.setState(session, STATES.ENTER_MANAGER_PIN);
      // await ctx.reply(
      //   'Введите PIN для регистрации менеджера',
      //   pinKeyboard()
      // ;)

      await dialog.setState(session, STATES.ONBOARDING_ENTER_NAME);
      await ctx.reply('Введите ваше имя и фамилию');
      return;
    }

    if (employee.role === 'MANAGER') {
      await dialog.setState(session, STATES.MANAGER_MENU);
      await ctx.reply('Меню менеджера', managerMenu());
      return;
    }

    await ctx.reply('Добро пожаловать');
  });
}
