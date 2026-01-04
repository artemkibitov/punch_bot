import { getStateHandlers } from './registry.js';

/**
 * Выполняет обработчик состояния (onEnter или onInput)
 * @param {Object} ctx - Контекст Telegraf
 * @param {'enter' | 'input'} type - Тип обработки
 */
export async function runState(ctx, type) {
  const session = ctx.state.session;
  if (!session?.state) {
    console.log(`⚠️ runState(${type}): no session or state`);
    return false;
  }

  console.log(`🔄 runState(${type}): state=${session.state}`);

  const handlers = getStateHandlers(session.state);
  if (!handlers) {
    console.error(`❌ runState(${type}): no handlers for state ${session.state}`);
    return false;
  }

  const handler = type === 'enter' ? handlers.onEnter : handlers.onInput;
  if (!handler) {
    console.log(`⚠️ runState(${type}): no ${type} handler for state ${session.state}`);
    return false;
  }

  try {
    await handler(ctx);
    return true;
  } catch (error) {
    console.error(`❌ Error in runState(${type}) handler for ${session.state}:`, error);
    throw error;
  }
}

