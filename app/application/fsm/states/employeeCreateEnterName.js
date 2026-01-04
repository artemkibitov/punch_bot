import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../router.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { AssignmentRepository } from '../../../infrastructure/repositories/assignmentRepository.js';
import { AuditLogRepository } from '../../../infrastructure/repositories/auditLogRepository.js';
import { MessageService } from '../../services/messageService.js';

const employeeRepo = new EmployeeRepository();
const assignmentRepo = new AssignmentRepository();
const auditRepo = new AuditLogRepository();

function requiredText(text) {
  if (!text || !text.trim()) {
    return 'Введите непустой текст';
  }
}

function maxLength(max) {
  return (text) => {
    if (text.length > max) {
      return `Максимум ${max} символов`;
    }
  };
}

function runValidators(text, validators = []) {
  for (const v of validators) {
    const error = v(text);
    if (error) return error;
  }
}

registerState(STATES.EMPLOYEE_CREATE_ENTER_NAME, {
  async onEnter(ctx) {
    const { session } = ctx.state;
    await MessageService.sendOrEdit(ctx, 'Введите имя и фамилию сотрудника:', {}, session);
  },

  async onInput(ctx) {
    const text = ctx.message.text;

    const error = runValidators(text, [
      requiredText,
      maxLength(100)
    ]);

    const { dialog, session } = ctx.state;

    if (error) {
      await MessageService.sendOrEdit(ctx, error, {}, session);
      return;
    }
    const fullName = text.trim();
    const objectId = session.data?.currentObjectId;


    if (!objectId) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: объект не выбран', {}, session);
      return;
    }

    // Получаем manager
    const manager = await employeeRepo.findByTelegramUserId(ctx.from.id);
    if (!manager) {
      await MessageService.sendOrEdit(ctx, 'Ошибка: менеджер не найден', {}, session);
      return;
    }

    try {
      // Создаём сотрудника
      const employee = await employeeRepo.createEmployee({
        fullName,
        createdBy: manager.id
      });

      // Генерируем реферальную ссылку
      const { refCode } = await employeeRepo.generateRefCode(employee.id, { expiresInHours: 168 }); // 7 дней

      // Назначаем на объект
      await assignmentRepo.assign({
        employeeId: employee.id,
        workObjectId: objectId,
        assignedBy: manager.id
      });

      // Логируем в audit
      await auditRepo.log({
        entityType: 'employees',
        entityId: employee.id,
        action: 'create',
        changedBy: manager.id,
        metadata: { fullName, objectId, refCode }
      });

      // Формируем реферальную ссылку
      // Формат: t.me/botname?start=ref-TOKEN (стандартный Telegram deep link)
      const botInfo = await ctx.telegram.getMe();
      const refLink = `https://t.me/${botInfo.username}?start=ref-${refCode}`;

      // Возвращаемся к списку сотрудников объекта
      // Сохраняем objectId перед переходом
      const updatedSession = await dialog.mergeData(session, { currentObjectId: objectId });
      ctx.state.session = updatedSession;

      // Переходим к списку сотрудников объекта
      const finalSession = await dialog.setState(updatedSession, STATES.OBJECT_EMPLOYEES_LIST);
      ctx.state.session = finalSession;

      await MessageService.sendOrEdit(
        ctx,
        `✅ Сотрудник "${fullName}" создан и назначен на объект\n\n` +
        `🔗 Реферальная ссылка для привязки Telegram:\n` +
        `${refLink}\n\n` +
        `Отправьте эту ссылку сотруднику для активации аккаунта.`,
        {},
        finalSession
      );
      await runState(ctx, 'enter');
    } catch (error) {
      console.error('Error creating employee:', error);
      const { session } = ctx.state;
      if (error.message.includes('already assigned')) {
        await MessageService.sendOrEdit(ctx, '❌ Сотрудник уже назначен на этот объект', {}, session);
      } else {
        await MessageService.sendOrEdit(ctx, 'Ошибка при создании сотрудника. Попробуйте позже.', {}, session);
      }
    }
  }
});

