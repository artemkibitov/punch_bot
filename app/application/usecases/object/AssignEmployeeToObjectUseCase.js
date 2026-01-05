/**
 * Use Case: Назначение сотрудника на объект
 */
export class AssignEmployeeToObjectUseCase {
  constructor(assignmentRepository, objectRepository, employeeRepository, auditLogRepository) {
    this.assignmentRepo = assignmentRepository;
    this.objectRepo = objectRepository;
    this.employeeRepo = employeeRepository;
    this.auditRepo = auditLogRepository;
  }

  /**
   * Назначает сотрудника на объект
   * @param {number} employeeId - ID сотрудника
   * @param {number} objectId - ID объекта
   * @param {number} assignedBy - ID менеджера
   * @param {Object} options - Опции доступа
   * @param {number} options.managerId - ID менеджера для проверки прав
   * @param {boolean} options.isAdmin - Является ли администратором
   * @returns {Promise<Object>} Назначение
   */
  async execute(employeeId, objectId, assignedBy, options = {}) {
    // Проверяем объект
    const object = await this.objectRepo.findById(objectId, {
      managerId: options.managerId,
      isAdmin: options.isAdmin
    });
    if (!object) {
      throw new Error('Object not found or access denied');
    }

    // Проверяем сотрудника
    const employee = await this.employeeRepo.findById(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    // Проверяем права на сотрудника (должен быть создан этим менеджером или админ)
    if (!options.isAdmin && employee.created_by !== options.managerId) {
      throw new Error('Access denied to this employee');
    }

    // Назначаем сотрудника на объект
    const assignment = await this.assignmentRepo.assign({
      employeeId,
      workObjectId: objectId,
      assignedBy
    });

    // Логируем в audit
    await this.auditRepo.log({
      entityType: 'assignments',
      entityId: assignment.id,
      action: 'create',
      changedBy: assignedBy,
      metadata: {
        employeeId,
        workObjectId: objectId,
        employeeName: employee.full_name
      }
    });

    return assignment;
  }
}

