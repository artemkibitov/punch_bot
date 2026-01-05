import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { AssignmentRepository } from '../../../infrastructure/repositories/assignmentRepository.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { ShiftRepository } from '../../../infrastructure/repositories/shiftRepository.js';
import { WorkLogRepository } from '../../../infrastructure/repositories/workLogRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';
import { getShiftDate } from '../../services/shiftTimeService.js';

const assignmentRepo = new AssignmentRepository();
const objectRepo = new ObjectRepository();
const employeeRepo = new EmployeeRepository();
const shiftRepo = new ShiftRepository();
const workLogRepo = new WorkLogRepository();

function formatEmployeesListForAdd(employees, existingWorkLogs) {
  const existingEmployeeIds = new Set(existingWorkLogs.map(log => log.employee_id));
  
  let text = '👥 Добавить сотрудника в смену:\n\n';
  text += 'Выберите сотрудника, который опоздал и должен быть добавлен в смену.\n\n';
  text += 'Список доступных сотрудников:\n\n';
  
  const availableEmployees = employees.filter(emp => !existingEmployeeIds.has(emp.id));
  
  if (availableEmployees.length === 0) {
    text += 'Все сотрудники уже добавлены в смену.';
  } else {
    availableEmployees.forEach((emp) => {
      text += `${emp.id}. ${emp.full_name}\n`;
    });
  }

  return text;
}

function employeesAddKeyboard(employees, existingWorkLogs, objectId, shiftId) {
  const rows = [];
  const existingEmployeeIds = new Set(existingWorkLogs.map(log => log.employee_id));
  const availableEmployees = employees.filter(emp => !existingEmployeeIds.has(emp.id));

  availableEmployees.forEach((emp) => {
    rows.push([
      { text: `➕ ${emp.full_name}`, cb: `shift:add:employee:confirm|${objectId}|${shiftId}|${emp.id}` }
    ]);
  });

  rows.push([
    { text: '⬅️ Назад к смене', cb: `object:shift:details|${objectId}|${shiftId}` }
  ]);

  return keyboard(rows);
}

registerState(STATES.SHIFT_ADD_EMPLOYEE, {
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

      // Получаем смену
      const shift = await shiftRepo.findById(shiftId);
      if (!shift) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: смена не найдена', {}, session);
        return;
      }

      if (shift.status !== 'started') {
        await MessageService.sendOrEdit(ctx, 'Ошибка: смена должна быть начата', {}, session);
        return;
      }

      // Получаем всех активных сотрудников объекта
      const employees = await assignmentRepo.findActiveByObjectId(objectId);
      
      // Получаем существующие work_logs для этой смены
      const existingWorkLogs = await workLogRepo.findByObjectShiftId(shiftId);

      await MessageService.sendOrEdit(
        ctx,
        formatEmployeesListForAdd(employees, existingWorkLogs),
        employeesAddKeyboard(employees, existingWorkLogs, objectId, shiftId),
        session
      );
    } catch (error) {
      console.error('Error in shift add employee:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке сотрудников. Попробуйте позже.', {}, session);
    }
  }
});

