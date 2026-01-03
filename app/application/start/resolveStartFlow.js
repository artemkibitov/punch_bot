import { STATES } from '../../domain/fsm/states.js';
import { EmployeeRepository } from '../../infrastructure/repositories/employeeRepository.js';

const repo = new EmployeeRepository();

export async function resolveStartFlow(ctx) {
  const telegramId = ctx.from.id;

  const employee = await repo.findByTelegramUserId(telegramId);

  if (employee) {
    return employee.role === 'MANAGER'
      ? STATES.MANAGER_MENU
      : STATES.EMPLOYEE_MENU;
  }
 
  return STATES.ONBOARDING_START;
}
