import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';
import { formatWorkHours } from '../../services/shiftTimeService.js';
import { container } from '../../../infrastructure/di/container.js';

const objectRepo = new ObjectRepository();
const employeeRepo = new EmployeeRepository();

function formatObjectReport(report, dateFrom, dateTo) {
  if (report.length === 0) {
    return `📊 Отчет по объекту\n\nПериод: ${dateFrom} - ${dateTo}\n\nНет данных за указанный период.`;
  }

  let text = `📊 Отчет по объекту\n\n`;
  text += `Период: ${dateFrom} - ${dateTo}\n\n`;
  text += `👥 Статистика по сотрудникам:\n\n`;

  let totalHours = 0;
  report.forEach((stat, index) => {
    text += `${index + 1}. ${stat.employeeName}\n`;
    text += `   Часов: ${formatWorkHours(stat.totalHours)}\n`;
    text += `   Дней: ${stat.daysWorked}\n`;
    text += `   Среднее: ${formatWorkHours(stat.totalHours / stat.daysWorked)}\n\n`;
    totalHours += stat.totalHours;
  });

  text += `\n📈 Итого:\n`;
  text += `   Всего часов: ${formatWorkHours(totalHours)}\n`;
  text += `   Всего дней: ${report.reduce((sum, stat) => sum + stat.daysWorked, 0)}\n`;

  return text;
}

function reportKeyboard(objectId) {
  return keyboard([
    [
      { text: '⬅️ Назад к объекту', cb: `object:details|${objectId}` }
    ]
  ]);
}

registerState(STATES.OBJECT_SHIFT_REPORT, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const objectId = session.data?.currentObjectId;

    if (!objectId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект не выбран', {}, session);
      return;
    }

    try {
      // Получаем manager
      const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
      if (!manager) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: менеджер не найден', {}, session);
        return;
      }

      // Проверяем права доступа к объекту
      const object = await objectRepo.findById(objectId, { 
        managerId: manager.id, 
        isAdmin: manager.role === 'ADMIN' 
      });
      if (!object) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: объект не найден или нет доступа', {}, session);
        return;
      }

      // Используем use case для получения отчета
      const getShiftReportUseCase = await container.getAsync('GetShiftReportUseCase');
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);
      
      const dateFromStr = dateFrom.toISOString().split('T')[0];
      const dateToStr = dateTo.toISOString().split('T')[0];

      const report = await getShiftReportUseCase.execute(objectId, dateFromStr, dateToStr);
      
      // Сортируем по количеству часов (больше сначала)
      report.sort((a, b) => b.totalHours - a.totalHours);

      await MessageService.sendOrEdit(
        ctx,
        formatObjectReport(report, dateFromStr, dateToStr),
        reportKeyboard(objectId),
        session
      );
    } catch (error) {
      console.error('Error fetching report:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке отчета. Попробуйте позже.', {}, session);
    }
  }
});

