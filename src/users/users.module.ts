import { Module } from '@nestjs/common';
import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';
import { UsersRepository } from './repositories/users.repository';
import { IUserCache } from './interfaces/user-cache.interface';
import { InMemoryUserCache } from './services/in-memory-user-cache.service';
import { PrismaModule } from '../database/prisma.module';
import { CustomLogger } from '../common/logger/custom-logger.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [
    CustomLogger,
    UsersService,
    UsersRepository,
    {
      provide: IUserCache,
      useClass: InMemoryUserCache,
    },
  ],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
