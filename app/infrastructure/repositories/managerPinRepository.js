import { getPool } from '../database/pool.js';

export class ManagerPinRepository {
  constructor() {
    this.pool = getPool();
  }

  /**
   * Валидация PIN и получение роли
   * @returns {Promise<{valid: boolean, role: string|null}>}
   */
  async validate(pin) {
    const { rows } = await this.pool.query(
      `
      SELECT id, role_type
      FROM manager_pins
      WHERE pin = $1
        AND is_active = true
      `,
      [pin]
    );

    if (rows.length === 0) {
      return { valid: false, role: null };
    }

    return { valid: true, role: rows[0].role_type };
  }
}
