/**
 * Use Case: Создание сотрудника
 */
export class CreateEmployeeUseCase {
  constructor(employeeRepository, auditLogRepository) {
    this.employeeRepo = employeeRepository;
    this.auditRepo = auditLogRepository;
  }

  /**
   * Создает сотрудника
   * @param {string} fullName - Полное имя сотрудника
   * @param {number} createdBy - ID менеджера, создающего сотрудника
   * @param {Object} options - Опции (expiresInHours для ref code)
   * @returns {Promise<Object>} Созданный сотрудник и refCode
   */
  async execute(fullName, createdBy, options = {}) {
    // Создаём сотрудника
    const employee = await this.employeeRepo.createEmployee({
      fullName,
      createdBy
    });

    // Генерируем реферальную ссылку
    const { refCode } = await this.employeeRepo.generateRefCode(
      employee.id,
      { expiresInHours: options.expiresInHours || 168 } // По умолчанию 7 дней
    );

    // Логируем в audit
    await this.auditRepo.log({
      entityType: 'employees',
      entityId: employee.id,
      action: 'create',
      changedBy: createdBy,
      metadata: { fullName, refCode }
    });

    return { employee, refCode };
  }
}

