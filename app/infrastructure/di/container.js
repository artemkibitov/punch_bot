/**
 * Dependency Injection Container
 * Управляет зависимостями между слоями
 */

// Репозитории
import { EmployeeRepository } from '../repositories/employeeRepository.js';
import { ShiftRepository } from '../repositories/shiftRepository.js';
import { WorkLogRepository } from '../repositories/workLogRepository.js';
import { ObjectRepository } from '../repositories/objectRepository.js';
import { AssignmentRepository } from '../repositories/assignmentRepository.js';
import { SessionRepository } from '../repositories/sessionRepository.js';
import { AuditLogRepository } from '../repositories/auditLogRepository.js';
import { ManagerPinRepository } from '../repositories/managerPinRepository.js';

// Сервисы
import { DialogService } from '../../application/services/dialogService.js';
import { MessageService } from '../../application/services/messageService.js';
import { ReportService } from '../../application/services/reportService.js';
import { ShiftService } from '../../application/services/ShiftService.js';

class DIContainer {
  constructor() {
    this.services = new Map();
    this.initialized = false;
  }

  /**
   * Инициализация контейнера
   */
  init() {
    if (this.initialized) {
      return;
    }

    // Репозитории (singleton)
    const employeeRepo = new EmployeeRepository();
    const shiftRepo = new ShiftRepository();
    const workLogRepo = new WorkLogRepository();
    const objectRepo = new ObjectRepository();
    const assignmentRepo = new AssignmentRepository();
    const sessionRepo = new SessionRepository();
    const auditLogRepo = new AuditLogRepository();
    const managerPinRepo = new ManagerPinRepository();

    // Регистрируем репозитории
    this.register('EmployeeRepository', employeeRepo);
    this.register('ShiftRepository', shiftRepo);
    this.register('WorkLogRepository', workLogRepo);
    this.register('ObjectRepository', objectRepo);
    this.register('AssignmentRepository', assignmentRepo);
    this.register('SessionRepository', sessionRepo);
    this.register('AuditLogRepository', auditLogRepo);
    this.register('ManagerPinRepository', managerPinRepo);

    // Сервисы
    const dialogService = new DialogService({ sessionRepository: sessionRepo });
    const messageService = new MessageService();
    const reportService = new ReportService();
    const shiftTimeService = new ShiftService();

    this.register('DialogService', dialogService);
    this.register('MessageService', messageService);
    this.register('ReportService', reportService);
    this.register('ShiftTimeService', shiftTimeService);

    // Use Cases будут регистрироваться динамически при первом использовании
    this.useCaseCache = new Map();

    this.initialized = true;
  }

  /**
   * Регистрация сервиса
   */
  register(name, instance) {
    this.services.set(name, instance);
  }

