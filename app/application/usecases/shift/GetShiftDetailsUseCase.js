/**
 * Use Case: Получение деталей смены
 */
export class GetShiftDetailsUseCase {
  constructor(shiftRepository, workLogRepository) {
    this.shiftRepo = shiftRepository;
    this.workLogRepo = workLogRepository;
  }

  /**
   * Получает детали смены с work_logs
   * @param {number} shiftId - ID смены
   * @returns {Promise<Object>} Смена и список work_logs
   */
  async execute(shiftId) {
    const shift = await this.shiftRepo.findById(shiftId);
    
    if (!shift) {
      throw new Error('Shift not found');
    }

    const workLogs = await this.workLogRepo.findByObjectShiftId(shiftId);
    
    return { shift, workLogs };
  }
}

