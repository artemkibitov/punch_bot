import { keyboard } from './keyboard.js';

export function pinKeyboard(current = '') {
  const digits = ['1','2','3','4','5','6','7','8','9','0'];

  const rows = [];
  for (let i = 0; i < digits.length; i += 3) {
    rows.push(
      digits.slice(i, i + 3).map(d => ({
        text: d,
        cb: `pin:add|${d}`
      }))
    );
  }

  rows.push([
    { text: '⬅️', cb: 'pin:del' },
    { text: '❌ Отмена', cb: 'pin:cancel' }
  ]);

  return keyboard(rows);
}
