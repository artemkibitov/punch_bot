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

function formatEmployeesListForOnboard(employees, assignedEmployeeIds) {
  if (employees.length === 0) {
    return 'В системе нет сотрудников для назначения.';
  }

  let text = '👥 Выберите сотрудника для назначения на объект:\n\n';
  employees.forEach((emp, index) => {
    const isAssigned = assignedEmployeeIds.includes(emp.id);
    text += `${index + 1}. ${emp.full_name}`;
    if (isAssigned) {
      text += ' ⚠️ (уже назначен)';
    } else {
      text += ' ✅';
    }
    text += '\n';
  });

  return text;
}

function employeesOnboardKeyboard(employees, objectId, assignedEmployeeIds) {
  // Фильтруем только тех сотрудников, которые еще не назначены на объект
  const availableEmployees = employees.filter(emp => !assignedEmployeeIds.includes(emp.id));
  
  if (availableEmployees.length === 0) {
    return keyboard([
      [
        { text: '⬅️ Назад к сотрудникам объекта', cb: `admin:object:employees|${objectId}` }
      ]
    ]);
  }

  const rows = availableEmployees.map((emp, index) => [
    { text: `${index + 1}. ${emp.full_name}`, cb: `admin:object:employee:onboard:confirm|${objectId}|${emp.id}` }
  ]);

  rows.push([
    { text: '⬅️ Назад к сотрудникам объекта', cb: `admin:object:employees|${objectId}` }
  ]);

  return keyboard(rows);
}

registerState(STATES.ADMIN_OBJECT_EMPLOYEE_ONBOARD, {
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

      // Получаем всех сотрудников (только EMPLOYEE, не MANAGER и не ADMIN)
      const allEmployees = await employeeRepo.findAll({ includeInactive: false });
      const employees = allEmployees.filter(emp => emp.role === 'EMPLOYEE');

      // Получаем уже назначенных на объект сотрудников
      const assignedEmployees = await assignmentRepo.findActiveByObjectId(objectId);
      const assignedEmployeeIds = assignedEmployees.map(emp => emp.id);

      const availableEmployees = employees.filter(emp => !assignedEmployeeIds.includes(emp.id));
      
      if (availableEmployees.length === 0) {
        await MessageService.sendOrEdit(
          ctx,
          'Все сотрудники уже назначены на этот объект.',
          keyboard([
            [
              { text: '⬅️ Назад к сотрудникам объекта', cb: `admin:object:employees|${objectId}` }
            ]
          ]),
          session
        );
        return;
      }

      await MessageService.sendOrEdit(
        ctx,
        formatEmployeesListForOnboard(availableEmployees, []),
        employeesOnboardKeyboard(employees, objectId, assignedEmployeeIds),
        session
      );
    } catch (error) {
      console.error('Error fetching employees for onboard:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке сотрудников. Попробуйте позже.', {}, session);
    }
  }
});

