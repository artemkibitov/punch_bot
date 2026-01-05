/**
 * Use Case: Привязка Telegram к сотруднику
 */
export class LinkTelegramUseCase {
  constructor(employeeRepository, auditLogRepository) {
    this.employeeRepo = employeeRepository;
    this.auditRepo = auditLogRepository;
  }

  /**
   * Привязывает Telegram к сотруднику по ref code
   * @param {string} refCode - Реферальный код
   * @param {number} telegramUserId - ID пользователя Telegram
   * @returns {Promise<Object>} Обновленный сотрудник
   */
  async execute(refCode, telegramUserId) {
    // Находим сотрудника по ref_code
    const employee = await this.employeeRepo.findByRefCode(refCode);

    if (!employee) {
      throw new Error('Invalid or expired ref code');
    }

    // Проверяем, не привязан ли уже Telegram
    if (employee.telegram_user_id) {
      throw new Error('Employee already has Telegram linked');
    }

    // Привязываем Telegram
    const updatedEmployee = await this.employeeRepo.linkTelegram(employee.id, telegramUserId);

    // Логируем в audit
    await this.auditRepo.log({
      entityType: 'employees',
      entityId: employee.id,
      action: 'update',
      changedBy: employee.id,
      metadata: { field: 'telegram_user_id', telegramUserId, refCode }
    });

    return updatedEmployee;
  }
}

