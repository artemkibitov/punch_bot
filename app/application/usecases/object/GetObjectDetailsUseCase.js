/**
 * Use Case: Получение деталей объекта
 */
export class GetObjectDetailsUseCase {
  constructor(objectRepository) {
    this.objectRepo = objectRepository;
  }

  /**
   * Получает детали объекта
   * @param {number} objectId - ID объекта
   * @param {Object} options - Опции доступа
   * @param {number} options.managerId - ID менеджера
   * @param {boolean} options.isAdmin - Является ли администратором
   * @returns {Promise<Object>} Объект
   */
  async execute(objectId, options = {}) {
    const object = await this.objectRepo.findById(objectId, {
      managerId: options.managerId,
      isAdmin: options.isAdmin
    });

    if (!object) {
      throw new Error('Object not found or access denied');
    }

    return object;
  }
}

