import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';

const employeeRepo = new EmployeeRepository();

function formatEmployeesList(employees) {
  if (employees.length === 0) {
    return 'У вас пока нет сотрудников.\n\nСотрудники появятся здесь после назначения на ваши объекты.';
  }

  let text = '👥 Ваши сотрудники:\n\n';
  employees.forEach((emp, index) => {
    text += `${index + 1}. ${emp.full_name}\n`;
    text += `   Роль: ${emp.role === 'EMPLOYEE' ? 'Сотрудник' : emp.role}\n`;
    if (emp.telegram_user_id) {
      text += `   ✅ Telegram привязан\n`;
    } else {
      text += `   ⚠️ Telegram не привязан\n`;
    }
    text += '\n';
  });

  return text;
}

function employeesListKeyboard(employees) {
  const rows = employees.map((emp, index) => [
    { text: `${index + 1}. ${emp.full_name}`, cb: `employee:details|${emp.id}` }
  ]);

  rows.push([
    { text: '➕ Создать сотрудника', cb: 'manager:employee:create' }
  ]);

  rows.push([
    { text: '⬅️ Главное меню', cb: 'manager:menu' }
  ]);

  return keyboard(rows);
}

registerState(STATES.MANAGER_EMPLOYEES_LIST, {
  async onEnter(ctx) {
    const { session } = ctx.state;

    try {
      // Получаем менеджера
      const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
      if (!manager) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: менеджер не найден', {}, session);
        return;
      }

      // Получаем всех сотрудников менеджера (через объекты)
      const employees = await employeeRepo.findByManagerId(manager.id, { includeInactive: false });

      await MessageService.sendOrEdit(
        ctx,
        formatEmployeesList(employees),
        employeesListKeyboard(employees),
        session
      );
    } catch (error) {
      console.error('Error fetching employees:', error);
      await MessageService.sendOrEdit(
        ctx,
        'Ошибка при загрузке сотрудников. Попробуйте позже.',
        {},
        session
      );
    }
  }
});

