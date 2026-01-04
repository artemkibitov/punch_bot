import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../router.js';

registerState(STATES.ONBOARDING_START, {
  async onEnter(ctx) {
    const { dialog, session } = ctx.state;

    const updatedSession = await dialog.setState(session, STATES.ENTER_MANAGER_PIN);
    // Обновляем session в ctx.state
    ctx.state.session = updatedSession;
    
    // Вызываем onEnter для нового состояния
    await runState(ctx, 'enter');
  }
});

