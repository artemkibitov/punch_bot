/**
 * Use Case: Получение деталей сотрудника
 */
export class GetEmployeeDetailsUseCase {
  constructor(employeeRepository) {
    this.employeeRepo = employeeRepository;
  }

  /**
   * Получает детали сотрудника
   * @param {number} employeeId - ID сотрудника
   * @returns {Promise<Object>} Сотрудник
   */
  async execute(employeeId) {
    const employee = await this.employeeRepo.findById(employeeId);
    
    if (!employee) {
      throw new Error('Employee not found');
    }

    return employee;
  }
}

