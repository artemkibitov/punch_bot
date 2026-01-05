# План рефакторинга архитектуры

## Текущее состояние

### Проблемы:
1. **Смешение ответственности**: FSM состояния напрямую создают и используют репозитории
2. **Нет четкого разделения**: Callbacks содержат бизнес-логику
3. **Tight coupling**: Сервисы создают репозитории внутри себя
4. **Отсутствие Use Cases**: Бизнес-логика размазана по состояниям и callbacks
5. **Нет Dependency Injection**: Сложно тестировать и менять реализации

### Текущая структура:
```
app/
├── application/        # Бизнес-логика (FSM, сервисы)
├── domain/            # Доменные модели (константы, FSM определения)
├── infrastructure/    # Инфраструктура (БД, репозитории)
├── transport/         # Транспортный слой (Telegram)
└── server/            # HTTP сервер
```

---

## Целевая архитектура (Clean Architecture / Layered Architecture)

### Слои:

#### 1. **Domain Layer** (Доменный слой)
**Ответственность**: Чистые бизнес-правила, сущности, константы
- Сущности (Employee, Object, Shift, WorkLog)
- Константы (ROLES, STATES, TRANSITIONS)
- Доменные правила (валидация, бизнес-логика)
- Интерфейсы репозиториев (порты)

**Файлы:**
```
app/domain/
├── entities/
│   ├── Employee.js
│   ├── WorkObject.js
│   ├── Shift.js
│   └── WorkLog.js
├── constants/
│   ├── roles.js
│   ├── states.js
│   └── ...
├── fsm/
│   ├── fsm.js
│   ├── states.js
│   └── transitions.js
└── repositories/      # Интерфейсы (порты)
    ├── IEmployeeRepository.js
    ├── IShiftRepository.js
    └── ...
```

#### 2. **Application Layer** (Слой приложения)
**Ответственность**: Use Cases, оркестрация бизнес-логики
- Use Cases (отдельные сценарии)
- Сервисы (координация между use cases)
- FSM обработчики (только координация, без бизнес-логики)

**Файлы:**
```
app/application/
├── usecases/
│   ├── shift/
│   │   ├── CreateShiftUseCase.js
│   │   ├── ConfirmShiftStartUseCase.js
│   │   ├── ConfirmShiftEndUseCase.js
│   │   └── AddEmployeeToShiftUseCase.js
│   ├── employee/
│   │   ├── CreateEmployeeUseCase.js
│   │   ├── LinkTelegramUseCase.js
│   │   └── GenerateRefCodeUseCase.js
│   ├── object/
│   │   ├── CreateObjectUseCase.js
│   │   ├── UpdateObjectUseCase.js
│   │   └── AssignEmployeeUseCase.js
│   └── worklog/
│       ├── CreateWorkLogUseCase.js
│       └── UpdateWorkLogUseCase.js
├── services/          # Сервисы координации
│   ├── DialogService.js
│   ├── MessageService.js
│   └── ReportService.js
└── fsm/
    ├── registry.js
    ├── router.js
    └── states/        # Только координация, делегируют use cases
        └── ...
```

#### 3. **Infrastructure Layer** (Инфраструктурный слой)
**Ответственность**: Реализация портов, работа с БД, внешние сервисы
- Репозитории (реализация интерфейсов)
- БД подключение
- Конфигурация

**Файлы:**
```
app/infrastructure/
├── repositories/      # Реализации репозиториев
│   ├── EmployeeRepository.js
│   ├── ShiftRepository.js
│   └── ...
├── database/
│   └── pool.js
├── config/
│   └── env.js
└── di/                # Dependency Injection контейнер
    └── container.js
```

#### 4. **Presentation Layer** (Слой представления)
**Ответственность**: UI, транспорт, адаптеры
- Telegram бот
- Callbacks (только маршрутизация к use cases)
- UI компоненты (меню, клавиатуры)
- HTTP сервер

**Файлы:**
```
app/presentation/      # Переименовать transport -> presentation
├── telegram/
│   ├── bot.js
│   ├── callbacks/     # Только маршрутизация
│   ├── commands/
│   ├── ui/
│   └── middleware/
└── http/
    └── server.js
```

---

## Зоны ответственности по модулям

### Модуль: Shift Management
- **Domain**: Shift entity, бизнес-правила смен
- **Application**: Use cases для работы со сменами
- **Infrastructure**: ShiftRepository
- **Presentation**: UI для управления сменами

### Модуль: Employee Management
- **Domain**: Employee entity, роли
- **Application**: Use cases для сотрудников
- **Infrastructure**: EmployeeRepository
- **Presentation**: UI для сотрудников

