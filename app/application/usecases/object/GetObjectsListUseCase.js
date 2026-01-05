/**
 * Use Case: Получение списка объектов
 */
export class GetObjectsListUseCase {
  constructor(objectRepository) {
    this.objectRepo = objectRepository;
  }

  /**
   * Получает список объектов
   * @param {Object} options - Опции фильтрации
   * @param {number} options.managerId - ID менеджера
   * @param {boolean} options.isAdmin - Является ли администратором
   * @param {boolean} options.includeArchived - Включать ли архивированные объекты
   * @returns {Promise<Array>} Список объектов
   */
  async execute(options = {}) {
    const { managerId, isAdmin, includeArchived } = options;

    if (isAdmin) {
      // Для админа - все объекты
      return await this.objectRepo.findAll({ includeArchived });
    }

    // Для менеджера - только его объекты
    return await this.objectRepo.findByManagerId(managerId, {
      includeArchived,
      isAdmin: false
    });
  }
}

