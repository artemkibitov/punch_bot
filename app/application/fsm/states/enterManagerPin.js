import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { pinKeyboard } from '../../../transport/telegram/ui/pinKeyboard.js';

registerState(STATES.ENTER_MANAGER_PIN, {
  async onEnter(ctx) {
    // Показываем клавиатуру для ввода PIN
    // Логика ввода PIN обрабатывается через callback (pin:add, pin:del, pin:cancel)
    // в transport/telegram/callbacks/pin.js
    const currentPin = ctx.state.session?.data?.pin || '';
    
    await ctx.reply(
      `Введите PIN: ${'*'.repeat(currentPin.length)}`,
      pinKeyboard(currentPin)
    );
  }
});

