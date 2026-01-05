/**
 * Use Case: Генерация реферального кода для сотрудника
 */
export class GenerateRefCodeUseCase {
  constructor(employeeRepository) {
    this.employeeRepo = employeeRepository;
  }

  /**
   * Генерирует новый реферальный код для сотрудника
   * @param {number} employeeId - ID сотрудника
   * @param {Object} options - Опции (expiresInHours)
   * @returns {Promise<Object>} refCode и expiresAt
   */
  async execute(employeeId, options = {}) {
    const { refCode, expiresAt } = await this.employeeRepo.generateRefCode(
      employeeId,
      { expiresInHours: options.expiresInHours || 168 } // По умолчанию 7 дней
    );

    return { refCode, expiresAt };
  }
}

