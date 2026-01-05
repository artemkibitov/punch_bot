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

function formatWorkLogCreate(employee, object) {
  let text = `📝 Создание корректировки времени работы\n\n`;
  text += `👤 Сотрудник: ${employee.full_name}\n`;
  text += `🏗 Объект: ${object.name}\n`;
  text += `📅 Дата: ${formatDate(new Date().toISOString().split('T')[0])}\n\n`;
  
  text += `✏️ Введите время в формате:\n`;
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

registerState(STATES.WORK_LOG_CREATE, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const objectId = session.data?.currentObjectId;
    const employeeId = session.data?.currentEmployeeId;

    if (!objectId || !employeeId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект или сотрудник не выбраны', {}, session);
      return;
    }

    try {
      // Получаем текущего пользователя
      const currentUser = await employeeRepo.findByTelegramUserId(ctx.from.id);
      if (!currentUser) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: пользователь не найден', {}, session);
        return;
      }

      // Проверяем права доступа к объекту
      const object = await objectRepo.findById(objectId, {
        managerId: currentUser.id,
        isAdmin: currentUser.role === 'ADMIN'
      });
      if (!object) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: объект не найден или нет доступа', {}, session);
        return;
      }

      // Получаем сотрудника
      const employee = await employeeRepo.findById(employeeId);
      if (!employee) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: сотрудник не найден', {}, session);
        return;
      }

      await MessageService.sendOrEdit(
        ctx,
        formatWorkLogCreate(employee, object),
        keyboard([[
          { text: '❌ Отмена', cb: `object:employee:worklogs|${objectId}|${employeeId}` }
        ]]),
        session
      );
    } catch (error) {
      console.error('Error in work log create:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке данных. Попробуйте позже.', {}, session);
    }
  },

  async onMessage(ctx) {
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
      const objectId = session.data?.currentObjectId;
      const employeeId = session.data?.currentEmployeeId;
      const updatedSession = await dialog.mergeData(session, {});
      ctx.state.session = updatedSession;

      const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_EMPLOYEE_WORK_LOGS);
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

      const objectId = session.data?.currentObjectId;
      const employeeId = session.data?.currentEmployeeId;
      
      // Проверяем права доступа
      const object = await objectRepo.findById(objectId, {
        managerId: currentUser.id,
        isAdmin: currentUser.role === 'ADMIN'
      });
      if (!object) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: нет доступа к этому объекту', {}, session);
        return;
      }

      // Получаем сотрудника
      const employee = await employeeRepo.findById(employeeId);
      if (!employee) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: сотрудник не найден', {}, session);
        return;
      }

      // Парсим введенное время
      const parts = text.trim().split(/\s+/);
      const [startTime, endTime, lunchMinutes = '0'] = parts;

      // Создаем timestamp из даты и времени (сегодня)
      const today = new Date();
      const date = today.toISOString().split('T')[0];
      const actualStart = new Date(`${date}T${startTime}:00`);
      let actualEnd = new Date(`${date}T${endTime}:00`);

      // Если endTime меньше startTime, значит смена переходит на следующий день
      if (actualEnd <= actualStart) {
        actualEnd.setDate(actualEnd.getDate() + 1);
      }

      // Создаем индивидуальную корректировку (override)
      const overrideLog = await workLogRepo.createOverride({
        employeeId: employeeId,
        workObjectId: objectId,
        date: date,
        actualStart: actualStart.toISOString(),
        actualEnd: actualEnd.toISOString(),
        lunchMinutes: parseInt(lunchMinutes, 10),
        createdBy: currentUser.id
      });

      // Логируем в audit
      await auditRepo.log({
        entityType: 'work_logs',
        entityId: overrideLog.id,
        action: 'create',
        changedBy: currentUser.id,
        metadata: {
          type: 'override',
          employeeId: employeeId,
          actualStart: actualStart.toISOString(),
          actualEnd: actualEnd.toISOString(),
          lunchMinutes: parseInt(lunchMinutes, 10)
        }
      });

      // Возвращаемся к записям о работе сотрудника
      const updatedSession = await dialog.mergeData(session, { 
        currentObjectId: objectId,
        currentEmployeeId: employeeId
      });
      ctx.state.session = updatedSession;

      const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_EMPLOYEE_WORK_LOGS);
      ctx.state.session = finalSession;

      await MessageService.sendOrEdit(
        ctx,
        '✅ Время работы скорректировано',
        {},
        session
      );

      await runState(ctx, 'enter');
    } catch (error) {
      console.error('Error creating work log:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при сохранении корректировки. Попробуйте позже.', {}, session);
    }
  }
});

