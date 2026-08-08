import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { PrismaModule } from "./database/prisma.module";
import { HealthModule } from "./health/health.module";
import { RbacModule } from "./rbac/rbac.module";
import { AuthCoreModule } from "./auth/auth-core.module";
import { TelegramModule } from "./telegram/telegram.module";
import { UsersModule } from "./users/users.module";
import { TodoModule } from "./todo/todo.module";
import { RemindersModule } from "./reminders/reminders.module";
import { NotesModule } from "./notes/notes.module";
import { FinanceModule } from "./finance/finance.module";
import { SplitterModule } from "./splitter/splitter.module";
import { VaultModule } from "./vault/vault.module";
import { CalendarModule } from "./calendar/calendar.module";
import { EventsModule } from "./events/events.module";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { CustomLogger } from "./common/logger/custom-logger.service";

@Module({
  imports: [ConfigModule, PrismaModule, RbacModule, AuthCoreModule, HealthModule, TelegramModule, UsersModule, TodoModule, RemindersModule, NotesModule, FinanceModule, SplitterModule, VaultModule, CalendarModule, EventsModule],
  providers: [CustomLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request ID middleware globally to all routes for tracing request context
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
