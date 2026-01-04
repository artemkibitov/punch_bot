/**
 * Сервис для работы с сообщениями Telegram
 * Редактирует существующее сообщение или отправляет новое
 */
export class MessageService {
  /**
   * Отправляет или редактирует сообщение
   * Редактирует существующее сообщение, если это callback query, иначе отправляет новое
   * 
   * @param {Object} ctx - Контекст Telegraf
   * @param {string} text - Текст сообщения
   * @param {Object} extra - Дополнительные параметры (reply_markup, etc)
   * @param {Object} session - Сессия пользователя (для сохранения message_id)
   */
  static async sendOrEdit(ctx, text, extra = {}, session = null) {
    // Если это callback query - редактируем текущее сообщение
    if (ctx.callbackQuery?.message) {
      try {
        await ctx.answerCbQuery();
        const result = await ctx.editMessageText(text, extra);
        
        // Сохраняем message_id для последующих редактирований (если нужно)
        if (session && ctx.state?.dialog && result?.message_id) {
          await ctx.state.dialog.mergeData(session, { lastMessageId: result.message_id });
        }
        
        return result;
      } catch (error) {
        // Если не удалось отредактировать (например, текст не изменился) - отправляем новое
        console.log('Cannot edit message, sending new:', error.message);
        return await this.sendNew(ctx, text, extra, session);
      }
    }

    // Для текстовых сообщений или первого входа - отправляем новое
    return await this.sendNew(ctx, text, extra, session);
  }

  /**
   * Отправляет новое сообщение
   */
  static async sendNew(ctx, text, extra = {}, session = null) {
    const result = await ctx.reply(text, extra);
    
    // Сохраняем message_id в session для последующих редактирований
    if (session && ctx.state?.dialog && result?.message_id) {
      await ctx.state.dialog.mergeData(session, { lastMessageId: result.message_id });
    }
    
    return result;
  }
}

