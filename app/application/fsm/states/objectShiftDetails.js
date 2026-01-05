import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';
import { formatTime, formatWorkHours, calculateWorkHours, formatDate } from '../../services/shiftTimeService.js';
import { container } from '../../../infrastructure/di/container.js';

const objectRepo = new ObjectRepository();
const employeeRepo = new EmployeeRepository();

function formatShiftDetails(shift, workLogs) {
  const dateStr = formatDate(shift.date);

  let text = `📅 Смена: ${dateStr}\n\n`;
  text += `⏰ Плановое время: ${formatTime(shift.planned_start)} - ${formatTime(shift.planned_end)}\n`;
  text += `🍽 Обед: ${shift.lunch_minutes} мин\n`;
  text += `📊 Статус: `;
  
  if (shift.status === 'planned') {
    text += `⚪ Запланирована\n`;
  } else if (shift.status === 'started') {
    text += `🟢 Началась\n`;
    if (shift.started_at) {
      text += `⏱ Начало: ${formatTime(shift.started_at)}\n`;
    }
  } else {
    text += `✅ Завершена\n`;
    if (shift.started_at) {
      text += `⏱ Начало: ${formatTime(shift.started_at)}\n`;
    }
    if (shift.closed_at) {
      text += `⏱ Окончание: ${formatTime(shift.closed_at)}\n`;
    }
  }

  text += `\n👥 Сотрудники (${workLogs.length}):\n\n`;
  
  if (workLogs.length === 0) {
    text += `   На смене нет сотрудников\n`;
  } else {
      workLogs.forEach((log, index) => {
        text += `${index + 1}. ${log.full_name || 'Неизвестно'}`;
        if (log.is_override) {
          text += ` ⚠️`;
        }
        text += `\n`;
        
        if (log.actual_start) {
          text += `   Начало: ${formatTime(log.actual_start)}\n`;
        }
        
        if (log.actual_end) {
          text += `   Окончание: ${formatTime(log.actual_end)}\n`;
          const hours = calculateWorkHours(log.actual_start, log.actual_end, log.lunch_minutes || 0);
          text += `   Часов: ${formatWorkHours(hours)}\n`;
        } else {
          text += `   ⏳ Работает...\n`;
        }
        
        text += `\n`;
      });
  }

  return text;
}

function shiftDetailsKeyboard(shift, objectId, workLogs) {
  const rows = [];

  // Показываем кнопки для каждого work_log (последние 5)
  const recentLogs = workLogs.slice(0, 5);
  recentLogs.forEach((log) => {
    const label = log.full_name || 'Неизвестно';
    const hasEnd = log.actual_end ? ' ✅' : '';
    rows.push([
      { text: `👤 ${label}${hasEnd}`, cb: `worklog:details|${log.id}` }
    ]);
    // Если смена начата и у сотрудника нет actual_end, показываем кнопку для раннего ухода
    if (shift.status === 'started' && !log.actual_end) {
      rows.push([
        { text: `   ⏹️ Завершить работу`, cb: `shift:remove:employee|${objectId}|${shift.id}|${log.id}` }
      ]);
    }
  });

  if (shift.status === 'planned') {
    rows.push([
      { text: '🟢 Подтвердить начало смены', cb: `object:shift:confirm:start|${objectId}|${shift.id}` }
    ]);
    rows.push([
      { text: '❌ Отметить отсутствующих', cb: `shift:start:mark:absent|${objectId}|${shift.id}` }
    ]);
  } else if (shift.status === 'started') {
    rows.push([
      { text: '✅ Подтвердить окончание смены', cb: `object:shift:confirm:end|${objectId}|${shift.id}` }
    ]);
    rows.push([
      { text: '➕ Добавить сотрудника', cb: `shift:add:employee|${objectId}|${shift.id}` }
    ]);
  }

  rows.push([
    { text: '⬅️ Назад к сменам', cb: `object:shifts|${objectId}` }
  ]);

  return keyboard(rows);
}

registerState(STATES.OBJECT_SHIFT_DETAILS, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const objectId = session.data?.currentObjectId;
    const shiftId = session.data?.currentShiftId;

    if (!objectId || !shiftId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект или смена не выбраны', {}, session);
      return;
    }

    try {
      // Получаем manager
      const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
      if (!manager) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: менеджер не найден', {}, session);
        return;
      }

      // Проверяем права доступа к объекту
      const object = await objectRepo.findById(objectId, { 
        managerId: manager.id, 
        isAdmin: manager.role === 'ADMIN' 
      });
      if (!object) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: объект не найден или нет доступа', {}, session);
        return;
      }

      // Используем use case для получения деталей смены
      const getShiftDetailsUseCase = await container.getAsync('GetShiftDetailsUseCase');
      const { shift, workLogs } = await getShiftDetailsUseCase.execute(shiftId);

      // Проверяем, что смена принадлежит объекту
      if (shift.work_object_id !== objectId) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: смена не найдена', {}, session);
        return;
      }

      // Отправляем шапку смены
      await MessageService.sendOrEdit(
        ctx,
        formatShiftDetails(shift, workLogs),
        shiftDetailsKeyboard(shift, objectId, workLogs),
        session
      );
    } catch (error) {
      console.error('Error fetching shift details:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке смены. Попробуйте позже.', {}, session);
    }
  }
});

