/**
 * Скрипт для создания mock данных в базу данных
 * Создает объект, сотрудников, смены (месяц назад и сегодняшнюю)
 */

import { getPool } from '../app/infrastructure/database/pool.js';
import { ObjectRepository } from '../app/infrastructure/repositories/objectRepository.js';
import { EmployeeRepository } from '../app/infrastructure/repositories/employeeRepository.js';
import { ShiftRepository } from '../app/infrastructure/repositories/shiftRepository.js';
import { AssignmentRepository } from '../app/infrastructure/repositories/assignmentRepository.js';
import { WorkLogRepository } from '../app/infrastructure/repositories/workLogRepository.js';

const pool = getPool();
const objectRepo = new ObjectRepository();
const employeeRepo = new EmployeeRepository();
const shiftRepo = new ShiftRepository();
const assignmentRepo = new AssignmentRepository();
const workLogRepo = new WorkLogRepository();

async function createMockData() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔵 Создание mock данных...\n');

    // 1. Находим или создаем менеджера (админа)
    const { rows: adminRows } = await client.query(
      `SELECT id FROM employees WHERE role = 'ADMIN' LIMIT 1`
    );
    
    let managerId;
    if (adminRows.length > 0) {
      managerId = adminRows[0].id;
      console.log(`✅ Используем существующего админа (ID: ${managerId})`);
    } else {
      // Создаем админа если нет
      const { rows: newAdminRows } = await client.query(
        `INSERT INTO employees (full_name, role, telegram_user_id, created_by)
         VALUES ('Admin User', 'ADMIN', 123456789, 1)
         RETURNING id`
      );
      managerId = newAdminRows[0].id;
      console.log(`✅ Создан админ (ID: ${managerId})`);
    }

    // 2. Создаем объект
    const objectName = 'Mock Объект';
    const object = await objectRepo.create({
      name: objectName,
      managerId: managerId,
      timezone: 'Europe/Moscow',
      plannedStart: '08:00',
      plannedEnd: '18:00',
      lunchMinutes: 30
    });
    console.log(`✅ Создан объект: ${object.name} (ID: ${object.id})`);

    // 3. Создаем сотрудников
    const employeesData = [
      { name: 'Иванов Иван', telegramId: 111111111 },
      { name: 'Петров Петр', telegramId: 222222222 },
      { name: 'Сидоров Сидор', telegramId: 333333333 }
    ];

    const employees = [];
    for (const empData of employeesData) {
      const employee = await employeeRepo.createEmployee({
        fullName: empData.name,
        createdBy: managerId
      });
      
      // Устанавливаем telegram_user_id если нужно
      if (empData.telegramId) {
        await client.query(
          `UPDATE employees SET telegram_user_id = $1 WHERE id = $2`,
          [empData.telegramId, employee.id]
        );
      }
      
      employees.push(employee);
      console.log(`✅ Создан сотрудник: ${employee.full_name} (ID: ${employee.id})`);
    }

    // 4. Назначаем сотрудников на объект
    for (const employee of employees) {
      await assignmentRepo.assign({
        employeeId: employee.id,
        workObjectId: object.id,
        assignedBy: managerId
      });
      console.log(`✅ Сотрудник ${employee.full_name} назначен на объект`);
    }

    // 5. Создаем смены месяц назад (последние 30 дней)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log(`\n📅 Создание смен за последние 30 дней...`);
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      // Создаем смену
      const shift = await shiftRepo.create({
        workObjectId: object.id,
        date: dateStr,
        plannedStart: new Date(`${dateStr}T08:00:00`).toISOString(),
        plannedEnd: new Date(`${dateStr}T18:00:00`).toISOString(),
        lunchMinutes: 30
      });

      if (shift) {
        // Для завершенных смен (кроме сегодня) создаем work_logs
        if (i < 29) {
          // Подтверждаем начало и окончание
          await shiftRepo.confirmStart(shift.id, { confirmedBy: managerId });
          
          const startedAt = new Date(`${dateStr}T08:15:00`);
          await client.query(
            `UPDATE object_shifts SET started_at = $1 WHERE id = $2`,
            [startedAt.toISOString(), shift.id]
          );

          // Создаем work_logs для всех сотрудников
          for (const employee of employees) {
            const workLog = await workLogRepo.create({
              employeeId: employee.id,
              workObjectId: object.id,
              objectShiftId: shift.id,
              date: dateStr,
              actualStart: new Date(`${dateStr}T08:15:00`).toISOString(),
              createdBy: managerId
            });

            // Завершаем work_log (разное время для разных сотрудников)
            const endOffset = Math.floor(Math.random() * 60) + 15; // 15-75 минут разницы
            const actualEnd = new Date(`${dateStr}T17:${String(endOffset).padStart(2, '0')}:00`);
            await workLogRepo.updateEnd(workLog.id, {
              actualEnd: actualEnd.toISOString(),
              updatedBy: managerId
            });
          }

          // Завершаем смену
          await shiftRepo.confirmEnd(shift.id, { confirmedBy: managerId });
          const closedAt = new Date(`${dateStr}T18:00:00`);
          await client.query(
            `UPDATE object_shifts SET closed_at = $1 WHERE id = $2`,
            [closedAt.toISOString(), shift.id]
          );

          if (i % 5 === 0) {
            console.log(`   ✅ Смена ${dateStr} (завершена)`);
          }
        }
      }
    }

    // 6. Создаем сегодняшнюю смену (начата, но не завершена)
    const todayStr = today.toISOString().split('T')[0];
    console.log(`\n📅 Создание сегодняшней смены (${todayStr})...`);
    
    let todayShift = await shiftRepo.findByObjectAndDate(object.id, todayStr);
    
    if (!todayShift) {
      todayShift = await shiftRepo.create({
        workObjectId: object.id,
        date: todayStr,
        plannedStart: new Date(`${todayStr}T08:00:00`).toISOString(),
        plannedEnd: new Date(`${todayStr}T18:00:00`).toISOString(),
        lunchMinutes: 30
      });
    }

    if (todayShift && todayShift.status === 'planned') {
      // Подтверждаем начало смены
      await shiftRepo.confirmStart(todayShift.id, { confirmedBy: managerId });
      
      const startedAt = new Date(`${todayStr}T08:10:00`);
      await client.query(
        `UPDATE object_shifts SET started_at = $1 WHERE id = $2`,
        [startedAt.toISOString(), todayShift.id]
      );

      // Создаем work_logs для всех сотрудников (без actual_end)
      for (const employee of employees) {
        await workLogRepo.create({
          employeeId: employee.id,
          workObjectId: object.id,
          objectShiftId: todayShift.id,
          date: todayStr,
          actualStart: new Date(`${todayStr}T08:10:00`).toISOString(),
          createdBy: managerId
        });
      }

      console.log(`✅ Сегодняшняя смена создана и начата (ID: ${todayShift.id})`);
      console.log(`   Статус: started`);
      console.log(`   Work_logs созданы для ${employees.length} сотрудников (без actual_end)`);
    } else if (todayShift) {
      console.log(`ℹ️  Сегодняшняя смена уже существует (статус: ${todayShift.status})`);
    }

    await client.query('COMMIT');

    console.log(`\n✅ Mock данные успешно созданы!`);
    console.log(`\n📊 Сводка:`);
    console.log(`   Объект ID: ${object.id}`);
    console.log(`   Сотрудников: ${employees.length}`);
    console.log(`   Смен создано: ~30 (включая сегодняшнюю)`);
    console.log(`   Сегодняшняя смена ID: ${todayShift?.id || 'не создана'}`);
    console.log(`\n💡 Для завершения сегодняшней смены используйте команду:`);
    console.log(`   callback: object:shift:confirm:end|${object.id}|${todayShift?.id || 'SHIFT_ID'}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Ошибка при создании mock данных:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Запускаем если вызван напрямую (используем URL для определения прямого запуска)
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.includes('createMockData.js');

if (isMainModule) {
  createMockData()
    .then(() => {
      console.log('\n✅ Готово!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Ошибка:', error);
      process.exit(1);
    });
}

export { createMockData };

