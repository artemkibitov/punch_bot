import { Telegraf } from 'telegraf';

export function createBot() {
  return new Telegraf(process.env.BOT_TOKEN);
}
