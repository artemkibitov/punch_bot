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

  async setState(session, nextState) {
    const currentState = session.state;

    if (!canTransition(currentState, nextState)) {
      throw new Error(
        `Invalid FSM transition: ${currentState} -> ${nextState}`
      );
    }

    await this.sessions.updateState(session.id, nextState);

    return {
      ...session,
      state: nextState
    };
  }

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
