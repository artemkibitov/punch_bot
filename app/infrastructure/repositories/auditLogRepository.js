import { getPool } from '../database/pool.js';

export class AuditLogRepository {
  constructor() {
    this.pool = getPool();
  }

  /**
   * Логирование изменения
   */
  async log({ entityType, entityId, action, fieldName = null, oldValue = null, newValue = null, changedBy, metadata = null }) {
    const { rows } = await this.pool.query(
      `
      INSERT INTO audit_logs (
        entity_type,
        entity_id,
        action,
        field_name,
        old_value,
        new_value,
        changed_by,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [entityType, entityId, action, fieldName, oldValue, newValue, changedBy, metadata]
    );

    return rows[0];
  }

  /**
   * Получение истории сущности
   */
  async findByEntity(entityType, entityId, { managerId = null, isAdmin = false, limit = 100 } = {}) {
    let query = `
      SELECT al.*, e.full_name as changed_by_name
      FROM audit_logs al
      JOIN employees e ON e.id = al.changed_by
      WHERE al.entity_type = $1
        AND al.entity_id = $2
    `;

    const params = [entityType, entityId];
    let paramIndex = 3;

    // Если не админ, фильтруем по объектам менеджера
    if (!isAdmin && managerId) {
      if (entityType === 'work_objects') {
        query += ` AND EXISTS (
          SELECT 1 FROM work_objects wo
          WHERE wo.id = $2 AND wo.manager_id = $${paramIndex}
        )`;
        params.push(managerId);
        paramIndex++;
      } else if (entityType === 'work_logs') {
        query += ` AND EXISTS (
          SELECT 1 FROM work_logs wl
          JOIN work_objects wo ON wo.id = wl.work_object_id
          WHERE wl.id = $2 AND wo.manager_id = $${paramIndex}
        )`;
        params.push(managerId);
        paramIndex++;
      }
    }

    query += ` ORDER BY al.changed_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const { rows } = await this.pool.query(query, params);
    return rows;
  }

  /**
   * Получение истории по типу сущности
   */
  async findByEntityType(entityType, { managerId = null, isAdmin = false, limit = 100 } = {}) {
    let query = `
      SELECT al.*, e.full_name as changed_by_name
      FROM audit_logs al
      JOIN employees e ON e.id = al.changed_by
      WHERE al.entity_type = $1
    `;

    const params = [entityType];
    let paramIndex = 2;

    if (!isAdmin && managerId) {
      if (entityType === 'work_objects') {
        query += ` AND EXISTS (
          SELECT 1 FROM work_objects wo
          WHERE wo.id = al.entity_id AND wo.manager_id = $${paramIndex}
        )`;
        params.push(managerId);
        paramIndex++;
      }
    }

    query += ` ORDER BY al.changed_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const { rows } = await this.pool.query(query, params);
    return rows;
  }
}

