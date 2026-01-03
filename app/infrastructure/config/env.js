import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const required = [
  'DATABASE_URL',
  'BOT_TOKEN',
  'WEBHOOK_SECRET'
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env variable: ${key}`);
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  BOT_TOKEN: process.env.BOT_TOKEN,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
  NGROK_PUBLIC_URL: process.env.NGROK_PUBLIC_URL
}
