import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { AssignmentRepository } from '../../../infrastructure/repositories/assignmentRepository.js';
import { ObjectRepository } from '../../../infrastructure/repositories/objectRepository.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { keyboard } from '../../../transport/telegram/ui/keyboard.js';
import { MessageService } from '../../services/messageService.js';

const assignmentRepo = new AssignmentRepository();
const objectRepo = new ObjectRepository();
const employeeRepo = new EmployeeRepository();

function formatEmployeesListForAbsent(employees, absentIds = []) {
  let text = '👥 Сотрудники объекта:\n\n';
  text += 'Введите ID отсутствующих сотрудников через пробел.\n';
  text += 'Например: 1 3 5\n\n';
  text += 'Список сотрудников:\n\n';
  
  employees.forEach((emp) => {
    const isAbsent = absentIds.includes(emp.id);
    text += `${emp.id}. ${emp.full_name}${isAbsent ? ' ❌ (отсутствует)' : ''}\n`;
  });
  
  if (absentIds.length > 0) {
    text += `\n✅ Отмечено отсутствующих: ${absentIds.length}\n`;
  }
  
  text += '\nИли отправьте "пропустить" чтобы не отмечать отсутствующих.';
  text += '\nИли отправьте "готово" чтобы начать смену с отмеченными отсутствующими.';

  return text;
}

function employeesAbsentKeyboard(employees, objectId, shiftId) {
  const rows = [];

  // Показываем кнопки для каждого сотрудника (быстрый выбор)
  employees.forEach((emp) => {
    rows.push([
      { text: `❌ ${emp.full_name}`, cb: `shift:start:mark:absent:employee|${objectId}|${shiftId}|${emp.id}` }
    ]);
  });

  rows.push([
    { text: '✅ Продолжить без отсутствующих', cb: `shift:start:continue|${objectId}|${shiftId}` }
  ]);

  rows.push([
    { text: '⬅️ Назад', cb: `object:shift:details|${objectId}|${shiftId}` }
  ]);

  return keyboard(rows);
}

