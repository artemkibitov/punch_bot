/**
 * Use Case: Получение деталей work_log
 */
export class GetWorkLogDetailsUseCase {
  constructor(workLogRepository) {
    this.workLogRepo = workLogRepository;
  }

  /**
   * Получает детали записи о работе
   * @param {number} workLogId - ID записи
   * @returns {Promise<Object>} Запись о работе
   */
  async execute(workLogId) {
    const workLog = await this.workLogRepo.findById(workLogId);
    
    if (!workLog) {
      throw new Error('Work log not found');
    }

    return workLog;
  }
}

