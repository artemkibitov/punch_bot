const handlers = new Map();

export function registerInput(state, handler) {
  if (handlers.has(state)) {
    throw new Error(`Input handler already registered: ${state}`);
  }

  handlers.set(state, handler);
}

export async function routeInput(ctx) {
  const session = ctx.state.session;
  if (!session?.state) return false;

  const handler = handlers.get(session.state);
  if (!handler) return false;

  await handler(ctx);
  return true;
}
