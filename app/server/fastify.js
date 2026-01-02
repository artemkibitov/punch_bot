import Fastify from 'fastify';

export async function createServer() {
  const app = await Fastify({
    logger: process.env.NODE_ENV === 'dev',
  });

  // 🔥 ВАЖНО: убираем ngrok warning
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('ngrok-skip-browser-warning', 'true');
    return payload;
  });

  return app;
}
