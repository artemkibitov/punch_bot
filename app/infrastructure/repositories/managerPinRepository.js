import { getPool } from '../database/pool.js';

export class ManagerPinRepository {
  constructor() {
    this.pool = getPool();
  }

  async validate(pin) {
    const { rows } = await this.pool.query(
      `
      SELECT id
      FROM manager_pins
      WHERE pin = $1
        AND is_active = true
      `,
      [pin]
    );

    return rows.length > 0;
  }
}
