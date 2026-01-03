import { registerInput } from './inputRouter.js';
import { STATES } from '../../../domain/fsm/states.js';
import { pinKeyboard } from '../ui/pinKeyboard.js'; 

registerInput(STATES.ONBOARDING_START, async (ctx) => {
  const { dialog, session } = ctx.state;

  await dialog.setState(session, STATES.ENTER_MANAGER_PIN);
  await ctx.reply(
    'Введите PIN для регистрации менеджера',
    pinKeyboard()
  );
});
