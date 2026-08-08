import { Prisma } from '@prisma/client';

export interface IEventHandler<T = any> {
  handle(payload: T, eventName: string, tx?: Prisma.TransactionClient): Promise<void>;
}
