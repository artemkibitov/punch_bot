import { getPool } from '../database/pool.js';

export class ShiftRepository {
  constructor() {
    this.pool = getPool();
  }

  /**
   * Создание смены (автоматически)
   */
  async create({ workObjectId, date, plannedStart, plannedEnd, lunchMinutes }) {
    const { rows } = await this.pool.query(
      `
      INSERT INTO object_shifts (
        work_object_id,
        date,
        planned_start,
        planned_end,
        lunch_minutes,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'planned')
      ON CONFLICT (work_object_id, date) DO NOTHING
      RETURNING *
      `,
      [workObjectId, date, plannedStart, plannedEnd, lunchMinutes]
    );

    return rows[0] || null;
  }

  /**
   * Получение смены по ID
   */
  async findById(shiftId) {
    const { rows } = await this.pool.query(
      `
      SELECT os.*, wo.name as object_name, wo.manager_id
      FROM object_shifts os
      JOIN work_objects wo ON wo.id = os.work_object_id
      WHERE os.id = $1
      `,
      [shiftId]
    );

    return rows[0] || null;
  }

  /**
   * Получение смены объекта на дату
   */
  async findByObjectAndDate(objectId, date) {
    const { rows } = await this.pool.query(
      `
      SELECT *
      FROM object_shifts
      WHERE work_object_id = $1
        AND date = $2
      `,
      [objectId, date]
    );

    return rows[0] || null;
  }

  /**
   * Подтверждение начала смены
   */
  async confirmStart(shiftId, { confirmedBy }) {
    const { rows } = await this.pool.query(
      `
      UPDATE object_shifts
      SET status = 'started',
          started_at = now(),
          confirmed_by = $1,
          updated_at = now()
      WHERE id = $2
        AND status = 'planned'
      RETURNING *
      `,
      [confirmedBy, shiftId]
    );

    if (rows.length === 0) {
      throw new Error('Shift not found or already started');
    }

    return rows[0];
  }

  /**
   * Подтверждение окончания смены
   */
  async confirmEnd(shiftId, { confirmedBy }) {
    const { rows } = await this.pool.query(
      `
      UPDATE object_shifts
      SET status = 'closed',
          closed_at = now(),
          confirmed_by = $1,
          updated_at = now()
      WHERE id = $2
        AND status = 'started'
      RETURNING *
      `,
      [confirmedBy, shiftId]
    );

    if (rows.length === 0) {
      throw new Error('Shift not found or not started');
    }

    return rows[0];
  }

  /**
   * Получение смен для триггеров
   */
  async findForTrigger(date, time, status) {
    const { rows } = await this.pool.query(
      `
      SELECT os.*, wo.manager_id, wo.name as object_name
      FROM object_shifts os
      JOIN work_objects wo ON wo.id = os.work_object_id
      WHERE os.date = $1
        AND os.status = $2
        AND wo.status = 'ACTIVE'
        AND (
          ($3::time = os.planned_start::time AND os.status = 'planned')
          OR ($3::time = os.planned_end::time AND os.status = 'started')
        )
      `,
      [date, status, time]
    );

    return rows;
  }

  /**
   * Получение смен объекта за период
   */
  async findByObjectId(objectId, { dateFrom, dateTo } = {}) {
    let query = `
      SELECT *
      FROM object_shifts
      WHERE work_object_id = $1
    `;

    const params = [objectId];
    let paramIndex = 2;

    if (dateFrom) {
      query += ` AND date >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      query += ` AND date <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    query += ` ORDER BY date DESC`;

    const { rows } = await this.pool.query(query, params);
    return rows;
  }
}

