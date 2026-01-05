/**
 * Use Case: Снятие сотрудника с объекта
 */
export class UnassignEmployeeFromObjectUseCase {
  constructor(assignmentRepository, auditLogRepository) {
    this.assignmentRepo = assignmentRepository;
    this.auditRepo = auditLogRepository;
  }

  /**
   * Снимает сотрудника с объекта
   * @param {number} employeeId - ID сотрудника
   * @param {number} objectId - ID объекта
   * @param {number} unassignedBy - ID менеджера
   * @returns {Promise<void>}
   */
  async execute(employeeId, objectId, unassignedBy) {
    // Удаляем назначение
    await this.assignmentRepo.unassign({
      employeeId,
      workObjectId: objectId,
      unassignedBy
    });

    // Логируем в audit
    await this.auditRepo.log({
      entityType: 'assignments',
      entityId: employeeId,
      action: 'unassign',
      changedBy: unassignedBy,
      metadata: { employeeId, objectId }
    });
  }
}

