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
}
