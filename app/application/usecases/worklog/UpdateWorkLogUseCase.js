/**
 * Use Case: Обновление work_log (редактирование времени)
 */
export class UpdateWorkLogUseCase {
  constructor(workLogRepository, auditLogRepository) {
    this.workLogRepo = workLogRepository;
    this.auditRepo = auditLogRepository;
  }

  /**
   * Обновляет запись о работе
   * @param {number} workLogId - ID записи
   * @param {Object} updates - Обновления
   * @param {Date|string} updates.actualStart - Фактическое время начала
   * @param {Date|string} updates.actualEnd - Фактическое время окончания
   * @param {number} updates.lunchMinutes - Минуты обеда
   * @param {number} updatedBy - ID обновляющего
   * @returns {Promise<Object>} Обновленная запись
   */
  async execute(workLogId, updates, updatedBy) {
    const updatedLog = await this.workLogRepo.update(workLogId, {
      actualStart: updates.actualStart,
      actualEnd: updates.actualEnd,
      lunchMinutes: updates.lunchMinutes,
      updatedBy
    });

    // Логируем в audit
    await this.auditRepo.log({
      entityType: 'work_logs',
      entityId: workLogId,
      action: 'update',
      changedBy: updatedBy,
      metadata: updates
    });

    return updatedLog;
  }
}

