/**
 * Use Case: Создание объекта
 */
export class CreateObjectUseCase {
  constructor(objectRepository, auditLogRepository) {
    this.objectRepo = objectRepository;
    this.auditRepo = auditLogRepository;
  }

  /**
   * Создает объект
   * @param {Object} data - Данные объекта
   * @param {number} data.managerId - ID менеджера
   * @param {string} data.name - Название объекта
   * @param {string} data.timezone - Часовой пояс
   * @param {string} data.plannedStart - Плановое время начала (HH:MM)
   * @param {string} data.plannedEnd - Плановое время окончания (HH:MM)
   * @param {number} data.lunchMinutes - Минуты обеда
   * @param {number} createdBy - ID создателя (для audit)
   * @returns {Promise<Object>} Созданный объект
   */
  async execute(data, createdBy) {
    const object = await this.objectRepo.create({
      managerId: data.managerId,
      name: data.name,
      timezone: data.timezone,
      plannedStart: data.plannedStart,
      plannedEnd: data.plannedEnd,
      lunchMinutes: data.lunchMinutes
    });

    // Логируем в audit
    await this.auditRepo.log({
      entityType: 'work_objects',
      entityId: object.id,
      action: 'create',
      changedBy: createdBy,
      metadata: {
        name: data.name,
        timezone: data.timezone,
        startTime: data.plannedStart,
        endTime: data.plannedEnd,
        lunchMinutes: data.lunchMinutes
      }
    });

    return object;
  }
}

