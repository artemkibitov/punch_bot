import { getPool } from '../db/pool.js';

export class SessionRepository {
  constructor() {
    this.pool = getPool();
  }

  async getByTelegramUserId(telegramUserId) {
    const { rows } = await this.pool.query(
      `
      SELECT *
      FROM sessions
      WHERE telegram_user_id = $1
        AND status = 'ACTIVE'
      `,
      [telegramUserId]
    );

    return rows[0] || null;
  }

  async create(telegramUserId) {
    const { rows } = await this.pool.query(
      `
      INSERT INTO sessions (telegram_user_id)
      VALUES ($1)
      RETURNING *
      `,
      [telegramUserId]
    );

    return rows[0];
  }

  async updateState(id, state) {
    await this.pool.query(
      `
      UPDATE sessions
      SET state = $1,
          updated_at = now()
      WHERE id = $2
      `,
      [state, id]
    );
  }

  async updateData(id, data) {
    await this.pool.query(
      `
      UPDATE sessions
      SET data = $1,
          updated_at = now()
      WHERE id = $2
      `,
      [data, id]
    );
  }

  async close(id) {
    await this.pool.query(
      `
      UPDATE sessions
      SET status = 'CLOSED',
          updated_at = now()
      WHERE id = $1
      `,
      [id]
    );
  }
}
