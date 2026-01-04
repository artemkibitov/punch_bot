import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../router.js';
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
    return 'На объекте пока нет сотрудников.\n\nДобавьте первого сотрудника через меню.';
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
    { text: `${index + 1}. ${emp.full_name}`, cb: `employee:details|${emp.id}` }
  ]);

  rows.push([
    { text: '➕ Добавить сотрудника', cb: `employee:create|${objectId}` }
  ]);

  rows.push([
    { text: '⬅️ Назад к объекту', cb: `object:details|${objectId}` }
  ]);

  return keyboard(rows);
}

registerState(STATES.OBJECT_EMPLOYEES_LIST, {
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

    // Проверяем права доступа к объекту
    const object = await objectRepo.findById(objectId, { 
      managerId: manager.id, 
      isAdmin: manager.role === 'ADMIN' 
    });

    if (!object) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект не найден или нет доступа', {}, session);
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
  }
});

