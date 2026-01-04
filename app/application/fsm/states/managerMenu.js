import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { managerMenu } from '../../../transport/telegram/ui/menus.js';

registerState(STATES.MANAGER_MENU, {
  async onEnter(ctx) {
    await ctx.reply('Главное меню менеджера:', managerMenu());
  }
});

