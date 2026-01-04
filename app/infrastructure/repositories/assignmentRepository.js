import { getPool } from '../database/pool.js';

export class AssignmentRepository {
  constructor() {
    this.pool = getPool();
  }

  /**
   * Назначение сотрудника на объект
   */
  async assign({ employeeId, workObjectId, assignedBy }) {
    // Проверяем, нет ли активного назначения
    const existing = await this.pool.query(
      `
      SELECT id
      FROM assignments
      WHERE employee_id = $1
        AND work_object_id = $2
        AND unassigned_at IS NULL
      `,
      [employeeId, workObjectId]
    );

    if (existing.rows.length > 0) {
      throw new Error('Employee already assigned to this object');
    }

    const { rows } = await this.pool.query(
      `
      INSERT INTO assignments (
        employee_id,
        work_object_id,
        assigned_by
      )
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [employeeId, workObjectId, assignedBy]
    );

    return rows[0];
  }

  /**
   * Снятие сотрудника с объекта
   */
  async remove({ employeeId, workObjectId, removedBy }) {
    const { rows } = await this.pool.query(
      `
      UPDATE assignments
      SET unassigned_at = now()
      WHERE employee_id = $1
        AND work_object_id = $2
        AND unassigned_at IS NULL
      RETURNING *
      `,
      [employeeId, workObjectId]
    );

    if (rows.length === 0) {
      throw new Error('Assignment not found or already removed');
    }

    return rows[0];
  }

  /**
   * Получение активных назначений объекта
   */
  async findActiveByObjectId(objectId) {
    const { rows } = await this.pool.query(
      `
      SELECT a.*, e.full_name, e.telegram_user_id
      FROM assignments a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.work_object_id = $1
        AND a.unassigned_at IS NULL
      ORDER BY e.full_name
      `,
      [objectId]
    );

    return rows;
  }

  /**
   * Получение объектов сотрудника
   */
  async findObjectsByEmployeeId(employeeId) {
    const { rows } = await this.pool.query(
      `
      SELECT wo.*
      FROM assignments a
      JOIN work_objects wo ON wo.id = a.work_object_id
      WHERE a.employee_id = $1
        AND a.unassigned_at IS NULL
        AND wo.status = 'ACTIVE'
      ORDER BY wo.name
      `,
      [employeeId]
    );

    return rows;
  }

  /**
   * Проверка, назначен ли сотрудник на объект
   */
  async isAssigned(employeeId, workObjectId) {
    const { rows } = await this.pool.query(
      `
      SELECT id
      FROM assignments
      WHERE employee_id = $1
        AND work_object_id = $2
        AND unassigned_at IS NULL
      `,
      [employeeId, workObjectId]
    );

    return rows.length > 0;
  }
}

