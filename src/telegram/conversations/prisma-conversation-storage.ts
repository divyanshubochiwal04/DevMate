import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { IConversationStorage, ConversationStateData } from './conversation-storage.interface';

@Injectable()
export class PrismaConversationStorage implements IConversationStorage {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: bigint, chatId: bigint): Promise<ConversationStateData | null> {
    const record = await this.prisma.telegramConversation.findUnique({
      where: {
        uq_telegram_conversations_user_chat: {
          userId,
          chatId,
        },
      },
    });

    if (!record) {
      return null;
    }

    try {
      return {
        id: record.id,
        userId: record.userId,
        chatId: record.chatId,
        currentState: record.currentState,
        handlerId: record.handlerId,
        step: record.step,
        stateData: JSON.parse(record.stateData),
        stackData: JSON.parse(record.stackData),
        updatedAt: record.updatedAt,
      };
    } catch (e) {
      // In case of corrupt JSON, return fallback
      return {
        id: record.id,
        userId: record.userId,
        chatId: record.chatId,
        currentState: record.currentState,
        handlerId: record.handlerId,
        step: record.step,
        stateData: {},
        stackData: [],
        updatedAt: record.updatedAt,
      };
    }
  }

  async set(userId: bigint, chatId: bigint, state: ConversationStateData): Promise<void> {
    const stateDataStr = JSON.stringify(state.stateData || {});
    const stackDataStr = JSON.stringify(state.stackData || []);

    await this.prisma.telegramConversation.upsert({
      where: {
        uq_telegram_conversations_user_chat: {
          userId,
          chatId,
        },
      },
      update: {
        currentState: state.currentState,
        handlerId: state.handlerId,
        step: state.step,
        stateData: stateDataStr,
        stackData: stackDataStr,
      },
      create: {
        userId,
        chatId,
        currentState: state.currentState,
        handlerId: state.handlerId,
        step: state.step,
        stateData: stateDataStr,
        stackData: stackDataStr,
      },
    });
  }

  async clear(userId: bigint, chatId: bigint): Promise<void> {
    try {
      await this.prisma.telegramConversation.delete({
        where: {
          uq_telegram_conversations_user_chat: {
            userId,
            chatId,
          },
        },
      });
    } catch (error) {
      // Ignore if record already deleted or not found
    }
  }
}
