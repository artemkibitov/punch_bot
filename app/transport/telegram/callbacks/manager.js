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

// employee:create - создание сотрудника
registerAction('employee:create', async (ctx, objectId) => {
  const { dialog, session } = ctx.state;

  // Сохраняем objectId в data
  const updatedSession = await dialog.mergeData(session, { currentObjectId: parseInt(objectId, 10) });
  ctx.state.session = updatedSession;

  // Переходим в состояние создания сотрудника
  const finalSession = await dialog.setState(updatedSession, STATES.EMPLOYEE_CREATE_ENTER_NAME);
  ctx.state.session = finalSession;
  
  await runState(ctx, 'enter');
});

// employee:details - детали сотрудника
registerAction('employee:details', async (ctx, employeeId) => {
  // TODO: создать состояние EMPLOYEE_DETAILS
  await ctx.answerCbQuery('Детали сотрудника (в разработке)');
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

