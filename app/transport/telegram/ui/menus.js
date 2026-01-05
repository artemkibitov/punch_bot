import { keyboard } from './keyboard.js';

export function managerMenu() {
  return keyboard([
    [
      { text: '🏗 Мои объекты', cb: 'manager:objects' }
    ],
    [
      { text: '👥 Мои сотрудники', cb: 'manager:employees' }
    ]
  ]);
}

export function objectDetailsMenu(objectId) {
  return keyboard([
    [
      { text: '👥 Сотрудники объекта', cb: `object:employees|${objectId}` }
    ],
    [
      { text: '📅 Смены объекта', cb: `object:shifts|${objectId}` }
    ],
    [
      { text: '📊 Отчеты', cb: `object:reports|${objectId}` }
    ],
    [
      { text: '⚙️ Редактировать', cb: `object:edit|${objectId}` }
    ],
    [
      { text: '⬅️ Назад к объектам', cb: 'manager:objects' }
    ]
  ]);
}

export function objectEditMenu(objectId) {
  return keyboard([
    [
      { text: '📅 Изменить график', cb: `object:edit:schedule|${objectId}` }
    ],
    [
      { text: '📊 Изменить статус', cb: `object:edit:status|${objectId}` }
    ],
    [
      { text: '⬅️ Назад к объекту', cb: `object:details|${objectId}` }
    ]
  ]);
}
