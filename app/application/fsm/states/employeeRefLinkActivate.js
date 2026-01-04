import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../router.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { AuditLogRepository } from '../../../infrastructure/repositories/auditLogRepository.js';
import { MessageService } from '../../services/messageService.js';

const employeeRepo = new EmployeeRepository();
const auditRepo = new AuditLogRepository();

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

    // Находим сотрудника по ref_code
    const employee = await employeeRepo.findByRefCode(refCode);

    if (!employee) {
      await MessageService.sendOrEdit(
        ctx,
        '❌ Реферальная ссылка недействительна или истек срок действия.',
        {},
        session
      );
      return;
    }

    // Проверяем, не привязан ли уже Telegram
    if (employee.telegram_user_id) {
      await MessageService.sendOrEdit(
        ctx,
        '❌ Этот аккаунт уже привязан к другому Telegram аккаунту.',
        {},
        session
      );
      return;
    }

    const telegramUserId = ctx.from.id;

    try {
      // Привязываем Telegram
      const updatedEmployee = await employeeRepo.linkTelegram(employee.id, telegramUserId);

      // Логируем в audit
      await auditRepo.log({
        entityType: 'employees',
        entityId: employee.id,
        action: 'update',
        changedBy: employee.id,
        metadata: { field: 'telegram_user_id', telegramUserId, refCode }
      });

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

