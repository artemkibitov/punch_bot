import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../router.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { AuditLogRepository } from '../../../infrastructure/repositories/auditLogRepository.js';
import { MessageService } from '../../services/messageService.js';

const objectRepo = new ObjectRepository();
const employeeRepo = new EmployeeRepository();
const auditRepo = new AuditLogRepository();

function validateSchedule(text) {
  // Формат: "HH:MM HH:MM minutes" или "HH:MM HH:MM minutes timezone"
  // Пример: "08:00 18:00 30" или "08:00 18:00 30 Europe/Moscow"
  const parts = text.trim().split(/\s+/);
  
  if (parts.length < 3) {
    return 'Формат: время_начала время_окончания минуты_обеда [timezone]\nПример: 08:00 18:00 30';
  }

  const [startTime, endTime, lunchMinutes, timezone] = parts;

  // Валидация времени
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(startTime)) {
    return 'Неверный формат времени начала. Используйте HH:MM (например, 08:00)';
  }
  if (!timeRegex.test(endTime)) {
    return 'Неверный формат времени окончания. Используйте HH:MM (например, 18:00)';
  }

  // Валидация минут обеда
  const lunch = parseInt(lunchMinutes, 10);
  if (isNaN(lunch) || lunch < 0 || lunch > 480) {
    return 'Минуты обеда должны быть числом от 0 до 480';
  }

  // Валидация timezone (если указан)
  if (timezone && !timezone.match(/^[A-Za-z_]+\/[A-Za-z_]+$/)) {
    return 'Неверный формат timezone. Используйте IANA формат (например, Europe/Moscow)';
  }

  return null;
}

registerState(STATES.OBJECT_CREATE_ENTER_SCHEDULE, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    await MessageService.sendOrEdit(
      ctx,
      'Введите график объекта:\n\n' +
      'Формат: время_начала время_окончания минуты_обеда [timezone]\n' +
      'Пример: 08:00 18:00 30\n' +
      'Пример с timezone: 08:00 18:00 30 Europe/Moscow\n\n' +
      'По умолчанию timezone: UTC',
      {},
      session
    );
  },

  async onInput(ctx) {
    const text = ctx.message.text;
    const error = validateSchedule(text);

    if (error) {
      const { session } = ctx.state;
      await MessageService.sendOrEdit(ctx, error, {}, session);
      return;
    }

    const parts = text.trim().split(/\s+/);
    const [startTime, endTime, lunchMinutes, timezone = 'UTC'] = parts;

    const { dialog, session } = ctx.state;
    const objectName = session.data?.objectName;


    if (!objectName) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: название объекта не найдено', {}, session);
      return;
    }

    // Получаем manager
    const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
    if (!manager) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: менеджер не найден', {}, session);
      return;
    }

    try {
      // Создаём объект
      const object = await objectRepo.create({
        managerId: manager.id,
        name: objectName,
        timezone,
        plannedStart: startTime,
        plannedEnd: endTime,
        lunchMinutes: parseInt(lunchMinutes, 10)
      });

      // Логируем в audit
      await auditRepo.log({
        entityType: 'work_objects',
        entityId: object.id,
        action: 'create',
        changedBy: manager.id,
        metadata: { name: objectName, timezone, startTime, endTime, lunchMinutes }
      });

      // Очищаем data и возвращаемся в меню объектов
      await dialog.clearState(session);
      const updatedSession = await dialog.setState(session, STATES.MANAGER_OBJECTS_LIST);
      ctx.state.session = updatedSession;

      await MessageService.sendOrEdit(ctx, `✅ Объект "${objectName}" успешно создан!`, {}, updatedSession);
      await runState(ctx, 'enter');
    } catch (error) {
      console.error('Error creating object:', error);
      const { session } = ctx.state;
      await MessageService.sendOrEdit(ctx, 'Ошибка при создании объекта. Попробуйте позже.', {}, session);
    }
  }
});

