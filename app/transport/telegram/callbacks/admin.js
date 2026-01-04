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
  // TODO: создать состояние ADMIN_OBJECT_REASSIGN для выбора менеджера
  await ctx.answerCbQuery('Перезакрепление объекта (в разработке)');
});

// admin:object:employees - список сотрудников объекта
registerAction('admin:object:employees', async (ctx, objectId) => {
  // TODO: создать состояние ADMIN_OBJECT_EMPLOYEES_LIST
  await ctx.answerCbQuery('Сотрудники объекта (в разработке)');
});

// admin:employee:details - детали сотрудника
registerAction('admin:employee:details', async (ctx, employeeId) => {
  // TODO: создать состояние ADMIN_EMPLOYEE_DETAILS
  await ctx.answerCbQuery('Детали сотрудника (в разработке)');
});

