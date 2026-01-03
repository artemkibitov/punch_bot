import { STATES } from '../../../domain/fsm/states.js';
import { registerInput } from './inputRouter.js';

registerInput(STATES.ENTER_MANAGER_PIN, async (ctx) => {
  const pin = ctx.message.text.trim();

  if (!isValidPin(pin)) {
    await ctx.reply('❌ Неверный PIN');
    return;
  }

  await ctx.state.dialog.setState(
    ctx.state.session,
    STATES.ONBOARDING_ENTER_NAME
  );

  await ctx.reply('Введите ваше имя и фамилию');
});
