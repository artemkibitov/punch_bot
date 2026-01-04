# 📘 ТЕХНИЧЕСКОЕ ЗАДАНИЕ
## EPIC: Roles, Objects, Employees, Shifts

**Версия:** 1.0  
**Дата:** 2025-01-XX  
**Статус:** В разработке

---

## 📋 СОДЕРЖАНИЕ

1. [Общая бизнес-модель](#1-общая-бизнес-модель)
2. [Роли и права доступа](#2-роли-и-права-доступа)
3. [Сущности домена](#3-сущности-домена)
4. [Схема базы данных](#4-схема-базы-данных)
5. [FSM состояния и сценарии](#5-fsm-состояния-и-сценарии)
6. [API репозиториев](#6-api-репозиториев)
7. [Технические требования](#7-технические-требования)
8. [Разделение задач](#8-разделение-задач)

---

## 1. ОБЩАЯ БИЗНЕС-МОДЕЛЬ

Система предназначена для **учёта сотрудников и рабочих смен на объектах**, управляемых через Telegram-бота.

### Ключевые принципы:

- **FSM-first**: все пользовательские сценарии управляются через FSM
- **Ролевая модель**: Admin → Manager → Employee
- **Иерархия объектов**: Manager → Object → Employee
- **Аудит**: все изменения фиксируются с указанием автора и времени

---

## 2. РОЛИ И ПРАВА ДОСТУПА

### 2.1 Admin

**Сущность:** Глобальный администратор системы

**Права:**
- ✅ Просмотр всех сущностей (managers, employees, objects, shifts)
- ✅ Создание/редактирование/удаление:
  - managers
  - employees
  - objects
- ✅ Редактирование:
  - графики объектов
  - смены (planned и actual)
  - фактические часы работы (workLogs)
- ✅ Принудительное исправление любых данных
- ✅ Доступ к отчётам и истории изменений
- ✅ Управление реферальными ссылками

**Ограничения:** отсутствуют

**Реализация:**
- Admin может выполнять **любой сценарий manager'а**
- Все запросы к репозиториям для Admin должны игнорировать фильтры по managerId

---

### 2.2 Manager

**Сущность:** Управляющий объектами и сотрудниками

**Права:**
- ✅ Создание объектов
- ✅ Редактирование **только своих объектов**
- ✅ Назначение сотрудников на объекты
- ✅ Снятие сотрудников с объектов
- ✅ Создание реферальных ссылок для привязки сотрудников
- ✅ Управление сменами сотрудников **на своих объектах**
- ✅ Подтверждение начала/окончания смен
- ✅ Индивидуальная корректировка времени работы сотрудников

**Ограничения:**
- ❌ Не видит чужих managers
- ❌ Не видит объекты других managers
- ❌ Не может править глобальные справочники

**Реализация:**
- Все запросы к репозиториям для Manager должны фильтроваться по `managerId`
- Manager может быть также Employee (dual role)

---

### 2.3 Employee (Работник)

**Сущность:** Пассивная сущность, выполняющая работу

**Права:**
- ✅ Привязка Telegram-аккаунта по ref-ссылке
- ✅ Просмотр:
  - своих смен
  - истории работы
  - статистики по часам
- ✅ Опциональное подтверждение:
  - начала смены (check-in)
  - окончания смены (check-out)

**Ограничения:**
- ❌ Не управляет объектами
- ❌ Не видит других сотрудников
- ❌ Не может создавать/редактировать смены

**Реализация:**
- Employee может быть назначен на несколько объектов
- Employee может работать на разных объектах в один день (разные смены)

---

## 3. СУЩНОСТИ ДОМЕНА

### 3.1 Manager

**Таблица:** `employees` (с `role_id = MANAGER`)

**Поля:**
```sql
id              INTEGER PRIMARY KEY
telegram_user_id BIGINT UNIQUE NOT NULL
full_name        TEXT NOT NULL
role_id          INTEGER → roles(id) [MANAGER]
status           TEXT [active, blocked] DEFAULT 'active'
created_by       INTEGER → employees(id) [nullable, для админа]
created_at       TIMESTAMP
updated_at       TIMESTAMP
```

**Связи:**
- 1 → N `work_objects` (через `manager_id`)
- 1 → N `employees` (через assignments на объектах)

**Бизнес-правила:**
- Manager создаётся через onboarding (PIN + имя)
- Manager может быть заблокирован админом
- Manager может быть также Employee (dual role)

---

### 3.2 Object (Объект / Work Object)

**Таблица:** `work_objects`

**Поля:**
```sql
id              INTEGER PRIMARY KEY
manager_id      INTEGER → employees(id) [NOT NULL]
name            TEXT NOT NULL
timezone        TEXT NOT NULL DEFAULT 'UTC' [IANA timezone]
planned_start   TIME NOT NULL [например, '08:00']
planned_end     TIME NOT NULL [например, '18:00']
lunch_minutes   INTEGER NOT NULL DEFAULT 30
status          work_object_status [ACTIVE, ARCHIVED] DEFAULT 'ACTIVE'
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**Связи:**
- N → M `employees` (через `assignments`)
- 1 → N `shifts` (по дням)

**Бизнес-правила:**
- График объекта (`planned_start`, `planned_end`, `lunch_minutes`) — базовый для всех сотрудников
- Может быть переопределён индивидуально для сотрудника (в `work_logs`)
- Объект может быть архивирован (не удаляется)
- Timezone объекта используется для всех триггеров и расчётов

---

### 3.3 Employee (Работник)

**Таблица:** `employees` (с `role_id = EMPLOYEE`)

**Поля:**
```sql
id              INTEGER PRIMARY KEY
telegram_user_id BIGINT UNIQUE [nullable, до привязки]
full_name       TEXT NOT NULL
role_id         INTEGER → roles(id) [EMPLOYEE]
status          TEXT [active, inactive] DEFAULT 'active'
ref_code        TEXT UNIQUE [nullable, для привязки]
ref_code_expires_at TIMESTAMP [nullable]
created_by      INTEGER → employees(id) [manager, который создал]
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**Связи:**
- N → M `work_objects` (через `assignments`)
- 1 → N `work_logs` (фактические часы работы)
- 1 → N `shifts` (планируемые смены)

**Бизнес-правила:**
- Employee создаётся manager'ом (без telegramId)
- Привязка Telegram происходит по ref-ссылке
- Employee может работать на нескольких объектах одновременно
- Employee может иметь несколько смен в день (на разных объектах)

---

### 3.4 Assignment (Назначение сотрудника на объект)

**Таблица:** `assignments` (уже существует, но нужно обновить)

**Текущая структура:**
```sql
id              INTEGER PRIMARY KEY
employee_id     INTEGER → employees(id)
work_object_id  INTEGER → work_objects(id)
assigned_at     TIMESTAMP
unassigned_at   TIMESTAMP [nullable]
```

**Нужно обновить:**
```sql
ALTER TABLE assignments
  ADD COLUMN assigned_by INTEGER REFERENCES employees(id);

-- Обновить существующие записи (если возможно определить)
-- UPDATE assignments SET assigned_by = ... WHERE assigned_by IS NULL;
```

**Бизнес-правила:**
- Сотрудник может быть назначен на несколько объектов
- Снятие с объекта не удаляет запись, ставит `unassigned_at`
- Активные назначения: `unassigned_at IS NULL`

---

### 3.5 Shift (Смена)

**Таблица:** `shifts`

**Поля:**
```sql
id              INTEGER PRIMARY KEY
work_object_id  INTEGER → work_objects(id)
date            DATE NOT NULL
planned_start   TIMESTAMP NOT NULL [date + planned_start из объекта]
planned_end     TIMESTAMP NOT NULL [date + planned_end из объекта]
lunch_minutes   INTEGER NOT NULL [из объекта]
status          TEXT [planned, started, closed] DEFAULT 'planned'
started_at      TIMESTAMP [nullable, когда manager подтвердил начало]
closed_at       TIMESTAMP [nullable, когда manager подтвердил окончание]
confirmed_by    INTEGER → employees(id) [manager, который подтвердил]
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**Бизнес-правила:**
- Смена создаётся автоматически для каждого объекта на каждый рабочий день
- Статусы:
  - `planned`: создана, но не началась
  - `started`: manager подтвердил начало, созданы work_logs
  - `closed`: manager подтвердил окончание, все work_logs закрыты
- Смена может быть переподтверждена (корректировка)

---

### 3.6 WorkLog (Фактический учёт времени)

**Таблица:** `work_logs` (новая таблица)

**Поля:**
```sql
id              INTEGER PRIMARY KEY
employee_id     INTEGER → employees(id)
work_object_id  INTEGER → work_objects(id)
shift_id        INTEGER → shifts(id) [nullable, если индивидуальная корректировка]
date            DATE NOT NULL
actual_start    TIMESTAMP NOT NULL
actual_end      TIMESTAMP [nullable, до закрытия смены]
lunch_minutes   INTEGER DEFAULT 0
is_override     BOOLEAN DEFAULT false [true, если индивидуальная корректировка]
created_by      INTEGER → employees(id) [manager или admin]
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

**Бизнес-правила:**
- WorkLog создаётся при подтверждении начала смены
- `actual_end` заполняется при подтверждении окончания
- Индивидуальная корректировка: `is_override = true`
- WorkLog может быть создан/изменён только manager'ом или admin'ом

---

### 3.7 ReferralToken (Реферальная ссылка)

**Таблица:** `referral_tokens` (уже существует, но структура отличается)

**Текущая структура:**
```sql
id              INTEGER PRIMARY KEY
token           TEXT UNIQUE NOT NULL
manager_id      INTEGER → employees(id) [NOT NULL]
expires_at      TIMESTAMP NOT NULL
used_at         TIMESTAMP [nullable]
created_at      TIMESTAMP
```

**Нужно обновить:**
```sql
-- Добавить employee_id для привязки к конкретному сотруднику
ALTER TABLE referral_tokens
  ADD COLUMN employee_id INTEGER REFERENCES employees(id);

-- Обновить бизнес-логику:
-- Если employee_id указан → привязка к конкретному сотруднику
-- Если employee_id NULL → создание нового сотрудника при активации
```

**Бизнес-правила:**
- Token одноразовый (`used_at` фиксирует использование)
- Может иметь TTL (`expires_at`)
- При использовании связывает `telegram_user_id` с `employee_id`
- Если `employee_id` NULL → создаётся новый сотрудник

---

### 3.8 AuditLog (История изменений)

**Таблица:** `audit_logs` (новая таблица)

**Поля:**
```sql
id              INTEGER PRIMARY KEY
entity_type     TEXT NOT NULL [employees, work_objects, shifts, work_logs]
entity_id       INTEGER NOT NULL
action          TEXT NOT NULL [create, update, delete]
field_name      TEXT [nullable, для update]
old_value       JSONB [nullable]
new_value       JSONB [nullable]
changed_by      INTEGER → employees(id) [NOT NULL]
changed_at      TIMESTAMP NOT NULL DEFAULT now()
metadata        JSONB [дополнительная информация]
```

**Бизнес-правила:**
- Все изменения критичных сущностей фиксируются
- Admin может видеть полную историю
- Manager видит только изменения по своим объектам

---

## 4. СХЕМА БАЗЫ ДАННЫХ

### 4.1 Новые миграции

#### Миграция 012: Добавить роль ADMIN

```sql
-- Добавить ADMIN в role_type enum
ALTER TYPE role_type ADD VALUE 'ADMIN';

-- Вставить роль ADMIN
INSERT INTO roles (code) VALUES ('ADMIN');
```

#### Миграция 013: Расширить work_objects

**Примечание:** Таблица `work_objects` уже существует, нужно добавить поля.

```sql
ALTER TABLE work_objects
  ADD COLUMN manager_id INTEGER REFERENCES employees(id),
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN planned_start TIME NOT NULL DEFAULT '08:00',
  ADD COLUMN planned_end TIME NOT NULL DEFAULT '18:00',
  ADD COLUMN lunch_minutes INTEGER NOT NULL DEFAULT 30;

-- Обновить существующие объекты: manager_id = created_by
UPDATE work_objects SET manager_id = created_by WHERE manager_id IS NULL;

-- Сделать manager_id обязательным
ALTER TABLE work_objects
  ALTER COLUMN manager_id SET NOT NULL;
```

#### Миграция 014: Создать work_logs

```sql
CREATE TABLE work_logs (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  work_object_id INTEGER NOT NULL REFERENCES work_objects(id),
  shift_id INTEGER REFERENCES shifts(id),
  date DATE NOT NULL,
  actual_start TIMESTAMP NOT NULL,
  actual_end TIMESTAMP,
  lunch_minutes INTEGER NOT NULL DEFAULT 0,
  is_override BOOLEAN NOT NULL DEFAULT false,
  created_by INTEGER NOT NULL REFERENCES employees(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_logs_employee_date 
  ON work_logs(employee_id, date);
CREATE INDEX idx_work_logs_work_object_date 
  ON work_logs(work_object_id, date);
CREATE INDEX idx_work_logs_shift 
  ON work_logs(shift_id);
```

#### Миграция 015: Обновить shifts

**Примечание:** Таблица `shifts` уже существует, но структура отличается. Нужно пересмотреть модель.

**Вариант 1 (рекомендуемый):** Смена относится к объекту, а не к сотруднику.

```sql
-- Добавить поля для новой модели
ALTER TABLE shifts
  ADD COLUMN status TEXT NOT NULL DEFAULT 'planned',
  ADD COLUMN started_at TIMESTAMP,
  ADD COLUMN closed_at TIMESTAMP,
  ADD COLUMN confirmed_by INTEGER REFERENCES employees(id),
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT now();

-- ВАЖНО: Текущая структура shifts (employee_id) не соответствует новой модели
-- Нужно решить: мигрировать существующие данные или создать новую таблицу
-- Предложение: оставить старую таблицу для истории, создать новую для новой модели
```

**Вариант 2:** Адаптировать текущую структуру под новую модель (смена = объект + дата, не привязана к сотруднику).

```sql
-- Удалить employee_id из shifts (если он есть)
-- Смена теперь относится только к объекту
ALTER TABLE shifts
  DROP COLUMN IF EXISTS employee_id,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'planned',
  ADD COLUMN started_at TIMESTAMP,
  ADD COLUMN closed_at TIMESTAMP,
  ADD COLUMN confirmed_by INTEGER REFERENCES employees(id),
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT now();
```

#### Миграция 016: Создать audit_logs

```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value JSONB,
  new_value JSONB,
  changed_by INTEGER NOT NULL REFERENCES employees(id),
  changed_at TIMESTAMP NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE INDEX idx_audit_logs_entity 
  ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_changed_by 
  ON audit_logs(changed_by);
CREATE INDEX idx_audit_logs_changed_at 
  ON audit_logs(changed_at);
```

#### Миграция 017: Расширить employees

```sql
ALTER TABLE employees
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN ref_code TEXT UNIQUE,
  ADD COLUMN ref_code_expires_at TIMESTAMP,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT now();
```

---

## 5. FSM СОСТОЯНИЯ И СЦЕНАРИИ

### 5.1 Новые состояния

```javascript
// app/domain/fsm/states.js

export const STATES = Object.freeze({
  // ... существующие ...
  
  // Admin
  ADMIN_MENU: 'ADMIN_MENU',
  ADMIN_OBJECTS_LIST: 'ADMIN_OBJECTS_LIST',
  ADMIN_EMPLOYEES_LIST: 'ADMIN_EMPLOYEES_LIST',
  
  // Manager - Objects
  MANAGER_OBJECTS_LIST: 'MANAGER_OBJECTS_LIST',
  OBJECT_CREATE_ENTER_NAME: 'OBJECT_CREATE_ENTER_NAME',
  OBJECT_CREATE_ENTER_SCHEDULE: 'OBJECT_CREATE_ENTER_SCHEDULE',
  OBJECT_DETAILS: 'OBJECT_DETAILS',
  OBJECT_EDIT: 'OBJECT_EDIT',
  
  // Manager - Employees
  OBJECT_EMPLOYEES_LIST: 'OBJECT_EMPLOYEES_LIST',
  EMPLOYEE_CREATE_ENTER_NAME: 'EMPLOYEE_CREATE_ENTER_NAME',
  EMPLOYEE_DETAILS: 'EMPLOYEE_DETAILS',
  EMPLOYEE_EDIT_TIME: 'EMPLOYEE_EDIT_TIME',
  
  // Manager - Shifts
  SHIFT_START_CONFIRMATION: 'SHIFT_START_CONFIRMATION',
  SHIFT_START_MARK_ABSENT: 'SHIFT_START_MARK_ABSENT',
  SHIFT_START_ENTER_ABSENT_IDS: 'SHIFT_START_ENTER_ABSENT_IDS',
  SHIFT_END_CONFIRMATION: 'SHIFT_END_CONFIRMATION',
  SHIFT_END_MARK_OVERTIME: 'SHIFT_END_MARK_OVERTIME',
  SHIFT_END_ENTER_OVERTIME_IDS: 'SHIFT_END_ENTER_OVERTIME_IDS',
  SHIFT_END_ENTER_OVERTIME_TIME: 'SHIFT_END_ENTER_OVERTIME_TIME',
  
  // Employee
  EMPLOYEE_REF_LINK_ACTIVATE: 'EMPLOYEE_REF_LINK_ACTIVATE',
});
```

### 5.2 Сценарии FSM

#### Сценарий 1: Создание объекта (Manager)

```
MANAGER_MENU
  → [object:create] → OBJECT_CREATE_ENTER_NAME
    → [text: "Название объекта"] → OBJECT_CREATE_ENTER_SCHEDULE
      → [text: "08:00 18:00 30"] → OBJECT_DETAILS
        → [back] → MANAGER_OBJECTS_LIST
```

**Файлы:**
- `app/application/fsm/states/objectCreateEnterName.js`
- `app/application/fsm/states/objectCreateEnterSchedule.js`

#### Сценарий 2: Подтверждение начала смены (Manager)

```
[Триггер: planned_start объекта]
  → SHIFT_START_CONFIRMATION
    → [all_present] → [создать work_logs] → MANAGER_MENU
    → [mark_absent] → SHIFT_START_MARK_ABSENT
      → SHIFT_START_ENTER_ABSENT_IDS
        → [text: "2 12"] → [валидация] → [создать work_logs] → MANAGER_MENU
```

**Файлы:**
- `app/application/fsm/states/shiftStartConfirmation.js`
- `app/application/fsm/states/shiftStartMarkAbsent.js`
- `app/application/fsm/states/shiftStartEnterAbsentIds.js`

#### Сценарий 3: Подтверждение окончания смены (Manager)

```
[Триггер: planned_end объекта]
  → SHIFT_END_CONFIRMATION
    → [all_finished] → [закрыть work_logs] → MANAGER_MENU
    → [mark_overtime] → SHIFT_END_MARK_OVERTIME
      → SHIFT_END_ENTER_OVERTIME_IDS
        → [text: "5 7"] → SHIFT_END_ENTER_OVERTIME_TIME
          → [text: "19:30"] → [обновить work_logs] → MANAGER_MENU
```

**Файлы:**
- `app/application/fsm/states/shiftEndConfirmation.js`
- `app/application/fsm/states/shiftEndMarkOvertime.js`
- `app/application/fsm/states/shiftEndEnterOvertimeIds.js`
- `app/application/fsm/states/shiftEndEnterOvertimeTime.js`

#### Сценарий 4: Активация ref-ссылки (Employee)

```
[Переход по ссылке: /start?ref=TOKEN]
  → EMPLOYEE_REF_LINK_ACTIVATE
    → [валидация token] → [привязка telegramId] → EMPLOYEE_MENU
```

**Файлы:**
- `app/application/fsm/states/employeeRefLinkActivate.js`

---

## 6. API РЕПОЗИТОРИЕВ

### 6.1 ObjectRepository

**Файл:** `app/infrastructure/repositories/objectRepository.js`

```javascript
class ObjectRepository {
  // Создание объекта
  async create({ managerId, name, timezone, plannedStart, plannedEnd, lunchMinutes })
  
  // Получение объектов менеджера (с фильтром для Admin)
  async findByManagerId(managerId, { includeArchived = false })
  
  // Получение объекта по ID (с проверкой прав)
  async findById(objectId, { managerId = null, isAdmin = false })
  
  // Обновление объекта
  async update(objectId, updates, { managerId = null, isAdmin = false })
  
  // Архивация объекта
  async archive(objectId, { managerId = null, isAdmin = false })
  
  // Получение активных объектов для триггеров
  async findActiveForTrigger(date, time)
}
```

### 6.2 EmployeeRepository (расширение)

**Добавить методы:**

```javascript
// Создание сотрудника (без telegramId)
async createEmployee({ fullName, createdBy })

// Поиск по ref_code
async findByRefCode(refCode)

// Привязка Telegram
async linkTelegram(employeeId, telegramUserId)

// Получение сотрудников объекта
async findByObjectId(objectId, { managerId = null, isAdmin = false })

// Получение сотрудников менеджера
async findByManagerId(managerId, { includeInactive = false })
```

### 6.3 AssignmentRepository

**Файл:** `app/infrastructure/repositories/assignmentRepository.js`

```javascript
class AssignmentRepository {
  // Назначение сотрудника на объект
  async assign({ employeeId, workObjectId, assignedBy })
  
  // Снятие сотрудника с объекта
  async remove({ employeeId, workObjectId, removedBy })
  
  // Получение активных назначений объекта
  async findActiveByObjectId(objectId)
  
  // Получение объектов сотрудника
  async findObjectsByEmployeeId(employeeId)
}
```

### 6.4 ShiftRepository

**Файл:** `app/infrastructure/repositories/shiftRepository.js`

```javascript
class ShiftRepository {
  // Создание смены (автоматически)
  async create({ workObjectId, date, plannedStart, plannedEnd, lunchMinutes })
  
  // Получение смены объекта на дату
  async findByObjectAndDate(objectId, date)
  
  // Подтверждение начала смены
  async confirmStart(shiftId, { confirmedBy })
  
  // Подтверждение окончания смены
  async confirmEnd(shiftId, { confirmedBy })
  
  // Получение смен для триггеров
  async findForTrigger(date, time, status)
}
```

### 6.5 WorkLogRepository

**Файл:** `app/infrastructure/repositories/workLogRepository.js`

```javascript
class WorkLogRepository {
  // Создание work_log (при подтверждении начала)
  async create({ employeeId, workObjectId, shiftId, date, actualStart, createdBy })
  
  // Обновление work_log (при подтверждении окончания)
  async updateEnd(workLogId, { actualEnd, updatedBy })
  
  // Получение work_logs сотрудника
  async findByEmployeeId(employeeId, { dateFrom, dateTo })
  
  // Получение work_logs объекта на дату
  async findByObjectAndDate(objectId, date)
  
  // Индивидуальная корректировка
  async createOverride({ employeeId, workObjectId, date, actualStart, actualEnd, createdBy })
}
```

### 6.6 AuditLogRepository

**Файл:** `app/infrastructure/repositories/auditLogRepository.js`

```javascript
class AuditLogRepository {
  // Логирование изменения
  async log({ entityType, entityId, action, fieldName, oldValue, newValue, changedBy, metadata })
  
  // Получение истории сущности
  async findByEntity(entityType, entityId, { managerId = null, isAdmin = false })
}
```

---

## 7. ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ

### 7.1 Триггеры смен

**Файл:** `app/infrastructure/scheduler/shiftTrigger.js`

**Задача:** Периодически (каждую минуту) проверять объекты и создавать триггеры для смен.

**Логика:**
1. Получить все активные объекты
2. Для каждого объекта проверить:
   - Есть ли смена на сегодня?
   - Если нет → создать смену со статусом `planned`
   - Если `planned` и время = `planned_start` → отправить уведомление manager'у
   - Если `started` и время = `planned_end` → отправить уведомление manager'у

**Реализация:**
- Использовать `node-cron` или подобное
- Учитывать timezone объекта
- Обрабатывать ошибки gracefully

### 7.2 Валидация в FSM

**Принципы:**
- Все пользовательские вводы валидируются в `onInput`
- При ошибке валидации остаёмся в том же состоянии
- Показываем понятное сообщение об ошибке

**Примеры валидации:**
- ID сотрудников: только числа, разделённые пробелами
- Время: формат HH:MM, валидные значения
- Название объекта: не пустое, max 100 символов

### 7.3 Обработка ошибок

**Стратегия:**
- Все ошибки логируются в `audit_logs`
- Пользователю показывается понятное сообщение
- FSM переходит в безопасное состояние (обычно меню)

### 7.4 Безопасность

**Проверки:**
- Manager может работать только со своими объектами
- Admin может работать со всеми объектами
- Employee может видеть только свои данные
- Все изменения фиксируются в `audit_logs`

---

## 8. РАЗДЕЛЕНИЕ ЗАДАЧ

### 8.1 Backend Developer #1: Репозитории и миграции

**Задачи:**
1. ✅ Создать миграции 012-017
2. ✅ Реализовать `ObjectRepository`
3. ✅ Реализовать `AssignmentRepository`
4. ✅ Реализовать `ShiftRepository`
5. ✅ Реализовать `WorkLogRepository`
6. ✅ Реализовать `AuditLogRepository`
7. ✅ Расширить `EmployeeRepository` (новые методы)

**Критерии готовности:**
- Все миграции проходят успешно
- Все методы репозиториев покрыты базовыми тестами
- Репозитории возвращают правильные данные с учётом прав доступа

---

### 8.2 Backend Developer #2: Бизнес-логика и сервисы

**Задачи:**
1. ✅ Создать `ObjectService` (создание, обновление объектов)
2. ✅ Создать `EmployeeService` (создание, назначение на объекты)
3. ✅ Создать `ShiftService` (подтверждение начала/окончания)
4. ✅ Создать `WorkLogService` (создание, обновление work_logs)
5. ✅ Создать `ReferralService` (генерация и валидация ref-ссылок)
6. ✅ Создать `ShiftTriggerService` (автоматические триггеры)
7. ✅ Интегрировать `AuditLogRepository` во все сервисы

**Критерии готовности:**
- Все сервисы покрыты unit-тестами
- Логика прав доступа работает корректно
- Триггеры смен работают по расписанию

---

### 8.3 FSM Developer: Состояния и сценарии

**Задачи:**
1. ✅ Создать состояния для меню (Admin, Manager Objects, Employee)
2. ✅ Создать состояния для создания объектов
3. ✅ Создать состояния для управления сотрудниками
4. ✅ Создать состояния для подтверждения смен
5. ✅ Создать состояния для активации ref-ссылок
6. ✅ Обновить transitions в `transitions.js`
7. ✅ Создать callback handlers для новых действий

**Критерии готовности:**
- Все состояния регистрируются корректно
- Все сценарии проходят end-to-end
- Валидация работает во всех состояниях
- Обработка ошибок корректна

---

### 8.4 Общие задачи (все разработчики)

**Задачи:**
1. ✅ Обновить `resolveStartFlow` для учёта Admin
2. ✅ Создать middleware для проверки прав доступа
3. ✅ Обновить UI компоненты (меню, клавиатуры)
4. ✅ Добавить логирование во все критические операции
5. ✅ Написать документацию по API репозиториев

---

## 9. ПРИОРИТЕТЫ РЕАЛИЗАЦИИ

### Phase 1: Базовая инфраструктура (Week 1)
- Миграции БД
- Репозитории (Object, Assignment, Shift, WorkLog)
- Базовые сервисы

### Phase 2: FSM сценарии (Week 2)
- Создание объектов
- Управление сотрудниками
- Базовое подтверждение смен

### Phase 3: Продвинутые функции (Week 3)
- Триггеры смен
- Индивидуальная корректировка времени
- Ref-ссылки
- Audit logs

### Phase 4: Admin функционал (Week 4)
- Admin меню
- Глобальный доступ
- Отчёты

---

## 10. КРИТЕРИИ ПРИЁМКИ

### Функциональные:
- ✅ Manager может создать объект
- ✅ Manager может назначить сотрудника на объект
- ✅ Manager может подтвердить начало смены (все/с исключениями)
- ✅ Manager может подтвердить окончание смены (все/с переработкой)
- ✅ Employee может привязать Telegram по ref-ссылке
- ✅ Admin может видеть и редактировать все данные
- ✅ Триггеры смен работают автоматически

### Технические:
- ✅ Все миграции проходят успешно
- ✅ Все репозитории покрыты тестами
- ✅ Все FSM состояния работают корректно
- ✅ Audit logs фиксируют все изменения
- ✅ Обработка ошибок работает везде

---

## 11. КРИТИЧЕСКИЕ РЕШЕНИЯ (ТРЕБУЮТ ПОДТВЕРЖДЕНИЯ)

### ⚠️ 11.1 Модель смен (Shifts)

**Проблема:** Текущая структура `shifts` имеет `employee_id`, что означает смену привязанную к сотруднику. Новая модель требует смену привязанную к объекту (объект + дата = смена).

**Варианты решения:**

**Вариант A (рекомендуемый):** Создать новую таблицу `object_shifts`
```sql
CREATE TABLE object_shifts (
  id SERIAL PRIMARY KEY,
  work_object_id INTEGER NOT NULL REFERENCES work_objects(id),
  date DATE NOT NULL,
  planned_start TIMESTAMP NOT NULL,
  planned_end TIMESTAMP NOT NULL,
  lunch_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  started_at TIMESTAMP,
  closed_at TIMESTAMP,
  confirmed_by INTEGER REFERENCES employees(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(work_object_id, date)
);
```

**Вариант B:** Мигрировать существующую таблицу `shifts`
- Удалить `employee_id`
- Добавить `date` (если нет)
- Изменить индексы

**Решение:** Выбрать вариант A или B (требует подтверждения)

---

### ⚠️ 11.2 Триггеры смен

**Вопрос:** Как реализовать автоматические триггеры для начала/окончания смен?

**Варианты:**
- **A:** Cron job (node-cron) - проверка каждую минуту
- **B:** PostgreSQL cron (pg_cron) - триггеры на уровне БД
- **C:** Внешний сервис (отдельный worker)

**Решение:** Выбрать вариант (рекомендация: A - node-cron)

---

### ⚠️ 11.3 Timezone объектов

**Вопрос:** Как хранить и использовать timezone?

**Варианты:**
- **A:** TEXT поле с IANA timezone (например, 'Europe/Moscow')
- **B:** INTEGER offset от UTC (минуты)
- **C:** Использовать библиотеку (например, `date-fns-tz`)

**Решение:** Выбрать вариант (рекомендация: A)

---

### ⚠️ 11.4 Ref-ссылки формат

**Вопрос:** Какой формат URL для активации ref-ссылки?

**Варианты:**
- **A:** `/start?ref=TOKEN` (query parameter)
- **B:** `/ref/TOKEN` (path parameter)
- **C:** Deep link `t.me/botname?start=ref-TOKEN`

**Решение:** Выбрать вариант (рекомендация: C - стандартный Telegram deep link)

---

## 12. ВОПРОСЫ ДЛЯ УТОЧНЕНИЯ

1. **Триггеры смен:** Как часто проверять? (предложение: каждую минуту)
2. **Timezone:** Как определять timezone объекта? (предложение: при создании, IANA format)
3. **Ref-ссылки:** Какой формат? (предложение: Telegram deep link `t.me/botname?start=ref-TOKEN`)
4. **Двойная роль:** Manager может быть Employee? (да, по ТЗ)
5. **Архивация:** Что происходит с архивными объектами? (не показываются в списках, но данные сохраняются)
6. **Модель смен:** Создать новую таблицу или мигрировать существующую? (требует решения)

---

## 13. ПРИОРИТЕТЫ И ЗАВИСИМОСТИ

### Блокер 1: Решение по модели смен
- ❌ Нельзя начинать разработку `ShiftRepository` без решения
- ❌ Нельзя создавать миграции без решения

### Блокер 2: Решение по триггерам
- ❌ Нельзя реализовывать автоматические уведомления без решения

### Не блокер, но важно:
- Timezone: можно начать с UTC, потом добавить
- Ref-ссылки: можно начать с простого формата, потом улучшить

---

**Конец документа**

