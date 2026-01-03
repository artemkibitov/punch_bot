const handlers = new Map();

export function registerAction(action, handler) {
  if (handlers.has(action)) {
    throw new Error(`Handler already registered: ${action}`);
  }

  handlers.set(action, handler);
}

export async function routeCallback(ctx) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const [action, payload] = data.split('|');

  const handler = handlers.get(action);

  if (!handler) {
    await ctx.answerCbQuery('Неизвестное действие');
    return;
  }

  await handler(ctx, payload);
}
