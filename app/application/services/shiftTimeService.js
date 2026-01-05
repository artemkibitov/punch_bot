/**
 * Сервис для работы со временем смен
 * Учитывает переход на следующий день (например, смена с 16:00 до 01:30)
 */

/**
 * Вычисление количества часов работы между двумя временными метками
 * @param {Date|string} startTime - Время начала
 * @param {Date|string} endTime - Время окончания
 * @param {number} lunchMinutes - Минуты обеда
 * @returns {number} Количество часов работы (с вычетом обеда)
 */
export function calculateWorkHours(startTime, endTime, lunchMinutes = 0) {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (end < start) {
    // Смена переходит на следующий день - добавляем 24 часа
    const nextDay = new Date(end);
    nextDay.setDate(nextDay.getDate() + 1);
    const diffMs = nextDay - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    const lunchHours = lunchMinutes / 60;
    return diffHours - lunchHours;
  }

  // Обычная смена в пределах одного дня
  const diffMs = end - start;
  const diffHours = diffMs / (1000 * 60 * 60);
  const lunchHours = lunchMinutes / 60;
  return diffHours - lunchHours;
}

/**
 * Получение даты смены для work_log
 * Если смена переходит на следующий день, date = дата начала
 * @param {Date|string} startTime - Время начала
 * @returns {string} Дата в формате YYYY-MM-DD
 */
export function getShiftDate(startTime) {
  const start = new Date(startTime);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Форматирование даты для отображения
 * @param {Date|string} date - Дата
 * @param {string} locale - Локаль (по умолчанию ru-RU)
 * @returns {string} Отформатированная дата
 */
export function formatDate(date, locale = 'ru-RU') {
  const d = new Date(date);
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Создание TIMESTAMP из даты и времени
 * @param {string} date - Дата в формате YYYY-MM-DD
 * @param {string} time - Время в формате HH:MM или HH:MM:SS
 * @returns {Date} Объект Date
 */
export function createTimestamp(date, time) {
  return new Date(`${date}T${time}`);
}

/**
 * Форматирование времени для отображения (только время, без даты)
 * @param {Date|string} time - Время
 * @param {string} locale - Локаль (по умолчанию ru-RU)
 * @returns {string} Отформатированное время (HH:MM)
 */
export function formatTime(time, locale = 'ru-RU') {
  const date = new Date(time);
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Форматирование длительности работы
 * @param {number} hours - Количество часов
 * @returns {string} Отформатированная строка (например, "8.5 ч" или "8 ч 30 мин")
 */
export function formatWorkHours(hours) {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours} ч`;
  }
  
  return `${wholeHours} ч ${minutes} мин`;
}

