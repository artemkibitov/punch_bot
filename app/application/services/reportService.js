import { WorkLogRepository } from '../../infrastructure/repositories/workLogRepository.js';
import { AssignmentRepository } from '../../infrastructure/repositories/assignmentRepository.js';
import { calculateWorkHours, formatWorkHours } from './shiftTimeService.js';

export class ReportService {
  constructor() {
    this.workLogRepo = new WorkLogRepository();
    this.assignmentRepo = new AssignmentRepository();
  }

  /**
   * Получение отчета по сотруднику за период
   * @param {number} employeeId - ID сотрудника
   * @param {string} dateFrom - Дата начала периода (YYYY-MM-DD)
   * @param {string} dateTo - Дата окончания периода (YYYY-MM-DD)
   * @returns {Promise<Object>} Отчет по сотруднику
   */
  async getEmployeeReport(employeeId, dateFrom, dateTo) {
    const workLogs = await this.workLogRepo.findByEmployeeId(employeeId, { dateFrom, dateTo });

    // Фильтруем только завершенные записи
    const completedLogs = workLogs.filter(log => log.actual_start && log.actual_end);

    // Группируем по объектам
    const byObject = new Map();
    let totalHours = 0;
    let totalDays = 0;

    for (const log of completedLogs) {
      const hours = calculateWorkHours(log.actual_start, log.actual_end, log.lunch_minutes || 0);
      totalHours += hours;
      
      if (!byObject.has(log.work_object_id)) {
        byObject.set(log.work_object_id, {
          objectId: log.work_object_id,
          objectName: log.object_name || 'Unknown',
          totalHours: 0,
          daysWorked: 0,
          logs: []
        });
      }

      const objStat = byObject.get(log.work_object_id);
      objStat.totalHours += hours;
      objStat.daysWorked += 1;
      objStat.logs.push(log);
      
      // Подсчитываем уникальные дни
      const logDate = new Date(log.date).toISOString().split('T')[0];
      if (!objStat.logs.some(l => new Date(l.date).toISOString().split('T')[0] === logDate)) {
        totalDays += 1;
      }
    }

    // Подсчитываем уникальные дни
    const uniqueDates = new Set();
    completedLogs.forEach(log => {
      const logDate = new Date(log.date).toISOString().split('T')[0];
      uniqueDates.add(logDate);
    });
    totalDays = uniqueDates.size;

    return {
      employeeId,
      totalHours,
      totalDays,
      averageHoursPerDay: totalDays > 0 ? totalHours / totalDays : 0,
      byObject: Array.from(byObject.values())
    };
  }

  /**
   * Получение статистики по часам работы для всех сотрудников объекта за период
   * @param {number} objectId - ID объекта
   * @param {string} dateFrom - Дата начала периода (YYYY-MM-DD)
   * @param {string} dateTo - Дата окончания периода (YYYY-MM-DD)
   * @returns {Promise<Array>} Массив статистики по сотрудникам
   */
  async getObjectEmployeesReport(objectId, dateFrom, dateTo) {
    // Получаем всех сотрудников объекта
    const employees = await this.assignmentRepo.findActiveByObjectId(objectId);

    const reports = [];
    for (const employee of employees) {
      const report = await this.getEmployeeReport(employee.id, dateFrom, dateTo);
      if (report.totalHours > 0) {
        reports.push({
          employeeId: employee.id,
          employeeName: employee.full_name,
          totalHours: report.totalHours,
          daysWorked: report.totalDays,
          averageHoursPerDay: report.averageHoursPerDay
        });
      }
    }

    // Сортируем по количеству часов (больше сначала)
    reports.sort((a, b) => b.totalHours - a.totalHours);

    return reports;
  }

  /**
   * Получение общей статистики по часам работы
   * @param {Array<Object>} reports - Массив отчетов по сотрудникам
   * @returns {Object} Общая статистика
   */
  getOverallStatistics(reports) {
    if (reports.length === 0) {
      return {
        totalHours: 0,
        totalDays: 0,
        averageHoursPerDay: 0,
        averageHoursPerEmployee: 0
      };
    }

    const totalHours = reports.reduce((sum, r) => sum + r.totalHours, 0);
    const totalDays = new Set();
    reports.forEach(r => {
      // Здесь нужно получить уникальные дни из всех отчетов
      // Упрощенная версия - используем daysWorked
    });
    
    const totalUniqueDays = reports.reduce((sum, r) => sum + r.daysWorked, 0);
    const averageHoursPerDay = totalUniqueDays > 0 ? totalHours / totalUniqueDays : 0;
    const averageHoursPerEmployee = reports.length > 0 ? totalHours / reports.length : 0;

    return {
      totalHours,
      totalDays: totalUniqueDays,
      averageHoursPerDay,
      averageHoursPerEmployee,
      employeesCount: reports.length
    };
  }
}

