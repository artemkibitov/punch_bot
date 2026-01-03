import { STATES } from '../../../domain/fsm/states.js';
import { registerInput } from './inputRouter.js';
import { runValidators, requiredText, maxLength } from './validators.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { managerMenu } from '../ui/menus.js';

const employeeRepository = new EmployeeRepository();

registerInput(
  STATES.ONBOARDING_ENTER_NAME,
  async (ctx) => {
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
);
