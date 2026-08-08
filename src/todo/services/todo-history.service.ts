import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TodoHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async trackChanges(
    todoId: string,
    userId: string,
    oldRecord: Record<string, any>,
    newRecord: Record<string, any>,
    tx?: any
  ): Promise<void> {
    const client = tx || this.prisma;
    const fieldsToTrack = ['title', 'description', 'priority', 'status', 'dueDate', 'startDate', 'projectId', 'listId'];
    
    for (const field of fieldsToTrack) {
      const oldVal = oldRecord[field];
      const newVal = newRecord[field];

      if (this.hasChanged(oldVal, newVal)) {
        await client.todoHistory.create({
          data: {
            todoId,
            userId,
            field,
            oldValue: oldVal !== null && oldVal !== undefined ? String(oldVal) : null,
            newValue: newVal !== null && newVal !== undefined ? String(newVal) : null,
          },
        });
      }
    }
  }

  private hasChanged(valA: any, valB: any): boolean {
    if (valA === undefined && valB === undefined) return false;
    if (valA === undefined || valB === undefined) return true;
    
    if (valA instanceof Date && valB instanceof Date) {
      return valA.getTime() !== valB.getTime();
    }
    if (valA instanceof Date && typeof valB === 'string') {
      try {
        return valA.toISOString() !== new Date(valB).toISOString();
      } catch {
        return true;
      }
    }
    if (typeof valA === 'string' && valB instanceof Date) {
      try {
        return new Date(valA).toISOString() !== valB.toISOString();
      } catch {
        return true;
      }
    }
    return valA !== valB;
  }
}
