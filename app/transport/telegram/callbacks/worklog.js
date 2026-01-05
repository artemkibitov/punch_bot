import { handlers } from '../ui/router.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../../../application/fsm/router.js';

// worklog:details - детали work_log
handlers.set('worklog:details', async (ctx, workLogId) => {
  const { dialog, session } = ctx.state;
  const { WorkLogRepository } = await import('../../../infrastructure/repositories/workLogRepository.js');
  
  const workLogRepo = new WorkLogRepository();
  
  // Получаем work_log чтобы узнать objectId и shiftId
  const workLog = await workLogRepo.findById(parseInt(workLogId, 10));
  
  if (workLog) {
    // Сохраняем текущие objectId и shiftId для возврата
    const updatedSession = await dialog.mergeData(session, { 
      currentWorkLogId: parseInt(workLogId, 10),
      currentObjectId: workLog.work_object_id,
      currentShiftId: workLog.object_shift_id
    });
    ctx.state.session = updatedSession;
  } else {
    const updatedSession = await dialog.mergeData(session, { currentWorkLogId: parseInt(workLogId, 10) });
    ctx.state.session = updatedSession;
  }

  const finalSession = await dialog.setState(ctx.state.session, STATES.WORK_LOG_DETAILS);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// worklog:edit - редактирование work_log
handlers.set('worklog:edit', async (ctx, workLogId) => {
  const { dialog, session } = ctx.state;

  const updatedSession = await dialog.mergeData(session, { currentWorkLogId: parseInt(workLogId, 10) });
  ctx.state.session = updatedSession;

  const finalSession = await dialog.setState(updatedSession, STATES.WORK_LOG_EDIT);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// worklog:create - создание новой корректировки времени
handlers.set('worklog:create', async (ctx, payload) => {
  const { dialog, session } = ctx.state;
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  const [employeeId, objectId] = payload.split('|');

  const updatedSession = await dialog.mergeData(session, { 
    currentObjectId: parseInt(objectId, 10),
    currentEmployeeId: parseInt(employeeId, 10)
  });
  ctx.state.session = updatedSession;

  const finalSession = await dialog.setState(updatedSession, STATES.WORK_LOG_CREATE);
  ctx.state.session = finalSession;

  await runState(ctx, 'enter');
});

// worklog:back - возврат назад (используется в workLogDetails)
handlers.set('worklog:back', async (ctx) => {
  const { dialog, session } = ctx.state;
  const { runState } = await import('../../../application/fsm/router.js');
  const { STATES } = await import('../../../domain/fsm/states.js');

  // Возвращаемся к предыдущему состоянию
  const objectId = session.data?.currentObjectId;
  const shiftId = session.data?.currentShiftId;
  const employeeId = session.data?.currentEmployeeId;

  if (shiftId && objectId) {
    // Возвращаемся к деталям смены
    const updatedSession = await dialog.mergeData(session, { 
      currentObjectId: objectId,
      currentShiftId: shiftId
    });
    ctx.state.session = updatedSession;

    const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_SHIFT_DETAILS);
    ctx.state.session = finalSession;

    await runState(ctx, 'enter');
  } else if (objectId && employeeId) {
    // Возвращаемся к записям о работе сотрудника
    const updatedSession = await dialog.mergeData(session, { 
      currentObjectId: objectId,
      currentEmployeeId: employeeId
    });
    ctx.state.session = updatedSession;

    const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_EMPLOYEE_WORK_LOGS);
    ctx.state.session = finalSession;

    await runState(ctx, 'enter');
  } else {
    // Возвращаемся к списку объектов
    const finalSession = await dialog.setState(session, STATES.MANAGER_OBJECTS_LIST);
    ctx.state.session = finalSession;

    await runState(ctx, 'enter');
  }
});

