/**
 * Use Case: Получение списка сотрудников
 */
export class GetEmployeesListUseCase {
  constructor(employeeRepository) {
    this.employeeRepo = employeeRepository;
  }

  /**
   * Получает список сотрудников
   * @param {Object} options - Опции фильтрации
   * @param {number} options.managerId - ID менеджера (для фильтрации по создателю)
   * @param {number} options.objectId - ID объекта (для фильтрации по объекту)
   * @param {boolean} options.isAdmin - Является ли запрашивающий администратором
   * @param {boolean} options.includeInactive - Включать ли неактивных сотрудников
   * @returns {Promise<Array>} Список сотрудников
   */
  async execute(options = {}) {
    const { managerId, objectId, isAdmin, includeInactive } = options;

    if (objectId) {
      // Получаем сотрудников объекта
      return await this.employeeRepo.findByObjectId(objectId, {
        managerId,
        isAdmin
      });
    }

    if (managerId) {
      // Получаем сотрудников менеджера
      return await this.employeeRepo.findByManagerId(managerId, {
        includeInactive
      });
    }

    // Получаем всех сотрудников (для Admin)
    return await this.employeeRepo.findAll({
      includeInactive
    });
  }
}

