export function registerSessionMiddleware({ dialogService }) {
  return async (ctx, next) => {
    if (!ctx.from?.id) {
      return next();
    }

    const telegramUserId = ctx.from.id;

    const session =
      await dialogService.loadOrCreateSession(telegramUserId);

    ctx.state.session = session;
    ctx.state.dialog = dialogService;

    await next();
  };
}
