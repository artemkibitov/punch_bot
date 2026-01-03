import { registerAction } from '../ui/router.js';
import { STATES } from '../../../domain/fsm/states.js';
import { ManagerPinRepository } from '../../../infrastructure/repositories/managerPinRepository.js';
import { pinKeyboard } from '../ui/pinKeyboard.js';

const pinRepo = new ManagerPinRepository();

registerAction('pin:add', async (ctx, digit) => {
  const { dialog, session } = ctx.state;

  const current = session.data?.pin ?? '';
  if (current.length >= 4) return;

  const next = current + digit;

  await dialog.mergeData(session, { pin: next });

  if (next.length === 4) {
    const valid = await pinRepo.validate(next);

    if (!valid) {
      await dialog.mergeData(session, { pin: '' });
      await ctx.editMessageText(
        '❌ Неверный PIN. Попробуйте снова',
        pinKeyboard('')
      );
      return;
    }

    await dialog.clearState(session);
    await dialog.setState(session, STATES.ONBOARDING_ENTER_NAME);
    await ctx.editMessageText('Введите имя и фамилию');
    return;
  }

  await ctx.editMessageText(
    `Введите PIN: ${'*'.repeat(next.length)}`,
    pinKeyboard(next)
  );
});

registerAction('pin:del', async (ctx) => {
  const { dialog, session } = ctx.state;

  const current = session.data?.pin ?? '';
  const next = current.slice(0, -1);

  await dialog.mergeData(session, { pin: next });

  await ctx.editMessageText(
    `Введите PIN: ${'*'.repeat(next.length)}`,
    pinKeyboard(next)
  );
});

registerAction('pin:cancel', async (ctx) => {
  const { dialog, session } = ctx.state;

  await dialog.clearState(session);
  await ctx.editMessageText('Регистрация отменена');
});
