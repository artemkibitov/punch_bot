import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../router.js';
import { MessageService } from '../../services/messageService.js';

function requiredText(text) {
  if (!text || !text.trim()) {
    return 'Введите непустой текст';
  }
}

function maxLength(max) {
  return (text) => {
    if (text.length > max) {
      return `Максимум ${max} символов`;
    }
  };
}

function runValidators(text, validators = []) {
  for (const v of validators) {
    const error = v(text);
    if (error) return error;
  }
}

registerState(STATES.OBJECT_CREATE_ENTER_NAME, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    await MessageService.sendOrEdit(ctx, 'Введите название объекта:', {}, session);
  },

  async onInput(ctx) {
    const text = ctx.message.text;

    const error = runValidators(text, [
      requiredText,
      maxLength(100)
    ]);

    if (error) {
      const { session } = ctx.state;
      await MessageService.sendOrEdit(ctx, error, {}, session);
      return;
    }

    const { dialog, session } = ctx.state;
    const objectName = text.trim();

    // Сохраняем название в data и получаем обновленную сессию
    const sessionWithData = await dialog.mergeData(session, { objectName });

    // Переходим к вводу графика
    const updatedSession = await dialog.setState(sessionWithData, STATES.OBJECT_CREATE_ENTER_SCHEDULE);
    ctx.state.session = updatedSession;

    await runState(ctx, 'enter');
  }
});

