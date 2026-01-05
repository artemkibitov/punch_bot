import { getPool } from '../database/pool.js';

export class ObjectRepository {
  constructor() {
    this.pool = getPool();
  }

  /**
   * Создание объекта
   */
  async create({ managerId, name, timezone, plannedStart, plannedEnd, lunchMinutes }) {
    const { rows } = await this.pool.query(
      `
      INSERT INTO work_objects (
        manager_id,
        name,
        timezone,
        planned_start,
        planned_end,
        lunch_minutes,
        created_by,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $1, 'ACTIVE')
      RETURNING *
      `,
      [managerId, name, timezone, plannedStart, plannedEnd, lunchMinutes]
    );

    return rows[0];
  }

  /**
   * Получение объектов менеджера (с фильтром для Admin)
   */
  async findByManagerId(managerId, { includeArchived = false, isAdmin = false } = {}) {
    let query = `
      SELECT wo.*, e.full_name AS manager_name
      FROM work_objects wo
      LEFT JOIN employees e ON e.id = wo.manager_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (!isAdmin) {
      query += ` AND wo.manager_id = $${paramIndex}`;
      params.push(managerId);
      paramIndex++;
    }

    if (!includeArchived) {
      query += ` AND wo.status = 'ACTIVE'`;
    }

    query += ` ORDER BY wo.created_at DESC`;

    const { rows } = await this.pool.query(query, params);
    return rows;
  }

  /**
   * Получение всех объектов (для Admin)
   */
  async findAll({ includeArchived = false } = {}) {
    let query = `
      SELECT wo.*, e.full_name AS manager_name
      FROM work_objects wo
      LEFT JOIN employees e ON e.id = wo.manager_id
      WHERE 1=1
    `;

    if (!includeArchived) {
      query += ` AND wo.status = 'ACTIVE'`;
    }

    query += ` ORDER BY wo.created_at DESC`;

    const { rows } = await this.pool.query(query);
    return rows;
  }

  /**
   * Получение объекта по ID (с проверкой прав)
   */
  async findById(objectId, { managerId = null, isAdmin = false } = {}) {
    let query = `
      SELECT wo.*, e.full_name AS manager_name
      FROM work_objects wo
      LEFT JOIN employees e ON e.id = wo.manager_id
      WHERE wo.id = $1
    `;

    const params = [objectId];
    let paramIndex = 2;

    if (!isAdmin && managerId) {
      query += ` AND wo.manager_id = $${paramIndex}`;
      params.push(managerId);
    }

    const { rows } = await this.pool.query(query, params);
    return rows[0] || null;
  }

  /**
   * Обновление объекта
   */
  async update(objectId, updates, { managerId = null, isAdmin = false } = {}) {
    // Проверка прав доступа
    const object = await this.findById(objectId, { managerId, isAdmin });
    if (!object) {
      throw new Error('Object not found or access denied');
    }

    const allowedFields = ['name', 'timezone', 'planned_start', 'planned_end', 'lunch_minutes', 'status', 'manager_id'];
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
      return object;
    }

    setParts.push(`updated_at = now()`);
    params.push(objectId);

    const { rows } = await this.pool.query(
      `
      UPDATE work_objects
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
      `,
      params
    );

    return rows[0];
  }

  /**
   * Архивация объекта
   */
  async archive(objectId, { managerId = null, isAdmin = false } = {}) {
    return this.update(objectId, { status: 'ARCHIVED' }, { managerId, isAdmin });
  }

  /**
   * Удаление объекта (для Admin) - архивация
   */
  async delete(objectId, { adminId } = {}) {
    // Вместо физического удаления архивируем объект
    const object = await this.findById(objectId, { isAdmin: true });
    if (!object) {
      throw new Error('Object not found');
    }
    
    // Обновляем статус напрямую через SQL, так как update может требовать managerId
    const { rows } = await this.pool.query(
      `
      UPDATE work_objects
      SET status = 'ARCHIVED',
          updated_at = now()
      WHERE id = $1
      RETURNING *
      `,
      [objectId]
    );
    
    if (rows.length === 0) {
      throw new Error('Object not found');
    }
    
    return rows[0];
  }

  /**
   * Перезакрепление объекта за другим менеджером (для Admin)
   */
  async reassignManager(objectId, newManagerId, { adminId } = {}) {
    return this.update(objectId, { managerId: newManagerId }, { isAdmin: true });
  }

  /**
   * Получение активных объектов для триггеров
   */
  async findActiveForTrigger(date, time) {
    const { rows } = await this.pool.query(
      `
      SELECT *
      FROM work_objects
      WHERE status = 'ACTIVE'
        AND planned_start::time = $1::time
      `,
      [time]
    );

    return rows;
  }
}

