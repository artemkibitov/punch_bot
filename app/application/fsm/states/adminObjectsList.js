import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';

const objectRepo = new ObjectRepository();

function formatObjectsList(activeObjects, archivedObjects) {
  if (activeObjects.length === 0 && archivedObjects.length === 0) {
    return 'В системе пока нет объектов.';
  }

  let text = '📋 Все объекты системы:\n\n';
  
  if (activeObjects.length > 0) {
    text += '✅ Активные объекты:\n\n';
    activeObjects.forEach((obj, index) => {
      text += `${index + 1}. ${obj.name}\n`;
      text += `   👤 Менеджер: ${obj.manager_name || 'Не указан'}\n`;
      text += `   📍 ${obj.timezone || 'UTC'}\n`;
      text += `   ⏰ ${obj.planned_start} - ${obj.planned_end}\n`;
      text += `   🍽 Обед: ${obj.lunch_minutes} мин\n\n`;
    });
  }
  
  if (archivedObjects.length > 0) {
    if (activeObjects.length > 0) {
      text += '\n';
    }
    text += '📦 Архивные объекты:\n\n';
    archivedObjects.forEach((obj, index) => {
      text += `${index + 1}. ${obj.name} (архив)\n`;
      text += `   👤 Менеджер: ${obj.manager_name || 'Не указан'}\n\n`;
    });
  }

  return text;
}

function objectsListKeyboard(activeObjects, archivedObjects) {
  const rows = [];
  
  // Активные объекты - кликабельные
  activeObjects.forEach((obj, index) => {
    rows.push([
      { text: `${index + 1}. ${obj.name}`, cb: `admin:object:details|${obj.id}` }
    ]);
  });
  
  // Архивные объекты - не кликабельные (только для просмотра)
  if (archivedObjects.length > 0) {
    archivedObjects.forEach((obj, index) => {
      rows.push([
        { text: `📦 ${obj.name} (архив)`, cb: `admin:object:details|${obj.id}` }
      ]);
    });
  }

  rows.push([
    { text: '⬅️ В админ меню', cb: 'admin:menu' }
  ]);

  return keyboard(rows);
}

registerState(STATES.ADMIN_OBJECTS_LIST, {
  async onEnter(ctx) {
    const { session } = ctx.state;

    try {
      // Получаем все объекты (для admin) - активные и архивированные
      const allObjects = await objectRepo.findAll({ includeArchived: true });
      
      const activeObjects = allObjects.filter(obj => obj.status === 'ACTIVE');
      const archivedObjects = allObjects.filter(obj => obj.status === 'ARCHIVED');

      await MessageService.sendOrEdit(
        ctx,
        formatObjectsList(activeObjects, archivedObjects),
        objectsListKeyboard(activeObjects, archivedObjects),
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

