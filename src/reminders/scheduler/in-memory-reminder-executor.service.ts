import { Injectable } from '@nestjs/common';
import { IReminderExecutor } from '../interfaces/reminder-executor.interface';
import { CustomLogger } from '../../common/logger/custom-logger.service';

@Injectable()
export class InMemoryReminderExecutor implements IReminderExecutor {
  private readonly schedules = new Map<string, NodeJS.Timeout>();

  constructor(private readonly logger: CustomLogger) {
    this.logger.setContext('InMemoryReminderExecutor');
  }

  async schedule(reminderId: string, executeAt: Date): Promise<void> {
    await this.cancel(reminderId); // Clear existing timeout first

    const delay = executeAt.getTime() - Date.now();
    if (delay <= 0) {
      this.logger.log(`Execute time is in the past: ${executeAt}. Skipping scheduling timeout.`);
      return;
    }

    this.logger.log(`Scheduling reminder ${reminderId} in ${delay}ms (at ${executeAt})`);
    
    const timeout = setTimeout(() => {
      this.logger.log(`Timer fired for reminder ${reminderId}`);
      this.schedules.delete(reminderId);
    }, delay);

    this.schedules.set(reminderId, timeout);
  }

  async cancel(reminderId: string): Promise<void> {
    const active = this.schedules.get(reminderId);
    if (active) {
      clearTimeout(active);
      this.schedules.delete(reminderId);
      this.logger.log(`Cancelled active scheduling timeout for reminder ${reminderId}`);
    }
  }
}
