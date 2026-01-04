import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';

function adminMenu() {
  return keyboard([
    [
      { text: '🏗 Все объекты', cb: 'admin:objects' }
    ],
    [
      { text: '👥 Все сотрудники', cb: 'admin:employees' }
    ],
    [
      { text: '📊 Отчёты', cb: 'admin:reports' }
    ]
  ]);
}

registerState(STATES.ADMIN_MENU, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    await MessageService.sendOrEdit(ctx, 'Административное меню:', adminMenu(), session);
  }
});