### Модуль: Object Management
- **Domain**: WorkObject entity
- **Application**: Use cases для объектов
- **Infrastructure**: ObjectRepository
- **Presentation**: UI для объектов

### Модуль: WorkLog Management
- **Domain**: WorkLog entity
- **Application**: Use cases для записей о работе
- **Infrastructure**: WorkLogRepository
- **Presentation**: UI для work logs

### Модуль: FSM/Dialog
- **Domain**: States, Transitions, FSM rules
- **Application**: DialogService, FSM router
- **Infrastructure**: SessionRepository
- **Presentation**: FSM state handlers

---

## Пошаговый план рефакторинга

### Этап 1: Подготовка структуры
1. ✅ Создать структуру папок для новых слоев
2. ✅ Создать DI контейнер
3. ✅ Определить интерфейсы репозиториев (опционально)

### Этап 2: Рефакторинг Shift модуля
1. Создать Shift entity в domain
2. Выделить Use Cases:
   - CreateShiftUseCase
   - ConfirmShiftStartUseCase
   - ConfirmShiftEndUseCase
   - AddEmployeeToShiftUseCase
   - RemoveEmployeeFromShiftUseCase
3. Рефакторинг ShiftService -> Use Cases
4. Обновить FSM состояния для использования use cases
5. Обновить callbacks для использования use cases

### Этап 3: Рефакторинг Employee модуля
1. Создать Employee entity
2. Выделить Use Cases:
   - CreateEmployeeUseCase
   - LinkTelegramUseCase
   - GenerateRefCodeUseCase
3. Обновить FSM состояния и callbacks

### Этап 4: Рефакторинг Object модуля
1. Создать WorkObject entity
2. Выделить Use Cases:
   - CreateObjectUseCase
   - UpdateObjectUseCase
   - AssignEmployeeToObjectUseCase
   - UnassignEmployeeFromObjectUseCase
3. Обновить FSM состояния и callbacks

### Этап 5: Рефакторинг WorkLog модуля
1. Создать WorkLog entity
2. Выделить Use Cases:
   - CreateWorkLogUseCase
   - UpdateWorkLogUseCase
3. Обновить FSM состояния и callbacks

### Этап 6: Финальная очистка
1. Удалить старые сервисы (ShiftService -> use cases)
2. Обновить все импорты
3. Обновить main.js
4. Тестирование

---

## Принципы разделения

### Dependency Rule
- **Domain** не зависит ни от чего
- **Application** зависит только от Domain
- **Infrastructure** зависит от Domain и Application (реализует порты)
- **Presentation** зависит от Application и Domain

### Dependency Injection
- Все зависимости передаются через конструктор
- Используется DI контейнер для управления зависимостями
- Репозитории и сервисы не создаются внутри классов

### Use Cases
- Один use case = один сценарий использования
- Use case получает зависимости через конструктор
- Use case возвращает результат или бросает исключение
- Use case не знает о транспорте (Telegram)

---

## Примеры рефакторинга

### До (текущий код):
```javascript
// app/application/fsm/states/objectShiftDetails.js
const shiftRepo = new ShiftRepository();
const workLogRepo = new WorkLogRepository();

registerState(STATES.OBJECT_SHIFT_DETAILS, {
  async onEnter(ctx) {
    const shift = await shiftRepo.findById(shiftId);
    const workLogs = await workLogRepo.findByObjectShiftId(shiftId);
    // ... форматирование и отправка
  }
});
```

### После (целевой код):
```javascript
// app/application/usecases/shift/GetShiftDetailsUseCase.js
export class GetShiftDetailsUseCase {
  constructor({ shiftRepository, workLogRepository }) {
    this.shiftRepo = shiftRepository;
    this.workLogRepo = workLogRepository;
  }

  async execute(shiftId) {
    const shift = await this.shiftRepo.findById(shiftId);
    const workLogs = await this.workLogRepo.findByObjectShiftId(shiftId);
    return { shift, workLogs };
  }
}

// app/application/fsm/states/objectShiftDetails.js
registerState(STATES.OBJECT_SHIFT_DETAILS, {
  async onEnter(ctx) {
    const useCase = container.get('GetShiftDetailsUseCase');
    const { shift, workLogs } = await useCase.execute(shiftId);
    // ... форматирование и отправка
  }
});
```

---

## Критерии готовности

- ✅ Все use cases выделены и протестированы
- ✅ Нет прямых зависимостей от репозиториев в FSM состояниях
- ✅ Callbacks только маршрутизируют к use cases
- ✅ DI контейнер настроен и используется
- ✅ Все импорты обновлены
- ✅ Приложение работает как раньше

