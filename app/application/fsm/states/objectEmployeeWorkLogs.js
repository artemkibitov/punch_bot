import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { WorkLogRepository } from '../../../infrastructure/repositories/workLogRepository.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { ShiftRepository } from '../../../infrastructure/repositories/shiftRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';
import { formatTime, formatDate, formatWorkHours, calculateWorkHours } from '../../services/shiftTimeService.js';

const workLogRepo = new WorkLogRepository();
const employeeRepo = new EmployeeRepository();
const objectRepo = new ObjectRepository();
const shiftRepo = new ShiftRepository();

function formatEmployeeWorkLogs(employee, workLogs, objectName) {
  let text = `👤 Сотрудник: ${employee.full_name}\n`;
  text += `🏗 Объект: ${objectName}\n\n`;
  
  if (workLogs.length === 0) {
    text += `📝 Записей о работе нет.\n\n`;
    text += `Вы можете создать индивидуальную корректировку времени.`;
  } else {
    text += `📝 Записи о работе (${workLogs.length}):\n\n`;
    
    workLogs.forEach((log, index) => {
      const dateStr = formatDate(log.date);
      text += `${index + 1}. ${dateStr}`;
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
      
      if (log.lunch_minutes) {
        text += `   Обед: ${log.lunch_minutes} мин\n`;
      }
      
      text += `\n`;
    });
  }

  return text;
}

function employeeWorkLogsKeyboard(workLogs, employeeId, objectId) {
  const rows = [];

  // Показываем последние 10 work_logs
  const recentLogs = workLogs.slice(0, 10);
  recentLogs.forEach((log) => {
    const date = new Date(log.date);
    const dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    const label = log.is_override ? `⚠️ ${dateStr}` : dateStr;
    rows.push([
      { text: `📝 ${label}`, cb: `worklog:details|${log.id}` }
    ]);
  });

  // Кнопка для создания новой корректировки
  rows.push([
    { text: '➕ Создать корректировку', cb: `worklog:create|${employeeId}|${objectId}` }
  ]);

  rows.push([
    { text: '⬅️ Назад к сотрудникам', cb: `object:employees|${objectId}` }
  ]);

  return keyboard(rows);
}

registerState(STATES.OBJECT_EMPLOYEE_WORK_LOGS, {
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

      // Получаем work_logs сотрудника на этом объекте за последние 30 дней
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);
      
      const allLogs = await workLogRepo.findByEmployeeId(employeeId, {
        dateFrom: dateFrom.toISOString().split('T')[0],
        dateTo: dateTo.toISOString().split('T')[0]
      });

      // Фильтруем только логи для этого объекта
      const workLogs = allLogs.filter(log => log.work_object_id === objectId);

      // Сортируем по дате (новые сначала)
      workLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

      await MessageService.sendOrEdit(
        ctx,
        formatEmployeeWorkLogs(employee, workLogs, object.name),
        employeeWorkLogsKeyboard(workLogs, employeeId, objectId),
        session
      );
    } catch (error) {
      console.error('Error fetching employee work logs:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке записей о работе. Попробуйте позже.', {}, session);
    }
  }
});

