import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { objectEditMenu } from '../../../transport/telegram/ui/menus.js';
import { MessageService } from '../../services/messageService.js';

const objectRepo = new ObjectRepository();
const employeeRepo = new EmployeeRepository();

registerState(STATES.OBJECT_EDIT, {
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

    await MessageService.sendOrEdit(
      ctx,
      `⚙️ Редактирование объекта "${object.name}"\n\nВыберите что хотите изменить:`,
      objectEditMenu(objectId),
      session
    );
  }
});

