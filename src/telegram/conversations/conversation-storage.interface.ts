export interface ConversationStateData {
  id?: string;
  userId: bigint;
  chatId: bigint;
  currentState: string;
  handlerId?: string | null;
  step: number;
  stateData: Record<string, any>;
  stackData: any[];
  updatedAt?: Date;
}

export interface IConversationStorage {
  get(userId: bigint, chatId: bigint): Promise<ConversationStateData | null>;
  set(userId: bigint, chatId: bigint, state: ConversationStateData): Promise<void>;
  clear(userId: bigint, chatId: bigint): Promise<void>;
}

export const IConversationStorage = Symbol('IConversationStorage');
