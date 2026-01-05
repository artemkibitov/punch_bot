/**
 * Use Case: Подтверждение окончания смены
 * Обновляет work_logs всех сотрудников
 */
export class ConfirmShiftEndUseCase {
  constructor(shiftRepository, workLogRepository, auditLogRepository) {
    this.shiftRepo = shiftRepository;
    this.workLogRepo = workLogRepository;
    this.auditRepo = auditLogRepository;
  }

  /**
   * Подтверждает окончание смены
   * @param {number} shiftId - ID смены
   * @param {number} confirmedBy - ID менеджера
   * @param {Date|string} actualEndTime - Фактическое время окончания (опционально)
   * @returns {Promise<Object>} Обновленная смена и work_logs
   */
  async execute(shiftId, confirmedBy, actualEndTime = null) {
    // Получаем work_logs смены
    const workLogs = await this.workLogRepo.findByObjectShiftId(shiftId);
    
    if (workLogs.length === 0) {
      throw new Error('No work logs found for this shift');
    }
    
    // Обновляем статус смены
    const updatedShift = await this.shiftRepo.confirmEnd(shiftId, { confirmedBy });
    
    // Обновляем все work_logs
    const actualEnd = actualEndTime ? new Date(actualEndTime) : new Date();
    
    const updatedWorkLogs = [];
    for (const workLog of workLogs) {
      const updated = await this.workLogRepo.updateEnd(workLog.id, {
        actualEnd: actualEnd.toISOString(),
        updatedBy: confirmedBy
      });
      updatedWorkLogs.push(updated);
    }
    
    return { shift: updatedShift, workLogs: updatedWorkLogs };
  }
}

