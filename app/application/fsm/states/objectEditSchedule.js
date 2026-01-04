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

registerState(STATES.OBJECT_EDIT_SCHEDULE, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const objectId = session.data?.currentObjectId;

    if (!objectId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект не выбран', {}, session);
      return;
    }

    // Получаем manager
    const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
    if (!manager) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: менеджер не найден', {}, session);
      return;
    }

    // Получаем объект
    const object = await objectRepo.findById(objectId, { 
      managerId: manager.id, 
      isAdmin: manager.role === 'ADMIN' 
    });

    if (!object) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект не найден или нет доступа', {}, session);
      return;
    }

    await MessageService.sendOrEdit(
      ctx,
      `📅 Изменение графика объекта "${object.name}"\n\n` +
      `Текущий график:\n` +
      `⏰ ${object.planned_start} - ${object.planned_end}\n` +
      `🍽 Обед: ${object.lunch_minutes} мин\n` +
      `📍 Timezone: ${object.timezone || 'UTC'}\n\n` +
      `Введите новый график:\n\n` +
      `Формат: время_начала время_окончания минуты_обеда [timezone]\n` +
      `Пример: 08:00 18:00 30\n` +
      `Пример с timezone: 08:00 18:00 30 Europe/Moscow`,
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
    const objectId = session.data?.currentObjectId;

    if (!objectId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект не выбран', {}, session);
      return;
    }

    // Получаем manager
    const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
    if (!manager) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: менеджер не найден', {}, session);
      return;
    }

    try {
      // Обновляем график объекта
      const updatedObject = await objectRepo.update(
        objectId,
        {
          plannedStart: startTime,
          plannedEnd: endTime,
          lunchMinutes: parseInt(lunchMinutes, 10),
          timezone
        },
        {
          managerId: manager.id,
          isAdmin: manager.role === 'ADMIN'
        }
      );

      // Логируем в audit
      await auditRepo.log({
        entityType: 'work_objects',
        entityId: objectId,
        action: 'update',
        changedBy: manager.id,
        metadata: { timezone, startTime, endTime, lunchMinutes, field: 'schedule' }
      });

      // Возвращаемся к деталям объекта
      const updatedSession = await dialog.setState(session, STATES.OBJECT_DETAILS);
      ctx.state.session = updatedSession;

      await MessageService.sendOrEdit(
        ctx,
        `✅ График объекта успешно обновлен!\n\n` +
        `Новый график:\n` +
        `⏰ ${updatedObject.planned_start} - ${updatedObject.planned_end}\n` +
        `🍽 Обед: ${updatedObject.lunch_minutes} мин\n` +
        `📍 Timezone: ${updatedObject.timezone}`,
        {},
        updatedSession
      );

      await runState(ctx, 'enter');
    } catch (error) {
      console.error('Error updating object schedule:', error);
      const { session } = ctx.state;
      await MessageService.sendOrEdit(ctx, 'Ошибка при обновлении графика. Попробуйте позже.', {}, session);
    }
  }
});

