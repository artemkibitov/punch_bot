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

function formatEmployeesListForOnboard(employees) {
  if (employees.length === 0) {
    return 'У вас нет сотрудников для назначения на объект.';
  }

  let text = '👥 Выберите сотрудника для назначения на объект:\n\n';
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

function employeesOnboardKeyboard(employees, objectId) {
  if (employees.length === 0) {
    return keyboard([
      [
        { text: '⬅️ Назад к сотрудникам объекта', cb: `object:employees|${objectId}` }
      ]
    ]);
  }

  const rows = employees.map((emp, index) => [
    { text: `${index + 1}. ${emp.full_name}`, cb: `manager:object:employee:onboard:confirm|${objectId}|${emp.id}` }
  ]);

  rows.push([
    { text: '⬅️ Назад к сотрудникам объекта', cb: `object:employees|${objectId}` }
  ]);

  return keyboard(rows);
}

registerState(STATES.MANAGER_OBJECT_EMPLOYEE_ONBOARD, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const objectId = session.data?.currentObjectId;

    if (!objectId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект не выбран', {}, session);
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

      // Получаем всех сотрудников менеджера (созданных им)
      const allEmployees = await employeeRepo.findByManagerId(manager.id, { includeInactive: false });
      const employees = allEmployees.filter(emp => emp.role === 'EMPLOYEE');

      // Получаем уже назначенных на объект сотрудников
      const assignedEmployees = await assignmentRepo.findActiveByObjectId(objectId);
      const assignedEmployeeIds = assignedEmployees.map(emp => emp.id);

      // Фильтруем только тех сотрудников, которые еще не назначены на объект
      const availableEmployees = employees.filter(emp => !assignedEmployeeIds.includes(emp.id));

      if (availableEmployees.length === 0) {
        await MessageService.sendOrEdit(
          ctx,
          'Все ваши сотрудники уже назначены на этот объект.',
          keyboard([
            [
              { text: '⬅️ Назад к сотрудникам объекта', cb: `object:employees|${objectId}` }
            ]
          ]),
          session
        );
        return;
      }

      await MessageService.sendOrEdit(
        ctx,
        formatEmployeesListForOnboard(availableEmployees),
        employeesOnboardKeyboard(availableEmployees, objectId),
        session
      );
    } catch (error) {
      console.error('Error fetching employees for onboard:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке сотрудников. Попробуйте позже.', {}, session);
    }
  }
});

