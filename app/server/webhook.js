import { env } from '../infrastructure/config/env.js';
import { bot } from '../transport/telegram/bot.js';

const WEBHOOK_PATH = `/webhook/${env.WEBHOOK_SECRET}`;

export async function registerWebhook(fastify) {
  fastify.post(WEBHOOK_PATH, async (request, reply) => {
    const secret = request.headers['x-telegram-bot-api-secret-token'];

    if (secret !== env.WEBHOOK_SECRET) {
      reply.code(401);
      return { error: 'unauthorized' };
    }

    await bot.handleUpdate(request.body);

    return { ok: true };
  });
}
