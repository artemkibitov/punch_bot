import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { ROLES } from '../../../domain/constants/roles.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { managerMenu } from '../../../transport/telegram/ui/menus.js';
import { runState } from '../router.js';
import { MessageService } from '../../services/messageService.js';

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
    const { session } = ctx.state;
    const role = session.data?.role;

    if (role === ROLES.ADMIN) {
      await MessageService.sendOrEdit(ctx, 'Введите ваше имя и фамилию для регистрации администратора:', {}, session);
    } else {
      await MessageService.sendOrEdit(ctx, 'Введите ваше имя и фамилию:', {}, session);
    }
  },

  async onInput(ctx) {
    const text = ctx.message.text;
    const { dialog, session } = ctx.state;

    const error = runValidators(text, [
      requiredText,
      maxLength(100)
    ]);

    if (error) {
      await MessageService.sendOrEdit(ctx, error, {}, session);
      return;
    }

    const telegramUserId = ctx.from.id;
    const fullName = text.trim();
    const role = session.data?.role || ROLES.MANAGER;

    let createdEmployee;
    let nextState;

    if (role === ROLES.ADMIN) {
      // Создаём администратора
      createdEmployee = await employeeRepository.createAdmin({
        telegramUserId,
        fullName
      });
      nextState = STATES.ADMIN_MENU;
    } else {
      // Создаём менеджера
      createdEmployee = await employeeRepository.createManager({
        telegramUserId,
        fullName
      });
      nextState = STATES.MANAGER_MENU;
    }

    await dialog.clearState(session);
    const updatedSession = await dialog.setState(session, nextState);
    ctx.state.session = updatedSession;

    if (role === ROLES.ADMIN) {
      await MessageService.sendOrEdit(ctx, `✅ Администратор "${fullName}" создан`, {}, updatedSession);
      await runState(ctx, 'enter');
    } else {
      await MessageService.sendOrEdit(ctx, `✅ Менеджер "${fullName}" создан`, managerMenu(), updatedSession);
    }
  }
});

