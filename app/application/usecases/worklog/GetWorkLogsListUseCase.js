/**
 * Use Case: Получение списка work_logs
 */
export class GetWorkLogsListUseCase {
  constructor(workLogRepository) {
    this.workLogRepo = workLogRepository;
  }

  /**
   * Получает список записей о работе
   * @param {Object} options - Опции фильтрации
   * @param {number} options.employeeId - ID сотрудника
   * @param {number} options.objectId - ID объекта
   * @param {number} options.objectShiftId - ID смены
   * @param {string} options.dateFrom - Дата начала периода (YYYY-MM-DD)
   * @param {string} options.dateTo - Дата окончания периода (YYYY-MM-DD)
   * @returns {Promise<Array>} Список записей о работе
   */
  async execute(options = {}) {
    const { employeeId, objectId, objectShiftId, dateFrom, dateTo } = options;

    if (employeeId) {
      // Получаем записи сотрудника
      return await this.workLogRepo.findByEmployeeId(employeeId, { dateFrom, dateTo });
    }

    if (objectShiftId) {
      // Получаем записи смены
      return await this.workLogRepo.findByObjectShiftId(objectShiftId);
    }

    if (objectId) {
      // Получаем записи объекта за период
      return await this.workLogRepo.findByObjectIdAndDateRange(objectId, dateFrom, dateTo);
    }

    throw new Error('At least one filter option must be provided');
  }
}

