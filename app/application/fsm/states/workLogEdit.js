import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { WorkLogRepository } from '../../../infrastructure/repositories/workLogRepository.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';
import { formatTime, formatDate } from '../../services/shiftTimeService.js';

const workLogRepo = new WorkLogRepository();
const employeeRepo = new EmployeeRepository();
const objectRepo = new ObjectRepository();

function formatWorkLogDetails(workLog) {
  let text = `📝 Корректировка времени работы\n\n`;
  text += `👤 Сотрудник: ${workLog.full_name || 'Неизвестно'}\n`;
  text += `🏗 Объект: ${workLog.object_name || 'Неизвестно'}\n`;
  text += `📅 Дата: ${formatDate(workLog.date)}\n\n`;
  
  if (workLog.actual_start) {
    text += `⏰ Текущее время начала: ${formatTime(workLog.actual_start)}\n`;
  }
  if (workLog.actual_end) {
    text += `⏰ Текущее время окончания: ${formatTime(workLog.actual_end)}\n`;
  }
  
  text += `\n✏️ Введите новое время в формате:\n`;
  text += `HH:MM HH:MM [минуты_обеда]\n\n`;
  text += `Примеры:\n`;
  text += `• 08:00 18:00 30 - начало 08:00, окончание 18:00, обед 30 мин\n`;
  text += `• 09:15 17:45 - начало 09:15, окончание 17:45, обед 0 мин\n`;
  text += `• 16:00 01:30 15 - смена с переходом на следующий день\n\n`;
  text += `Или отправьте "отмена" для отмены.`;

  return text;
}

function validateTimeInput(text) {
  const parts = text.trim().split(/\s+/);
  
  if (parts.length < 2 || parts.length > 3) {
    return 'Неверный формат. Используйте: HH:MM HH:MM [минуты_обеда]';
  }

  const [startTime, endTime, lunchMinutes = '0'] = parts;

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

  return null;
}

registerState(STATES.WORK_LOG_EDIT, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const workLogId = session.data?.currentWorkLogId;

    if (!workLogId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: запись о работе не выбрана', {}, session);
      return;
    }

    try {
      // Получаем текущего пользователя
      const currentUser = await employeeRepo.findByTelegramUserId(ctx.from.id);
      if (!currentUser) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: пользователь не найден', {}, session);
        return;
      }

      // Получаем work_log
      const workLog = await workLogRepo.findById(workLogId);
      if (!workLog) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: запись о работе не найдена', {}, session);
        return;
      }

      // Проверяем права доступа (только менеджер объекта или админ)
      const object = await objectRepo.findById(workLog.work_object_id, {
        managerId: currentUser.id,
        isAdmin: currentUser.role === 'ADMIN'
      });
      if (!object && currentUser.role !== 'ADMIN') {
        await MessageService.sendOrEdit(ctx, 'Ошибка: нет доступа к этой записи', {}, session);
        return;
      }

      await MessageService.sendOrEdit(
        ctx,
        formatWorkLogDetails(workLog),
        keyboard([[
          { text: '❌ Отмена', cb: `worklog:details|${workLogId}` }
        ]]),
        session
      );
    } catch (error) {
      console.error('Error in work log edit:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке записи. Попробуйте позже.', {}, session);
    }
  },

  async onInput(ctx) {
    const { session } = ctx.state;
    const { runState } = await import('../router.js');
    const { WorkLogRepository } = await import('../../../infrastructure/repositories/workLogRepository.js');
    const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
    const { ObjectRepository } = await import('../../../infrastructure/repositories/objectRepository.js');
    const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');
    const { STATES } = await import('../../../domain/fsm/states.js');
    const { dialog } = ctx.state;

    const workLogRepo = new WorkLogRepository();
    const employeeRepo = new EmployeeRepository();
    const objectRepo = new ObjectRepository();
    const auditRepo = new AuditLogRepository();

    const text = ctx.message?.text?.trim();

    if (!text) {
      await MessageService.sendOrEdit(ctx, 'Пожалуйста, введите время в правильном формате.', {}, session);
      return;
    }

    // Проверка на отмену
    if (text.toLowerCase() === 'отмена' || text.toLowerCase() === 'cancel') {
      const workLogId = session.data?.currentWorkLogId;
      const updatedSession = await dialog.mergeData(session, {});
      ctx.state.session = updatedSession;

      const finalSession = await dialog.setState(updatedSession, STATES.WORK_LOG_DETAILS);
      ctx.state.session = finalSession;

      await runState(ctx, 'enter');
      return;
    }

    // Валидация формата
    const validationError = validateTimeInput(text);
    if (validationError) {
      await MessageService.sendOrEdit(ctx, validationError, {}, session);
      return;
    }

    try {
      // Получаем текущего пользователя
      const currentUser = await employeeRepo.findByTelegramUserId(ctx.from.id);
      if (!currentUser) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: пользователь не найден', {}, session);
        return;
      }

      const workLogId = session.data?.currentWorkLogId;
      const workLog = await workLogRepo.findById(workLogId);
      if (!workLog) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: запись о работе не найдена', {}, session);
        return;
      }

      // Парсим введенное время
      const parts = text.trim().split(/\s+/);
      const [startTime, endTime, lunchMinutes = '0'] = parts;

      // Создаем timestamp из даты и времени
      const date = new Date(workLog.date).toISOString().split('T')[0];
      const actualStart = new Date(`${date}T${startTime}:00`);
      let actualEnd = new Date(`${date}T${endTime}:00`);

      // Если endTime меньше startTime, значит смена переходит на следующий день
      if (actualEnd <= actualStart) {
        actualEnd.setDate(actualEnd.getDate() + 1);
      }

      // Обновляем существующую запись
      await workLogRepo.update(workLogId, {
        actual_start: actualStart.toISOString(),
        actual_end: actualEnd.toISOString(),
        lunch_minutes: parseInt(lunchMinutes, 10)
      });

      // Логируем в audit
      await auditRepo.log({
        entityType: 'work_logs',
        entityId: workLogId,
        action: 'update',
        changedBy: currentUser.id,
        metadata: {
          type: 'manual_edit',
          employeeId: workLog.employee_id,
          actualStart: actualStart.toISOString(),
          actualEnd: actualEnd.toISOString(),
          lunchMinutes: parseInt(lunchMinutes, 10)
        }
      });

      // Возвращаемся к деталям work_log
      const updatedSession = await dialog.mergeData(session, { currentWorkLogId: workLogId });
      ctx.state.session = updatedSession;

      const finalSession = await dialog.setState(updatedSession, STATES.WORK_LOG_DETAILS);
      ctx.state.session = finalSession;

      await MessageService.sendOrEdit(
        ctx,
        '✅ Время работы скорректировано',
        {},
        session
      );

      await runState(ctx, 'enter');
    } catch (error) {
      console.error('Error updating work log:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при сохранении корректировки. Попробуйте позже.', {}, session);
    }
  }
});

