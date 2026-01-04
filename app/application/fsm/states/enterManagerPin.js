import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { pinKeyboard } from '../../../transport/telegram/ui/pinKeyboard.js';
import { MessageService } from '../../services/messageService.js';

registerState(STATES.ENTER_MANAGER_PIN, {
  async onEnter(ctx) {
    // Показываем клавиатуру для ввода PIN
    // Логика ввода PIN обрабатывается через callback (pin:add, pin:del, pin:cancel)
    // в transport/telegram/callbacks/pin.js
    const { session } = ctx.state;
    const currentPin = session?.data?.pin || '';
    
    await MessageService.sendOrEdit(
      ctx,
      `Введите PIN: ${'*'.repeat(currentPin.length)}`,
      pinKeyboard(currentPin),
      session
    );
  }
});

