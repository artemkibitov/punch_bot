/**
 * Скрипт для создания mock данных
 * - админ
 * - объект
 * - сотрудники
 * - назначения
 * - смены за 30 дней + сегодня
 * - work_logs
 */

import { getPool } from '../app/infrastructure/database/pool.js';
import '../app/infrastructure/config/env.js';

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
    console.log('🔵 Создание mock данных...\n');

    /* ------------------------------------------------------------------ */
    /* 1. Админ                                                           */
    /* ------------------------------------------------------------------ */
    const { rows: adminRows } = await client.query(`
      SELECT e.id
      FROM employees e
      JOIN roles r ON r.id = e.role_id
      WHERE r.code = 'MANAGER'
      LIMIT 1
    `);

    let managerId;

    if (adminRows.length) {
      managerId = adminRows[0].id;
      console.log(`✅ Используем существующего админа (ID: ${managerId})`);
    } else {
      const admin = await employeeRepo.createAdmin({
        telegramUserId: 123456789,
        fullName: 'Admin User'
      });
      managerId = admin.id;
      console.log(`✅ Создан админ (ID: ${managerId})`);
    }

    /* ------------------------------------------------------------------ */
    /* 2. Объект                                                          */
    /* ------------------------------------------------------------------ */
    const object = await objectRepo.create({
      managerId,
      name: 'Mock Объект',
      timezone: 'Europe/Moscow',
      plannedStart: '08:00',
      plannedEnd: '18:00',
      lunchMinutes: 30
    });

    console.log(`✅ Создан объект: ${object.name} (ID: ${object.id})`);

    /* ------------------------------------------------------------------ */
    /* 3. Сотрудники                                                      */
    /* ------------------------------------------------------------------ */
    const employeesData = [
      { name: 'Иванов Иван', telegramId: 111111111 },
      { name: 'Петров Петр', telegramId: 222222222 },
      { name: 'Сидоров Сидор', telegramId: 333333333 }
    ];

    const employees = [];

    for (const data of employeesData) {
      const employee = await employeeRepo.createEmployee({
        fullName: data.name,
        createdBy: managerId
      });

      if (data.telegramId) {
        await client.query(
          `UPDATE employees SET telegram_user_id = $1 WHERE id = $2`,
          [data.telegramId, employee.id]
        );
      }

      employees.push(employee);
      console.log(`✅ Создан сотрудник: ${employee.full_name} (ID: ${employee.id})`);
    }

    /* ------------------------------------------------------------------ */
    /* 4. Назначение сотрудников на объект (ОДИН РАЗ)                     */
    /* ------------------------------------------------------------------ */
    for (const employee of employees) {
      try {
        await assignmentRepo.assign({
          employeeId: employee.id,
          workObjectId: object.id,
          assignedBy: managerId
        });
        console.log(`✅ ${employee.full_name} назначен на объект`);
      } catch (e) {
        if (e.message.includes('already assigned')) {
          console.log(`ℹ️  ${employee.full_name} уже назначен`);
        } else {
          throw e;
        }
      }
    }

    /* ------------------------------------------------------------------ */
    /* 5. Смены за последние 30 дней                                       */
    /* ------------------------------------------------------------------ */
    console.log('\n📅 Создание смен за последние 30 дней...\n');

    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 30);

    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      const dateStr = date.toISOString().slice(0, 10);

      // findOrCreate смены
      let shift = await shiftRepo.findByObjectAndDate(object.id, dateStr);

      if (!shift) {
        shift = await shiftRepo.create({
          workObjectId: object.id,
          date: dateStr,
          plannedStart: new Date(`${dateStr}T08:00:00`).toISOString(),
          plannedEnd: new Date(`${dateStr}T18:00:00`).toISOString(),
          lunchMinutes: 30
        });
      }

      // пропускаем сегодняшний день
      if (i === 29) continue;

      await shiftRepo.confirmStart(shift.id, { confirmedBy: managerId });

      // work_logs
      for (const employee of employees) {
        const workLog = await workLogRepo.create({
          employeeId: employee.id,
          workObjectId: object.id,
          objectShiftId: shift.id,
          date: dateStr,
          actualStart: new Date(`${dateStr}T08:15:00`).toISOString(),
          createdBy: managerId
        });

        const actualEnd = new Date(`${dateStr}T17:00:00`);
        actualEnd.setMinutes(
          actualEnd.getMinutes() + (Math.floor(Math.random() * 60) + 15)
        );

        await workLogRepo.updateEnd(workLog.id, {
          actualEnd: actualEnd.toISOString(),
          updatedBy: managerId
        });
      }

      await shiftRepo.confirmEnd(shift.id, { confirmedBy: managerId });

      if (i % 5 === 0) {
        console.log(`   ✅ Смена ${dateStr} завершена`);
      }
    }

    /* ------------------------------------------------------------------ */
    /* 6. Сегодняшняя смена                                                */
    /* ------------------------------------------------------------------ */
    const todayStr = today.toISOString().slice(0, 10);

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

    if (todayShift.status === 'planned') {
      await shiftRepo.confirmStart(todayShift.id, { confirmedBy: managerId });

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

      console.log(`\n✅ Сегодняшняя смена начата (ID: ${todayShift.id})`);
    }

    console.log('\n✅ Mock данные успешно созданы');
  } catch (error) {
    console.error('❌ Ошибка при создании mock данных:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

/* -------------------------------------------------------------------- */

if (import.meta.url === `file://${process.argv[1]}`) {
  createMockData()
    .then(() => {
      console.log('\n✅ Готово!');
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

export { createMockData };
