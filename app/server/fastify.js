import Fastify from 'fastify';

export async function createServer() {
  const app = await Fastify({
    logger: process.env.NODE_ENV === 'dev',
  });

  return app;
}
