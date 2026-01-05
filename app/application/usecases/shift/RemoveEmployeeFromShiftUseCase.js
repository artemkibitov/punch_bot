/**
 * Use Case: Удаление сотрудника из смены (ранний уход)
 */
export class RemoveEmployeeFromShiftUseCase {
  constructor(shiftRepository, workLogRepository, auditLogRepository) {
    this.shiftRepo = shiftRepository;
    this.workLogRepo = workLogRepository;
    this.auditRepo = auditLogRepository;
  }

  /**
   * Удаляет сотрудника из смены (устанавливает actual_end)
   * @param {number} workLogId - ID work_log
   * @param {number} updatedBy - ID менеджера
   * @param {Date|string} actualEndTime - Фактическое время окончания (опционально)
   * @returns {Promise<Object>} Обновленный work_log
   */
  async execute(workLogId, updatedBy, actualEndTime = null) {
    // Получаем work_log
    const workLog = await this.workLogRepo.findById(workLogId);
    
    if (!workLog) {
      throw new Error('Work log not found');
    }

    // Проверяем, что смена начата
    const shiftData = await this.shiftRepo.findById(workLog.object_shift_id);
    if (!shiftData || shiftData.status !== 'started') {
      throw new Error('Shift must be started');
    }

    // Обновляем work_log - устанавливаем actual_end
    const actualEnd = actualEndTime ? new Date(actualEndTime) : new Date();
    
    await this.workLogRepo.updateEnd(workLogId, {
      actualEnd: actualEnd.toISOString(),
      updatedBy: updatedBy
    });

    const updatedLog = await this.workLogRepo.findById(workLogId);
    return updatedLog;
  }
}

