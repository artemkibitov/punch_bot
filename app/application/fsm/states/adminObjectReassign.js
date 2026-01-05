import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../router.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { AuditLogRepository } from '../../../infrastructure/repositories/auditLogRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';

const objectRepo = new ObjectRepository();
const employeeRepo = new EmployeeRepository();
const auditRepo = new AuditLogRepository();

function formatManagersList(managers, currentManagerId) {
  if (managers.length === 0) {
    return 'В системе нет менеджеров для перезакрепления.';
  }

  let text = '👤 Выберите менеджера для перезакрепления объекта:\n\n';
  managers.forEach((manager, index) => {
    const isCurrent = manager.id === currentManagerId;
    text += `${index + 1}. ${manager.full_name}`;
    if (isCurrent) {
      text += ' (текущий менеджер)';
    }
    text += '\n';
  });

  return text;
}

function managersListKeyboard(managers, objectId) {
  const rows = managers.map((manager, index) => [
    { text: `${index + 1}. ${manager.full_name}`, cb: `admin:object:reassign:confirm|${objectId}|${manager.id}` }
  ]);

  rows.push([
    { text: '⬅️ Назад к объекту', cb: `admin:object:details|${objectId}` }
  ]);

  return keyboard(rows);
}

registerState(STATES.ADMIN_OBJECT_REASSIGN, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const objectId = session.data?.currentObjectId;

    if (!objectId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект не выбран', {}, session);
      return;
    }

    try {
      // Получаем объект
      const object = await objectRepo.findById(objectId, { isAdmin: true });
      if (!object) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: объект не найден', {}, session);
        return;
      }

      // Получаем всех менеджеров
      const managers = await employeeRepo.findAllManagers();

      await MessageService.sendOrEdit(
        ctx,
        formatManagersList(managers, object.manager_id),
        managersListKeyboard(managers, objectId),
        session
      );
    } catch (error) {
      console.error('Error fetching managers:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке менеджеров. Попробуйте позже.', {}, session);
    }
  }
});