registerState(STATES.SHIFT_START_MARK_ABSENT, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    const objectId = session.data?.currentObjectId;
    const shiftId = session.data?.currentShiftId;

    if (!objectId || !shiftId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект или смена не выбраны', {}, session);
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

      // Получаем всех активных сотрудников объекта
      const employees = await assignmentRepo.findActiveByObjectId(objectId);
      
      // Получаем список уже отмеченных отсутствующих
      const absentIds = session.data?.absentEmployeeIds || [];

      await MessageService.sendOrEdit(
        ctx,
        formatEmployeesListForAbsent(employees, absentIds),
        employeesAbsentKeyboard(employees, objectId, shiftId),
        session
      );
    } catch (error) {
      console.error('Error in shift start mark absent:', error);
      await MessageService.sendOrEdit(ctx, 'Ошибка при загрузке сотрудников. Попробуйте позже.', {}, session);
    }
  },

  async onMessage(ctx) {
    const { session } = ctx.state;
    const { runState } = await import('../router.js');
    const { ShiftService } = await import('../../services/shiftService.js');
    const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
    const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');
    const { STATES } = await import('../../../domain/fsm/states.js');
    const { dialog } = ctx.state;

    const shiftService = new ShiftService();
    const employeeRepo = new EmployeeRepository();
    const auditRepo = new AuditLogRepository();

    const text = ctx.message?.text?.trim();

    if (!text) {
      await MessageService.sendOrEdit(ctx, 'Пожалуйста, введите ID сотрудников через пробел или "пропустить".', {}, session);
      return;
    }

    // Проверка на готово (начать смену с отмеченными отсутствующими)
    if (text.toLowerCase() === 'готово' || text.toLowerCase() === 'done') {
      const objectId = session.data?.currentObjectId;
      const shiftId = session.data?.currentShiftId;
      const absentIds = session.data?.absentEmployeeIds || [];

      const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
      if (!manager) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: менеджер не найден', {}, session);
        return;
      }

      try {
        const { shift, workLogs } = await shiftService.confirmShiftStartWithAbsent(
          parseInt(shiftId, 10),
          manager.id,
          absentIds
        );

        await auditRepo.log({
          entityType: 'object_shifts',
          entityId: parseInt(shiftId, 10),
          action: 'update',
          changedBy: manager.id,
          metadata: { 
            field: 'status', 
            oldValue: 'planned', 
            newValue: 'started', 
            workLogsCount: workLogs.length,
            absentEmployeeIds: absentIds
          }
        });

        const updatedSession = await dialog.mergeData(session, { 
          currentObjectId: parseInt(objectId, 10),
          currentShiftId: parseInt(shiftId, 10)
        });
        const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_SHIFT_DETAILS);
        ctx.state.session = finalSession;

        const message = workLogs.length > 0
          ? `✅ Смена начата. Создано ${workLogs.length} записей о работе. Отсутствующих: ${absentIds.length}.`
          : `✅ Смена начата. Все сотрудники отсутствуют. Вы можете добавить их позже.`;
        
        await MessageService.sendOrEdit(
          ctx,
          message,
          {},
          session
        );

        await runState(ctx, 'enter');
      } catch (error) {
        console.error('Error confirming shift start with absent:', error);
        await MessageService.sendOrEdit(ctx, 'Ошибка при подтверждении начала смены', {}, session);
      }
      return;
    }

    // Проверка на пропуск
    if (text.toLowerCase() === 'пропустить' || text.toLowerCase() === 'skip') {
      const objectId = session.data?.currentObjectId;
      const shiftId = session.data?.currentShiftId;

      // Продолжаем без отсутствующих
      const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
      if (!manager) {
        await MessageService.sendOrEdit(ctx, 'Ошибка: менеджер не найден', {}, session);
        return;
      }

      try {
        const { shift, workLogs } = await shiftService.confirmShiftStart(
          parseInt(shiftId, 10),
          manager.id
        );

        await auditRepo.log({
          entityType: 'object_shifts',
          entityId: parseInt(shiftId, 10),
          action: 'update',
          changedBy: manager.id,
          metadata: { field: 'status', oldValue: 'planned', newValue: 'started', workLogsCount: workLogs.length }
        });

        const updatedSession = await dialog.mergeData(session, { 
          currentObjectId: parseInt(objectId, 10),
          currentShiftId: parseInt(shiftId, 10)
        });
        const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_SHIFT_DETAILS);
        ctx.state.session = finalSession;

        await MessageService.sendOrEdit(
          ctx,
          `✅ Смена начата. Создано ${workLogs.length} записей о работе.`,
          {},
          session
        );

        await runState(ctx, 'enter');
      } catch (error) {
        console.error('Error confirming shift start:', error);
        await MessageService.sendOrEdit(ctx, 'Ошибка при подтверждении начала смены', {}, session);
      }
      return;
    }

    // Парсим ID отсутствующих и добавляем к существующим
    const newAbsentIds = text.split(/\s+/).map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    if (newAbsentIds.length === 0) {
      await MessageService.sendOrEdit(ctx, 'Неверный формат. Введите ID сотрудников через пробел (например: 1 3 5), "готово" или "пропустить".', {}, session);
      return;
    }

    const objectId = session.data?.currentObjectId;
    const shiftId = session.data?.currentShiftId;
    const currentAbsent = session.data?.absentEmployeeIds || [];
    
    // Объединяем новые и существующие ID
    const allAbsentIds = [...new Set([...currentAbsent, ...newAbsentIds])];

    // Сохраняем обновленный список отсутствующих
    const updatedSession = await dialog.mergeData(session, { 
      currentObjectId: parseInt(objectId, 10),
      currentShiftId: parseInt(shiftId, 10),
      absentEmployeeIds: allAbsentIds
    });
    ctx.state.session = updatedSession;

    // Возвращаемся к состоянию для показа обновленного списка
    const finalSession = await dialog.setState(updatedSession, STATES.SHIFT_START_MARK_ABSENT);
    ctx.state.session = finalSession;

    await MessageService.sendOrEdit(
      ctx,
      `✅ Добавлено ${newAbsentIds.length} отсутствующих. Всего: ${allAbsentIds.length}. Введите "готово" чтобы начать смену.`,
      {},
      session
    );

    await runState(ctx, 'enter');
  }
});

