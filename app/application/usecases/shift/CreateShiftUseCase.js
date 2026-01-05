/**
 * Use Case: Создание смены на объекте на указанную дату
 */
export class CreateShiftUseCase {
  constructor(shiftRepository, objectRepository) {
    this.shiftRepo = shiftRepository;
    this.objectRepo = objectRepository;
  }

  /**
   * Создает смену на объекте на указанную дату
   * @param {number} objectId - ID объекта
   * @param {string} date - Дата в формате YYYY-MM-DD
   * @param {Object} options - Опции (isAdmin для проверки доступа)
   * @returns {Promise<Object>} Созданная смена или null если уже существует
   */
  async execute(objectId, date, options = {}) {
    // Получаем объект
    const object = await this.objectRepo.findById(objectId, { isAdmin: options.isAdmin });
    if (!object) {
      throw new Error('Object not found');
    }

    // Формируем planned_start и planned_end из даты и времени объекта
    const plannedStart = new Date(`${date}T${object.planned_start}`);
    let plannedEnd = new Date(`${date}T${object.planned_end}`);
    
    // Если planned_end меньше planned_start, значит смена переходит на следующий день
    if (plannedEnd <= plannedStart) {
      plannedEnd.setDate(plannedEnd.getDate() + 1);
    }

    // Создаем смену
    const shift = await this.shiftRepo.create({
      workObjectId: objectId,
      date,
      plannedStart: plannedStart.toISOString(),
      plannedEnd: plannedEnd.toISOString(),
      lunchMinutes: object.lunch_minutes
    });

    return shift;
  }
}

