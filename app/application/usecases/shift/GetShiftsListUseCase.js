/**
 * Use Case: Получение списка смен объекта
 */
export class GetShiftsListUseCase {
  constructor(shiftRepository) {
    this.shiftRepo = shiftRepository;
  }

  /**
   * Получает список смен объекта
   * @param {number} objectId - ID объекта
   * @param {Object} options - Опции (limit, offset, dateFrom, dateTo)
   * @returns {Promise<Array>} Список смен
   */
  async execute(objectId, options = {}) {
    const { limit = 10, offset = 0, dateFrom, dateTo } = options;
    
    const shifts = await this.shiftRepo.findByObjectId(objectId, {
      limit,
      offset,
      dateFrom,
      dateTo
    });
    
    return shifts;
  }
}

