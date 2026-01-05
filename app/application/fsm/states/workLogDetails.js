import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { WorkLogRepository } from '../../../infrastructure/repositories/workLogRepository.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';
import { formatTime, formatDate, formatWorkHours, calculateWorkHours } from '../../services/shiftTimeService.js';

const workLogRepo = new WorkLogRepository();
const employeeRepo = new EmployeeRepository();
const objectRepo = new ObjectRepository();

function formatWorkLogDetails(workLog) {
  let text = `📝 Запись о работе\n\n`;
  text += `👤 Сотрудник: ${workLog.full_name || 'Неизвестно'}\n`;
  text += `🏗 Объект: ${workLog.object_name || 'Неизвестно'}\n`;
  text += `📅 Дата: ${formatDate(workLog.date)}\n\n`;
  
  if (workLog.actual_start) {
    text += `⏰ Начало: ${formatTime(workLog.actual_start)}\n`;
  }
  
  if (workLog.actual_end) {
    text += `⏰ Окончание: ${formatTime(workLog.actual_end)}\n`;
    const hours = calculateWorkHours(workLog.actual_start, workLog.actual_end, workLog.lunch_minutes || 0);
    text += `⏱ Часов: ${formatWorkHours(hours)}\n`;
  } else {
    text += `⏳ Работает...\n`;
  }
  
  if (workLog.lunch_minutes) {
    text += `🍽 Обед: ${workLog.lunch_minutes} мин\n`;
  }
  
  if (workLog.is_override) {
    text += `\n⚠️ Индивидуальная корректировка`;
  }

  return text;
}

function workLogDetailsKeyboard(workLogId, canEdit, backState) {
  const rows = [];

  if (canEdit) {
    rows.push([
      { text: '✏️ Корректировать время', cb: `worklog:edit|${workLogId}` }
    ]);
  }

  // Определяем кнопку назад в зависимости от того, откуда пришли
  if (backState === 'OBJECT_SHIFT_DETAILS') {
    rows.push([
      { text: '⬅️ Назад к смене', cb: 'worklog:back' }
    ]);
  } else {
    rows.push([
      { text: '⬅️ Назад к записям', cb: 'worklog:back' }
    ]);
  }

  return keyboard(rows);
}

registerState(STATES.WORK_LOG_DETAILS, {
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
      const canEdit = object || currentUser.role === 'ADMIN';

      // Определяем состояние для возврата
      const backState = session.data?.currentShiftId ? 'OBJECT_SHIFT_DETAILS' : 'OBJECT_EMPLOYEE_WORK_LOGS';

      await MessageService.sendOrEdit(
        ctx,
        formatWorkLogDetails(workLog),
        workLogDetailsKeyboard(workLogId, canEdit, backState),
        session
      );
    } catch (error) {
      console.error('Error fetching work log details:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке записи. Попробуйте позже.', {}, session);
    }
  }
});

