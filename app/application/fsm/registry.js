const stateHandlers = new Map();

/**
 * Регистрирует обработчики для состояния FSM
 * @param {string} stateName - Имя состояния из STATES
 * @param {Object} handlers - Объект с onEnter и/или onInput
 * @param {Function} handlers.onEnter - Вызывается при входе в состояние
 * @param {Function} handlers.onInput - Вызывается при вводе текста в состоянии
 */
export function registerState(stateName, { onEnter, onInput } = {}) {
  if (stateHandlers.has(stateName)) {
    throw new Error(`State handler already registered: ${stateName}`);
  }

  stateHandlers.set(stateName, {
    onEnter: onEnter || null,
    onInput: onInput || null
  });

  console.log(`✅ Registered state: ${stateName} (onEnter: ${!!onEnter}, onInput: ${!!onInput})`);
}

/**
 * Получает обработчики для состояния
 * @param {string} stateName
 * @returns {Object|null}
 */
export function getStateHandlers(stateName) {
  return stateHandlers.get(stateName) || null;
}

