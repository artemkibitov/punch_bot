import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { managerMenu } from '../../../transport/telegram/ui/menus.js';
import { MessageService } from '../../services/messageService.js';

registerState(STATES.MANAGER_MENU, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    await MessageService.sendOrEdit(ctx, 'Главное меню менеджера:', managerMenu(), session);
  }
});

