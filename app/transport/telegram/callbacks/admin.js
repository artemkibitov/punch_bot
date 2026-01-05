import { registerAction } from '../ui/router.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../../../application/fsm/router.js';

// admin:menu - возврат в админ меню
registerAction('admin:menu', async (ctx) => {
  const { dialog, session } = ctx.state;

  await dialog.clearState(session);
  const updatedSession = await dialog.setState(session, STATES.ADMIN_MENU);
  ctx.state.session = updatedSession;

  await runState(ctx, 'enter');
});

// admin:objects - список всех объектов
registerAction('admin:objects', async (ctx) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.setState(session, STATES.ADMIN_OBJECTS_LIST);
  ctx.state.session = updatedSession;

  await runState(ctx, 'enter');
});

// admin:employees - список всех сотрудников
registerAction('admin:employees', async (ctx) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.setState(session, STATES.ADMIN_EMPLOYEES_LIST);
  ctx.state.session = updatedSession;

  await runState(ctx, 'enter');
});

// admin:object:details - детали объекта
registerAction('admin:object:details', async (ctx, objectId) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
  ctx.state.session = updatedSession;
  
  const finalSession = await dialog.setState(updatedSession, STATES.ADMIN_OBJECT_DETAILS);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// admin:object:delete - удаление объекта (архивация)
registerAction('admin:object:delete', async (ctx, objectId) => {
  const { ObjectRepository } = await import('../../../infrastructure/repositories/objectRepository.js');
  const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
  const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');

  const objectRepo = new ObjectRepository();
  const employeeRepo = new EmployeeRepository();
  const auditRepo = new AuditLogRepository();

  // Получаем admin
  const admin = await employeeRepo.findByTelegramUserId(ctx.from.id);
  if (!admin || admin.role !== 'ADMIN') {
    await ctx.answerCbQuery('Доступ запрещен');
    return;
  }

  try {
    // Архивируем объект
    await objectRepo.delete(parseInt(objectId, 10), { adminId: admin.id });

    // Логируем в audit
    await auditRepo.log({
      entityType: 'work_objects',
      entityId: parseInt(objectId, 10),
      action: 'delete',
      changedBy: admin.id,
      metadata: { field: 'status', oldValue: 'ACTIVE', newValue: 'ARCHIVED' }
    });

    // Возвращаемся к списку объектов
    const { dialog, session } = ctx.state;
    const updatedSession = await dialog.setState(session, STATES.ADMIN_OBJECTS_LIST);
    ctx.state.session = updatedSession;

    await ctx.answerCbQuery('✅ Объект удален');
    await runState(ctx, 'enter');
  } catch (error) {
    console.error('Error deleting object:', error);
    await ctx.answerCbQuery('Ошибка при удалении объекта');
  }
});

// admin:object:reassign - перезакрепление объекта за менеджером
registerAction('admin:object:reassign', async (ctx, objectId) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
  ctx.state.session = updatedSession;
  
  const finalSession = await dialog.setState(updatedSession, STATES.ADMIN_OBJECT_REASSIGN);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// admin:object:reassign:confirm - подтверждение перезакрепления
registerAction('admin:object:reassign:confirm', async (ctx, payload) => {
  const { ObjectRepository } = await import('../../../infrastructure/repositories/objectRepository.js');
  const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
  const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');

  const objectRepo = new ObjectRepository();
  const employeeRepo = new EmployeeRepository();
  const auditRepo = new AuditLogRepository();

  const [objectId, newManagerId] = payload.split('|');

  // Получаем admin
  const admin = await employeeRepo.findByTelegramUserId(ctx.from.id);
  if (!admin || admin.role !== 'ADMIN') {
    await ctx.answerCbQuery('Доступ запрещен');
    return;
  }

  try {
    // Получаем объект для проверки старого менеджера
    const object = await objectRepo.findById(parseInt(objectId, 10), { isAdmin: true });
    if (!object) {
      await ctx.answerCbQuery('Объект не найден');
      return;
    }

    const oldManagerId = object.manager_id;

    // Перезакрепляем объект
    await objectRepo.reassignManager(parseInt(objectId, 10), parseInt(newManagerId, 10), { adminId: admin.id });

    // Логируем в audit
    await auditRepo.log({
      entityType: 'work_objects',
      entityId: parseInt(objectId, 10),
      action: 'update',
      changedBy: admin.id,
      metadata: { field: 'manager_id', oldValue: oldManagerId, newValue: parseInt(newManagerId, 10) }
    });

    // Возвращаемся к деталям объекта
    const { dialog, session } = ctx.state;
    const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
    const finalSession = await dialog.setState(updatedSession, STATES.ADMIN_OBJECT_DETAILS);
    ctx.state.session = finalSession;

    await ctx.answerCbQuery('✅ Объект перезакреплен');
    await runState(ctx, 'enter');
  } catch (error) {
    console.error('Error reassigning object:', error);
    await ctx.answerCbQuery('Ошибка при перезакреплении объекта');
  }
});

// admin:object:employees - список сотрудников объекта
registerAction('admin:object:employees', async (ctx, objectId) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
  ctx.state.session = updatedSession;
  
  const finalSession = await dialog.setState(updatedSession, STATES.ADMIN_OBJECT_EMPLOYEES_LIST);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// admin:object:employee:onboard - выбор сотрудника для назначения на объект
registerAction('admin:object:employee:onboard', async (ctx, objectId) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
  ctx.state.session = updatedSession;
  
  const finalSession = await dialog.setState(updatedSession, STATES.ADMIN_OBJECT_EMPLOYEE_ONBOARD);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// admin:object:employee:onboard:confirm - подтверждение назначения сотрудника на объект
registerAction('admin:object:employee:onboard:confirm', async (ctx, payload) => {
  const { AssignmentRepository } = await import('../../../infrastructure/repositories/assignmentRepository.js');
  const { EmployeeRepository } = await import('../../../infrastructure/repositories/employeeRepository.js');
  const { AuditLogRepository } = await import('../../../infrastructure/repositories/auditLogRepository.js');
  const { ObjectRepository } = await import('../../../infrastructure/repositories/objectRepository.js');

  const assignmentRepo = new AssignmentRepository();
  const employeeRepo = new EmployeeRepository();
  const auditRepo = new AuditLogRepository();
  const objectRepo = new ObjectRepository();

  const [objectId, employeeId] = payload.split('|');

  // Получаем admin
  const admin = await employeeRepo.findByTelegramUserId(ctx.from.id);
  if (!admin || admin.role !== 'ADMIN') {
    await ctx.answerCbQuery('Доступ запрещен');
    return;
  }

  try {
    // Проверяем объект
    const object = await objectRepo.findById(parseInt(objectId, 10), { isAdmin: true });
    if (!object) {
      await ctx.answerCbQuery('Объект не найден');
      return;
    }

    // Проверяем сотрудника
    const employee = await employeeRepo.findById(parseInt(employeeId, 10));
    if (!employee) {
      await ctx.answerCbQuery('Сотрудник не найден');
      return;
    }

    // Назначаем сотрудника на объект
    const assignment = await assignmentRepo.assign({
      employeeId: parseInt(employeeId, 10),
      workObjectId: parseInt(objectId, 10),
      assignedBy: admin.id
    });

    // Логируем в audit
    await auditRepo.log({
      entityType: 'assignments',
      entityId: assignment.id,
      action: 'create',
      changedBy: admin.id,
      metadata: { employeeId: parseInt(employeeId, 10), workObjectId: parseInt(objectId, 10), employeeName: employee.full_name }
    });

    // Возвращаемся к списку сотрудников объекта
    const { dialog, session } = ctx.state;
    const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
    const finalSession = await dialog.setState(updatedSession, STATES.ADMIN_OBJECT_EMPLOYEES_LIST);
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

// admin:employee:details - детали сотрудника
registerAction('admin:employee:details', async (ctx, employeeId) => {
  const { dialog, session } = ctx.state;

  // Определяем состояние для возврата (из текущего состояния)
  const currentState = session.state;
  let backCallback = 'admin:employees';
  if (currentState === STATES.ADMIN_EMPLOYEES_LIST) {
    backCallback = 'admin:employees';
  } else if (currentState === STATES.ADMIN_OBJECT_EMPLOYEES_LIST) {
    const objectId = session.data?.currentObjectId;
    backCallback = objectId ? `admin:object:employees|${objectId}` : 'admin:employees';
  }

  // Сохраняем employeeId и callback для возврата
  const updatedSession = await dialog.mergeData(session, { 
    currentEmployeeId: parseInt(employeeId, 10),
    backState: currentState,
    backCallback
  });
  ctx.state.session = updatedSession;

  // Переходим в состояние деталей сотрудника (используем общее состояние EMPLOYEE_DETAILS)
  const finalSession = await dialog.setState(updatedSession, STATES.EMPLOYEE_DETAILS);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

