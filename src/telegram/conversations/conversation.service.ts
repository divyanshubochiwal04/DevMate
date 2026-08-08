import { Injectable, Inject } from '@nestjs/common';
import { IConversationStorage, ConversationStateData } from './conversation-storage.interface';
import { CustomLogger } from '../../common/logger/custom-logger.service';

@Injectable()
export class ConversationService {
  constructor(
    @Inject(IConversationStorage) private readonly storage: IConversationStorage,
    private readonly logger: CustomLogger
  ) {
    this.logger.setContext('ConversationService');
  }

  async getConversationState(userId: bigint, chatId: bigint): Promise<ConversationStateData | null> {
    return this.storage.get(userId, chatId);
  }

  async setConversationState(userId: bigint, chatId: bigint, state: ConversationStateData): Promise<void> {
    await this.storage.set(userId, chatId, state);
  }

  async clearConversationState(userId: bigint, chatId: bigint): Promise<void> {
    await this.storage.clear(userId, chatId);
  }

  async transitionTo(
    userId: bigint,
    chatId: bigint,
    nextState: string,
    data?: Record<string, any>
  ): Promise<void> {
    let state = await this.getConversationState(userId, chatId);
    if (!state) {
      state = {
        userId,
        chatId,
        currentState: 'START',
        handlerId: null,
        step: 0,
        stateData: {},
        stackData: [],
      };
    }

    state.currentState = nextState;
    if (data) {
      state.stateData = {
        ...state.stateData,
        ...data,
      };
    }

    await this.setConversationState(userId, chatId, state);
    this.logger.debug(`User ${userId} in Chat ${chatId} transitioned to FSM State: ${nextState}`);
  }

  async pushState(
    userId: bigint,
    chatId: bigint,
    newState: Partial<Omit<ConversationStateData, 'userId' | 'chatId' | 'stackData'>>
  ): Promise<void> {
    let state = await this.getConversationState(userId, chatId);
    if (!state) {
      state = {
        userId,
        chatId,
        currentState: 'START',
        handlerId: null,
        step: 0,
        stateData: {},
        stackData: [],
      };
    }

    // Push current FSM coordinates onto stack
    const stackItem = {
      currentState: state.currentState,
      handlerId: state.handlerId,
      step: state.step,
      stateData: { ...state.stateData },
    };

    state.stackData = [...(state.stackData || []), stackItem];
    
    // Set new FSM coordinates
    if (newState.currentState) state.currentState = newState.currentState;
    if (newState.handlerId !== undefined) state.handlerId = newState.handlerId;
    if (newState.step !== undefined) state.step = newState.step;
    if (newState.stateData) {
      state.stateData = { ...newState.stateData };
    }

    await this.setConversationState(userId, chatId, state);
    this.logger.debug(`User ${userId} pushed state. Stack size is now: ${state.stackData.length}`);
  }

  async popState(userId: bigint, chatId: bigint): Promise<ConversationStateData | null> {
    const state = await this.getConversationState(userId, chatId);
    if (!state || !state.stackData || state.stackData.length === 0) {
      await this.clearConversationState(userId, chatId);
      return null;
    }

    const newStack = [...state.stackData];
    const poppedItem = newStack.pop();

    state.stackData = newStack;
    state.currentState = poppedItem.currentState;
    state.handlerId = poppedItem.handlerId;
    state.step = poppedItem.step;
    state.stateData = poppedItem.stateData;

    await this.setConversationState(userId, chatId, state);
    this.logger.debug(`User ${userId} popped state. Stack size is now: ${state.stackData.length}`);
    return state;
  }
}
