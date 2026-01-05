import { registerAction } from '../ui/router.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../../../application/fsm/router.js';
import { DialogService } from '../../../application/services/dialogService.js';
import { SessionRepository } from '../../../infrastructure/repositories/sessionRepository.js';

const sessionRepo = new SessionRepository();
const dialogService = new DialogService({ sessionRepository: sessionRepo });

// manager:menu - возврат в главное меню
registerAction('manager:menu', async (ctx) => {
  const { dialog, session } = ctx.state;

  await dialog.clearState(session);
  const updatedSession = await dialog.setState(session, STATES.MANAGER_MENU);
  ctx.state.session = updatedSession;

  await runState(ctx, 'enter');
});

// manager:objects - список объектов
registerAction('manager:objects', async (ctx) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.setState(session, STATES.MANAGER_OBJECTS_LIST);
  ctx.state.session = updatedSession;

  await runState(ctx, 'enter');
});

// manager:employees - список сотрудников менеджера
registerAction('manager:employees', async (ctx) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.setState(session, STATES.MANAGER_EMPLOYEES_LIST);
  ctx.state.session = updatedSession;

  await runState(ctx, 'enter');
});

// manager:employee:create - создание сотрудника менеджером
registerAction('manager:employee:create', async (ctx) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.setState(session, STATES.MANAGER_EMPLOYEE_CREATE_ENTER_NAME);
  ctx.state.session = updatedSession;

  await runState(ctx, 'enter');
});

// object:create - создание объекта
registerAction('object:create', async (ctx) => {
  const { dialog, session } = ctx.state;

  await dialog.clearState(session);
  const updatedSession = await dialog.setState(session, STATES.OBJECT_CREATE_ENTER_NAME);
  ctx.state.session = updatedSession;

  await runState(ctx, 'enter');
});

// object:details - детали объекта
registerAction('object:details', async (ctx, objectId) => {
  const { dialog, session } = ctx.state;

  // Сохраняем objectId в data
  let updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
  ctx.state.session = updatedSession;

  // Если текущее состояние не MANAGER_OBJECTS_LIST, сначала переходим туда
  // (для правильного перехода через FSM)
  if (session.state !== STATES.MANAGER_OBJECTS_LIST && session.state !== STATES.OBJECT_DETAILS) {
    updatedSession = await dialog.setState(updatedSession, STATES.MANAGER_OBJECTS_LIST, { force: true });
    ctx.state.session = updatedSession;
  }

  // Переходим в состояние деталей объекта
  const finalSession = await dialog.setState(ctx.state.session, STATES.OBJECT_DETAILS);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// object:employees - список сотрудников объекта
registerAction('object:employees', async (ctx, objectId) => {
  const { dialog, session } = ctx.state;

  // Сохраняем objectId в data
  const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
  ctx.state.session = updatedSession;

  // Переходим в состояние списка сотрудников
  const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_EMPLOYEES_LIST);
  ctx.state.session = finalSession;
  
  await runState(ctx, 'enter');
});

// manager:object:employee:onboard - выбор сотрудника для назначения на объект
registerAction('manager:object:employee:onboard', async (ctx, objectId) => {
  const { dialog, session } = ctx.state;

  // Сохраняем objectId в data
  const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
  ctx.state.session = updatedSession;

  // Переходим в состояние выбора сотрудника для назначения
  const finalSession = await dialog.setState(updatedSession, STATES.MANAGER_OBJECT_EMPLOYEE_ONBOARD);
  ctx.state.session = finalSession;
  
  await runState(ctx, 'enter');
});

// manager:object:employee:onboard:confirm - подтверждение назначения сотрудника на объект
registerAction('manager:object:employee:onboard:confirm', async (ctx, payload) => {
  const { AssignmentRepository } = await import('../../../infrastructure/repositories/assignmentRepository.js');
  const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
  const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');
  const { ObjectRepository } = await import('../../../infrastructure/repositories/objectRepository.js');

  const assignmentRepo = new AssignmentRepository();
  const employeeRepo = new EmployeeRepository();
  const auditRepo = new AuditLogRepository();
  const objectRepo = new ObjectRepository();

  const [objectId, employeeId] = payload.split('|');

  // Получаем manager
  const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
  if (!manager) {
    await ctx.answerCbQuery('Ошибка: менеджер не найден');
    return;
  }

  try {
    // Проверяем объект
    const object = await objectRepo.findById(parseInt(objectId, 10), { 
      managerId: manager.id, 
      isAdmin: manager.role === 'ADMIN' 
    });
    if (!object) {
      await ctx.answerCbQuery('Ошибка: объект не найден или нет доступа');
      return;
    }

    // Проверяем сотрудника (должен быть создан этим менеджером)
    const employee = await employeeRepo.findById(parseInt(employeeId, 10));
    if (!employee) {
      await ctx.answerCbQuery('Сотрудник не найден');
      return;
    }

    if (employee.created_by !== manager.id && manager.role !== 'ADMIN') {
      await ctx.answerCbQuery('Ошибка: нет доступа к этому сотруднику');
      return;
    }

    // Назначаем сотрудника на объект
    const assignment = await assignmentRepo.assign({
      employeeId: parseInt(employeeId, 10),
      workObjectId: parseInt(objectId, 10),
      assignedBy: manager.id
    });

    // Логируем в audit
    await auditRepo.log({
      entityType: 'assignments',
      entityId: assignment.id,
      action: 'create',
      changedBy: manager.id,
      metadata: { employeeId: parseInt(employeeId, 10), workObjectId: parseInt(objectId, 10), employeeName: employee.full_name }
    });

    // Возвращаемся к списку сотрудников объекта
    const { dialog, session } = ctx.state;
    const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
    const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_EMPLOYEES_LIST);
    ctx.state.session = finalSession;

    await ctx.answerCbQuery(`✅ Сотрудник ${employee.full_name} назначен на объект`);
    await runState(ctx, 'enter');
  } catch (error) {
    console.error('Error assigning employee to object:', error);
    if (error.message === 'Employee already assigned to this object') {
      await ctx.answerCbQuery('⚠️ Сотрудник уже назначен на этот объект');
    } else {
      await ctx.answerCbQuery('Ошибка при назначении сотрудника');
    }
  }
});

