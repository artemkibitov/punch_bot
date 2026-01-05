/**
 * Use Case: Обновление объекта
 */
export class UpdateObjectUseCase {
  constructor(objectRepository, auditLogRepository) {
    this.objectRepo = objectRepository;
    this.auditRepo = auditLogRepository;
  }

  /**
   * Обновляет объект
   * @param {number} objectId - ID объекта
   * @param {Object} updates - Обновления
   * @param {Object} options - Опции доступа
   * @param {number} options.managerId - ID менеджера
   * @param {boolean} options.isAdmin - Является ли администратором
   * @param {number} updatedBy - ID обновляющего (для audit)
   * @returns {Promise<Object>} Обновленный объект
   */
  async execute(objectId, updates, options, updatedBy) {
    const updatedObject = await this.objectRepo.update(
      objectId,
      updates,
      {
        managerId: options.managerId,
        isAdmin: options.isAdmin
      }
    );

    // Логируем в audit
    await this.auditRepo.log({
      entityType: 'work_objects',
      entityId: objectId,
      action: 'update',
      changedBy: updatedBy,
      metadata: updates
    });

    return updatedObject;
  }
}

