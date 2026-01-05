import { registerState } from '../registry.js';
import { STATES } from '../../../domain/fsm/states.js';
import { runState } from '../router.js';
import { EmployeeRepository } from '../../../infrastructure/repositories/employeeRepository.js';
import { AuditLogRepository } from '../../../infrastructure/repositories/auditLogRepository.js';
import { MessageService } from '../../services/messageService.js';

const employeeRepo = new EmployeeRepository();
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

registerState(STATES.MANAGER_EMPLOYEE_CREATE_ENTER_NAME, {
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

      // Логируем в audit
      await auditRepo.log({
        entityType: 'employees',
        entityId: employee.id,
        action: 'create',
        changedBy: manager.id,
        metadata: { fullName, refCode }
      });

      // Возвращаемся к списку сотрудников менеджера
      const updatedSession = await dialog.setState(session, STATES.MANAGER_EMPLOYEES_LIST);
      ctx.state.session = updatedSession;

      await MessageService.sendOrEdit(
        ctx,
        `✅ Сотрудник "${fullName}" создан!\n\n` +
        `Теперь вы можете назначить сотрудника на объекты и вести учет его работы.\n\n` +
        `Реферальную ссылку для активации Telegram вы найдете в деталях сотрудника.`,
        {},
        updatedSession
      );
      await runState(ctx, 'enter');
    } catch (error) {
      console.error('Error creating employee:', error);
      const { session } = ctx.state;
      await MessageService.sendOrEdit(ctx, 'Ошибка при создании сотрудника. Попробуйте позже.', {}, session);
    }
  }
});