// employee:details - детали сотрудника
registerAction('employee:details', async (ctx, employeeId) => {
  const { dialog, session } = ctx.state;

  // Определяем состояние для возврата (из текущего состояния)
  const currentState = session.state;
  let backCallback = 'manager:employees';
  if (currentState === STATES.OBJECT_EMPLOYEES_LIST) {
    backCallback = `object:employees|${session.data?.currentObjectId}`;
  }

  // Сохраняем employeeId и callback для возврата
  const updatedSession = await dialog.mergeData(session, { 
    currentEmployeeId: parseInt(employeeId, 10),
    backState: currentState,
    backCallback
  });
  ctx.state.session = updatedSession;

  // Переходим в состояние деталей сотрудника
  const finalSession = await dialog.setState(updatedSession, STATES.EMPLOYEE_DETAILS);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// employee:unassign - удаление сотрудника с объекта
registerAction('employee:unassign', async (ctx, payload) => {
  const { AssignmentRepository } = await import('../../../infrastructure/repositories/assignmentRepository.js');
  const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
  const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');
  const { runState } = await import('../../../application/fsm/router.js');

  const assignmentRepo = new AssignmentRepository();
  const employeeRepo = new EmployeeRepository();
  const auditRepo = new AuditLogRepository();
  const { dialog, session } = ctx.state;

  const [employeeId, objectId] = payload.split('|');

  // Получаем текущего пользователя
  const currentUser = await employeeRepo.findByTelegramUserId(ctx.from.id);
  if (!currentUser) {
    await ctx.answerCbQuery('Ошибка: пользователь не найден');
    return;
  }

  try {
    // Удаляем назначение
    await assignmentRepo.unassign({
      employeeId: parseInt(employeeId, 10),
      workObjectId: parseInt(objectId, 10),
      unassignedBy: currentUser.id
    });

    // Логируем в audit
    await auditRepo.log({
      entityType: 'assignments',
      entityId: parseInt(employeeId, 10),
      action: 'unassign',
      changedBy: currentUser.id,
      metadata: { employeeId: parseInt(employeeId, 10), objectId: parseInt(objectId, 10) }
    });

    // Обновляем детали сотрудника
    const updatedSession = await dialog.mergeData(session, { currentEmployeeId: parseInt(employeeId, 10) });
    ctx.state.session = updatedSession;

    const finalSession = await dialog.setState(updatedSession, STATES.EMPLOYEE_DETAILS);
    ctx.state.session = finalSession;

    await ctx.answerCbQuery('✅ Сотрудник удален с объекта');
    await runState(ctx, 'enter');
  } catch (error) {
    console.error('Error unassigning employee:', error);
    await ctx.answerCbQuery('Ошибка при удалении сотрудника с объекта');
  }
});

// object:edit - редактирование объекта
registerAction('object:edit', async (ctx, objectId) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
  ctx.state.session = updatedSession;
  
  const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_EDIT);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// object:edit:schedule - редактирование графика объекта
registerAction('object:edit:schedule', async (ctx, objectId) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
  ctx.state.session = updatedSession;
  
  const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_EDIT_SCHEDULE);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// object:edit:status - изменение статуса объекта
registerAction('object:edit:status', async (ctx, objectId) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
  ctx.state.session = updatedSession;
  
  const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_EDIT_STATUS);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// object:shifts - список смен объекта
registerAction('object:shifts', async (ctx, objectId) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.mergeData(session, { 
    currentObjectId: parseInt(objectId, 10),
    shiftsPage: 0
  });
  ctx.state.session = updatedSession;

  const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_SHIFTS_LIST);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// object:shifts:page - пагинация списка смен
registerAction('object:shifts:page', async (ctx, payload) => {
  const { dialog, session } = ctx.state;
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  const [objectId, page] = payload.split('|');

  const updatedSession = await dialog.mergeData(session, { 
    currentObjectId: parseInt(objectId, 10),
    shiftsPage: parseInt(page, 10)
  });
  ctx.state.session = updatedSession;

  const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_SHIFTS_LIST);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// object:shift:details - детали смены
registerAction('object:shift:details', async (ctx, payload) => {
  const { dialog, session } = ctx.state;
  const [objectId, shiftId] = payload.split('|');

  const updatedSession = await dialog.mergeData(session, { 
    currentObjectId: parseInt(objectId, 10),
    currentShiftId: parseInt(shiftId, 10)
  });
  ctx.state.session = updatedSession;

  const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_SHIFT_DETAILS);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// object:shift:confirm:start - подтверждение начала смены (без отсутствующих)
registerAction('object:shift:confirm:start', async (ctx, payload) => {
  const { ShiftService } = await import('../../../application/services/shiftService.js');
  const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
  const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  const shiftService = new ShiftService();
  const employeeRepo = new EmployeeRepository();
  const auditRepo = new AuditLogRepository();
  const { dialog, session } = ctx.state;

  const [objectId, shiftId] = payload.split('|');

  // Получаем manager
  const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
  if (!manager) {
    await ctx.answerCbQuery('Ошибка: менеджер не найден');
    return;
  }

  try {
    // Подтверждаем начало смены (без отсутствующих)
    const { shift, workLogs } = await shiftService.confirmShiftStart(
      parseInt(shiftId, 10),
      manager.id,
      null,
      [] // нет отсутствующих
    );

    // Логируем в audit
    await auditRepo.log({
      entityType: 'object_shifts',
      entityId: parseInt(shiftId, 10),
      action: 'update',
      changedBy: manager.id,
      metadata: { field: 'status', oldValue: 'planned', newValue: 'started', workLogsCount: workLogs.length }
    });

    // Возвращаемся к деталям смены
    const updatedSession = await dialog.mergeData(session, { 
      currentObjectId: parseInt(objectId, 10),
      currentShiftId: parseInt(shiftId, 10)
    });
    const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_SHIFT_DETAILS);
    ctx.state.session = finalSession;

    await ctx.answerCbQuery(`✅ Смена начата. Создано ${workLogs.length} записей о работе.`);
    await runState(ctx, 'enter');
  } catch (error) {
    console.error('Error confirming shift start:', error);
    await ctx.answerCbQuery('Ошибка при подтверждении начала смены');
  }
});

// shift:start:mark:absent - отметить отсутствующих при начале смены
registerAction('shift:start:mark:absent', async (ctx, payload) => {
  const { dialog, session } = ctx.state;
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  const [objectId, shiftId] = payload.split('|');

  const updatedSession = await dialog.mergeData(session, { 
    currentObjectId: parseInt(objectId, 10),
    currentShiftId: parseInt(shiftId, 10)
  });
  ctx.state.session = updatedSession;

  const finalSession = await dialog.setState(updatedSession, STATES.SHIFT_START_MARK_ABSENT);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// shift:start:continue - продолжить без отсутствующих
registerAction('shift:start:continue', async (ctx, payload) => {
  const { ShiftService } = await import('../../../application/services/shiftService.js');
  const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
  const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  const shiftService = new ShiftService();
  const employeeRepo = new EmployeeRepository();
  const auditRepo = new AuditLogRepository();
  const { dialog, session } = ctx.state;

  const [objectId, shiftId] = payload.split('|');

  const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
  if (!manager) {
    await ctx.answerCbQuery('Ошибка: менеджер не найден');
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

    const message = workLogs.length > 0 
      ? `✅ Смена начата. Создано ${workLogs.length} записей о работе.`
      : `✅ Смена начата. Нет сотрудников в смене.`;
    
    await ctx.answerCbQuery(message);
    await runState(ctx, 'enter');
  } catch (error) {
    console.error('Error confirming shift start:', error);
    await ctx.answerCbQuery('Ошибка при подтверждении начала смены');
  }
});

// shift:start:mark:absent:employee - отметить конкретного сотрудника как отсутствующего
registerAction('shift:start:mark:absent:employee', async (ctx, payload) => {
  const { dialog, session } = ctx.state;
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  const [objectId, shiftId, employeeId] = payload.split('|');

  // Добавляем сотрудника в список отсутствующих
  const currentAbsent = session.data?.absentEmployeeIds || [];
  if (!currentAbsent.includes(parseInt(employeeId, 10))) {
    currentAbsent.push(parseInt(employeeId, 10));
  }

  const updatedSession = await dialog.mergeData(session, { 
    currentObjectId: parseInt(objectId, 10),
    currentShiftId: parseInt(shiftId, 10),
    absentEmployeeIds: currentAbsent
  });
  ctx.state.session = updatedSession;

  // Возвращаемся к состоянию отметки отсутствующих
  const finalSession = await dialog.setState(updatedSession, STATES.SHIFT_START_MARK_ABSENT);
  ctx.state.session = finalSession;

  await ctx.answerCbQuery(`✅ Сотрудник отмечен как отсутствующий`);
  await runState(ctx, 'enter');
});

// shift:add:employee - добавить сотрудника в смену
registerAction('shift:add:employee', async (ctx, payload) => {
  const { dialog, session } = ctx.state;
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  const [objectId, shiftId] = payload.split('|');

  const updatedSession = await dialog.mergeData(session, { 
    currentObjectId: parseInt(objectId, 10),
    currentShiftId: parseInt(shiftId, 10)
  });
  ctx.state.session = updatedSession;

  const finalSession = await dialog.setState(updatedSession, STATES.SHIFT_ADD_EMPLOYEE);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// shift:add:employee:confirm - подтверждение добавления сотрудника в смену
registerAction('shift:add:employee:confirm', async (ctx, payload) => {
  const { ShiftService } = await import('../../../application/services/shiftService.js');
  const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
  const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  const shiftService = new ShiftService();
  const employeeRepo = new EmployeeRepository();
  const auditRepo = new AuditLogRepository();
  const { dialog, session } = ctx.state;

  const [objectId, shiftId, employeeId] = payload.split('|');

  const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
  if (!manager) {
    await ctx.answerCbQuery('Ошибка: менеджер не найден');
    return;
  }

  try {
    const workLog = await shiftService.addEmployeeToShift(
      parseInt(shiftId, 10),
      parseInt(employeeId, 10),
      manager.id
    );

    const employee = await employeeRepo.findById(parseInt(employeeId, 10));

    await auditRepo.log({
      entityType: 'work_logs',
      entityId: workLog.id,
      action: 'create',
      changedBy: manager.id,
      metadata: { 
        type: 'added_to_shift',
        employeeId: parseInt(employeeId, 10),
        shiftId: parseInt(shiftId, 10),
        employeeName: employee?.full_name
      }
    });

    const updatedSession = await dialog.mergeData(session, { 
      currentObjectId: parseInt(objectId, 10),
      currentShiftId: parseInt(shiftId, 10)
    });
    const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_SHIFT_DETAILS);
    ctx.state.session = finalSession;

    await ctx.answerCbQuery(`✅ Сотрудник ${employee?.full_name || 'добавлен'} добавлен в смену`);
    await runState(ctx, 'enter');
  } catch (error) {
    console.error('Error adding employee to shift:', error);
    if (error.message === 'Employee already has work log for this shift') {
      await ctx.answerCbQuery('⚠️ Сотрудник уже в смене');
    } else {
      await ctx.answerCbQuery('Ошибка при добавлении сотрудника');
    }
  }
});

// shift:remove:employee - удалить сотрудника из смены (ранний уход)
registerAction('shift:remove:employee', async (ctx, payload) => {
  const { ShiftService } = await import('../../../application/services/shiftService.js');
  const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
  const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');
  const { WorkLogRepository } = await import('../../../infrastructure/repositories/workLogRepository.js');
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  const shiftService = new ShiftService();
  const employeeRepo = new EmployeeRepository();
  const auditRepo = new AuditLogRepository();
  const workLogRepo = new WorkLogRepository();
  const { dialog, session } = ctx.state;

  const [objectId, shiftId, workLogId] = payload.split('|');

  const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
  if (!manager) {
    await ctx.answerCbQuery('Ошибка: менеджер не найден');
    return;
  }

  try {
    const workLog = await shiftService.removeEmployeeFromShift(
      parseInt(workLogId, 10),
      manager.id
    );

    await auditRepo.log({
      entityType: 'work_logs',
      entityId: parseInt(workLogId, 10),
      action: 'update',
      changedBy: manager.id,
      metadata: { 
        field: 'actual_end',
        type: 'early_leave',
        shiftId: parseInt(shiftId, 10)
      }
    });

    const updatedSession = await dialog.mergeData(session, { 
      currentObjectId: parseInt(objectId, 10),
      currentShiftId: parseInt(shiftId, 10)
    });
    const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_SHIFT_DETAILS);
    ctx.state.session = finalSession;

    await ctx.answerCbQuery(`✅ Работа сотрудника завершена`);
    await runState(ctx, 'enter');
  } catch (error) {
    console.error('Error removing employee from shift:', error);
    await ctx.answerCbQuery('Ошибка при завершении работы сотрудника');
  }
});

// object:shift:confirm:end - подтверждение окончания смены
registerAction('object:shift:confirm:end', async (ctx, payload) => {
  const { ShiftService } = await import('../../../application/services/shiftService.js');
  const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
  const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  const shiftService = new ShiftService();
  const employeeRepo = new EmployeeRepository();
  const auditRepo = new AuditLogRepository();
  const { dialog, session } = ctx.state;

  const [objectId, shiftId] = payload.split('|');

  // Получаем manager
  const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
  if (!manager) {
    await ctx.answerCbQuery('Ошибка: менеджер не найден');
    return;
  }

  try {
    // Подтверждаем окончание смены
    const { shift, workLogs } = await shiftService.confirmShiftEnd(
      parseInt(shiftId, 10),
      manager.id
    );

    // Логируем в audit
    await auditRepo.log({
      entityType: 'object_shifts',
      entityId: parseInt(shiftId, 10),
      action: 'update',
      changedBy: manager.id,
      metadata: { field: 'status', oldValue: 'started', newValue: 'closed', workLogsCount: workLogs.length }
    });

    // Возвращаемся к деталям смены
    const updatedSession = await dialog.mergeData(session, { 
      currentObjectId: parseInt(objectId, 10),
      currentShiftId: parseInt(shiftId, 10)
    });
    const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_SHIFT_DETAILS);
    ctx.state.session = finalSession;

    await ctx.answerCbQuery(`✅ Смена завершена. Обновлено ${workLogs.length} записей о работе.`);
    await runState(ctx, 'enter');
  } catch (error) {
    console.error('Error confirming shift end:', error);
    await ctx.answerCbQuery('Ошибка при подтверждении окончания смены');
  }
});

// object:reports - отчеты по объекту
registerAction('object:reports', async (ctx, objectId) => {
  const { dialog, session } = ctx.state;
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
  ctx.state.session = updatedSession;

  const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_SHIFT_REPORT);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// object:shift:create - создание смены
registerAction('object:shift:create', async (ctx, objectId) => {
  const { ShiftService } = await import('../../../application/services/shiftService.js');
  const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
  const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  const shiftService = new ShiftService();
  const employeeRepo = new EmployeeRepository();
  const auditRepo = new AuditLogRepository();
  const { dialog, session } = ctx.state;

  // Получаем manager
  const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
  if (!manager) {
    await ctx.answerCbQuery('Ошибка: менеджер не найден');
    return;
  }

  try {
    // Создаем смену на сегодня
    const today = new Date().toISOString().split('T')[0];
    const shift = await shiftService.createShiftForDate(parseInt(objectId, 10), today);

    if (!shift) {
      await ctx.answerCbQuery('⚠️ Смена на сегодня уже существует');
      // Возвращаемся к списку смен
      const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
      const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_SHIFTS_LIST);
      ctx.state.session = finalSession;
      await runState(ctx, 'enter');
      return;
    }

    // Логируем в audit
    await auditRepo.log({
      entityType: 'object_shifts',
      entityId: shift.id,
      action: 'create',
      changedBy: manager.id,
      metadata: { date: today, objectId: parseInt(objectId, 10) }
    });

    // Возвращаемся к списку смен
    const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
    const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_SHIFTS_LIST);
    ctx.state.session = finalSession;

    await ctx.answerCbQuery('✅ Смена создана');
    await runState(ctx, 'enter');
  } catch (error) {
    console.error('Error creating shift:', error);
    await ctx.answerCbQuery(`Ошибка при создании смены: ${error.message}`);
  }
});

// object:employee:worklogs - записи о работе сотрудника на объекте
registerAction('object:employee:worklogs', async (ctx, payload) => {
  const { dialog, session } = ctx.state;
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  const [objectId, employeeId] = payload.split('|');

  const updatedSession = await dialog.mergeData(session, { 
    currentObjectId: parseInt(objectId, 10),
    currentEmployeeId: parseInt(employeeId, 10)
  });
  ctx.state.session = updatedSession;

  const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_EMPLOYEE_WORK_LOGS);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// object:edit:status:confirm - подтверждение изменения статуса
registerAction('object:edit:status:confirm', async (ctx, payload) => {
  const { dialog, session } = ctx.state;
  const [objectId, newStatus] = payload.split('|');

  const { ObjectRepository } = await import('../../../infrastructure/repositories/objectRepository.js');
  const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
  const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');

  const objectRepo = new ObjectRepository();
  const employeeRepo = new EmployeeRepository();
  const auditRepo = new AuditLogRepository();

  // Получаем manager
  const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
  if (!manager) {
    await ctx.answerCbQuery('Ошибка: менеджер не найден');
    return;
  }

  try {
    // Обновляем статус объекта
    const updatedObject = await objectRepo.update(
      parseInt(objectId, 10),
      { status: newStatus },
      {
        managerId: manager.id,
        isAdmin: manager.role === 'ADMIN'
      }
    );

    // Логируем в audit
    await auditRepo.log({
      entityType: 'work_objects',
      entityId: parseInt(objectId, 10),
      action: 'update',
      changedBy: manager.id,
      metadata: { status: newStatus, field: 'status' }
    });

    // Возвращаемся к деталям объекта
    const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
    const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_DETAILS);
    ctx.state.session = finalSession;

    const statusText = newStatus === 'ACTIVE' ? 'Активен' : 'Архивирован';
    await ctx.answerCbQuery(`✅ Статус изменен на "${statusText}"`);
    await runState(ctx, 'enter');
  } catch (error) {
    console.error('Error updating object status:', error);
    await ctx.answerCbQuery('Ошибка при изменении статуса');
  }
});

