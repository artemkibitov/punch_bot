import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';

// Временное меню для сотрудника, позже будет расширено
function employeeMenu() {
  return keyboard([
    [
      { text: '📊 Моя статистика', cb: 'employee:stats' }
    ],
    [
      { text: '⏰ Мои часы', cb: 'employee:hours' }
    ],
    [
      { text: '🏗 Мои объекты', cb: 'employee:objects' }
    ]
  ]);
}

registerState(STATES.EMPLOYEE_MENU, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    await MessageService.sendOrEdit(ctx, 'Главное меню сотрудника:', employeeMenu(), session);
  }
});

