import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './config';
import { DatabaseModule } from './shared/infrastructure/database.module';
import { HealthController } from './shared/presentation/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { AiModule } from './modules/ai/ai.module';

@Module({imports: [ConfigModule.forRoot({isGlobal: true, envFilePath: ['../../.env', '.env'], validate: validateEnvironment}), DatabaseModule, ThrottlerModule.forRoot([{ttl: 60000, limit: 120}]), AuthModule, TicketsModule, AiModule], controllers: [HealthController], providers: [{provide: APP_GUARD, useClass: ThrottlerGuard}]})
export class AppModule {}
