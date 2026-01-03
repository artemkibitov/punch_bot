import { canTransition } from '../../domain/fsm/fsm.js';

export class DialogService {
  constructor({ sessionRepository }) {
    this.sessions = sessionRepository;
  }

  async loadOrCreateSession(telegramUserId) {
    let session = await this.sessions.getByTelegramUserId(telegramUserId);

    if (!session) {
      session = await this.sessions.create(telegramUserId);
    }

    return session;
  }
  async setState(session, nextState, options = {}) {
    const { force = false } = options;
    const currentState = session.state;

    // 1. 🔁 Идемпотентность: если состояние уже совпадает, ничего не делаем
    if (currentState === nextState) {
      return session;
    }

    // 2. 🔓 Проверка перехода
    // Если не форсировано (force) и переход запрещен схемой — выбрасываем ошибку
    if (!force && !canTransition(currentState, nextState)) {
      throw new Error(
        `Invalid FSM transition: ${currentState} -> ${nextState}`
      );
    }

    // 3. 💾 Сохранение в БД
    // Используем ваш репозиторий для обновления
    await this.sessions.updateState(session.id, nextState);

    // 4. 🔄 Обновляем объект сессии "на лету" (чтобы в ctx.state он уже был новым)
    session.state = nextState;

    return { ...session, data: nextState };
  }

  async reset(session) {
    await this.sessions.updateState(session.id, null, session.state);
  }
  // async setState(session, nextState) {
  //   const currentState = session.state;

  //   if (!canTransition(currentState, nextState)) {
  //     throw new Error(
  //       `Invalid FSM transition: ${currentState} -> ${nextState}`
  //     );
  //   }

  //   await this.sessions.updateState(session.id, nextState);

  //   return {
  //     ...session,
  //     state: nextState
  //   };
  // }

  async clearState(session) {
    await this.sessions.updateState(session.id, null);
    await this.sessions.updateData(session.id, {});
  }

  async mergeData(session, patch) {
    const nextData = {
      ...(session.data || {}),
      ...patch
    };

    await this.sessions.updateData(session.id, nextData);

    return {
      ...session,
      data: nextData
    };
  }

  async rollbackState(session, previousState) {
    await this.sessions.updateState(session.id, previousState);
  }
}
