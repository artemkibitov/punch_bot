import { getPool } from '../database/pool.js';

export class WorkLogRepository {
  constructor() {
    this.pool = getPool();
  }

  /**
   * Создание work_log (при подтверждении начала)
   */
  async create({ employeeId, workObjectId, shiftId, date, actualStart, createdBy }) {
    const { rows } = await this.pool.query(
      `
      INSERT INTO work_logs (
        employee_id,
        work_object_id,
        shift_id,
        date,
        actual_start,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [employeeId, workObjectId, shiftId, date, actualStart, createdBy]
    );

    return rows[0];
  }

  /**
   * Обновление work_log (при подтверждении окончания)
   */
  async updateEnd(workLogId, { actualEnd, updatedBy }) {
    const { rows } = await this.pool.query(
      `
      UPDATE work_logs
      SET actual_end = $1,
          updated_at = now()
      WHERE id = $2
      RETURNING *
      `,
      [actualEnd, workLogId]
    );

    if (rows.length === 0) {
      throw new Error('WorkLog not found');
    }

    return rows[0];
  }

  /**
   * Получение work_logs сотрудника
   */
  async findByEmployeeId(employeeId, { dateFrom, dateTo } = {}) {
    let query = `
      SELECT wl.*, wo.name as object_name
      FROM work_logs wl
      JOIN work_objects wo ON wo.id = wl.work_object_id
      WHERE wl.employee_id = $1
    `;

    const params = [employeeId];
    let paramIndex = 2;

    if (dateFrom) {
      query += ` AND wl.date >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      query += ` AND wl.date <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    query += ` ORDER BY wl.date DESC, wl.actual_start DESC`;

    const { rows } = await this.pool.query(query, params);
    return rows;
  }

  /**
   * Получение work_logs объекта на дату
   */
  async findByObjectAndDate(objectId, date) {
    const { rows } = await this.pool.query(
      `
      SELECT wl.*, e.full_name
      FROM work_logs wl
      JOIN employees e ON e.id = wl.employee_id
      WHERE wl.work_object_id = $1
        AND wl.date = $2
      ORDER BY e.full_name
      `,
      [objectId, date]
    );

    return rows;
  }

  /**
   * Индивидуальная корректировка
   */
  async createOverride({ employeeId, workObjectId, date, actualStart, actualEnd, createdBy }) {
    const { rows } = await this.pool.query(
      `
      INSERT INTO work_logs (
        employee_id,
        work_object_id,
        date,
        actual_start,
        actual_end,
        is_override,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, true, $6)
      RETURNING *
      `,
      [employeeId, workObjectId, date, actualStart, actualEnd, createdBy]
    );

    return rows[0];
  }

  /**
   * Получение work_log по ID
   */
  async findById(workLogId) {
    const { rows } = await this.pool.query(
      `
      SELECT wl.*, e.full_name, wo.name as object_name
      FROM work_logs wl
      JOIN employees e ON e.id = wl.employee_id
      JOIN work_objects wo ON wo.id = wl.work_object_id
      WHERE wl.id = $1
      `,
      [workLogId]
    );

    return rows[0] || null;
  }

  /**
   * Обновление work_log
   */
  async update(workLogId, updates) {
    const allowedFields = ['actual_start', 'actual_end', 'lunch_minutes'];
    const setParts = [];
    const params = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey) && value !== undefined) {
        setParts.push(`${dbKey} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (setParts.length === 0) {
      return this.findById(workLogId);
    }

    setParts.push(`updated_at = now()`);
    params.push(workLogId);

    const { rows } = await this.pool.query(
      `
      UPDATE work_logs
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
      `,
      params
    );

    return rows[0];
  }
}

