import { ShiftRepository } from '../../infrastructure/repositories/shiftRepository.js';
import { WorkLogRepository } from '../../infrastructure/repositories/workLogRepository.js';
import { AssignmentRepository } from '../../infrastructure/repositories/assignmentRepository.js';
import { ObjectRepository } from '../../infrastructure/repositories/objectRepository.js';
import { calculateWorkHours, getShiftDate } from './shiftTimeService.js';

/**
 * Подсчет уникальных дней работы из work_logs
 */
function countUniqueDays(workLogs) {
  const uniqueDates = new Set();
  workLogs.forEach(log => {
    const logDate = new Date(log.date).toISOString().split('T')[0];
    uniqueDates.add(logDate);
  });
  return uniqueDates.size;
}

export class ShiftService {
  constructor() {
    this.shiftRepo = new ShiftRepository();
    this.workLogRepo = new WorkLogRepository();
    this.assignmentRepo = new AssignmentRepository();
    this.objectRepo = new ObjectRepository();
  }

  /**
   * Создание смены на объекте на указанную дату
   * @param {number} objectId - ID объекта
   * @param {string} date - Дата в формате YYYY-MM-DD
   * @returns {Promise<Object>} Созданная смена
   */
  async createShiftForDate(objectId, date) {
    // Получаем объект
    const object = await this.objectRepo.findById(objectId, { isAdmin: true });
    if (!object) {
      throw new Error('Object not found');
    }

    // Формируем planned_start и planned_end из даты и времени объекта
    const plannedStart = new Date(`${date}T${object.planned_start}`);
    let plannedEnd = new Date(`${date}T${object.planned_end}`);
    
    // Если planned_end меньше planned_start, значит смена переходит на следующий день
    if (plannedEnd <= plannedStart) {
      plannedEnd.setDate(plannedEnd.getDate() + 1);
    }

    // Создаем смену
    const shift = await this.shiftRepo.create({
      workObjectId: objectId,
      date,
      plannedStart: plannedStart.toISOString(),
      plannedEnd: plannedEnd.toISOString(),
      lunchMinutes: object.lunch_minutes
    });

    return shift;
  }

  /**
   * Подтверждение начала смены
   * Создает work_logs для всех сотрудников объекта
   * @param {number} shiftId - ID смены
   * @param {number} confirmedBy - ID менеджера
   * @param {Date|string} actualStartTime - Фактическое время начала (опционально, по умолчанию now())
   * @param {Array<number>} absentEmployeeIds - ID отсутствующих сотрудников (опционально)
   * @returns {Promise<Object>} Обновленная смена
   */
  async confirmShiftStart(shiftId, confirmedBy, actualStartTime = null, absentEmployeeIds = []) {
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

  /**
   * Подтверждение начала смены с исключением отсутствующих
   * @param {number} shiftId - ID смены
   * @param {number} confirmedBy - ID менеджера
   * @param {Array<number>} absentEmployeeIds - ID отсутствующих сотрудников
   * @returns {Promise<Object>} Обновленная смена
   */
  async confirmShiftStartWithAbsent(shiftId, confirmedBy, absentEmployeeIds) {
    return this.confirmShiftStart(shiftId, confirmedBy, null, absentEmployeeIds);
  }

  /**
   * Добавление сотрудника в начатую смену
   * @param {number} shiftId - ID смены
   * @param {number} employeeId - ID сотрудника
   * @param {number} createdBy - ID менеджера
   * @param {Date|string} actualStartTime - Фактическое время начала (опционально, по умолчанию now())
   * @returns {Promise<Object>} Созданный work_log
   */
  async addEmployeeToShift(shiftId, employeeId, createdBy, actualStartTime = null) {
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

  /**
   * Удаление сотрудника из смены (ранний уход)
   * @param {number} workLogId - ID work_log
   * @param {number} updatedBy - ID менеджера
   * @param {Date|string} actualEndTime - Фактическое время окончания (опционально, по умолчанию now())
   * @returns {Promise<Object>} Обновленный work_log
   */
  async removeEmployeeFromShift(workLogId, updatedBy, actualEndTime = null) {
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

  /**
   * Подтверждение окончания смены
   * Обновляет work_logs всех сотрудников
   * @param {number} shiftId - ID смены
   * @param {number} confirmedBy - ID менеджера
   * @param {Date|string} actualEndTime - Фактическое время окончания (опционально, по умолчанию now())
   * @returns {Promise<Object>} Обновленная смена
   */
  async confirmShiftEnd(shiftId, confirmedBy, actualEndTime = null) {
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

  /**
   * Получение статистики по часам работы для объекта за период
   * @param {number} objectId - ID объекта
   * @param {string} dateFrom - Дата начала периода (YYYY-MM-DD)
   * @param {string} dateTo - Дата окончания периода (YYYY-MM-DD)
   * @returns {Promise<Array>} Массив статистики по сотрудникам
   */
  async getObjectHoursReport(objectId, dateFrom, dateTo) {
    // Получаем все work_logs объекта за период
    const allWorkLogs = await this.workLogRepo.findByObjectIdAndDateRange(objectId, dateFrom, dateTo);
    
    // Группируем по сотрудникам
    const stats = new Map();
    
    for (const log of allWorkLogs) {
      if (!log.actual_start || !log.actual_end) continue;
      
      const hours = calculateWorkHours(log.actual_start, log.actual_end, log.lunch_minutes || 0);
      
      if (!stats.has(log.employee_id)) {
        stats.set(log.employee_id, {
          employeeId: log.employee_id,
          employeeName: log.full_name || 'Unknown',
          totalHours: 0,
          logs: []
        });
      }
      
      const stat = stats.get(log.employee_id);
      stat.totalHours += hours;
      stat.logs.push(log);
    }
    
    // Подсчитываем уникальные дни для каждого сотрудника
    const result = Array.from(stats.values()).map(stat => ({
      employeeId: stat.employeeId,
      employeeName: stat.employeeName,
      totalHours: stat.totalHours,
      daysWorked: countUniqueDays(stat.logs)
    }));
    
    return result;
  }
}

