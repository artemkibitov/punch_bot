import { Markup } from 'telegraf';

export function keyboard(rows) {
  return Markup.inlineKeyboard(
    rows.map(row =>
      row.map(btn =>
        Markup.button.callback(btn.text, btn.cb)
      )
    )
  );
}
