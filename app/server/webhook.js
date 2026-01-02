export function registerWebhookRoute(app, bot) {
  app.post(process.env.WEBHOOK_PATH, async (req, reply) => {
    try {
      await bot.handleUpdate(req.body);
      reply.send({ ok: true });
    } catch (err) {
      req.log.error(err);
      reply.code(500).send({ ok: false });
    }
  });
}
