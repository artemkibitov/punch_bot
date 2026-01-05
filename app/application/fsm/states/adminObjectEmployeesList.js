import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { AssignmentRepository } from '../../../infrastructure/repositories/assignmentRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';

const objectRepo = new ObjectRepository();
const employeeRepo = new EmployeeRepository();
const assignmentRepo = new AssignmentRepository();

function formatEmployeesList(employees) {
  if (employees.length === 0) {
    return 'На объекте пока нет сотрудников.\n\nНажмите "Назначить сотрудника" чтобы добавить сотрудника на объект.';
  }

  let text = '👥 Сотрудники объекта:\n\n';
  employees.forEach((emp, index) => {
    text += `${index + 1}. ${emp.full_name}`;
    if (emp.telegram_user_id) {
      text += ' ✅';
    } else {
      text += ' ⚠️ (не привязан)';
    }
    text += '\n';
  });

  return text;
}

function employeesListKeyboard(employees, objectId) {
  const rows = employees.map((emp, index) => [
    { text: `${index + 1}. ${emp.full_name}`, cb: `admin:employee:details|${emp.id}` }
  ]);

  rows.push([
    { text: '➕ Назначить сотрудника', cb: `admin:object:employee:onboard|${objectId}` }
  ]);

  rows.push([
    { text: '⬅️ Назад к объекту', cb: `admin:object:details|${objectId}` }
  ]);

  return keyboard(rows);
}

registerState(STATES.ADMIN_OBJECT_EMPLOYEES_LIST, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const objectId = session.data?.currentObjectId;

    if (!objectId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект не выбран', {}, session);
      return;
    }

    try {
      // Проверяем права доступа (admin имеет доступ ко всем объектам)
      const object = await objectRepo.findById(objectId, { isAdmin: true });
      if (!object) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: объект не найден', {}, session);
        return;
      }

      // Получаем сотрудников объекта
      const employees = await assignmentRepo.findActiveByObjectId(objectId);

      await MessageService.sendOrEdit(
        ctx,
        formatEmployeesList(employees),
        employeesListKeyboard(employees, objectId),
        session
      );
    } catch (error) {
      console.error('Error fetching employees:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке сотрудников. Попробуйте позже.', {}, session);
    }
  }
});

