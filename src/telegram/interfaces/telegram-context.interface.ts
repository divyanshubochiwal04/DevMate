import { Context } from 'telegraf';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ConversationStateData } from '../conversations/conversation-storage.interface';

export interface TelegramContext extends Context {
  user?: AuthenticatedUser;
  conversation?: ConversationStateData;
  transitionTo?: (nextState: string, data?: Record<string, any>) => Promise<void>;
}
