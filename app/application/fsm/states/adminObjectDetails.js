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

function formatObjectDetails(object, employeeCount) {
  let text = `📋 Объект: ${object.name}\n\n`;
  text += `👤 Менеджер: ${object.manager_name || 'Не указан'}\n`;
  text += `📍 Timezone: ${object.timezone || 'UTC'}\n`;
  text += `⏰ График: ${object.planned_start} - ${object.planned_end}\n`;
  text += `🍽 Обед: ${object.lunch_minutes} минут\n`;
  text += `👥 Сотрудников: ${employeeCount}\n`;
  text += `📊 Статус: ${object.status === 'ACTIVE' ? 'Активен' : 'Архивирован'}\n`;
  
  return text;
}

registerState(STATES.ADMIN_OBJECT_DETAILS, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const objectId = session.data?.currentObjectId;

    if (!objectId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект не выбран', {}, session);
      return;
    }

    try {
      // Получаем объект (admin имеет доступ ко всем)
      const object = await objectRepo.findById(objectId, { isAdmin: true });

      if (!object) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: объект не найден', {}, session);
        return;
      }

      // Получаем количество сотрудников
      const employees = await assignmentRepo.findActiveByObjectId(objectId);
      const employeeCount = employees.length;

      // Получаем всех менеджеров для выбора нового
      const managers = await employeeRepo.findAllManagers();

      const menu = keyboard([
        [
          { text: '👥 Сотрудники объекта', cb: `admin:object:employees|${objectId}` }
        ],
        [
          { text: '🔄 Перезакрепить за менеджером', cb: `admin:object:reassign|${objectId}` }
        ],
        [
          { text: '🗑 Удалить объект', cb: `admin:object:delete|${objectId}` }
        ],
        [
          { text: '⬅️ Назад к объектам', cb: 'admin:objects' }
        ]
      ]);

      await MessageService.sendOrEdit(
        ctx,
        formatObjectDetails(object, employeeCount),
        menu,
        session
      );
    } catch (error) {
      console.error('Error fetching object details:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке объекта. Попробуйте позже.', {}, session);
    }
  }
});

