import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';

const employeeRepo = new EmployeeRepository();

function formatEmployeesList(employees) {
  if (employees.length === 0) {
    return 'В системе пока нет сотрудников.';
  }

  let text = '👥 Все сотрудники системы:\n\n';
  employees.forEach((emp, index) => {
    text += `${index + 1}. ${emp.full_name}\n`;
    text += `   Роль: ${emp.role === 'ADMIN' ? 'Администратор' : emp.role === 'MANAGER' ? 'Менеджер' : 'Сотрудник'}\n`;
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
    { text: `${index + 1}. ${emp.full_name}`, cb: `admin:employee:details|${emp.id}` }
  ]);

  rows.push([
    { text: '⬅️ В админ меню', cb: 'admin:menu' }
  ]);

  return keyboard(rows);
}

registerState(STATES.ADMIN_EMPLOYEES_LIST, {
  async onEnter(ctx) {
    const { session } = ctx.state;

    try {
      // Получаем всех сотрудников (для admin)
      const employees = await employeeRepo.findAll();

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

