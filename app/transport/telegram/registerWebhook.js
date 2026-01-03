import { env } from '../../infrastructure/config/env.js';

export async function registerTelegramWebhook(bot) {
  if (env.NODE_ENV !== 'dev') return;

  if (!env.NGROK_PUBLIC_URL) {
    throw new Error('NGROK_PUBLIC_URL is required in dev');
  }

  const url = `${env.NGROK_PUBLIC_URL}/webhook/${env.WEBHOOK_SECRET}`;

  await bot.telegram.setWebhook(url, {
    secret_token: env.WEBHOOK_SECRET
  });

  console.log('Telegram webhook registered:', url);
}
