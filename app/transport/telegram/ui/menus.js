import { keyboard } from './keyboard.js';

export function managerMenu() {
  return keyboard([
    [
      { text: '🏗 Создать объект', cb: 'object:create' }
    ],
    [
      { text: '📋 Объекты', cb: 'object:list' }
    ],
    [
      { text: '🕒 Создать смену', cb: 'shift:create' }
    ]
  ]);
}
