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

registerState(STATES.OBJECT_EDIT_STATUS, {
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

    // Получаем объект
    const object = await objectRepo.findById(objectId, { 
      managerId: manager.id, 
      isAdmin: manager.role === 'ADMIN' 
    });

    if (!object) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект не найден или нет доступа', {}, session);
      return;
    }

    const currentStatus = object.status === 'ACTIVE' ? 'Активен' : 'Архивирован';
    const newStatus = object.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    const newStatusText = newStatus === 'ACTIVE' ? 'Активен' : 'Архивирован';

    const menu = keyboard([
      [
        { 
          text: `✅ Перевести в "${newStatusText}"`, 
          cb: `object:edit:status:confirm|${objectId}|${newStatus}` 
        }
      ],
      [
        { text: '❌ Отмена', cb: `object:details|${objectId}` }
      ]
    ]);

    await MessageService.sendOrEdit(
      ctx,
      `📊 Изменение статуса объекта "${object.name}"\n\n` +
      `Текущий статус: ${currentStatus}\n\n` +
      `Выберите действие:`,
      menu,
      session
    );
  }
});

