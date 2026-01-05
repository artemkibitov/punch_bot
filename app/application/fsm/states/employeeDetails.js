import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { AssignmentRepository } from '../../../infrastructure/repositories/assignmentRepository.js';
import { WorkLogRepository } from '../../../infrastructure/repositories/workLogRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';

const employeeRepo = new EmployeeRepository();
const assignmentRepo = new AssignmentRepository();
const workLogRepo = new WorkLogRepository();

function formatEmployeeDetails(employee, objects, totalHours, activeWorkLogs) {
  let text = `👤 Сотрудник: ${employee.full_name}\n\n`;
  
  text += `📊 Статус: `;
  if (employee.telegram_user_id) {
    text += `✅ Telegram активирован\n`;
  } else {
    text += `⚠️ Telegram не активирован\n`;
  }
  
  text += `\n📋 Назначен на объекты:\n`;
  if (objects.length === 0) {
    text += `   (не назначен)\n`;
  } else {
    objects.forEach((obj, index) => {
      text += `   ${index + 1}. ${obj.name}\n`;
    });
  }
  
  text += `\n⏱ Общее количество часов: ${totalHours.toFixed(1)} ч\n`;
  
  // Показываем активные смены
  if (activeWorkLogs.length > 0) {
    text += `\n🔄 Активные смены:\n`;
    activeWorkLogs.forEach((log, index) => {
      const startTime = new Date(log.actual_start);
      const hoursAgo = ((Date.now() - startTime.getTime()) / (1000 * 60 * 60)).toFixed(1);
      text += `   ${index + 1}. ${log.object_name}\n`;
      text += `      Начало: ${startTime.toLocaleString('ru-RU')}\n`;
      text += `      Работает: ${hoursAgo} ч\n`;
    });
  }
  
  // Показываем реферальную ссылку только если она есть и не истекла
  if (employee.ref_code && (!employee.ref_code_expires_at || new Date(employee.ref_code_expires_at) > new Date())) {
    text += `\n🔗 Реферальная ссылка для активации Telegram:\n`;
    text += `https://t.me/{BOT_USERNAME}?start=ref-${employee.ref_code}\n`;
  } else if (!employee.telegram_user_id) {
    text += `\n⚠️ Реферальная ссылка не сгенерирована или истекла\n`;
  }
  
  return text;
}

function employeeDetailsKeyboard(employeeId, objects, backCallback) {
  const rows = [];
  
  // Кнопки для каждого объекта
  objects.forEach((obj) => {
    rows.push([
      { text: `🔴 Удалить с "${obj.name}"`, cb: `employee:unassign|${employeeId}|${obj.id}` }
    ]);
  });
  
  // Разделитель не нужен, если объектов нет или всего один
  
  // TODO: добавить кнопки для других действий (поставить смену, переназначить и т.д.)
  
  rows.push([
    { text: '⬅️ Назад', cb: backCallback || 'manager:employees' }
  ]);

  return keyboard(rows);
}

registerState(STATES.EMPLOYEE_DETAILS, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const employeeId = session.data?.currentEmployeeId;

    if (!employeeId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: сотрудник не выбран', {}, session);
      return;
    }

    try {
      // Получаем менеджера/администратора
      const currentUser = await employeeRepo.findByTelegramUserId(ctx.from.id);
      if (!currentUser) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: пользователь не найден', {}, session);
        return;
      }

      // Получаем сотрудника (для admin доступ ко всем, для manager - только созданные им)
      let employee;
      if (currentUser.role === 'ADMIN') {
        employee = await employeeRepo.findById(employeeId);
      } else {
        employee = await employeeRepo.findById(employeeId);
        // Проверяем, что сотрудник создан этим менеджером
        if (!employee || employee.created_by !== currentUser.id) {
          await MessageService.sendOrEdit(ctx, 'Ошибка: сотрудник не найден или нет доступа', {}, session);
          return;
        }
      }

      if (!employee) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: сотрудник не найден', {}, session);
        return;
      }

      // Получаем объекты сотрудника
      const objects = await assignmentRepo.findObjectsByEmployeeId(employeeId);

      // Получаем общее количество часов из work_logs
      const workLogs = await workLogRepo.findByEmployeeId(employeeId);
      const totalHours = workLogs.reduce((sum, log) => {
        if (log.actual_start && log.actual_end) {
          const start = new Date(log.actual_start);
          const end = new Date(log.actual_end);
          const diffMs = end - start;
          const diffHours = diffMs / (1000 * 60 * 60);
          const lunchHours = (log.lunch_minutes || 0) / 60;
          return sum + (diffHours - lunchHours);
        }
        return sum;
      }, 0);

      // Получаем активные смены (без actual_end)
      const activeWorkLogs = await workLogRepo.findActiveByEmployeeId(employeeId);

      // Получаем username бота для формирования ссылки
      const botInfo = await ctx.telegram.getMe();
      const botUsername = botInfo.username;

      let detailsText = formatEmployeeDetails(employee, objects, totalHours, activeWorkLogs);
      
      // Заменяем плейсхолдер {BOT_USERNAME} на реальный username
      detailsText = detailsText.replace('{BOT_USERNAME}', botUsername);

      // Определяем состояние для возврата (из data или по умолчанию)
      const backState = session.data?.backState || (currentUser.role === 'ADMIN' ? 'ADMIN_EMPLOYEES_LIST' : 'MANAGER_EMPLOYEES_LIST');
      const backCallback = session.data?.backCallback || (currentUser.role === 'ADMIN' ? 'admin:employees' : 'manager:employees');

      await MessageService.sendOrEdit(
        ctx,
        detailsText,
        employeeDetailsKeyboard(employeeId, objects, backCallback),
        session
      );
    } catch (error) {
      console.error('Error fetching employee details:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке данных сотрудника. Попробуйте позже.', {}, session);
    }
  }
});
