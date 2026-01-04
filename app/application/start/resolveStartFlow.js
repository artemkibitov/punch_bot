import { STATES } from '../../domain/fsm/states.js';
import { ROLES } from '../../domain/constants/roles.js';
import { EmployeeRepository } from '../../infrastructure/repositories/employeeRepository.js';

const repo = new EmployeeRepository();

export async function resolveStartFlow(ctx) {
  const telegramId = ctx.from.id;

  const employee = await repo.findByTelegramUserId(telegramId);

  if (employee) {
    if (employee.role === ROLES.ADMIN) {
      return STATES.ADMIN_MENU;
    }
    if (employee.role === ROLES.MANAGER) {
      return STATES.MANAGER_MENU;
    }
    if (employee.role === ROLES.EMPLOYEE) {
      return STATES.EMPLOYEE_MENU;
    }
  }
 
  return STATES.ONBOARDING_START;
}
