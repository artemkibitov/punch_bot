import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../router.js';
import { MessageService } from '../../services/messageService.js';
import { container } from '../../../infrastructure/di/container.js';

registerState(STATES.EMPLOYEE_REF_LINK_ACTIVATE, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const refCode = session.data?.refCode;

    if (!refCode) {
      await MessageService.sendOrEdit(
        ctx,
        '❌ Ошибка: реферальный код не найден. Проверьте ссылку.',
        {},
        session
      );
      return;
    }

    const telegramUserId = ctx.from.id;

    try {
      // Используем use case для привязки Telegram
      const linkTelegramUseCase = await container.getAsync('LinkTelegramUseCase');
      const updatedEmployee = await linkTelegramUseCase.execute(refCode, telegramUserId);

      // Переходим в меню сотрудника
      const { dialog } = ctx.state;
      await dialog.clearState(session);
      const updatedSession = await dialog.setState(session, STATES.EMPLOYEE_MENU);
      ctx.state.session = updatedSession;

      await MessageService.sendOrEdit(
        ctx,
        `✅ Аккаунт успешно активирован!\n\n` +
        `Добро пожаловать, ${updatedEmployee.full_name}!`,
        {},
        updatedSession
      );
      await runState(ctx, 'enter');
    } catch (error) {
      console.error('Error linking Telegram:', error);
      const { session } = ctx.state;
      await MessageService.sendOrEdit(
        ctx,
        '❌ Ошибка при активации аккаунта. Попробуйте позже.',
        {},
        session
      );
    }
  }
});

