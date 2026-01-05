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

