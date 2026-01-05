/**
 * Use Case: Создание индивидуальной корректировки work_log (override)
 */
export class CreateWorkLogUseCase {
  constructor(workLogRepository, auditLogRepository) {
    this.workLogRepo = workLogRepository;
    this.auditRepo = auditLogRepository;
  }

  /**
   * Создает override запись о работе
   * @param {Object} data - Данные записи
   * @param {number} data.employeeId - ID сотрудника
   * @param {number} data.workObjectId - ID объекта
   * @param {string} data.date - Дата (YYYY-MM-DD)
   * @param {Date|string} data.actualStart - Фактическое время начала
   * @param {Date|string} data.actualEnd - Фактическое время окончания
   * @param {number} data.lunchMinutes - Минуты обеда
   * @param {number} createdBy - ID создателя
   * @returns {Promise<Object>} Созданная запись
   */
  async execute(data, createdBy) {
    const overrideLog = await this.workLogRepo.createOverride({
      employeeId: data.employeeId,
      workObjectId: data.workObjectId,
      date: data.date,
      actualStart: data.actualStart,
      actualEnd: data.actualEnd,
      lunchMinutes: data.lunchMinutes,
      createdBy
    });

    // Логируем в audit
    await this.auditRepo.log({
      entityType: 'work_logs',
      entityId: overrideLog.id,
      action: 'create',
      changedBy: createdBy,
      metadata: {
        type: 'override',
        employeeId: data.employeeId,
        actualStart: data.actualStart,
        actualEnd: data.actualEnd,
        lunchMinutes: data.lunchMinutes
      }
    });

    return overrideLog;
  }
}