  /**
   * Получение сервиса
   */
  get(name) {
    // Проверяем кэш use cases
    if (this.useCaseCache.has(name)) {
      return this.useCaseCache.get(name);
    }

    // Если это use case, создаем его динамически (синхронно для обратной совместимости)
    // В реальности use cases должны загружаться асинхронно, но для упрощения
    // будем использовать синхронный подход через getAsync
    if (name.endsWith('UseCase')) {
      throw new Error(`UseCase ${name} must be loaded via getAsync() method`);
    }

    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }
    return service;
  }

  /**
   * Асинхронное получение use case
   */
  async getAsync(name) {
    if (name.endsWith('UseCase')) {
      return await this.createUseCase(name);
    }
    return this.get(name);
  }

  /**
   * Динамическое создание use case
   */
  async createUseCase(useCaseName) {
    if (this.useCaseCache.has(useCaseName)) {
      return this.useCaseCache.get(useCaseName);
    }

    // Загружаем класс use case
    const UseCaseModule = await this.loadUseCase(useCaseName);
    if (!UseCaseModule) {
      throw new Error(`UseCase not found: ${useCaseName}`);
    }

    const UseCaseClass = UseCaseModule[useCaseName] || UseCaseModule.default;
    if (!UseCaseClass) {
      throw new Error(`UseCase class not found in module: ${useCaseName}`);
    }

    // Создаем экземпляр с зависимостями
    const dependencies = this.getUseCaseDependencies(useCaseName);
    const instance = new UseCaseClass(...dependencies);
    this.useCaseCache.set(useCaseName, instance);
    return instance;
  }

  /**
   * Загрузка класса use case (динамический импорт)
   */
  async loadUseCase(useCaseName) {
    // Маппинг имен use cases на пути
    const useCaseMap = {
      // Shift use cases
      'CreateShiftUseCase': () => import('../../application/usecases/shift/CreateShiftUseCase.js'),
      'ConfirmShiftStartUseCase': () => import('../../application/usecases/shift/ConfirmShiftStartUseCase.js'),
      'ConfirmShiftEndUseCase': () => import('../../application/usecases/shift/ConfirmShiftEndUseCase.js'),
      'AddEmployeeToShiftUseCase': () => import('../../application/usecases/shift/AddEmployeeToShiftUseCase.js'),
      'RemoveEmployeeFromShiftUseCase': () => import('../../application/usecases/shift/RemoveEmployeeFromShiftUseCase.js'),
      'GetShiftDetailsUseCase': () => import('../../application/usecases/shift/GetShiftDetailsUseCase.js'),
      'GetShiftsListUseCase': () => import('../../application/usecases/shift/GetShiftsListUseCase.js'),
      'GetShiftReportUseCase': () => import('../../application/usecases/shift/GetShiftReportUseCase.js'),

      // Employee use cases
      'CreateEmployeeUseCase': () => import('../../application/usecases/employee/CreateEmployeeUseCase.js'),
      'LinkTelegramUseCase': () => import('../../application/usecases/employee/LinkTelegramUseCase.js'),
      'GenerateRefCodeUseCase': () => import('../../application/usecases/employee/GenerateRefCodeUseCase.js'),
      'GetEmployeeDetailsUseCase': () => import('../../application/usecases/employee/GetEmployeeDetailsUseCase.js'),
      'GetEmployeesListUseCase': () => import('../../application/usecases/employee/GetEmployeesListUseCase.js'),

      // Object use cases
      'CreateObjectUseCase': () => import('../../application/usecases/object/CreateObjectUseCase.js'),
      'UpdateObjectUseCase': () => import('../../application/usecases/object/UpdateObjectUseCase.js'),
      'GetObjectDetailsUseCase': () => import('../../application/usecases/object/GetObjectDetailsUseCase.js'),
      'GetObjectsListUseCase': () => import('../../application/usecases/object/GetObjectsListUseCase.js'),
      'AssignEmployeeToObjectUseCase': () => import('../../application/usecases/object/AssignEmployeeToObjectUseCase.js'),
      'UnassignEmployeeFromObjectUseCase': () => import('../../application/usecases/object/UnassignEmployeeFromObjectUseCase.js'),

      // WorkLog use cases
      'CreateWorkLogUseCase': () => import('../../application/usecases/worklog/CreateWorkLogUseCase.js'),
      'UpdateWorkLogUseCase': () => import('../../application/usecases/worklog/UpdateWorkLogUseCase.js'),
      'GetWorkLogDetailsUseCase': () => import('../../application/usecases/worklog/GetWorkLogDetailsUseCase.js'),
      'GetWorkLogsListUseCase': () => import('../../application/usecases/worklog/GetWorkLogsListUseCase.js'),
    };

    const loader = useCaseMap[useCaseName];
    if (!loader) {
      return null;
    }

    return await loader();
  }

  /**
   * Получение зависимостей для use case
   */
  getUseCaseDependencies(useCaseName) {
    // Базовые зависимости
    const shiftRepo = this.get('ShiftRepository');
    const workLogRepo = this.get('WorkLogRepository');
    const objectRepo = this.get('ObjectRepository');
    const assignmentRepo = this.get('AssignmentRepository');
    const auditLogRepo = this.get('AuditLogRepository');
    const employeeRepo = this.get('EmployeeRepository');

    // Специфичные зависимости для каждого use case
    const depsMap = {
      'CreateShiftUseCase': [shiftRepo, objectRepo],
      'ConfirmShiftStartUseCase': [shiftRepo, workLogRepo, assignmentRepo, auditLogRepo],
      'ConfirmShiftEndUseCase': [shiftRepo, workLogRepo, auditLogRepo],
      'AddEmployeeToShiftUseCase': [shiftRepo, workLogRepo, auditLogRepo],
      'RemoveEmployeeFromShiftUseCase': [shiftRepo, workLogRepo, auditLogRepo],
      'GetShiftDetailsUseCase': [shiftRepo, workLogRepo],
      'GetShiftsListUseCase': [shiftRepo],
      'GetShiftReportUseCase': [workLogRepo],

      // Employee use cases
      'CreateEmployeeUseCase': [employeeRepo, auditLogRepo],
      'LinkTelegramUseCase': [employeeRepo, auditLogRepo],
      'GenerateRefCodeUseCase': [employeeRepo],
      'GetEmployeeDetailsUseCase': [employeeRepo],
      'GetEmployeesListUseCase': [employeeRepo],

      // Object use cases
      'CreateObjectUseCase': [objectRepo, auditLogRepo],
      'UpdateObjectUseCase': [objectRepo, auditLogRepo],
      'GetObjectDetailsUseCase': [objectRepo],
      'GetObjectsListUseCase': [objectRepo],
      'AssignEmployeeToObjectUseCase': [assignmentRepo, objectRepo, employeeRepo, auditLogRepo],
      'UnassignEmployeeFromObjectUseCase': [assignmentRepo, auditLogRepo],

      // WorkLog use cases
      'CreateWorkLogUseCase': [workLogRepo, auditLogRepo],
      'UpdateWorkLogUseCase': [workLogRepo, auditLogRepo],
      'GetWorkLogDetailsUseCase': [workLogRepo],
      'GetWorkLogsListUseCase': [workLogRepo],
    };

    return depsMap[useCaseName] || [];
  }
}

// Singleton instance
export const container = new DIContainer();

// Инициализация при импорте
container.init();

