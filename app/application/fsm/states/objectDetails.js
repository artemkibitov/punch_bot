import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../router.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { AssignmentRepository } from '../../../infrastructure/repositories/assignmentRepository.js';
import { objectDetailsMenu } from '../../../transport/telegram/ui/menus.js';
import { MessageService } from '../../services/messageService.js';

const objectRepo = new ObjectRepository();
const employeeRepo = new EmployeeRepository();
const assignmentRepo = new AssignmentRepository();

function formatObjectDetails(object, employeeCount) {
  let text = `📋 Объект: ${object.name}\n\n`;
  text += `📍 Timezone: ${object.timezone || 'UTC'}\n`;
  text += `⏰ График: ${object.planned_start} - ${object.planned_end}\n`;
  text += `🍽 Обед: ${object.lunch_minutes} минут\n`;
  text += `👥 Сотрудников: ${employeeCount}\n`;
  text += `📊 Статус: ${object.status === 'ACTIVE' ? 'Активен' : 'Архивирован'}\n`;
  
  return text;
}

registerState(STATES.OBJECT_DETAILS, {
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

    // Получаем объект с проверкой прав
    const object = await objectRepo.findById(objectId, { 
      managerId: manager.id, 
      isAdmin: manager.role === 'ADMIN' 
    });

    if (!object) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект не найден или нет доступа', {}, session);
      return;
    }

    // Получаем количество сотрудников
    const employees = await assignmentRepo.findActiveByObjectId(objectId);
    const employeeCount = employees.length;

    await MessageService.sendOrEdit(
      ctx,
      formatObjectDetails(object, employeeCount),
      objectDetailsMenu(objectId),
      session
    );
  }
});

