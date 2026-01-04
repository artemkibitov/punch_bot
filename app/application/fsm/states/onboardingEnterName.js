import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { managerMenu } from '../../../transport/telegram/ui/menus.js';

const employeeRepository = new EmployeeRepository();

function requiredText(text) {
  if (!text || !text.trim()) {
    return 'Введите непустой текст';
  }
}

function maxLength(max) {
  return (text) => {
    if (text.length > max) {
      return `Максимум ${max} символов`;
    }
  };
}

function runValidators(text, validators = []) {
  for (const v of validators) {
    const error = v(text);
    if (error) return error;
  }
}

registerState(STATES.ONBOARDING_ENTER_NAME, {
  async onEnter(ctx) {
    await ctx.reply('Введите ваше имя и фамилию');
  },

  async onInput(ctx) {
    const text = ctx.message.text;

    const error = runValidators(text, [
      requiredText,
      maxLength(100)
    ]);

    if (error) {
      await ctx.reply(error);
      return;
    }

    const telegramUserId = ctx.from.id;
    const fullName = text.trim();

    await employeeRepository.createManager({
      telegramUserId,
      fullName
    });

    const { dialog, session } = ctx.state;

    await dialog.clearState(session);
    await dialog.setState(session, STATES.MANAGER_MENU);

    await ctx.reply(
      `Менеджер "${fullName}" создан`,
      managerMenu()
    );
  }
});

