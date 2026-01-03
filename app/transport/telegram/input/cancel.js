import { STATES } from '../../../domain/fsm/states.js';

export function isCancel(text) {
  return ['cancel', 'отмена', '/cancel'].includes(
    text.toLowerCase()
  );
}

export async function handleCancel(ctx) {
  const { dialog, session } = ctx.state;

  await dialog.clearState(session);

  await ctx.reply('Действие отменено');
}
