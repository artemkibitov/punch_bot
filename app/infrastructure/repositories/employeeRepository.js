import { getPool } from '../database/pool.js';

export class EmployeeRepository {
  constructor() {
    this.pool = getPool();
  }

  async findByTelegramUserId(telegramUserId) {
    const { rows } = await this.pool.query(
      `
      SELECT e.*, r.code AS role
      FROM employees e
      JOIN roles r ON r.id = e.role_id
      WHERE e.telegram_user_id = $1
      `,
      [telegramUserId]
    );

    return rows[0] || null;
  }

  async createManager({ telegramUserId, fullName }) {
    const { rows } = await this.pool.query(
      `
      INSERT INTO employees (
        telegram_user_id,
        full_name,
        role_id
      )
      SELECT $1, $2, id
      FROM roles
      WHERE code = 'MANAGER'
      RETURNING *
      `,
      [telegramUserId, fullName]
    );

    return rows[0];
  }

  /**
   * Создание администратора
   */
  async createAdmin({ telegramUserId, fullName }) {
    const { rows } = await this.pool.query(
      `
      INSERT INTO employees (
        telegram_user_id,
        full_name,
        role_id
      )
      SELECT $1, $2, id
      FROM roles
      WHERE code = 'ADMIN'
      RETURNING *
      `,
      [telegramUserId, fullName]
    );

    return rows[0];
  }

  /**
   * Создание сотрудника (без telegramId)
   */
  async createEmployee({ fullName, createdBy }) {
    const { rows } = await this.pool.query(
      `
      INSERT INTO employees (
        full_name,
        role_id,
        created_by
      )
      SELECT $1, id, $2
      FROM roles
      WHERE code = 'EMPLOYEE'
      RETURNING *
      `,
      [fullName, createdBy]
    );

    return rows[0];
  }

  /**
   * Получение сотрудника по ID
   */
  async findById(employeeId) {
    const { rows } = await this.pool.query(
      `
      SELECT e.*, r.code AS role
      FROM employees e
      JOIN roles r ON r.id = e.role_id
      WHERE e.id = $1
      `,
      [employeeId]
    );

    return rows[0] || null;
  }

  /**
   * Поиск по ref_code
   */
  async findByRefCode(refCode) {
    const { rows } = await this.pool.query(
      `
      SELECT e.*, r.code AS role
      FROM employees e
      JOIN roles r ON r.id = e.role_id
      WHERE e.ref_code = $1
        AND (e.ref_code_expires_at IS NULL OR e.ref_code_expires_at > now())
      `,
      [refCode]
    );

    return rows[0] || null;
  }

  /**
   * Привязка Telegram к сотруднику
   */
  async linkTelegram(employeeId, telegramUserId) {
    const { rows } = await this.pool.query(
      `
      UPDATE employees
      SET telegram_user_id = $1,
          ref_code = NULL,
          ref_code_expires_at = NULL,
          updated_at = now()
      WHERE id = $2
        AND telegram_user_id IS NULL
      RETURNING *
      `,
      [telegramUserId, employeeId]
    );

    if (rows.length === 0) {
      throw new Error('Employee not found or already linked');
    }

    return rows[0];
  }

  /**
   * Получение всех сотрудников (для Admin)
   */
  async findAll({ includeInactive = false } = {}) {
    let query = `
      SELECT e.*, r.code AS role
      FROM employees e
      JOIN roles r ON r.id = e.role_id
      WHERE 1=1
    `;

    if (!includeInactive) {
      query += ` AND e.status = 'active'`;
    }

    query += ` ORDER BY e.created_at DESC`;

    const { rows } = await this.pool.query(query);
    return rows;
  }

  /**
   * Получение всех менеджеров (для Admin)
   */
  async findAllManagers() {
    const { rows } = await this.pool.query(
      `
      SELECT e.*, r.code AS role
      FROM employees e
      JOIN roles r ON r.id = e.role_id
      WHERE r.code = 'MANAGER'
      ORDER BY e.full_name
      `
    );
    return rows;
  }

  /**
   * Получение сотрудников объекта
   */
  async findByObjectId(objectId, { managerId = null, isAdmin = false } = {}) {
    let query = `
      SELECT DISTINCT e.*, r.code AS role
      FROM employees e
      JOIN roles r ON r.id = e.role_id
      JOIN assignments a ON a.employee_id = e.id
      WHERE a.work_object_id = $1
        AND a.unassigned_at IS NULL
    `;

    const params = [objectId];
    let paramIndex = 2;

    if (!isAdmin && managerId) {
      query += ` AND EXISTS (
        SELECT 1 FROM work_objects wo
        WHERE wo.id = $1 AND wo.manager_id = $${paramIndex}
      )`;
      params.push(managerId);
    }

    query += ` ORDER BY e.full_name`;

    const { rows } = await this.pool.query(query, params);
    return rows;
  }

  /**
   * Получение сотрудников менеджера
   * Ищет всех сотрудников, созданных этим менеджером (по created_by)
   */
  async findByManagerId(managerId, { includeInactive = false } = {}) {
    let query = `
      SELECT DISTINCT e.*, r.code AS role
      FROM employees e
      JOIN roles r ON r.id = e.role_id
      WHERE e.created_by = $1
    `;

    const params = [managerId];

    if (!includeInactive) {
      query += ` AND e.status = 'active'`;
    }

    query += ` ORDER BY e.full_name`;

    const { rows } = await this.pool.query(query, params);
    return rows;
  }

  /**
   * Генерация ref_code для сотрудника
   */
  async generateRefCode(employeeId, { expiresInHours = 24 } = {}) {
    const refCode = `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = expiresInHours 
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : null;

    const { rows } = await this.pool.query(
      `
      UPDATE employees
      SET ref_code = $1,
          ref_code_expires_at = $2,
          updated_at = now()
      WHERE id = $3
      RETURNING *
      `,
      [refCode, expiresAt, employeeId]
    );

    if (rows.length === 0) {
      throw new Error('Employee not found');
    }

    return { refCode, expiresAt };
  }
}
