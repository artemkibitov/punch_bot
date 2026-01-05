import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { ShiftRepository } from '../../../infrastructure/repositories/shiftRepository.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';
import { formatTime } from '../../services/shiftTimeService.js';

const shiftRepo = new ShiftRepository();
const objectRepo = new ObjectRepository();
const employeeRepo = new EmployeeRepository();

function formatShiftsList(shifts, page = 0, pageSize = 10) {
  if (shifts.length === 0) {
    return 'На объекте пока нет смен.\n\nСоздайте смену для начала работы.';
  }

  const totalPages = Math.ceil(shifts.length / pageSize);
  const startIndex = page * pageSize;
  const endIndex = Math.min(startIndex + pageSize, shifts.length);
  const pageShifts = shifts.slice(startIndex, endIndex);

  let text = `📅 Смены объекта (${shifts.length} всего, страница ${page + 1}/${totalPages}):\n\n`;
  
  pageShifts.forEach((shift, index) => {
    const date = new Date(shift.date);
    const dateStr = date.toLocaleDateString('ru-RU');
    const statusEmoji = shift.status === 'closed' ? '✅' : shift.status === 'started' ? '🟢' : '⚪';
    
    text += `${startIndex + index + 1}. ${statusEmoji} ${dateStr}\n`;
    text += `   ${formatTime(shift.planned_start)} - ${formatTime(shift.planned_end)}\n`;
    text += `   Статус: ${shift.status === 'planned' ? 'Запланирована' : shift.status === 'started' ? 'Началась' : 'Завершена'}\n\n`;
  });

  return text;
}

function shiftsListKeyboard(shifts, objectId, page = 0, pageSize = 10) {
  const rows = [];
  
  const totalPages = Math.ceil(shifts.length / pageSize);
  const startIndex = page * pageSize;
  const endIndex = Math.min(startIndex + pageSize, shifts.length);
  const pageShifts = shifts.slice(startIndex, endIndex);
  
  // Показываем смены текущей страницы
  pageShifts.forEach((shift) => {
    const date = new Date(shift.date);
    const dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    const statusEmoji = shift.status === 'closed' ? '✅' : shift.status === 'started' ? '🟢' : '⚪';
    
    rows.push([
      { text: `${statusEmoji} ${dateStr}`, cb: `object:shift:details|${objectId}|${shift.id}` }
    ]);
  });

  // Кнопки пагинации
  const paginationRow = [];
  if (page > 0) {
    paginationRow.push({ text: '⬅️ Назад', cb: `object:shifts:page|${objectId}|${page - 1}` });
  }
  if (page < totalPages - 1) {
    paginationRow.push({ text: 'Вперед ➡️', cb: `object:shifts:page|${objectId}|${page + 1}` });
  }
  if (paginationRow.length > 0) {
    rows.push(paginationRow);
  }

  rows.push([
    { text: '➕ Создать смену', cb: `object:shift:create|${objectId}` }
  ]);

  rows.push([
    { text: '⬅️ Назад к объекту', cb: `object:details|${objectId}` }
  ]);

  return keyboard(rows);
}

registerState(STATES.OBJECT_SHIFTS_LIST, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const objectId = session.data?.currentObjectId;
    const page = session.data?.shiftsPage || 0;

    if (!objectId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект не выбран', {}, session);
      return;
    }

    try {
      // Получаем manager
      const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
      if (!manager) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: менеджер не найден', {}, session);
        return;
      }

      // Проверяем права доступа к объекту
      const object = await objectRepo.findById(objectId, { 
        managerId: manager.id, 
        isAdmin: manager.role === 'ADMIN' 
      });
      if (!object) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: объект не найден или нет доступа', {}, session);
        return;
      }

      // Получаем смены объекта (последние 30 дней)
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);
      
      const shifts = await shiftRepo.findByObjectId(objectId, {
        dateFrom: dateFrom.toISOString().split('T')[0],
        dateTo: dateTo.toISOString().split('T')[0]
      });

      // Сортируем по дате (новые сначала)
      shifts.sort((a, b) => new Date(b.date) - new Date(a.date));

      await MessageService.sendOrEdit(
        ctx,
        formatShiftsList(shifts, page),
        shiftsListKeyboard(shifts, objectId, page),
        session
      );
    } catch (error) {
      console.error('Error fetching shifts:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке смен. Попробуйте позже.', {}, session);
    }
  }
});

