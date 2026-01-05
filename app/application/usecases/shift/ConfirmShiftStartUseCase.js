import { getShiftDate } from '../../services/shiftTimeService.js';

/**
 * Use Case: Подтверждение начала смены
 * Создает work_logs для всех сотрудников объекта
 */
export class ConfirmShiftStartUseCase {
  constructor(shiftRepository, workLogRepository, assignmentRepository, auditLogRepository) {
    this.shiftRepo = shiftRepository;
    this.workLogRepo = workLogRepository;
    this.assignmentRepo = assignmentRepository;
    this.auditRepo = auditLogRepository;
  }

  /**
   * Подтверждает начало смены
   * @param {number} shiftId - ID смены
   * @param {number} confirmedBy - ID менеджера
   * @param {Date|string} actualStartTime - Фактическое время начала (опционально)
   * @param {Array<number>} absentEmployeeIds - ID отсутствующих сотрудников (опционально)
   * @returns {Promise<Object>} Обновленная смена и созданные work_logs
   */
  async execute(shiftId, confirmedBy, actualStartTime = null, absentEmployeeIds = []) {
    // Получаем смену
    const shiftData = await this.shiftRepo.findById(shiftId);
    
    if (!shiftData) {
      throw new Error('Shift not found');
    }
    
    // Обновляем статус смены
    const updatedShift = await this.shiftRepo.confirmStart(shiftId, { confirmedBy });
    
    // Получаем всех активных сотрудников объекта
    const employees = await this.assignmentRepo.findActiveByObjectId(shiftData.work_object_id);
    
    // Фильтруем отсутствующих
    const presentEmployees = employees.filter(emp => !absentEmployeeIds.includes(emp.id));
    
    // Создаем work_logs для каждого присутствующего сотрудника
    const actualStart = actualStartTime ? new Date(actualStartTime) : new Date();
    const shiftDate = getShiftDate(actualStart);
    
    const workLogs = [];
    for (const employee of presentEmployees) {
      const workLog = await this.workLogRepo.create({
        employeeId: employee.id,
        workObjectId: shiftData.work_object_id,
        objectShiftId: shiftId,
        date: shiftDate,
        actualStart: actualStart.toISOString(),
        createdBy: confirmedBy
      });
      workLogs.push(workLog);
    }
    
    return { shift: updatedShift, workLogs };
  }
}

