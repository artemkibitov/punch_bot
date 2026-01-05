import { getShiftDate } from '../../services/shiftTimeService.js';

/**
 * Use Case: Добавление сотрудника в начатую смену
 */
export class AddEmployeeToShiftUseCase {
  constructor(shiftRepository, workLogRepository, auditLogRepository) {
    this.shiftRepo = shiftRepository;
    this.workLogRepo = workLogRepository;
    this.auditRepo = auditLogRepository;
  }

  /**
   * Добавляет сотрудника в смену
   * @param {number} shiftId - ID смены
   * @param {number} employeeId - ID сотрудника
   * @param {number} createdBy - ID менеджера
   * @param {Date|string} actualStartTime - Фактическое время начала (опционально)
   * @returns {Promise<Object>} Созданный work_log
   */
  async execute(shiftId, employeeId, createdBy, actualStartTime = null) {
    // Получаем смену
    const shiftData = await this.shiftRepo.findById(shiftId);
    
    if (!shiftData) {
      throw new Error('Shift not found');
    }
    
    if (shiftData.status !== 'started') {
      throw new Error('Shift must be started');
    }

    // Проверяем, не создан ли уже work_log для этого сотрудника
    const existingLogs = await this.workLogRepo.findByObjectShiftId(shiftId);
    if (existingLogs.some(log => log.employee_id === employeeId)) {
      throw new Error('Employee already has work log for this shift');
    }

    // Создаем work_log для сотрудника
    const actualStart = actualStartTime ? new Date(actualStartTime) : new Date();
    const shiftDate = getShiftDate(actualStart);
    
    const workLog = await this.workLogRepo.create({
      employeeId: employeeId,
      workObjectId: shiftData.work_object_id,
      objectShiftId: shiftId,
      date: shiftDate,
      actualStart: actualStart.toISOString(),
      createdBy: createdBy
    });
    
    return workLog;
  }
}

