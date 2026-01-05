import { calculateWorkHours } from '../../services/shiftTimeService.js';

/**
 * Use Case: Получение отчета по часам работы для объекта за период
 */
export class GetShiftReportUseCase {
  constructor(workLogRepository) {
    this.workLogRepo = workLogRepository;
  }

  /**
   * Подсчет уникальных дней работы из work_logs
   */
  countUniqueDays(workLogs) {
    const uniqueDates = new Set();
    workLogs.forEach(log => {
      const logDate = new Date(log.date).toISOString().split('T')[0];
      uniqueDates.add(logDate);
    });
    return uniqueDates.size;
  }

  /**
   * Получает статистику по часам работы для объекта за период
   * @param {number} objectId - ID объекта
   * @param {string} dateFrom - Дата начала периода (YYYY-MM-DD)
   * @param {string} dateTo - Дата окончания периода (YYYY-MM-DD)
   * @returns {Promise<Array>} Массив статистики по сотрудникам
   */
  async execute(objectId, dateFrom, dateTo) {
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
      daysWorked: this.countUniqueDays(stat.logs)
    }));
    
    return result;
  }
}

