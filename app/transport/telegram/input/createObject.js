import { registerInput } from './inputRouter.js';
import { runValidators, requiredText, maxLength } from './validators.js';
import { STATES } from '../../../domain/fsm/states.js';

registerInput(
  STATES.CREATE_OBJECT_ENTER_NAME,
  async (ctx) => {
    const text = ctx.message.text;

    const error = runValidators(text, [
      requiredText,
      maxLength(100)
    ]);

    if (error) {
      await ctx.reply(error);
      return;
    }

    const { dialog, session } = ctx.state;

    await dialog.mergeData(session, {
      objectName: text.trim()
    });

    await dialog.setState(session, STATES.MANAGER_MENU);

    await ctx.reply(`Объект "${text}" сохранён`);
  }
);
