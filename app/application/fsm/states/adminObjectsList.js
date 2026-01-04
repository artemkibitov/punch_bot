import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';

const objectRepo = new ObjectRepository();

function formatObjectsList(objects) {
  if (objects.length === 0) {
    return 'В системе пока нет объектов.';
  }

  let text = '📋 Все объекты системы:\n\n';
  objects.forEach((obj, index) => {
    text += `${index + 1}. ${obj.name}\n`;
    text += `   👤 Менеджер: ${obj.manager_name || 'Не указан'}\n`;
    text += `   📍 ${obj.timezone || 'UTC'}\n`;
    text += `   ⏰ ${obj.planned_start} - ${obj.planned_end}\n`;
    text += `   🍽 Обед: ${obj.lunch_minutes} мин\n`;
    text += `   📊 ${obj.status === 'ACTIVE' ? 'Активен' : 'Архивирован'}\n\n`;
  });

  return text;
}

function objectsListKeyboard(objects) {
  const rows = objects.map((obj, index) => [
    { text: `${index + 1}. ${obj.name}`, cb: `admin:object:details|${obj.id}` }
  ]);

  rows.push([
    { text: '⬅️ В админ меню', cb: 'admin:menu' }
  ]);

  return keyboard(rows);
}

registerState(STATES.ADMIN_OBJECTS_LIST, {
  async onEnter(ctx) {
    const { session } = ctx.state;

    try {
      // Получаем все объекты (для admin)
      const objects = await objectRepo.findAll();

      await MessageService.sendOrEdit(
        ctx,
        formatObjectsList(objects),
        objectsListKeyboard(objects),
        session
      );
    } catch (error) {
      console.error('Error fetching objects:', error);
      await MessageService.sendOrEdit(
        ctx,
        'Ошибка при загрузке объектов. Попробуйте позже.',
        {},
        session
      );
    }
  }
});

