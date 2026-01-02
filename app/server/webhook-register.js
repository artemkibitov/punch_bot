export async function registerTelegramWebhook(bot) {
  const path = process.env.WEBHOOK_PATH;

  const baseUrl =
    process.env.NODE_ENV === 'dev'
      ? process.env.NGROK_PUBLIC_URL
      : process.env.PUBLIC_BASE_URL;

  if (!baseUrl) {
    throw new Error('WEBHOOK BASE URL NOT SET');
  }

  const url = `${baseUrl}${path}`;

  await bot.telegram.setWebhook(url, {
    drop_pending_updates: true,
  });

  console.log('✅ Webhook registered:', url);
}
