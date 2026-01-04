import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../router.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';

const objectRepo = new ObjectRepository();

function formatObjectsList(objects) {
  if (objects.length === 0) {
    return 'У вас пока нет объектов.\n\nСоздайте первый объект через меню.';
  }

  let text = '📋 Ваши объекты:\n\n';
  objects.forEach((obj, index) => {
    text += `${index + 1}. ${obj.name}\n`;
    text += `   📍 ${obj.timezone || 'UTC'}\n`;
    text += `   ⏰ ${obj.planned_start} - ${obj.planned_end}\n`;
    text += `   🍽 Обед: ${obj.lunch_minutes} мин\n\n`;
  });

  return text;
}

function objectsListKeyboard(objects) {
  const rows = objects.map((obj, index) => [
    { text: `${index + 1}. ${obj.name}`, cb: `object:details|${obj.id}` }
  ]);

  rows.push([
    { text: '➕ Создать объект', cb: 'object:create' }
  ]);

  rows.push([
    { text: '⬅️ Главное меню', cb: 'manager:menu' }
  ]);

  return keyboard(rows);
}

registerState(STATES.MANAGER_OBJECTS_LIST, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const managerId = session.data?.managerId || ctx.from.id;

    // Получаем employee для managerId
    const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
    const employeeRepo = new EmployeeRepository();
    const manager = await employeeRepo.findByTelegramUserId(managerId);

    if (!manager) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: менеджер не найден', {}, session);
      return;
    }

    const objects = await objectRepo.findByManagerId(manager.id, { includeArchived: false });

    await MessageService.sendOrEdit(
      ctx,
      formatObjectsList(objects),
      objectsListKeyboard(objects),
      session
    );
  }
});

